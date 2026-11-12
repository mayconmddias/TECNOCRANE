/**
 * CRANE PRO - MÓDULO DE ATIVOS: SERVIÇOS DE CADASTRO DINÂMICO E CONCILIAÇÃO
 */

import { supabase, isSupabaseConfigured, getTenantCode } from '../../supabase.js';
import { SYSTEM_ASSET_TEMPLATE } from '../templates/templates-module.js';

export const ASSET_ID_REGEX = /^(?:#?EQP[- ]?)([0-9]+)$/i;

/**
 * Extrai o número sequencial de um ID de ativo de qualquer formato suportado
 * @param {string} assetId 
 * @returns {number|null}
 */
export function parseAssetSequenceNumber(assetId) {
    if (!assetId || typeof assetId !== 'string') return null;
    const match = assetId.trim().match(ASSET_ID_REGEX);
    if (!match || !match[1]) return null;
    const num = parseInt(match[1], 10);
    if (isNaN(num) || num <= 0 || num > 9000) return null;
    return num;
}

/**
 * Formata um número sequencial para o padrão oficial #EQP-XXXX
 * @param {number} num 
 * @returns {string}
 */
export function formatAssetId(num) {
    const validNum = Math.max(1, parseInt(num, 10) || 1);
    return `#EQP-${String(validNum).padStart(4, '0')}`;
}

/**
 * Aloca o próximo número de ativo disponível (Online via RPC ou Offline via IndexedDB)
 * @param {string} tenantCode 
 * @param {object} localDbInstance - Instância do IndexedDB (opcional)
 * @returns {Promise<{ id: string, isProvisional: boolean, sequenceNumber: number }>}
 */
export async function reserveNextAssetId(tenantCode = '001', localDbInstance = null) {
    const tenant = tenantCode || getTenantCode() || '001';
    let maxFound = 0;

    // 1. Tentativa Online via RPC Server-Side Atômica se configurada
    if (isSupabaseConfigured && supabase && typeof supabase.rpc === 'function') {
        try {
            const { data, error } = await supabase.rpc('reserve_next_asset_number', {
                p_tenant_code: tenant
            });
            if (!error && data) {
                const seqNum = Number(data);
                if (!isNaN(seqNum) && seqNum > 0 && seqNum <= 9000) {
                    return {
                        id: formatAssetId(seqNum),
                        isProvisional: false,
                        sequenceNumber: seqNum
                    };
                }
            }
        } catch (e) {
            console.warn('CRANE ASSETS: Erro ao executar RPC de reserva:', e);
        }
    }

    // 2. Consulta em tempo real de todos os IDs gravados na nuvem (Supabase all_assets, scheduled_inspections, open_orders, finalized_reports)
    if (isSupabaseConfigured && supabase && typeof supabase.from === 'function') {
        try {
            const { data: cloudAssets, error: fetchErr } = await supabase.from('all_assets').select('id');
            if (!fetchErr && Array.isArray(cloudAssets)) {
                for (const item of cloudAssets) {
                    if (!item || !item.id) continue;
                    const num = parseAssetSequenceNumber(String(item.id));
                    if (num && num > maxFound) maxFound = num;
                }
            }
        } catch (e) {
            console.warn('CRANE ASSETS: Falha ao consultar IDs remotos na tabela all_assets:', e);
        }

        // Evita reutilizar IDs históricos que já existam em agendamentos, ordens ou relatórios
        for (const [tableName, cols] of [
            ['scheduled_inspections', 'equipamento'],
            ['open_orders', 'equipamentoid, equipamento'],
            ['finalized_reports', 'equipamentoid, equipamento']
        ]) {
            try {
                const { data: rows, error: err } = await supabase.from(tableName).select(cols);
                if (!err && Array.isArray(rows)) {
                    for (const row of rows) {
                        const eqId = row && (row.equipamento || row.equipamentoid || row.equipamentoId);
                        const num = eqId ? parseAssetSequenceNumber(String(eqId)) : null;
                        if (num && num > maxFound) maxFound = num;
                    }
                }
            } catch (_) { /* best-effort para tabelas históricas */ }
        }
    }

    // 3. Varredura completa de todas as fontes locais em memória e armazenamento local
    try {
        const candidates = [];
        
        // Da memória global
        if (typeof window !== 'undefined' && Array.isArray(window.allAssetsList)) {
            candidates.push(...window.allAssetsList);
        }
        if (typeof globalThis !== 'undefined' && Array.isArray(globalThis.allAssetsList)) {
            candidates.push(...globalThis.allAssetsList);
        }
        if (typeof window !== 'undefined') {
            ['eventsList', 'events', 'openOrders', 'finalizedReports'].forEach(arrName => {
                if (Array.isArray(window[arrName])) {
                    window[arrName].forEach(it => {
                        const eqId = it && (it.equipamento || it.equipamentoId || it.equipamentoid);
                        if (eqId) candidates.push({ id: eqId });
                    });
                }
            });
        }

        // Do localStorage de ativos (todas as chaves históricas e com prefixo de tenant)
        if (typeof localStorage !== 'undefined') {
            [
                'crane_all_assets',
                '001_crane_all_assets',
                'crane_001_all_assets',
                `crane_${tenant}_all_assets`,
                'crane_assets',
                '001_crane_assets'
            ].forEach(k => {
                const raw = localStorage.getItem(k);
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed)) candidates.push(...parsed);
                    } catch (_) {}
                }
            });
        }

        for (const item of candidates) {
            if (!item || !item.id) continue;
            const num = parseAssetSequenceNumber(String(item.id));
            if (num && num > maxFound) maxFound = num;
        }
    } catch (_) { }

    const nextSeq = maxFound + 1;
    return {
        id: formatAssetId(nextSeq),
        isProvisional: true,
        sequenceNumber: nextSeq
    };
}

