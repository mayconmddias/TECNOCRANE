import { describe, it, expect } from 'vitest';
import { findMatchingAssetForEvent } from '../../ui-render.js';
import {
    calculateRecurringDate,
    buildScheduledEventId,
    filterEventsOnSingleDelete,
    filterEventsOnGroupDelete,
    getEventCloudIdsToDelete,
    generateScheduledEvents,
    formatCompanyAddress,
    formatDateCardDisplay
} from './scheduling-service.js';

describe('Módulo de Agendamento - calculateRecurringDate', () => {
    it('deve preservar a data original quando monthIndex for 0', () => {
        expect(calculateRecurringDate('2026-10-15', 0)).toBe('2026-10-15');
    });

    it('deve antecipar de Domingo para Sexta-feira (exemplo do usuário 15/10/2026 -> 13/11/2026)', () => {
        // 15/10/2026 é Quinta-feira.
        // 15/11/2026 é Domingo -> deve antecipar 2 dias para 13/11/2026 (Sexta-feira).
        const nextDate = calculateRecurringDate('2026-10-15', 1);
        expect(nextDate).toBe('2026-11-13');

        // Confirma que o dia retornado é realmente uma Sexta-feira (day 5)
        const d = new Date(nextDate + 'T12:00:00');
        expect(d.getDay()).toBe(5);
    });

    it('deve antecipar de Sábado para Sexta-feira', () => {
        // 15/07/2026 é Quarta-feira.
        // 15/08/2026 é Sábado -> deve antecipar 1 dia para 14/08/2026 (Sexta-feira).
        const nextDate = calculateRecurringDate('2026-07-15', 1);
        expect(nextDate).toBe('2026-08-14');

        const d = new Date(nextDate + 'T12:00:00');
        expect(d.getDay()).toBe(5);
    });

    it('deve manter a data nominal quando cair em dia útil (Segunda a Sexta)', () => {
        // 15/10/2026 + 2 meses -> 15/12/2026 (Terça-feira, day 2)
        const nextDate = calculateRecurringDate('2026-10-15', 2);
        expect(nextDate).toBe('2026-12-15');

        const d = new Date(nextDate + 'T12:00:00');
        expect(d.getDay()).toBe(2);
    });

    it('deve tratar overflow de final de mês corretamente (ex: dia 31 para Fevereiro)', () => {
        // 31/01/2026 + 1 mês -> Fevereiro tem 28 dias.
        // 28/02/2026 é Sábado -> deve antecipar 1 dia para 27/02/2026 (Sexta-feira).
        const nextDate = calculateRecurringDate('2026-01-31', 1);
        expect(nextDate).toBe('2026-02-27');

        const d = new Date(nextDate + 'T12:00:00');
        expect(d.getDay()).toBe(5);
    });

    it('deve lidar com virada de ano com precisão', () => {
        // 10/11/2026 + 3 meses -> Fevereiro de 2027.
        // 10/02/2027 é Quarta-feira.
        const nextDate = calculateRecurringDate('2026-11-10', 3);
        expect(nextDate).toBe('2027-02-10');
    });

    it('deve retornar a data original caso os argumentos sejam inválidos', () => {
        expect(calculateRecurringDate('', 1)).toBe('');
        expect(calculateRecurringDate(null, 1)).toBe(null);
        expect(calculateRecurringDate('2026-10-15', -1)).toBe('2026-10-15');
        expect(calculateRecurringDate('data-invalida', 1)).toBe('data-invalida');
    });
});

describe('Módulo de Agendamento - Gestão e Exclusão de Eventos', () => {
    it('buildScheduledEventId deve formatar id padrão equipamento-data', () => {
        expect(buildScheduledEventId('#EQP-0001', '2026-10-15')).toBe('#EQP-0001-2026-10-15');
        expect(buildScheduledEventId('', '2026-10-15')).toBe('');
        expect(buildScheduledEventId('#EQP-0001', '')).toBe('');
    });

    it('filterEventsOnSingleDelete deve remover apenas o evento alvo', () => {
        const events = [
            { id: '#EQP-0001-2026-10-15', equipamento: '#EQP-0001' },
            { id: '#EQP-0002-2026-10-16', equipamento: '#EQP-0002' },
            { id: '#EQP-0001-2026-11-13', equipamento: '#EQP-0001' }
        ];

        const filtered = filterEventsOnSingleDelete(events, '#EQP-0001-2026-10-15');
        expect(filtered).toHaveLength(2);
        expect(filtered.some(e => e.id === '#EQP-0001-2026-10-15')).toBe(false);
        expect(filtered.some(e => e.id === '#EQP-0001-2026-11-13')).toBe(true);
    });

    it('filterEventsOnGroupDelete deve remover todos os eventos com mesmo groupId', () => {
        const events = [
            { id: '#EQP-0001-2026-10-15', groupId: 100 },
            { id: '#EQP-0001-2026-11-13', groupId: 100 },
            { id: '#EQP-0002-2026-10-15', groupId: 200 }
        ];

        const filtered = filterEventsOnGroupDelete(events, 100);
        expect(filtered).toHaveLength(1);
        expect(filtered[0].id).toBe('#EQP-0002-2026-10-15');
    });

    it('getEventCloudIdsToDelete deve retornar lista correta de IDs para exclusão na nuvem', () => {
        const events = [
            { id: '#EQP-0001-2026-10-15', groupId: 'GRP-1' },
            { id: '#EQP-0001-2026-11-13', groupId: 'GRP-1' },
            { id: '#EQP-0002-2026-10-15', groupId: null }
        ];

        // Exclusão individual
        const singleIds = getEventCloudIdsToDelete(events, '#EQP-0001-2026-10-15', false);
        expect(singleIds).toEqual(['#EQP-0001-2026-10-15']);

        // Exclusão de toda recorrência
        const groupIds = getEventCloudIdsToDelete(events, '#EQP-0001-2026-10-15', true);
        expect(groupIds).toEqual(['#EQP-0001-2026-10-15', '#EQP-0001-2026-11-13']);

        // Evento avulso sem groupId tentando exclusão em grupo
        const soloIds = getEventCloudIdsToDelete(events, '#EQP-0002-2026-10-15', true);
        expect(soloIds).toEqual(['#EQP-0002-2026-10-15']);
    });

    it('generateScheduledEvents deve gerar eventos com recorrência e IDs únicos', () => {
        const generated = generateScheduledEvents({
            empresa: 'EMPRESA TESTE',
            equipamento: '#EQP-0005',
            baseDate: '2026-10-15',
            recorrencia: 2,
            tec1: 'João Silva',
            assetTipo: 'TALHA ELETRICA'
        });

        expect(generated).toHaveLength(2);
        expect(generated[0].id).toBe('#EQP-0005-2026-10-15');
        expect(generated[0].groupId).not.toBeNull();
        expect(generated[0].groupId).toBe(generated[1].groupId);
        expect(generated[1].id).toBe('#EQP-0005-2026-11-13'); // Domingo ajustado para Sexta
    });
});

