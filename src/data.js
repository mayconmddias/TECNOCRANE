// Crane Pro - Data Layer

import { isSupabaseConfigured, dbFetchAll, dbUpsert, dbDelete } from './supabase.js';
export { dbFetchAll, isSupabaseConfigured };
import { hashPassword } from './utils.js';

export let isInitialLoad = true;

// --- IndexedDB Configuration & State ---
const DB_NAME = 'crane_pro_db';
const DB_VERSION = 1;
const STORE_NAME = 'keyval';

let dbPromise = null;

function getDB() {
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
    return getDB().then(db => {
        return new Promise((resolve) => {
            const transaction = db.transaction(STORE_NAME, 'readonly');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.get(key);
            request.onsuccess = () => {
                resolve(request.result !== undefined ? request.result : defaultValue);
            };
            request.onerror = () => {
                resolve(defaultValue);
            };
        });
    });
}

export function setDBValue(key, value) {
    return getDB().then(db => {
        return new Promise((resolve, reject) => {
            const transaction = db.transaction(STORE_NAME, 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            const request = store.put(value, key);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    });
}

export function normalizeReportObject(r) {
    if (!r) return null;
    const resp = r.responses || {};
    return {
        id: r.id || '',
        status: r.status || 'FINALIZED',
        type: r.type || r.tipo || 'PREVENTIVA',
        empresa: (r.empresa || r.company || '').trim(),
        equipamentoId: r.equipamentoId || r.equipamentoid || r.equipamento || '',
        equipamentoNome: r.equipamentoNome || r.equipamentonome || r.equipamento || '',
        assetInfo: r.assetInfo || r.assetinfo || '',
        date: r.date || '',
        tecnico: r.tecnico || r.technician || '',
        createdAt: r.createdAt || r.createdat || new Date().toISOString(),
        updatedAt: r.updatedAt || r.updatedat || new Date().toISOString(),
        responses: resp,
        generalObservation: r.generalObservation || r.generalobservation || '',
        generalImages: r.generalImages || r.generalimages || [],
        customSections: r.customSections || r.customsections || [],
        customItems: r.customItems || resp.__customItems || [],
        responsibles: r.responsibles || resp.__responsibles || []
    };
}

// Funções de Persistência
export function getStoredData(key, defaultValue) {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : defaultValue;
}

export function setStoredData(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn(`localStorage falhou para ${key} (limite excedido), continuando com IndexedDB:`, e);
    }
    
    setDBValue(key, data).catch(err => {
        console.error(`Erro ao gravar ${key} no IndexedDB:`, err);
    });

    // Sincroniza em segundo plano se o Supabase estiver configurado
    if (isSupabaseConfigured) {
        syncKeyToSupabase(key, data);
    }
}

export async function setStoredDataAsync(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify(data));
    } catch (e) {
        console.warn(`localStorage falhou para ${key} (limite excedido), continuando com IndexedDB:`, e);
    }
    
    try {
        await setDBValue(key, data);
    } catch (err) {
        console.error(`Erro ao gravar ${key} no IndexedDB:`, err);
    }

    if (isSupabaseConfigured) {
        try {
            await syncKeyToSupabase(key, data);
        } catch (errCloud) {
            console.error(`Erro ao sincronizar ${key} no Supabase:`, errCloud);
        }
    }
}

/**
 * Envia alterações de uma chave local para a tabela correspondente no Supabase
 */
/**
 * Envia alterações de uma chave local para a tabela correspondente no Supabase de forma atômica e não-destrutiva
 */
