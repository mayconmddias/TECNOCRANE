-- ============================================================
-- SCRIPT SQL — MÓDULO "MEUS MODELOS" (CRANE PRO)
-- Cole este script no SQL Editor do seu projeto no Supabase
-- ============================================================

-- 1. TABELA PRINCIPAL DE MODELOS / TEMPLATES
CREATE TABLE IF NOT EXISTS public.crane_templates (
    id TEXT PRIMARY KEY,
    nome TEXT NOT NULL,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABELA DE ITENS DO MODELO
CREATE TABLE IF NOT EXISTS public.crane_template_items (
    id TEXT PRIMARY KEY,
    template_id TEXT NOT NULL REFERENCES public.crane_templates(id) ON DELETE CASCADE,
    nome TEXT NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABELA DE VERIFICAÇÕES / CHECKLIST DO ITEM
CREATE TABLE IF NOT EXISTS public.crane_template_checklist_items (
    id TEXT PRIMARY KEY,
    template_item_id TEXT NOT NULL REFERENCES public.crane_template_items(id) ON DELETE CASCADE,
    descricao TEXT NOT NULL,
    ordem INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. ÍNDICES DE PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_crane_template_items_template_id ON public.crane_template_items(template_id);
CREATE INDEX IF NOT EXISTS idx_crane_template_checklist_items_item_id ON public.crane_template_checklist_items(template_item_id);

-- 5. HABILITAR ROW LEVEL SECURITY (RLS)
ALTER TABLE public.crane_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crane_template_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crane_template_checklist_items ENABLE ROW LEVEL SECURITY;

-- 6. POLÍTICAS DE ACESSO PERMISSIVAS (Compatíveis com a chave anon/autenticada do projeto)
DROP POLICY IF EXISTS "Permitir acesso total em crane_templates" ON public.crane_templates;
CREATE POLICY "Permitir acesso total em crane_templates" ON public.crane_templates
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso total em crane_template_items" ON public.crane_template_items;
CREATE POLICY "Permitir acesso total em crane_template_items" ON public.crane_template_items
    FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir acesso total em crane_template_checklist_items" ON public.crane_template_checklist_items;
CREATE POLICY "Permitir acesso total em crane_template_checklist_items" ON public.crane_template_checklist_items
    FOR ALL USING (true) WITH CHECK (true);
