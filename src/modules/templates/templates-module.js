// Crane Pro - Módulo de Gerenciamento de Modelos (Templates)

import { dbFetchAll, dbUpsert, dbDelete, isSupabaseConfigured } from '../../supabase.js';
import { getDBValue, setDBValue } from '../../data.js';

let templatesList = [];

/**
 * Retorna a lista atual de modelos em memória
 */
export function getTemplates() {
    return templatesList;
}

/**
 * Busca um modelo por ID
 */
export function getTemplateById(id) {
    if (!id) return null;
    return templatesList.find(t => String(t.id) === String(id)) || null;
}

/**
 * Carrega e sincroniza os modelos do Supabase e IndexedDB
 */
export async function loadTemplates() {
    let loadedTemplates = [];

    // Tenta carregar do IndexedDB / Cache local
    const localTemplates = await getDBValue('crane_templates', []);
    if (Array.isArray(localTemplates)) {
        loadedTemplates = localTemplates;
    }

    // Se o Supabase estiver configurado, realiza a sincronização relacional
    if (isSupabaseConfigured) {
        try {
            const [dbTemplates, dbItems, dbChecklists] = await Promise.all([
                dbFetchAll('crane_templates'),
                dbFetchAll('crane_template_items'),
                dbFetchAll('crane_template_checklist_items')
            ]);

            if (Array.isArray(dbTemplates)) {
                const mapped = dbTemplates.map(t => {
                    const items = (dbItems || [])
                        .filter(i => String(i.template_id) === String(t.id))
                        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                        .map(i => {
                            const checklists = (dbChecklists || [])
                                .filter(c => String(c.template_item_id) === String(i.id))
                                .sort((a, b) => (a.ordem || 0) - (b.ordem || 0))
                                .map(c => ({
                                    id: c.id,
                                    descricao: c.descricao,
                                    ordem: c.ordem
                                }));

                            return {
                                id: i.id,
                                nome: i.nome,
                                specialType: i.special_type || i.specialType || null,
                                extraObservations: i.extra_observations || i.extraObservations || 0,
                                ordem: i.ordem,
                                checklists: checklists
                            };
                        });

                    return {
                        id: t.id,
                        nome: t.nome,
                        createdBy: t.created_by || 'Sistema',
                        createdAt: t.created_at || new Date().toISOString(),
                        updatedAt: t.updated_at || new Date().toISOString(),
                        items: items
                    };
                });

                if (mapped.length > 0) {
                    loadedTemplates = mapped;
                }
            }
        } catch (e) {
            console.warn("CRANE PRO TEMPLATES: Erro ao sincronizar com Supabase, usando cache local:", e);
        }
    }

    templatesList = loadedTemplates;
    await setDBValue('crane_templates', templatesList);
    return templatesList;
}

/**
 * Valida os dados de um modelo antes de salvar
 */
export function validateTemplate(templateData) {
    if (!templateData || typeof templateData !== 'object') {
        return { valid: false, error: 'Dados do modelo inválidos.' };
    }

    const nome = (templateData.nome || '').trim();
    if (!nome) {
        return { valid: false, error: 'Informe o nome do modelo.' };
    }

    const items = templateData.items || [];
    if (!Array.isArray(items) || items.length === 0) {
        return { valid: false, error: 'O modelo deve conter pelo menos 1 item.' };
    }

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const itemNome = (item.nome || '').trim();
        if (!itemNome) {
            return { valid: false, error: `Informe o nome do item ${i + 1}.` };
        }

        const checklists = item.checklists || [];
        if (Array.isArray(checklists)) {
            for (let j = 0; j < checklists.length; j++) {
                const desc = (checklists[j].descricao || '').trim();
                if (!desc) {
                    return { valid: false, error: `Preencha a descrição da verificação ${j + 1} no item "${itemNome}".` };
                }
            }
        }
    }

    return { valid: true };
}

/**
 * Salva ou atualiza um modelo (LocalDB + Supabase)
 */
