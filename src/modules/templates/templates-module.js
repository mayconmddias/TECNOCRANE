// Crane Pro - Módulo de Gerenciamento de Modelos (Templates)

import { dbFetchAll, dbUpsert, dbDelete, isSupabaseConfigured } from '../../supabase.js';
import { getDBValue, setDBValue } from '../../data.js';
import { CHECKLIST_SCHEMA } from '../../checklist-schema.js';

export const SYSTEM_INSPECTION_TEMPLATE_ID = 'tpl_default_ponte_viga_dupla';
export const SYSTEM_ASSET_TEMPLATE_ID = 'asstpl_default_ponte_viga_dupla';

/**
 * Constrói os 10 itens padrão da Ponte Rolante Viga Dupla baseados no CHECKLIST_SCHEMA
 */
export function buildDefaultInspectionItems(schema = CHECKLIST_SCHEMA) {
    if (!Array.isArray(schema)) return [];
    return schema.map((mainSec, idx) => {
        const sectionNum = idx + 1;
        const mainTitleRaw = (mainSec.title || `ITEM ${sectionNum}`).replace(/<[^>]*>/g, ' ').trim();
        const cleanTitle = mainTitleRaw.replace(/^(\d+(?:\.\d+)*\s*[-–.]*\s*)/, '').trim();
        const nome = `${sectionNum}. ${cleanTitle.toUpperCase()}`;

        let specialType = null;
        if (sectionNum === 5 || sectionNum === 6) {
            specialType = 'cableComposite';
        }

        const checklists = [];

        function walk(nodes) {
            (nodes || []).forEach(n => {
                if (n.fieldType === 'inspectable') {
                    const label = (n.label || '').replace(/<[^>]*>/g, ' ').trim();
                    if (label) {
                        checklists.push({
                            id: `def_chk_${n.id || checklists.length + 1}`,
                            descricao: label.toUpperCase(),
                            ordem: checklists.length + 1
                        });
                    }
                } else if (n.children && Array.isArray(n.children)) {
                    walk(n.children);
                }
            });
        }

        walk(mainSec.children || []);

        if (checklists.length === 0) {
            checklists.push({
                id: `def_chk_${sectionNum}_1`,
                descricao: 'VERIFICAÇÃO OPERACIONAL E CONFORMIDADE GERAL',
                ordem: 1
            });
        }

        return {
            id: `def_item_${sectionNum}`,
            nome: nome,
            specialType: specialType,
            extraObservations: 0,
            ordem: sectionNum,
            checklists: checklists
        };
    });
}

export const SYSTEM_INSPECTION_TEMPLATE = {
    id: SYSTEM_INSPECTION_TEMPLATE_ID,
    nome: 'Formulario modelo Inspeção',
    isSystemDefault: true,
    createdBy: 'Sistema',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    items: buildDefaultInspectionItems(CHECKLIST_SCHEMA)
};

export const SYSTEM_ASSET_FIELDS = [
    { id: 'cf_1_alimentacao', label: 'ALIMENTAÇÃO DO EQUIPAMENTO', type: 'text' },
    { id: 'cf_2_cap_principal', label: 'CAPACIDADE DE PESO PRINCIPAL', type: 'number' },
    { id: 'cf_3_cabo_principal', label: 'DIÂMETRO DO CABO DE AÇO PRINCIPAL', type: 'text' },
    { id: 'cf_4_cap_auxiliar', label: 'CAPACIDADE DE PESO AUXILIAR', type: 'number' },
    { id: 'cf_5_cabo_auxiliar', label: 'DIÂMETRO DO CABO DE AÇO AUXILIAR', type: 'text' },
    { id: 'cf_6_altura_elevacao', label: 'ALTURA DE ELEVAÇÃO', type: 'number' },
    { id: 'cf_7_vao_ponte', label: 'VÃO DA PONTE', type: 'text' },
    { id: 'cf_8_tensao_alim', label: 'TENSÃO DE ALIMENTAÇÃO', type: 'text' },
    { id: 'cf_9_tensao_cmd', label: 'TENSÃO DE COMANDO', type: 'text' },
    { id: 'cf_10_mot_elev_prin_alta', label: 'MOTOR ELEVAÇÃO PRINCIPAL (VEL. ALTA)', type: 'text' },
    { id: 'cf_11_mot_elev_prin_baixa', label: 'MOTOR ELEVAÇÃO PRINCIPAL (VEL. BAIXA)', type: 'text' },
    { id: 'cf_12_mot_elev_aux_alta', label: 'MOTOR ELEVAÇÃO AUXILIAR (VEL. ALTA)', type: 'text' },
    { id: 'cf_13_mot_elev_aux_baixa', label: 'MOTOR ELEVAÇÃO AUXILIAR (VEL. BAIXA)', type: 'text' },
    { id: 'cf_14_mot_dir_carro', label: 'MOTOR DIREÇÃO CARRO', type: 'text' },
    { id: 'cf_15_mot_trans_ponte', label: 'MOTOR TRANSLAÇÃO PONTE', type: 'text' },
    { id: 'cf_16_local_setor', label: 'LOCAL / SETOR', type: 'text' },
    { id: 'cf_17_fabricante', label: 'FABRICANTE', type: 'text' },
    { id: 'cf_18_num_serie', label: 'NÚMERO DE SÉRIE', type: 'text' },
    { id: 'cf_19_ano_fab', label: 'ANO DE FABRICAÇÃO', type: 'text' },
    { id: 'cf_20_grupo_trab', label: 'CLASSIFICAÇÃO / GRUPO DE TRABALHO', type: 'text' },
    { id: 'cf_21_vel_elevacao', label: 'VELOCIDADE DE ELEVAÇÃO', type: 'text' }
];

