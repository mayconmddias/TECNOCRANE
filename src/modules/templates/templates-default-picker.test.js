import { describe, it, expect } from 'vitest';
import { getHierarchyDefaultTree, filterSchemaForCorretiva } from './templates-ui.js';
import { convertTemplateToChecklistSchema } from './templates-module.js';
import { CHECKLIST_SCHEMA } from '../../checklist-schema.js';

describe('Seletor Hierárquico do Checklist Padrão', () => {
    it('deve extrair a estrutura hierárquica unificada a partir do CHECKLIST_SCHEMA', () => {
        const sections = getHierarchyDefaultTree(CHECKLIST_SCHEMA);

        expect(sections).toBeDefined();
        expect(sections.length).toBe(10); // 10 Seções principais

        // Verifica Seção 5 (Sistema de Elevação Principal)
        const sec5 = sections.find(s => s.id === '5');
        expect(sec5).toBeDefined();
        expect(sec5.title).toContain('Sistema de Elevação Principal');

        // Subseção 5.6 (Cabo de Aço) integrada
        const sub56 = sec5.subSections.find(sub => sub.id === '5.6');
        expect(sub56).toBeDefined();
        expect(sub56.title).toBe('5.6 Cabo de Aço de Elevação Principal');
        expect(sub56.fields.length).toBeGreaterThanOrEqual(3);

        // Subseção 5.7 (Moitão) integrada
        const sub57 = sec5.subSections.find(sub => sub.id === '5.7');
        expect(sub57).toBeDefined();
        expect(sub57.title).toBe('5.7 Conjunto de Caixa de Gancho (Moitão) Elevação Principal');
        expect(sub57.fields.length).toBeGreaterThanOrEqual(7);

        // Subseção 7.7 (Festoon) unificada sem quebras
        const sec7 = sections.find(s => s.id === '7');
        expect(sec7).toBeDefined();
        const sub77 = sec7.subSections.find(sub => sub.id === '7.7');
        expect(sub77).toBeDefined();
        expect(sub77.fields.length).toBe(9);

        // Subseção 8.7 (Estrutura) unificada sem quebras
        const sec8 = sections.find(s => s.id === '8');
        expect(sec8).toBeDefined();
        const sub87 = sec8.subSections.find(sub => sub.id === '8.7');
        expect(sub87).toBeDefined();
        expect(sub87.fields.length).toBe(5);
    });

    it('deve converter itens com tabelas especiais no modelo customizado para o schema de inspeção', () => {
        const mockTemplate = {
            id: 'tpl_123',
            nome: 'Modelo Teste com Cabo de Aço e Moitão',
            items: [
                {
                    nome: '5.6 CABO DE AÇO DE ELEVAÇÃO PRINCIPAL',
                    specialType: 'cableComposite',
                    checklists: [{ descricao: 'Fixação e Ancoragem' }]
                },
                {
                    nome: '5.7 CONJUNTO DE CAIXA DE GANCHO (MOITÃO)',
                    specialType: 'hookComposite',
                    checklists: [{ descricao: 'Trava de segurança' }]
                }
            ]
        };

        const schema = convertTemplateToChecklistSchema(mockTemplate);

        expect(schema.length).toBe(2);

        // Item 1: Cabo de Aço composto
        const itemCable = schema[0];
        expect(itemCable.specialType).toBe('cableComposite');
        expect(itemCable.children.some(c => c.fieldType === 'inspectable')).toBe(true);
        expect(itemCable.children.map(c => c.label)).toContain('Arames rompidos');
        expect(itemCable.children.map(c => c.label)).toContain('DIÂMETRO VALOR MEDIDO');

        // Item 2: Moitão composto
        const itemHook = schema[1];
        expect(itemHook.specialType).toBe('hookComposite');
        expect(itemHook.children.some(c => c.fieldType === 'inspectable')).toBe(true);
        expect(itemHook.children.map(c => c.label)).toContain('Abertura do Gancho');
        expect(itemHook.children.map(c => c.label)).toContain('Líquido Penetrante');
    });

    it('deve renderizar nós de modelo customizado com tabela de cabo e moitão corretamente', async () => {
        const { renderNode } = await import('../../checklist-render.js');
        const mockTemplate = {
            id: 'tpl_456',
            nome: 'Modelo com Tabelas',
            items: [
                {
                    nome: '5.6 CABO DE AÇO DE ELEVAÇÃO PRINCIPAL',
                    specialType: 'cableComposite',
                    checklists: [{ descricao: 'Fixação e Ancoragem do cabo de aço' }]
                },
                {
                    nome: '5.7 CONJUNTO DE CAIXA DE GANCHO (MOITÃO)',
                    specialType: 'hookComposite',
                    checklists: [{ descricao: 'Trava de segurança' }]
                }
            ]
        };

        const schema = convertTemplateToChecklistSchema(mockTemplate);
        const htmlCable = renderNode(schema[0], '1');
        const htmlHook = renderNode(schema[1], '2');

        // Verifica renderização do cabo
        expect(htmlCable).toContain('checklist-cable-table-block');
        expect(htmlCable).toContain('Arames Rompidos');
        expect(htmlCable).toContain('Redução do Diâmetro');

        // Verifica renderização do moitão
        expect(htmlHook).toContain('checklist-hook-table-block');
        expect(htmlHook).toContain('Abertura do Gancho');
        expect(htmlHook).toContain('Líquido Penetrante');
    });

    it('não deve incluir tabelas nos itens 5.5 Tambor e 5.8 Bloco Superior ao converter modelos', () => {
        const mockTemplate = {
            id: 'tpl_789',
            nome: 'Modelo com 5.5 e 5.8',
            items: [
                {
                    nome: '5.5 TAMBOR DO CABO DE AÇO (DROMO) DA ELEVAÇÃO PRINCIPAL',
                    checklists: [
                        { descricao: 'Ranhuras (passo) ausência de desgastes, trincas ou quebras' },
                        { descricao: 'Voltas de reserva do cabo de aço' },
                        { descricao: 'Alinhamento do enrolamento do cabo de aço' }
                    ]
                },
                {
                    nome: '5.8 CONJUNTO DE CAIXA DE GANCHO (BLOCO SUPERIOR) ELEVAÇÃO PRINCIPAL',
                    checklists: [
                        { descricao: 'Polias e Roldanas ausência de desgaste' },
                        { descricao: 'Ausência de desgaste nos rolamentos' }
                    ]
                }
            ]
        };

        const schema = convertTemplateToChecklistSchema(mockTemplate);

        // 5.5 NÃO deve ter specialType nem campos de tabela de cabo
        expect(schema[0].specialType).toBeUndefined();
        expect(schema[0].children.every(c => c.fieldType === 'inspectable')).toBe(true);
        expect(schema[0].children.length).toBe(3);
        expect(schema[0].children.map(c => c.label)).not.toContain('Arames rompidos');

        // 5.8 NÃO deve ter specialType nem campos de tabela de moitão
        expect(schema[1].specialType).toBeUndefined();
        expect(schema[1].children.every(c => c.fieldType === 'inspectable')).toBe(true);
        expect(schema[1].children.length).toBe(2);
        expect(schema[1].children.map(c => c.label)).not.toContain('Abertura do Gancho');
    });

    it('deve permitir desativar a tabela técnica de 5.6 e 5.7 quando specialType for none', () => {
        const mockTemplate = {
            id: 'tpl_desativado',
            nome: 'Modelo com Tabelas Desativadas',
            items: [
                {
                    nome: '5.6 CABO DE AÇO DE ELEVAÇÃO PRINCIPAL',
                    specialType: 'none',
                    checklists: [
                        { descricao: 'Fixação e Ancoragem do cabo de aço' }
                    ]
                },
                {
                    nome: '5.7 CONJUNTO DE CAIXA DE GANCHO (MOITÃO) ELEVAÇÃO PRINCIPAL',
                    specialType: 'none',
                    checklists: [
                        { descricao: 'Trava de segurança' }
                    ]
                }
            ]
        };

        const schema = convertTemplateToChecklistSchema(mockTemplate);

        // 5.6 com tabela desativada
        expect(schema[0].specialType).toBeUndefined();
        expect(schema[0].children.every(c => c.fieldType === 'inspectable')).toBe(true);
        expect(schema[0].children.length).toBe(1);
        expect(schema[0].children.map(c => c.label)).not.toContain('Arames rompidos');

        // 5.7 com tabela desativada
        expect(schema[1].specialType).toBeUndefined();
        expect(schema[1].children.every(c => c.fieldType === 'inspectable')).toBe(true);
        expect(schema[1].children.length).toBe(1);
        expect(schema[1].children.map(c => c.label)).not.toContain('Abertura do Gancho');
    });

    it('deve filtrar o schema para inspeção corretiva mantendo apenas os itens e seções selecionados', () => {
        const selectedIds = new Set(['5.1.alinhamento', '5.2.desgaste']);
        const corretivaSchema = filterSchemaForCorretiva(CHECKLIST_SCHEMA, selectedIds);

        // Deve conter apenas a seção principal 5
        expect(corretivaSchema.length).toBe(1);
        expect(corretivaSchema[0].id).toBe('5');

        // Seção 5 deve conter apenas as subseções 5.1 e 5.2
        const subSecs = corretivaSchema[0].children;
        expect(subSecs.length).toBe(2);
        expect(subSecs.map(s => s.id)).toEqual(['5.1', '5.2']);

        // Subseção 5.1 deve conter apenas 5.1.alinhamento
        expect(subSecs[0].children.length).toBe(1);
        expect(subSecs[0].children[0].id).toBe('5.1.alinhamento');

        // Subseção 5.2 deve conter apenas 5.2.desgaste
        expect(subSecs[1].children.length).toBe(1);
        expect(subSecs[1].children[0].id).toBe('5.2.desgaste');
    });

    it('deve retornar array vazio ao passar seleção vazia para filterSchemaForCorretiva', () => {
        expect(filterSchemaForCorretiva(CHECKLIST_SCHEMA, new Set())).toEqual([]);
        expect(filterSchemaForCorretiva(null, new Set(['5.1.alinhamento']))).toEqual([]);
    });
});

