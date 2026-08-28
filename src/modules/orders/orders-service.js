/**
 * Crane Pro - Módulo de Gerenciamento de Ordens de Serviço em Aberto (Rascunhos)
 * Isolamento modular para ciclo de vida de OS, persistência ágil e exclusão direta.
 */

import { setDBValue, getDBValue, setStoredData, deleteOrderFromCloud, updateArrayInPlace } from '../../data.js';

const FAST_DRAFT_KEY_PREFIX = 'crane_fast_draft_';

/**
 * Gera o próximo ID sequencial padronizado de Ordem de Serviço (ex: ORD-001, ORD-002, ORD-003)
 */
export function generateNextOrderId(openOrdersList) {
    if (!Array.isArray(openOrdersList) || openOrdersList.length === 0) {
        return 'ORD-001';
    }
    const maxNum = openOrdersList.reduce((max, o) => {
        if (!o || !o.id) return max;
        const match = String(o.id).match(/^ORD-(\d+)$/i);
        if (match) {
            const num = parseInt(match[1], 10);
            return num > max ? num : max;
        }
        return max;
    }, 0);
    return `ORD-${(maxNum + 1).toString().padStart(3, '0')}`;
}

/**
 * Salva ou atualiza uma Ordem de Serviço em aberto (Rascunho)
 * Preserva integralmente o snapshot do schema do modelo.
 */
export async function saveDraftOrder(doc, openOrdersList) {
    if (!doc || !doc.id) {
        throw new Error('Documento inválido para salvar rascunho.');
    }

    const cleanDoc = JSON.parse(JSON.stringify(doc));
    
    // Garante que o schema_snapshot nunca seja perdido
    if (!cleanDoc.schema_snapshot && cleanDoc.schema) {
        cleanDoc.schema_snapshot = cleanDoc.schema;
    }
    if (!cleanDoc.schema && cleanDoc.schema_snapshot) {
        cleanDoc.schema = cleanDoc.schema_snapshot;
    }

    const currentList = Array.isArray(openOrdersList) ? [...openOrdersList] : [];
    const existingIdx = currentList.findIndex(o => o && String(o.id) === String(cleanDoc.id));

    if (existingIdx >= 0) {
        currentList[existingIdx] = cleanDoc;
    } else {
        currentList.push(cleanDoc);
    }

    // Persistência local segura
    setStoredData('crane_open_orders', currentList);
    if (Array.isArray(openOrdersList)) {
        updateArrayInPlace(openOrdersList, currentList);
    }
    await setDBValue('crane_open_orders', currentList);

    // Limpa rascunho temporário rápido da sessão
    clearFastLocalDraft(cleanDoc.id);

    return cleanDoc;
}

/**
 * Exclui diretamente uma Ordem de Serviço em aberto
 */
export async function deleteDraftOrder(orderId, openOrdersList) {
    if (!orderId) return openOrdersList;

    const idStr = String(orderId);
    const currentList = Array.isArray(openOrdersList) ? [...openOrdersList] : [];
    const updatedList = currentList.filter(o => o && String(o.id) !== idStr);

    // Atualiza estado local
    setStoredData('crane_open_orders', updatedList);
    if (Array.isArray(openOrdersList)) {
        updateArrayInPlace(openOrdersList, updatedList);
    }
    await setDBValue('crane_open_orders', updatedList);

    // Limpa rascunho temporário
    clearFastLocalDraft(idStr);

    // Notifica cloud assincronamente sem travar a interface
    deleteOrderFromCloud(idStr).catch(err => {
        console.warn(`Aviso: Falha ao deletar ordem ${idStr} do Supabase:`, err);
    });

    return updatedList;
}

const fastDraftMemoryStore = new Map();

/**
 * Salva snapshot síncrono ultra-rápido no sessionStorage (zero lag, < 1ms) para proteção contra F5
 */
export function saveFastLocalDraft(draftDoc) {
    if (!draftDoc || !draftDoc.id) return;
    const key = `${FAST_DRAFT_KEY_PREFIX}${draftDoc.id}`;
    if (typeof sessionStorage !== 'undefined') {
        try {
            sessionStorage.setItem(key, JSON.stringify(draftDoc));
        } catch (_) {}
    }
    fastDraftMemoryStore.set(key, JSON.parse(JSON.stringify(draftDoc)));
}

/**
 * Recupera o snapshot síncrono rápido da sessão local
 */
export function getFastLocalDraft(orderId) {
    if (!orderId) return null;
    const key = `${FAST_DRAFT_KEY_PREFIX}${orderId}`;
    if (typeof sessionStorage !== 'undefined') {
        try {
            const raw = sessionStorage.getItem(key);
            if (raw) return JSON.parse(raw);
        } catch (_) {}
    }
    return fastDraftMemoryStore.get(key) || null;
}

/**
 * Limpa o snapshot síncrono rápido da sessão local
 */
export function clearFastLocalDraft(orderId) {
    if (!orderId) return;
    const key = `${FAST_DRAFT_KEY_PREFIX}${orderId}`;
    if (typeof sessionStorage !== 'undefined') {
        try {
            sessionStorage.removeItem(key);
        } catch (_) {}
    }
    fastDraftMemoryStore.delete(key);
}
