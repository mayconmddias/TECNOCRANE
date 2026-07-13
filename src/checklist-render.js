// Crane Pro - Checklist Render

import { CHECKLIST_SCHEMA } from './checklist-schema.js';

const INPUT_CLASS = 'w-full bg-surface-container-low border border-outline py-2 px-4 text-body-md uppercase text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200';
const TEXTAREA_CLASS = `${INPUT_CLASS} min-h-[80px]`;
const UPLOAD_ZONE = `
    <div class="border-2 border-dashed border-outline-variant p-card_padding text-center cursor-pointer hover:bg-surface-container transition-all duration-200 checklist-upload-zone">
        <span class="material-symbols-outlined text-on-surface-variant text-headline-md">add_a_photo</span>
        <p class="text-label-md text-on-surface-variant uppercase">Anexar fotos</p>
        <input type="file" accept="image/*" multiple class="hidden checklist-file-input">
    </div>`;

function renderInspectable(field) {
    return `
    <div class="checklist-field checklist-inspectable border border-outline-variant bg-surface p-card_padding space-y-stack_md transition-all duration-200" data-field-id="${field.id}" data-field-type="inspectable">
        <div class="flex flex-wrap items-center justify-between gap-stack_md">
            <span class="text-body-lg font-bold uppercase text-on-surface">${field.label}</span>
            <div class="flex items-center gap-stack_lg">
                <label class="flex items-center gap-stack_sm cursor-pointer group">
                    <input type="radio" name="status-${field.id}" value="OK" class="checklist-status-ok border-outline text-green-600 focus:ring-green-600 bg-surface-container-low transition-all duration-200">
                    <span class="text-label-md uppercase text-on-surface group-hover:text-green-600 transition-all duration-200">OK</span>
                </label>
                <label class="flex items-center gap-stack_sm cursor-pointer group">
                    <input type="radio" name="status-${field.id}" value="NOK" class="checklist-status-nok border-outline text-error focus:ring-error bg-surface-container-low transition-all duration-200">
                    <span class="text-label-md uppercase text-on-surface group-hover:text-error transition-all duration-200">NOK</span>
                </label>
                <button type="button" class="checklist-upload-zone flex items-center justify-center p-1 text-on-surface-variant hover:text-green-600 transition-all duration-200 cursor-pointer ml-stack_sm" title="Anexar Fotos">
                    <span class="material-symbols-outlined text-[20px]">add_a_photo</span>
                    <input type="file" accept="image/*" multiple class="hidden checklist-file-input">
                </button>
            </div>
        </div>
        <textarea class="${TEXTAREA_CLASS} checklist-observation" placeholder="OBSERVAÇÃO" rows="2"></textarea>
        <div class="image-preview-container flex gap-stack_sm flex-wrap mt-stack_sm"></div>
    </div>`;
}

function renderTextField(field) {
    const hint = field.hint
        ? `<p class="text-body-md text-on-surface-variant uppercase">${field.hint}</p>`
        : '';
    const isCustom = field.id.startsWith('custom_');
    if (field.fieldType === 'textarea') {
        return `
        <div class="checklist-field space-y-stack_sm checklist-textarea-photo-block" data-field-id="${field.id}" data-field-type="textarea">
            <label class="text-body-lg font-bold uppercase text-on-surface">${field.label}</label>
            ${hint}
            <div class="flex items-start gap-stack_md">
                <div class="flex-1">
                    <textarea class="w-full bg-surface-container-low border border-outline py-2 px-4 text-body-md uppercase text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 min-h-[48px] resize-none overflow-hidden checklist-text-value" placeholder="${field.label.toUpperCase()}" rows="1"></textarea>
                </div>
                <div class="flex flex-col gap-2 shrink-0">
                    <button type="button" class="checklist-upload-zone flex items-center justify-center p-3 border border-outline bg-surface-container-low text-on-surface-variant hover:text-green-600 hover:border-green-600 transition-all duration-200 cursor-pointer rounded-xl h-[48px] w-[48px]" title="Anexar Fotos">
                        <span class="material-symbols-outlined text-[22px]">add_a_photo</span>
                        <input type="file" accept="image/*" multiple class="hidden checklist-file-input">
                    </button>
                    ${isCustom ? `
                    <button type="button" onclick="window.removeCustomSection('${field.id}')" class="flex items-center justify-center p-3 border border-outline bg-surface-container-low text-error hover:bg-error/10 transition-all duration-200 cursor-pointer rounded-xl h-[48px] w-[48px]" title="Excluir Item Adicional">
                        <span class="material-symbols-outlined text-[22px]">delete</span>
                    </button>
                    ` : ''}
                </div>
            </div>
            <div class="image-preview-container flex gap-stack_sm flex-wrap mt-stack_sm"></div>
        </div>`;
    }
    return `
    <div class="checklist-field space-y-stack_sm" data-field-id="${field.id}" data-field-type="text">
        <label class="text-body-lg font-bold uppercase text-on-surface">${field.label}</label>
        ${hint}
        <input type="text" class="${INPUT_CLASS} checklist-text-value" placeholder="${field.label.toUpperCase()}">
    </div>`;
}

