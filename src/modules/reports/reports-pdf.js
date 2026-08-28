/**
 * Crane Pro - Módulo de Geração e Impressão de Relatórios PDF
 * Padrão Visual Oficial e Snapshot Congelado (Offline-First & Read-Only)
 */

import { CHECKLIST_SCHEMA } from '../../checklist-schema.js';
import { getDBValue, getStoredData } from '../../data.js';

/**
 * Exibe o overlay de progresso com a mensagem "Carregando Impressão"
 */
export function showPrintLoadingOverlay() {
    if (typeof document === 'undefined') return;
    let overlay = document.getElementById('crane-print-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'crane-print-loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(6px);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        `;
        overlay.innerHTML = `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 28px 40px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
                <div style="width: 48px; height: 48px; border: 4px solid #334155; border-top-color: #facc15; border-radius: 50%; animation: craneSpin 0.8s linear infinite; margin: 0 auto 16px auto;"></div>
                <div style="font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #f8fafc;">Carregando Impressão</div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;">Preparando mídias e diagramação A4...</div>
            </div>
            <style>
                @keyframes craneSpin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
}

/**
 * Oculta o overlay de carregamento
 */
export function hidePrintLoadingOverlay() {
    if (typeof document === 'undefined') return;
    const overlay = document.getElementById('crane-print-loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

/**
 * Escapa strings para inserção segura em HTML
 */
export function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Renderiza o bloco de fotos respeitando rigorosamente a regra visual do Crane Pro:
 * - 1 a 3 fotos: Linha única com até 3 fotos centralizadas
 * - 4 fotos: Linha 1 (2 fotos) e Linha 2 (2 fotos)
 * - 5 fotos: Linha 1 (3 fotos) e Linha 2 (2 fotos)
 * - 6 fotos: Linha 1 (3 fotos) e Linha 2 (3 fotos)
 * - Dimensões estritas: 175px de largura por 135px de altura
 */
export function renderImagesGrid(images) {
    if (!images || !Array.isArray(images)) return '';
    const validImgs = images.filter(img => img && String(img).trim() !== "");
    if (validImgs.length === 0) return '';

    const count = validImgs.length;
    const imgStyle = 'width: 175px; height: 135px; object-fit: cover; border: 1px solid #e5e7eb; border-radius: 6px;';

    if (count <= 3) {
        return `
        <div class="print-images-grid grid-cols-3" style="display: flex; flex-wrap: wrap; gap: 10px; margin-top: 6px; margin-bottom: 6px; justify-content: center; align-items: center; width: 100%; max-width: 555px; margin-left: auto; margin-right: auto; page-break-inside: avoid;">
            ${validImgs.map(img => `<img src="${img}" alt="Foto da Inspeção" style="${imgStyle}">`).join('')}
        </div>`;
    }

    if (count === 4) {
        const line1 = validImgs.slice(0, 2);
        const line2 = validImgs.slice(2, 4);
        return `
        <div class="print-images-container" style="display: flex; flex-direction: column; gap: 10px; margin-top: 6px; margin-bottom: 6px; align-items: center; width: 100%; page-break-inside: avoid;">
            <div class="print-images-grid grid-cols-2" style="display: flex; gap: 10px; justify-content: center; width: 100%; max-width: 460px;">
                ${line1.map(img => `<img src="${img}" alt="Foto da Inspeção" style="${imgStyle}">`).join('')}
            </div>
            <div class="print-images-grid grid-cols-2" style="display: flex; gap: 10px; justify-content: center; width: 100%; max-width: 460px;">
                ${line2.map(img => `<img src="${img}" alt="Foto da Inspeção" style="${imgStyle}">`).join('')}
            </div>
        </div>`;
    }

    if (count === 5) {
        const line1 = validImgs.slice(0, 3);
        const line2 = validImgs.slice(3, 5);
        return `
        <div class="print-images-container" style="display: flex; flex-direction: column; gap: 10px; margin-top: 6px; margin-bottom: 6px; align-items: center; width: 100%; page-break-inside: avoid;">
            <div class="print-images-grid grid-cols-3" style="display: flex; gap: 10px; justify-content: center; width: 100%; max-width: 555px;">
                ${line1.map(img => `<img src="${img}" alt="Foto da Inspeção" style="${imgStyle}">`).join('')}
            </div>
            <div class="print-images-grid grid-cols-2" style="display: flex; gap: 10px; justify-content: center; width: 100%; max-width: 460px;">
                ${line2.map(img => `<img src="${img}" alt="Foto da Inspeção" style="${imgStyle}">`).join('')}
            </div>
        </div>`;
    }

    // 6 ou mais fotos: fatias de 3 fotos
    const chunks = [];
    for (let i = 0; i < validImgs.length; i += 3) {
        chunks.push(validImgs.slice(i, i + 3));
    }
    return `
    <div class="print-images-container" style="display: flex; flex-direction: column; gap: 10px; margin-top: 6px; margin-bottom: 6px; align-items: center; width: 100%; page-break-inside: avoid;">
        ${chunks.map(chunk => `
            <div class="print-images-grid grid-cols-${chunk.length}" style="display: flex; gap: 10px; justify-content: center; width: 100%; max-width: ${chunk.length === 2 ? '460px' : '555px'};">
                ${chunk.map(img => `<img src="${img}" alt="Foto da Inspeção" style="${imgStyle}">`).join('')}
            </div>
        `).join('')}
    </div>`;
}

/**
 * Renderiza o bloco de observações com borda discreta
 */
export function renderObservationBlock(text, title = "OBSERVAÇÕES:") {
    if (!text || !String(text).trim()) return '';
    const titleHtml = title ? `<div class="print-obs-label" style="font-weight: 800; color: #111827; font-size: 8px; margin-bottom: 3px; letter-spacing: 0.3px; text-transform: uppercase;">${escapeHTML(title)}</div>` : '';
    return `
    <div class="print-obs-container" style="margin-top: 6px; margin-bottom: 14px; page-break-inside: avoid;">
        ${titleHtml}
        <table class="print-obs-table" style="width: 100%; border-collapse: collapse; margin: 0;">
            <tbody>
                <tr>
                    <td style="border: 1px solid #e5e7eb; background: #ffffff; padding: 6px 8px; font-size: 8.5px; font-weight: 600; color: #374151; text-transform: uppercase; white-space: pre-wrap; word-break: break-word; line-height: 1.5;">${escapeHTML(text).trim()}</td>
                </tr>
            </tbody>
        </table>
    </div>`;
}

/**
 * Renderiza a tabela de 2 colunas: DESCRIÇÃO | STATUS (OK: ✔ verde, NOK: ✖ vermelho)
 */
export function renderChecklistTable(items, responses = {}) {
    if (!Array.isArray(items) || items.length === 0) return '';

    const rowsHtml = items.map(child => {
        const resp = responses[child.id] || {};
        const status = resp.status || '-';
        let statusClass = 'status-na';
        let statusSymbol = '-';
        let statusColor = '#9ca3af';

        if (status === 'OK') {
            statusClass = 'status-ok';
            statusSymbol = '✔';
            statusColor = '#10b981';
        } else if (status === 'NOK') {
            statusClass = 'status-nok';
            statusSymbol = '✖';
            statusColor = '#ef4444';
        }

        const label = child.label || child.descricao || child.title || '';
        return `
        <tr class="print-group-row">
            <td style="border: 1px solid #e5e7eb; padding: 4px 6px; text-align: left; font-size: 8px; text-transform: uppercase; font-weight: 600; color: #4b5563;">${escapeHTML(label)}</td>
            <td style="border: 1px solid #e5e7eb; padding: 4px 6px; text-align: center; width: 80px; font-size: 14px; font-weight: bold; color: ${statusColor};">
                <span class="status-badge ${statusClass}" style="color: ${statusColor} !important;">${statusSymbol}</span>
            </td>
        </tr>`;
    }).join('');

    return `
    <table class="print-group-table" style="width: 100%; border-collapse: collapse; margin-bottom: 4px;">
        <thead>
            <tr>
                <th style="border: 1px solid #e5e7eb; padding: 4px 6px; text-align: left; font-size: 8px; text-transform: uppercase; background: #f9fafb; color: #374151; font-weight: 800;">DESCRIÇÃO</th>
                <th style="border: 1px solid #e5e7eb; padding: 4px 6px; text-align: center; width: 80px; font-size: 8px; text-transform: uppercase; background: #f9fafb; color: #374151; font-weight: 800;">STATUS</th>
            </tr>
        </thead>
        <tbody>
            ${rowsHtml}
        </tbody>
    </table>`;
}

/**
 * Resolve o schema/snapshot do relatório de forma determinística e 100% somente-leitura (idempotente):
 * 1. Prioridade 1: report.schema_snapshot
 * 2. Prioridade 2: report.schema
 * 3. Prioridade 3: report.responses.__meta.schema
 * 4. Fallback 4: CHECKLIST_SCHEMA com emissão de log de inconsistência sem mutação no banco
 */
export function resolveReportSchema(report) {
    if (!report) return CHECKLIST_SCHEMA;

    if (report.schema_snapshot && Array.isArray(report.schema_snapshot) && report.schema_snapshot.length > 0) {
        return report.schema_snapshot;
    }

    if (report.schema && Array.isArray(report.schema) && report.schema.length > 0) {
        return report.schema;
    }

    if (report.responses && report.responses.__meta && Array.isArray(report.responses.__meta.schema) && report.responses.__meta.schema.length > 0) {
        return report.responses.__meta.schema;
    }

    // Fallback 4: Emite log explícito de aviso sem modificar dados do banco
    console.warn(`[REPORTS PDF] Aviso: Relatório '${report.id || 'ID_DESCONHECIDO'}' não possui schema_snapshot. Utilizando CHECKLIST_SCHEMA padrão de fallback.`);
    return CHECKLIST_SCHEMA;
}

/**
 * Renderiza um item/seção de checklist do relatório com Título -> Tabela -> Fotos -> Observações
 */
export function renderChecklistItem(node, responses = {}, customItems = []) {
    if (!node) return '';

    // --- Caso 1: Nó isolado do tipo inspectable individual ---
    if (node.fieldType === 'inspectable') {
        const resp = responses[node.id] || {};
        const status = resp.status || '-';
        const observation = resp.observation || '';
        const images = (resp.images || []).filter(img => img && String(img).trim() !== "");

        let statusClass = 'status-na';
        let statusSymbol = '-';
        let statusColor = '#9ca3af';
        if (status === 'OK') {
            statusClass = 'status-ok';
            statusSymbol = '✔';
            statusColor = '#10b981';
        } else if (status === 'NOK') {
            statusClass = 'status-nok';
            statusSymbol = '✖';
            statusColor = '#ef4444';
        }

        let obsHtml = renderObservationBlock(observation);
        let imgsHtml = renderImagesGrid(images);

        return `
        <div class="print-item" style="border: 1px solid #f3f4f6; background: #fafafa; border-radius: 4px; padding: 6px; margin-bottom: 6px; page-break-inside: avoid;">
            <div class="print-item-header" style="display: flex; justify-content: space-between; align-items: center;">
                <span class="print-item-label" style="font-size: 8.5px; font-weight: 700; text-transform: uppercase;">${escapeHTML(node.label || node.title || '')}</span>
                <span class="status-badge ${statusClass}" style="font-size: 14px; font-weight: bold; color: ${statusColor};">${statusSymbol}</span>
            </div>
            ${imgsHtml}
            ${obsHtml}
        </div>`;
    }

    // --- Caso 2: Campo de texto ou textarea isolado ---
    if (node.fieldType === 'textarea' || node.fieldType === 'text') {
        const resp = responses[node.id] || {};
        const val = (resp.value || '').trim();
        const images = (resp.images || []).filter(img => img && String(img).trim() !== "");

        let imgsHtml = renderImagesGrid(images);
        const isObsLabel = node.label && node.label.toUpperCase().includes('OBSERVAÇ');
        let obsHtml = renderObservationBlock(val || '(SEM OBSERVAÇÕES)', isObsLabel ? '' : (node.label ? node.label.toUpperCase() + ':' : 'OBSERVAÇÕES:'));

        return `
        <div class="print-item" style="border: 1px solid #f3f4f6; background: #fafafa; border-radius: 4px; padding: 6px; margin-bottom: 6px; page-break-inside: avoid;">
            <div class="print-item-header" style="margin-bottom: 4px;">
                <span class="print-item-label" style="font-size: 8.5px; font-weight: 700; text-transform: uppercase;">${escapeHTML(node.label || node.title || '')}</span>
            </div>
            ${imgsHtml}
            ${obsHtml}
        </div>`;
    }

    // --- Caso 3: Interceptação especializada para Cabo de Aço (5.6/6.6 ou specialType cableComposite) ---
    const isCableComposite = node.specialType === 'cableComposite' || node.id === '5.6' || node.id === '6.6' ||
        ((node.id === '5.6' || node.id === '6.6') && node.children && node.children.some(c => c.id && c.id.endsWith('.arames')));

    if (isCableComposite) {
        const prefix = node.id;
        const inspectables = (node.children || []).filter(c => c.fieldType === 'inspectable');
        const sectionCustomItems = (customItems || []).filter(ci => ci.sectionId === node.id);
        const allInspectables = [...inspectables, ...sectionCustomItems];

        const inspectTableHtml = renderChecklistTable(allInspectables, responses);

        const arames = (responses[`${prefix}.arames`] || responses[`${prefix}.1.arames`] || {}).value || '';
        const bitola = (responses[`${prefix}.bitola`] || responses[`${prefix}.1.bitola`] || {}).value || '';
        const diametro = (responses[`${prefix}.diametro`] || responses[`${prefix}.1.diametro`] || {}).value || '';
        const diametro_medido = (responses[`${prefix}.diametro_medido`] || responses[`${prefix}.1.diametro_medido`] || {}).value || '';
        const reducao = (responses[`${prefix}.reducao`] || responses[`${prefix}.1.reducao`] || {}).value || '';
        const corrosao = (responses[`${prefix}.corrosao`] || responses[`${prefix}.1.corrosao`] || {}).value || '';
        const danos = (responses[`${prefix}.danos`] || responses[`${prefix}.1.danos`] || {}).value || '';
        const deterioracao = (responses[`${prefix}.deterioracao`] || responses[`${prefix}.1.deterioracao`] || {}).value || '';
        const obsText = (responses[`${prefix}.observacoes`] || responses[`${prefix}.1.observacoes`] || {}).value || '';

        const cableSubfields = ['arames', 'bitola', 'diametro', 'diametro_medido', 'reducao', 'corrosao', 'danos', 'deterioracao', 'observacoes'];
        let cableAllImages = [];
        cableSubfields.forEach(sub => {
            const resp = responses[`${prefix}.${sub}`] || responses[`${prefix}.1.${sub}`] || {};
            const imgs = (resp.images || []).filter(img => img && String(img).trim() !== "");
            cableAllImages = cableAllImages.concat(imgs);
        });
        allInspectables.forEach(child => {
            const resp = responses[child.id] || {};
            const imgs = (resp.images || []).filter(img => img && String(img).trim() !== "");
            cableAllImages = cableAllImages.concat(imgs);
        });

        let cableObsHtml = renderObservationBlock(obsText, "OBSERVAÇÕES DO CABO DE AÇO:");
        let cableImgsHtml = renderImagesGrid(cableAllImages);

        const thStyle = 'text-align: center; font-weight: 600; border: 1px solid #e5e7eb; color: #374151; background: #ffffff;';
        const thGrauStyle = 'text-align: center; font-weight: 600; font-size: 7px; text-transform: none; line-height: 1.4; border: 1px solid #e5e7eb; color: #374151; background: #ffffff; padding: 2px;';
        const tdStyle = 'text-align: center; vertical-align: middle; border: 1px solid #e5e7eb; color: #4b5563; font-weight: 600;';

        const cableTechnicalTable = `
        <table class="print-group-table" style="table-layout: fixed; width: 100%; border-collapse: collapse; background: #ffffff; margin-top: 6px;">
            <thead>
                <tr>
                    <th rowspan="2" style="${thStyle} vertical-align: middle; width: 8%;">Arames rompidos</th>
                    <th colspan="4" style="${thStyle} width: 44%;">Redução do Diâmetro</th>
                    <th style="${thStyle} vertical-align: middle; width: 13%;">Corrosão</th>
                    <th style="${thStyle} vertical-align: middle; width: 15%;">Deformação ou Danos</th>
                    <th style="${thStyle} vertical-align: middle; width: 16%;">Grau acumulativo de deterioração</th>
                </tr>
                <tr>
                    <th style="${thStyle} width: 8%;">Bitola</th>
                    <th style="${thStyle} width: 14%;">Catálogo</th>
                    <th style="${thStyle} width: 9%;">Valor Medido</th>
                    <th style="${thStyle} width: 13%;">Redução % (Máx 7%)</th>
                    <th style="${thGrauStyle}">GRAU 1 a 5</th>
                    <th style="${thGrauStyle}">GRAU 1 a 5</th>
                    <th style="${thGrauStyle}">GRAU 1 a 5</th>
                </tr>
            </thead>
            <tbody>
                <tr class="print-group-row">
                    <td style="${tdStyle}">${escapeHTML(arames || '-')}</td>
                    <td style="${tdStyle}">${escapeHTML(bitola || '-')}</td>
                    <td style="${tdStyle}">${escapeHTML(diametro || '-')}</td>
                    <td style="${tdStyle}">${escapeHTML(diametro_medido || '-')}</td>
                    <td style="${tdStyle}">${escapeHTML(reducao || '-')}</td>
                    <td style="${tdStyle}">${escapeHTML(corrosao || '-')}</td>
                    <td style="${tdStyle}">${escapeHTML(danos || '-')}</td>
                    <td style="${tdStyle}">${escapeHTML(deterioracao || '-')}</td>
                </tr>
            </tbody>
        </table>`;

        const cableHeadingTag = node.level === 1 ? 'h2' : node.level === 2 ? 'h3' : 'h4';
        const cableSectionClass = node.level === 1 ? 'print-section main-section' : 'print-section';

        return `
        <div class="${cableSectionClass}">
            <${cableHeadingTag} class="print-section-title" style="font-size: 11px; font-weight: 800; color: #1f2937; text-transform: uppercase; margin-top: 14px; margin-bottom: 8px;">${escapeHTML(node.title || node.nome || '')}</${cableHeadingTag}>
            <div class="print-section-content" style="padding-left: 0;">
                <div class="print-group-container" style="margin-bottom: 8px; page-break-inside: avoid;">
                    ${inspectTableHtml}
                    ${cableTechnicalTable}
                    ${cableImgsHtml}
                    ${cableObsHtml}
                </div>
            </div>
        </div>`;
    }

    // --- Caso 4: Interceptação especializada para Moitão (5.7/6.7 ou specialType hookComposite) ---
    const isHookComposite = node.specialType === 'hookComposite' || node.id === '5.7' || node.id === '6.7' ||
        ((node.id === '5.7' || node.id === '6.7') && node.children && node.children.some(c => c.id && (c.id.endsWith('.penetrante') || c.id.endsWith('.gancho_abertura'))));

    if (isHookComposite) {
        const prefix = node.id;
        const inspectables = (node.children || []).filter(c => c.fieldType === 'inspectable');
        const sectionCustomItems = (customItems || []).filter(ci => ci.sectionId === node.id);
        const allInspectables = [...inspectables, ...sectionCustomItems];

        const inspectTableHtml = renderChecklistTable(allInspectables, responses);

        const valAbertura = (responses[`${prefix}.gancho_abertura`] || responses[`${prefix}.abertura`] || responses[`${prefix}.2.abertura`] || {}).value || '-';
        const valPenetrante = (responses[`${prefix}.penetrante`] || responses[`${prefix}.2.penetrante`] || {}).value || '-';
        const valProtecao = (responses[`${prefix}.protecao`] || responses[`${prefix}.2.protecao`] || {}).value || '-';
        const valDin = (responses[`${prefix}.din`] || responses[`${prefix}.2.din`] || {}).value || '-';
        const valCapacidade = (responses[`${prefix}.capacidade`] || responses[`${prefix}.2.capacidade`] || {}).value || '-';
        const obsText = (responses[`${prefix}.observacoes`] || responses[`${prefix}.2.observacoes`] || {}).value || '';

        let hookAllImages = [];
        ['gancho_abertura', 'abertura', 'penetrante', 'protecao', 'din', 'capacidade', 'observacoes'].forEach(sub => {
            const resp = responses[`${prefix}.${sub}`] || responses[`${prefix}.2.${sub}`] || {};
            const imgs = (resp.images || []).filter(img => img && String(img).trim() !== "");
            hookAllImages = hookAllImages.concat(imgs);
        });
        allInspectables.forEach(child => {
            const resp = responses[child.id] || {};
            const imgs = (resp.images || []).filter(img => img && String(img).trim() !== "");
            hookAllImages = hookAllImages.concat(imgs);
        });

        const thStyle = 'text-align: center; font-weight: 600; border: 1px solid #e5e7eb; color: #374151; background: #ffffff; padding: 6px 4px; text-transform: uppercase; font-size: 8px;';
        const tdStyle = 'text-align: center; vertical-align: middle; border: 1px solid #e5e7eb; color: #4b5563; font-weight: 600; padding: 6px 4px;';

        let hookObsHtml = renderObservationBlock(obsText, "OBSERVAÇÕES DO MOITÃO:");
        let hookImgsHtml = renderImagesGrid(hookAllImages);

        const hookTechnicalTable = `
        <table class="print-group-table" style="table-layout: fixed; width: 100%; border-collapse: collapse; background: #ffffff; margin-top: 6px;">
            <thead>
                <tr>
                    <th style="${thStyle}">Abertura do Gancho</th>
                    <th style="${thStyle}">Líquido Penetrante</th>
                    <th style="${thStyle}">Proteção de Partes Móveis</th>
                    <th style="${thStyle}">Gancho DIN 15400</th>
                    <th style="${thStyle}">Indicação de Capacidade</th>
                </tr>
            </thead>
            <tbody>
                <tr class="print-group-row">
                    <td style="${tdStyle}">${escapeHTML(valAbertura)}</td>
                    <td style="${tdStyle}">${escapeHTML(valPenetrante)}</td>
                    <td style="${tdStyle}">${escapeHTML(valProtecao)}</td>
                    <td style="${tdStyle}">${escapeHTML(valDin)}</td>
                    <td style="${tdStyle}">${escapeHTML(valCapacidade)}</td>
                </tr>
            </tbody>
        </table>`;

        const hookHeadingTag = node.level === 1 ? 'h2' : node.level === 2 ? 'h3' : 'h4';
        const hookSectionClass = node.level === 1 ? 'print-section main-section' : 'print-section';

        return `
        <div class="${hookSectionClass}">
            <${hookHeadingTag} class="print-section-title" style="font-size: 11px; font-weight: 800; color: #1f2937; text-transform: uppercase; margin-top: 14px; margin-bottom: 8px;">${escapeHTML(node.title || node.nome || '')}</${hookHeadingTag}>
            <div class="print-section-content" style="padding-left: 0;">
                <div class="print-group-container" style="margin-bottom: 8px; page-break-inside: avoid;">
                    ${inspectTableHtml}
                    ${hookTechnicalTable}
                    ${hookImgsHtml}
                    ${hookObsHtml}
                </div>
            </div>
        </div>`;
    }

    // --- Caso 5: Seção / Grupo Dinâmico Regular de Checklists ---
    const isGroup = (node.children && node.children.length > 0 && node.children[0].fieldType === 'inspectable') ||
        (Array.isArray(node.children) && node.children.length === 0) ||
        (!node.children && !node.specialType);
    let childrenHtml = '';

    if (isGroup) {
        const sectionCustomItems = (customItems || []).filter(ci => ci.sectionId === node.id);
        const allItems = [...(node.children || []), ...sectionCustomItems];

        const tableHtml = allItems.length > 0 ? renderChecklistTable(allItems, responses) : '';

        // Coleta todas as observações e imagens associadas ao grupo de inspeção
        let groupObs = '';
        const groupImgsSet = new Set();
        let additionalObs = [];

        const firstChildId = node.children && node.children.length > 0 ? node.children[0].id : null;

        // 1. Prioriza as observações e fotos gravadas no primeiro item do grupo
        if (firstChildId && responses[firstChildId]) {
            if (responses[firstChildId].observation) groupObs = responses[firstChildId].observation;
            if (Array.isArray(responses[firstChildId].images)) {
                responses[firstChildId].images.forEach(img => {
                    if (img && typeof img === 'string' && img.trim()) groupImgsSet.add(img.trim());
                });
            }
            if (Array.isArray(responses[firstChildId].additionalObservations)) {
                additionalObs = additionalObs.concat(responses[firstChildId].additionalObservations);
            }
        }

        // 2. Fallback: se não encontrou no firstChildId, verifica se foi gravado na chave da seção
        if (!groupObs && node.id && responses[node.id] && responses[node.id].observation) {
            groupObs = responses[node.id].observation;
        }
        if (groupImgsSet.size === 0 && node.id && responses[node.id] && Array.isArray(responses[node.id].images)) {
            responses[node.id].images.forEach(img => {
                if (img && typeof img === 'string' && img.trim()) groupImgsSet.add(img.trim());
            });
        }
        if (additionalObs.length === 0 && node.id && responses[node.id] && Array.isArray(responses[node.id].additionalObservations)) {
            additionalObs = additionalObs.concat(responses[node.id].additionalObservations);
        }

        // 3. Verifica se algum outro item filho possui observações ou imagens próprias
        allItems.forEach(child => {
            if (child.id && child.id !== firstChildId && child.id !== node.id) {
                const resp = responses[child.id] || {};
                if (resp.observation) {
                    if (!groupObs) {
                        groupObs = resp.observation;
                    } else if (!groupObs.includes(resp.observation)) {
                        groupObs += `\n${resp.observation}`;
                    }
                }
                if (Array.isArray(resp.images) && resp.images.length > 0) {
                    resp.images.forEach(img => {
                        if (img && typeof img === 'string' && img.trim()) groupImgsSet.add(img.trim());
                    });
                }
                if (Array.isArray(resp.additionalObservations) && resp.additionalObservations.length > 0) {
                    additionalObs = additionalObs.concat(resp.additionalObservations);
                }
            }
        });

        const groupImgs = Array.from(groupImgsSet);

        let groupObsHtml = renderObservationBlock(groupObs);
        let groupImgsHtml = renderImagesGrid(groupImgs);

        let additionalObsHtml = '';
        if (additionalObs && additionalObs.length > 0) {
            additionalObsHtml = additionalObs.map(addBlock => {
                const addObs = addBlock.observation || '';
                const addImgs = (addBlock.images || []).filter(img => img && String(img).trim() !== "");
                let addObsText = renderObservationBlock(addObs);
                let addImgsBlockHtml = renderImagesGrid(addImgs);
                return `${addImgsBlockHtml}${addObsText}`;
            }).join('');
        }

        childrenHtml = `
        <div class="print-group-container" style="margin-bottom: 8px; page-break-inside: avoid;">
            ${tableHtml}
            ${groupImgsHtml}
            ${groupObsHtml}
            ${additionalObsHtml}
        </div>`;
    } else if (Array.isArray(node.children) && node.children.length > 0) {
        childrenHtml = node.children.map(child => renderChecklistItem(child, responses, customItems)).join('');
    }

    const headingTag = node.level === 1 ? 'h2' : node.level === 2 ? 'h3' : 'h4';
    const sectionClass = node.level === 1 ? 'print-section main-section' : 'print-section';

    const titleText = node.title || node.nome || '';
    const titleHtml = titleText ? `<${headingTag} class="print-section-title" style="font-size: 11px; font-weight: 800; color: #1f2937; text-transform: uppercase; margin-top: 14px; margin-bottom: 8px; padding-bottom: 4px;">${escapeHTML(titleText)}</${headingTag}>` : '';

    if (!childrenHtml && !titleHtml) return '';

    return `
    <div class="${sectionClass}">
        ${titleHtml}
        <div class="print-section-content" style="padding-left: 0;">
            ${childrenHtml}
        </div>
    </div>`;
}

/**
 * Gera o HTML consolidado de todas as seções e itens do relatório
 */
export function getChecklistPrintHTML(report) {
    const responses = (report && report.responses) ? report.responses : {};
    const targetSchema = resolveReportSchema(report);

    const standardSectionsHTML = (Array.isArray(targetSchema) ? targetSchema : [])
        .map(node => renderChecklistItem(node, responses, report.customItems || []))
        .join('');

    let customSectionsHTML = '';
    if (report.customSections && Array.isArray(report.customSections) && report.customSections.length > 0) {
        customSectionsHTML = report.customSections
            .map(node => renderChecklistItem(node, responses, report.customItems || []))
            .join('');
    }

    return standardSectionsHTML + customSectionsHTML;
}

/**
 * Mapeia deterministicamente todas as URLs de mídias presentes no relatório
 */
export function collectAllReportImageUrls(report, company, internalCompany, usersList = []) {
    const urls = new Set();

    if (company && company.logo && typeof company.logo === 'string' && company.logo.trim() !== '') {
        urls.add(company.logo.trim());
    }
    if (internalCompany && internalCompany.logo && typeof internalCompany.logo === 'string' && internalCompany.logo.trim() !== '') {
        urls.add(internalCompany.logo.trim());
    }

    if (report) {
        if (Array.isArray(report.generalImages)) {
            report.generalImages.forEach(img => {
                if (img && typeof img === 'string' && img.trim() !== '') urls.add(img.trim());
            });
        }

        if (report.responses && typeof report.responses === 'object') {
            Object.values(report.responses).forEach(resp => {
                if (resp && typeof resp === 'object') {
                    if (Array.isArray(resp.images)) {
                        resp.images.forEach(img => {
                            if (img && typeof img === 'string' && img.trim() !== '') urls.add(img.trim());
                        });
                    }
                    if (Array.isArray(resp.additionalObservations)) {
                        resp.additionalObservations.forEach(obs => {
                            if (obs && Array.isArray(obs.images)) {
                                obs.images.forEach(img => {
                                    if (img && typeof img === 'string' && img.trim() !== '') urls.add(img.trim());
                                });
                            }
                        });
                    }
                }
            });
        }

        // Assinaturas
        let selectedResponsaveisList = [];
        if (report.responsaveis && Array.isArray(report.responsaveis) && report.responsaveis.length > 0) {
            selectedResponsaveisList = report.responsaveis.map(id => {
                return usersList.find(u => String(u.id) === String(id));
            }).filter(Boolean);
        }

        if (selectedResponsaveisList.length === 0) {
            const defaultUser = usersList.find(u => u && u.name && u.name.toUpperCase() === (report.tecnico || '').toUpperCase());
            if (defaultUser && defaultUser.signature && typeof defaultUser.signature === 'string' && defaultUser.signature.trim() !== '') {
                urls.add(defaultUser.signature.trim());
            }
        } else {
            selectedResponsaveisList.forEach(u => {
                if (u && u.signature && typeof u.signature === 'string' && u.signature.trim() !== '') {
                    urls.add(u.signature.trim());
                }
            });
        }
    }

    return Array.from(urls);
}

/**
 * Pré-carrega todas as URLs em memória via objetos Image nativos
 */
export async function preloadImageUrls(urls) {
    if (!urls || urls.length === 0) return;

    const promises = urls.map(url => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
            if (img.complete) {
                resolve(true);
            }
        });
    });

    await Promise.allSettled(promises);
}

