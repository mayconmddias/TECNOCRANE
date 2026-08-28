-- ============================================================================
-- CRANE PRO - SCHEMA MIGRATION V5: CADASTRO DINÂMICO DE ATIVOS E CONCILIAÇÃO
-- ============================================================================

-- 1. EXTENSÃO NA TABELA all_assets (21 COLUNAS LEGADAS + 7 DINÂMICAS = 28 COLS)
ALTER TABLE public.all_assets 
ADD COLUMN IF NOT EXISTS template_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS template_name TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS schema_snapshot JSONB DEFAULT NULL,
ADD COLUMN IF NOT EXISTS custom_fields JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS is_provisional BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS provisional_id TEXT DEFAULT NULL,
ADD COLUMN IF NOT EXISTS sync_status TEXT DEFAULT 'synced';

-- 2. TABELA DE SEQUÊNCIA GLOBAL ATÔMICA MULTI-TENANT
CREATE TABLE IF NOT EXISTS public.crane_asset_sequence (
    tenant_code TEXT PRIMARY KEY,
    last_number BIGINT NOT NULL CHECK (last_number >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.crane_asset_sequence ENABLE ROW LEVEL SECURITY;
REVOKE INSERT, UPDATE, DELETE ON public.crane_asset_sequence FROM anon, authenticated;
GRANT SELECT ON public.crane_asset_sequence TO authenticated;

-- Inicialização segura do Tenant 001 (Piloto) se inexistente
INSERT INTO public.crane_asset_sequence (tenant_code, last_number, updated_at)
VALUES (
    '001',
    COALESCE((
        SELECT MAX(NULLIF((regexp_match(id, '^(?:#?EQP[- ]?)([0-9]+)$', 'i'))[1], '')::BIGINT)
        FROM public.all_assets
    ), 0),
    NOW()
)
ON CONFLICT (tenant_code) DO UPDATE 
SET last_number = GREATEST(crane_asset_sequence.last_number, EXCLUDED.last_number);

-- 3. TABELA DE CONFLITOS DE SINCRONIZAÇÃO
CREATE TABLE IF NOT EXISTS public.crane_sync_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_code TEXT NOT NULL,
    conflict_type TEXT NOT NULL,
    provisional_asset_id TEXT NOT NULL,
    conflicting_remote_id TEXT NOT NULL,
    report_id TEXT,
    local_payload JSONB NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    resolved_by TEXT,
    resolution_notes TEXT,
    resolved_asset_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    CONSTRAINT chk_sync_conflict_status CHECK (status IN ('PENDING', 'RESOLVED', 'REJECTED')),
    CONSTRAINT chk_sync_conflict_resolution_integrity CHECK (
        (status = 'PENDING' AND resolved_by IS NULL AND resolved_at IS NULL AND resolved_asset_id IS NULL)
        OR
        (status = 'RESOLVED' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL AND resolved_asset_id IS NOT NULL)
        OR
        (status = 'REJECTED' AND resolved_by IS NOT NULL AND resolved_at IS NOT NULL AND resolved_asset_id IS NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_crane_sync_conflicts_tenant_status ON public.crane_sync_conflicts(tenant_code, status);

ALTER TABLE public.crane_sync_conflicts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Leitura segregada de conflitos" ON public.crane_sync_conflicts;
CREATE POLICY "Leitura segregada de conflitos" 
ON public.crane_sync_conflicts FOR SELECT TO authenticated 
USING (
    (COALESCE(auth.jwt() ->> 'role', '') = 'service_role' OR current_user = 'service_role')
    OR
    (
        (auth.jwt() -> 'app_metadata' ->> 'tenant_code') IS NOT NULL
        AND (auth.jwt() -> 'app_metadata' ->> 'tenant_code') <> ''
        AND tenant_code = (auth.jwt() -> 'app_metadata' ->> 'tenant_code')
        AND (
            (auth.jwt() -> 'app_metadata' ->> 'role') IN ('supervisor', 'admin')
            OR
            ((local_payload -> 'report' ->> 'tecnico') = (auth.jwt() ->> 'email'))
            OR
            ((local_payload -> 'asset' ->> 'created_by') = (auth.jwt() ->> 'email'))
        )
    )
);

DROP POLICY IF EXISTS "Permitir inserção de conflitos pendentes por autenticados" ON public.crane_sync_conflicts;
CREATE POLICY "Permitir inserção de conflitos pendentes por autenticados" 
ON public.crane_sync_conflicts FOR INSERT TO authenticated 
WITH CHECK (
    status = 'PENDING' AND 
    resolved_by IS NULL AND 
    resolved_at IS NULL AND 
    resolved_asset_id IS NULL AND 
    local_payload IS NOT NULL AND
    provisional_asset_id IS NOT NULL AND 
    provisional_asset_id <> '' AND
    (auth.jwt() -> 'app_metadata' ->> 'tenant_code') IS NOT NULL AND
    tenant_code = (auth.jwt() -> 'app_metadata' ->> 'tenant_code')
);

REVOKE UPDATE, DELETE ON public.crane_sync_conflicts FROM anon, authenticated;

-- 4. RPC PARA RESERVA ATÔMICA DE ID COM AUTO-PROVISIONAMENTO SEGURO
CREATE OR REPLACE FUNCTION public.reserve_next_asset_number(p_tenant_code TEXT)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_next BIGINT;
    v_user_tenant TEXT;
    v_is_service_role BOOLEAN;
BEGIN
    IF p_tenant_code IS NULL OR TRIM(p_tenant_code) = '' THEN
        RAISE EXCEPTION 'Tenant inválido ou não informado.';
    END IF;

    v_is_service_role := (COALESCE(auth.jwt() ->> 'role', '') = 'service_role' OR current_user = 'service_role');
    v_user_tenant := COALESCE(auth.jwt() -> 'app_metadata' ->> 'tenant_code', '');

    IF NOT v_is_service_role THEN
        IF v_user_tenant = '' THEN
            RAISE EXCEPTION 'Acesso Negado: JWT não possui tenant_code associado.';
        END IF;
        IF p_tenant_code IS DISTINCT FROM v_user_tenant THEN
            RAISE EXCEPTION 'Acesso Negado: Usuário do tenant % não possui autorização para reservar número para o tenant %.', v_user_tenant, p_tenant_code;
        END IF;
    END IF;

    INSERT INTO public.crane_asset_sequence (tenant_code, last_number, updated_at)
    VALUES (p_tenant_code, 0, NOW())
    ON CONFLICT (tenant_code) DO NOTHING;

    SELECT last_number + 1 INTO v_next
    FROM public.crane_asset_sequence
    WHERE tenant_code = p_tenant_code
    FOR UPDATE;

    UPDATE public.crane_asset_sequence
    SET last_number = v_next, updated_at = NOW()
    WHERE tenant_code = p_tenant_code;
    
    RETURN v_next;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_next_asset_number(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reserve_next_asset_number(TEXT) TO authenticated;

-- 5. RPC DE RESOLUÇÃO DE CONFLITOS COM ISOLAMENTO RIGOROSO
CREATE OR REPLACE FUNCTION public.resolve_sync_conflict(
    p_conflict_id UUID,
    p_resolution_notes TEXT DEFAULT ''
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_conflict RECORD;
    v_new_number BIGINT;
    v_new_asset_id TEXT;
    v_asset_payload JSONB;
    v_report_payload JSONB;
    v_orders_payload JSONB;
    v_events_payload JSONB;
    v_user_email TEXT;
    v_user_role TEXT;
    v_user_tenant TEXT;
    v_is_service_role BOOLEAN;
    v_responses JSONB;
    v_meta JSONB;
    v_audit_entry JSONB;
    v_report_id TEXT;
    v_order_id TEXT;
    v_event_id TEXT;
    v_elem JSONB;
    v_loop_count INTEGER;
    v_asset_empresa TEXT;
    v_asset_id_raw TEXT;
BEGIN
    v_is_service_role := (COALESCE(auth.jwt() ->> 'role', '') = 'service_role' OR current_user = 'service_role');
    v_user_role := COALESCE(auth.jwt() -> 'app_metadata' ->> 'role', '');

    IF NOT v_is_service_role AND v_user_role NOT IN ('supervisor', 'admin') THEN
        RAISE EXCEPTION 'Acesso Negado: Apenas supervisores autorizados podem resolver conflitos de sincronização. (Role: %)', v_user_role;
    END IF;

    SELECT * INTO v_conflict
    FROM public.crane_sync_conflicts
    WHERE id = p_conflict_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Conflito % não encontrado.', p_conflict_id;
    END IF;

    v_user_tenant := COALESCE(auth.jwt() -> 'app_metadata' ->> 'tenant_code', '');
    IF NOT v_is_service_role THEN
        IF v_user_tenant = '' OR v_conflict.tenant_code IS DISTINCT FROM v_user_tenant THEN
            RAISE EXCEPTION 'Acesso Negado: Supervisor do tenant % não possui autorização para resolver conflito do tenant %.', v_user_tenant, v_conflict.tenant_code;
        END IF;
    END IF;

    IF v_conflict.status = 'REJECTED' THEN
        RAISE EXCEPTION 'Operação Bloqueada: O conflito % foi REJEITADO e não pode ser resolvido ou reprocessado.', p_conflict_id;
    END IF;

    IF v_conflict.status = 'RESOLVED' THEN
        RETURN jsonb_build_object(
            'success', true,
            'conflictId', p_conflict_id,
            'resolvedAssetId', v_conflict.resolved_asset_id,
            'resolvedBy', v_conflict.resolved_by,
            'alreadyResolved', true
        );
    END IF;

    v_user_email := COALESCE(auth.jwt() ->> 'email', 'supervisor_autenticado');
    v_asset_payload := v_conflict.local_payload -> 'asset';
    v_report_payload := v_conflict.local_payload -> 'report';
    v_orders_payload := v_conflict.local_payload -> 'orders';
    v_events_payload := v_conflict.local_payload -> 'events';

    IF v_asset_payload IS NULL OR (v_asset_payload ->> 'empresa') IS NULL OR (v_asset_payload ->> 'empresa') = '' OR
       (v_asset_payload ->> 'tipo') IS NULL OR (v_asset_payload ->> 'tipo') = '' THEN
        RAISE EXCEPTION 'Payload inválido: Ativo incompleto ou sem campos estruturais obrigatórios.';
    END IF;

    v_asset_empresa := TRIM(v_asset_payload ->> 'empresa');
    v_asset_id_raw := TRIM(v_asset_payload ->> 'id');

    IF v_conflict.provisional_asset_id IS DISTINCT FROM v_asset_id_raw THEN
        RAISE EXCEPTION 'Incoerência referencial: provisional_asset_id (%) diverge de asset.id (%).', v_conflict.provisional_asset_id, v_asset_id_raw;
    END IF;

    IF v_report_payload IS NOT NULL AND v_report_payload <> 'null'::jsonb THEN
        IF (v_report_payload ->> 'id') IS NULL OR TRIM(v_report_payload ->> 'id') = '' THEN
            RAISE EXCEPTION 'Payload inválido: Relatório sem ID de identificação.';
        END IF;

        IF TRIM(COALESCE(v_report_payload ->> 'equipamentoId', v_report_payload ->> 'equipamento', '')) IS DISTINCT FROM v_asset_id_raw THEN
            RAISE EXCEPTION 'Incoerência referencial: report.equipamentoId diverge de asset.id.';
        END IF;

        IF TRIM(COALESCE(v_report_payload ->> 'empresa', '')) IS DISTINCT FROM v_asset_empresa THEN
            RAISE EXCEPTION 'Incoerência referencial: Empresa do laudo diverge da empresa do ativo.';
        END IF;
    END IF;

    IF v_orders_payload IS NOT NULL AND jsonb_typeof(v_orders_payload) = 'array' THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_orders_payload) LOOP
            IF TRIM(COALESCE(v_elem ->> 'empresa', '')) IS DISTINCT FROM v_asset_empresa THEN
                RAISE EXCEPTION 'Incoerência referencial: Ordem % pertence a empresa diferente do ativo.', (v_elem ->> 'id');
            END IF;
            IF TRIM(COALESCE(v_elem ->> 'equipamentoId', v_elem ->> 'equipamento', '')) IS DISTINCT FROM v_asset_id_raw THEN
                RAISE EXCEPTION 'Incoerência referencial: Ordem % vinculada a equipamento diferente do provisório.', (v_elem ->> 'id');
            END IF;
        END LOOP;
    END IF;

    IF v_events_payload IS NOT NULL AND jsonb_typeof(v_events_payload) = 'array' THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_events_payload) LOOP
            IF TRIM(COALESCE(v_elem ->> 'empresa', '')) IS DISTINCT FROM v_asset_empresa THEN
                RAISE EXCEPTION 'Incoerência referencial: Evento pertence a empresa diferente do ativo.';
            END IF;
            IF TRIM(COALESCE(v_elem ->> 'equipamento', '')) IS DISTINCT FROM v_asset_id_raw THEN
                RAISE EXCEPTION 'Incoerência referencial: Evento vinculado a equipamento diferente do provisório.';
            END IF;
        END LOOP;
    END IF;

    SELECT public.reserve_next_asset_number(v_conflict.tenant_code) INTO v_new_number;
    v_new_asset_id := '#EQP-' || LPAD(v_new_number::TEXT, 4, '0');

    INSERT INTO public.all_assets (
        id, empresa, nome, tipo, local, fabricante, capacidade, caboprincipal,
        capacidadeauxiliar, caboauxiliar, altura, vao, tensaoalimentacao,
        tensaocomando, alimentacaoequipamento, motorelevprincipalalta,
        motorelevprincipalbaixa, motorelevauxiliaralta, motorelevauxiliarbaixa,
        motordirecaocarro, motortranslacaoponte, template_id, template_name,
        schema_snapshot, custom_fields, is_provisional, provisional_id, sync_status
    ) VALUES (
        v_new_asset_id,
        v_asset_empresa,
        COALESCE(v_asset_payload ->> 'nome', v_asset_payload ->> 'tipo', ''),
        COALESCE(v_asset_payload ->> 'tipo', ''),
        COALESCE(v_asset_payload ->> 'local', ''),
        COALESCE(v_asset_payload ->> 'fabricante', ''),
        COALESCE(v_asset_payload ->> 'capacidade', ''),
        COALESCE(v_asset_payload ->> 'caboprincipal', v_asset_payload ->> 'caboPrincipal', ''),
        COALESCE(v_asset_payload ->> 'capacidadeauxiliar', v_asset_payload ->> 'capacidadeAuxiliar', ''),
        COALESCE(v_asset_payload ->> 'caboauxiliar', v_asset_payload ->> 'caboAuxiliar', ''),
        COALESCE(v_asset_payload ->> 'altura', ''),
        COALESCE(v_asset_payload ->> 'vao', ''),
        COALESCE(v_asset_payload ->> 'tensaoalimentacao', v_asset_payload ->> 'tensaoAlimentacao', ''),
        COALESCE(v_asset_payload ->> 'tensaocomando', v_asset_payload ->> 'tensaoComando', ''),
        COALESCE(v_asset_payload ->> 'alimentacaoequipamento', v_asset_payload ->> 'alimentacaoEquipamento', ''),
        COALESCE(v_asset_payload ->> 'motorelevprincipalalta', v_asset_payload ->> 'motorElevPrincipalAlta', ''),
        COALESCE(v_asset_payload ->> 'motorelevprincipalbaixa', v_asset_payload ->> 'motorElevPrincipalBaixa', ''),
        COALESCE(v_asset_payload ->> 'motorelevauxiliaralta', v_asset_payload ->> 'motorElevAuxiliarAlta', ''),
        COALESCE(v_asset_payload ->> 'motorelevauxiliarbaixa', v_asset_payload ->> 'motorElevAuxiliarBaixa', ''),
        COALESCE(v_asset_payload ->> 'motordirecaocarro', v_asset_payload ->> 'motorDirecaoCarro', ''),
        COALESCE(v_asset_payload ->> 'motortranslacaoponte', v_asset_payload ->> 'motorTranslacaoPonte', ''),
        v_asset_payload ->> 'template_id',
        v_asset_payload ->> 'template_name',
        COALESCE(v_asset_payload -> 'schema_snapshot', 'null'::jsonb),
        COALESCE(v_asset_payload -> 'custom_fields', '{}'::jsonb),
        false,
        v_conflict.provisional_asset_id,
        'synced'
    );

    IF v_report_payload IS NOT NULL AND v_report_payload <> 'null'::jsonb THEN
        v_report_id := v_report_payload ->> 'id';

        IF EXISTS (SELECT 1 FROM public.finalized_reports WHERE id = v_report_id) THEN
            v_report_id := (v_report_payload ->> 'id') || '-R-' || LPAD(v_new_number::TEXT, 4, '0');
            v_loop_count := 1;
            WHILE EXISTS (SELECT 1 FROM public.finalized_reports WHERE id = v_report_id) LOOP
                v_report_id := (v_report_payload ->> 'id') || '-R-' || LPAD(v_new_number::TEXT, 4, '0') || '-' || LPAD(v_loop_count::TEXT, 3, '0');
                v_loop_count := v_loop_count + 1;
            END LOOP;
        END IF;

        v_responses := COALESCE(v_report_payload -> 'responses', '{}'::jsonb);
        v_meta := COALESCE(v_responses -> '__meta', '{}'::jsonb);

        v_audit_entry := jsonb_build_object(
            'eventType', 'CONFLICT_RECONCILIATION',
            'provisionalAssetId', v_conflict.provisional_asset_id,
            'resolvedAssetId', v_new_asset_id,
            'provisionalReportId', v_report_payload ->> 'id',
            'resolvedReportId', v_report_id,
            'conflictId', v_conflict.id,
            'resolvedBy', v_user_email,
            'resolvedAt', NOW()
        );

        v_meta := jsonb_set(
            v_meta,
            '{auditTrail}',
            COALESCE(v_meta -> 'auditTrail', '[]'::jsonb) || jsonb_build_array(v_audit_entry)
        );

        v_responses := jsonb_set(v_responses, '{__meta}', v_meta);

        PERFORM set_config('crane.is_reconciling_conflict', 'true', true);

        INSERT INTO public.finalized_reports (
            id, status, type, empresa, "equipamentoId", "equipamentoNome",
            "assetInfo", date, responses, "generalObservation", responsaveis,
            tecnico, "customItems", "customSections", "generalImages"
        ) VALUES (
            v_report_id,
            COALESCE(v_report_payload ->> 'status', 'FINALIZADO'),
            COALESCE(v_report_payload ->> 'type', 'PREVENTIVA'),
            v_asset_empresa,
            v_new_asset_id,
            v_new_asset_id,
            COALESCE(v_report_payload ->> 'assetInfo', '') || ' [ID Homologado pós-conflito]',
            COALESCE(v_report_payload ->> 'date', NOW()::DATE::TEXT),
            v_responses,
            COALESCE(v_report_payload ->> 'generalObservation', ''),
            COALESCE(v_report_payload -> 'responsaveis', '[]'::jsonb),
            COALESCE(v_report_payload ->> 'tecnico', ''),
            COALESCE(v_report_payload -> 'customItems', '[]'::jsonb),
            COALESCE(v_report_payload -> 'customSections', '[]'::jsonb),
            COALESCE(v_report_payload -> 'generalImages', '[]'::jsonb)
        );
    END IF;

    IF v_orders_payload IS NOT NULL AND jsonb_typeof(v_orders_payload) = 'array' THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_orders_payload) LOOP
            v_order_id := v_elem ->> 'id';

            IF EXISTS (SELECT 1 FROM public.open_orders WHERE id = v_order_id) THEN
                v_order_id := (v_elem ->> 'id') || '-R-' || LPAD(v_new_number::TEXT, 4, '0');
                v_loop_count := 1;
                WHILE EXISTS (SELECT 1 FROM public.open_orders WHERE id = v_order_id) LOOP
                    v_order_id := (v_elem ->> 'id') || '-R-' || LPAD(v_new_number::TEXT, 4, '0') || '-' || LPAD(v_loop_count::TEXT, 3, '0');
                    v_loop_count := v_loop_count + 1;
                END LOOP;
            END IF;

            INSERT INTO public.open_orders (
                id, status, type, empresa, "equipamentoId", "equipamentoNome",
                "assetInfo", date, responses, "generalObservation", responsaveis,
                tecnico, "customItems", "customSections", "generalImages"
            ) VALUES (
                v_order_id,
                COALESCE(v_elem ->> 'status', 'DRAFT'),
                COALESCE(v_elem ->> 'type', 'PREVENTIVA'),
                v_asset_empresa,
                v_new_asset_id,
                v_new_asset_id,
                COALESCE(v_elem ->> 'assetInfo', '') || ' [Reconciliado]',
                COALESCE(v_elem ->> 'date', NOW()::DATE::TEXT),
                COALESCE(v_elem -> 'responses', '{}'::jsonb),
                COALESCE(v_elem ->> 'generalObservation', ''),
                COALESCE(v_elem -> 'responsaveis', '[]'::jsonb),
                COALESCE(v_elem ->> 'tecnico', ''),
                COALESCE(v_elem -> 'customItems', '[]'::jsonb),
                COALESCE(v_elem -> 'customSections', '[]'::jsonb),
                COALESCE(v_elem -> 'generalImages', '[]'::jsonb)
            );
        END LOOP;
    END IF;

    IF v_events_payload IS NOT NULL AND jsonb_typeof(v_events_payload) = 'array' THEN
        FOR v_elem IN SELECT * FROM jsonb_array_elements(v_events_payload) LOOP
            v_event_id := v_new_asset_id || '-' || COALESCE(v_elem ->> 'date', NOW()::DATE::TEXT);

            IF EXISTS (SELECT 1 FROM public.scheduled_inspections WHERE id = v_event_id) THEN
                v_loop_count := 1;
                WHILE EXISTS (SELECT 1 FROM public.scheduled_inspections WHERE id = v_event_id || '-' || LPAD(v_loop_count::TEXT, 3, '0')) LOOP
                    v_loop_count := v_loop_count + 1;
                END LOOP;
                v_event_id := v_event_id || '-' || LPAD(v_loop_count::TEXT, 3, '0');
            END IF;

            INSERT INTO public.scheduled_inspections (
                id, "groupId", empresa, equipamento, date, status,
                justificativa, color, "textColor", tipo, local
            ) VALUES (
                v_event_id,
                v_elem ->> 'groupId',
                v_asset_empresa,
                v_new_asset_id,
                COALESCE(v_elem ->> 'date', NOW()::DATE::TEXT),
                COALESCE(v_elem ->> 'status', 'PENDENTE'),
                COALESCE(v_elem ->> 'justificativa', ''),
                COALESCE(v_elem ->> 'color', ''),
                COALESCE(v_elem ->> 'textColor', ''),
                COALESCE(v_elem ->> 'tipo', ''),
                COALESCE(v_elem ->> 'local', '')
            );
        END LOOP;
    END IF;

    UPDATE public.crane_sync_conflicts
    SET status = 'RESOLVED',
        resolved_by = v_user_email,
        resolution_notes = p_resolution_notes,
        resolved_asset_id = v_new_asset_id,
        resolved_at = NOW()
    WHERE id = p_conflict_id;

    RETURN jsonb_build_object(
        'success', true,
        'conflictId', p_conflict_id,
        'resolvedAssetId', v_new_asset_id,
        'resolvedBy', v_user_email,
        'alreadyResolved', false
    );
END;
$$;

REVOKE ALL ON FUNCTION public.resolve_sync_conflict(UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.resolve_sync_conflict(UUID, TEXT) TO authenticated;

-- 6. TRIGGERS DE PROTEÇÃO DE SCHEMA, IMUTABILIDADE E PROIBIÇÃO DE DELETE
CREATE OR REPLACE FUNCTION public.protect_asset_dynamic_columns()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.schema_snapshot IS NULL AND OLD.schema_snapshot IS NOT NULL THEN
        NEW.schema_snapshot := OLD.schema_snapshot;
        NEW.template_id := OLD.template_id;
        NEW.template_name := OLD.template_name;
        NEW.custom_fields := OLD.custom_fields;
    END IF;

    IF OLD.schema_snapshot IS NOT NULL AND OLD.schema_snapshot IS DISTINCT FROM NEW.schema_snapshot THEN
        RAISE EXCEPTION 'Imutabilidade de Snapshot: É proibido alterar ou substituir o schema_snapshot de um ativo após sua criação.';
    END IF;

    IF OLD.template_id IS NOT NULL AND OLD.template_id IS DISTINCT FROM NEW.template_id THEN
        RAISE EXCEPTION 'Imutabilidade de Template: É proibido alterar o template_id de um ativo após sua criação.';
    END IF;

    IF OLD.template_name IS NOT NULL AND OLD.template_name IS DISTINCT FROM NEW.template_name THEN
        RAISE EXCEPTION 'Imutabilidade de Template: É proibido alterar o template_name de um ativo após sua criação.';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_dynamic_cols ON public.all_assets;
CREATE TRIGGER trg_protect_dynamic_cols
BEFORE UPDATE ON public.all_assets
FOR EACH ROW EXECUTE FUNCTION public.protect_asset_dynamic_columns();

CREATE OR REPLACE FUNCTION public.protect_finalized_report_immutability()
RETURNS TRIGGER AS $$
DECLARE
    v_old_meta JSONB;
    v_new_meta JSONB;
    v_idx INTEGER;
    v_old_len INTEGER;
    v_new_len INTEGER;
BEGIN
    IF OLD.id IS DISTINCT FROM NEW.id THEN
        RAISE EXCEPTION 'Imutabilidade de Laudo: É proibido alterar o ID primário de um laudo finalizado.';
    END IF;
    IF OLD."equipamentoId" IS DISTINCT FROM NEW."equipamentoId" THEN
        RAISE EXCEPTION 'Imutabilidade de Laudo: É proibido alterar o vínculo do equipamentoId (%) de um laudo finalizado.', OLD."equipamentoId";
    END IF;
    IF OLD."equipamentoNome" IS DISTINCT FROM NEW."equipamentoNome" THEN
        RAISE EXCEPTION 'Imutabilidade de Laudo: É proibido alterar o equipamentoNome (%) de um laudo finalizado.', OLD."equipamentoNome";
    END IF;
    IF OLD.empresa IS DISTINCT FROM NEW.empresa THEN
        RAISE EXCEPTION 'Imutabilidade de Laudo: É proibido alterar a empresa de um laudo finalizado.';
    END IF;
    IF OLD.date IS DISTINCT FROM NEW.date THEN
        RAISE EXCEPTION 'Imutabilidade de Laudo: É proibido alterar a data de um laudo finalizado.';
    END IF;
    IF OLD.tecnico IS DISTINCT FROM NEW.tecnico THEN
        RAISE EXCEPTION 'Imutabilidade de Laudo: É proibido alterar o técnico de um laudo finalizado.';
    END IF;
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        RAISE EXCEPTION 'Imutabilidade de Laudo: É proibido alterar o status de um laudo finalizado.';
    END IF;
    IF OLD.type IS DISTINCT FROM NEW.type THEN
        RAISE EXCEPTION 'Imutabilidade de Laudo: É proibido alterar o tipo de um laudo finalizado.';
    END IF;
    IF OLD."assetInfo" IS DISTINCT FROM NEW."assetInfo" THEN
        RAISE EXCEPTION 'Imutabilidade de Laudo: É proibido alterar as informações do equipamento (assetInfo) de um laudo finalizado.';
    END IF;
    IF OLD."generalObservation" IS DISTINCT FROM NEW."generalObservation" THEN
        RAISE EXCEPTION 'Imutabilidade de Laudo: É proibido alterar a observação geral de um laudo finalizado.';
    END IF;
    IF OLD.responsaveis IS DISTINCT FROM NEW.responsaveis THEN
        RAISE EXCEPTION 'Imutabilidade de Laudo: É proibido alterar os responsáveis de um laudo finalizado.';
    END IF;
    IF OLD."generalImages" IS DISTINCT FROM NEW."generalImages" THEN
        RAISE EXCEPTION 'Imutabilidade de Laudo: É proibido alterar as fotos gerais de um laudo finalizado.';
    END IF;
    IF OLD."customItems" IS DISTINCT FROM NEW."customItems" THEN
        RAISE EXCEPTION 'Imutabilidade de Laudo: É proibido alterar itens customizados de um laudo finalizado.';
    END IF;
    IF OLD."customSections" IS DISTINCT FROM NEW."customSections" THEN
        RAISE EXCEPTION 'Imutabilidade de Laudo: É proibido alterar seções customizadas de um laudo finalizado.';
    END IF;

    IF OLD."createdAt" IS DISTINCT FROM NEW."createdAt" THEN
        NEW."createdAt" := OLD."createdAt";
    END IF;
    NEW."updatedAt" := NOW();

    IF (OLD.responses - '__meta') IS DISTINCT FROM (NEW.responses - '__meta') THEN
        RAISE EXCEPTION 'Imutabilidade de Laudo: É proibido modificar o conteúdo pericial ou checklist de responses.';
    END IF;

    v_old_meta := COALESCE(OLD.responses -> '__meta', '{}'::jsonb);
    v_new_meta := COALESCE(NEW.responses -> '__meta', '{}'::jsonb);

    IF (v_old_meta - 'auditTrail') IS DISTINCT FROM (v_new_meta - 'auditTrail') THEN
        RAISE EXCEPTION 'Imutabilidade de Laudo: É proibido modificar os metadados de schema do laudo finalizado.';
    END IF;

    IF (v_old_meta -> 'auditTrail') IS DISTINCT FROM (v_new_meta -> 'auditTrail') THEN
        IF COALESCE(current_setting('crane.is_reconciling_conflict', true), 'false') <> 'true' THEN
            RAISE EXCEPTION 'Falsificação de Auditoria Bloqueada: O auditTrail só pode ser atualizado via RPC autorizada no servidor.';
        END IF;

        IF (v_old_meta ? 'auditTrail') THEN
            v_old_len := jsonb_array_length(v_old_meta -> 'auditTrail');
            v_new_len := jsonb_array_length(v_new_meta -> 'auditTrail');

            IF v_new_len < v_old_len THEN
                RAISE EXCEPTION 'Audit Trail é append-only: Proibido reduzir ou truncar o histórico de auditoria.';
            END IF;

            FOR v_idx IN 0 .. (v_old_len - 1) LOOP
                IF (v_old_meta -> 'auditTrail' -> v_idx) IS DISTINCT FROM (v_new_meta -> 'auditTrail' -> v_idx) THEN
                    RAISE EXCEPTION 'Audit Trail é append-only: Proibido modificar registros anteriores.';
                END IF;
            END LOOP;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_report_immutability ON public.finalized_reports;
CREATE TRIGGER trg_protect_report_immutability
BEFORE UPDATE ON public.finalized_reports
FOR EACH ROW EXECUTE FUNCTION public.protect_finalized_report_immutability();

CREATE OR REPLACE FUNCTION public.protect_finalized_report_deletion()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Imutabilidade Pericial: É estritamente proibido excluir um laudo pericial finalizado (ID: %).', OLD.id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

DROP TRIGGER IF EXISTS trg_protect_report_deletion ON public.finalized_reports;
CREATE TRIGGER trg_protect_report_deletion
BEFORE DELETE ON public.finalized_reports
FOR EACH ROW EXECUTE FUNCTION public.protect_finalized_report_deletion();
