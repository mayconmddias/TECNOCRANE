import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../supabase.js', () => ({
    dbFetchAll: vi.fn().mockResolvedValue([]),
    dbUpsert: vi.fn().mockResolvedValue([]),
    dbDelete: vi.fn().mockResolvedValue([]),
    isSupabaseConfigured: false,
    getActiveSupabase: vi.fn().mockReturnValue(null),
    uploadMediaFile: vi.fn().mockResolvedValue(null)
}));

vi.mock('../../data.js', () => ({
    getDBValue: vi.fn().mockResolvedValue([]),
    setDBValue: vi.fn().mockResolvedValue(true)
}));

import {
    validateTemplate,
    saveTemplate,
    getTemplates,
    getTemplateById,
    duplicateTemplate,
    deleteTemplate,
    convertTemplateToChecklistSchema,
    validateAssetTemplate,
    saveAssetTemplate,
    getAssetTemplates,
    getAssetTemplateById,
    duplicateAssetTemplate,
    deleteAssetTemplate,
    SYSTEM_INSPECTION_TEMPLATE_ID,
    SYSTEM_ASSET_TEMPLATE_ID,
    SYSTEM_INSPECTION_TEMPLATE,
    SYSTEM_ASSET_TEMPLATE,
    getUserTemplates,
    getUserAssetTemplates
} from './templates-module.js';
import { populateAssetTemplateDropdown, autoResizeTextarea } from './templates-ui.js';

