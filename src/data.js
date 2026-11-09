// Crane Pro - Data Layer

import { isSupabaseConfigured, getActiveSupabase, dbFetchAll, dbUpsert, dbDelete, uploadBase64ToStorage, deleteStorageFile, deleteStorageFilesByPrefix, deleteStorageFolder, getTenantCode } from './supabase.js';
import { hashPassword } from './utils.js';
import { releaseLock, purgeExpiredLocks } from './locks.js';

export let isInitialLoad = true;

// --- IndexedDB Configuration & State ---
const DB_NAME = 'crane_pro_db';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

let dbPromise = null;

function getDB() {
    if (typeof indexedDB === 'undefined') {
        return Promise.reject(new Error('indexedDB não disponível'));
    }
    if (!dbPromise) {
        dbPromise = new Promise((resolve, reject) => {
            const request = indexedDB.open(DB_NAME, DB_VERSION);
            request.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains(STORE_NAME)) {
                    db.createObjectStore(STORE_NAME);
                }
            };
            request.onsuccess = (e) => resolve(e.target.result);
            request.onerror = (e) => reject(e.target.error);
        });
    }
    return dbPromise;
}

export function getDBValue(key, defaultValue) {
    if (typeof indexedDB === 'undefined') {
        return Promise.resolve(defaultValue);
    }
    const tenantKey = getTenantKey(key);
    return getDB().then(db => {
        return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(tenantKey);
            request.onsuccess = () => {
                const res = request.result;
                if (res !== undefined && res !== null) {
                    resolve(res);
                } else {
                    const reqFallback = store.get(key);
                    reqFallback.onsuccess = () => {
                        const fallbackRes = reqFallback.result;
                        if (fallbackRes !== undefined && fallbackRes !== null) {
                            resolve(fallbackRes);
                        } else {
                            resolve(defaultValue);
                        }
                    };
                    reqFallback.onerror = () => resolve(defaultValue);
                }
            };
            request.onerror = () => {
                resolve(defaultValue);
            };
        });
    }).catch(() => defaultValue);
}

export function setDBValue(key, value) {
    if (typeof indexedDB === 'undefined') {
        return Promise.resolve();
    }
    const tenantKey = getTenantKey(key);
    return getDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            try {
                store.put(value, tenantKey);
                if (tenantKey !== key) {
                    store.put(value, key);
                }
            } catch (err) {
                return reject(err);
            }
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }).catch(() => {});
}

export function deleteDBValue(key) {
    if (typeof indexedDB === 'undefined') {
        return Promise.resolve();
    }
    const tenantKey = getTenantKey(key);
    return getDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            try {
                store.delete(tenantKey);
                if (tenantKey !== key) {
                    store.delete(key);
                }
            } catch (err) {
                return reject(err);
            }
            transaction.oncomplete = () => resolve();
            transaction.onerror = () => reject(transaction.error);
        });
    }).catch(() => {});
}

// Chaves pesadas que contêm fotos/base64 e devem utilizar exclusivamente IndexedDB (evita 5MB limit)
const HEAVY_KEYS = new Set(['crane_reports', 'crane_open_orders']);

export function getTenantKey(key) {
    const code = getTenantCode() || '001';
    if (key.startsWith(`crane_${code}_`)) return key;
    if (key.startsWith('crane_')) {
        return key.replace('crane_', `crane_${code}_`);
    }
    return `${code}_${key}`;
}

// Funções de Persistência
export function getStoredData(key, defaultValue) {
    if (typeof localStorage === 'undefined') return defaultValue;
    try {
        const tenantKey = getTenantKey(key);
        const data = localStorage.getItem(tenantKey) || localStorage.getItem(key);
        return data ? JSON.parse(data) : defaultValue;
    } catch (e) {
        return defaultValue;
    }
}

export function setStoredData(key, data, syncCloud = true) {
    const tenantKey = getTenantKey(key);
    if (typeof localStorage !== 'undefined') {
        if (!HEAVY_KEYS.has(key) && !HEAVY_KEYS.has(tenantKey)) {
            try {
                localStorage.setItem(tenantKey, JSON.stringify(data));
            } catch (e) {
                console.warn(`localStorage falhou para ${tenantKey} (limite excedido), continuando com IndexedDB:`, e);
            }
        } else {
            // Limpa chave legada no localStorage para liberar memória
            try {
                localStorage.removeItem(tenantKey);
                localStorage.removeItem(key);
            } catch (e) {}
        }
    }
    
    setDBValue(tenantKey, data).catch(err => {
        console.error(`Erro ao gravar ${tenantKey} no IndexedDB:`, err);
    });

    // Sincroniza em segundo plano se o Supabase estiver configurado e syncCloud for true
    if (isSupabaseConfigured && syncCloud) {
        syncKeyToSupabase(key, data).catch(err => {
            console.error(`SUPABASE: Erro ao sincronizar ${key}:`, err);
        });
    }
}

/**
 * Envia alterações de uma chave local para a tabela correspondente no Supabase
 */
/**
 * Auxiliar para upload e substituição de imagens base64 em relatórios / ordens
 */
async function processReportImages(reportObj) {
    if (!reportObj || typeof reportObj !== 'object') return reportObj;
    const reportId = String(reportObj.id || 'gen_' + Date.now());
    const folderPath = `reports/${reportId}`;

    if (Array.isArray(reportObj.generalImages) && reportObj.generalImages.length > 0) {
        reportObj.generalImages = await Promise.all(
            reportObj.generalImages.map(async (img, idx) => {
                if (typeof img === 'string' && img.startsWith('data:')) {
                    const fileName = `general_${idx}_${Date.now()}`;
                    return await uploadBase64ToStorage('crane-app-media', folderPath, img, fileName);
                }
                return img;
            })
        );
    }

    if (reportObj.responses && typeof reportObj.responses === 'object') {
        const responses = reportObj.responses;
        for (const itemId of Object.keys(responses)) {
            const resp = responses[itemId];
            if (!resp || typeof resp !== 'object') continue;

            if (Array.isArray(resp.images) && resp.images.length > 0) {
                resp.images = await Promise.all(
                    resp.images.map(async (img, idx) => {
                        if (typeof img === 'string' && img.startsWith('data:')) {
                            const fileName = `item_${itemId}_${idx}_${Date.now()}`;
                            return await uploadBase64ToStorage('crane-app-media', folderPath, img, fileName);
                        }
                        return img;
                    })
                );
            }

            if (Array.isArray(resp.additionalObservations) && resp.additionalObservations.length > 0) {
                for (let obsIdx = 0; obsIdx < resp.additionalObservations.length; obsIdx++) {
                    const addObs = resp.additionalObservations[obsIdx];
                    if (addObs && Array.isArray(addObs.images) && addObs.images.length > 0) {
                        addObs.images = await Promise.all(
                            addObs.images.map(async (img, idx) => {
                                if (typeof img === 'string' && img.startsWith('data:')) {
                                    const fileName = `addobs_${itemId}_${obsIdx}_${idx}_${Date.now()}`;
                                    return await uploadBase64ToStorage('crane-app-media', folderPath, img, fileName);
                                }
                                return img;
                            })
                        );
                    }
                }
            }
        }
    }

    return reportObj;
}

/**
 * Envia alterações de uma chave local para a tabela correspondente no Supabase de forma atômica e não-destrutiva
 */