/**
 * Formata o nome do usuário para exibição na capa técnica:
 * Primeiro Nome + Inicial do Segundo Nome (desconsiderando preposições de, da, do, dos, das, e).
 * Exemplo: JOSE DOS SANTOS -> JOSE S., GILBERTO MENDES -> GILBERTO M.
 */
export function formatRevisionUserName(fullName) {
    if (!fullName || typeof fullName !== 'string') return '';
    const clean = fullName.trim().replace(/\s+/g, ' ');
    if (!clean) return '';
    const parts = clean.split(' ');
    if (parts.length === 1) return parts[0].toUpperCase();

    const firstName = parts[0].toUpperCase();
    const prepositions = new Set(['DE', 'DA', 'DO', 'DOS', 'DAS', 'E']);
    
    let secondName = '';
    for (let i = 1; i < parts.length; i++) {
        const p = parts[i].toUpperCase();
        if (!prepositions.has(p)) {
            secondName = p;
            break;
        }
    }

    if (secondName) {
        return `${firstName} ${secondName.charAt(0)}.`;
    }
    return firstName;
}

export function resolveFormattedUserName(userRef, usersList = []) {
    if (!userRef) return '';
    const str = String(userRef).trim();
    if (!str) return '';
    const found = (usersList || []).find(u => u && (String(u.id) === str || (u.name && u.name.toUpperCase() === str.toUpperCase())));
    const rawName = found ? found.name : str;
    return formatRevisionUserName(rawName);
}