/**
 * Prepara o payload completo do ativo dinâmico com 28 colunas
 * @param {object} baseAsset - Dados básicos (21 campos)
 * @param {object|null} template - Modelo selecionado (se houver)
 * @param {object} customFields - Valores dos campos dinâmicos preenchidos
 * @param {boolean} isProvisional - Se o ID é provisório offline
 * @returns {object} Payload consolidado
 */
export function prepareAssetPayload(baseAsset = {}, template = null, customFields = {}, isProvisional = false) {
    const rawId = (baseAsset.id || '').trim();
    
    return {
        id: rawId,
        empresa: baseAsset.empresa || '',
        nome: baseAsset.nome || baseAsset.tipo || '',
        tipo: baseAsset.tipo || '',
        local: baseAsset.local || '',
        fabricante: baseAsset.fabricante || '',
        capacidade: baseAsset.capacidade || '',
        caboprincipal: baseAsset.caboprincipal || baseAsset.caboPrincipal || '',
        capacidadeauxiliar: baseAsset.capacidadeauxiliar || baseAsset.capacidadeAuxiliar || '',
        caboauxiliar: baseAsset.caboauxiliar || baseAsset.caboAuxiliar || '',
        altura: baseAsset.altura || '',
        vao: baseAsset.vao || '',
        tensaoalimentacao: baseAsset.tensaoalimentacao || baseAsset.tensaoAlimentacao || '',
        tensaocomando: baseAsset.tensaocomando || baseAsset.tensaoComando || '',
        alimentacaoequipamento: baseAsset.alimentacaoequipamento || baseAsset.alimentacaoEquipamento || '',
        motorelevprincipalalta: baseAsset.motorelevprincipalalta || baseAsset.motorElevPrincipalAlta || '',
        motorelevprincipalbaixa: baseAsset.motorelevprincipalbaixa || baseAsset.motorElevPrincipalBaixa || '',
        motorelevauxiliaralta: baseAsset.motorelevauxiliaralta || baseAsset.motorElevAuxiliarAlta || '',
        motorelevauxiliarbaixa: baseAsset.motorelevauxiliarbaixa || baseAsset.motorElevAuxiliarBaixa || '',
        motordirecaocarro: baseAsset.motordirecaocarro || baseAsset.motorDirecaoCarro || '',
        motortranslacaoponte: baseAsset.motortranslacaoponte || baseAsset.motorTranslacaoPonte || '',
        foto: baseAsset.foto || baseAsset.photo || baseAsset.imagemUrl || '',
        
        // 7 Colunas Dinâmicas
        template_id: template ? template.id : (baseAsset.template_id || null),
        template_name: template ? template.nome : (baseAsset.template_name || null),
        schema_snapshot: template ? (template.schema || template) : (baseAsset.schema_snapshot || null),
        custom_fields: customFields || baseAsset.custom_fields || {},
        is_provisional: !!isProvisional,
        provisional_id: isProvisional ? rawId : (baseAsset.provisional_id || null),
        sync_status: isProvisional ? 'pending_sync' : 'synced'
    };
}