export async function syncKeyToSupabase(key, data) {
    if (!isSupabaseConfigured) return;
    try {
        if (key === 'crane_companies') {
            const dbCompanies = await dbFetchAll('companies');
            const rows = await Promise.all(data.map(async c => {
                let logoUrl = c.logo || '';
                const compId = c.id || (c.cnpj ? String(c.cnpj).replace(/\W+/g, '') : String(c.name).replace(/\W+/g, '_'));
                const oldComp = Array.isArray(dbCompanies) ? dbCompanies.find(oc => (oc.id && c.id && String(oc.id) === String(c.id)) || (oc.name && c.name && oc.name.trim().toLowerCase() === c.name.trim().toLowerCase())) : null;

                if (typeof logoUrl === 'string' && logoUrl.startsWith('data:')) {
                    if (oldComp && oldComp.logo && typeof oldComp.logo === 'string' && oldComp.logo.startsWith('http')) {
                        await deleteStorageFile('crane-app-media', oldComp.logo);
                    }
                    const uniqueFileName = `logo_${compId}_${Date.now()}`;
                    logoUrl = await uploadBase64ToStorage('crane-app-media', 'companies', logoUrl, uniqueFileName);
                    c.logo = logoUrl;
                } else if (!logoUrl && oldComp && oldComp.logo && typeof oldComp.logo === 'string' && oldComp.logo.startsWith('http')) {
                    await deleteStorageFile('crane-app-media', oldComp.logo);
                }
                return {
                    name: c.name,
                    cnpj: c.cnpj || '',
                    endereco: c.endereco || '',
                    numero: c.numero || '',
                    bairro: c.bairro || '',
                    cep: c.cep || '',
                    referencia: c.referencia || '',
                    cidade: c.cidade || '',
                    estado: c.estado || '',
                    logo: logoUrl
                };
            }));
            await dbUpsert('companies', rows);
            const tenantKey = getTenantKey('crane_companies');
            try { localStorage.setItem(tenantKey, JSON.stringify(data)); } catch (e) {}
            await setDBValue(tenantKey, data);
        } else if (key === 'crane_all_assets') {
            await fixConflictingAssetIds();
            // Deduplica dados de ativos por ID para evitar violação de unicidade (erro 21000) no PostgreSQL
            const uniqueAssetsMap = new Map();
            (Array.isArray(allAssetsList && allAssetsList.length > 0 ? allAssetsList : data) ? (allAssetsList && allAssetsList.length > 0 ? allAssetsList : data) : []).forEach(a => {
                if (a && a.id != null) {
                    uniqueAssetsMap.set(String(a.id).trim(), a);
                }
            });
            const uniqueData = Array.from(uniqueAssetsMap.values());

            const dbAssets = await dbFetchAll('all_assets');

            await Promise.all(uniqueData.map(async a => {
                let fotoUrl = a.foto || a.photo || a.imagemUrl || '';
                const assetId = a.id || String(Date.now());
                const cleanId = String(assetId).replace(/\W+/g, '_');
                const oldAsset = Array.isArray(dbAssets) ? dbAssets.find(oa => oa && String(oa.id).trim() === String(a.id).trim()) : null;

                if (typeof fotoUrl === 'string' && fotoUrl.startsWith('data:')) {
                    // Remove foto remota anterior para não duplicar arquivos no storage
                    if (oldAsset && oldAsset.foto && typeof oldAsset.foto === 'string' && oldAsset.foto.startsWith('http')) {
                        await deleteStorageFile('crane-app-media', oldAsset.foto);
                    }
                    // Limpa quaisquer duplicatas legadas anteriores com timestamp para este ativo
                    await deleteStorageFilesByPrefix('crane-app-media', 'assets', `asset_${cleanId}_`);

                    const uniqueFileName = `asset_${cleanId}_${Date.now()}`;
                    fotoUrl = await uploadBase64ToStorage('crane-app-media', 'assets', fotoUrl, uniqueFileName);
                    a.foto = fotoUrl;
                } else if (!fotoUrl && oldAsset && oldAsset.foto && typeof oldAsset.foto === 'string' && oldAsset.foto.startsWith('http')) {
                    // Foto foi removida pelo usuário no modal
                    await deleteStorageFile('crane-app-media', oldAsset.foto);
                    await deleteStorageFilesByPrefix('crane-app-media', 'assets', `asset_${cleanId}_`);
                }
            }));

            const photoVal = (a) => a.foto || a.photo || a.imagemUrl || '';

            const baseRowsWithFoto = uniqueData.map(a => ({
                id: a.id,
                empresa: a.empresa || '',
                nome: a.nome || '',
                tipo: a.tipo || '',
                local: a.local || '',
                fabricante: a.fabricante || '',
                capacidade: a.capacidade || '',
                caboprincipal: a.caboPrincipal || a.caboprincipal || '',
                capacidadeauxiliar: a.capacidadeAuxiliar || a.capacidadeauxiliar || '',
                caboauxiliar: a.caboAuxiliar || a.caboauxiliar || '',
                altura: a.altura || '',
                vao: a.vao || '',
                tensaoalimentacao: a.tensaoAlimentacao || a.tensaoalimentacao || '',
                tensaocomando: a.tensaoComando || a.tensaocomando || '',
                alimentacaoequipamento: a.alimentacaoEquipamento || a.alimentacaoequipamento || '',
                motorelevprincipalalta: a.motorElevPrincipalAlta || a.motorelevprincipalalta || '',
                motorelevprincipalbaixa: a.motorElevPrincipalBaixa || a.motorelevprincipalbaixa || '',
                motorelevauxiliaralta: a.motorElevAuxiliarAlta || a.motorelevauxiliaralta || '',
                motorelevauxiliarbaixa: a.motorElevAuxiliarBaixa || a.motorelevauxiliarbaixa || '',
                motordirecaocarro: a.motorDirecaoCarro || a.motordirecaocarro || '',
                motortranslacaoponte: a.motorTranslacaoPonte || a.motortranslacaoponte || '',
                foto: photoVal(a)
            }));

            const baseRowsWithoutFoto = baseRowsWithFoto.map(({ foto, ...rest }) => rest);

            const fullRowsWithFoto = uniqueData.map((a, i) => ({
                ...baseRowsWithFoto[i],
                template_id: a.template_id || null,
                template_name: a.template_name || null,
                schema_snapshot: a.schema_snapshot || null,
                custom_fields: { ...(a.custom_fields || {}), foto: photoVal(a) },
                is_provisional: !!a.is_provisional,
                provisional_id: a.provisional_id || null,
                sync_status: a.sync_status || 'synced'
            }));

            const fullRowsWithoutFoto = fullRowsWithFoto.map(({ foto, ...rest }) => rest);

            try {
                // Tenta enviar com foto e colunas dinâmicas
                await dbUpsert('all_assets', fullRowsWithFoto);
            } catch (err1) {
                console.warn('CRANE ASSETS: Tentando enviar sem coluna física foto:', err1);
                try {
                    // Fallback para fullRows com foto dentro de custom_fields
                    await dbUpsert('all_assets', fullRowsWithoutFoto);
                } catch (err2) {
                    console.warn('CRANE ASSETS: Fallback para colunas base com foto:', err2);
                    try {
                        await dbUpsert('all_assets', baseRowsWithFoto);
                    } catch (err3) {
                        await dbUpsert('all_assets', baseRowsWithoutFoto);
                    }
                }
            }
            const tenantKey = getTenantKey('crane_all_assets');
            try { localStorage.setItem(tenantKey, JSON.stringify(uniqueData)); } catch (e) {}
            await setDBValue(tenantKey, uniqueData);
        } else if (key === 'crane_users') {
            const dbUsers = await dbFetchAll('users');
            const hasAvatarColumn = Array.isArray(dbUsers) && dbUsers.length > 0 && ('avatar' in dbUsers[0]);
            const rows = await Promise.all(data.map(async u => {
                let sigUrl = u.signature || u.assinatura || '';
                let avatarUrl = u.avatar || u.foto || '';
                const userId = u.id || (u.email ? String(u.email).replace(/\W+/g, '_') : String(u.name).replace(/\W+/g, '_'));
                const oldUser = Array.isArray(dbUsers) ? dbUsers.find(ou => (ou.id && u.id && String(ou.id) === String(u.id)) || (ou.email && u.email && ou.email.trim().toLowerCase() === u.email.trim().toLowerCase())) : null;

                if (typeof sigUrl === 'string' && sigUrl.startsWith('data:')) {
                    if (oldUser && oldUser.signature && typeof oldUser.signature === 'string' && oldUser.signature.startsWith('http')) {
                        await deleteStorageFile('crane-app-media', oldUser.signature);
                    }
                    const uniqueFileName = `signature_${userId}_${Date.now()}`;
                    sigUrl = await uploadBase64ToStorage('crane-app-media', 'signatures', sigUrl, uniqueFileName);
                    u.signature = sigUrl;
                } else if (!sigUrl && oldUser && oldUser.signature && typeof oldUser.signature === 'string' && oldUser.signature.startsWith('http')) {
                    await deleteStorageFile('crane-app-media', oldUser.signature);
                }

                if (typeof avatarUrl === 'string' && avatarUrl.startsWith('data:')) {
                    if (oldUser && (oldUser.avatar || oldUser.foto) && typeof (oldUser.avatar || oldUser.foto) === 'string' && (oldUser.avatar || oldUser.foto).startsWith('http')) {
                        await deleteStorageFile('crane-app-media', oldUser.avatar || oldUser.foto);
                    }
                    const uniqueFileName = `avatar_${userId}_${Date.now()}`;
                    avatarUrl = await uploadBase64ToStorage('crane-app-media', 'avatars', avatarUrl, uniqueFileName);
                    u.avatar = avatarUrl;
                } else if (!avatarUrl && oldUser && (oldUser.avatar || oldUser.foto) && typeof (oldUser.avatar || oldUser.foto) === 'string' && (oldUser.avatar || oldUser.foto).startsWith('http')) {
                    await deleteStorageFile('crane-app-media', oldUser.avatar || oldUser.foto);
                }

                const resolvedId = (oldUser && oldUser.id != null)
                    ? oldUser.id
                    : (typeof u.id === 'number' ? u.id : (parseInt(u.id, 10) || undefined));

                return {
                    ...(resolvedId != null ? { id: resolvedId } : {}),
                    name: u.name,
                    email: u.email,
                    password: await hashPassword(u.password),
                    permission: u.permission,
                    cargo: u.cargo || u.role || '',
                    signature: sigUrl,
                    ...(hasAvatarColumn ? { avatar: avatarUrl } : {}),
                    tenant_code: u.tenant_code || getTenantCode() || '001'
                };
            }));
            try {
                await dbUpsert('users', rows);
            } catch (err) {
                console.warn('CRANE USERS: Erro ao sincronizar usuários com o Supabase:', err);
            }
            const tenantKey = getTenantKey('crane_users');
            try { localStorage.setItem(tenantKey, JSON.stringify(data)); } catch (e) {}
            await setDBValue(tenantKey, data);
        } else if (key === 'crane_events') {
            const baseRows = data.map(e => ({
                id: String(e.id),
                groupId: e.groupId ? String(e.groupId) : null,
                empresa: e.empresa || '',
                equipamento: e.equipamento || '',
                date: e.date || '',
                status: e.status || 'PENDENTE',
                justificativa: e.justificativa || '',
                color: e.color || '',
                textColor: e.textColor || '',
                tipo: e.tipo || '',
                local: e.local || ''
            }));
            const fullRows = data.map((e, idx) => ({
                ...baseRows[idx],
                tecnico: e.tecnico || (Array.isArray(e.tecnicos) ? e.tecnicos.join(' | ') : '')
            }));
            try {
                await dbUpsert('scheduled_inspections', fullRows);
            } catch (err) {
                console.warn('CRANE EVENTS: Falha ao persistir coluna tecnico (fallback para colunas base):', err);
                await dbUpsert('scheduled_inspections', baseRows);
            }
            const tenantKey = getTenantKey('crane_events');
            try { localStorage.setItem(tenantKey, JSON.stringify(data)); } catch (e) {}
            await setDBValue(tenantKey, data);
        } else if (key === 'crane_open_orders') {
            const processedData = await Promise.all(data.map(o => processReportImages(o)));
            const rows = processedData.map(o => ({
                id: String(o.id),
                status: o.status || 'EM ABERTO',
                type: o.type || 'PREVENTIVA',
                empresa: o.empresa || '',
                equipamentoId: o.equipamentoId || o.equipamento || '',
                equipamentoNome: o.equipamentoNome || o.equipamento || '',
                assetInfo: o.assetInfo || `${o.equipamentoNome || o.equipamento || ''} — ${o.empresa || ''}`,
                date: o.date || '',
                responsaveis: o.responsaveis || [],
                responses: {
                    ...(o.responses || {}),
                    __meta: {
                        schema: o.schema_snapshot || o.schema || null,
                        schema_snapshot: o.schema_snapshot || o.schema || null,
                        templateId: o.templateId || null,
                        templateName: o.templateName || null
                    }
                },
                generalObservation: o.generalObservation || '',
                generalImages: o.generalImages || [],
                customSections: o.customSections || [],
                customItems: o.customItems || [],
                tecnico: o.tecnico || '',
                revisions: o.revisions || {}
            }));
            await dbUpsert('open_orders', rows);
        } else if (key === 'crane_reports') {
            const processedData = await Promise.all(data.map(r => processReportImages(r)));
            const rows = processedData.map(r => ({
                id: String(r.id),
                status: r.status || 'FINALIZED',
                type: r.type || 'PREVENTIVA',
                empresa: r.empresa || '',
                equipamentoId: r.equipamentoId || r.equipamento || '',
                equipamentoNome: r.equipamentoNome || r.equipamento || '',
                assetInfo: r.assetInfo || `${r.equipamentoNome || r.equipamento || ''} — ${r.empresa || ''}`,
                date: r.date || '',
                responsaveis: r.responsaveis || [],
                responses: {
                    ...(r.responses || {}),
                    __meta: {
                        schema: r.schema_snapshot || r.schema || null,
                        schema_snapshot: r.schema_snapshot || r.schema || null,
                        templateId: r.templateId || null,
                        templateName: r.templateName || null
                    }
                },
                generalObservation: r.generalObservation || '',
                generalImages: r.generalImages || [],
                customSections: r.customSections || [],
                customItems: r.customItems || [],
                tecnico: r.tecnico || '',
                revisions: r.revisions || {}
            }));
            await dbUpsert('finalized_reports', rows);
        } else if (key === 'crane_internal_company') {
            const tenant = data.tenant_code || getTenantCode() || '001';
            let logoUrl = data.logo || '';
            const dbCurrent = await dbFetchAll('internal_company');
            const currentRecord = Array.isArray(dbCurrent) ? (dbCurrent.find(c => c && String(c.tenant_code) === String(tenant)) || dbCurrent[0]) : null;

            if (typeof logoUrl === 'string' && logoUrl.startsWith('data:')) {
                if (currentRecord && currentRecord.logo && typeof currentRecord.logo === 'string' && currentRecord.logo.startsWith('http')) {
                    await deleteStorageFile('crane-app-media', currentRecord.logo);
                }
                await deleteStorageFilesByPrefix('crane-app-media', 'companies', `internal_logo_${tenant}_`);
                await deleteStorageFilesByPrefix('crane-app-media', 'companies', `internal_logo.`);
                
                const uniqueFileName = `internal_logo_${tenant}_${Date.now()}`;
                const uploadedUrl = await uploadBase64ToStorage('crane-app-media', 'companies', logoUrl, uniqueFileName);
                if (uploadedUrl && uploadedUrl.startsWith('http')) {
                    logoUrl = uploadedUrl;
                    data.logo = logoUrl;
                    const tenantKey = getTenantKey('crane_internal_company');
                    try { localStorage.setItem(tenantKey, JSON.stringify(data)); } catch (e) {}
                    await setDBValue(tenantKey, data);
                }
            } else if (!logoUrl && currentRecord && currentRecord.logo && typeof currentRecord.logo === 'string' && currentRecord.logo.startsWith('http')) {
                await deleteStorageFile('crane-app-media', currentRecord.logo);
                await deleteStorageFilesByPrefix('crane-app-media', 'companies', `internal_logo_${tenant}_`);
                await deleteStorageFilesByPrefix('crane-app-media', 'companies', `internal_logo.`);
            }

            const row = {
                id: 1,
                name: data.name || '',
                cnpj: data.cnpj || '',
                endereco: data.endereco || '',
                numero: data.numero || '',
                bairro: data.bairro || '',
                cep: data.cep || '',
                cidade: data.cidade || '',
                estado: data.estado || '',
                logo: logoUrl,
                tenant_code: tenant
            };
            await dbUpsert('internal_company', [row]);
        }
    } catch (e) {
        console.error(`Erro ao sincronizar key ${key} no Supabase:`, e);
    }
}

