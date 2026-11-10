import { describe, it, expect } from 'vitest';
import {
    normalizeComp,
    normalizeAssetId,
    formatReportNumber,
    matchesReportAsset,
    filterReports,
    getReportTechniciansDisplay,
    getNextAvailableReportId
} from './reports-service.js';

describe('Reports Service - Normalizações e Identificadores', () => {
    it('deve normalizar o nome de empresa corretamente', () => {
        expect(normalizeComp('  AUTOKINITON  ')).toBe('autokiniton');
        expect(normalizeComp('Autokiniton Brasil')).toBe('autokiniton brasil');
        expect(normalizeComp('')).toBe('');
        expect(normalizeComp(null)).toBe('');
    });

    it('deve normalizar o ID do ativo removendo caracteres especiais', () => {
        expect(normalizeAssetId('#EQP-0001')).toBe('eqp0001');
        expect(normalizeAssetId('#EQP 0002')).toBe('eqp0002');
        expect(normalizeAssetId('EQP_0003')).toBe('eqp0003');
        expect(normalizeAssetId('  #eqp-0004 ')).toBe('eqp0004');
        expect(normalizeAssetId(null)).toBe('');
    });

    it('deve formatar o número de exibição do relatório adequadamente', () => {
        expect(formatReportNumber({ id: 'REL-01' })).toBe('#01');
        expect(formatReportNumber({ id: 'REL - 05' })).toBe('#05');
        expect(formatReportNumber({ id: '12' })).toBe('#12');
        expect(formatReportNumber({ id: '#99' })).toBe('#99');
        expect(formatReportNumber(null, 2)).toBe('#03');
    });
});

describe('Reports Service - Matching de Ativos', () => {
    const mockAssets = [
        { id: '#EQP-0001', nome: 'PONTE ROLANTE VIGA DUPLA', tipo: 'PONTE ROLANTE', empresa: 'AUTOKINITON' },
        { id: '#EQP 0002', nome: 'PÓRTICO', tipo: 'PÓRTICO ROLANTE', empresa: 'AUTOKINITON' }
    ];

    it('deve casar relatório com ID exato ou formatado', () => {
        const report = { id: 'REL-01', equipamentoId: '#EQP-0001', empresa: 'AUTOKINITON' };
        expect(matchesReportAsset(report, '#EQP-0001', mockAssets)).toBe(true);
        expect(matchesReportAsset(report, '#EQP 0001', mockAssets)).toBe(true);
        expect(matchesReportAsset(report, 'EQP-0001', mockAssets)).toBe(true);
    });

    it('deve casar relatório quando o ativo selecionado for "#EQP 0002" e o relatório contiver o nome "PÓRTICO"', () => {
        const reportLegado = { id: 'REL-02', equipamento: 'PÓRTICO', empresa: 'AUTOKINITON' };
        expect(matchesReportAsset(reportLegado, '#EQP 0002', mockAssets)).toBe(true);
        expect(matchesReportAsset(reportLegado, '#EQP-0002', mockAssets)).toBe(true);
    });

    it('deve casar relatório quando equipamentoNome ou assetInfo contiver o nome ou ID do ativo', () => {
        const reportInfo = { 
            id: 'REL-03', 
            equipamentoNome: 'PONTE ROLANTE VIGA DUPLA', 
            assetInfo: 'PONTE ROLANTE VIGA DUPLA — AUTOKINITON',
            empresa: 'AUTOKINITON' 
        };
        expect(matchesReportAsset(reportInfo, '#EQP-0001', mockAssets)).toBe(true);
    });

    it('não deve casar ativo incompatível', () => {
        const report = { id: 'REL-01', equipamentoId: '#EQP-0001', empresa: 'AUTOKINITON' };
        expect(matchesReportAsset(report, '#EQP 0002', mockAssets)).toBe(false);
    });
});