/**
 * Invoca a RPC de resolução de conflito no servidor Supabase
 * @param {string} conflictId 
 * @param {string} resolutionNotes 
 * @returns {Promise<{ success: boolean, resolvedAssetId: string, alreadyResolved: boolean }>}
 */
export async function resolveSyncConflict(conflictId, resolutionNotes = '') {
    if (!isSupabaseConfigured || !supabase) {
        throw new Error('Supabase não configurado para resolução de conflitos.');
    }

    const { data, error } = await supabase.rpc('resolve_sync_conflict', {
        p_conflict_id: conflictId,
        p_resolution_notes: resolutionNotes || 'Homologação assistida via painel'
    });

    if (error) {
        throw new Error(`Erro ao resolver conflito: ${error.message}`);
    }

    return data;
}

/**
 * Reconcilia localmente um rascunho de ativo e suas ordens/eventos dependentes
 * @param {string} oldProvisionalId 
 * @param {string} newOfficialId 
 * @param {object} storesObj - Objeto com as coleções em memória ({ allAssetsList, openOrders, events, finalizedReports })
 */
export function reconcileLocalEntities(oldProvisionalId, newOfficialId, storesObj = {}) {
    if (!oldProvisionalId || !newOfficialId || oldProvisionalId === newOfficialId) return;

    // 1. Reconcilia allAssetsList
    if (Array.isArray(storesObj.allAssetsList)) {
        storesObj.allAssetsList = storesObj.allAssetsList.map(a => {
            if (a.id === oldProvisionalId) {
                return {
                    ...a,
                    id: newOfficialId,
                    is_provisional: false,
                    provisional_id: oldProvisionalId,
                    sync_status: 'synced'
                };
            }
            return a;
        });
    }

    // 2. Reconcilia openOrders
    if (Array.isArray(storesObj.openOrders)) {
        storesObj.openOrders = storesObj.openOrders.map(o => {
            if (o.equipamentoId === oldProvisionalId || o.equipamento === oldProvisionalId) {
                return {
                    ...o,
                    equipamentoId: newOfficialId,
                    equipamentoNome: newOfficialId,
                    equipamento: newOfficialId,
                    assetInfo: `${newOfficialId} — ${o.empresa || ''}`
                };
            }
            return o;
        });
    }

    // 3. Reconcilia events (calendário)
    if (Array.isArray(storesObj.events)) {
        storesObj.events = storesObj.events.map(e => {
            if (e.equipamento === oldProvisionalId) {
                return {
                    ...e,
                    equipamento: newOfficialId,
                    id: e.id ? e.id.replace(oldProvisionalId, newOfficialId) : `${newOfficialId}-${e.date}`
                };
            }
            return e;
        });
    }

    return storesObj;
}

/**
 * Extrai e normaliza todos os campos técnicos de um ativo para exibição no card
 * Suporta modelos dinâmicos (ex: Talha com 10 campos) e padrão de sistema (21 campos)
 * @param {object} asset 
 * @param {object} [options]
 * @returns {Array<{ id: string, fullLabel: string, displayLabel: string, value: string }>}
 */