/**
 * Monta o documento HTML completo de impressão (Capa + Conteúdo + Paginação)
 */
export function generateReportPrintHTML(report, company = {}, internalCompany = null, usersList = [], asset = {}) {
    const reportTypeUpper = (report.type || 'PREVENTIVA').toUpperCase();

    const formatReportDate = (dateStr, delimiter = '/') => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}${delimiter}${parts[1]}${delimiter}${parts[0]}`;
        }
        return dateStr;
    };
    const reportDateFormattedHeader = formatReportDate(report.date, '/');
    const reportDateFormattedTable = formatReportDate(report.date, '/');

    const internalCompanyName = (internalCompany && internalCompany.name) ? internalCompany.name.toUpperCase() : "TECNOCRANE";

    const clientLogoHtml = (company && company.logo)
        ? `<img src="${company.logo}">`
        : `<div class="footer-meta-logo-text">${(company && company.name || "CLIENTE").toUpperCase()}</div>`;

    const headerLogoHtml = (internalCompany && internalCompany.logo)
        ? `<img src="${internalCompany.logo}" style="max-height: 55px; max-width: 180px; object-fit: contain;">`
        : `<div style="display: inline-flex; align-items: center; justify-content: center; gap: 6px; background: #facc15; border: 2px solid #000000; padding: 4px 10px; font-weight: 900; font-size: 16px; color: #000000; letter-spacing: 0.5px; text-transform: uppercase;">
             <span class="material-symbols-outlined" style="font-size: 20px; font-weight: bold;">crane</span>
             <span>${internalCompanyName} ®</span>
           </div>`;

    const revisions = report.revisions || {};
    const rev01 = revisions.rev01 || {};
    const rev02 = revisions.rev02 || {};
    const rev03 = revisions.rev03 || {};

    const resolveField = (val, defaultVal = '') => {
        const res = resolveFormattedUserName(val, usersList);
        return res || defaultVal;
    };

    // Linha 03 (Topo)
    const isRev03Active = Boolean(rev03.date || rev03.prepared || rev03.collaboration || rev03.checked || rev03.approved);
    const row03Html = isRev03Active
        ? `<tr class="val-row">
            <td>03</td>
            <td>${escapeHTML(formatReportDate(rev03.date, '/'))}</td>
            <td>${escapeHTML((rev03.description || 'REVISÃO').toUpperCase())}</td>
            <td>${escapeHTML(resolveField(rev03.prepared))}</td>
            <td>${escapeHTML(resolveField(rev03.collaboration))}</td>
            <td>${escapeHTML(resolveField(rev03.checked))}</td>
            <td>${escapeHTML(resolveField(rev03.approved))}</td>
        </tr>`
        : `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`;

    // Linha 02 (Meio)
    const isRev02Active = Boolean(rev02.date || rev02.prepared || rev02.collaboration || rev02.checked || rev02.approved);
    const row02Html = isRev02Active
        ? `<tr class="val-row">
            <td>02</td>
            <td>${escapeHTML(formatReportDate(rev02.date, '/'))}</td>
            <td>${escapeHTML((rev02.description || 'REVISÃO').toUpperCase())}</td>
            <td>${escapeHTML(resolveField(rev02.prepared))}</td>
            <td>${escapeHTML(resolveField(rev02.collaboration))}</td>
            <td>${escapeHTML(resolveField(rev02.checked))}</td>
            <td>${escapeHTML(resolveField(rev02.approved))}</td>
        </tr>`
        : `<tr><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td></tr>`;

    // Linha 01 (Base antes do header - Emissão Inicial)
    const rev01Date = rev01.date ? formatReportDate(rev01.date, '/') : reportDateFormattedHeader;
    const row01Html = `
        <tr class="val-row">
            <td>01</td>
            <td>${escapeHTML(rev01Date)}</td>
            <td>EMISSÃO INICIAL</td>
            <td>${escapeHTML(resolveField(rev01.prepared, 'GILBERTO M.'))}</td>
            <td>${escapeHTML(resolveField(rev01.collaboration, 'MERILDO I.'))}</td>
            <td>${escapeHTML(resolveField(rev01.checked, 'REINALDO A.'))}</td>
            <td>${escapeHTML(resolveField(rev01.approved, 'DAVISON R.'))}</td>
        </tr>
    `;

    const sectionsHTML = getChecklistPrintHTML(report);

    return `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Relatório de Inspeção - ${report.id}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            color: #1f2937;
            background: #ffffff;
            line-height: 1.4;
            font-size: 11px;
            padding: 20px;
        }

        /* Layout do Cabeçalho Principal */
        .print-header-grid {
            display: grid;
            grid-template-columns: 200px 1fr 200px;
            align-items: center;
            border: 1px solid #e5e7eb;
            margin-bottom: 0;
            text-align: center;
        }
        
        .header-logo-cell {
            padding: 10px;
            border-right: 1px solid #e5e7eb;
            height: 75px;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .header-logo-cell img {
            max-height: 55px;
            max-width: 180px;
            object-fit: contain;
        }
        
        .header-title-cell {
            padding: 10px;
            font-size: 11px;
            font-weight: 900;
            color: #000000;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-right: 1px solid #e5e7eb;
            height: 75px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        
        .header-meta-cell {
            padding: 6px 10px;
            height: 75px;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            font-size: 8px;
            font-weight: bold;
            color: #4b5563;
        }

        .report-badge {
            display: inline-block;
            background: #facc15;
            color: #000000;
            font-size: 10px;
            font-weight: 900;
            padding: 4px 8px;
            border-radius: 4px;
            margin-bottom: 2px;
        }

        .cover-page {
            page-break-after: always;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            height: 265mm;
        }

        .cover-body-container {
            border-left: 1px solid #e5e7eb;
            border-right: 1px solid #e5e7eb;
            border-bottom: 1px solid #e5e7eb;
            padding: 0;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            box-sizing: border-box;
        }

        .cover-center-block {
            text-align: center;
            margin: 40px 0;
            padding: 0 40px;
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: center;
            gap: 16px;
        }

        .cover-center-title {
            font-size: 20px;
            font-weight: 900;
            color: #111827;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            line-height: 1.2;
        }

        .cover-center-subtitle {
            font-size: 15px;
            font-weight: 800;
            color: #111827;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }

        .disclaimer-box {
            font-size: 7.5px;
            color: #4b5563;
            line-height: 1.4;
            margin-bottom: 0;
            text-align: left;
            border-top: 1px solid #e5e7eb;
            border-bottom: 1px solid #e5e7eb;
            padding: 10px 15px;
            background-color: #f9fafb;
        }
        .disclaimer-box p {
            margin-bottom: 4px;
        }
        .disclaimer-box p:last-child {
            margin-bottom: 0;
        }

        .revision-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: -1px;
            table-layout: fixed;
        }
        .revision-table td {
            border: 1px solid #e5e7eb;
            padding: 4px 6px;
            text-align: center;
            font-size: 7.5px;
            text-transform: uppercase;
            height: 24px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
        .revision-table tr.label-row td {
            background: #ffffff;
            font-weight: 800;
            color: #111827;
            line-height: 1.1;
            font-size: 7px;
            height: 28px;
        }
        .revision-table tr.val-row td {
            font-weight: 600;
            color: #374151;
        }

        .footer-metadata-grid {
            display: grid;
            grid-template-columns: 200px 1fr 1fr;
            border-top: 1px solid #e5e7eb;
            align-items: stretch;
            margin-top: -1px;
        }
        
        .footer-meta-logo-cell {
            border-right: 1px solid #e5e7eb;
            padding: 4px;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 120px;
            background: #ffffff;
        }
        
        .footer-meta-logo-cell img {
            max-height: 112px;
            max-width: 192px;
            width: 100%;
            height: 100%;
            object-fit: contain;
        }

        .footer-meta-logo-text {
            font-size: 10px;
            font-weight: 800;
            color: #4b5563;
            text-transform: uppercase;
            text-align: center;
        }
        
        .footer-meta-company-cell {
            border-right: 1px solid #e5e7eb;
            padding: 10px;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
        }

        .footer-meta-company-cell h3, .footer-meta-asset-cell h3 {
            font-size: 8px;
            font-weight: 900;
            color: #000000;
            border-bottom: 1.5px solid #e5e7eb;
            padding-bottom: 4px;
            margin-bottom: 8px;
            text-transform: uppercase;
            letter-spacing: 0.3px;
        }
        
        .footer-meta-asset-cell {
            padding: 10px;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
        }
        
        .meta-subgrid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 6px;
        }
        
        .meta-subitem {
            font-size: 7.5px;
            text-transform: uppercase;
        }

        .meta-subitem.double {
            grid-column: span 2;
        }
        
        .meta-subitem strong {
            display: block;
            color: #111827;
            font-weight: 800;
            margin-bottom: 1px;
        }
        
        .meta-subitem span {
            color: #4b5563;
            font-weight: 600;
            font-size: 8px;
        }

        /* Configuração de Impressão */
        @media print {
            @page {
                size: auto;
                margin: 1.5cm;
            }
            body {
                margin: 0;
                padding: 0;
                background: none;
            }
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }

        .print-page {
            page-break-after: always;
            break-after: page;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            height: 265mm;
            justify-content: flex-start;
        }
        .print-page-content {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            justify-content: flex-start;
        }
        .print-page-content .signature-footer {
            margin-top: auto !important;
        }
        
        .print-section,
        .print-group-container,
        .print-group-table {
            page-break-inside: avoid;
            break-inside: avoid;
        }
    </style>
</head>
<body>
    <!-- PÁGINA 1: CAPA DO RELATÓRIO -->
    <div class="cover-page">
        <div class="print-header-grid">
            <div class="header-logo-cell">
                ${headerLogoHtml}
            </div>
            <div class="header-title-cell">
                RELATÓRIO DE MANUTENÇÃO ${reportTypeUpper}
            </div>
            <div class="header-meta-cell">
                <div class="report-badge">${report.id}</div>
                <div style="margin-top: 6px;">DATA: ${reportDateFormattedHeader}</div>
                <div style="margin-top: 2px;">PAGINA: 1</div>
            </div>
        </div>

        <div class="cover-body-container">
            <div class="cover-center-block">
                <div class="cover-center-title">
                    RELATÓRIO DE MANUTENÇÃO ${reportTypeUpper}
                </div>
                <div class="cover-center-subtitle" style="margin-top: 8px;">
                    #${report.equipamentoId || 'EQP'} — ${(report.equipamentoNome || report.equipamento || '').toUpperCase()}
                </div>
            </div>

            <div>
                <div class="disclaimer-box">
                    <p>Este documento contém informações de propriedade da ${internalCompanyName} e só deve ser utilizado exclusivamente pelo destinatário com relação às finalidades pelas quais foi recebido. E qualquer forma de reprodução ou divulgação sem o consentimento da ${internalCompanyName} é vetada.</p>
                    <p>This document is property of ${internalCompanyName}. It is strictly forbidden to reproduce this document, in whole or in part, and to provide to others any related information without the previous written consent by ${internalCompanyName}</p>
                </div>

                <table class="revision-table">
                    ${row03Html}
                    ${row02Html}
                    ${row01Html}
                    <tr class="label-row">
                        <td>REV</td>
                        <td>DATA<br>DATE</td>
                        <td>DESCRIÇÃO<br>DESCRIPTION</td>
                        <td>PREPARADO<br>PREPARED</td>
                        <td>COLABORAÇÃO<br>CO-OPERATIONS</td>
                        <td>CONTROLADO<br>CHECKED</td>
                        <td>APROVADOR<br>APPROVED</td>
                    </tr>
                </table>

                <div class="footer-metadata-grid">
                    <div class="footer-meta-logo-cell">
                        ${clientLogoHtml}
                    </div>
                    <div class="footer-meta-company-cell">
                        <h3>DADOS CADASTRAIS DA EMPRESA</h3>
                        <div class="meta-subgrid">
                            <div class="meta-subitem double">
                                <strong>Razão Social</strong>
                                <span>${company.name || '---'}</span>
                            </div>
                            <div class="meta-subitem">
                                <strong>CNPJ</strong>
                                <span>${company.cnpj || '---'}</span>
                            </div>
                            <div class="meta-subitem double">
                                <strong>Endereço</strong>
                                <span>${company.endereco || '---'}${company.numero ? `, ${company.numero}` : ''}${company.bairro ? ` - ${company.bairro}` : ''}</span>
                            </div>
                            <div class="meta-subitem">
                                <strong>CEP</strong>
                                <span>${company.cep || '---'}</span>
                            </div>
                            <div class="meta-subitem">
                                <strong>Cidade / Estado</strong>
                                <span>${(company.cidade && company.estado) ? `${company.cidade} - ${company.estado}` : (company.cidade || company.estado || company.referencia || '---')}</span>
                            </div>
                        </div>
                    </div>
                    <div class="footer-meta-asset-cell">
                        <h3>ESPECIFICAÇÕES DO EQUIPAMENTO</h3>
                        <div class="meta-subgrid">
                            ${(() => {
                                let html = `
                                    <div class="meta-subitem">
                                        <strong>ID Equipamento</strong>
                                        <span>${report.equipamentoId || asset.id || '---'}</span>
                                    </div>
                                    <div class="meta-subitem">
                                        <strong>Tipo/Nome</strong>
                                        <span>${report.equipamentoNome || report.equipamento || asset.tipo || asset.nome || '---'}</span>
                                    </div>
                                    <div class="meta-subitem">
                                        <strong>Localização</strong>
                                        <span>${asset.local || '---'}</span>
                                    </div>
                                    <div class="meta-subitem">
                                        <strong>Fabricante</strong>
                                        <span>${asset.fabricante || '---'}</span>
                                    </div>
                                    <div class="meta-subitem">
                                        <strong>Capacidade de Peso</strong>
                                        <span>${asset.capacidade || '---'}</span>
                                    </div>
                                    <div class="meta-subitem">
                                        <strong>Vão</strong>
                                        <span>${asset.vao || '---'}</span>
                                    </div>
                                `;

                                const customFieldsMap = asset.custom_fields || asset.customFields || {};
                                const schemaSnapshot = asset.schema_snapshot || asset.schemaSnapshot || null;
                                const schemaFields = (schemaSnapshot && (schemaSnapshot.customFields || schemaSnapshot.custom_fields)) || [];

                                if (Array.isArray(schemaFields) && schemaFields.length > 0) {
                                    schemaFields.forEach(f => {
                                        const fId = f.id || `cf_${(f.label || '').toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
                                        const val = customFieldsMap[fId] !== undefined ? customFieldsMap[fId] : (customFieldsMap[f.label] || '---');
                                        html += `
                                            <div class="meta-subitem">
                                                <strong>${f.label || 'Campo'}</strong>
                                                <span>${val || '---'}</span>
                                            </div>
                                        `;
                                    });
                                } else if (customFieldsMap && typeof customFieldsMap === 'object' && Object.keys(customFieldsMap).length > 0) {
                                    Object.entries(customFieldsMap).forEach(([k, v]) => {
                                        const label = k.startsWith('cf_') ? k.replace(/^cf_\d+_/, '').replace(/_/g, ' ').toUpperCase() : k.toUpperCase();
                                        html += `
                                            <div class="meta-subitem">
                                                <strong>${label}</strong>
                                                <span>${v || '---'}</span>
                                            </div>
                                        `;
                                    });
                                }

                                return html;
                            })()}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- PÁGINA 2 EM DIANTE: CONTEÚDO E CHECKLIST (FONTE PARA PAGINAÇÃO DINÂMICA) -->
    <div id="print-content-source" style="display: block;">
        <div id="temp-measurer" style="width: 100%;">
            ${sectionsHTML}
        </div>
        <!-- ASSINATURAS DO RELATÓRIO -->
        <div id="temp-signatures" class="signature-footer" style="margin-top: 40px; display: grid; grid-template-columns: repeat(2, 1fr); gap: 32px 48px; width: 100%; box-sizing: border-box;">
            ${(() => {
                let selectedResponsaveisList = [];
                if (report.responsaveis && Array.isArray(report.responsaveis) && report.responsaveis.length > 0) {
                    selectedResponsaveisList = report.responsaveis.map(id => {
                        return usersList.find(u => String(u.id) === String(id));
                    }).filter(Boolean);
                }

                if (selectedResponsaveisList.length === 0) {
                    const defaultUser = usersList.find(u => u.name && u.name.toUpperCase() === (report.tecnico || '').toUpperCase()) || {
                        name: report.tecnico || "MAYCON DIAS",
                        cargo: "TÉCNICO RESPONSÁVEL",
                        signature: ""
                    };
                    selectedResponsaveisList = [defaultUser];
                }

                return selectedResponsaveisList.map(u => {
                    const uName = (u.name || report.tecnico || "RESPONSÁVEL").toUpperCase();
                    const uCargo = (u.cargo || u.role || "TÉCNICO RESPONSÁVEL").toUpperCase();
                    const uSig = u.signature || "";

                    const sigImgHtml = uSig
                        ? `<img src="${uSig}" style="max-height: 48px; max-width: 180px; object-fit: contain; margin-bottom: 4px;" alt="Assinatura Digital">`
                        : `<div style="height: 48px;"></div>`;

                    return `
                    <div style="text-align: center; width: 100%; max-width: 320px; margin: 0 auto; page-break-inside: avoid;">
                        <div style="height: 52px; display: flex; align-items: flex-end; justify-content: center;">
                            ${sigImgHtml}
                        </div>
                        <div style="border-top: 1.5px solid #000000; width: 100%; margin-top: 4px; margin-bottom: 6px;"></div>
                        <div style="font-size: 11px; font-weight: 700; color: #111827; text-transform: uppercase; line-height: 1.2;">${escapeHTML(uCargo)}</div>
                        <div style="font-size: 12px; font-weight: 800; color: #000000; text-transform: uppercase; margin-top: 2px; line-height: 1.2;">${escapeHTML(uName)}</div>
                    </div>`;
                }).join('');
            })()}
        </div>
    </div>

    <!-- LOCAL ONDE AS PÁGINAS GERADAS SERÃO INSERIDAS -->
    <div id="print-pages-container"></div>

    <script>
        window.onload = function() {
            const images = Array.from(document.querySelectorAll('img'));
            Promise.all(images.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve;
                });
            })).then(() => {
                setTimeout(paginate, 100);
            });

            function paginate() {
                const temp = document.getElementById('temp-measurer');
                const sigs = document.getElementById('temp-signatures');
                const source = document.getElementById('print-content-source');
                
                source.style.width = '180mm';
                
                function flattenSection(sec) {
                    const result = [];
                    const children = Array.from(sec.children);
                    
                    const titleEl = children.find(c => c.classList && c.classList.contains('print-section-title'));
                    if (titleEl) {
                        result.push(titleEl.cloneNode(true));
                    }
                    
                    const contentEl = children.find(c => c.classList && c.classList.contains('print-section-content'));
                    if (!contentEl) {
                        children.forEach(c => {
                            if (!c.classList || !c.classList.contains('print-section-title')) {
                                result.push(c.cloneNode(true));
                            }
                        });
                        return result;
                    }
                    
                    Array.from(contentEl.children).forEach(child => {
                        if (child.classList && child.classList.contains('print-section')) {
                            const nestedResults = flattenSection(child);
                            nestedResults.forEach(r => result.push(r));
                        } else if (child.classList && child.classList.contains('print-group-container')) {
                            Array.from(child.children).forEach(subChild => {
                                result.push(subChild.cloneNode(true));
                            });
                        } else {
                            result.push(child.cloneNode(true));
                        }
                    });
                    
                    return result;
                }
                
                const flatElements = [];
                Array.from(temp.children).forEach(mainSec => {
                    const results = flattenSection(mainSec);
                    results.forEach(r => flatElements.push(r));
                });
                
                temp.innerHTML = '';
                flatElements.forEach(el => temp.appendChild(el));
                
                void temp.offsetHeight;
                
                const sections = Array.from(temp.children);
                
                const pageRuler = document.createElement('div');
                pageRuler.style.cssText = 'height:265mm;width:0;position:absolute;visibility:hidden;';
                document.body.appendChild(pageRuler);
                const totalPagePx = pageRuler.offsetHeight;
                document.body.removeChild(pageRuler);
                
                const headerProbe = document.createElement('div');
                headerProbe.style.cssText = 'position:absolute;visibility:hidden;width:180mm;';
                const coverHeader = document.querySelector('.print-header-grid');
                if (coverHeader) {
                    const hClone = coverHeader.cloneNode(true);
                    hClone.style.marginBottom = '20px';
                    headerProbe.appendChild(hClone);
                }
                document.body.appendChild(headerProbe);
                const headerPx = headerProbe.offsetHeight || 120;
                document.body.removeChild(headerProbe);
                
                const maxPageHeight = totalPagePx - headerPx - 30; 
                const sigsHeight = sigs.offsetHeight || 120;
                
                const pages = [];
                let currentPageSections = [];
                let currentPageHeight = 0;
                
                sections.forEach((sec, idx) => {
                    const style = window.getComputedStyle(sec);
                    const marginTop = parseFloat(style.marginTop) || 0;
                    const marginBottom = parseFloat(style.marginBottom) || 0;
                    const h = sec.offsetHeight + marginTop + marginBottom;
                    
                    const isHeadingEl = function(el) {
                        if (!el) return false;
                        const tag = el.tagName ? el.tagName.toLowerCase() : '';
                        return tag === 'h2' || tag === 'h3' || tag === 'h4' || (el.classList && el.classList.contains('print-section-title'));
                    };

                    let willNextElementFit = true;
                    if (isHeadingEl(sec)) {
                        let chainHeight = h;
                        let k = idx + 1;
                        while (k < sections.length) {
                            const candidate = sections[k];
                            const cStyle = window.getComputedStyle(candidate);
                            const cMarginTop = parseFloat(cStyle.marginTop) || 0;
                            const cMarginBottom = parseFloat(cStyle.marginBottom) || 0;
                            const candidateH = candidate.offsetHeight + cMarginTop + cMarginBottom;
                            
                            chainHeight += candidateH;
                            if (!isHeadingEl(candidate)) {
                                break;
                            }
                            k++;
                        }

                        if (currentPageHeight + chainHeight > maxPageHeight) {
                            willNextElementFit = false;
                        }
                    }
                    
                    if ((currentPageHeight + h > maxPageHeight || !willNextElementFit) && currentPageSections.length > 0) {
                        pages.push({ sections: currentPageSections, hasSignatures: false });
                        currentPageSections = [sec];
                        currentPageHeight = h;
                    } else {
                        currentPageSections.push(sec);
                        currentPageHeight += h;
                    }
                });
                
                if (currentPageSections.length > 0) {
                    if (currentPageHeight + sigsHeight + 30 > maxPageHeight) {
                        pages.push({ sections: currentPageSections, hasSignatures: false });
                        pages.push({ sections: [], hasSignatures: true });
                    } else {
                        pages.push({ sections: currentPageSections, hasSignatures: true });
                    }
                } else {
                    pages.push({ sections: [], hasSignatures: true });
                }
                
                const totalPages = pages.length + 1;
                
                const coverPagesPlaceholder = document.querySelector('.cover-page .total-pages-placeholder');
                if (coverPagesPlaceholder) {
                    coverPagesPlaceholder.innerText = totalPages;
                }
                
                const coverBadgeCell = document.querySelector('.cover-page .header-meta-cell');
                if (coverBadgeCell) {
                    const pageTextEl = Array.from(coverBadgeCell.children).find(c => c.innerText.includes('PAGINA:'));
                    if (pageTextEl) {
                        pageTextEl.innerHTML = 'PAGINA: 1 / <span class="total-pages-placeholder">' + totalPages + '</span>';
                    }
                }
                
                const container = document.getElementById('print-pages-container');
                
                pages.forEach((page, index) => {
                    const pageNum = index + 2;
                    
                    const pageDiv = document.createElement('div');
                    pageDiv.className = 'print-page';
                    
                    let headerHTML = '<div class="print-header-grid" style="margin-bottom: 20px;">' +
                        '<div class="header-logo-cell">' +
                            document.querySelector('.header-logo-cell').innerHTML +
                        '</div>' +
                        '<div class="header-title-cell">' +
                            'RELATÓRIO DE MANUTENÇÃO ${reportTypeUpper}' +
                        '</div>' +
                        '<div class="header-meta-cell">' +
                            '<div class="report-badge">${report.id}</div>' +
                            '<div style="margin-top: 6px;">DATA: ${reportDateFormattedHeader}</div>' +
                            '<div style="margin-top: 2px;">PAGINA: ' + pageNum + ' / <span class="total-pages-placeholder">' + totalPages + '</span></div>' +
                        '</div>' +
                    '</div>';
                    
                    const contentDiv = document.createElement('div');
                    contentDiv.className = 'print-page-content';
                    
                    page.sections.forEach(sec => {
                        contentDiv.appendChild(sec.cloneNode(true));
                    });
                    
                    if (page.hasSignatures) {
                        contentDiv.appendChild(sigs.cloneNode(true));
                    }
                    
                    pageDiv.innerHTML = headerHTML;
                    pageDiv.appendChild(contentDiv);
                    container.appendChild(pageDiv);
                });
                
                document.getElementById('print-content-source').style.display = 'none';
                
                const finishAndPrint = async () => {
                    const images = Array.from(document.querySelectorAll('img'));
                    if (images.length > 0) {
                        await Promise.allSettled(images.map(img => {
                            return new Promise(resolve => {
                                if (img.complete && img.naturalHeight !== 0) {
                                    if ('decode' in img) {
                                        img.decode().then(resolve).catch(resolve);
                                    } else {
                                        resolve();
                                    }
                                } else {
                                    img.onload = () => {
                                        if ('decode' in img) {
                                            img.decode().then(resolve).catch(resolve);
                                        } else {
                                            resolve();
                                        }
                                    };
                                    img.onerror = resolve;
                                }
                            });
                        }));
                    }
                    if (window.parent && typeof window.parent.hidePrintLoadingOverlay === 'function') {
                        window.parent.hidePrintLoadingOverlay();
                    }
                    setTimeout(() => {
                        window.focus();
                        window.print();
                    }, 150);
                };
                finishAndPrint();
            }
        };
    </script>
</body>
</html>`;
}

/**
 * Ponto de entrada modular para execução da impressão de PDF do relatório
 */
export async function printReportPDF(reportId, options = {}) {
    showPrintLoadingOverlay();
    const safetyTimeout = setTimeout(() => hidePrintLoadingOverlay(), 15000);

    const { finalizedReports = [], companies = [], allAssetsList = [], usersList = [] } = options;

    const normalizeId = (val) => String(val || '').replace(/[\s\-_]/g, '').toLowerCase();
    let report = (finalizedReports || []).find(r => 
        String(r.id) === String(reportId) ||
        normalizeId(r.id) === normalizeId(reportId) ||
        (String(r.id).replace(/\D+/g, '') !== '' && String(r.id).replace(/\D+/g, '') === String(reportId).replace(/\D+/g, ''))
    );

    if (!report || !report.responses || Object.keys(report.responses || {}).length === 0) {
        const localReports = await getDBValue('crane_reports', []);
        const foundLocal = (localReports || []).find(r => 
            String(r.id) === String(reportId) ||
            normalizeId(r.id) === normalizeId(reportId) ||
            (String(r.id).replace(/\D+/g, '') !== '' && String(r.id).replace(/\D+/g, '') === String(reportId).replace(/\D+/g, ''))
        );
        if (foundLocal) {
            report = report ? { ...report, ...foundLocal } : foundLocal;
        }
    }

    if (!report) {
        hidePrintLoadingOverlay();
        clearTimeout(safetyTimeout);
        if (typeof window !== 'undefined' && typeof window.showAlert === 'function') {
            window.showAlert('RELATÓRIO NÃO ENCONTRADO.', 'error');
        }
        return false;
    }

    let company = companies.find(c => c && c.name && report.empresa && c.name.toLowerCase() === report.empresa.toLowerCase());
    let internalCompany = getStoredData('crane_internal_company', null);
    if (!company && internalCompany) {
        if (!report.empresa || (internalCompany.name && internalCompany.name.toLowerCase() === report.empresa.toLowerCase())) {
            company = internalCompany;
        }
    }
    if (!company) company = {};

    const asset = allAssetsList.find(a => a && (a.id === report.equipamentoId || a.id === report.equipamento)) || {};

    // Pré-carregamento determinístico de mídias
    try {
        const mediaUrls = collectAllReportImageUrls(report, company, internalCompany, usersList);
        await preloadImageUrls(mediaUrls);
    } catch (e) {
        console.warn("Aviso no pré-carregamento de mídias:", e);
    }

    if (typeof document === 'undefined') return true;

    let printFrame = document.getElementById('crane-print-iframe');
    if (printFrame) {
        printFrame.remove();
    }
    printFrame = document.createElement('iframe');
    printFrame.id = 'crane-print-iframe';
    printFrame.style.position = 'fixed';
    printFrame.style.left = '-9999px';
    printFrame.style.top = '-9999px';
    printFrame.style.width = '1000px';
    printFrame.style.height = '1000px';
    printFrame.style.border = '0';
    printFrame.style.opacity = '0';
    printFrame.style.pointerEvents = 'none';
    document.body.appendChild(printFrame);

    const printHtml = generateReportPrintHTML(report, company, internalCompany, usersList, asset);
    const printWindow = printFrame.contentWindow;
    printWindow.document.open();
    printWindow.document.write(printHtml);
    printWindow.document.close();

    return true;
}