export async function saveTemplate(templateData, currentUser = 'Usuário') {
    const validation = validateTemplate(templateData);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const now = new Date().toISOString();
    const id = templateData.id || `tpl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const templateRecord = {
        id: id,
        nome: templateData.nome.trim(),
        createdBy: templateData.createdBy || currentUser,
        createdAt: templateData.createdAt || now,
        updatedAt: now,
        items: (templateData.items || []).map((item, idx) => ({
            id: item.id || `item_${Date.now()}_${idx}_${Math.random().toString(36).substr(2, 4)}`,
            nome: item.nome.trim(),
            specialType: item.specialType || null,
            extraObservations: item.extraObservations || 0,
            ordem: idx + 1,
            checklists: (item.checklists || []).map((chk, chkIdx) => ({
                id: chk.id || `chk_${Date.now()}_${idx}_${chkIdx}_${Math.random().toString(36).substr(2, 4)}`,
                descricao: chk.descricao.trim(),
                ordem: chkIdx + 1
            }))
        }))
    };

    // Atualiza lista em memória
    const existingIdx = templatesList.findIndex(t => String(t.id) === String(id));
    if (existingIdx !== -1) {
        templatesList[existingIdx] = templateRecord;
    } else {
        templatesList.unshift(templateRecord);
    }

    // Persiste no IndexedDB
    await setDBValue('crane_templates', templatesList);

    // Persiste no Supabase (se configurado)
    if (isSupabaseConfigured) {
        try {
            // Upsert modelo principal
            await dbUpsert('crane_templates', {
                id: templateRecord.id,
                nome: templateRecord.nome,
                created_by: templateRecord.createdBy,
                created_at: templateRecord.createdAt,
                updated_at: templateRecord.updatedAt
            });

            // 1. Limpeza atômica de itens e verificações excluídos pelo usuário
            const [existingDbItems, existingDbChecklists] = await Promise.all([
                dbFetchAll('crane_template_items'),
                dbFetchAll('crane_template_checklist_items')
            ]);

            const templateDbItems = (existingDbItems || []).filter(i => String(i.template_id) === String(templateRecord.id));
            const currentItemIds = new Set(templateRecord.items.map(i => String(i.id)));

            // Deleta itens que foram removidos do modelo
            for (const oldItem of templateDbItems) {
                if (!currentItemIds.has(String(oldItem.id))) {
                    await dbDelete('crane_template_items', 'id', String(oldItem.id));
                    await dbDelete('crane_template_checklist_items', 'template_item_id', String(oldItem.id));
                }
            }

            // Deleta verificações que foram removidas dos itens restantes
            for (const item of templateRecord.items) {
                const itemDbChecklists = (existingDbChecklists || []).filter(c => String(c.template_item_id) === String(item.id));
                const currentChkIds = new Set(item.checklists.map(c => String(c.id)));
                for (const oldChk of itemDbChecklists) {
                    if (!currentChkIds.has(String(oldChk.id))) {
                        await dbDelete('crane_template_checklist_items', 'id', String(oldChk.id));
                    }
                }
            }

            // 2. Prepara registros relacionais de itens e checklists atualizados
            const dbItemsPayload = [];
            const dbChecklistsPayload = [];

            templateRecord.items.forEach(item => {
                dbItemsPayload.push({
                    id: item.id,
                    template_id: templateRecord.id,
                    nome: item.nome,
                    ordem: item.ordem,
                    created_at: templateRecord.createdAt,
                    updated_at: templateRecord.updatedAt
                });

                item.checklists.forEach(chk => {
                    dbChecklistsPayload.push({
                        id: chk.id,
                        template_item_id: item.id,
                        descricao: chk.descricao,
                        ordem: chk.ordem,
                        created_at: templateRecord.createdAt,
                        updated_at: templateRecord.updatedAt
                    });
                });
            });

            if (dbItemsPayload.length > 0) {
                await dbUpsert('crane_template_items', dbItemsPayload);
            }
            if (dbChecklistsPayload.length > 0) {
                await dbUpsert('crane_template_checklist_items', dbChecklistsPayload);
            }
        } catch (e) {
            console.error("CRANE PRO TEMPLATES: Erro ao persistir modelo no Supabase:", e);
            throw new Error(`Falha ao sincronizar modelo na nuvem: ${e.message || 'Erro no Supabase'}`);
        }
    }

    return templateRecord;
}

/**
 * Duplica um modelo existente gerando cópia independente
 */
export async function duplicateTemplate(id, currentUser = 'Usuário') {
    const original = getTemplateById(id);
    if (!original) {
        throw new Error('Modelo original não encontrado.');
    }

    const clonedData = {
        nome: `${original.nome} (Cópia)`,
        createdBy: currentUser,
        items: original.items.map(item => ({
            nome: item.nome,
            specialType: item.specialType || null,
            extraObservations: item.extraObservations || 0,
            checklists: item.checklists.map(chk => ({
                descricao: chk.descricao
            }))
        }))
    };

    return await saveTemplate(clonedData, currentUser);
}

/**
 * Exclui um modelo
 */
export async function deleteTemplate(id) {
    if (!id) return false;

    // Remove localmente
    templatesList = templatesList.filter(t => String(t.id) !== String(id));
    await setDBValue('crane_templates', templatesList);

    // Remove do Supabase com exclusão de filhos em cascata
    if (isSupabaseConfigured) {
        try {
            const existingDbItems = (await dbFetchAll('crane_template_items')) || [];
            const templateDbItems = existingDbItems.filter(i => String(i.template_id) === String(id));
            for (const item of templateDbItems) {
                await dbDelete('crane_template_checklist_items', 'template_item_id', String(item.id));
            }
            await dbDelete('crane_template_items', 'template_id', String(id));
            await dbDelete('crane_templates', 'id', String(id));
        } catch (e) {
            console.error("CRANE PRO TEMPLATES: Erro ao excluir modelo do Supabase:", e);
        }
    }

    return true;
}

/**
 * Converte o modelo do usuário para a estrutura CHECKLIST_SCHEMA do CRANE PRO
 * Compatível com renderização de formulário e geração de PDF.
 */
export function convertTemplateToChecklistSchema(template) {
    if (!template || !Array.isArray(template.items)) return [];

    return template.items.map((item, itemIdx) => {
        const sectionNum = itemIdx + 1;
        const itemTitleRaw = item.nome ? item.nome.trim() : `ITEM ${sectionNum}`;
        const cleanTitle = itemTitleRaw.replace(/^(\d+(?:\.\d+)*\s*[-–.]*\s*)/, '').trim();
        const mainSectionTitle = `${sectionNum} ${cleanTitle || itemTitleRaw}`;

        const isCableComposite = item.specialType === 'cableComposite' ||
            item.specialType === 'cableTable' ||
            (item.specialType !== 'none' && !/tambor|bloco|5\.5|6\.5|5\.8|6\.8/i.test(itemTitleRaw) && (
                /^5\.6\b/.test(itemTitleRaw) ||
                /^6\.6\b/.test(itemTitleRaw) ||
                /^5\.6\.1\b/.test(itemTitleRaw) ||
                /^6\.6\.1\b/.test(itemTitleRaw) ||
                /^cabo\s+de\s+a[çc]o/i.test(cleanTitle)
            ));

        const isHookComposite = item.specialType === 'hookComposite' ||
            item.specialType === 'hookTable' ||
            (item.specialType !== 'none' && !/bloco\s+superior|5\.8|6\.8/i.test(itemTitleRaw) && (
                /^5\.7\b/.test(itemTitleRaw) ||
                /^6\.7\b/.test(itemTitleRaw) ||
                /^5\.7\.2\b/.test(itemTitleRaw) ||
                /^6\.7\.2\b/.test(itemTitleRaw) ||
                /^moit[aã]o/i.test(cleanTitle) ||
                /^conjunto\s+de\s+caixa\s+de\s+gancho\s*\(moit[aã]o\)/i.test(cleanTitle)
            ));

        if (isCableComposite) {
            const prefix = `tpl_${template.id || 'cust'}_i${sectionNum}_cabo_aco`;
            const cableTableLabels = [
                'ARAMES ROMPIDOS',
                'BITOLA DO CABO',
                'DIÂMETRO CONFORME CATÁLOGO DE REFERÊNCIA (CIMAF/SIMILAR)',
                'DIÂMETRO VALOR MEDIDO',
                'REDUÇÃO DO DIÂMETRO EM PORCENTAGEM (7% MÁXIMO CONFORME NORMA)',
                'CORROSÃO',
                'DEFORMAÇÃO OU DANOS',
                'GRAU ACUMULATIVO DE DETERIORAÇÃO',
                'OBSERVAÇÕES',
                'TABELA NBR ISO 4309',
                'TABELA DE INSPEÇÃO DO CABO DE AÇO (NBR ISO 4309)'
            ];

            const filteredChecklists = (item.checklists || []).filter(chk => {
                const d = (chk.descricao || '').trim().toUpperCase();
                return !cableTableLabels.some(tblLbl => d === tblLbl || d.startsWith('CORROSÃO GRAU') || d.startsWith('DEFORMAÇÃO OU DANOS GRAU') || d.startsWith('GRAU ACUMULATIVO'));
            });

            const inspectableChildren = (filteredChecklists.length > 0 ? filteredChecklists : [
                { descricao: 'Fixação e ancoragem do cabo de aço' },
                { descricao: 'Ausência de desgaste dentro do limite aceitável pela norma NBR ISO 4309;' },
                { descricao: 'Ausência de esmagamento/engaiolamento' }
            ]).map((chk, chkIdx) => ({
                id: `${prefix}_chk_${chkIdx + 1}`,
                label: chk.descricao.trim(),
                fieldType: 'inspectable'
            }));

            return {
                id: prefix,
                title: mainSectionTitle,
                level: 1,
                specialType: 'cableComposite',
                inspectable: false,
                children: [
                    ...inspectableChildren,
                    { id: `${prefix}.arames`, label: 'Arames rompidos', fieldType: 'text' },
                    { id: `${prefix}.bitola`, label: 'Bitola do Cabo', fieldType: 'text' },
                    { id: `${prefix}.diametro`, label: 'Diâmetro conforme catálogo de referência (Cimaf/similar)', fieldType: 'text' },
                    { id: `${prefix}.diametro_medido`, label: 'DIÂMETRO VALOR MEDIDO', fieldType: 'text' },
                    { id: `${prefix}.reducao`, label: 'Redução do diâmetro em porcentagem (7% máximo conforme norma)', fieldType: 'text' },
                    { id: `${prefix}.corrosao`, label: 'Corrosão Grau 1 = ok; 2 = leve; 3 = médio; 4 = alto; 5 = Substituição', fieldType: 'text' },
                    { id: `${prefix}.danos`, label: 'Deformação ou Danos Grau 1 = ok; 2 = leve; 3 = médio; 4 = alto; 5 = Substituição', fieldType: 'text' },
                    { id: `${prefix}.deterioracao`, label: 'Grau acumulativo de deterioração 1 = ok; 2 = leve; 3 = médio; 4 = alto; 5 = Substituição', fieldType: 'text' },
                    { id: `${prefix}.observacoes`, label: 'Observações', fieldType: 'textarea' }
                ]
            };
        }

        if (isHookComposite) {
            const prefix = `tpl_${template.id || 'cust'}_i${sectionNum}_moitao`;
            const hookTableLabels = [
                'ABERTURA DO GANCHO',
                'LÍQUIDO PENETRANTE',
                'PROTEÇÃO DE PARTES MÓVEIS',
                'GANCHO CONFORME DIN 15400',
                'INDICAÇÃO DE CAPACIDADE',
                'OBSERVAÇÕES',
                'TABELA DE INSPEÇÃO DO MOITÃO (DIN 15400)'
            ];

            const filteredChecklists = (item.checklists || []).filter(chk => {
                const d = (chk.descricao || '').trim().toUpperCase();
                return !hookTableLabels.includes(d);
            });

            const inspectableChildren = (filteredChecklists.length > 0 ? filteredChecklists : [
                { descricao: 'Abertura e torção frontal dentro do limite aceitável DIN 15405.' },
                { descricao: 'Ausência de desgaste nas Roldanas com proteção de partes móveis' },
                { descricao: 'Ausência de trincas e fissuras' },
                { descricao: 'Ausência de desgastes no canal da polia' },
                { descricao: 'Rolamentos da polia ausência de folgas, ruídos e a rotação está livre' },
                { descricao: 'Mancal giratório lubrificação e rotação' },
                { descricao: 'Trava de segurança' }
            ]).map((chk, chkIdx) => ({
                id: `${prefix}_chk_${chkIdx + 1}`,
                label: chk.descricao.trim(),
                fieldType: 'inspectable'
            }));

            return {
                id: prefix,
                title: mainSectionTitle,
                level: 1,
                specialType: 'hookComposite',
                inspectable: false,
                children: [
                    ...inspectableChildren,
                    { id: `${prefix}.gancho_abertura`, label: 'Abertura do Gancho', fieldType: 'text' },
                    { id: `${prefix}.penetrante`, label: 'Líquido Penetrante', fieldType: 'text' },
                    { id: `${prefix}.protecao`, label: 'Proteção de Partes Móveis', fieldType: 'text' },
                    { id: `${prefix}.din`, label: 'Gancho conforme DIN 15400', fieldType: 'text' },
                    { id: `${prefix}.capacidade`, label: 'Indicação de Capacidade', fieldType: 'text' },
                    { id: `${prefix}.observacoes`, label: 'Observações', fieldType: 'textarea' }
                ]
            };
        }

        const inspectableChildren = (item.checklists || []).map((chk, chkIdx) => {
            const fieldId = `tpl_${template.id || 'cust'}_i${sectionNum}_c${chkIdx + 1}`;
            return {
                id: fieldId,
                label: chk.descricao.trim(),
                fieldType: 'inspectable'
            };
        });

        return {
            id: String(sectionNum),
            title: mainSectionTitle,
            level: 1,
            inspectable: false,
            children: inspectableChildren
        };
    });
}

// ============================================================================
// MODELOS DE ATIVOS (EQUIPAMENTOS / FICHA TÉCNICA DINÂMICA)
// ============================================================================

let assetTemplatesList = [];

/**
 * Retorna a lista atual de modelos de ativos em memória
 */
export function getAssetTemplates() {
    return assetTemplatesList;
}

/**
 * Busca um modelo de ativo por ID
 */
export function getAssetTemplateById(id) {
    if (!id) return null;
    return assetTemplatesList.find(t => String(t.id) === String(id)) || null;
}

export const DEFAULT_ASSET_TEMPLATES = [
    {
        id: 'asstpl_talha_manual',
        nome: 'TALHA MANUAL',
        descricao: 'Ficha técnica padrão para talhas manuais',
        tipoEquipamento: 'TALHA MANUAL',
        createdBy: 'Sistema',
        createdAt: '2026-08-19T00:00:00.000Z',
        updatedAt: '2026-08-19T00:00:00.000Z',
        customFields: []
    }
];

/**
 * Carrega e sincroniza os modelos de ativos do Supabase e IndexedDB
 */
export async function loadAssetTemplates() {
    let loaded = [];

    // 1. Tenta carregar do IndexedDB
    const local = await getDBValue('crane_asset_templates', []);
    if (Array.isArray(local) && local.length > 0) {
        loaded = local;
    } else if (typeof localStorage !== 'undefined') {
        const rawLocal = localStorage.getItem('crane_asset_templates');
        if (rawLocal) {
            try {
                const parsed = JSON.parse(rawLocal);
                if (Array.isArray(parsed) && parsed.length > 0) loaded = parsed;
            } catch (_) {}
        }
    }

    // 2. Se o Supabase estiver disponível, tenta buscar da tabela crane_asset_templates
    if (isSupabaseConfigured) {
        try {
            const dbList = await dbFetchAll('crane_asset_templates');
            if (Array.isArray(dbList) && dbList.length > 0) {
                loaded = dbList.map(t => ({
                    id: t.id,
                    nome: t.nome,
                    descricao: t.descricao || '',
                    tipoEquipamento: t.tipo_equipamento || t.tipoEquipamento || 'PONTE ROLANTE',
                    createdBy: t.created_by || 'Sistema',
                    createdAt: t.created_at || new Date().toISOString(),
                    updatedAt: t.updated_at || new Date().toISOString(),
                    customFields: Array.isArray(t.custom_fields) ? t.custom_fields : (typeof t.custom_fields === 'string' ? JSON.parse(t.custom_fields) : (t.customFields || []))
                }));
            }
        } catch (e) {
            console.warn("CRANE ASSET TEMPLATES: Erro ao sincronizar com Supabase, usando cache local:", e);
        }
    }

    assetTemplatesList = loaded;
    await setDBValue('crane_asset_templates', assetTemplatesList);
    try {
        localStorage.setItem('crane_asset_templates', JSON.stringify(assetTemplatesList));
    } catch (_) {}
    return assetTemplatesList;
}

/**
 * Valida dados de um modelo de ativo
 */
export function validateAssetTemplate(templateData) {
    if (!templateData || typeof templateData !== 'object') {
        return { valid: false, error: 'Dados do modelo de ativo inválidos.' };
    }

    const nome = (templateData.nome || '').trim();
    if (!nome) {
        return { valid: false, error: 'Informe o nome do modelo de ativo.' };
    }

    const customFields = templateData.customFields || [];
    if (!Array.isArray(customFields)) {
        return { valid: false, error: 'Formato inválido de campos personalizados.' };
    }

    for (let i = 0; i < customFields.length; i++) {
        const f = customFields[i];
        if (!f.label || !f.label.trim()) {
            return { valid: false, error: `Informe o rótulo do campo ${i + 1}.` };
        }
    }

    return { valid: true };
}

/**
 * Salva ou atualiza um modelo de ativo
 */
export async function saveAssetTemplate(templateData, currentUser = 'Usuário') {
    const validation = validateAssetTemplate(templateData);
    if (!validation.valid) {
        throw new Error(validation.error);
    }

    const now = new Date().toISOString();
    const id = templateData.id || `asstpl_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;

    const customFields = (templateData.customFields || []).map((f, idx) => ({
        id: f.id || `cf_${idx + 1}_${(f.label || '').toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
        label: (f.label || '').trim().toUpperCase(),
        type: (f.type || 'text').toLowerCase() // 'text', 'number', 'date'
    }));

    const record = {
        id: id,
        nome: templateData.nome.trim().toUpperCase(),
        descricao: (templateData.descricao || '').trim(),
        tipoEquipamento: (templateData.tipoEquipamento || 'PONTE ROLANTE').trim().toUpperCase(),
        createdBy: templateData.createdBy || currentUser,
        createdAt: templateData.createdAt || now,
        updatedAt: now,
        customFields: customFields
    };

    const existingIdx = assetTemplatesList.findIndex(t => String(t.id) === String(id));
    if (existingIdx >= 0) {
        assetTemplatesList[existingIdx] = record;
    } else {
        assetTemplatesList.push(record);
    }

    await setDBValue('crane_asset_templates', assetTemplatesList);
    try {
        localStorage.setItem('crane_asset_templates', JSON.stringify(assetTemplatesList));
    } catch (_) {}

    if (isSupabaseConfigured) {
        try {
            await dbUpsert('crane_asset_templates', [{
                id: record.id,
                nome: record.nome,
                descricao: record.descricao,
                tipo_equipamento: record.tipoEquipamento,
                created_by: record.createdBy,
                created_at: record.createdAt,
                updated_at: record.updatedAt,
                custom_fields: record.customFields
            }]);
        } catch (e) {
            console.warn("CRANE ASSET TEMPLATES: Erro ao persistir no Supabase (operando localmente):", e);
        }
    }

    return record;
}

/**
 * Duplica um modelo de ativo existente
 */
export async function duplicateAssetTemplate(templateId, currentUser = 'Usuário') {
    const original = getAssetTemplateById(templateId);
    if (!original) {
        throw new Error('Modelo de ativo original não encontrado.');
    }

    const clonedData = {
        nome: `${original.nome} (Cópia)`,
        descricao: original.descricao || '',
        tipoEquipamento: original.tipoEquipamento || 'PONTE ROLANTE',
        customFields: JSON.parse(JSON.stringify(original.customFields || []))
    };

    return await saveAssetTemplate(clonedData, currentUser);
}

/**
 * Exclui um modelo de ativo
 */
export async function deleteAssetTemplate(templateId) {
    if (!templateId) return;

    assetTemplatesList = assetTemplatesList.filter(t => String(t.id) !== String(templateId));
    await setDBValue('crane_asset_templates', assetTemplatesList);
    try {
        localStorage.setItem('crane_asset_templates', JSON.stringify(assetTemplatesList));
    } catch (_) {}

    if (isSupabaseConfigured) {
        try {
            await dbDelete('crane_asset_templates', 'id', templateId);
        } catch (e) {
            console.warn("CRANE ASSET TEMPLATES: Erro ao excluir no Supabase (excluído localmente):", e);
        }
    }
}

