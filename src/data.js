// Crane Pro - Data Layer

import { isSupabaseConfigured, dbFetchAll, dbUpsert, dbDelete } from './supabase.js';

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

/**
 * Envia alterações de uma chave local para a tabela correspondente no Supabase
 */
export async function syncKeyToSupabase(key, data) {
    if (!isSupabaseConfigured) return;
    try {
        if (key === 'crane_companies') {
            // Sincronizar exclusões primeiro
            const dbList = await dbFetchAll('companies');
            if (dbList) {
                const newKeys = new Set(data.map(item => item.name));
                const toDelete = dbList.filter(item => !newKeys.has(item.name));
                for (const item of toDelete) {
                    await dbDelete('companies', 'name', item.name);
                }
            }

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
            // Sincronizar exclusões primeiro
            const dbList = await dbFetchAll('all_assets');
            if (dbList) {
                const newKeys = new Set(data.map(item => item.id));
                const toDelete = dbList.filter(item => !newKeys.has(item.id));
                for (const item of toDelete) {
                    await dbDelete('all_assets', 'id', item.id);
                }
            }

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
            // Sincronizar exclusões primeiro
            const dbList = await dbFetchAll('users');
            if (dbList) {
                const newKeys = new Set(data.map(item => item.id));
                const toDelete = dbList.filter(item => !newKeys.has(item.id));
                for (const item of toDelete) {
                    await dbDelete('users', 'id', item.id);
                }
            }

            const rows = data.map(u => ({
                id: u.id,
                name: u.name,
                email: u.email,
                password: u.password,
                permission: u.permission
            }));
            await dbUpsert('users', rows);
        } else if (key === 'crane_events') {
            // Sincronizar exclusões primeiro
            const dbList = await dbFetchAll('scheduled_inspections');
            if (dbList) {
                const newKeys = new Set(data.map(item => String(item.id)));
                const toDelete = dbList.filter(item => !newKeys.has(String(item.id)));
                for (const item of toDelete) {
                    await dbDelete('scheduled_inspections', 'id', item.id);
                }
            }

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
            // Sincronizar exclusões primeiro
            const dbList = await dbFetchAll('open_orders');
            if (dbList) {
                const newKeys = new Set(data.map(item => item.id));
                const toDelete = dbList.filter(item => !newKeys.has(item.id));
                for (const item of toDelete) {
                    await dbDelete('open_orders', 'id', item.id);
                }
            }

            const rows = data.map(o => ({
                id: o.id,
                status: o.status || '',
                type: o.type || '',
                empresa: o.empresa || '',
                equipamentoId: o.equipamentoId || '',
                equipamentoNome: o.equipamentoNome || '',
                assetInfo: o.assetInfo || '',
                date: o.date || '',
                createdAt: o.createdAt || new Date().toISOString(),
                updatedAt: o.updatedAt || new Date().toISOString(),
                responses: o.responses || {},
                generalObservation: o.generalObservation || '',
                generalImages: o.generalImages || [],
                customSections: o.customSections || []
            }));
            await dbUpsert('open_orders', rows);
        } else if (key === 'crane_reports') {
            // Sincronizar exclusões primeiro
            const dbList = await dbFetchAll('finalized_reports');
            if (dbList) {
                const newKeys = new Set(data.map(item => item.id));
                const toDelete = dbList.filter(item => !newKeys.has(item.id));
                for (const item of toDelete) {
                    await dbDelete('finalized_reports', 'id', item.id);
                }
            }

            const rows = data.map(r => ({
                id: r.id,
                status: r.status || '',
                type: r.type || '',
                empresa: r.empresa || '',
                equipamentoId: r.equipamentoId || '',
                equipamentoNome: r.equipamentoNome || '',
                assetInfo: r.assetInfo || '',
                date: r.date || '',
                createdAt: r.createdAt || new Date().toISOString(),
                updatedAt: r.updatedAt || new Date().toISOString(),
                responses: r.responses || {},
                generalObservation: r.generalObservation || '',
                generalImages: r.generalImages || [],
                customSections: r.customSections || []
            }));
            await dbUpsert('finalized_reports', rows);
        } else if (key === 'crane_internal_company') {
            const row = {
                id: 1, // Mantém registro único
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
 * Puxa todos os dados do Supabase e atualiza o banco local
 */
export async function syncAllFromSupabase() {
    if (!isSupabaseConfigured) return;
    try {
        console.log('SUPABASE: Carregando dados da nuvem...');

        // 1. Companies
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

        // 2. All Assets
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

        // 3. Users
        let dbUsers = await dbFetchAll('users');
        if (!dbUsers || dbUsers.length === 0) {
            console.log('SUPABASE: Tabela de usuários vazia na nuvem. Migrando dados locais...');
            const localUsers = usersList && usersList.length > 0 ? usersList : getStoredData('crane_users', []);
            if (localUsers.length > 0) {
                await syncKeyToSupabase('crane_users', localUsers);
                dbUsers = localUsers;
            }
        }
        if (dbUsers && dbUsers.length > 0) {
            usersList = dbUsers;
            localStorage.setItem('crane_users', JSON.stringify(usersList));
            await setDBValue('crane_users', usersList);
        }

        // 4. Scheduled Inspections (Events)
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

        // 5. Open Orders
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
            localStorage.setItem('crane_open_orders', JSON.stringify(dbOpenOrders));
            await setDBValue('crane_open_orders', dbOpenOrders);
        }

        // 6. Finalized Reports
        let dbFinalizedReports = await dbFetchAll('finalized_reports');
        if (!dbFinalizedReports || dbFinalizedReports.length === 0) {
            console.log('SUPABASE: Tabela de relatórios finalizados vazia na nuvem. Sincronizando dados locais...');
            const localReports = getStoredData('crane_reports', []);
            if (localReports.length > 0) {
                await syncKeyToSupabase('crane_reports', localReports);
                dbFinalizedReports = localReports;
            }
        }
        if (dbFinalizedReports) {
            localStorage.setItem('crane_reports', JSON.stringify(dbFinalizedReports));
            await setDBValue('crane_reports', dbFinalizedReports);
        }

        // 7. Internal Company
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

        console.log('SUPABASE: Sincronização e migração concluídas com sucesso!');
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

export let companies = normalizeCompanies(getStoredData('crane_companies', [
    { name: "Mineradora Vale", cnpj: "33.592.510/0001-54", endereco: "AV. DAS NAÇÕES", numero: "1000", bairro: "DISTRITO INDUSTRIAL", cep: "34006-056", cidade: "CONGONHAS", estado: "MG", logo: "" },
    { name: "Porto Brasil", cnpj: "99.888.777/0001-11", endereco: "AV. PORTUÁRIA", numero: "S/N", bairro: "CAIS DO PORTO", cep: "11000-000", cidade: "SANTOS", estado: "SP", logo: "" }
])).sort((a, b) => a.name.localeCompare(b.name));

export function setCompanies(newList) {
    companies = normalizeCompanies(newList).sort((a, b) => a.name.localeCompare(b.name));
    setStoredData('crane_companies', companies);
}

const initialAssets = [
    {
        id: "#EQP-2093",
        empresa: "Mineradora Vale",
        nome: "GUINDASTE DE COLUNA",
        tipo: "GUINDASTE DE COLUNA",
        local: "SETOR MINA SUL",
        fabricante: "LIEBHERR",
        capacidade: "20.00 TON",
        caboPrincipal: "16MM",
        capacidadeAuxiliar: "5.00 TON",
        caboAuxiliar: "10MM",
        altura: "60.00 MTS",
        vao: "40.00 MTS",
        tensaoAlimentacao: "440V",
        tensaoComando: "24V",
        alimentacaoEquipamento: "BARRAMENTO",
        motorElevPrincipalAlta: "22 kW / 45 A",
        motorElevPrincipalBaixa: "3.7 kW / 9 A",
        motorElevAuxiliarAlta: "7.5 kW / 15 A",
        motorElevAuxiliarBaixa: "1.2 kW / 3 A",
        motorDirecaoCarro: "2.2 kW / 5.5 A",
        motorTranslacaoPonte: "2x 5.5 kW / 12 A"
    },
    {
        id: "#EQP-4482",
        empresa: "Mineradora Vale",
        nome: "PONTE ROLANTE",
        tipo: "PONTE ROLANTE",
        local: "PÁTIO DE APOIO C",
        fabricante: "DEMAG",
        capacidade: "15.00 TON",
        caboPrincipal: "12MM",
        capacidadeAuxiliar: "3.00 TON",
        caboAuxiliar: "8MM",
        altura: "9.00 MTS",
        vao: "18.00 MTS",
        tensaoAlimentacao: "380V",
        tensaoComando: "24V",
        alimentacaoEquipamento: "FESTOON",
        motorElevPrincipalAlta: "11 kW / 23 A",
        motorElevPrincipalBaixa: "1.8 kW / 5 A",
        motorElevAuxiliarAlta: "4.0 kW / 9.5 A",
        motorElevAuxiliarBaixa: "0.7 kW / 2 A",
        motorDirecaoCarro: "1.1 kW / 3 A",
        motorTranslacaoPonte: "2x 2.2 kW / 5.5 A"
    },
    {
        id: "#EQP-9001",
        empresa: "Mineradora Vale",
        nome: "SEMIPÓRTICO",
        tipo: "SEMIPÓRTICO",
        local: "SETOR ENERGIA",
        fabricante: "CUMMINS",
        capacidade: "10.00 TON",
        caboPrincipal: "10MM",
        capacidadeAuxiliar: "2.00 TON",
        caboAuxiliar: "6MM",
        altura: "6.00 MTS",
        vao: "12.00 MTS",
        tensaoAlimentacao: "380V",
        tensaoComando: "24V",
        alimentacaoEquipamento: "FESTOON",
        motorElevPrincipalAlta: "7.5 kW / 16 A",
        motorElevPrincipalBaixa: "1.2 kW / 3.5 A",
        motorElevAuxiliarAlta: "3.0 kW / 7.5 A",
        motorElevAuxiliarBaixa: "0.5 kW / 1.5 A",
        motorDirecaoCarro: "0.75 kW / 2.2 A",
        motorTranslacaoPonte: "2x 1.5 kW / 4 A"
    },
    {
        id: "#EQP-5522",
        empresa: "Porto Brasil",
        nome: "PÓRTICO",
        tipo: "PÓRTICO",
        local: "DOCA 04",
        fabricante: "HYSTER",
        capacidade: "7.00 TON",
        caboPrincipal: "10MM",
        capacidadeAuxiliar: "2.00 TON",
        caboAuxiliar: "6MM",
        altura: "4.50 MTS",
        vao: "8.00 MTS",
        tensaoAlimentacao: "380V",
        tensaoComando: "24V",
        alimentacaoEquipamento: "ENROLADOR DE CABO",
        motorElevPrincipalAlta: "5.5 kW / 12 A",
        motorElevPrincipalBaixa: "0.9 kW / 2.5 A",
        motorElevAuxiliarAlta: "2.2 kW / 5.5 A",
        motorElevAuxiliarBaixa: "0.4 kW / 1.2 A",
        motorDirecaoCarro: "0.55 kW / 1.8 A",
        motorTranslacaoPonte: "2x 1.1 kW / 3 A"
    },
    {
        id: "#EQP-1122",
        empresa: "Porto Brasil",
        nome: "PÓRTICO",
        tipo: "PÓRTICO",
        local: "ARMAZÉM B",
        fabricante: "GH CRANES",
        capacidade: "25.00 TON",
        caboPrincipal: "18MM",
        capacidadeAuxiliar: "5.00 TON",
        caboAuxiliar: "10MM",
        altura: "12.00 MTS",
        vao: "22.00 MTS",
        tensaoAlimentacao: "440V",
        tensaoComando: "24V",
        alimentacaoEquipamento: "BARRAMENTO REBLINDADO",
        motorElevPrincipalAlta: "30 kW / 60 A",
        motorElevPrincipalBaixa: "5.0 kW / 12 A",
        motorElevAuxiliarAlta: "7.5 kW / 15 A",
        motorElevAuxiliarBaixa: "1.2 kW / 3 A",
        motorDirecaoCarro: "3.0 kW / 7.5 A",
        motorTranslacaoPonte: "2x 7.5 kW / 16 A"
    }
];

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

    const dbUsers = await getDBValue('crane_users', usersList);
    updateArrayInPlace(usersList, dbUsers);

    // 2. Tenta sincronizar do Supabase em segundo plano (Não-bloqueante)
    if (isSupabaseConfigured) {
        syncAllFromSupabase().then(() => {
            console.log('SUPABASE: Carregamento em segundo plano concluído. Atualizando visões...');
            if (typeof window.renderCompanies === 'function') window.renderCompanies();
            if (typeof window.renderAssets === 'function') window.renderAssets();
            if (typeof window.renderCalendar === 'function') window.renderCalendar();
            if (typeof window.renderOpenOrders === 'function') window.renderOpenOrders();
            if (typeof window.renderReportsView === 'function') window.renderReportsView();
        }).catch(err => {
            console.error('SUPABASE: Falha na sincronização em segundo plano:', err);
        });
    }
}

// Lista de Usuários Global
export let usersList = getStoredData('crane_users', [
    { id: 1, name: "MAYCON DIAS", email: "maycon@cranepro.com", password: "123456", permission: "ADMINISTRADOR" },
    { id: 2, name: "RODRIGO DE FREITAS", email: "rodrigo.freitas@cranepro.com.br", password: "123456", permission: "TECNICO" }
]);

export function setUsersList(newList) {
    usersList = newList;
    setStoredData('crane_users', usersList);
}
