import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    parseAssetSequenceNumber,
    formatAssetId,
    prepareAssetPayload,
    reconcileLocalEntities,
    reserveNextAssetId,
    resolveSyncConflict
} from './assets-service.js';

// Mock Supabase
vi.mock('../../supabase.js', () => ({
    isSupabaseConfigured: true,
    getTenantCode: vi.fn().mockReturnValue('001'),
    supabase: {
        rpc: vi.fn()
    }
}));

import { supabase } from '../../supabase.js';

describe('Assets Service Unit Tests', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        globalThis.allAssetsList = [];
    });

    describe('parseAssetSequenceNumber', () => {
        it('deve extrair o número de formato padrão oficial #EQP-0001', () => {
            expect(parseAssetSequenceNumber('#EQP-0001')).toBe(1);
            expect(parseAssetSequenceNumber('#EQP-0042')).toBe(42);
            expect(parseAssetSequenceNumber('#EQP-3344')).toBe(3344);
        });

        it('deve extrair o número de formatos legados com espaço ou minúsculas (#eqp 0002)', () => {
            expect(parseAssetSequenceNumber('#eqp 0002')).toBe(2);
            expect(parseAssetSequenceNumber('#eqp 0003')).toBe(3);
            expect(parseAssetSequenceNumber('EQP-5')).toBe(5);
            expect(parseAssetSequenceNumber('eqp 100')).toBe(100);
        });

        it('deve retornar null para IDs fora do padrão de equipamento', () => {
            expect(parseAssetSequenceNumber('')).toBeNull();
            expect(parseAssetSequenceNumber(null)).toBeNull();
            expect(parseAssetSequenceNumber('GUINDASTE-01')).toBeNull();
            expect(parseAssetSequenceNumber('PONTE-ROLANTE')).toBeNull();
        });
    });

    describe('formatAssetId', () => {
        it('deve formatar número inteiro com 4 dígitos padronizados', () => {
            expect(formatAssetId(1)).toBe('#EQP-0001');
            expect(formatAssetId(2)).toBe('#EQP-0002');
            expect(formatAssetId(42)).toBe('#EQP-0042');
            expect(formatAssetId(999)).toBe('#EQP-0999');
            expect(formatAssetId(1234)).toBe('#EQP-1234');
        });

        it('deve tratar valores inválidos ou menores que 1', () => {
            expect(formatAssetId(0)).toBe('#EQP-0001');
            expect(formatAssetId(-5)).toBe('#EQP-0001');
            expect(formatAssetId('abc')).toBe('#EQP-0001');
        });
    });

    describe('prepareAssetPayload', () => {
        it('deve montar o payload com todas as 28 colunas físicas e dinâmicas', () => {
            const base = {
                id: '#EQP-0004',
                empresa: 'AUTOKINITON',
                tipo: 'PONTE ROLANTE',
                fabricante: 'DEMAG',
                capacidade: '10t'
            };
            const tpl = {
                id: 'tpl_123',
                nome: 'MODELO PONTE',
                schema: { sections: [{ title: 'Geral' }] }
            };
            const customValues = { campo_tensao: '380V' };

            const payload = prepareAssetPayload(base, tpl, customValues, true);

            expect(payload.id).toBe('#EQP-0004');
            expect(payload.empresa).toBe('AUTOKINITON');
            expect(payload.template_id).toBe('tpl_123');
            expect(payload.template_name).toBe('MODELO PONTE');
            expect(payload.schema_snapshot).toEqual({ sections: [{ title: 'Geral' }] });
            expect(payload.custom_fields).toEqual({ campo_tensao: '380V' });
            expect(payload.is_provisional).toBe(true);
            expect(payload.provisional_id).toBe('#EQP-0004');
            expect(payload.sync_status).toBe('pending_sync');
        });

        it('deve montar payload de ativo clássico legado sem template', () => {
            const base = {
                id: '#EQP-0001',
                empresa: 'AUTOKINITON',
                tipo: 'PONTE ROLANTE'
            };

            const payload = prepareAssetPayload(base, null, {}, false);

            expect(payload.template_id).toBeNull();
            expect(payload.schema_snapshot).toBeNull();
            expect(payload.custom_fields).toEqual({});
            expect(payload.is_provisional).toBe(false);
            expect(payload.sync_status).toBe('synced');
        });
    });

    describe('reconcileLocalEntities', () => {
        it('deve renomear provisório em allAssetsList, openOrders e events sem alterar laudos', () => {
            const stores = {
                allAssetsList: [
                    { id: '#EQP-0004', is_provisional: true, nome: 'PONTE' },
                    { id: '#EQP-0001', is_provisional: false, nome: 'GUINDASTE' }
                ],
                openOrders: [
                    { id: 'ORD-001', equipamentoId: '#EQP-0004', empresa: 'AUTOKINITON' },
                    { id: 'ORD-002', equipamentoId: '#EQP-0001', empresa: 'AUTOKINITON' }
                ],
                events: [
                    { id: '#EQP-0004-2026-08-18', equipamento: '#EQP-0004', date: '2026-08-18' }
                ],
                finalizedReports: [
                    { id: 'REL - 01', equipamentoId: '#EQP-0001' }
                ]
            };

            reconcileLocalEntities('#EQP-0004', '#EQP-0005', stores);

            // allAssetsList reconciliado
            expect(stores.allAssetsList[0].id).toBe('#EQP-0005');
            expect(stores.allAssetsList[0].provisional_id).toBe('#EQP-0004');
            expect(stores.allAssetsList[0].is_provisional).toBe(false);
            expect(stores.allAssetsList[1].id).toBe('#EQP-0001');

            // openOrders reconciliado
            expect(stores.openOrders[0].equipamentoId).toBe('#EQP-0005');
            expect(stores.openOrders[0].equipamentoNome).toBe('#EQP-0005');
            expect(stores.openOrders[1].equipamentoId).toBe('#EQP-0001');

            // events reconciliado
            expect(stores.events[0].equipamento).toBe('#EQP-0005');
            expect(stores.events[0].id).toBe('#EQP-0005-2026-08-18');

            // finalizedReports permanece estritamente intocado
            expect(stores.finalizedReports[0].equipamentoId).toBe('#EQP-0001');
        });
    });

    describe('reserveNextAssetId', () => {
        it('deve chamar RPC server-side quando online', async () => {
            supabase.rpc.mockResolvedValueOnce({ data: 5, error: null });

            const res = await reserveNextAssetId('001');

            expect(supabase.rpc).toHaveBeenCalledWith('reserve_next_asset_number', {
                p_tenant_code: '001'
            });
            expect(res.id).toBe('#EQP-0005');
            expect(res.isProvisional).toBe(false);
            expect(res.sequenceNumber).toBe(5);
        });

        it('deve usar fallback offline quando RPC falhar', async () => {
            supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'Network error' } });
            globalThis.allAssetsList = [
                { id: '#EQP-0001' },
                { id: '#eqp 0002' },
                { id: '#EQP-0003' }
            ];

            const res = await reserveNextAssetId('001');

            expect(res.id).toBe('#EQP-0004');
            expect(res.isProvisional).toBe(true);
            expect(res.sequenceNumber).toBe(4);
        });
    });

    describe('resolveSyncConflict', () => {
        it('deve chamar RPC resolve_sync_conflict com payload e conflictId', async () => {
            supabase.rpc.mockResolvedValueOnce({
                data: { success: true, resolvedAssetId: '#EQP-0005', alreadyResolved: false },
                error: null
            });

            const res = await resolveSyncConflict('conf_uuid_123', 'Homologação confirmada');

            expect(supabase.rpc).toHaveBeenCalledWith('resolve_sync_conflict', {
                p_conflict_id: 'conf_uuid_123',
                p_resolution_notes: 'Homologação confirmada'
            });
            expect(res.success).toBe(true);
            expect(res.resolvedAssetId).toBe('#EQP-0005');
        });

        it('deve lançar erro se a RPC retornar erro do Supabase', async () => {
            supabase.rpc.mockResolvedValueOnce({
                data: null,
                error: { message: 'Acesso Negado: Apenas supervisores autorizados...' }
            });

            await expect(resolveSyncConflict('conf_uuid_123')).rejects.toThrow('Acesso Negado');
        });
    });
});