/**
 * Funções auxiliares atômicas de exclusão explícita no Supabase
 */
export async function deleteCompanyFromCloud(companyName) {
    if (!isSupabaseConfigured || !companyName) return;
    try {
        const target = companyName.trim().toLowerCase();
        const dbCompanies = await dbFetchAll('companies');
        if (dbCompanies && Array.isArray(dbCompanies)) {
            const matchingComps = dbCompanies.filter(c => (c.name || '').trim().toLowerCase() === target);
            for (const comp of matchingComps) {
                if (comp && comp.logo) {
                    await deleteStorageFile('crane-app-media', comp.logo);
                }
                if (comp.id) {
                    await dbDelete('companies', 'id', comp.id);
                } else if (comp.name) {
                    await dbDelete('companies', 'name', comp.name);
                }
            }
        }
        // Remove travas de edição vinculadas a esta empresa em active_locks
        try {
            await releaseLock(`company:${companyName}`);
            await dbDelete('active_locks', 'resource_key', `company:${companyName}`);
            if (companyName.trim() !== target) {
                await releaseLock(`company:${target}`);
                await dbDelete('active_locks', 'resource_key', `company:${target}`);
            }
        } catch (_) {}
    } catch (e) {
        console.warn(`Aviso ao excluir empresa ${companyName} do Supabase:`, e);
    }
    return dbDelete('companies', 'name', companyName);
}

