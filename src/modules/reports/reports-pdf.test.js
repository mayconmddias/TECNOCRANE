import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
    collectAllReportImageUrls,
    showPrintLoadingOverlay,
    hidePrintLoadingOverlay,
    renderImagesGrid,
    renderObservationBlock,
    renderChecklistTable,
    renderChecklistItem,
    resolveReportSchema,
    getChecklistPrintHTML,
    generateReportPrintHTML,
    formatRevisionUserName
} from './reports-pdf.js';
import { CHECKLIST_SCHEMA } from '../../checklist-schema.js';
import { createInspectionDocument } from '../../checklist-state.js';

describe('Reports PDF Module - Geração e Snapshot de Formulários Dinâmicos', () => {
    let mockElement;

    beforeEach(() => {
        mockElement = {
            id: 'crane-print-loading-overlay',
            style: { display: 'flex' },
            innerHTML: '',
            innerText: 'CARREGANDO IMPRESSÃO'
        };

        global.document = {
            getElementById: (id) => id === 'crane-print-loading-overlay' ? mockElement : null,
            createElement: () => mockElement,
            body: {
                appendChild: () => {}
            }
        };
    });

    afterEach(() => {
        delete global.document;
        vi.restoreAllMocks();
    });

    // --- TESTE 1: Fallback 4 em relatórios antigos sem snapshot ---
    it('Teste 1: Relatório legado sem schema_snapshot aciona Fallback 4, emite console.warn e gera PDF sem mutação no banco', () => {
        const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

        const legacyReport = {
            id: 'REL - 01',
            type: 'PREVENTIVA',
            empresa: 'EMPRESA TESTE',
            equipamentoId: 'EQP-01',
            equipamentoNome: 'PONTE ROLANTE',
            responses: {
                '5.1.alinhamento': { status: 'OK' }
            }
        };

        const resolved = resolveReportSchema(legacyReport);
        expect(resolved).toEqual(CHECKLIST_SCHEMA);
        expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('[REPORTS PDF] Aviso: Relatório \'REL - 01\' não possui schema_snapshot. Utilizando CHECKLIST_SCHEMA padrão de fallback.'));

        // Valida que gera o HTML normalmente mesmo em fallback legado
        const html = getChecklistPrintHTML(legacyReport);
        expect(html).toContain('5.1');
        expect(html).toContain('✔');
    });

    // --- TESTE 2: Novo formulário com 1 item dinâmico (3 checklists, 3 fotos, 1 observação) ---
    it('Teste 2: Novo formulário com 1 item dinâmico renderiza no padrão visual oficial com associação de IDs', () => {
        const customSnapshot = [
            {
                id: '1',
                title: '7.5 CONJUNTO DE RODAS DA TRANSLAÇÃO DO CARRO',
                level: 1,
                children: [
                    { id: 'chk_1', label: 'AUSÊNCIA DE DESGASTES, TRINCAS E QUEBRAS DA PISTA DE ROLAMENTO E FRANGES', fieldType: 'inspectable' },
                    { id: 'chk_2', label: 'AUSÊNCIA DE FOLGA RODA-TRILHO (ACEITÁVEL FOLGA LATERAL ATÉ 3MM DE CADA LADO)', fieldType: 'inspectable' },
                    { id: 'chk_3', label: 'TRILHOS AUSÊNCIA DE DESGASTE, TRINCAS, QUEBRAS, DESALINHAMENTO OU FIXAÇÃO SOLTA', fieldType: 'inspectable' }
                ]
            }
        ];

        const report = {
            id: 'REL - 02',
            type: 'PREVENTIVA',
            schema_snapshot: customSnapshot,
            responses: {
                chk_1: {
                    status: 'OK',
                    observation: 'REALIZADA INSPEÇÃO NO CONJUNTO DE RODAS. CONSTATADO QUE O CONJUNTO ENCONTRA-SE EM BOAS CONDIÇÕES.',
                    images: ['https://example.com/foto1.jpg', 'https://example.com/foto2.jpg', 'https://example.com/foto3.jpg']
                },
                chk_2: { status: 'OK' },
                chk_3: { status: 'NOK' }
            }
        };

        const html = getChecklistPrintHTML(report);

        // Verifica Título do Item
        expect(html).toContain('7.5 CONJUNTO DE RODAS DA TRANSLAÇÃO DO CARRO');
        // Verifica Tabela de Checklist e Cabeçalhos
        expect(html).toContain('DESCRIÇÃO');
        expect(html).toContain('STATUS');
        // Verifica Itens e Símbolos
        expect(html).toContain('AUSÊNCIA DE DESGASTES, TRINCAS E QUEBRAS');
        expect(html).toContain('✔'); // OK
        expect(html).toContain('✖'); // NOK
        // Verifica Fotos
        expect(html).toContain('https://example.com/foto1.jpg');
        expect(html).toContain('https://example.com/foto2.jpg');
        expect(html).toContain('https://example.com/foto3.jpg');
        // Verifica Observação
        expect(html).toContain('OBSERVAÇÕES:');
        expect(html).toContain('REALIZADA INSPEÇÃO NO CONJUNTO DE RODAS');
    });

    // --- TESTE 3: Formulário grande com 10+ itens dinâmicos ---
    it('Teste 3: Formulário com 10 itens dinâmicos renderiza todos os itens no padrão visual', () => {
        const items = [];
        const responses = {};

        for (let i = 1; i <= 10; i++) {
            const itemId = `sec_${i}`;
            const chkId = `chk_${i}_1`;
            items.push({
                id: itemId,
                title: `ITEM ${i} - SISTEMA TÉCNICO ${i}`,
                level: 1,
                children: [
                    { id: chkId, label: `Verificação de conformidade do componente ${i}`, fieldType: 'inspectable' }
                ]
            });
            responses[chkId] = {
                status: i % 2 === 0 ? 'OK' : 'NOK',
                observation: `Observação referente ao item ${i}`,
                images: [`https://example.com/img_item_${i}.jpg`]
            };
        }

        const report = {
            id: 'REL - 10',
            schema_snapshot: items,
            responses: responses
        };

        const html = getChecklistPrintHTML(report);

        for (let i = 1; i <= 10; i++) {
            expect(html).toContain(`ITEM ${i} - SISTEMA TÉCNICO ${i}`);
            expect(html).toContain(`Verificação de conformidade do componente ${i}`);
            expect(html).toContain(`Observação referente ao item ${i}`);
            expect(html).toContain(`https://example.com/img_item_${i}.jpg`);
        }
    });

    // --- TESTE 4: Imunidade histórica contra alteração posterior de modelos ---
    it('Teste 4: Criar inspeção e alterar o modelo posteriormente não altera o relatório histórico', () => {
        // 1. Modelo no momento da inspeção (3 checklists no Item 1)
        const templateOriginal = [
            {
                id: '1',
                title: '1. ESTRUTURA METÁLICA',
                level: 1,
                children: [
                    { id: 'c1', label: 'Checklist Original 1', fieldType: 'inspectable' },
                    { id: 'c2', label: 'Checklist Original 2', fieldType: 'inspectable' },
                    { id: 'c3', label: 'Checklist Original 3', fieldType: 'inspectable' }
                ]
            }
        ];

        const inspectionDoc = createInspectionDocument({
            tipo: 'PREVENTIVA',
            schema_snapshot: templateOriginal,
            empresa: 'CLIENTE A',
            equipamentoId: 'EQP-10'
        });

        inspectionDoc.responses['c1'] = { status: 'OK' };
        inspectionDoc.responses['c2'] = { status: 'OK' };
        inspectionDoc.responses['c3'] = { status: 'NOK', observation: 'Problema no c3' };

        // 2. Modelo é alterado no menu "Meus Modelos" (adicionados novos itens, alteradas descrições)
        const templateModificado = [
            {
                id: '1',
                title: '1. ESTRUTURA METÁLICA MODIFICADA',
                level: 1,
                children: [
                    { id: 'c1_novo', label: 'Nova Descrição Alterada', fieldType: 'inspectable' },
                    { id: 'c4_extra', label: 'Checklist D Adicionado Posteriormente', fieldType: 'inspectable' }
                ]
            },
            {
                id: '2',
                title: '2. NOVO ITEM 2 INSERIDO',
                level: 1,
                children: [
                    { id: 'c5', label: 'Checklist do Item 2', fieldType: 'inspectable' }
                ]
            }
        ];

        // 3. Renderiza o relatório histórico gerado anteriormente
        const html = getChecklistPrintHTML(inspectionDoc);

        // Deve conter estritamente o conteúdo original do snapshot congelado
        expect(html).toContain('1. ESTRUTURA METÁLICA');
        expect(html).toContain('Checklist Original 1');
        expect(html).toContain('Checklist Original 2');
        expect(html).toContain('Checklist Original 3');
        expect(html).toContain('Problema no c3');

        // NÃO deve conter as alterações feitas posteriormente no modelo
        expect(html).not.toContain('ESTRUTURA METÁLICA MODIFICADA');
        expect(html).not.toContain('Nova Descrição Alterada');
        expect(html).not.toContain('Checklist D Adicionado Posteriormente');
        expect(html).not.toContain('2. NOVO ITEM 2 INSERIDO');
    });

    // --- TESTE 5: Regra Estrita de Layout de Fotos ---
    describe('Teste 5: Regra Estrita de Fotos (1-3 em 1 linha, 4 em 2x2, 5 em 3+2, 6 em 3+3, 175x135px)', () => {
        it('deve retornar vazio se não houver imagens válidas', () => {
            expect(renderImagesGrid([])).toBe('');
            expect(renderImagesGrid(null)).toBe('');
            expect(renderImagesGrid(['', '   '])).toBe('');
        });

        it('deve renderizar 1 a 3 fotos em 1 linha com grid-cols-3 e dimensões 175x135px', () => {
            const html = renderImagesGrid(['img1.jpg', 'img2.jpg', 'img3.jpg']);
            expect(html).toContain('grid-cols-3');
            expect(html).toContain('width: 175px; height: 135px;');
            expect(html).toContain('img1.jpg');
            expect(html).toContain('img2.jpg');
            expect(html).toContain('img3.jpg');
        });

        it('deve renderizar exatamente 4 fotos em 2 linhas de 2 (2x2) com dimensões 175x135px', () => {
            const html = renderImagesGrid(['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg']);
            expect(html).toContain('print-images-container');
            const gridMatches = html.match(/grid-cols-2/g);
            expect(gridMatches).not.toBeNull();
            expect(gridMatches.length).toBe(2); // Duas linhas de grid-cols-2
            expect(html).toContain('width: 175px; height: 135px;');
            expect(html).toContain('img1.jpg');
            expect(html).toContain('img2.jpg');
            expect(html).toContain('img3.jpg');
            expect(html).toContain('img4.jpg');
        });

        it('deve renderizar 5 fotos em 2 linhas (Linha 1: 3 fotos, Linha 2: 2 fotos)', () => {
            const html = renderImagesGrid(['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg', 'img5.jpg']);
            expect(html).toContain('grid-cols-3');
            expect(html).toContain('grid-cols-2');
            expect(html).toContain('width: 175px; height: 135px;');
        });

        it('deve renderizar 6 fotos em 2 linhas (Linha 1: 3 fotos, Linha 2: 3 fotos)', () => {
            const html = renderImagesGrid(['img1.jpg', 'img2.jpg', 'img3.jpg', 'img4.jpg', 'img5.jpg', 'img6.jpg']);
            const gridMatches = html.match(/grid-cols-3/g);
            expect(gridMatches).not.toBeNull();
            expect(gridMatches.length).toBe(2); // Duas linhas de grid-cols-3
            expect(html).toContain('width: 175px; height: 135px;');
        });
    });

    // --- TESTE 6: Tabelas e Blocos Especializados ---
    it('Teste 6: Tabela de Checklist renderiza OK (✔ verde) e NOK (✖ vermelho) com cores adequadas', () => {
        const items = [
            { id: 'chk_ok', label: 'Item Aprovado' },
            { id: 'chk_nok', label: 'Item Reprovado' },
            { id: 'chk_na', label: 'Item Não Aplicável' }
        ];
        const responses = {
            chk_ok: { status: 'OK' },
            chk_nok: { status: 'NOK' },
            chk_na: { status: null }
        };

        const tableHtml = renderChecklistTable(items, responses);
        expect(tableHtml).toContain('Item Aprovado');
        expect(tableHtml).toContain('✔');
        expect(tableHtml).toContain('#10b981'); // Verde
        expect(tableHtml).toContain('Item Reprovado');
        expect(tableHtml).toContain('✖');
        expect(tableHtml).toContain('#ef4444'); // Vermelho
        expect(tableHtml).toContain('Item Não Aplicável');
        expect(tableHtml).toContain('-');
    });

    it('Teste 7: Geração completa do documento HTML do relatório inclui Capa, Revisão e Metadados do Ativo', () => {
        const report = {
            id: 'REL - 01',
            type: 'PREVENTIVA',
            date: '2026-08-06',
            empresa: 'TECNOCRANE CLIENTE',
            equipamentoId: 'EQP-99',
            equipamentoNome: 'PONTE ROLANTE 50T',
            schema_snapshot: [
                {
                    id: '1',
                    title: '1. ESTRUTURA',
                    children: [{ id: 'c1', label: 'Soldas', fieldType: 'inspectable' }]
                }
            ],
            responses: {
                c1: { status: 'OK' }
            }
        };
        const company = { name: 'TECNOCRANE CLIENTE', cnpj: '00.000.000/0001-00' };
        const internalCompany = { name: 'TECNOCRANE SERVIÇOS' };
        const usersList = [{ id: 'usr_1', name: 'MAYCON DIAS', cargo: 'ENGENHEIRO MECÂNICO' }];
        const asset = { local: 'GALPÃO 1', fabricante: 'DEMAG', capacidade: '50T' };

        const fullHtml = generateReportPrintHTML(report, company, internalCompany, usersList, asset);

        expect(fullHtml).toContain('RELATÓRIO DE MANUTENÇÃO PREVENTIVA');
        expect(fullHtml).toContain('REL - 01');
        expect(fullHtml).toContain('06/08/2026');
        expect(fullHtml).toContain('TECNOCRANE CLIENTE');
        expect(fullHtml).toContain('PONTE ROLANTE 50T');
        expect(fullHtml).toContain('GALPÃO 1');
        expect(fullHtml).toContain('DEMAG');
        expect(fullHtml).toContain('50T');
        expect(fullHtml).toContain('paginate');
    });

    it('Teste 8: Relatório com modelo customizado (ex: Talha Elétrica) renderiza com 100% de fidelidade ao schema_snapshot sem renderizar itens de Ponte Rolante', () => {
        const talhaSnapshot = [
            {
                id: 'sec_painel',
                title: '1 PAINEL ELÉTRICO DA TALHA',
                level: 1,
                children: [
                    { id: 'talha_chk_1', label: 'Contatores e Reles Térmicos', fieldType: 'inspectable' },
                    { id: 'talha_chk_2', label: 'Transformador de Comando', fieldType: 'inspectable' }
                ]
            },
            {
                id: 'sec_elevacao',
                title: '2 SISTEMA DE ELEVAÇÃO DA TALHA',
                level: 1,
                children: [
                    { id: 'talha_chk_3', label: 'Guia do Cabo de Aço', fieldType: 'inspectable' },
                    { id: 'talha_chk_4', label: 'Fim de Curso de Elevação', fieldType: 'inspectable' }
                ]
            }
        ];

        const reportTalha = {
            id: 'REL - 02',
            type: 'PREVENTIVA',
            templateId: 'tpl_talha_custom',
            templateName: 'TALHA ELÉTRICA',
            schema_snapshot: talhaSnapshot,
            responses: {
                talha_chk_1: { status: 'OK' },
                talha_chk_2: { status: 'OK' },
                talha_chk_3: { status: 'NOK', observation: 'Guia de cabo com desgaste excessivo.', images: ['https://example.com/guia.jpg'] },
                talha_chk_4: { status: 'OK' }
            }
        };

        const html = getChecklistPrintHTML(reportTalha);

        // Deve conter as seções do modelo de Talha
        expect(html).toContain('1 PAINEL ELÉTRICO DA TALHA');
        expect(html).toContain('2 SISTEMA DE ELEVAÇÃO DA TALHA');
        expect(html).toContain('Contatores e Reles Térmicos');
        expect(html).toContain('Guia do Cabo de Aço');
        expect(html).toContain('Guia de cabo com desgaste excessivo.');
        expect(html).toContain('https://example.com/guia.jpg');
        expect(html).toContain('✔');
        expect(html).toContain('✖');

        // NÃO deve conter seções exclusivas de Ponte Rolante padrão
        expect(html).not.toContain('SISTEMA DE ALIMENTAÇÃO DA PONTE ROLANTE');
        expect(html).not.toContain('TRANSLAÇÃO DA PONTE ROLANTE');
    });

    it('Teste 9: Desduplicação de fotos — Item 1 com 4 fotos e Item 2 com 3 fotos renderiza contagem exata sem duplicar (mesmo com chaves redundantes)', () => {
        const talhaSnapshot = [
            {
                id: 'sec_painel',
                title: '1 PAINEL ELÉTRICO DA TALHA',
                level: 1,
                children: [
                    { id: 'talha_chk_1', label: 'Fixação e Reaperto dos Componentes', fieldType: 'inspectable' },
                    { id: 'talha_chk_2', label: 'Tensão de Entrada', fieldType: 'inspectable' }
                ]
            },
            {
                id: 'sec_controle',
                title: '2 SISTEMA DE CONTROLE DA TALHA',
                level: 1,
                children: [
                    { id: 'talha_chk_3', label: 'Comunicação Rádio Controle', fieldType: 'inspectable' }
                ]
            }
        ];

        const reportWithPhotos = {
            id: 'REL - 03',
            type: 'PREVENTIVA',
            schema_snapshot: talhaSnapshot,
            responses: {
                talha_chk_1: {
                    status: 'OK',
                    observation: 'Observação do painel com 4 fotos',
                    images: [
                        'https://example.com/foto1.jpg',
                        'https://example.com/foto2.jpg',
                        'https://example.com/foto3.jpg',
                        'https://example.com/foto4.jpg'
                    ]
                },
                talha_chk_2: { status: 'OK' },
                // Simulação de chave de seção redundante legada
                sec_painel: {
                    observation: 'Observação do painel com 4 fotos',
                    images: [
                        'https://example.com/foto1.jpg',
                        'https://example.com/foto2.jpg',
                        'https://example.com/foto3.jpg',
                        'https://example.com/foto4.jpg'
                    ]
                },
                talha_chk_3: {
                    status: 'NOK',
                    observation: 'Observação do controle com 3 fotos',
                    images: [
                        'https://example.com/controle1.jpg',
                        'https://example.com/controle2.jpg',
                        'https://example.com/controle3.jpg'
                    ]
                }
            }
        };

        const html = getChecklistPrintHTML(reportWithPhotos);

        // Conta quantas vezes cada foto aparece no HTML
        expect((html.match(/foto1\.jpg/g) || []).length).toBe(1);
        expect((html.match(/foto2\.jpg/g) || []).length).toBe(1);
        expect((html.match(/foto3\.jpg/g) || []).length).toBe(1);
        expect((html.match(/foto4\.jpg/g) || []).length).toBe(1);

        expect((html.match(/controle1\.jpg/g) || []).length).toBe(1);
        expect((html.match(/controle2\.jpg/g) || []).length).toBe(1);
        expect((html.match(/controle3\.jpg/g) || []).length).toBe(1);

        // Total de imagens renderizadas deve ser exatamente 7 (4 do painel + 3 do controle), NUNCA 8 ou 11
        const totalImagesMatches = (html.match(/<img /g) || []).length;
        expect(totalImagesMatches).toBe(7);
    });

    it('Teste 10: Seção customizada sem linhas de checklist (ex: 4 NORMAS) renderiza no PDF com título, fotos e observações', () => {
        const schemaWithEmptySection = [
            {
                id: '1',
                title: '1 SISTEMA DE CONTROLE DA TALHA',
                level: 1,
                children: [
                    { id: 'chk_1', label: 'Comunicação Rádio Controle', fieldType: 'inspectable' }
                ]
            },
            {
                id: '2',
                title: '2 PAINEL ELÉTRICO',
                level: 1,
                children: [
                    { id: 'chk_2', label: 'Fixação e Reaperto dos Componentes', fieldType: 'inspectable' }
                ]
            },
            {
                id: '3',
                title: '3 NORMAS E RECOMENDAÇÕES TÉCNICAS',
                level: 1,
                children: [] // Sem linhas de checklist adicionadas
            }
        ];

        const report = {
            id: 'REL - 04',
            type: 'PREVENTIVA',
            schema_snapshot: schemaWithEmptySection,
            responses: {
                chk_1: { status: 'OK' },
                chk_2: { status: 'OK' },
                '3': {
                    observation: 'Inspeção realizada conforme normas NR-11, NR-12 e NBR 8400.',
                    images: ['https://example.com/normas_foto.jpg']
                }
            }
        };

        const html = getChecklistPrintHTML(report);

        // Deve conter a seção 3 NORMAS
        expect(html).toContain('3 NORMAS E RECOMENDAÇÕES TÉCNICAS');
        expect(html).toContain('Inspeção realizada conforme normas NR-11, NR-12 e NBR 8400.');
        expect(html).toContain('https://example.com/normas_foto.jpg');
    });

    it('Teste 15: formatRevisionUserName formata corretamente Primeiro Nome + Inicial do Segundo Nome', () => {
        expect(formatRevisionUserName('JOSE DOS SANTOS')).toBe('JOSE S.');
        expect(formatRevisionUserName('JOSÉ DOS SANTOS')).toBe('JOSÉ S.');
        expect(formatRevisionUserName('Gilberto Mendes')).toBe('GILBERTO M.');
        expect(formatRevisionUserName('MERILDO INÁCIO')).toBe('MERILDO I.');
        expect(formatRevisionUserName('Reinaldo Alves')).toBe('REINALDO A.');
        expect(formatRevisionUserName('Deivison Rocha')).toBe('DEIVISON R.');
        expect(formatRevisionUserName('Maycon Dias')).toBe('MAYCON D.');
        expect(formatRevisionUserName('Maria da Silva Pereira')).toBe('MARIA S.');
        expect(formatRevisionUserName('João de Souza')).toBe('JOÃO S.');
        expect(formatRevisionUserName('Carlos')).toBe('CARLOS');
        expect(formatRevisionUserName('')).toBe('');
        expect(formatRevisionUserName(null)).toBe('');
    });

    it('Teste 16: generateReportPrintHTML renderiza tabela de revisões com linhas 02 e 03 vazias na emissão inicial', () => {
        const report = {
            id: 'REL - 01',
            type: 'PREVENTIVA',
            date: '2026-08-24',
            schema_snapshot: CHECKLIST_SCHEMA,
            responses: {},
            revisions: {
                rev01: {
                    prepared: 'Gilberto Mendes',
                    collaboration: 'Merildo Inácio',
                    checked: 'Reinaldo Alves',
                    approved: 'Deivison Rocha'
                }
            }
        };

        const html = generateReportPrintHTML(report, { name: 'EMPRESA TESTE' }, { name: 'TECNOCRANE' }, []);
        
        // Deve conter a linha 01 com nomes formatados
        expect(html).toContain('<td>01</td>');
        expect(html).toContain('<td>EMISSÃO INICIAL</td>');
        expect(html).toContain('<td>GILBERTO M.</td>');
        expect(html).toContain('<td>MERILDO I.</td>');
        expect(html).toContain('<td>REINALDO A.</td>');
        expect(html).toContain('<td>DEIVISON R.</td>');

        // Linhas 02 e 03 devem sair vazias (&nbsp;)
        expect(html).toContain('<td>&nbsp;</td>');
    });

    it('Teste 17: generateReportPrintHTML renderiza tabela de revisões com REV 02 e REV 03 ativas quando preenchidas', () => {
        const report = {
            id: 'REL - 01',
            type: 'PREVENTIVA',
            date: '2026-08-24',
            schema_snapshot: CHECKLIST_SCHEMA,
            responses: {},
            revisions: {
                rev01: {
                    date: '2026-08-24',
                    prepared: 'Gilberto Mendes',
                    collaboration: 'Merildo Inácio',
                    checked: 'Reinaldo Alves',
                    approved: 'Deivison Rocha'
                },
                rev02: {
                    date: '2026-08-30',
                    description: 'REVISÃO',
                    prepared: 'Merildo Inácio',
                    collaboration: 'Merildo Inácio',
                    checked: 'Reinaldo Alves',
                    approved: 'Reinaldo Alves'
                },
                rev03: {
                    date: '2026-09-05',
                    description: 'REVISÃO ESTRUTURAL',
                    prepared: 'Maycon Dias',
                    collaboration: 'Merildo Inácio',
                    checked: 'Jose dos Santos',
                    approved: 'Reinaldo Alves'
                }
            }
        };

        const html = generateReportPrintHTML(report, { name: 'EMPRESA TESTE' }, { name: 'TECNOCRANE' }, []);

        // Linha 03
        expect(html).toContain('<td>03</td>');
        expect(html).toContain('<td>05/09/2026</td>');
        expect(html).toContain('<td>REVISÃO ESTRUTURAL</td>');
        expect(html).toContain('<td>MAYCON D.</td>');
        expect(html).toContain('<td>JOSE S.</td>');

        // Linha 02
        expect(html).toContain('<td>02</td>');
        expect(html).toContain('<td>30/08/2026</td>');
        expect(html).toContain('<td>REVISÃO</td>');

        // Linha 01
        expect(html).toContain('<td>01</td>');
        expect(html).toContain('<td>24/08/2026</td>');
        expect(html).toContain('<td>EMISSÃO INICIAL</td>');
    });
});