describe('Módulo de Modelos (Templates)', () => {
    const validSample = {
        nome: 'Inspeção de Ponte Rolante',
        items: [
            {
                nome: 'SISTEMA DE ALIMENTAÇÃO',
                checklists: [
                    { descricao: 'ALINHAMENTO' },
                    { descricao: 'NIVELAMENTO' },
                    { descricao: 'CARROS COLETORES' }
                ]
            },
            {
                nome: 'SISTEMA DE CONTROLE',
                checklists: [
                    { descricao: 'COMUNICAÇÃO RÁDIO CONTROLE' },
                    { descricao: 'FUNCIONALIDADE DOS BOTÕES' }
                ]
            }
        ]
    };

    it('deve validar nome obrigatório do modelo', () => {
        const result = validateTemplate({ nome: '', items: [] });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('nome do modelo');
    });

    it('deve permitir que o modelo de inspeção seja criado inicialmente limpo sem itens', () => {
        const result = validateTemplate({ nome: 'Modelo Limpo', items: [] });
        expect(result.valid).toBe(true);
    });

    it('deve rejeitar formato inválido de itens no modelo', () => {
        const result = validateTemplate({ nome: 'Modelo Teste', items: null });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Lista de itens inválida');
    });

    it('deve permitir itens mesmo sem verificações de checklist (apenas notas/observações)', () => {
        const result = validateTemplate({
            nome: 'Modelo Teste',
            items: [{ nome: 'Item 1', checklists: [] }]
        });
        expect(result.valid).toBe(true);
    });

    it('deve salvar um novo modelo com sucesso e gerar estrutura correta', async () => {
        const saved = await saveTemplate(validSample, 'TestUser');
        expect(saved.id).toBeDefined();
        expect(saved.nome).toBe('Inspeção de Ponte Rolante');
        expect(saved.items.length).toBe(2);
        expect(saved.items[0].checklists.length).toBe(3);
        expect(saved.items[0].ordem).toBe(1);
        expect(saved.items[1].ordem).toBe(2);

        const fetched = getTemplateById(saved.id);
        expect(fetched).toBeDefined();
        expect(fetched.nome).toBe('Inspeção de Ponte Rolante');
    });

    it('deve duplicar um modelo criando uma cópia independente', async () => {
        const original = await saveTemplate(validSample, 'TestUser');
        const copy = await duplicateTemplate(original.id, 'TestUser');

        expect(copy.id).not.toBe(original.id);
        expect(copy.nome).toBe('Inspeção de Ponte Rolante (Cópia)');
        expect(copy.items.length).toBe(original.items.length);
        expect(copy.items[0].id).not.toBe(original.items[0].id);
    });

    it('deve converter modelo para o formato de schema de inspeção', async () => {
        const saved = await saveTemplate(validSample, 'TestUser');
        const schema = convertTemplateToChecklistSchema(saved);

        expect(Array.isArray(schema)).toBe(true);
        expect(schema.length).toBe(2);

        // Item 1
        expect(schema[0].title).toBe('1 SISTEMA DE ALIMENTAÇÃO');
        expect(schema[0].level).toBe(1);
        expect(schema[0].children.length).toBe(3);
        expect(schema[0].children[0].label).toBe('ALINHAMENTO');
        expect(schema[0].children[0].fieldType).toBe('inspectable');

        // Item 2
        expect(schema[1].title).toBe('2 SISTEMA DE CONTROLE');
        expect(schema[1].children.length).toBe(2);
        expect(schema[1].children[1].label).toBe('FUNCIONALIDADE DOS BOTÕES');
    });

    it('deve garantir que o documento de inspeção mantenha snapshot imutável mesmo se o modelo for alterado posteriormente', async () => {
        const saved = await saveTemplate(validSample, 'TestUser');
        const schema = convertTemplateToChecklistSchema(saved);
        
        // Simula criação do documento de inspeção com snapshot congelado
        const doc = {
            id: 'REL-99',
            templateId: saved.id,
            schema: JSON.parse(JSON.stringify(schema)),
            responses: {
                [`${schema[0].children[0].id}`]: { status: 'OK', observation: 'Tudo alinhado' }
            }
        };

        expect(doc.schema.length).toBe(2);
        expect(doc.schema[0].children.length).toBe(3);

        // Usuário edita o modelo posteriormente (adiciona um 3º item e remove verificações)
        saved.items.push({
            nome: 'NOVO ITEM ADICIONADO POSTERIORMENTE',
            checklists: [{ descricao: 'TESTE EXTRA' }]
        });
        await saveTemplate(saved, 'TestUser');

        // O schema do relatório já concluído deve permanecer INTACTO com 2 itens
        expect(doc.schema.length).toBe(2);
        expect(doc.schema[0].title).toBe('1 SISTEMA DE ALIMENTAÇÃO');
    });

    it('deve remover itens do modelo ao salvar uma edição e persistir a remoção', async () => {
        const originalTemplate = {
            nome: 'Modelo com 3 itens',
            items: [
                { nome: '1 SISTEMA DE ALIMENTAÇÃO', checklists: [{ descricao: 'ALINHAMENTO' }] },
                { nome: '2 CABO DE AÇO', checklists: [{ descricao: 'DESGASTE' }] },
                { nome: '3 PAINEL ELÉTRICO', checklists: [{ descricao: 'DISJUNTORES' }] }
            ]
        };

        const saved = await saveTemplate(originalTemplate, 'TestUser');
        expect(saved.items.length).toBe(3);

        // Usuário remove os itens 2 e 3 (mantém apenas o item 1)
        saved.items.splice(1, 2);
        expect(saved.items.length).toBe(1);

        const updated = await saveTemplate(saved, 'TestUser');
        expect(updated.items.length).toBe(1);
        expect(updated.items[0].nome).toBe('1 SISTEMA DE ALIMENTAÇÃO');

        const fetched = getTemplateById(saved.id);
        expect(fetched.items.length).toBe(1);
        expect(fetched.items[0].nome).toBe('1 SISTEMA DE ALIMENTAÇÃO');
    });

    it('deve excluir um modelo', async () => {
        const saved = await saveTemplate(validSample, 'TestUser');
        expect(getTemplateById(saved.id)).toBeDefined();

        await deleteTemplate(saved.id);
        expect(getTemplateById(saved.id)).toBeNull();
    });
});

