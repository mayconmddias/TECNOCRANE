/**
 * CRANE PRO - MÓDULO DE ATIVOS: SERVIÇOS DE CADASTRO DINÂMICO E CONCILIAÇÃO
 */

import { supabase, isSupabaseConfigured, getTenantCode } from '../../supabase.js';

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

    // 1. Tentativa Online via RPC Server-Side Atômica
    if (isSupabaseConfigured && supabase) {
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
            console.warn('CRANE ASSETS: Erro de conexão com Supabase, usando alocação offline:', e);
        }
    }

    // 2. Fallback Determinístico (Varre estritamente a lista de ativos técnicos cadastrados)
    let maxFound = 0;
    try {
        const candidates = [];
        
        // Da memória global
        if (typeof window !== 'undefined' && Array.isArray(window.allAssetsList)) {
            candidates.push(...window.allAssetsList);
        }
        if (typeof globalThis !== 'undefined' && Array.isArray(globalThis.allAssetsList)) {
            candidates.push(...globalThis.allAssetsList);
        }

        // Do localStorage de ativos
        if (typeof localStorage !== 'undefined') {
            ['crane_all_assets', '001_crane_all_assets'].forEach(k => {
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
