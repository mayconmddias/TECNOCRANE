import { describe, it, expect } from 'vitest';
import { calculateGridCardPosition, getRowsPerColumn } from '../../ui-render.js';

describe('Sequência Cronológica Vertical nos Cards de Programação', () => {
    describe('calculateGridCardPosition', () => {
        it('deve distribuir eventos verticalmente na Coluna 1 até preencher a altura (linhas 1 a 5)', () => {
            const rowsPerCol = 5;
            const numCols = 3;

            expect(calculateGridCardPosition(0, rowsPerCol, numCols)).toEqual({ row: 1, col: 1 });
            expect(calculateGridCardPosition(1, rowsPerCol, numCols)).toEqual({ row: 2, col: 1 });
            expect(calculateGridCardPosition(2, rowsPerCol, numCols)).toEqual({ row: 3, col: 1 });
            expect(calculateGridCardPosition(3, rowsPerCol, numCols)).toEqual({ row: 4, col: 1 });
            expect(calculateGridCardPosition(4, rowsPerCol, numCols)).toEqual({ row: 5, col: 1 });
        });

        it('deve mover para o topo da Coluna 2 (linha 1, coluna 2) a partir do 6º evento (índice 5)', () => {
            const rowsPerCol = 5;
            const numCols = 3;

            expect(calculateGridCardPosition(5, rowsPerCol, numCols)).toEqual({ row: 1, col: 2 });
            expect(calculateGridCardPosition(6, rowsPerCol, numCols)).toEqual({ row: 2, col: 2 });
            expect(calculateGridCardPosition(7, rowsPerCol, numCols)).toEqual({ row: 3, col: 2 });
            expect(calculateGridCardPosition(8, rowsPerCol, numCols)).toEqual({ row: 4, col: 2 });
            expect(calculateGridCardPosition(9, rowsPerCol, numCols)).toEqual({ row: 5, col: 2 });
        });

        it('deve mover para o topo da Coluna 3 (linha 1, coluna 3) a partir do 11º evento (índice 10)', () => {
            const rowsPerCol = 5;
            const numCols = 3;

            expect(calculateGridCardPosition(10, rowsPerCol, numCols)).toEqual({ row: 1, col: 3 });
            expect(calculateGridCardPosition(11, rowsPerCol, numCols)).toEqual({ row: 2, col: 3 });
            expect(calculateGridCardPosition(12, rowsPerCol, numCols)).toEqual({ row: 3, col: 3 });
            expect(calculateGridCardPosition(13, rowsPerCol, numCols)).toEqual({ row: 4, col: 3 });
            expect(calculateGridCardPosition(14, rowsPerCol, numCols)).toEqual({ row: 5, col: 3 });
        });

        it('deve iniciar o Bloco 2 abaixo (linha 6, coluna 1) quando exceder os 15 eventos da tela', () => {
            const rowsPerCol = 5;
            const numCols = 3;

            expect(calculateGridCardPosition(15, rowsPerCol, numCols)).toEqual({ row: 6, col: 1 });
            expect(calculateGridCardPosition(16, rowsPerCol, numCols)).toEqual({ row: 7, col: 1 });
            expect(calculateGridCardPosition(20, rowsPerCol, numCols)).toEqual({ row: 6, col: 2 });
            expect(calculateGridCardPosition(25, rowsPerCol, numCols)).toEqual({ row: 6, col: 3 });
        });

        it('deve suportar 8 linhas por coluna quando o calendário for desmarcado', () => {
            const rowsPerCol = 8;
            const numCols = 3;

            // Coluna 1: 0..7
            expect(calculateGridCardPosition(0, rowsPerCol, numCols)).toEqual({ row: 1, col: 1 });
            expect(calculateGridCardPosition(7, rowsPerCol, numCols)).toEqual({ row: 8, col: 1 });

            // Coluna 2: 8..15
            expect(calculateGridCardPosition(8, rowsPerCol, numCols)).toEqual({ row: 1, col: 2 });
            expect(calculateGridCardPosition(15, rowsPerCol, numCols)).toEqual({ row: 8, col: 2 });

            // Coluna 3: 16..23
            expect(calculateGridCardPosition(16, rowsPerCol, numCols)).toEqual({ row: 1, col: 3 });
            expect(calculateGridCardPosition(23, rowsPerCol, numCols)).toEqual({ row: 8, col: 3 });
        });

        it('deve se adaptar corretamente a 2 colunas em telas menores (tablets)', () => {
            const rowsPerCol = 5;
            const numCols = 2;

            // Bloco de 10 eventos
            expect(calculateGridCardPosition(0, rowsPerCol, numCols)).toEqual({ row: 1, col: 1 });
            expect(calculateGridCardPosition(4, rowsPerCol, numCols)).toEqual({ row: 5, col: 1 });
            expect(calculateGridCardPosition(5, rowsPerCol, numCols)).toEqual({ row: 1, col: 2 });
            expect(calculateGridCardPosition(9, rowsPerCol, numCols)).toEqual({ row: 5, col: 2 });
            // Bloco 2
            expect(calculateGridCardPosition(10, rowsPerCol, numCols)).toEqual({ row: 6, col: 1 });
        });

        it('deve lidar com valores limite de forma resiliente', () => {
            expect(calculateGridCardPosition(0, 0, 0)).toEqual({ row: 1, col: 1 });
            expect(calculateGridCardPosition(3, -1, -1)).toEqual({ row: 4, col: 1 });
        });
    });

    describe('getRowsPerColumn', () => {
        it('deve retornar 5 por padrão quando o calendário estiver visível', () => {
            expect(getRowsPerColumn(true)).toBe(5);
        });

        it('deve retornar 8 por padrão quando o calendário estiver oculto', () => {
            expect(getRowsPerColumn(false)).toBe(8);
        });
    });

    describe('Exportação de Programação - Formatação e Técnicos', () => {
        it('deve formatar corretamente técnicos únicos e múltiplos com pipe em maiúsculas', () => {
            const getDisplayTecnicos = (ev) => {
                let display = ev.tecnico || '';
                if (!display && Array.isArray(ev.tecnicos) && ev.tecnicos.length > 0) {
                    display = ev.tecnicos.join(' | ');
                }
                return display ? display.toUpperCase() : '---';
            };

            expect(getDisplayTecnicos({ tecnico: 'José Santos' })).toBe('JOSÉ SANTOS');
            expect(getDisplayTecnicos({ tecnicos: ['Aparecido de Jesus', 'Jose Santos'] })).toBe('APARECIDO DE JESUS | JOSE SANTOS');
            expect(getDisplayTecnicos({})).toBe('---');
        });

        it('deve converter localização para maiúsculas preservando o rótulo', () => {
            const rawLocal = 'bloco a produção';
            const displayLocal = String(rawLocal).toUpperCase();
            expect(displayLocal).toBe('BLOCO A PRODUÇÃO');
            const cardSnippet = `Local: <span class="uppercase">${displayLocal}</span>`;
            expect(cardSnippet).toContain('Local:');
            expect(cardSnippet).toContain('BLOCO A PRODUÇÃO');
        });
    });
});