describe('Módulo de Modelos de Ativos (Ficha Técnica / Custom Fields)', () => {
    const validAssetSample = {
        nome: 'Ponte Rolante Especial com Inversor',
        tipoEquipamento: 'PONTE ROLANTE VIGA DUPLA',
        customFields: [
            { label: 'TIPO DE FREIO', type: 'text' },
            { label: 'MODELO DO INVERSOR', type: 'text' },
            { label: 'POTÊNCIA NOMINAL', type: 'number' }
        ]
    };

    it('deve validar nome obrigatório do modelo de ativo', () => {
        const result = validateAssetTemplate({ nome: '', customFields: [] });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('nome do modelo de ativo');
    });

    it('deve permitir que o modelo de ativo seja criado apenas com os 7 campos fixos (sem customizados adicionais)', () => {
        const result = validateAssetTemplate({ nome: 'Modelo Teste', customFields: [] });
        expect(result.valid).toBe(true);
    });

    it('deve validar rótulos obrigatórios em cada campo personalizado', () => {
        const result = validateAssetTemplate({
            nome: 'Modelo Teste',
            customFields: [{ label: '' }]
        });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Informe o rótulo do campo 1');
    });

    it('deve salvar um modelo de ativo com sucesso e persistir campos', async () => {
        const saved = await saveAssetTemplate(validAssetSample, 'TestAdmin');
        expect(saved.id).toBeDefined();
        expect(saved.nome).toBe('PONTE ROLANTE ESPECIAL COM INVERSOR');
        expect(saved.tipoEquipamento).toBe('PONTE ROLANTE VIGA DUPLA');
        expect(saved.customFields.length).toBe(3);
        expect(saved.customFields[0].id).toBeDefined();
        expect(saved.customFields[0].label).toBe('TIPO DE FREIO');
        expect(saved.customFields[2].type).toBe('number');

        const fetched = getAssetTemplateById(saved.id);
        expect(fetched).toBeDefined();
        expect(fetched.nome).toBe('PONTE ROLANTE ESPECIAL COM INVERSOR');
    });

    it('deve duplicar um modelo de ativo', async () => {
        const saved = await saveAssetTemplate(validAssetSample, 'TestAdmin');
        const duplicated = await duplicateAssetTemplate(saved.id, 'TestAdmin');

        expect(duplicated.id).not.toBe(saved.id);
        expect(duplicated.nome).toBe('PONTE ROLANTE ESPECIAL COM INVERSOR (CÓPIA)');
        expect(duplicated.customFields.length).toBe(3);
    });

    it('deve excluir um modelo de ativo', async () => {
        const saved = await saveAssetTemplate(validAssetSample, 'TestAdmin');
        expect(getAssetTemplateById(saved.id)).toBeDefined();

        await deleteAssetTemplate(saved.id);
        expect(getAssetTemplateById(saved.id)).toBeNull();
    });

    it('deve permitir ordenação alfabética (A-Z) correta para modelos de ativos e de inspeção respeitando acentuação pt-BR', () => {
        const unsortedInspectionNames = [
            'PONTE ROLANTE SIMPLES',
            'TALHA ELÉTRICA',
            'PÓRTICO',
            'GUINDASTE DE COLUNA'
        ];

        const sorted = [...unsortedInspectionNames].sort((a, b) => 
            a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
        );

        expect(sorted).toEqual([
            'GUINDASTE DE COLUNA',
            'PONTE ROLANTE SIMPLES',
            'PÓRTICO',
            'TALHA ELÉTRICA'
        ]);
    });

    it('deve criar automaticamente um modelo de inspeção correspondente com mesmo nome ao salvar um modelo de ativo', async () => {
        const uniqueAssetName = `GUINDASTE GIRATÓRIO ${Date.now()}`;
        const assetData = {
            nome: uniqueAssetName,
            tipoEquipamento: 'GUINDASTE',
            customFields: []
        };

        const savedAsset = await saveAssetTemplate(assetData, 'Maycon Dias');
        expect(savedAsset.nome).toBe(uniqueAssetName);

        const allInspectionTemplates = getTemplates();
        const correspondingChecklist = allInspectionTemplates.find(t => t.nome === uniqueAssetName);
        expect(correspondingChecklist).toBeDefined();
        expect(correspondingChecklist.nome).toBe(uniqueAssetName);
        expect(correspondingChecklist.createdBy).toBe('Maycon Dias');
    });

    it('deve renomear em cascata o modelo de inspeção quando o modelo de ativo for renomeado', async () => {
        const originalName = `TALHA DE CORRENTE ${Date.now()}`;
        const updatedName = `TALHA ELÉTRICA ESPECIAL ${Date.now()}`;

        const savedAsset = await saveAssetTemplate({
            nome: originalName,
            tipoEquipamento: 'TALHA',
            customFields: []
        }, 'Maycon Dias');

        expect(getTemplates().find(t => t.nome === originalName)).toBeDefined();

        // Renomeia o modelo de ativo
        await saveAssetTemplate({
            id: savedAsset.id,
            nome: updatedName,
            tipoEquipamento: 'TALHA',
            customFields: []
        }, 'Maycon Dias');

        // O checklist vinculado agora deve ter o novo nome atualizado
        expect(getTemplates().find(t => t.nome === updatedName)).toBeDefined();
    });

    it('deve gerar o formulário de inspeção vinculado inicialmente LIMPO (items: []) ao criar um novo modelo de ativo', async () => {
        const uniqueAssetName = `PÓRTICO ROLANTE LIMPO ${Date.now()}`;
        const savedAsset = await saveAssetTemplate({
            nome: uniqueAssetName,
            tipoEquipamento: 'PÓRTICO ROLANTE',
            customFields: []
        }, 'Inspetor Silva');

        const linkedInspection = getTemplates().find(t => t.nome === uniqueAssetName);
        expect(linkedInspection).toBeDefined();
        expect(Array.isArray(linkedInspection.items)).toBe(true);
        expect(linkedInspection.items.length).toBe(0); // Deve vir limpo para o usuário poder montar do zero ou importar padrão!
    });

    it('deve gerar o formulário de inspeção LIMPO ao duplicar um modelo de ativo', async () => {
        const uniqueAssetName = `PONTE ROLANTE DUP ${Date.now()}`;
        const savedAsset = await saveAssetTemplate({
            nome: uniqueAssetName,
            tipoEquipamento: 'PONTE ROLANTE VIGA DUPLA',
            customFields: [{ label: 'CAMPO TESTE', type: 'text' }]
        }, 'Inspetor Silva');

        const duplicatedAsset = await duplicateAssetTemplate(savedAsset.id, 'Inspetor Silva');
        expect(duplicatedAsset.nome).toBe(`${uniqueAssetName} (CÓPIA)`);

        const linkedInspection = getTemplates().find(t => t.nome === `${uniqueAssetName} (CÓPIA)`);
        expect(linkedInspection).toBeDefined();
        expect(linkedInspection.items.length).toBe(0); // Limpo!
    });

    it('deve excluir em cascata o formulário de inspeção vinculado ao excluir o modelo de ativo criado pelo usuário', async () => {
        const uniqueAssetName = `TALHA PARA EXCLUSÃO ${Date.now()}`;
        const savedAsset = await saveAssetTemplate({
            nome: uniqueAssetName,
            tipoEquipamento: 'TALHA',
            customFields: []
        }, 'Inspetor Silva');

        expect(getAssetTemplateById(savedAsset.id)).toBeDefined();
        expect(getTemplates().find(t => t.nome === uniqueAssetName)).toBeDefined();

        // Usuário exclui o modelo de ativo
        await deleteAssetTemplate(savedAsset.id);

        expect(getAssetTemplateById(savedAsset.id)).toBeNull();
        // O formulário de inspeção vinculado de mesmo nome DEVE ter sido excluído em cascata!
        expect(getTemplates().find(t => t.nome === uniqueAssetName)).toBeUndefined();
    });
});