describe('Reports Service - Filtragem e Ordenação', () => {
    const mockAssets = [
        { id: '#EQP-0001', nome: 'PONTE ROLANTE VIGA DUPLA', tipo: 'PONTE ROLANTE', empresa: 'AUTOKINITON' },
        { id: '#EQP 0002', nome: 'PÓRTICO', tipo: 'PÓRTICO', empresa: 'AUTOKINITON' }
    ];

    const mockReports = [
        { id: 'REL-01', empresa: 'AUTOKINITON', equipamentoId: '#EQP-0001', date: '2026-08-01' },
        { id: 'REL-02', empresa: 'AUTOKINITON', equipamento: 'PÓRTICO', date: '2026-08-05' },
        { id: 'REL-03', empresa: 'OUTRA EMPRESA', equipamentoId: '#EQP-0001', date: '2026-08-10' }
    ];

    it('deve retornar todos os relatórios da empresa quando nenhum ativo estiver selecionado', () => {
        const result = filterReports(mockReports, 'AUTOKINITON', null, mockAssets);
        expect(result).toHaveLength(2);
        expect(result.map(r => r.id)).toEqual(['REL-02', 'REL-01']); // Ordenados por data decrescente
    });

    it('deve filtrar apenas os relatórios correspondentes ao ativo selecionado (#EQP 0002)', () => {
        const result = filterReports(mockReports, 'AUTOKINITON', '#EQP 0002', mockAssets);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('REL-02');
    });

    it('deve filtrar apenas os relatórios correspondentes ao ativo selecionado (#EQP-0001)', () => {
        const result = filterReports(mockReports, 'AUTOKINITON', '#EQP-0001', mockAssets);
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('REL-01');
    });

    it('deve retornar array vazio se a empresa não possuir relatórios', () => {
        const result = filterReports(mockReports, 'EMPRESA INEXISTENTE', null, mockAssets);
        expect(result).toHaveLength(0);
    });

    it('deve retornar array vazio quando nenhuma empresa for fornecida', () => {
        expect(filterReports(mockReports, '', null, mockAssets)).toHaveLength(0);
        expect(filterReports(mockReports, null, null, mockAssets)).toHaveLength(0);
        expect(filterReports([], 'AUTOKINITON', null, mockAssets)).toHaveLength(0);
    });

    it('deve filtrar relatórios de novas empresas como SAS TRANSPORTE corretamente', () => {
        const reportsComSas = [
            ...mockReports,
            { id: 'REL-04', empresa: 'SAS TRANSPORTE', equipamento: 'PÓRTICO', date: '2026-08-24' }
        ];
        const resultSas = filterReports(reportsComSas, 'SAS TRANSPORTE', null, mockAssets);
        expect(resultSas).toHaveLength(1);
        expect(resultSas[0].id).toBe('REL-04');
    });

    it('deve ordenar relatórios rigorosamente por número de relatório de forma decrescente (Opção B)', () => {
        const unSortedReports = [
            { id: 'REL-05', empresa: 'DJT FOCUS LTDA', equipamentoId: '#EQP-0002', date: '08/07/2026' },
            { id: 'REL-08', empresa: 'DJT FOCUS LTDA', equipamentoId: '#EQP-0002', date: '08/06/2026' },
            { id: 'REL-02', empresa: 'DJT FOCUS LTDA', equipamentoId: '#EQP-0002', date: '08/04/2026' },
            { id: 'REL-07', empresa: 'DJT FOCUS LTDA', equipamentoId: '#EQP-0002', date: '07/05/2026' },
            { id: 'REL-03', empresa: 'DJT FOCUS LTDA', equipamentoId: '#EQP-0002', date: '07/03/2026' }
        ];
        const result = filterReports(unSortedReports, 'DJT FOCUS LTDA', '#EQP-0002', []);
        expect(result.map(r => r.id)).toEqual(['REL-08', 'REL-07', 'REL-05', 'REL-03', 'REL-02']);
    });
});

describe('Reports Service - Exibição Estrita de Técnicos (Dual-Technician Display)', () => {
    const mockUsers = [
        { id: '101', name: 'MAYCON DE DIAS', cargo: 'ENGENHEIRO' },
        { id: '102', name: 'CARLOS SILVA', cargo: 'TÉCNICO MECÂNICO' },
        { id: '103', name: 'JOAO SOUZA', cargo: 'SUPERVISOR' }
    ];

    it('deve exibir estritamente os dois técnicos quando dois forem informados', () => {
        const report = {
            id: 'REL-01',
            responsaveis: ['101', '102'],
            tecnico: 'USUARIO LOGADO'
        };
        const display = getReportTechniciansDisplay(report, mockUsers);
        expect(display).toBe('MAYCON DE DIAS / CARLOS SILVA');
    });

    it('deve exibir apenas um técnico quando somente um responsável for selecionado', () => {
        const report = {
            id: 'REL-01',
            responsaveis: ['101'],
            tecnico: 'USUARIO LOGADO'
        };
        const display = getReportTechniciansDisplay(report, mockUsers);
        expect(display).toBe('MAYCON DE DIAS');
    });

    it('deve limitar a exibição a exatamente 2 técnicos mesmo se houver mais de 2 responsáveis', () => {
        const report = {
            id: 'REL-01',
            responsaveis: ['101', '102', '103'],
            tecnico: 'USUARIO LOGADO'
        };
        const display = getReportTechniciansDisplay(report, mockUsers);
        expect(display).toBe('MAYCON DE DIAS / CARLOS SILVA');
    });

    it('deve fazer fallback para report.tecnico se responsaveis for vazio', () => {
        const report = {
            id: 'REL-01',
            responsaveis: [],
            tecnico: 'MAYCON DIAS'
        };
        const display = getReportTechniciansDisplay(report, mockUsers);
        expect(display).toBe('MAYCON DIAS');
    });

    it('deve retornar N/A se nenhum técnico ou responsável estiver presente', () => {
        expect(getReportTechniciansDisplay(null)).toBe('N/A');
        expect(getReportTechniciansDisplay({ responsaveis: [] })).toBe('N/A');
    });
});

describe('Reports Service - Geração de Próximo ID Sequencial com Concorrência', () => {
    it('deve gerar REL - 01 quando não houver relatórios locais nem na nuvem', async () => {
        const nextId = await getNextAvailableReportId([], () => null);
        expect(nextId).toBe('REL - 01');
    });

    it('deve respeitar a sequência local quando a nuvem não tiver relatórios', async () => {
        const local = [{ id: 'REL - 01' }, { id: 'REL - 04' }];
        const nextId = await getNextAvailableReportId(local, () => null);
        expect(nextId).toBe('REL - 05');
    });

    it('deve consultar a nuvem e evitar colisão se outro usuário já gerou ID maior', async () => {
        const local = [{ id: 'REL - 01' }];
        const mockSupabase = {
            from: () => ({
                select: async () => ({
                    data: [{ id: 'REL - 01' }, { id: 'REL - 02' }, { id: 'REL - 05' }],
                    error: null
                })
            })
        };
        const nextId = await getNextAvailableReportId(local, () => mockSupabase);
        expect(nextId).toBe('REL - 06');
    });
});

