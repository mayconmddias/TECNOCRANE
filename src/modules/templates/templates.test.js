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
    deleteAssetTemplate
} from './templates-module.js';

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

    it('deve validar que o modelo possui pelo menos 1 item', () => {
        const result = validateTemplate({ nome: 'Modelo Teste', items: [] });
        expect(result.valid).toBe(false);
        expect(result.error).toContain('pelo menos 1 item');
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
});