export function getAssetTechnicalFields(asset, options = {}) {
    if (!asset) return [];
    const customFields = asset.custom_fields || asset.customFields || {};
    let template = options.template || null;

    // 1. Busca modelo registrado pelo template_id do ativo ou schema_snapshot
    const tplId = asset.template_id || asset.templateId;
    if (!template && tplId) {
        if (typeof options.getTemplateById === 'function') {
            template = options.getTemplateById(tplId);
        } else if (typeof globalThis.getAssetTemplateById === 'function') {
            template = globalThis.getAssetTemplateById(tplId);
        }
    }

    if (!template && asset.schema_snapshot && Array.isArray(asset.schema_snapshot.customFields)) {
        template = asset.schema_snapshot;
    }

    // 2. Para dados de teste onde template_id possa estar desatualizado ou apontando para a semente de exemplo,
    // identifica e vincula o modelo de ativo correspondente ao tipo do equipamento
    const availableTemplates = options.templates || (typeof globalThis.getAssetTemplates === 'function' ? globalThis.getAssetTemplates() : []);
    const assetTipoNorm = (asset.tipo || asset.nome || '').trim().toLowerCase();

    if (Array.isArray(availableTemplates) && availableTemplates.length > 0) {
        const isDefaultSeed = template && (template.isSystemDefault || String(template.id) === 'asstpl_default_ponte_viga_dupla' || String(template.id) === 'sys_asset_tpl_default');
        const isNotPonteRolante = assetTipoNorm && !assetTipoNorm.includes('ponte');

        if (!template || (isDefaultSeed && isNotPonteRolante)) {
            const matchedTpl = availableTemplates.find(t => {
                const tNome = (t.nome || '').trim().toLowerCase();
                const tTipo = (t.tipoEquipamento || '').trim().toLowerCase();
                return (tNome && tNome === assetTipoNorm) || (tTipo && tTipo === assetTipoNorm) || 
                       (assetTipoNorm && tNome && (assetTipoNorm.includes(tNome) || tNome.includes(assetTipoNorm)));
            });
            if (matchedTpl) {
                template = matchedTpl;
            }
        }
    }

    // 3. Fallback seguro caso não tenha modelo (utiliza semente de referência da Ponte Rolante)
    if (!template) {
        if (typeof options.getTemplateById === 'function') {
            template = options.getTemplateById('asstpl_default_ponte_viga_dupla');
        } else if (typeof globalThis.getAssetTemplateById === 'function') {
            template = globalThis.getAssetTemplateById('asstpl_default_ponte_viga_dupla');
        }
        if (!template) {
            template = SYSTEM_ASSET_TEMPLATE;
        }
    }

    const fieldsList = [];

    // Mapeamento de abreviações amigáveis para rótulos muito longos caberem perfeitamente no card desktop
    const formatDisplayLabel = (lbl) => {
        const upper = (lbl || '').trim().toUpperCase();
        if (upper === 'ALIMENTAÇÃO DO EQUIPAMENTO') return 'ALIMENTAÇÃO';
        if (upper === 'CAPACIDADE PRINCIPAL' || upper === 'CAPACIDADE DE PESO PRINCIPAL' || upper === 'CAPACIDADE DE PESO') return 'CAPAC. PRINCIPAL';
        if (upper === 'DIÂMETRO DO CABO DE AÇO PRINCIPAL') return 'CABO PRINCIPAL';
        if (upper === 'CAPACIDADE AUXILIAR' || upper === 'CAPACIDADE DE PESO AUXILIAR') return 'CAPAC. AUXILIAR';
        if (upper === 'DIÂMETRO DO CABO DE AÇO AUXILIAR') return 'CABO AUXILIAR';
        if (upper === 'ALTURA DE ELEVAÇÃO') return 'ALT. ELEVAÇÃO';
        if (upper === 'VÃO' || upper === 'VÃO DA PONTE') return 'VÃO';
        if (upper === 'TENSÃO DE ALIMENTAÇÃO') return 'TENSÃO ALIM.';
        if (upper === 'TENSÃO DE COMANDO') return 'TENSÃO CMD.';
        if (upper === 'MOTOR ELEVAÇÃO PRINCIPAL (VEL. ALTA)' || upper.includes('ELEV') && upper.includes('PRINC') && upper.includes('ALTA')) return 'MOT. ELEV. PRINC. (V. ALTA)';
        if (upper === 'MOTOR ELEVAÇÃO PRINCIPAL (VEL. BAIXA)' || upper.includes('ELEV') && upper.includes('PRINC') && upper.includes('BAIXA')) return 'MOT. ELEV. PRINC. (V. BAIXA)';
        if (upper === 'MOTOR ELEVAÇÃO AUXILIAR (VEL. ALTA)' || upper.includes('ELEV') && upper.includes('AUX') && upper.includes('ALTA')) return 'MOT. ELEV. AUX. (V. ALTA)';
        if (upper === 'MOTOR ELEVAÇÃO AUXILIAR (VEL. BAIXA)' || upper.includes('ELEV') && upper.includes('AUX') && upper.includes('BAIXA')) return 'MOT. ELEV. AUX. (V. BAIXA)';
        if (upper === 'MOTOR DIREÇÃO CARRO') return 'MOT. DIR. CARRO';
        if (upper === 'MOTOR TRANSLAÇÃO PONTE') return 'MOT. TRANS. PONTE';
        if (upper === 'LOCAL / SETOR') return 'LOCAL / SETOR';
        if (upper === 'NÚMERO DE SÉRIE') return 'Nº SÉRIE';
        if (upper === 'ANO DE FABRICAÇÃO') return 'ANO FABR.';
        if (upper === 'CLASSIFICAÇÃO / GRUPO DE TRABALHO') return 'GRUPO TRAB.';
        if (upper === 'VELOCIDADE DE ELEVAÇÃO') return 'VEL. ELEVAÇÃO';
        return upper;
    };

    const tplFields = template ? (template.customFields || template.custom_fields) : null;
    if (Array.isArray(tplFields) && tplFields.length > 0) {
        tplFields.forEach(f => {
            const fId = f.id;
            const fullLabel = (f.label || fId).toUpperCase();
            const displayLabel = formatDisplayLabel(fullLabel);
            let val = customFields[fId];
            if (val === undefined || val === null || val === '') val = customFields[f.label];
            if (val === undefined || val === null || val === '') val = asset[fId];

            if (val === undefined || val === null || val === '') {
                const normId = String(fId).toLowerCase();
                const normLabel = String(f.label || '').toLowerCase();
                const check = (term) => normId.includes(term) || normLabel.includes(term);

                if (check('capacidade') && !check('auxiliar')) val = asset.capacidade || asset.capacidadePrincipal;
                else if (check('capacidade') && check('auxiliar')) val = asset.capacidadeAuxiliar || asset.capacidadeauxiliar;
                else if (check('vao')) val = asset.vao || asset.vaoPonte;
                else if (check('altura')) val = asset.altura || asset.alturaElevacao;
                else if (check('fabricante')) val = asset.fabricante;
                else if (check('local') || check('setor')) val = asset.local;
                else if (check('cabo') && !check('auxiliar')) val = asset.caboPrincipal || asset.caboprincipal;
                else if (check('cabo') && check('auxiliar')) val = asset.caboAuxiliar || asset.caboauxiliar;
                else if (check('tensao') && check('alim')) val = asset.tensaoAlimentacao || asset.tensaoalimentacao;
                else if (check('tensao') && check('cmd')) val = asset.tensaoComando || asset.tensaocomando;
                else if (check('alimentacao')) val = asset.alimentacaoEquipamento || asset.alimentacaoequipamento;
                else if (check('elev') && check('prin') && check('alta')) val = asset.motorElevPrincipalAlta || asset.motorelevprincipalalta;
                else if (check('elev') && check('prin') && check('baixa')) val = asset.motorElevPrincipalBaixa || asset.motorelevprincipalbaixa;
                else if (check('elev') && check('aux') && check('alta')) val = asset.motorElevAuxiliarAlta || asset.motorelevauxiliaralta;
                else if (check('elev') && check('aux') && check('baixa')) val = asset.motorElevAuxiliarBaixa || asset.motorelevauxiliarbaixa;
                else if (check('dir_carro') || check('direcaocarro') || check('carro')) val = asset.motorDirecaoCarro || asset.motordirecaocarro;
                else if (check('trans_ponte') || check('translacaoponte') || check('translacao')) val = asset.motorTranslacaoPonte || asset.motortranslacaoponte;
                else if (check('serie')) val = asset.numeroSerie || asset.num_serie || asset.numero_serie;
                else if (check('ano')) val = asset.anoFabricacao || asset.ano_fab || asset.ano_fabricacao;
                else if (check('grupo') || check('trab')) val = asset.grupoTrabalho || asset.grupo_trab;
                else if (check('vel_elev') || check('velocidade')) val = asset.velocidadeElevacao || asset.vel_elevacao;
            }

            fieldsList.push({
                id: fId,
                fullLabel,
                displayLabel,
                value: (val !== undefined && val !== null && String(val).trim() !== '') ? String(val).trim().toUpperCase() : 'N/A'
            });
        });
    }

    if (options.excludeHeaderFields) {
        return fieldsList.filter(f => {
            const norm = (f.displayLabel || f.fullLabel || '').toUpperCase();
            return !norm.includes('FABRICANTE') && !norm.includes('LOCAL') && !norm.includes('SETOR');
        });
    }

    return fieldsList;
}
