import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    parseAssetSequenceNumber,
    formatAssetId,
    prepareAssetPayload,
    reconcileLocalEntities,
    reserveNextAssetId,
    resolveSyncConflict,
    getAssetTechnicalFields
} from './assets-service.js';

// Mock Supabase
vi.mock('../../supabase.js', () => ({
    isSupabaseConfigured: true,
    getTenantCode: vi.fn().mockReturnValue('001'),
    dbFetchAll: vi.fn().mockResolvedValue([]),
    dbUpsert: vi.fn().mockResolvedValue({}),
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
                capacidade: '10t',
                foto: 'data:image/png;base64,sample'
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
            expect(payload.foto).toBe('data:image/png;base64,sample');
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
                { id: '#EQP-0001', empresa: 'Empresa A' },
                { id: '#eqp 0002', empresa: 'Empresa B' },
                { id: '#EQP-0003', empresa: 'Empresa A' }
            ];

            const res = await reserveNextAssetId('001');

            expect(res.id).toBe('#EQP-0004');
            expect(res.isProvisional).toBe(true);
            expect(res.sequenceNumber).toBe(4);
        });

        it('deve considerar chaves de tenant crane_001_all_assets no localStorage para não repetir IDs entre empresas', async () => {
            supabase.rpc.mockResolvedValueOnce({ data: null, error: { message: 'RPC Error' } });
            globalThis.allAssetsList = [];
            
            const localStorageMock = {
                'crane_001_all_assets': JSON.stringify([
                    { id: '#EQP-0001', empresa: 'DJT FOCUS' }
                ])
            };
            const originalLocalStorage = globalThis.localStorage;
            globalThis.localStorage = {
                getItem: vi.fn(k => localStorageMock[k] || null)
            };

            const res = await reserveNextAssetId('001');

            expect(res.id).toBe('#EQP-0002');
            expect(res.sequenceNumber).toBe(2);

            globalThis.localStorage = originalLocalStorage;
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

    describe('getAssetTechnicalFields', () => {
        it('deve retornar exatamente 21 campos técnicos para ativo padrão do sistema (Ponte Rolante)', () => {
            const asset = {
                id: '#EQP-0001',
                tipo: 'PONTE ROLANTE VIGA DUPLA',
                local: 'Armazém A',
                fabricante: 'Demag',
                capacidade: '32 TON',
                vao: '19.730 MTS',
                altura: '12 MTS'
            };

            const fields = getAssetTechnicalFields(asset);

            expect(fields).toHaveLength(21);
            expect(fields.find(f => f.id === 'cf_16_local_setor').value).toBe('ARMAZÉM A');
            expect(fields.find(f => f.id === 'cf_17_fabricante').value).toBe('DEMAG');
            expect(fields.find(f => f.id === 'cf_2_cap_principal').value).toBe('32 TON');
            expect(fields.find(f => f.id === 'cf_7_vao_ponte').value).toBe('19.730 MTS');
            expect(fields.find(f => f.id === 'cf_6_altura_elevacao').value).toBe('12 MTS');
            // Campos não preenchidos devem ter fallback seguro 'N/A'
            expect(fields.find(f => f.id === 'cf_8_tensao_alim').value).toBe('N/A');
        });

        it('deve retornar exatamente os campos do modelo customizado (ex: Talha Elétrica com 10 campos)', () => {
            const talhaTemplate = {
                id: 'tpl_talha_10',
                nome: 'Talha Elétrica',
                tipoEquipamento: 'TALHA ELETRICA',
                customFields: [
                    { id: 'tf_1', label: 'Capacidade de Carga' },
                    { id: 'tf_2', label: 'Altura de Elevação' },
                    { id: 'tf_3', label: 'Velocidade de Elevação' },
                    { id: 'tf_4', label: 'Velocidade de Translação' },
                    { id: 'tf_5', label: 'Tipo de Gancho' },
                    { id: 'tf_6', label: 'Diâmetro do Cabo' },
                    { id: 'tf_7', label: 'Potência do Motor' },
                    { id: 'tf_8', label: 'Tensão Elétrica' },
                    { id: 'tf_9', label: 'Classificação FEM' },
                    { id: 'tf_10', label: 'Fabricante da Talha' }
                ]
            };

            const asset = {
                id: '#EQP-0002',
                tipo: 'TALHA ELETRICA',
                template_id: 'tpl_talha_10',
                custom_fields: {
                    tf_1: '5 TON',
                    tf_2: '9 MTS',
                    tf_6: '12 mm',
                    tf_10: 'Kito'
                }
            };

            const fields = getAssetTechnicalFields(asset, { template: talhaTemplate });

            expect(fields).toHaveLength(10);
            expect(fields[0].displayLabel).toBe('CAPACIDADE DE CARGA');
            expect(fields[0].value).toBe('5 TON');
            expect(fields[1].value).toBe('9 MTS');
            expect(fields[5].value).toBe('12 MM');
            expect(fields[9].value).toBe('KITO');
            expect(fields[4].value).toBe('N/A');
        });

        it('deve resolver dinamicamente o modelo pelo tipo de equipamento mesmo se template_id estiver na semente', () => {
            const talhaTemplate = {
                id: 'asstpl_talha_real',
                nome: 'Talha Elétrica',
                tipoEquipamento: 'TALHA ELETRICA',
                customFields: [
                    { id: 'f_cap', label: 'Capacidade de Peso' },
                    { id: 'f_alt', label: 'Altura de Elevação' },
                    { id: 'f_vel', label: 'Velocidade' },
                    { id: 'f_fab', label: 'Fabricante' }
                ]
            };

            const asset = {
                id: '#EQP-0004',
                tipo: 'TALHA ELETRICA',
                template_id: 'asstpl_default_ponte_viga_dupla', // semente antiga de teste
                fabricante: 'TECNOCRANE',
                capacidade: '32 TON',
                custom_fields: {
                    f_alt: '15 MTS'
                }
            };

            const fields = getAssetTechnicalFields(asset, {
                templates: [talhaTemplate],
                getTemplateById: (id) => id === 'asstpl_talha_real' ? talhaTemplate : null
            });

            expect(fields).toHaveLength(4);
            expect(fields.find(f => f.id === 'f_fab').value).toBe('TECNOCRANE');
            expect(fields.find(f => f.id === 'f_cap').value).toBe('32 TON');
            expect(fields.find(f => f.id === 'f_alt').value).toBe('15 MTS');
            expect(fields.find(f => f.id === 'f_vel').value).toBe('N/A');
        });

        it('deve retornar array vazio se asset for nulo ou indefinido', () => {
            expect(getAssetTechnicalFields(null)).toEqual([]);
            expect(getAssetTechnicalFields(undefined)).toEqual([]);
        });
    });

    describe('reserveNextAssetId - proteção contra reutilização de IDs históricos', () => {
        it('deve considerar IDs presentes em window.finalizedReports e window.eventsList além de allAssetsList', async () => {
            globalThis.window = {
                allAssetsList: [{ id: '#EQP-0002' }],
                finalizedReports: [{ id: 'REL - 11', equipamentoId: '#EQP-0004' }],
                eventsList: [{ id: '#EQP-0003-2026-11-02', equipamento: '#EQP-0003' }]
            };
            const res = await reserveNextAssetId('001');
            expect(res.id).toBe('#EQP-0005');
            expect(res.sequenceNumber).toBe(5);
            delete globalThis.window;
        });
    });
});