export async function deleteInternalCompanyFromCloud() {
    if (!isSupabaseConfigured) return;
    try {
        const tenant = getTenantCode() || '001';
        const dbCurrent = await dbFetchAll('internal_company');
        if (Array.isArray(dbCurrent)) {
            for (const c of dbCurrent) {
                if (c && c.logo && typeof c.logo === 'string' && c.logo.startsWith('http')) {
                    await deleteStorageFile('crane-app-media', c.logo);
                }
            }
        }
        await deleteStorageFilesByPrefix('crane-app-media', 'companies', `internal_logo_${tenant}_`);
        await deleteStorageFilesByPrefix('crane-app-media', 'companies', `internal_logo.`);
        await dbDelete('internal_company', 'tenant_code', tenant);
        await dbDelete('internal_company', 'id', 1);
    } catch (e) {
        console.warn('Aviso ao excluir empresa interna da nuvem:', e);
    }
}

export async function deleteCompanyAllDataFromCloud(companyName) {
    if (!isSupabaseConfigured || !companyName) return;
    try {
        const target = companyName.trim().toLowerCase();

        // 1. Delete company entry and its logo in storage
        await deleteCompanyFromCloud(companyName);

        // 2. Delete all assets for company
        await deleteCompanyAssetsFromCloud(companyName);

        // 3. Delete all scheduled_inspections for company
        const dbEvents = await dbFetchAll('scheduled_inspections');
        if (dbEvents && dbEvents.length > 0) {
            const eventsToDelete = dbEvents.filter(e => (e.empresa || '').trim().toLowerCase() === target);
            for (const ev of eventsToDelete) {
                await deleteEventFromCloud(ev.id);
            }
        }

        // 4. Delete all open_orders for company
        const dbOrders = await dbFetchAll('open_orders');
        if (dbOrders && dbOrders.length > 0) {
            const ordersToDelete = dbOrders.filter(o => (o.empresa || '').trim().toLowerCase() === target);
            for (const ord of ordersToDelete) {
                await deleteOrderFromCloud(ord.id);
            }
        }

        // 5. Delete all finalized_reports for company
        const dbReports = await dbFetchAll('finalized_reports');
        if (dbReports && dbReports.length > 0) {
            const reportsToDelete = dbReports.filter(r => (r.empresa || '').trim().toLowerCase() === target);
            for (const rep of reportsToDelete) {
                await deleteReportFromCloud(rep.id);
            }
        }
    } catch (e) {
        console.error(`Erro ao excluir todos os dados da empresa ${companyName} no Supabase:`, e);
    }
}

export async function deleteCompanyAssetsFromCloud(companyName) {
    if (!isSupabaseConfigured || !companyName) return;
    try {
        const target = companyName.trim().toLowerCase();
        const dbAssets = await dbFetchAll('all_assets');
        if (dbAssets && dbAssets.length > 0) {
            const toDelete = dbAssets.filter(a => (a.empresa || '').trim().toLowerCase() === target);
            for (const asset of toDelete) {
                await deleteAssetFromCloud(asset.id);
            }
        }
    } catch (e) {
        console.error(`Erro ao excluir ativos da empresa ${companyName} no Supabase:`, e);
    }
}

export async function deleteAssetFromCloud(assetId) {
    if (!isSupabaseConfigured || !assetId) return;
    try {
        const cleanId = String(assetId).replace(/\W+/g, '_');
        const targetAsset = (allAssetsList || []).find(a => a && String(a.id).trim() === String(assetId).trim());
        const photoUrl = targetAsset ? (targetAsset.foto || targetAsset.photo || targetAsset.imagemUrl) : null;
        if (photoUrl && typeof photoUrl === 'string' && photoUrl.startsWith('http')) {
            await deleteStorageFile('crane-app-media', photoUrl);
        }
        await deleteStorageFilesByPrefix('crane-app-media', 'assets', `asset_${cleanId}`);
    } catch (e) {
        console.warn(`Erro ao excluir arquivos de mídia do ativo ${assetId} no Storage:`, e);
    }

    // Exclusão em cascata: remove também todos os agendamentos vinculados a este ativo no Supabase
    try {
        const cloudEvents = await dbFetchAll('scheduled_inspections');
        if (Array.isArray(cloudEvents)) {
            const eventsToDelete = cloudEvents.filter(ev => 
                ev && (ev.equipamento === assetId || ev.id === assetId || String(ev.id).startsWith(`${assetId}-`))
            );
            for (const ev of eventsToDelete) {
                await dbDelete('scheduled_inspections', 'id', ev.id);
            }
        }
    } catch (e) {
        console.warn(`Erro ao excluir agendamentos vinculados ao ativo ${assetId} no Supabase:`, e);
    }

    // Atualiza a lista local de eventos se disponível
    if (Array.isArray(eventsList)) {
        const filteredEvents = eventsList.filter(ev => 
            !ev || (ev.equipamento !== assetId && ev.id !== assetId && !String(ev.id).startsWith(`${assetId}-`))
        );
        updateArrayInPlace(eventsList, filteredEvents);
        setStoredData('crane_events', eventsList, false);
    }

    // Remove travas de edição vinculadas a este ativo
    try {
        await releaseLock(`asset:${assetId}`);
        await dbDelete('active_locks', 'resource_key', `asset:${assetId}`);
    } catch (_) {}

    return dbDelete('all_assets', 'id', assetId);
}

export async function deleteUserFromCloud(userId) {
    if (!isSupabaseConfigured || !userId) return;
    try {
        const targetUser = (usersList || []).find(u => u && String(u.id).trim() === String(userId).trim());
        if (targetUser) {
            const avatarUrl = targetUser.avatar || targetUser.foto;
            if (avatarUrl && typeof avatarUrl === 'string' && avatarUrl.startsWith('http')) {
                await deleteStorageFile('crane-app-media', avatarUrl);
            }
            const sigUrl = targetUser.signature || targetUser.assinatura;
            if (sigUrl && typeof sigUrl === 'string' && sigUrl.startsWith('http')) {
                await deleteStorageFile('crane-app-media', sigUrl);
            }
        }
        const cleanUserId = String(userId).replace(/\W+/g, '_');
        await deleteStorageFilesByPrefix('crane-app-media', 'avatars', `avatar_${cleanUserId}`);
        await deleteStorageFilesByPrefix('crane-app-media', 'signatures', `signature_${cleanUserId}`);
    } catch (e) {
        console.warn(`Erro ao excluir mídias do usuário ${userId} no Storage:`, e);
    }
    return dbDelete('users', 'id', userId);
}

export async function deleteEventFromCloud(eventId) {
    if (!isSupabaseConfigured || !eventId) return;
    const cleanId = String(eventId).trim();
    const deletePromises = [dbDelete('scheduled_inspections', 'id', cleanId)];
    // Se for formato equip-data (ex: #EQP-0001-2026-10-15), também garante remoção de eventual registro legado gravado apenas com o ID do equipamento
    if (cleanId.includes('-20')) {
        const legacyEquipId = cleanId.substring(0, cleanId.lastIndexOf('-20'));
        if (legacyEquipId) {
            deletePromises.push(dbDelete('scheduled_inspections', 'id', legacyEquipId).catch(() => {}));
        }
    }
    return Promise.all(deletePromises);
}

export async function deleteOrderFromCloud(orderId) {
    if (!isSupabaseConfigured || !orderId) return;
    try {
        const cleanId = String(orderId).trim();
        // Remove cirurgicamente apenas a subpasta específica da ordem no Storage
        await deleteStorageFolder('crane-app-media', `reports/${cleanId}`);
        // Libera qualquer trava existente para esta ordem
        await releaseLock(`order:${cleanId}`);
        await dbDelete('active_locks', 'resource_key', `order:${cleanId}`);
    } catch (e) {
        console.warn(`Erro ao excluir mídias e travas da ordem ${orderId} no Supabase:`, e);
    }
    return dbDelete('open_orders', 'id', orderId);
}

export async function deleteReportFromCloud(reportId) {
    if (!isSupabaseConfigured || !reportId) return;
    try {
        const cleanId = String(reportId).trim();
        // Remove cirurgicamente apenas a subpasta específica do relatório no Storage
        await deleteStorageFolder('crane-app-media', `reports/${cleanId}`);
        // Libera qualquer trava existente para este relatório
        await releaseLock(`report:${cleanId}`);
        await dbDelete('active_locks', 'resource_key', `report:${cleanId}`);
    } catch (e) {
        console.warn(`Erro ao excluir mídias e travas do laudo ${reportId} no Supabase:`, e);
    }
    return dbDelete('finalized_reports', 'id', reportId);
}

/**
 * Puxa todos os dados do Supabase e atualiza o banco local
 */