describe('Módulo de Agendamento - formatCompanyAddress', () => {
    it('deve formatar endereço completo com rua, número, bairro, cidade e estado', () => {
        const company = {
            name: 'DJT FOCUS',
            endereco: 'Rua das Indústrias',
            numero: '450',
            bairro: 'Distrito Industrial',
            cidade: 'Campinas',
            estado: 'SP'
        };
        expect(formatCompanyAddress(company)).toBe('RUA DAS INDÚSTRIAS, Nº 450 - DISTRITO INDUSTRIAL - CAMPINAS - SP');
    });

    it('deve formatar sem número quando não preenchido', () => {
        const company = {
            name: 'DJT FOCUS',
            endereco: 'Avenida Brasil',
            bairro: 'Centro',
            cidade: 'São Paulo',
            estado: 'SP'
        };
        expect(formatCompanyAddress(company)).toBe('AVENIDA BRASIL - CENTRO - SÃO PAULO - SP');
    });

    it('deve retornar mensagem padrão quando objeto for nulo ou vazio', () => {
        expect(formatCompanyAddress(null)).toBe('ENDEREÇO NÃO CADASTRADO');
        expect(formatCompanyAddress({})).toBe('ENDEREÇO NÃO CADASTRADO');
    });
});

describe('Módulo de Agendamento - formatDateCardDisplay', () => {
    it('deve formatar data no formato DD-MM-YYYY e dia da semana por extenso', () => {
        // 09-10-2026 é uma Sexta-feira
        const res = formatDateCardDisplay('2026-10-09');
        expect(res.dateFormatted).toBe('09-10-2026');
        expect(res.weekday).toBe('Sexta');
    });

    it('deve formatar Segunda-feira 12-10-2026', () => {
        const res = formatDateCardDisplay('2026-10-12');
        expect(res.dateFormatted).toBe('12-10-2026');
        expect(res.weekday).toBe('Segunda');
    });

    it('deve tratar entradas inválidas de forma segura', () => {
        expect(formatDateCardDisplay('')).toEqual({ dateFormatted: '--/--/----', weekday: '---' });
        expect(formatDateCardDisplay('invalido')).toEqual({ dateFormatted: '--/--/----', weekday: '---' });
    });
});

describe('Módulo de Agendamento - findMatchingAssetForEvent (Isolamento por Empresa)', () => {
    const candidateAssets = [
        { id: '#EQP-0002', empresa: 'SAS Transporte', nome: 'TALHA ELETRICA', tipo: 'TALHA ELETRICA' },
        { id: '#EQP-0003', empresa: 'SAS Transporte', nome: 'PONTE ROLANTE VIGA DUPLA', tipo: 'PONTE ROLANTE VIGA DUPLA' }
    ];

    it('nunca deve retornar ativo de outra empresa quando houver colisão de ID', () => {
        const djtEvent = {
            id: '#EQP-0002-2026-11-11',
            empresa: 'DJT FOCUS LTDA',
            equipamento: '#EQP-0002',
            tipo: 'GUINDASTE DE COLUNA'
        };
        const matched = findMatchingAssetForEvent(djtEvent, candidateAssets);
        expect(matched).toBeUndefined();
    });

    it('deve retornar o ativo correspondente quando ID e empresa coincidirem (case-insensitive)', () => {
        const sasEvent = {
            id: '#EQP-0003-2026-11-02',
            empresa: 'sas transporte',
            equipamento: '#EQP-0003'
        };
        const matched = findMatchingAssetForEvent(sasEvent, candidateAssets);
        expect(matched?.nome).toBe('PONTE ROLANTE VIGA DUPLA');
    });
});