describe('Modelos Padrão do Sistema (Ponte Rolante Viga Dupla)', () => {
    it('deve garantir a presença do Formulario modelo Inspeção padrão na lista de modelos', () => {
        const allTemplates = getTemplates();
        const systemTpl = allTemplates.find(t => String(t.id) === SYSTEM_INSPECTION_TEMPLATE_ID);
        expect(systemTpl).toBeDefined();
        expect(systemTpl.nome).toBe('Formulario modelo Inspeção');
        expect(systemTpl.isSystemDefault).toBe(true);
        expect(systemTpl.createdBy).toBe('Sistema');
        expect(systemTpl.items.length).toBe(10); // As 10 seções completas de Ponte Rolante
        expect(systemTpl.items[0].nome).toContain('SISTEMA DE ALIMENTAÇÃO');
    });

    it('deve garantir a presença do Formulário modelo Ativo padrão na lista de ativos', () => {
        const allAssetTemplates = getAssetTemplates();
        const systemAssetTpl = allAssetTemplates.find(t => String(t.id) === SYSTEM_ASSET_TEMPLATE_ID);
        expect(systemAssetTpl).toBeDefined();
        expect(systemAssetTpl.nome).toBe('Formulário modelo Ativo');
        expect(systemAssetTpl.isSystemDefault).toBe(true);
        expect(systemAssetTpl.tipoEquipamento).toBe('PONTE ROLANTE VIGA DUPLA');
        expect(systemAssetTpl.customFields.length).toBe(21); // Os 21 campos técnicos padrão
    });

    it('deve bloquear qualquer alteração no Formulario modelo Inspeção padrão do sistema (Imutabilidade)', async () => {
        const systemTpl = getTemplateById(SYSTEM_INSPECTION_TEMPLATE_ID);
        expect(systemTpl).toBeDefined();

        await expect(saveTemplate({
            ...systemTpl,
            nome: 'Nome Alterado Proibido'
        }, 'Hacker')).rejects.toThrow('O Formulario modelo Inspeção padrão do sistema não pode ser alterado');
    });

    it('deve bloquear qualquer exclusão do Formulario modelo Inspeção padrão do sistema', async () => {
        const result = await deleteTemplate(SYSTEM_INSPECTION_TEMPLATE_ID);
        expect(result).toBe(false);
        expect(getTemplateById(SYSTEM_INSPECTION_TEMPLATE_ID)).toBeDefined();
    });

    it('deve bloquear qualquer alteração no Formulário modelo Ativo padrão do sistema (Imutabilidade)', async () => {
        const systemAssetTpl = getAssetTemplateById(SYSTEM_ASSET_TEMPLATE_ID);
        expect(systemAssetTpl).toBeDefined();

        await expect(saveAssetTemplate({
            ...systemAssetTpl,
            nome: 'Nome Ativo Alterado Proibido'
        }, 'Hacker')).rejects.toThrow('O Formulário modelo Ativo padrão do sistema não pode ser alterado');
    });

    it('deve bloquear qualquer exclusão do Formulário modelo Ativo padrão do sistema', async () => {
        const result = await deleteAssetTemplate(SYSTEM_ASSET_TEMPLATE_ID);
        expect(result).toBe(false);
        expect(getAssetTemplateById(SYSTEM_ASSET_TEMPLATE_ID)).toBeDefined();
    });

    it('deve permitir duplicar o Formulário modelo Ativo padrão gerando novo ativo com checklist vinculado limpo', async () => {
        const duplicated = await duplicateAssetTemplate(SYSTEM_ASSET_TEMPLATE_ID, 'Engenheiro');
        expect(duplicated.id).not.toBe(SYSTEM_ASSET_TEMPLATE_ID);
        expect(duplicated.nome).toBe('Formulário modelo Ativo (CÓPIA)'.toUpperCase());
        expect(duplicated.customFields.length).toBe(21);

        // O checklist vinculado deve existir e vir limpo para o usuário customizar
        const linkedChecklist = getTemplates().find(t => t.nome === duplicated.nome);
        expect(linkedChecklist).toBeDefined();
        expect(linkedChecklist.items.length).toBe(0);
    });

    describe('Filtros e Dropdowns Operacionais (Exclusão de Modelos de Sistema)', () => {
        it('getUserAssetTemplates deve retornar apenas modelos criados por usuários, nunca o modelo padrão', () => {
            const userAssets = getUserAssetTemplates();
            expect(userAssets.some(t => t.id === SYSTEM_ASSET_TEMPLATE_ID)).toBe(false);
            expect(userAssets.some(t => t.isSystemDefault)).toBe(false);
            expect(userAssets.some(t => t.nome === 'Formulário modelo Ativo')).toBe(false);
        });

        it('getUserTemplates deve retornar apenas formulários de inspeção de usuários, nunca o modelo padrão', () => {
            const userInspections = getUserTemplates();
            expect(userInspections.some(t => t.id === SYSTEM_INSPECTION_TEMPLATE_ID)).toBe(false);
            expect(userInspections.some(t => t.isSystemDefault)).toBe(false);
            expect(userInspections.some(t => t.nome === 'Formulario modelo Inspeção')).toBe(false);
        });

        it('populateAssetTemplateDropdown deve popular o select sem o Formulário modelo Ativo padrão', () => {
            const selectEl = { innerHTML: '' };
            populateAssetTemplateDropdown(selectEl);

            // Garante que o ID do modelo de sistema não existe nas opções geradas
            expect(selectEl.innerHTML.includes(SYSTEM_ASSET_TEMPLATE_ID)).toBe(false);
            // Garante que o modelo padrão exato não é listado como uma option
            expect(selectEl.innerHTML.includes(`>${SYSTEM_ASSET_TEMPLATE.nome.toUpperCase()}<`)).toBe(false);
        });
    });

    describe('Utilitário autoResizeTextarea (Expansão Dinâmica e Prevenção de Deslocamento para Cima)', () => {
        it('deve expandir a altura proporcionalmente ao scrollHeight com margem de segurança e zerar scrollTop', () => {
            const mockEl = {
                getBoundingClientRect: () => ({ width: 300, height: 42 }),
                style: { height: '42px', minHeight: '42px' },
                dataset: {},
                classList: { contains: (c) => c === 'field-label' },
                scrollHeight: 72,
                scrollTop: 25 // Simula o motor nativo tendo rolado para baixo
            };

            autoResizeTextarea(mockEl);

            // Garante que o scrollTop foi zerado na redimensionamento para não empurrar as primeiras linhas para cima
            expect(mockEl.scrollTop).toBe(0);
            expect(mockEl.style.boxSizing).toBe('border-box');
            expect(mockEl.style.overflowY).toBe('hidden');
            expect(mockEl.style.resize).toBe('none');

            // Altura calculada deve acomodar o scrollHeight (72) + bordas (2) + margem de respiro (8px) = 82px
            const numericHeight = parseFloat(mockEl.style.height);
            expect(numericHeight).toBeGreaterThanOrEqual(80);
        });
    });
});



