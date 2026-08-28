import { describe, it, expect } from 'vitest';
import { CHECKLIST_SCHEMA, walkChecklistFields, createEmptyResponses } from './checklist-schema.js';
import { renderNode } from './checklist-render.js';
import { createInspectionDocument } from './checklist-state.js';

describe('Checklist Schema e Renderização Unificada', () => {
    it('deve ter seções 5.6 e 6.6 com título limpo (sem texto fixo NBR ISO 4309)', () => {
        const sec5 = CHECKLIST_SCHEMA.find(s => s.id === '5');
        const sub56 = sec5.children.find(c => c.id === '5.6');
        expect(sub56).toBeDefined();
        expect(sub56.title).toBe('5.6 Cabo de Aço de Elevação Principal');
        expect(sub56.title).not.toContain('Inspeção Técnica de acordo com a NBR ISO 4309');

        const sec6 = CHECKLIST_SCHEMA.find(s => s.id === '6');
        const sub66 = sec6.children.find(c => c.id === '6.6');
        expect(sub66).toBeDefined();
        expect(sub66.title).toBe('6.6 Cabo de Aço de Elevação Auxiliar');
        expect(sub66.title).not.toContain('Inspeção Técnica de acordo com a NBR ISO 4309');
    });

    it('não deve possuir subseções órfãs 5.6.1, 6.6.1, 5.7.1, 5.7.2, 6.7.1, 6.7.2', () => {
        const sec5 = CHECKLIST_SCHEMA.find(s => s.id === '5');
        expect(sec5.children.find(c => c.id === '5.6.1')).toBeUndefined();
        expect(sec5.children.find(c => c.id === '5.7.1')).toBeUndefined();
        expect(sec5.children.find(c => c.id === '5.7.2')).toBeUndefined();

        const sec6 = CHECKLIST_SCHEMA.find(s => s.id === '6');
        expect(sec6.children.find(c => c.id === '6.6.1')).toBeUndefined();
        expect(sec6.children.find(c => c.id === '6.7.1')).toBeUndefined();
        expect(sec6.children.find(c => c.id === '6.7.2')).toBeUndefined();
    });

    it('deve ter 5.6 e 6.6 contendo 3 inspectables e campos da tabela de cabo de aço', () => {
        const sec5 = CHECKLIST_SCHEMA.find(s => s.id === '5');
        const sub56 = sec5.children.find(c => c.id === '5.6');
        const inspectables = sub56.children.filter(c => c.fieldType === 'inspectable');
        expect(inspectables.length).toBe(3);
        expect(inspectables.map(i => i.label)).toContain('Fixação e ancoragem do cabo de aço');

        const tableFields = sub56.children.filter(c => c.fieldType === 'text' || c.fieldType === 'textarea');
        expect(tableFields.map(f => f.id)).toContain('5.6.arames');
        expect(tableFields.map(f => f.id)).toContain('5.6.bitola');
        expect(tableFields.map(f => f.id)).toContain('5.6.observacoes');
    });

    it('deve ter 5.7 e 6.7 contendo 7 inspectables e campos da tabela de moitão', () => {
        const sec5 = CHECKLIST_SCHEMA.find(s => s.id === '5');
        const sub57 = sec5.children.find(c => c.id === '5.7');
        const inspectables = sub57.children.filter(c => c.fieldType === 'inspectable');
        expect(inspectables.length).toBe(7);
        expect(inspectables.map(i => i.label)).toContain('Abertura e torção frontal dentro do limite aceitável DIN 15405.');
        expect(inspectables.map(i => i.label)).toContain('Trava de segurança');

        const tableFields = sub57.children.filter(c => c.fieldType === 'text' || c.fieldType === 'textarea');
        expect(tableFields.map(f => f.id)).toContain('5.7.gancho_abertura');
        expect(tableFields.map(f => f.id)).toContain('5.7.penetrante');
        expect(tableFields.map(f => f.id)).toContain('5.7.observacoes');
    });

    it('deve ter 7.7 com 9 itens diretos sem subitens 7.7.1 a 7.7.4', () => {
        const sec7 = CHECKLIST_SCHEMA.find(s => s.id === '7');
        const sub77 = sec7.children.find(c => c.id === '7.7');
        expect(sub77).toBeDefined();
        expect(sub77.children.every(c => c.fieldType === 'inspectable')).toBe(true);
        expect(sub77.children.length).toBe(9);
    });

    it('deve ter 8.7 com 5 itens diretos sem subitens 8.7.1 a 8.7.2', () => {
        const sec8 = CHECKLIST_SCHEMA.find(s => s.id === '8');
        const sub87 = sec8.children.find(c => c.id === '8.7');
        expect(sub87).toBeDefined();
        expect(sub87.children.every(c => c.fieldType === 'inspectable')).toBe(true);
        expect(sub87.children.length).toBe(5);
    });

    it('deve renderizar o card composto de 5.6 com inspectables, tabela NBR ISO 4309 e observação', () => {
        const sec5 = CHECKLIST_SCHEMA.find(s => s.id === '5');
        const sub56 = sec5.children.find(c => c.id === '5.6');
        const html = renderNode(sub56);

        expect(html).toContain('5.6 Cabo de Aço de Elevação Principal');
        expect(html).toContain('Fixação e ancoragem do cabo de aço');
        expect(html).toContain('checklist-cable-table-block');
        expect(html).toContain('Arames Rompidos');
        expect(html).toContain('Redução do Diâmetro');
        expect(html).toContain('data-field-id="5.6.observacoes"');
        expect(html).toContain('placeholder="OBSERVAÇÕES"');
    });

    it('deve renderizar o card composto de 5.7 com 7 inspectables, tabela DIN 15400 e observação', () => {
        const sec5 = CHECKLIST_SCHEMA.find(s => s.id === '5');
        const sub57 = sec5.children.find(c => c.id === '5.7');
        const html = renderNode(sub57);

        expect(html).toContain('5.7 Conjunto de Caixa de Gancho (Moitão) Elevação Principal');
        expect(html).toContain('Abertura e torção frontal dentro do limite aceitável DIN 15405.');
        expect(html).toContain('Trava de segurança');
        expect(html).toContain('checklist-hook-table-block');
        expect(html).toContain('Abertura do Gancho');
        expect(html).toContain('Líquido Penetrante');
        expect(html).toContain('data-field-id="5.7.observacoes"');
    });

    it('deve inicializar responses vazias corretamente', () => {
        const responses = createEmptyResponses();
        expect(responses['5.6.fixacao']).toEqual({ status: null, observation: '', images: [] });
        expect(responses['5.6.arames']).toEqual({ value: '' });
        expect(responses['5.7.gancho_abertura']).toEqual({ value: '' });
        expect(responses['7.7.cabos_isolamento']).toEqual({ status: null, observation: '', images: [] });
        expect(responses['8.7.juncoes_fixacao']).toEqual({ status: null, observation: '', images: [] });
    });

    it('deve registrar e preservar o técnico responsável no documento de inspeção', () => {
        const docWithContext = createInspectionDocument({
            empresa: 'EMPRESA TESTE',
            equipamentoId: 'EQ-001',
            tecnico: 'MAYCON DIAS'
        });
        expect(docWithContext.tecnico).toBe('MAYCON DIAS');

        const docWithExisting = createInspectionDocument({}, {
            id: 'REL-01',
            tecnico: 'MERILDO'
        });
        expect(docWithExisting.tecnico).toBe('MERILDO');
    });

    it('deve registrar e preservar o objeto de revisões no documento de inspeção', () => {
        const revData = {
            rev01: {
                prepared: 'usr_1',
                collaboration: 'usr_2',
                checked: 'usr_3',
                approved: 'usr_4'
            },
            rev02: {
                date: '2026-08-30',
                description: 'REVISÃO',
                prepared: 'usr_2'
            }
        };

        const doc = createInspectionDocument({ revisions: revData });
        expect(doc.revisions).toEqual(revData);
        expect(doc.revisions.rev01.prepared).toBe('usr_1');
        expect(doc.revisions.rev02.date).toBe('2026-08-30');
    });
});