function renderSectionHeader(node, displayNum) {
    const levelClass = node.level === 1
        ? 'text-headline-lg text-on-background font-bold'
        : node.level === 2
            ? 'text-headline-md text-on-surface font-bold'
            : 'text-body-lg font-bold text-on-surface-variant';
    const padding = node.level === 1 ? '' : node.level === 2 ? 'pl-container_gutter' : 'pl-[64px]';
    
    let titleHtml = node.title;
    if (node.level === 1) {
        // Tenta extrair o número inicial (ex: "1 ", "5 – ") para aplicar a cor amarela (primary)
        const match = node.title.match(/^(\d+(?:\s*–\s*|\s+))?(.*)$/);
        if (match && match[1]) {
            const numPart = match[1];
            const textPart = match[2];
            titleHtml = `<span class="font-bold text-primary mr-2">${numPart}</span>${textPart}`;
        }
    }
    
    const isGroup = node.children && node.children.length > 0 && node.children[0].fieldType === 'inspectable';
    const plusBtn = isGroup 
        ? `<button type="button" onclick="window.addAdditionalObservationBlock(this, '${node.id}')" class="text-on-surface hover:text-primary transition-colors duration-200 flex items-center justify-center p-1 rounded-full shrink-0" title="Adicionar Observação/Fotos">
            <span class="material-symbols-outlined text-[28px] font-bold">add</span>
           </button>`
        : '';
    
    return `
    <div class="${padding} pt-stack_lg pb-stack_sm border-b border-outline-variant flex justify-between items-center gap-stack_md">
        <h3 class="${levelClass} uppercase tracking-tight flex-1">${titleHtml}</h3>
        ${plusBtn}
    </div>`;
}

export function renderObservationBlock(blockData = null, isRemovable = true, isCustomGroup = false, customGroupId = '') {
    const text = blockData ? blockData.observation : '';
    const images = blockData ? blockData.images || [] : [];
    
    let deleteBtn = '';
    if (isRemovable) {
        deleteBtn = `
        <button type="button" onclick="this.closest('.checklist-obs-block').remove()" class="flex items-center justify-center p-3 border border-outline bg-surface-container-low text-error hover:bg-error/10 transition-all duration-200 cursor-pointer rounded-xl h-[48px] w-[48px] shrink-0" title="Remover Bloco">
            <span class="material-symbols-outlined text-[22px]">delete</span>
        </button>`;
    } else if (isCustomGroup) {
        deleteBtn = `
        <button type="button" onclick="window.removeCustomSection('${customGroupId}')" class="flex items-center justify-center p-3 border border-outline bg-surface-container-low text-error hover:bg-error/10 transition-all duration-200 cursor-pointer rounded-xl h-[48px] w-[48px] shrink-0" title="Excluir Item Adicional">
            <span class="material-symbols-outlined text-[22px]">delete</span>
        </button>`;
    }
    
    return `
    <div class="checklist-obs-block space-y-stack_sm border-t border-outline-variant/30 pt-3 first:border-t-0 first:pt-0">
        <div class="flex items-start gap-stack_md">
            <div class="flex-1">
                <textarea class="w-full bg-surface-container-low border border-outline py-2 px-4 text-body-md uppercase text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 min-h-[48px] resize-none overflow-hidden checklist-observation" placeholder="OBSERVAÇÃO" rows="1">${text}</textarea>
            </div>
            
            <div class="flex flex-col gap-2 shrink-0">
                <button type="button" class="checklist-upload-zone flex items-center justify-center p-3 border border-outline bg-surface-container-low text-on-surface-variant hover:text-green-600 hover:border-green-600 transition-all duration-200 cursor-pointer rounded-xl h-[48px] w-[48px]" title="Anexar Fotos">
                    <span class="material-symbols-outlined text-[22px]">add_a_photo</span>
                    <input type="file" accept="image/*" multiple class="hidden checklist-file-input">
                </button>
                ${deleteBtn}
            </div>
        </div>
        
        <div class="image-preview-container flex gap-stack_sm flex-wrap mt-stack_sm">
            ${images.map(src => renderImagePreview(src)).join('')}
        </div>
    </div>`;
}