export async function syncAllFromSupabase() {
    if (!isSupabaseConfigured) return;
    try {
        console.log('SUPABASE: Carregando dados da nuvem...');

        // Limpeza preventiva permanente de travas expiradas/órfãs em background
        purgeExpiredLocks().catch(() => {});

        // 1. Companies
        let dbCompanies = await dbFetchAll('companies');
        if (Array.isArray(dbCompanies)) {
            const normalized = normalizeCompanies(dbCompanies).sort((a, b) => a.name.localeCompare(b.name));
            // Preserva empresas locais criadas offline que ainda não constem no Supabase
            (companies || []).forEach(localComp => {
                const localName = (typeof localComp === 'string' ? localComp : localComp.name || '').trim().toLowerCase();
                if (localName && !normalized.some(nc => (nc.name || '').trim().toLowerCase() === localName)) {
                    normalized.push(localComp);
                }
            });
            normalized.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
            updateArrayInPlace(companies, normalized);
            setStoredData('crane_companies', companies, false);
        }

        const validCompanyNames = new Set((companies || []).map(c => (typeof c === 'string' ? c : c.name).toLowerCase().trim()));
        const internalComp = getStoredData('crane_internal_company', null);
        if (internalComp && internalComp.name) {
            validCompanyNames.add(String(internalComp.name).trim().toLowerCase());
        }

        // 2. All Assets
        let dbAllAssets = await dbFetchAll('all_assets');
        if (Array.isArray(dbAllAssets)) {
            const handledIds = new Set();
            const mergedMap = new Map();
            const invalidAssetsToDelete = [];

            dbAllAssets.forEach(a => {
                if (!a || a.id == null) return;
                const idStr = String(a.id).trim();
                const empresaNorm = (a.empresa || '').trim().toLowerCase();

                // Integridade referencial: se o ativo não pertencer a nenhuma empresa válida, expurga da nuvem
                if (empresaNorm && validCompanyNames.size > 0 && !validCompanyNames.has(empresaNorm)) {
                    invalidAssetsToDelete.push(a);
                    return;
                }

                handledIds.add(idStr);
                const localAsset = (allAssetsList || []).find(l => l && String(l.id).trim() === idStr);
                mergedMap.set(idStr, {
                    id: a.id,
                    empresa: a.empresa || (localAsset ? localAsset.empresa : ''),
                    nome: a.nome || (localAsset ? localAsset.nome : ''),
                    tipo: a.tipo || (localAsset ? localAsset.tipo : ''),
                    local: a.local || (localAsset ? localAsset.local : ''),
                    fabricante: a.fabricante || (localAsset ? localAsset.fabricante : ''),
                    capacidade: a.capacidade || (localAsset ? localAsset.capacidade : ''),
                    caboPrincipal: a.caboprincipal || a.caboPrincipal || (localAsset ? localAsset.caboPrincipal : ''),
                    capacidadeAuxiliar: a.capacidadeauxiliar || a.capacidadeAuxiliar || (localAsset ? localAsset.capacidadeAuxiliar : ''),
                    caboAuxiliar: a.caboauxiliar || a.caboAuxiliar || (localAsset ? localAsset.caboAuxiliar : ''),
                    altura: a.altura || (localAsset ? localAsset.altura : ''),
                    vao: a.vao || (localAsset ? localAsset.vao : ''),
                    tensaoAlimentacao: a.tensaoalimentacao || a.tensaoAlimentacao || (localAsset ? localAsset.tensaoAlimentacao : ''),
                    tensaoComando: a.tensaocomando || a.tensaoComando || (localAsset ? localAsset.tensaoComando : ''),
                    alimentacaoEquipamento: a.alimentacaoequipamento || a.alimentacaoEquipamento || (localAsset ? localAsset.alimentacaoEquipamento : ''),
                    motorElevPrincipalAlta: a.motorelevprincipalalta || a.motorElevPrincipalAlta || (localAsset ? localAsset.motorElevPrincipalAlta : ''),
                    motorElevPrincipalBaixa: a.motorelevprincipalbaixa || a.motorElevPrincipalBaixa || (localAsset ? localAsset.motorElevPrincipalBaixa : ''),
                    motorElevAuxiliarAlta: a.motorelevauxiliaralta || a.motorElevAuxiliarAlta || (localAsset ? localAsset.motorElevAuxiliarAlta : ''),
                    motorElevAuxiliarBaixa: a.motorelevauxiliarbaixa || a.motorElevAuxiliarBaixa || (localAsset ? localAsset.motorElevAuxiliarBaixa : ''),
                    motorDirecaoCarro: a.motordirecaocarro || a.motorDirecaoCarro || (localAsset ? localAsset.motorDirecaoCarro : ''),
                    motorTranslacaoPonte: a.motortranslacaoponte || a.motorTranslacaoPonte || (localAsset ? localAsset.motorTranslacaoPonte : ''),
                    foto: (typeof a.foto === 'string' ? a.foto : (a.custom_fields && typeof a.custom_fields.foto === 'string' ? a.custom_fields.foto : (localAsset ? (localAsset.foto || localAsset.photo || localAsset.imagemUrl || '') : ''))),
                    template_id: a.template_id || (localAsset ? localAsset.template_id : null),
                    template_name: a.template_name || (localAsset ? localAsset.template_name : null),
                    schema_snapshot: a.schema_snapshot || (localAsset ? localAsset.schema_snapshot : null),
                    custom_fields: a.custom_fields || (localAsset ? localAsset.custom_fields : {}),
                    is_provisional: !!a.is_provisional,
                    provisional_id: a.provisional_id || (localAsset ? localAsset.provisional_id : null),
                    sync_status: a.sync_status || 'synced'
                });
            });

            // Remove ativos órfãos da nuvem em segundo plano
            if (invalidAssetsToDelete.length > 0) {
                invalidAssetsToDelete.forEach(invA => {
                    deleteAssetFromCloud(invA.id).catch(() => {});
                });
            }

            // Preserva SOMENTE ativos locais pendentes criados offline pertencentes a empresas válidas
            (allAssetsList || []).forEach(local => {
                if (local && local.id != null && (local._isOfflinePending || local.is_provisional)) {
                    const localEmpresa = (local.empresa || '').trim().toLowerCase();
                    if (!validCompanyNames.has(localEmpresa)) return;
                    const idStr = String(local.id).trim();
                    if (!handledIds.has(idStr) && !mergedMap.has(idStr)) {
                        handledIds.add(idStr);
                        mergedMap.set(idStr, local);
                    }
                }
            });

            const merged = Array.from(mergedMap.values());
            updateArrayInPlace(allAssetsList, merged);
            await fixConflictingAssetIds();
            const tenantKeyAssets = getTenantKey('crane_all_assets');
            try { localStorage.setItem(tenantKeyAssets, JSON.stringify(allAssetsList)); } catch (e) {}
            await setDBValue('crane_all_assets', allAssetsList);
        }

        // 3. Users (Sincronização pura do banco de dados na nuvem)
        let dbUsers = await dbFetchAll('users');
        if (Array.isArray(dbUsers) && dbUsers.length > 0) {
            const tenant = getTenantCode() || '001';
            const filteredUsers = dbUsers.filter(u => !u.tenant_code || String(u.tenant_code) === String(tenant));
            const usersToMap = filteredUsers.length > 0 ? filteredUsers : dbUsers;
            const mappedUsers = await Promise.all(usersToMap.map(async u => ({
                id: u.id,
                name: u.name || '',
                email: u.email ? u.email.trim().toLowerCase() : '',
                password: await hashPassword(u.password),
                permission: u.permission || 'TECNICO',
                cargo: u.cargo || u.role || '',
                signature: u.signature || u.assinatura || '',
                avatar: u.avatar || u.foto || '',
                tenant_code: u.tenant_code || tenant
            })));
            updateArrayInPlace(usersList, mappedUsers);
            setStoredData('crane_users', usersList);
        }

        // 4. Scheduled Inspections (Events)
        let dbEvents = await dbFetchAll('scheduled_inspections');
        if (Array.isArray(dbEvents)) {
            const mappedEvents = [];
            for (const e of dbEvents) {
                let eventId = String(e.id);
                const equip = String(e.equipamento || '');
                const eventDate = e.date || '';
                
                // Se o ID for igual ao ID do equipamento (legado sem data), migra para equipamento-data
                if (equip && eventDate && (eventId === equip || !eventId.includes('-20'))) {
                    const newId = `${equip}-${eventDate}`;
                    console.log(`SUPABASE: Migrando agendamento legado '${eventId}' para '${newId}'...`);
                    await dbDelete('scheduled_inspections', 'id', eventId);
                    eventId = newId;
                    await dbUpsert('scheduled_inspections', [{
                        id: newId,
                        groupId: e.groupId ? String(e.groupId) : null,
                        empresa: e.empresa || '',
                        equipamento: equip,
                        date: eventDate,
                        status: e.status || 'PENDENTE',
                        justificativa: e.justificativa || '',
                        color: e.color || '',
                        textColor: e.textColor || '',
                        tipo: e.tipo || '',
                        local: e.local || ''
                    }]);
                }

                mappedEvents.push({
                    id: eventId,
                    groupId: e.groupId ? (isNaN(e.groupId) ? e.groupId : Number(e.groupId)) : null,
                    empresa: e.empresa || '',
                    equipamento: equip,
                    date: eventDate,
                    status: e.status || 'PENDENTE',
                    justificativa: e.justificativa || '',
                    color: e.color || '',
                    textColor: e.textColor || '',
                    tipo: e.tipo || '',
                    local: e.local || '',
                    tecnico: e.tecnico || ''
                });
            }
            // A nuvem é a autoridade absoluta quando conectada.
            // Preserva apenas agendamentos locais explicitamente marcados como pendentes de sincronização offline
            (eventsList || []).forEach(localEv => {
                if (localEv && localEv._isOfflinePending && !mappedEvents.some(ev => String(ev.id) === String(localEv.id))) {
                    mappedEvents.push(localEv);
                }
            });
            updateArrayInPlace(eventsList, mappedEvents);
            setStoredData('crane_events', eventsList, false);
            // Limpa chave legada crane_assets se presente
            try { localStorage.removeItem('crane_assets'); } catch (e) {}
        }

        const parseIfNeeded = (val) => {
            if (!val) return null;
            if (typeof val === 'string') {
                try { return JSON.parse(val); } catch (e) { return null; }
            }
            return val;
        };
        const hasValidKeys = (obj) => obj && typeof obj === 'object' && Object.keys(obj).length > 0;

        // 5. Open Orders
        let dbOpenOrders = await dbFetchAll('open_orders');
        if (Array.isArray(dbOpenOrders)) {
            const localOpenOrders = await getDBValue('crane_open_orders', []);
            const mappedOrders = dbOpenOrders.map(o => {
                const parsedResp = parseIfNeeded(o.responses) || parseIfNeeded(o.responses_data) || {};
                const meta = (parsedResp && parsedResp.__meta) || {};
                const localMatch = (localOpenOrders || []).find(lo => String(lo.id) === String(o.id));
                let mergedResp = parsedResp;
                if (localMatch) {
                    const localResp = parseIfNeeded(localMatch.responses) || {};
                    if (hasValidKeys(localResp)) {
                        mergedResp = { ...parsedResp, ...localResp };
                    }
                }
                return {
                    ...o,
                    equipamentoId: o.equipamentoId || o.equipamentoid || '',
                    schema: parseIfNeeded(o.schema_snapshot) || parseIfNeeded(o.schema) || meta.schema_snapshot || meta.schema || (localMatch ? (localMatch.schema_snapshot || localMatch.schema) : null),
                    schema_snapshot: parseIfNeeded(o.schema_snapshot) || parseIfNeeded(o.schema) || meta.schema_snapshot || meta.schema || (localMatch ? (localMatch.schema_snapshot || localMatch.schema) : null),
                    templateId: o.templateId || o.templateid || meta.templateId || (localMatch ? localMatch.templateId : null),
                    templateName: o.templateName || o.templatename || meta.templateName || (localMatch ? localMatch.templateName : null),
                    responses: mergedResp,
                    generalObservation: o.generalObservation || o.generalobservation || (localMatch ? localMatch.generalObservation : ''),
                    generalImages: parseIfNeeded(o.generalImages) || parseIfNeeded(o.generalimages) || (localMatch ? localMatch.generalImages : []),
                    customSections: parseIfNeeded(o.customSections) || parseIfNeeded(o.customsections) || (localMatch ? localMatch.customSections : []),
                    customItems: parseIfNeeded(o.customItems) || parseIfNeeded(o.customitems) || (localMatch ? localMatch.customItems : []),
                    tecnico: o.tecnico || (localMatch ? localMatch.tecnico : ''),
                    revisions: parseIfNeeded(o.revisions) || meta.revisions || (localMatch ? localMatch.revisions : null)
                };
            });
            // Preserva ordens de serviço locais criadas offline
            const handledOrderIds = new Set(mappedOrders.map(o => String(o.id)));
            (localOpenOrders || []).forEach(localOrder => {
                if (localOrder && localOrder.id && !handledOrderIds.has(String(localOrder.id))) {
                    mappedOrders.push(localOrder);
                }
            });
            updateArrayInPlace(openOrders, mappedOrders);
            await setDBValue('crane_open_orders', mappedOrders);
            try { localStorage.removeItem('crane_open_orders'); } catch (e) {}
        }

        // 6. Finalized Reports
        let dbFinalizedReports = await dbFetchAll('finalized_reports');
        if (Array.isArray(dbFinalizedReports)) {
            const localReports = await getDBValue('crane_reports', []);
            const mappedReports = dbFinalizedReports.map(r => {
                const parsedResp = parseIfNeeded(r.responses) || parseIfNeeded(r.responses_data) || {};
                const meta = (parsedResp && parsedResp.__meta) || {};
                const localMatch = (localReports || []).find(lr => String(lr.id) === String(r.id));
                let mergedResp = parsedResp;
                if (localMatch) {
                    const localResp = parseIfNeeded(localMatch.responses) || {};
                    if (hasValidKeys(localResp)) {
                        mergedResp = { ...parsedResp, ...localResp };
                    }
                }
                const finalSchema = parseIfNeeded(r.schema_snapshot) || parseIfNeeded(r.schema) || meta.schema_snapshot || meta.schema || (localMatch ? (localMatch.schema_snapshot || localMatch.schema) : null);
                return {
                    ...r,
                    equipamentoId: r.equipamentoId || r.equipamentoid || '',
                    equipamentoNome: r.equipamentoNome || r.equipamentonome || r.equipamento || '',
                    schema: finalSchema,
                    schema_snapshot: finalSchema,
                    templateId: r.templateId || r.templateid || meta.templateId || (localMatch ? localMatch.templateId : null),
                    templateName: r.templateName || r.templatename || meta.templateName || (localMatch ? localMatch.templateName : null),
                    responses: mergedResp,
                    generalObservation: r.generalObservation || r.generalobservation || (localMatch ? localMatch.generalObservation : ''),
                    generalImages: parseIfNeeded(r.generalImages) || parseIfNeeded(r.generalimages) || (localMatch ? localMatch.generalImages : []),
                    customSections: parseIfNeeded(r.customSections) || parseIfNeeded(r.customsections) || (localMatch ? localMatch.customSections : []),
                    customItems: parseIfNeeded(r.customItems) || parseIfNeeded(r.customitems) || (localMatch ? localMatch.customItems : []),
                    tecnico: r.tecnico || (localMatch ? localMatch.tecnico : ''),
                    revisions: parseIfNeeded(r.revisions) || meta.revisions || (localMatch ? localMatch.revisions : null)
                };
            });
            // Preserva relatórios finalizados locais criados offline
            const handledReportIds = new Set(mappedReports.map(r => String(r.id)));
            (localReports || []).forEach(localRep => {
                if (localRep && localRep.id && !handledReportIds.has(String(localRep.id))) {
                    mappedReports.push(localRep);
                }
            });
            updateArrayInPlace(finalizedReports, mappedReports);
            await setDBValue('crane_reports', mappedReports);
            try { localStorage.removeItem('crane_reports'); } catch (e) {}
        }

        // 7. Internal Company
        let dbInternalCompany = await dbFetchAll('internal_company');
        if (Array.isArray(dbInternalCompany) && dbInternalCompany.length > 0) {
            const tenant = getTenantCode() || '001';
            const internalCompany = dbInternalCompany.find(c => c && String(c.tenant_code) === String(tenant)) || dbInternalCompany[0];
            if (internalCompany) {
                setStoredData('crane_internal_company', internalCompany);
            }
        }

        console.log('SUPABASE: Sincronização e migração concluídas com sucesso!');
        if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
            window.dispatchEvent(new CustomEvent('crane:cloud-synced'));
        }
    } catch (e) {
        console.error('SUPABASE: Erro ao sincronizar dados da nuvem:', e);
    }
}

