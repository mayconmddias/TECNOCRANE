import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
    generateNextOrderId,
    saveDraftOrder,
    deleteDraftOrder,
    saveFastLocalDraft,
    getFastLocalDraft,
    clearFastLocalDraft
} from './orders-service.js';

describe('Orders Service - Ciclo de Vida de OS em Aberto', () => {
    let mockOpenOrders = [];

    beforeEach(() => {
        mockOpenOrders = [
            {
                id: 'ORD-001',
                type: 'PREVENTIVA',
                empresa: 'EMPRESA A',
                equipamentoId: '#EQP-0001',
                equipamentoNome: 'TALHA ELETRICA',
                templateId: 'tpl_talha',
                schema_snapshot: [{ id: '1', title: '1 SISTEMA', children: [] }],
                responses: { '1.1': { status: 'OK' } }
            },
            {
                id: 'ORD-002',
                type: 'PREVENTIVA',
                empresa: 'EMPRESA B',
                equipamentoId: '#EQP-0002',
                equipamentoNome: 'PONTE ROLANTE',
                templateId: 'DEFAULT',
                schema_snapshot: null,
                responses: {}
            }
        ];
    });

    it('deve salvar um novo rascunho preservando o schema_snapshot', async () => {
        const newDoc = {
            id: 'ORD-003',
            type: 'PREVENTIVA',
            empresa: 'EMPRESA C',
            equipamentoId: '#EQP-0003',
            equipamentoNome: 'TALHA CUSTOMIZADA',
            templateId: 'tpl_custom_talha',
            schema: [{ id: 'sec1', title: 'PAINEL ELETRICO', children: [] }],
            responses: { 'sec1_chk_1': { status: 'NOK', observation: 'Revisar' } }
        };

        const saved = await saveDraftOrder(newDoc, mockOpenOrders);
        expect(saved.id).toBe('ORD-003');
        expect(saved.schema_snapshot).toEqual(newDoc.schema);
        expect(mockOpenOrders.length).toBe(3);
        expect(mockOpenOrders.find(o => o.id === 'ORD-003')).toBeDefined();
    });

    it('deve atualizar um rascunho existente sem duplicar registros', async () => {
        const updatedDoc = {
            id: 'ORD-001',
            type: 'PREVENTIVA',
            empresa: 'EMPRESA A',
            equipamentoId: '#EQP-0001',
            equipamentoNome: 'TALHA ELETRICA',
            templateId: 'tpl_talha',
            schema_snapshot: [{ id: '1', title: '1 SISTEMA ATUALIZADO', children: [] }],
            responses: { '1.1': { status: 'NOK', observation: 'Falha no comando' } }
        };

        await saveDraftOrder(updatedDoc, mockOpenOrders);
        expect(mockOpenOrders.length).toBe(2);
        const orderInList = mockOpenOrders.find(o => o.id === 'ORD-001');
        expect(orderInList.responses['1.1'].status).toBe('NOK');
        expect(orderInList.responses['1.1'].observation).toBe('Falha no comando');
    });

    it('deve excluir diretamente um rascunho por ID', async () => {
        const remaining = await deleteDraftOrder('ORD-001', mockOpenOrders);
        expect(remaining.length).toBe(1);
        expect(remaining.find(o => o.id === 'ORD-001')).toBeUndefined();
        expect(mockOpenOrders.length).toBe(1);
    });

    it('deve lidar com exclusão de ID inexistente com segurança', async () => {
        const remaining = await deleteDraftOrder('ORD-999', mockOpenOrders);
        expect(remaining.length).toBe(2);
    });
});

describe('Orders Service - Fast Local Draft (Zero-lag)', () => {
    it('deve salvar e recuperar rascunho rápido na sessão local', () => {
        const mockDraft = {
            id: 'ORD-001',
            responses: { 'chk_1': { status: 'OK', observation: 'Tudo certo' } }
        };

        saveFastLocalDraft(mockDraft);
        const retrieved = getFastLocalDraft('ORD-001');
        expect(retrieved).toBeDefined();
        expect(retrieved.id).toBe('ORD-001');
        expect(retrieved.responses['chk_1'].status).toBe('OK');

        clearFastLocalDraft('ORD-001');
        expect(getFastLocalDraft('ORD-001')).toBeNull();
    });
});

describe('Orders Service - Geração Sequencial de IDs de Ordens', () => {
    it('deve retornar ORD-001 para lista vazia ou nula', () => {
        expect(generateNextOrderId([])).toBe('ORD-001');
        expect(generateNextOrderId(null)).toBe('ORD-001');
    });

    it('deve gerar o próximo ID sequencial baseado no maior existente', () => {
        const list = [
            { id: 'ORD-001' },
            { id: 'ORD-002' },
            { id: 'ORD-005' }
        ];
        expect(generateNextOrderId(list)).toBe('ORD-006');
    });

    it('deve preencher com zeros à esquerda no padrão de 3 dígitos', () => {
        const list = [
            { id: 'ORD-009' }
        ];
        expect(generateNextOrderId(list)).toBe('ORD-010');
    });
});