function renderInspectableGroup(node) {
    const itemsHtml = node.children.map(child => `
        <div class="flex items-center justify-between border-b border-outline-variant/30 py-3 last:border-b-0">
            <span class="text-body-md font-bold uppercase text-on-surface">${child.label}</span>
            <div class="flex items-center gap-stack_lg">
                <label class="flex items-center gap-stack_sm cursor-pointer group">
                    <input type="radio" name="status-${child.id}" value="OK" class="checklist-status-ok border-outline text-green-600 focus:ring-green-600 bg-surface-container-low transition-all duration-200">
                    <span class="text-label-md uppercase text-on-surface group-hover:text-green-600 transition-all duration-200">OK</span>
                </label>
                <label class="flex items-center gap-stack_sm cursor-pointer group">
                    <input type="radio" name="status-${child.id}" value="NOK" class="checklist-status-nok border-outline text-error focus:ring-error bg-surface-container-low transition-all duration-200">
                    <span class="text-label-md uppercase text-on-surface group-hover:text-error transition-all duration-200">NOK</span>
                </label>
            </div>
        </div>
    `).join('');

    const isCustom = node.id.startsWith('custom_');

    return `
    <div class="checklist-field checklist-inspectable-group border border-outline-variant bg-surface p-card_padding space-y-stack_md transition-all duration-200" data-section-id="${node.id}">
        <div class="divide-y divide-outline-variant/30">
            ${itemsHtml}
        </div>
        
        <!-- Contêiner de Blocos de Observação -->
        <div class="checklist-obs-blocks-container space-y-stack_md pt-2">
            ${renderObservationBlock(null, false, isCustom, node.id)}
        </div>
    </div>`;
}