export function updateArrayInPlace(target, source) {
    if (!Array.isArray(target) || !Array.isArray(source)) return;
    if (target === source) return;
    target.length = 0;
    target.push(...source);
}

// Normaliza e deduplica a lista de empresas: garante que cada item seja sempre um objeto { id, name, ... } único
function normalizeCompanies(list) {
    if (!Array.isArray(list)) return [];
    const map = new Map();
    list.forEach(c => {
        if (!c) return;
        let item = null;
        if (typeof c === 'string' && c.trim()) {
            const trimmed = c.trim();
            const idGen = 'comp_' + trimmed.toLowerCase().replace(/\W+/g, '_');
            item = { id: idGen, name: trimmed, cnpj: '', endereco: '', numero: '', bairro: '', cep: '', referencia: '', cidade: '', estado: '', logo: '' };
        } else if (typeof c === 'object' && c !== null && typeof c.name === 'string' && c.name.trim()) {
            const trimmedName = c.name.trim();
            const idGen = c.id || ('comp_' + (c.cnpj ? String(c.cnpj).replace(/\D+/g, '') : trimmedName.toLowerCase().replace(/\W+/g, '_')));
            item = {
                id: idGen,
                name: trimmedName,
                cnpj: c.cnpj || '',
                endereco: c.endereco || '',
                numero: c.numero || '',
                bairro: c.bairro || '',
                cep: c.cep || '',
                referencia: c.referencia || '',
                cidade: c.cidade || '',
                estado: c.estado || '',
                logo: c.logo || ''
            };
        }
        if (item) {
            const key = item.name.toLowerCase();
            const existing = map.get(key);
            if (!existing) {
                map.set(key, item);
            } else {
                // Fusão inteligente: mantém os campos preenchidos e a versão com logotipo
                map.set(key, {
                    ...existing,
                    ...item,
                    id: existing.id || item.id,
                    logo: item.logo || existing.logo || '',
                    cnpj: item.cnpj || existing.cnpj || '',
                    endereco: item.endereco || existing.endereco || '',
                    numero: item.numero || existing.numero || '',
                    bairro: item.bairro || existing.bairro || '',
                    cep: item.cep || existing.cep || '',
                    cidade: item.cidade || existing.cidade || '',
                    estado: item.estado || existing.estado || '',
                    referencia: item.referencia || existing.referencia || ''
                });
            }
        }
    });
    return Array.from(map.values());
}

