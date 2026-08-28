// Crane Pro - Concurrency Lock System (Trava de Edição em Tempo Real)

import { isSupabaseConfigured, dbUpsert, dbDelete, supabase } from './supabase.js';

const LOCK_TIMEOUT_MS = 60000; // 60 segundos para expiração da trava sem heartbeat
const HEARTBEAT_INTERVAL_MS = 20000; // Ping a cada 20 segundos

const activeHeartbeats = new Map();
const activeLocalLocks = new Map(); // Trava em memória local

let currentUserState = null;

export function getStoredLoggedUser() {
    if (currentUserState && currentUserState.id && currentUserState.id !== 'anon') {
        return currentUserState;
    }
    if (typeof window !== 'undefined' && window.currentUser && window.currentUser.id && window.currentUser.id !== 'anon') {
        return window.currentUser;
    }
    try {
        const stored = (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('crane_logged_user') : null)
            || (typeof localStorage !== 'undefined' ? localStorage.getItem('crane_logged_user') : null);
        if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed && parsed.id && parsed.id !== 'anon') {
                return parsed;
            }
        }
    } catch (e) {}
    return null;
}

export function getCurrentUser() {
    const user = getStoredLoggedUser();
    if (user) return user;
    return { id: 'anon', name: 'USUÁRIO', email: 'usuario@local' };
}

export function setCurrentUser(user) {
    currentUserState = user;
    if (typeof window !== 'undefined') {
        window.currentUser = user;
    }
    try {
        if (user) {
            const serialized = JSON.stringify(user);
            if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('crane_logged_user', serialized);
            if (typeof localStorage !== 'undefined') localStorage.setItem('crane_logged_user', serialized);
        } else {
            if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('crane_logged_user');
            if (typeof localStorage !== 'undefined') localStorage.removeItem('crane_logged_user');
        }
    } catch (e) {}
}

/**
 * Tenta adquirir uma trava exclusiva para um recurso editável.
 * Retorna { success: true } se adquiriu a trava.
 * Retorna { success: false, lockedBy: 'Nome' } se já estiver travado por outro usuário.
 */
export async function acquireLock(resourceKey) {
    if (!resourceKey) return { success: true };
    const user = getCurrentUser();
    const userEmail = (user.email || user.name || 'user').trim().toLowerCase();
    const userName = user.name || user.email || 'Outro Usuário';

    if (isSupabaseConfigured && supabase) {
        try {
            // Busca travas existentes para este recurso
            const { data, error } = await supabase
                .from('active_locks')
                .select('*')
                .eq('resource_key', resourceKey);

            if (error) {
                // Se a tabela não existir no Supabase, usa o fallback de trava em memória
                return acquireLocalLock(resourceKey, userEmail, userName);
            }

            if (Array.isArray(data) && data.length > 0) {
                const existing = data[0];
                const lockEmail = (existing.locked_by_email || '').trim().toLowerCase();
                const lastHeartbeat = new Date(existing.last_heartbeat || existing.locked_at).getTime();
                const age = Date.now() - lastHeartbeat;

                // Se a trava pertence a outro usuário e ainda não expirou (menos de 60s)
                if (lockEmail !== userEmail && age < LOCK_TIMEOUT_MS) {
                    return {
                        success: false,
                        lockedBy: existing.locked_by_name || existing.locked_by_email || 'Outro Usuário',
                        lockedAt: existing.locked_at
                    };
                }
            }

            // Adquire ou renova a trava no Supabase
            const nowIso = new Date().toISOString();
            const payload = {
                resource_key: resourceKey,
                locked_by_id: String(user.id || userEmail),
                locked_by_name: userName,
                locked_by_email: userEmail,
                locked_at: nowIso,
                last_heartbeat: nowIso
            };

            await dbUpsert('active_locks', [payload]);
            startHeartbeat(resourceKey, payload);
            return { success: true };

        } catch (e) {
            return acquireLocalLock(resourceKey, userEmail, userName);
        }
    } else {
        return acquireLocalLock(resourceKey, userEmail, userName);
    }
}

function acquireLocalLock(resourceKey, userEmail, userName) {
    const local = activeLocalLocks.get(resourceKey);
    if (local && local.userEmail !== userEmail && (Date.now() - local.lastHeartbeat) < LOCK_TIMEOUT_MS) {
        return { success: false, lockedBy: local.userName };
    }
    activeLocalLocks.set(resourceKey, { userEmail, userName, lastHeartbeat: Date.now() });
    startHeartbeat(resourceKey, { resource_key: resourceKey, locked_by_name: userName, locked_by_email: userEmail });
    return { success: true };
}

/**
 * Inicia o ciclo de renovação automática (heartbeat) a cada 20s
 */
function startHeartbeat(resourceKey, lockPayload) {
    stopHeartbeat(resourceKey);

    const intervalId = setInterval(async () => {
        const nowIso = new Date().toISOString();
        if (isSupabaseConfigured && supabase) {
            try {
                await dbUpsert('active_locks', [{
                    ...lockPayload,
                    last_heartbeat: nowIso
                }]);
            } catch (e) {
                console.warn(`Erro no heartbeat da trava (${resourceKey}):`, e);
            }
        } else {
            const local = activeLocalLocks.get(resourceKey);
            if (local) {
                local.lastHeartbeat = Date.now();
                activeLocalLocks.set(resourceKey, local);
            }
        }
    }, HEARTBEAT_INTERVAL_MS);

    activeHeartbeats.set(resourceKey, intervalId);
}

/**
 * Interrompe o heartbeat local de um recurso
 */
function stopHeartbeat(resourceKey) {
    if (activeHeartbeats.has(resourceKey)) {
        clearInterval(activeHeartbeats.get(resourceKey));
        activeHeartbeats.delete(resourceKey);
    }
}

/**
 * Libera explicitamente a trava de um recurso ao fechar a modal ou salvar
 */
export async function releaseLock(resourceKey) {
    if (!resourceKey) return;
    stopHeartbeat(resourceKey);
    activeLocalLocks.delete(resourceKey);

    if (isSupabaseConfigured && supabase) {
        try {
            await dbDelete('active_locks', 'resource_key', resourceKey);
        } catch (e) {
            console.warn(`Erro ao liberar trava (${resourceKey}) no Supabase:`, e);
        }
    }
}

/**
 * Libera todas as travas ativas mantidas pela sessão atual
 */
export async function releaseAllLocks() {
    const keys = Array.from(activeHeartbeats.keys());
    for (const key of keys) {
        await releaseLock(key);
    }
}

// Liberação automática ao fechar a página/navegador
if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', () => {
        releaseAllLocks();
    });
    window.addEventListener('pagehide', () => {
        releaseAllLocks();
    });
}