function renderCableInspectionTable(node) {
    const prefix = node.id;
    const thStyle = 'border border-outline-variant p-2 text-center text-label-md font-bold uppercase bg-transparent text-on-surface align-middle';
    const subThStyle = 'border border-outline-variant p-2 text-center text-[10px] font-bold uppercase bg-transparent text-on-surface-variant leading-tight align-middle';
    const scaleThStyle = 'border border-outline-variant p-1 text-center text-[9px] font-medium uppercase bg-transparent text-on-surface-variant leading-normal align-middle';
    const cellStyle = 'border border-outline-variant p-0 text-center bg-transparent';
    const inputStyle = 'w-full bg-transparent text-center border-0 py-2 px-1 text-body-md uppercase text-on-surface focus:bg-surface-container-low focus:ring-2 focus:ring-primary outline-none checklist-text-value';

    // Campo de Observações renderizado separadamente abaixo da tabela (sem label)
    const obsField = node.children.find(c => c.id === `${prefix}.observacoes`);
    const obsHtml = obsField ? `
        <div class="checklist-field space-y-stack_sm checklist-textarea-photo-block" data-field-id="${obsField.id}" data-field-type="textarea">
            <div class="flex items-start gap-stack_md">
                <div class="flex-1">
                    <textarea class="w-full bg-surface-container-low border border-outline py-2 px-4 text-body-md uppercase text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 min-h-[48px] resize-none overflow-hidden checklist-text-value" placeholder="OBSERVAÇÕES" rows="1"></textarea>
                </div>
                <div class="flex flex-col gap-2 shrink-0">
                    <button type="button" class="checklist-upload-zone flex items-center justify-center p-3 border border-outline bg-surface-container-low text-on-surface-variant hover:text-green-600 hover:border-green-600 transition-all duration-200 cursor-pointer rounded-xl h-[48px] w-[48px]" title="Anexar Fotos">
                        <span class="material-symbols-outlined text-[22px]">add_a_photo</span>
                        <input type="file" accept="image/*" multiple class="hidden checklist-file-input">
                    </button>
                </div>
            </div>
            <div class="image-preview-container flex gap-stack_sm flex-wrap mt-stack_sm"></div>
        </div>` : '';

    return `
    <div class="checklist-field checklist-cable-table-block space-y-stack_md overflow-x-auto" data-section-id="${prefix}">
        <table class="w-full border-collapse border border-outline-variant text-[11px] table-fixed">
            <thead>
                <tr>
                    <th rowspan="2" class="${thStyle} w-[10%]">Arames Rompidos</th>
                    <th colspan="4" class="${thStyle} w-[42%]">Redução do Diâmetro</th>
                    <th class="${thStyle} w-[14%]">Corrosão</th>
                    <th class="${thStyle} w-[16%]">Deformação ou Danos</th>
                    <th class="${thStyle} w-[18%]">Grau Acumulativo de Deterioração (e outras observações)</th>
                </tr>
                <tr>
                    <th class="${subThStyle} w-[8%]">Bitola do Cabo</th>
                    <th class="${subThStyle} w-[14%]">Diâmetro conforme catálogo de referência (Cimaf/similar)</th>
                    <th class="${subThStyle} w-[10%]">Diâmetro valor medido</th>
                    <th class="${subThStyle} w-[10%]">Redução do diâmetro em porcentagem (7% máximo conforme norma)</th>
                    <th class="${scaleThStyle}">
                        GRAU<br>
                        1 = ok<br>
                        2 = leve<br>
                        3 = médio<br>
                        4 = alto<br>
                        5 = Substituição
                    </th>
                    <th class="${scaleThStyle}">
                        GRAU<br>
                        1 = ok<br>
                        2 = leve<br>
                        3 = médio<br>
                        4 = alto<br>
                        5 = Substituição
                    </th>
                    <th class="${scaleThStyle}">
                        GRAU<br>
                        1 = ok<br>
                        2 = leve<br>
                        3 = médio<br>
                        4 = alto<br>
                        5 = Substituição
                    </th>
                </tr>
            </thead>
            <tbody>
                <tr>
                    <td class="${cellStyle}" data-field-id="${prefix}.arames" data-field-type="text">
                        <input type="text" class="${inputStyle}" placeholder="NÃO">
                    </td>
                    <td class="${cellStyle}" data-field-id="${prefix}.bitola" data-field-type="text">
                        <input type="text" class="${inputStyle}" placeholder="3/4&quot;">
                    </td>
                    <td class="${cellStyle}" data-field-id="${prefix}.diametro" data-field-type="text">
                        <input type="text" class="${inputStyle}" placeholder="19MM">
                    </td>
                    <td class="${cellStyle}" data-field-id="${prefix}.diametro_medido" data-field-type="text">
                        <input type="text" class="${inputStyle}" placeholder="19MM">
                    </td>
                    <td class="${cellStyle}" data-field-id="${prefix}.reducao" data-field-type="text">
                        <input type="text" class="${inputStyle}" placeholder="NÃO">
                    </td>
                    <td class="${cellStyle}" data-field-id="${prefix}.corrosao" data-field-type="text">
                        <input type="text" class="${inputStyle}" placeholder="1">
                    </td>
                    <td class="${cellStyle}" data-field-id="${prefix}.danos" data-field-type="text">
                        <input type="text" class="${inputStyle}" placeholder="1">
                    </td>
                    <td class="${cellStyle}" data-field-id="${prefix}.deterioracao" data-field-type="text">
                        <input type="text" class="${inputStyle}" placeholder="1">
                    </td>
                </tr>
            </tbody>
        </table>
        <div class="pt-2">
            ${obsHtml}
        </div>
    </div>`;
}

function renderHookInspectionTable(node) {
    const prefix = node.id;
    const thStyle = 'border border-outline-variant p-2 text-center text-label-md font-bold uppercase bg-transparent text-on-surface align-middle';
    const cellStyle = 'border border-outline-variant p-0 text-center bg-transparent';
    const inputStyle = 'w-full bg-transparent text-center border-0 py-2 px-1 text-body-md uppercase text-on-surface focus:bg-surface-container-low focus:ring-2 focus:ring-primary outline-none checklist-text-value';

    // Separa os campos de texto (tabela) do campo de observações (renderizado abaixo sem label)
    const fields = node.children.filter(c => c.id !== `${prefix}.observacoes`);
    const obsField = node.children.find(c => c.id === `${prefix}.observacoes`);
    const obsHtml = obsField ? `
        <div class="checklist-field space-y-stack_sm checklist-textarea-photo-block" data-field-id="${obsField.id}" data-field-type="textarea">
            <div class="flex items-start gap-stack_md">
                <div class="flex-1">
                    <textarea class="w-full bg-surface-container-low border border-outline py-2 px-4 text-body-md uppercase text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 min-h-[48px] resize-none overflow-hidden checklist-text-value" placeholder="OBSERVAÇÕES" rows="1"></textarea>
                </div>
                <div class="flex flex-col gap-2 shrink-0">
                    <button type="button" class="checklist-upload-zone flex items-center justify-center p-3 border border-outline bg-surface-container-low text-on-surface-variant hover:text-green-600 hover:border-green-600 transition-all duration-200 cursor-pointer rounded-xl h-[48px] w-[48px]" title="Anexar Fotos">
                        <span class="material-symbols-outlined text-[22px]">add_a_photo</span>
                        <input type="file" accept="image/*" multiple class="hidden checklist-file-input">
                    </button>
                </div>
            </div>
            <div class="image-preview-container flex gap-stack_sm flex-wrap mt-stack_sm"></div>
        </div>` : '';

    const headersHtml = fields.map(field =>
        `<th class="${thStyle}">${field.label}</th>`
    ).join('');

    const cellsHtml = fields.map(field =>
        `<td class="${cellStyle}" data-field-id="${field.id}" data-field-type="text">
            <input type="text" class="${inputStyle}" placeholder="OK">
        </td>`
    ).join('');

    return `
    <div class="checklist-field checklist-hook-table-block space-y-stack_md overflow-x-auto" data-section-id="${prefix}">
        <table class="w-full border-collapse border border-outline-variant text-[11px] table-fixed">
            <thead>
                <tr>${headersHtml}</tr>
            </thead>
            <tbody>
                <tr>${cellsHtml}</tr>
            </tbody>
        </table>
        <div class="pt-2">
            ${obsHtml}
        </div>
    </div>`;
}