export let companies = normalizeCompanies(getStoredData('crane_companies', [])).sort((a, b) => a.name.localeCompare(b.name));

export function setCompanies(newList) {
    updateArrayInPlace(companies, normalizeCompanies(newList).sort((a, b) => a.name.localeCompare(b.name)));
    setStoredData('crane_companies', companies);
}

const initialAssets = [];

// Migração: se o localStorage já possuir dados, atualiza apenas os 8 ativos de referência padrão.
const storedTechnicalAssets = getStoredData('crane_all_assets', null);
export let allAssetsList;

if (!storedTechnicalAssets) {
    allAssetsList = initialAssets;
    setStoredData('crane_all_assets', allAssetsList);
} else {
    allAssetsList = storedTechnicalAssets.map(asset => {
        const matchingInit = initialAssets.find(init => init.id === asset.id);
        if (matchingInit) {
            // Se for um ativo padrão de referência, atualiza-o com a nova especificação técnica completa
            return matchingInit;
        }
        return asset;
    });
    setStoredData('crane_all_assets', allAssetsList);
}

export function setAllAssetsList(newList) {
    updateArrayInPlace(allAssetsList, newList || []);
    setStoredData('crane_all_assets', allAssetsList);
}

// Migração automática do localStorage para o IndexedDB na primeira execução
export async function initializeIndexedDB() {
    const keys = [
        'crane_companies',
        'crane_all_assets',
        'crane_users',
        'crane_assets',
        'crane_events',
        'crane_open_orders',
        'crane_reports',
        'crane_internal_company'
    ];

    for (const key of keys) {
        const dbVal = await getDBValue(key, undefined);
        if (dbVal === undefined) {
            const localVal = localStorage.getItem(key);
            if (localVal !== null) {
                try {
                    const parsed = JSON.parse(localVal);
                    await setDBValue(key, parsed);
                    if (HEAVY_KEYS.has(key)) {
                        localStorage.removeItem(key);
                    }
                    console.log(`Migrado com sucesso para IndexedDB: ${key}`);
                } catch (e) {
                    console.error(`Erro ao migrar ${key}:`, e);
                }
            }
        }
    }
}

// Função de higienização de dados: remove automaticamente registros órfãos locais que pertencem a empresas inexistentes
export function purgeOrphanLocalData() {
    const validCompanyNames = new Set((companies || []).map(c => (typeof c === 'string' ? c : c.name).toLowerCase().trim()));
    const internalComp = getStoredData('crane_internal_company', null);
    if (internalComp && internalComp.name) {
        validCompanyNames.add(String(internalComp.name).trim().toLowerCase());
    }

    if (validCompanyNames.size > 0) {
        // Filtra ativos
        const cleanAssets = (allAssetsList || []).filter(a => a.empresa && validCompanyNames.has(String(a.empresa).trim().toLowerCase()));
        if (cleanAssets.length !== allAssetsList.length) {
            updateArrayInPlace(allAssetsList, cleanAssets);
            setStoredData('crane_all_assets', allAssetsList);
        }

        // Filtra agendamentos
        const cleanEvents = (eventsList || []).filter(e => e.empresa && validCompanyNames.has(String(e.empresa).trim().toLowerCase()));
        if (cleanEvents.length !== eventsList.length) {
            updateArrayInPlace(eventsList, cleanEvents);
            setStoredData('crane_events', eventsList);
        }

        // Filtra ordens de serviço
        const cleanOrders = (openOrders || []).filter(o => o.empresa && validCompanyNames.has(String(o.empresa).trim().toLowerCase()));
        if (cleanOrders.length !== openOrders.length) {
            updateArrayInPlace(openOrders, cleanOrders);
            setStoredData('crane_open_orders', openOrders);
        }

        // Filtra relatórios finalizados
        const cleanReports = (finalizedReports || []).filter(r => r.empresa && validCompanyNames.has(String(r.empresa).trim().toLowerCase()));
        if (cleanReports.length !== finalizedReports.length) {
            updateArrayInPlace(finalizedReports, cleanReports);
            setStoredData('crane_reports', finalizedReports);
        }
    }
}

/**
 * Detecta e resolve automaticamente colisões de IDs entre ativos de empresas diferentes
 * (ex: se duas empresas tiverem um ativo com o mesmo ID '#EQP-0001').
 */