export const SYSTEM_ASSET_TEMPLATE = {
    id: SYSTEM_ASSET_TEMPLATE_ID,
    nome: 'Formulário modelo Ativo',
    descricao: 'Modelo padrão para cadastro e especificações técnicas de Ponte Rolante Viga Dupla',
    tipoEquipamento: 'PONTE ROLANTE VIGA DUPLA',
    isSystemDefault: true,
    createdBy: 'Sistema',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    customFields: SYSTEM_ASSET_FIELDS
};

let templatesList = [];

/**
 * Retorna a lista atual de modelos em memória (sempre incluindo o modelo padrão do sistema)
 */
export function getTemplates() {
    const listWithoutSystem = templatesList.filter(t => String(t.id) !== SYSTEM_INSPECTION_TEMPLATE_ID);
    return [SYSTEM_INSPECTION_TEMPLATE, ...listWithoutSystem];
}

/**
 * Retorna apenas os modelos de inspeção criados por usuários (exclui o modelo padrão do sistema)
 */
export function getUserTemplates() {
    return (templatesList || []).filter(t => 
        String(t.id) !== SYSTEM_INSPECTION_TEMPLATE_ID && !t.isSystemDefault
    );
}

/**
 * Busca um modelo por ID
 */
export function getTemplateById(id) {
    if (!id) return null;
    if (String(id) === SYSTEM_INSPECTION_TEMPLATE_ID) {
        return SYSTEM_INSPECTION_TEMPLATE;
    }
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

    const items = templateData.items;
    if (!Array.isArray(items)) {
        return { valid: false, error: 'Lista de itens inválida.' };
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
    if (templateData && (String(templateData.id) === SYSTEM_INSPECTION_TEMPLATE_ID || templateData.isSystemDefault)) {
        throw new Error('O Formulario modelo Inspeção padrão do sistema não pode ser alterado.');
    }

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
    if (String(id) === SYSTEM_INSPECTION_TEMPLATE_ID) {
        console.warn("CRANE PRO: O Formulario modelo Inspeção padrão do sistema não pode ser excluído.");
        return false;
    }

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
 * Retorna a lista atual de modelos de ativos em memória (sempre incluindo o modelo padrão)
 */
export function getAssetTemplates() {
    const listWithoutSystem = assetTemplatesList.filter(t => String(t.id) !== SYSTEM_ASSET_TEMPLATE_ID);
    return [SYSTEM_ASSET_TEMPLATE, ...listWithoutSystem];
}

/**
 * Retorna apenas os modelos de ativos criados por usuários (exclui o modelo padrão do sistema)
 */
export function getUserAssetTemplates() {
    return (assetTemplatesList || []).filter(t => 
        String(t.id) !== SYSTEM_ASSET_TEMPLATE_ID && !t.isSystemDefault
    );
}

/**
 * Busca um modelo de ativo por ID
 */
export function getAssetTemplateById(id) {
    if (!id) return null;
    if (String(id) === SYSTEM_ASSET_TEMPLATE_ID) {
        return SYSTEM_ASSET_TEMPLATE;
    }
    return assetTemplatesList.find(t => String(t.id) === String(id)) || null;
}

export const DEFAULT_ASSET_TEMPLATES = [
    SYSTEM_ASSET_TEMPLATE
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
                    tipoEquipamento: t.tipo_equipamento || t.tipoEquipamento || 'PONTE ROLANTE VIGA DUPLA',
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
    return getAssetTemplates();
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
    if (templateData && (String(templateData.id) === SYSTEM_ASSET_TEMPLATE_ID || templateData.isSystemDefault)) {
        throw new Error('O Formulário modelo Ativo padrão do sistema não pode ser alterado.');
    }

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
        tipoEquipamento: (templateData.tipoEquipamento || 'PONTE ROLANTE VIGA DUPLA').trim().toUpperCase(),
        createdBy: templateData.createdBy || currentUser,
        createdAt: templateData.createdAt || now,
        updatedAt: now,
        customFields: customFields
    };

    const existingIdx = assetTemplatesList.findIndex(t => String(t.id) === String(id));
    const oldNome = existingIdx >= 0 ? assetTemplatesList[existingIdx].nome : null;

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

    // SINCRONIZAÇÃO OBRIGATÓRIA 1:1 COM MODELOS DE INSPEÇÃO (CHECKLIST)
    try {
        // 1. Se for alteração do nome do ativo, renomeia em cascata o modelo de inspeção correspondente
        if (oldNome && oldNome.trim().toUpperCase() !== record.nome.trim().toUpperCase()) {
            const linkedTemplate = templatesList.find(t =>
                t.nome && t.nome.trim().toUpperCase() === oldNome.trim().toUpperCase() &&
                String(t.id) !== SYSTEM_INSPECTION_TEMPLATE_ID
            );
            if (linkedTemplate) {
                linkedTemplate.nome = record.nome;
                await saveTemplate(linkedTemplate, currentUser);
            }
        }

        // 2. Garante que exista um formulário de inspeção com exatamente o mesmo nome, gerado LIMPO (items: [])
        const existsChecklist = templatesList.find(t =>
            t.nome && t.nome.trim().toUpperCase() === record.nome.trim().toUpperCase()
        );
        if (!existsChecklist) {
            const initialChecklist = {
                nome: record.nome,
                createdBy: record.createdBy || currentUser,
                createdAt: record.createdAt || now,
                items: [] // O formulário de inspeção vinculado deve vir LIMPO, conforme instrução do usuário!
            };
            await saveTemplate(initialChecklist, currentUser);
        }
    } catch (syncErr) {
        console.warn('CRANE ASSET TEMPLATES: Erro ao sincronizar modelo de inspeção correspondente:', syncErr);
    }

    return record;
}

/**
 * Duplica um modelo de ativo existente mantendo vinculo 1:1 com o checklist correspondente limpo
 */
export async function duplicateAssetTemplate(templateId, currentUser = 'Usuário') {
    const original = getAssetTemplateById(templateId);
    if (!original) {
        throw new Error('Modelo de ativo original não encontrado.');
    }

    const clonedData = {
        nome: `${original.nome} (CÓPIA)`,
        descricao: original.descricao || '',
        tipoEquipamento: original.tipoEquipamento || 'PONTE ROLANTE VIGA DUPLA',
        customFields: JSON.parse(JSON.stringify(original.customFields || []))
    };

    const newAsset = await saveAssetTemplate(clonedData, currentUser);
    return newAsset;
}

/**
 * Exclui um modelo de ativo e o respectivo formulário de inspeção vinculado em cascata
 */
export async function deleteAssetTemplate(templateId) {
    if (!templateId) return false;
    if (String(templateId) === SYSTEM_ASSET_TEMPLATE_ID) {
        console.warn("CRANE PRO: O Formulário modelo Ativo padrão do sistema não pode ser excluído.");
        return false;
    }

    const assetToDelete = getAssetTemplateById(templateId);
    const assetNome = assetToDelete ? assetToDelete.nome : null;

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

    // Exclusão em cascata 1:1 do modelo de inspeção vinculado de mesmo nome
    if (assetNome) {
        try {
            const linkedTemplate = templatesList.find(t =>
                t.nome && t.nome.trim().toUpperCase() === assetNome.trim().toUpperCase() &&
                String(t.id) !== SYSTEM_INSPECTION_TEMPLATE_ID
            );
            if (linkedTemplate) {
                await deleteTemplate(linkedTemplate.id);
            }
        } catch (cascadeErr) {
            console.warn('CRANE ASSET TEMPLATES: Erro na exclusão em cascata do formulário de inspeção vinculado:', cascadeErr);
        }
    }

    return true;
}