export async function syncKeyToSupabase(key, data) {
    if (!isSupabaseConfigured) return;
    try {
        if (key === 'crane_companies') {
            const rows = data.map(c => ({
                name: c.name,
                cnpj: c.cnpj || '',
                endereco: c.endereco || '',
                numero: c.numero || '',
                bairro: c.bairro || '',
                cep: c.cep || '',
                referencia: c.referencia || '',
                cidade: c.cidade || '',
                estado: c.estado || '',
                logo: c.logo || ''
            }));
            await dbUpsert('companies', rows);
        } else if (key === 'crane_all_assets') {
            const rows = data.map(a => ({
                id: a.id,
                empresa: a.empresa || '',
                nome: a.nome || '',
                tipo: a.tipo || '',
                local: a.local || '',
                fabricante: a.fabricante || '',
                capacidade: a.capacidade || '',
                caboprincipal: a.caboPrincipal || '',
                capacidadeauxiliar: a.capacidadeAuxiliar || '',
                caboauxiliar: a.caboAuxiliar || '',
                altura: a.altura || '',
                vao: a.vao || '',
                tensaoalimentacao: a.tensaoAlimentacao || '',
                tensaocomando: a.tensaoComando || '',
                alimentacaoequipamento: a.alimentacaoEquipamento || '',
                motorelevprincipalalta: a.motorElevPrincipalAlta || '',
                motorelevprincipalbaixa: a.motorElevPrincipalBaixa || '',
                motorelevauxiliaralta: a.motorElevAuxiliarAlta || '',
                motorelevauxiliarbaixa: a.motorElevAuxiliarBaixa || '',
                motordirecaocarro: a.motorDirecaoCarro || '',
                motortranslacaoponte: a.motorTranslacaoPonte || ''
            }));
            await dbUpsert('all_assets', rows);
        } else if (key === 'crane_users') {
            const rows = await Promise.all(data.map(async u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                password: await hashPassword(u.password),
                permission: u.permission
            })));
            await dbUpsert('users', rows);
        } else if (key === 'crane_events') {
            const rows = data.map(e => ({
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
            await dbUpsert('scheduled_inspections', rows);
        } else if (key === 'crane_open_orders') {
            const rows = data.map(o => {
                const responsesObj = { ...(o.responses || {}) };
                if (o.customItems && o.customItems.length > 0) responsesObj.__customItems = o.customItems;
                // Não embutir responsibles em responses — usar coluna dedicada
                delete responsesObj.__responsibles;
                return {
                    id: o.id,
                    status: o.status || '',
                    type: o.type || '',
                    empresa: o.empresa || '',
                    equipamentoId: o.equipamentoId || '',
                    equipamentoNome: o.equipamentoNome || '',
                    assetInfo: o.assetInfo || '',
                    date: o.date || '',
                    tecnico: o.tecnico || '',
                    createdAt: o.createdAt || new Date().toISOString(),
                    updatedAt: o.updatedAt || new Date().toISOString(),
                    responses: responsesObj,
                    generalObservation: o.generalObservation || '',
                    generalImages: o.generalImages || [],
                    customSections: o.customSections || [],
                    responsibles: o.responsibles || []
                };
            });
            await dbUpsert('open_orders', rows);
        } else if (key === 'crane_reports') {
            const rows = data.map(r => {
                const responsesObj = { ...(r.responses || {}) };
                if (r.customItems && r.customItems.length > 0) responsesObj.__customItems = r.customItems;
                // Não embutir responsibles em responses — usar coluna dedicada
                delete responsesObj.__responsibles;
                return {
                    id: r.id,
                    status: r.status || '',
                    type: r.type || '',
                    empresa: r.empresa || '',
                    equipamentoId: r.equipamentoId || '',
                    equipamentoNome: r.equipamentoNome || '',
                    assetInfo: r.assetInfo || '',
                    date: r.date || '',
                    tecnico: r.tecnico || '',
                    createdAt: r.createdAt || new Date().toISOString(),
                    updatedAt: r.updatedAt || new Date().toISOString(),
                    responses: responsesObj,
                    generalObservation: r.generalObservation || '',
                    generalImages: r.generalImages || [],
                    customSections: r.customSections || [],
                    responsibles: r.responsibles || []
                };
            });
            await dbUpsert('finalized_reports', rows);
        } else if (key === 'crane_internal_company') {
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
                logo: data.logo || ''
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
    if (!isSupabaseConfigured) return;
    return dbDelete('companies', 'name', companyName);
}

export async function deleteCompanyAssetsFromCloud(companyName) {
    if (!isSupabaseConfigured || !companyName) return;
    try {
        const target = companyName.trim().toLowerCase();
        const dbAssets = await dbFetchAll('all_assets');
        if (dbAssets && dbAssets.length > 0) {
            const toDelete = dbAssets.filter(a => (a.empresa || '').trim().toLowerCase() === target);
            for (const asset of toDelete) {
                await dbDelete('all_assets', 'id', asset.id);
            }
        }
    } catch (e) {
        console.error(`Erro ao excluir ativos da empresa ${companyName} no Supabase:`, e);
    }
}

export async function deleteAssetFromCloud(assetId) {
    if (!isSupabaseConfigured) return;
    return dbDelete('all_assets', 'id', assetId);
}

export async function deleteUserFromCloud(userId) {
    if (!isSupabaseConfigured) return;
    return dbDelete('users', 'id', userId);
}

export async function deleteEventFromCloud(eventId) {
    if (!isSupabaseConfigured) return;
    return dbDelete('scheduled_inspections', 'id', String(eventId));
}

export async function deleteOrderFromCloud(orderId) {
    if (!isSupabaseConfigured) return;
    return dbDelete('open_orders', 'id', orderId);
}

export async function deleteReportFromCloud(reportId) {
    if (!isSupabaseConfigured) return;
    return dbDelete('finalized_reports', 'id', reportId);
}

/**
 * Puxa todos os dados do Supabase e atualiza o banco local
 */
export async function syncAllFromSupabase() {
    if (!isSupabaseConfigured) return;
    try {
        console.log('SUPABASE: Carregando dados da nuvem...');

        // 1. Companies
        try {
            let dbCompanies = await dbFetchAll('companies');
            if (!dbCompanies || dbCompanies.length === 0) {
                console.log('SUPABASE: Tabela de empresas vazia na nuvem. Migrando dados locais...');
                const localCompanies = companies && companies.length > 0 ? companies : getStoredData('crane_companies', []);
                if (localCompanies.length > 0) {
                    await syncKeyToSupabase('crane_companies', localCompanies);
                    dbCompanies = localCompanies;
                }
            }
            if (dbCompanies && dbCompanies.length > 0) {
                companies = normalizeCompanies(dbCompanies).sort((a, b) => a.name.localeCompare(b.name));
                localStorage.setItem('crane_companies', JSON.stringify(companies));
                await setDBValue('crane_companies', companies);
            }
        } catch (errComp) {
            console.error('SUPABASE: Erro ao carregar empresas:', errComp);
        }

        const validCompanyNames = new Set((companies || []).map(c => (typeof c === 'string' ? c : c.name).toLowerCase()));

        // 2. All Assets
        try {
            let dbAllAssets = await dbFetchAll('all_assets');
            if (!dbAllAssets || dbAllAssets.length === 0) {
                console.log('SUPABASE: Tabela de ativos vazia na nuvem. Migrando dados locais...');
                const localAssets = allAssetsList && allAssetsList.length > 0 ? allAssetsList : getStoredData('crane_all_assets', initialAssets);
                if (localAssets.length > 0) {
                    await syncKeyToSupabase('crane_all_assets', localAssets);
                    dbAllAssets = localAssets;
                }
            }
            if (dbAllAssets && dbAllAssets.length > 0) {
                // Filtra e apaga do Supabase ativos órfãos cujas empresas não existem mais
                const validAssets = [];
                for (const a of dbAllAssets) {
                    const assetCompany = (a.empresa || '').trim().toLowerCase();
                    if (assetCompany && validCompanyNames.size > 0 && !validCompanyNames.has(assetCompany)) {
                        console.log(`SUPABASE: Removendo ativo órfão '${a.id}' vinculado à empresa excluída '${a.empresa}'...`);
                        await dbDelete('all_assets', 'id', a.id);
                    } else {
                        validAssets.push(a);
                    }
                }
                dbAllAssets = validAssets;

                allAssetsList = dbAllAssets.map(a => ({
                    id: a.id,
                    empresa: a.empresa || '',
                    nome: a.nome || '',
                    tipo: a.tipo || '',
                    local: a.local || '',
                    fabricante: a.fabricante || '',
                    capacidade: a.capacidade || '',
                    caboPrincipal: a.caboprincipal || a.caboPrincipal || '',
                    capacidadeAuxiliar: a.capacidadeauxiliar || a.capacidadeAuxiliar || '',
                    caboAuxiliar: a.caboauxiliar || a.caboAuxiliar || '',
                    altura: a.altura || '',
                    vao: a.vao || '',
                    tensaoAlimentacao: a.tensaoalimentacao || a.tensaoAlimentacao || '',
                    tensaoComando: a.tensaocomando || a.tensaoComando || '',
                    alimentacaoEquipamento: a.alimentacaoequipamento || a.alimentacaoEquipamento || '',
                    motorElevPrincipalAlta: a.motorelevprincipalalta || a.motorElevPrincipalAlta || '',
                    motorElevPrincipalBaixa: a.motorelevprincipalbaixa || a.motorElevPrincipalBaixa || '',
                    motorElevAuxiliarAlta: a.motorelevauxiliaralta || a.motorElevAuxiliarAlta || '',
                    motorElevAuxiliarBaixa: a.motorelevauxiliarbaixa || a.motorElevAuxiliarBaixa || '',
                    motorDirecaoCarro: a.motordirecaocarro || a.motorDirecaoCarro || '',
                    motorTranslacaoPonte: a.motortranslacaoponte || a.motorTranslacaoPonte || ''
                }));
                localStorage.setItem('crane_all_assets', JSON.stringify(allAssetsList));
                await setDBValue('crane_all_assets', allAssetsList);
            }
        } catch (errAssets) {
            console.error('SUPABASE: Erro ao carregar ativos:', errAssets);
        }

        // 3. Users (Sincronização pura do banco de dados na nuvem)
        try {
            let dbUsers = await dbFetchAll('users');
            if (dbUsers && dbUsers.length > 0) {
                const mappedUsers = await Promise.all(dbUsers.map(async u => ({
                    id: u.id,
                    name: u.name || '',
                    email: u.email ? u.email.trim().toLowerCase() : '',
                    password: await hashPassword(u.password),
                    permission: u.permission || 'TECNICO'
                })));
                updateArrayInPlace(usersList, mappedUsers);
                localStorage.setItem('crane_users', JSON.stringify(usersList));
                await setDBValue('crane_users', usersList);
            }
        } catch (errUsers) {
            console.error('SUPABASE: Erro ao carregar usuários:', errUsers);
        }

        // 4. Scheduled Inspections (Events)
        try {
            let dbEvents = await dbFetchAll('scheduled_inspections');
            if (!dbEvents || dbEvents.length === 0) {
                console.log('SUPABASE: Tabela de agendamentos vazia na nuvem. Migrando dados locais...');
                const localEvents = getStoredData('crane_events', []);
                if (localEvents.length > 0) {
                    await syncKeyToSupabase('crane_events', localEvents);
                    dbEvents = localEvents;
                }
            }
            if (dbEvents) {
                const mappedEvents = dbEvents.map(e => ({
                    id: isNaN(e.id) ? e.id : Number(e.id),
                    groupId: e.groupId ? (isNaN(e.groupId) ? e.groupId : Number(e.groupId)) : null,
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
                localStorage.setItem('crane_events', JSON.stringify(mappedEvents));
                await setDBValue('crane_events', mappedEvents);
            }
        } catch (errEvents) {
            console.error('SUPABASE: Erro ao carregar agendamentos:', errEvents);
        }

        // 5. Open Orders
        try {
            let dbOpenOrders = await dbFetchAll('open_orders');
            if (!dbOpenOrders || dbOpenOrders.length === 0) {
                console.log('SUPABASE: Tabela de ordens em aberto vazia na nuvem. Sincronizando dados locais...');
                const localOpenOrders = getStoredData('crane_open_orders', []);
                if (localOpenOrders.length > 0) {
                    await syncKeyToSupabase('crane_open_orders', localOpenOrders);
                    dbOpenOrders = localOpenOrders;
                }
            }
            if (dbOpenOrders) {
                const mappedOrders = dbOpenOrders.map(o => {
                    const resp = o.responses || {};
                    return {
                        ...o,
                        empresa: (o.empresa || '').trim(),
                        equipamentoId: o.equipamentoId || o.equipamentoid || '',
                        equipamentoNome: o.equipamentoNome || o.equipamentonome || o.equipamento || '',
                        createdAt: o.createdAt || o.createdat || new Date().toISOString(),
                        updatedAt: o.updatedAt || o.updatedat || new Date().toISOString(),
                        generalObservation: o.generalObservation || o.generalobservation || '',
                        generalImages: o.generalImages || o.generalimages || [],
                        customSections: o.customSections || o.customsections || [],
                        customItems: o.customItems || resp.__customItems || [],
                        responsibles: o.responsibles || resp.__responsibles || []
                    };
                });
                localStorage.setItem('crane_open_orders', JSON.stringify(mappedOrders));
                await setDBValue('crane_open_orders', mappedOrders);
            }
        } catch (errOrders) {
            console.error('SUPABASE: Erro ao carregar ordens em aberto:', errOrders);
        }

        // 6. Finalized Reports
        try {
            let dbFinalizedReports = await dbFetchAll('finalized_reports');
            const localReports = getStoredData('crane_reports', []).map(normalizeReportObject).filter(Boolean);

            if (!dbFinalizedReports || dbFinalizedReports.length === 0) {
                console.log('SUPABASE: Tabela de relatórios finalizados vazia na nuvem. Sincronizando dados locais...');
                if (localReports.length > 0) {
                    await syncKeyToSupabase('crane_reports', localReports);
                    dbFinalizedReports = localReports;
                }
            } else {
                const cloudMapped = dbFinalizedReports.map(normalizeReportObject).filter(Boolean);
                const cloudIds = new Set(cloudMapped.map(r => r.id));
                const missingLocal = localReports.filter(lr => lr && lr.id && !cloudIds.has(lr.id));
                
                if (missingLocal.length > 0) {
                    console.log(`SUPABASE: Encontrados ${missingLocal.length} relatórios locais pendentes de envio. Sincronizando...`);
                    const merged = [...cloudMapped, ...missingLocal];
                    await syncKeyToSupabase('crane_reports', merged);
                    dbFinalizedReports = merged;
                } else {
                    dbFinalizedReports = cloudMapped;
                }
            }

            if (dbFinalizedReports) {
                const mappedReports = dbFinalizedReports.map(normalizeReportObject).filter(Boolean);
                localStorage.setItem('crane_reports', JSON.stringify(mappedReports));
                await setDBValue('crane_reports', mappedReports);
                // Atualiza a variável em memória do app.js via bridge function
                if (typeof window.syncFinalizedReports === 'function') {
                    window.syncFinalizedReports(mappedReports);
                }
            }
        } catch (errReports) {
            console.error('SUPABASE: Erro ao carregar relatórios finalizados:', errReports);
        }

        // 7. Internal Company
        try {
            let dbInternalCompany = await dbFetchAll('internal_company');
            if (!dbInternalCompany || dbInternalCompany.length === 0) {
                console.log('SUPABASE: Tabela de empresa interna vazia na nuvem. Sincronizando dados locais...');
                const localInternal = getStoredData('crane_internal_company', null);
                if (localInternal) {
                    await syncKeyToSupabase('crane_internal_company', localInternal);
                    dbInternalCompany = [localInternal];
                }
            }
            if (dbInternalCompany && dbInternalCompany.length > 0) {
                const internalCompany = dbInternalCompany[0];
                localStorage.setItem('crane_internal_company', JSON.stringify(internalCompany));
                await setDBValue('crane_internal_company', internalCompany);
            }
        } catch (errInternal) {
            console.error('SUPABASE: Erro ao carregar empresa interna:', errInternal);
        }

        console.log('SUPABASE: Sincronização e migração concluídas com sucesso!');
        if (typeof window.renderReportsView === 'function') {
            window.renderReportsView();
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

// Normaliza a lista de empresas do localStorage: garante que cada item seja sempre um objeto { name, ... }
function normalizeCompanies(list) {
    if (!Array.isArray(list)) return [];
    return list.map(c => {
        if (typeof c === 'string') return { name: c, cnpj: '', endereco: '', numero: '', bairro: '', cep: '', referencia: '', cidade: '', estado: '', logo: '' };
        if (typeof c === 'object' && c !== null && typeof c.name === 'string') {
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
                logo: c.logo || ''
            };
        }
        return null;
    }).filter(Boolean);
}

export let companies = normalizeCompanies(getStoredData('crane_companies', [])).sort((a, b) => a.name.localeCompare(b.name));

export function setCompanies(newList) {
    companies = normalizeCompanies(newList).sort((a, b) => a.name.localeCompare(b.name));
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
    allAssetsList = newList;
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
                    console.log(`Migrado com sucesso para IndexedDB: ${key}`);
                } catch (e) {
                    console.error(`Erro ao migrar ${key}:`, e);
                }
            }
        }
    }
}

// Carrega todos os dados do banco de dados IndexedDB para a memória de forma assíncrona
export async function loadAllDataFromDB() {
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

    // Carrega relatórios do IndexedDB e atualiza memória via bridge function
    const storedReports = (await getDBValue('crane_reports', []) || []).map(normalizeReportObject).filter(Boolean);
    if (storedReports.length > 0) {
        if (typeof window.syncFinalizedReports === 'function') {
            window.syncFinalizedReports(storedReports);
        } else if (typeof window.setFinalizedReportsInMemory === 'function') {
            // Compatibilidade com nome antigo
            window.setFinalizedReportsInMemory(storedReports);
        }
    }

    // 2. Tenta sincronizar do Supabase em segundo plano (Não-bloqueante)
    if (isSupabaseConfigured) {
        syncAllFromSupabase().then(() => {
            console.log('SUPABASE: Carregamento em segundo plano concluído. Atualizando visões...');
            isInitialLoad = false; // Permite sincronizações futuras de salvamento
            if (typeof window.renderCompanies === 'function') window.renderCompanies();
            if (typeof window.renderAssets === 'function') window.renderAssets();
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
export let usersList = getStoredData('crane_users', []);

export function setUsersList(newList) {
    usersList = newList;
    setStoredData('crane_users', usersList);
}