export async function fixConflictingAssetIds() {
    if (!Array.isArray(allAssetsList) || allAssetsList.length === 0) return false;
    const seenIds = new Map(); // cleanId -> asset
    let hasConflict = false;
    let maxSeq = 0;

    // 1. Identifica o maior número sequencial existente em toda a lista
    allAssetsList.forEach(a => {
        if (!a || !a.id) return;
        const match = String(a.id).match(/^(?:#?EQP[- ]?)([0-9]+)$/i);
        if (match && match[1]) {
            const num = parseInt(match[1], 10);
            if (num > maxSeq && num <= 9000) maxSeq = num;
        }
    });

    // 2. Localiza e resolve colisões de ativos entre empresas distintas
    for (let i = 0; i < allAssetsList.length; i++) {
        const asset = allAssetsList[i];
        if (!asset || !asset.id) continue;
        const cleanId = String(asset.id).trim().toUpperCase();
        const assetEmpresa = (asset.empresa || '').trim().toLowerCase();

        if (!seenIds.has(cleanId)) {
            seenIds.set(cleanId, asset);
        } else {
            const firstAsset = seenIds.get(cleanId);
            const firstEmpresa = (firstAsset.empresa || '').trim().toLowerCase();

            // Se pertencerem a empresas diferentes (ou forem dois ativos distintos com o mesmo ID)
            if (firstEmpresa !== assetEmpresa || firstAsset !== asset) {
                hasConflict = true;
                maxSeq += 1;
                const newId = `#EQP-${String(maxSeq).padStart(4, '0')}`;
                const oldId = asset.id;
                console.warn(`CRANE ASSETS: Colisão de ID detectada! Ativo da empresa "${asset.empresa}" renumerado de ${oldId} para ${newId}`);

                asset.id = newId;
                seenIds.set(newId, asset);

                // Migra eventos correspondentes daquela empresa
                (eventsList || []).forEach(ev => {
                    if (ev && (ev.equipamento === oldId || ev.id === oldId || String(ev.id).startsWith(`${oldId}-`)) &&
                        ev.empresa && asset.empresa && ev.empresa.trim().toLowerCase() === assetEmpresa) {
                        ev.equipamento = newId;
                        if (String(ev.id).includes(oldId)) {
                            ev.id = String(ev.id).replace(oldId, newId);
                        }
                    }
                });

                // Migra ordens de serviço correspondentes daquela empresa
                (openOrders || []).forEach(ord => {
                    if (ord && (ord.equipamentoId === oldId || ord.equipamento === oldId) &&
                        ord.empresa && asset.empresa && ord.empresa.trim().toLowerCase() === assetEmpresa) {
                        ord.equipamentoId = newId;
                        ord.equipamento = newId;
                    }
                });
            }
        }
    }

    if (hasConflict) {
        setAllAssetsList(allAssetsList);
        setStoredData('crane_events', eventsList, true);
        setStoredData('crane_open_orders', openOrders, true);
        return true;
    }
    return false;
}

export const DB_SCHEMA_VERSION = 4;

export async function checkAndApplySchemaVersion() {
    try {
        if (typeof localStorage === 'undefined') return;
        const storedVersion = Number(localStorage.getItem('crane_db_schema_version') || 0);
        if (storedVersion < DB_SCHEMA_VERSION) {
            console.log(`CRANE PRO: Atualizando versão de dados local de ${storedVersion} para ${DB_SCHEMA_VERSION}...`);
            // Limpa chaves de agendamentos e ativos locais obsoletos para forçar sincronização fresca da nuvem
            const keysToPurge = [
                'crane_events', '001_crane_events', 'crane_001_events',
                'crane_all_assets', '001_crane_all_assets', 'crane_001_all_assets',
                'crane_assets', '001_crane_assets'
            ];
            keysToPurge.forEach(k => {
                try { localStorage.removeItem(k); } catch (e) {}
                deleteDBValue(k).catch(() => {});
            });
            localStorage.setItem('crane_db_schema_version', String(DB_SCHEMA_VERSION));
        }
    } catch (e) {
        console.warn('CRANE PRO: Falha ao verificar versão de schema:', e);
    }
}

// Carrega todos os dados do banco de dados IndexedDB para a memória de forma assíncrona
export async function loadAllDataFromDB() {
    await checkAndApplySchemaVersion();
    await initializeIndexedDB();

    // 1. Carrega imediatamente do IndexedDB local (Instantâneo / Sem bloqueio)
    const dbCompanies = normalizeCompanies(await getDBValue('crane_companies', companies)).sort((a, b) => a.name.localeCompare(b.name));
    updateArrayInPlace(companies, dbCompanies);
    
    const storedTechnicalAssets = await getDBValue('crane_all_assets', null);
    if (!storedTechnicalAssets) {
        updateArrayInPlace(allAssetsList, initialAssets);
    } else {
        const mappedAssets = storedTechnicalAssets.map(asset => {
            const matchingInit = initialAssets.find(init => init.id === asset.id);
            if (matchingInit) return matchingInit;
            return asset;
        });
        updateArrayInPlace(allAssetsList, mappedAssets);
    }

    const dbUsers = await getDBValue('crane_users', []);
    updateArrayInPlace(usersList, dbUsers || []);

    const dbEvents = await getDBValue('crane_events', []);
    updateArrayInPlace(eventsList, dbEvents || []);

    const dbOpenOrders = await getDBValue('crane_open_orders', []);
    updateArrayInPlace(openOrders, dbOpenOrders || []);

    const dbFinalizedReports = await getDBValue('crane_reports', []);
    updateArrayInPlace(finalizedReports, dbFinalizedReports || []);

    // Higieniza dados órfãos locais imediatamente
    purgeOrphanLocalData();
    await fixConflictingAssetIds();

    // 2. Tenta sincronizar do Supabase em segundo plano (Não-bloqueante)
    if (isSupabaseConfigured) {
        syncAllFromSupabase().then(() => {
            console.log('SUPABASE: Carregamento em segundo plano concluído. Atualizando visões...');
            isInitialLoad = false; // Permite sincronizações futuras de salvamento
            if (typeof window.renderCompanies === 'function') window.renderCompanies();
            if (typeof window.renderAssets === 'function') window.renderAssets();
            if (typeof window.renderAtivosView === 'function') window.renderAtivosView();
            if (typeof window.renderCalendar === 'function') window.renderCalendar();
            if (typeof window.renderOpenOrders === 'function') window.renderOpenOrders();
            if (typeof window.renderReportsView === 'function') window.renderReportsView();
        }).catch(err => {
            isInitialLoad = false;
            console.error('SUPABASE: Falha na sincronização em segundo plano:', err);
        });
    } else {
        isInitialLoad = false;
    }
}

// Lista de Usuários Global (Carregada puramente do Banco de Dados / Cache Local)
export let eventsList = getStoredData('crane_events', []);

export function setEventsList(newList, syncCloud = true) {
    eventsList = newList;
    setStoredData('crane_events', eventsList, syncCloud);
}

export let usersList = getStoredData('crane_users', []);

export function setUsersList(newList) {
    usersList = newList;
    setStoredData('crane_users', usersList);
}

export let openOrders = getStoredData('crane_open_orders', []);

export function setOpenOrders(newList) {
    openOrders = newList;
    setStoredData('crane_open_orders', openOrders);
}

export let finalizedReports = getStoredData('crane_reports', []);

export function setFinalizedReports(newList) {
    finalizedReports = newList;
    setStoredData('crane_reports', finalizedReports);
}

/**
 * Varre todos os dados locais e faz o upload retroativo de todas as fotos/base64 para o Supabase Storage.
 */
export async function migrateAllMediaToSupabase() {
    if (!isSupabaseConfigured) {
        console.warn('Supabase não configurado. Não é possível migrar mídias.');
        return false;
    }
    console.log('SUPABASE STORAGE: Iniciando migração de mídias para a nuvem...');
    try {
        const companies = getStoredData('crane_companies', []);
        if (companies && companies.length > 0) {
            await syncKeyToSupabase('crane_companies', companies);
        }

        const internalComp = getStoredData('crane_internal_company', null);
        if (internalComp) {
            await syncKeyToSupabase('crane_internal_company', internalComp);
        }

        const users = getStoredData('crane_users', []);
        if (users && users.length > 0) {
            await syncKeyToSupabase('crane_users', users);
        }

        const openOrdersData = await getDBValue('crane_open_orders', []);
        if (openOrdersData && openOrdersData.length > 0) {
            await syncKeyToSupabase('crane_open_orders', openOrdersData);
            await setDBValue('crane_open_orders', openOrdersData);
        }

        const finalizedReportsData = await getDBValue('crane_reports', []);
        if (finalizedReportsData && finalizedReportsData.length > 0) {
            await syncKeyToSupabase('crane_reports', finalizedReportsData);
            await setDBValue('crane_reports', finalizedReportsData);
        }

        console.log('SUPABASE STORAGE: Migração de mídias concluída com sucesso!');
        return true;
    } catch (e) {
        console.error('SUPABASE STORAGE: Erro durante a migração de mídias:', e);
        return false;
    }
}

/**
 * Varre o bucket 'crane-app-media' na pasta 'assets' e exclui imagens órfãs
 * que não pertençam a nenhum ativo cadastrado atualmente no sistema.
 */
export async function cleanStorageOrphanAssets() {
    if (!isSupabaseConfigured) {
        console.warn('Supabase não configurado.');
        return { success: false, reason: 'Supabase não configurado' };
    }
    const client = getActiveSupabase();
    if (!client) return { success: false, reason: 'Cliente Supabase indisponível' };

    try {
        const { data: fileList, error } = await client.storage.from('crane-app-media').list('assets');
        if (error || !Array.isArray(fileList)) {
            console.warn('Falha ao listar arquivos de assets no Storage:', error);
            return { success: false, error };
        }

        // Mapeia todas as fotos ativas atualmente no sistema
        const activePhotos = new Set();
        (allAssetsList || []).forEach(a => {
            const p = a.foto || a.photo || a.imagemUrl;
            if (p && typeof p === 'string') {
                activePhotos.add(p);
                const parts = p.split('/');
                activePhotos.add(parts[parts.length - 1]);
            }
        });

        const filesToDelete = [];
        fileList.forEach(f => {
            if (!f || !f.name) return;
            // Se o arquivo não corresponder a nenhuma foto ativa de ativo, marca para exclusão
            if (!activePhotos.has(f.name)) {
                filesToDelete.push(`assets/${f.name}`);
            }
        });

        if (filesToDelete.length > 0) {
            console.log(`CRANE PRO STORAGE: Excluindo ${filesToDelete.length} fotos órfãs em assets/...`, filesToDelete);
            const { error: delError } = await client.storage.from('crane-app-media').remove(filesToDelete);
            if (delError) {
                console.warn('Erro ao remover arquivos órfãos no Storage:', delError);
                return { success: false, error: delError, filesToDelete };
            }
        }

        console.log(`CRANE PRO STORAGE: Limpeza concluída. ${filesToDelete.length} arquivos órfãos removidos.`);
        return { success: true, deletedCount: filesToDelete.length, deletedFiles: filesToDelete };
    } catch (e) {
        console.error('Erro em cleanStorageOrphanAssets:', e);
        return { success: false, error: e };
    }
}

if (typeof window !== 'undefined') {
    window.migrateAllMediaToSupabase = migrateAllMediaToSupabase;
    window.purgeOrphanLocalData = purgeOrphanLocalData;
    window.syncAllFromSupabase = syncAllFromSupabase;
    window.cleanStorageOrphanAssets = cleanStorageOrphanAssets;
    window.fixConflictingAssetIds = fixConflictingAssetIds;
}