export function renderNode(node, displayNum) {
    if (node.fieldType === 'inspectable') return renderInspectable(node);
    if (node.fieldType === 'text' || node.fieldType === 'textarea') return renderTextField(node);

    if (node.id === '5.6.1' || node.id === '6.6.1') {
        let html = renderSectionHeader(node, displayNum);
        const childPadding = node.level === 1 ? '' : 'pl-container_gutter';
        html += `<div class="${childPadding} mt-stack_sm">`;
        html += renderCableInspectionTable(node);
        html += '</div>';
        return html;
    }

    if (node.id === '5.7.2' || node.id === '6.7.2') {
        let html = renderSectionHeader(node, displayNum);
        const childPadding = node.level === 1 ? '' : 'pl-container_gutter';
        html += `<div class="${childPadding} mt-stack_sm">`;
        html += renderHookInspectionTable(node);
        html += '</div>';
        return html;
    }

    const isGroup = node.children && node.children.length > 0 && node.children[0].fieldType === 'inspectable';

    let html = renderSectionHeader(node, displayNum);
    
    if (isGroup) {
        const childPadding = node.level === 1 ? '' : 'pl-container_gutter';
        html += `<div class="${childPadding} mt-stack_sm">`;
        html += renderInspectableGroup(node);
        html += '</div>';
    } else {
        const childPadding = node.level === 1 ? 'space-y-stack_md' : 'space-y-stack_md pl-container_gutter';
        html += `<div class="${childPadding} mt-stack_sm">`;
        node.children.forEach(child => {
            html += renderNode(child, null);
        });
        html += '</div>';
    }

    if (node.level === 1) {
        html += '<div class="h-px bg-outline-variant w-full my-stack_lg"></div>';
        return `<div class="checklist-section-wrapper" data-section-id="${node.id}">${html}</div>`;
    }
    return html;
}

export function renderChecklistForm(doc = null) {
    let sectionsHtml = CHECKLIST_SCHEMA.map(node => renderNode(node, node.id)).join('');
    
    if (doc && doc.customSections) {
        doc.customSections.forEach(node => {
            sectionsHtml += renderNode(node, node.id);
        });
    }

    const addCustomBtn = `
    <div class="flex justify-center pt-stack_sm pb-stack_lg">
        <button type="button" onclick="window.openCustomItemModal()" class="px-container_gutter py-stack_md border border-dashed border-outline-variant text-on-surface hover:text-primary hover:border-primary transition-all duration-200 uppercase font-bold text-label-md flex items-center gap-2 rounded-xl">
            <span class="material-symbols-outlined">add_circle</span>
            Adicionar Novo Item Personalizado
        </button>
    </div>
    `;

    return `<div id="checklist-sections-container">${sectionsHtml}</div>` + addCustomBtn;
}

export function renderImagePreview(src) {
    return `
    <div class="relative w-24 h-24 border border-outline-variant bg-surface p-1 shadow-sm">
        <img src="${src}" class="w-full h-full object-cover" alt="">
        <button type="button" class="checklist-remove-image absolute -top-2 -right-2 bg-error text-on-error w-6 h-6 flex items-center justify-center shadow-md hover:brightness-90 transition-all duration-200">
            <span class="material-symbols-outlined text-label-md">close</span>
        </button>
    </div>`;
}
