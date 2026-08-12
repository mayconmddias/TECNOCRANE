import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { collectAllReportImageUrls, showPrintLoadingOverlay, hidePrintLoadingOverlay } from './reports-pdf.js';

describe('Reports PDF Module - Deterministic Preloader & Overlay', () => {
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
    });

    it('deve extrair deterministicamente todas as URLs de mídias do relatório e empresas', () => {
        const company = { logo: 'https://example.com/company_logo.png' };
        const internalCompany = { logo: 'https://example.com/internal_logo.png' };
        const usersList = [
            { id: 'usr_1', signature: 'https://example.com/sig_1.png' },
            { id: 'usr_2', signature: 'https://example.com/sig_2.png' }
        ];
        const report = {
            generalImages: ['https://example.com/gen1.jpg'],
            responses: {
                item_1: {
                    images: ['https://example.com/item1.jpg'],
                    additionalObservations: [
                        { images: ['https://example.com/add1.jpg'] }
                    ]
                }
            },
            responsaveis: ['usr_1', 'usr_2']
        };

        const urls = collectAllReportImageUrls(report, company, internalCompany, usersList);
        expect(urls).toContain('https://example.com/company_logo.png');
        expect(urls).toContain('https://example.com/internal_logo.png');
        expect(urls).toContain('https://example.com/gen1.jpg');
        expect(urls).toContain('https://example.com/item1.jpg');
        expect(urls).toContain('https://example.com/add1.jpg');
        expect(urls).toContain('https://example.com/sig_1.png');
        expect(urls).toContain('https://example.com/sig_2.png');
        expect(urls.length).toBe(7);
    });

    it('deve exibir e ocultar o overlay com o texto "Carregando Impressão"', () => {
        showPrintLoadingOverlay();
        const overlay = global.document.getElementById('crane-print-loading-overlay');
        expect(overlay).not.toBeNull();
        expect(overlay.style.display).toBe('flex');

        hidePrintLoadingOverlay();
        expect(overlay.style.display).toBe('none');
    });
});
