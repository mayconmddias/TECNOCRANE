// Crane Pro - Checklist Render

import { CHECKLIST_SCHEMA } from './checklist-schema.js';
import { escapeHTML } from './utils.js';
import { usersList } from './data.js';

const INPUT_CLASS = 'w-full bg-white border border-[#c7c7c7] py-2 px-3.5 text-[13px] rounded-lg uppercase text-[#1f1f1f] focus:ring-2 focus:ring-[#fa520f] focus:border-[#fa520f] transition-all duration-200';
const TEXTAREA_CLASS = `${INPUT_CLASS} min-h-[76px]`;
const UPLOAD_ZONE = `
    <div class="border-2 border-dashed border-[#e6d5a8] p-4 text-center cursor-pointer hover:bg-[#fff8e0] rounded-lg transition-all duration-200 checklist-upload-zone">
        <span class="material-symbols-outlined text-[#fa520f] text-[24px]">add_a_photo</span>
        <p class="text-[11px] font-semibold text-[#4a4a4a] uppercase tracking-wider mt-1">Anexar fotos</p>
        <input type="file" accept="image/*" multiple class="hidden checklist-file-input">
    </div>`;

function renderInspectable(field) {
    const fieldId = (field && field.id && String(field.id).trim()) || 'chk_inspectable_item';
    const labelEscaped = escapeHTML((field && (field.label || field.descricao)) || '');
    return `
    <div class="checklist-field checklist-inspectable border border-[#e6d5a8] bg-white p-3.5 rounded-lg space-y-2.5 transition-all duration-200" data-field-id="${fieldId}" data-field-type="inspectable">
        <div class="flex items-center justify-between gap-2">
            <span class="text-[12px] font-bold uppercase text-[#1f1f1f] leading-snug flex-1">${labelEscaped}</span>
            <div class="flex items-center gap-2 shrink-0">
                <div class="flex flex-col gap-1 shrink-0">
                    <label class="flex items-center gap-1.5 cursor-pointer group py-0.5 px-1 rounded-md">
                        <input type="radio" name="status-${fieldId}" value="OK" class="checklist-status-ok border-[#c7c7c7] text-green-600 focus:ring-green-600 transition-all duration-200 w-4 h-4">
                        <span class="text-[11px] font-bold uppercase text-[#1f1f1f] group-hover:text-green-600 transition-all duration-200">OK</span>
                    </label>
                    <label class="flex items-center gap-1.5 cursor-pointer group py-0.5 px-1 rounded-md">
                        <input type="radio" name="status-${fieldId}" value="NOK" class="checklist-status-nok border-[#c7c7c7] text-red-600 focus:ring-red-600 transition-all duration-200 w-4 h-4">
                        <span class="text-[11px] font-bold uppercase text-[#1f1f1f] group-hover:text-red-600 transition-all duration-200">NOK</span>
                    </label>
                </div>
                <button type="button" class="checklist-upload-zone flex items-center justify-center p-1.5 text-[#6a6a6a] hover:text-[#fa520f] transition-all duration-200 cursor-pointer ml-1 rounded-md hover:bg-[#fff8e0]" title="Anexar Fotos">
                    <span class="material-symbols-outlined text-[18px]">add_a_photo</span>
                    <input type="file" accept="image/*" multiple class="hidden checklist-file-input">
                </button>
            </div>
        </div>
        <textarea class="${TEXTAREA_CLASS} checklist-observation" placeholder="OBSERVAÇÃO" rows="2"></textarea>
        <div class="image-preview-container flex gap-2 flex-wrap mt-2"></div>
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
        ? 'text-[15px] text-on-surface font-extrabold'
        : node.level === 2
            ? 'text-[14px] text-on-surface font-bold'
            : 'text-[13px] font-semibold text-on-surface-variant';
    const padding = node.level === 1 ? '' : node.level === 2 ? 'pl-container_gutter' : 'pl-[64px]';
    
    let titleHtml = escapeHTML(node.title);
    if (node.level === 1) {
        // Tenta extrair o número inicial (ex: "1 ", "2 ", "5.6 ", "5 – ") para aplicar a cor amarela (primary)
        const match = (node.title || '').match(/^(\d+(?:\.\d+)*)(?:\s*[-–.]*\s*)(.*)$/);
        if (match && match[1]) {
            const numPart = match[1];
            const textPart = match[2];
            titleHtml = `<span class="font-bold text-primary mr-1.5">${numPart}</span>${escapeHTML(textPart)}`;
        }
    }
    
    const isGroup = node.children && node.children.length > 0 && node.children[0].fieldType === 'inspectable';
    const plusBtn = isGroup 
        ? `<div class="relative shrink-0">
            <button type="button" onclick="window.toggleSectionMenu(event, '${node.id}')" class="text-on-surface hover:text-primary transition-colors duration-200 flex items-center justify-center p-1 rounded-full shrink-0" title="Opções de Adição">
                <span class="material-symbols-outlined text-[24px] font-bold">add</span>
            </button>
           </div>`
        : '';
    
    return `
    <div class="${padding} pt-3.5 pb-2 border-b border-outline-variant flex justify-between items-center gap-2">
        <h3 class="${levelClass} uppercase tracking-tight flex-1 leading-snug">${titleHtml}</h3>
        ${plusBtn}
    </div>`;
}

export function renderCustomChecklistItemRow(item, sectionId) {
    const itemId = (item && item.id && String(item.id).trim()) || `cust_${sectionId}_${Date.now()}`;
    const labelEscaped = escapeHTML(item.label || item.descricao || '');
    return `
    <div class="flex items-center justify-between border-b border-outline-variant/30 py-2.5 last:border-b-0 gap-2" data-custom-item-id="${itemId}" data-field-id="${itemId}" data-section-id="${sectionId}">
        <span class="text-[12px] font-bold uppercase text-on-surface leading-snug flex-1">${labelEscaped}</span>
        <div class="flex flex-col gap-1 shrink-0 ml-2">
            <label class="flex items-center gap-1.5 cursor-pointer group py-0.5 px-1 rounded-lg">
                <input type="radio" name="status-${itemId}" value="OK" class="checklist-status-ok border-outline text-green-600 focus:ring-green-600 transition-all duration-200 w-4.5 h-4.5">
                <span class="text-[11px] font-extrabold uppercase text-on-surface group-hover:text-green-600 transition-all duration-200">OK</span>
            </label>
            <label class="flex items-center gap-1.5 cursor-pointer group py-0.5 px-1 rounded-lg">
                <input type="radio" name="status-${itemId}" value="NOK" class="checklist-status-nok border-outline text-error focus:ring-error transition-all duration-200 w-4.5 h-4.5">
                <span class="text-[11px] font-extrabold uppercase text-on-surface group-hover:text-error transition-all duration-200">NOK</span>
            </label>
        </div>
    </div>`;
}

export function renderObservationBlock(blockData = null, isRemovable = true, isCustomGroup = false, customGroupId = '') {
    const text = blockData ? blockData.observation : '';
    const images = blockData ? blockData.images || [] : [];
    
    let deleteBtn = '';
    if (isCustomGroup) {
        deleteBtn = `
        <button type="button" onclick="window.removeCustomSection('${customGroupId}')" class="flex items-center justify-center p-3 border border-outline bg-surface-container-low text-error hover:bg-error/10 transition-all duration-200 cursor-pointer rounded-xl h-[48px] w-[48px] shrink-0" title="Excluir Item Adicional">
            <span class="material-symbols-outlined text-[22px]">delete</span>
        </button>`;
    }
    
    return `
    <div class="checklist-obs-block space-y-stack_sm border-t border-outline-variant/30 pt-3 first:border-t-0 first:pt-0">
        <div class="flex items-center justify-between gap-stack_md">
            <div class="image-preview-container flex gap-stack_sm flex-wrap flex-1">
                ${images.map(src => renderImagePreview(src)).join('')}
            </div>
            <div class="flex items-center gap-2 shrink-0">
                ${deleteBtn}
                <button type="button" class="checklist-upload-zone flex items-center justify-center p-3 border border-outline bg-surface-container-low text-on-surface-variant hover:text-green-600 hover:border-green-600 transition-all duration-200 cursor-pointer rounded-xl h-[48px] w-[48px]" title="Anexar Fotos">
                    <span class="material-symbols-outlined text-[22px]">add_a_photo</span>
                    <input type="file" accept="image/*" multiple class="hidden checklist-file-input">
                </button>
            </div>
        </div>
        <div>
            <textarea class="w-full bg-surface-container-low border border-outline py-2 px-4 text-body-md uppercase text-on-surface focus:ring-2 focus:ring-primary focus:border-primary transition-all duration-200 min-h-[48px] resize-none overflow-hidden checklist-observation" placeholder="OBSERVAÇÃO" rows="1">${text}</textarea>
        </div>
    </div>`;
}

function renderInspectableGroup(node, doc = null) {
    const inspectables = (node.children || []).filter(c => c.fieldType === 'inspectable' || (!c.fieldType && c.label));
    const itemsHtml = inspectables.map((child, idx) => {
        const childId = (child && child.id && String(child.id).trim()) || `${node.id || 'sec'}_chk_${idx + 1}`;
        return `
        <div class="flex items-center justify-between border-b border-outline-variant/30 py-2.5 last:border-b-0 gap-2" data-field-id="${childId}" data-section-id="${node.id || ''}">
            <span class="text-[12px] font-bold uppercase text-on-surface leading-snug flex-1">${escapeHTML(child.label || child.descricao || '')}</span>
            <div class="flex flex-col gap-1 shrink-0 ml-2">
                <label class="flex items-center gap-1.5 cursor-pointer group py-0.5 px-1 rounded-lg">
                    <input type="radio" name="status-${childId}" value="OK" class="checklist-status-ok border-outline text-green-600 focus:ring-green-600 transition-all duration-200 w-4.5 h-4.5">
                    <span class="text-[11px] font-extrabold uppercase text-on-surface group-hover:text-green-600 transition-all duration-200">OK</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer group py-0.5 px-1 rounded-lg">
                    <input type="radio" name="status-${childId}" value="NOK" class="checklist-status-nok border-outline text-error focus:ring-error transition-all duration-200 w-4.5 h-4.5">
                    <span class="text-[11px] font-extrabold uppercase text-on-surface group-hover:text-error transition-all duration-200">NOK</span>
                </label>
            </div>
        </div>
    `;
    }).join('');

    const customItemsList = (doc && doc.customItems)
        ? doc.customItems.filter(ci => ci.sectionId === node.id)
        : ((typeof window !== 'undefined' && window.activeCustomItems) ? window.activeCustomItems : []).filter(ci => ci.sectionId === node.id);

    const customItemsHtml = customItemsList.map(ci => renderCustomChecklistItemRow(ci, node.id)).join('');

    const isCustom = node.id && String(node.id).startsWith('custom_');

    return `
    <div class="checklist-field checklist-inspectable-group border border-outline-variant bg-surface p-card_padding space-y-stack_md transition-all duration-200" data-section-id="${node.id}">
        <div class="divide-y divide-outline-variant/30 checklist-items-container">
            ${itemsHtml}
            ${customItemsHtml}
        </div>
        
        <!-- Contêiner de Blocos de Observação -->
        <div class="checklist-obs-blocks-container space-y-stack_md pt-2">
            ${renderObservationBlock(null, false, isCustom, node.id)}
        </div>
    </div>`;
}

function renderCableCompositeGroup(node, doc = null) {
    const inspectables = (node.children || []).filter(c => c.fieldType === 'inspectable');
    const itemsHtml = inspectables.map((child, idx) => {
        const childId = (child && child.id && String(child.id).trim()) || `${node.id || 'sec'}_chk_${idx + 1}`;
        return `
        <div class="flex items-center justify-between border-b border-outline-variant/30 py-2.5 last:border-b-0 gap-2" data-field-id="${childId}" data-section-id="${node.id || ''}">
            <span class="text-[12px] font-bold uppercase text-on-surface leading-snug flex-1">${escapeHTML(child.label || child.descricao || '')}</span>
            <div class="flex flex-col gap-1 shrink-0 ml-2">
                <label class="flex items-center gap-1.5 cursor-pointer group py-0.5 px-1 rounded-lg">
                    <input type="radio" name="status-${childId}" value="OK" class="checklist-status-ok border-outline text-green-600 focus:ring-green-600 transition-all duration-200 w-4.5 h-4.5">
                    <span class="text-[11px] font-extrabold uppercase text-on-surface group-hover:text-green-600 transition-all duration-200">OK</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer group py-0.5 px-1 rounded-lg">
                    <input type="radio" name="status-${childId}" value="NOK" class="checklist-status-nok border-outline text-error focus:ring-error transition-all duration-200 w-4.5 h-4.5">
                    <span class="text-[11px] font-extrabold uppercase text-on-surface group-hover:text-error transition-all duration-200">NOK</span>
                </label>
            </div>
        </div>
    `;
    }).join('');

    const customItemsList = (doc && doc.customItems)
        ? doc.customItems.filter(ci => ci.sectionId === node.id)
        : ((typeof window !== 'undefined' && window.activeCustomItems) ? window.activeCustomItems : []).filter(ci => ci.sectionId === node.id);

    const customItemsHtml = customItemsList.map(ci => renderCustomChecklistItemRow(ci, node.id)).join('');

    return `
    <div class="checklist-field checklist-inspectable-group border border-outline-variant bg-surface p-card_padding space-y-stack_md transition-all duration-200" data-section-id="${node.id}">
        <div class="divide-y divide-outline-variant/30 checklist-items-container">
            ${itemsHtml}
            ${customItemsHtml}
        </div>
        ${renderCableInspectionTable(node)}
    </div>`;
}

function renderHookCompositeGroup(node, doc = null) {
    const inspectables = (node.children || []).filter(c => c.fieldType === 'inspectable');
    const itemsHtml = inspectables.map((child, idx) => {
        const childId = (child && child.id && String(child.id).trim()) || `${node.id || 'sec'}_chk_${idx + 1}`;
        return `
        <div class="flex items-center justify-between border-b border-outline-variant/30 py-2.5 last:border-b-0 gap-2" data-field-id="${childId}" data-section-id="${node.id || ''}">
            <span class="text-[12px] font-bold uppercase text-on-surface leading-snug flex-1">${escapeHTML(child.label || child.descricao || '')}</span>
            <div class="flex flex-col gap-1 shrink-0 ml-2">
                <label class="flex items-center gap-1.5 cursor-pointer group py-0.5 px-1 rounded-lg">
                    <input type="radio" name="status-${childId}" value="OK" class="checklist-status-ok border-outline text-green-600 focus:ring-green-600 transition-all duration-200 w-4.5 h-4.5">
                    <span class="text-[11px] font-extrabold uppercase text-on-surface group-hover:text-green-600 transition-all duration-200">OK</span>
                </label>
                <label class="flex items-center gap-1.5 cursor-pointer group py-0.5 px-1 rounded-lg">
                    <input type="radio" name="status-${childId}" value="NOK" class="checklist-status-nok border-outline text-error focus:ring-error transition-all duration-200 w-4.5 h-4.5">
                    <span class="text-[11px] font-extrabold uppercase text-on-surface group-hover:text-error transition-all duration-200">NOK</span>
                </label>
            </div>
        </div>
    `;
    }).join('');

    const customItemsList = (doc && doc.customItems)
        ? doc.customItems.filter(ci => ci.sectionId === node.id)
        : ((typeof window !== 'undefined' && window.activeCustomItems) ? window.activeCustomItems : []).filter(ci => ci.sectionId === node.id);

    const customItemsHtml = customItemsList.map(ci => renderCustomChecklistItemRow(ci, node.id)).join('');

    return `
    <div class="checklist-field checklist-inspectable-group border border-outline-variant bg-surface p-card_padding space-y-stack_md transition-all duration-200" data-section-id="${node.id}">
        <div class="divide-y divide-outline-variant/30 checklist-items-container">
            ${itemsHtml}
            ${customItemsHtml}
        </div>
        ${renderHookInspectionTable(node)}
    </div>`;
}

function renderCableInspectionTable(node) {
    const prefix = node.id;
    const thStyle = 'border border-outline-variant p-2.5 text-center text-[11px] font-extrabold uppercase bg-surface-container-low text-on-surface align-middle';
    const subThStyle = 'border border-outline-variant p-2 text-center text-[10px] font-bold uppercase bg-surface-container-low/60 text-on-surface-variant leading-tight align-middle';
    const scaleThStyle = 'border border-outline-variant p-2 text-center text-[9px] font-semibold uppercase bg-surface-container-low/40 text-on-surface-variant leading-tight align-middle';
    const cellStyle = 'border border-outline-variant p-0 text-center bg-surface';
    const inputStyle = 'w-full bg-transparent text-center border-0 py-2.5 px-2 text-[12px] font-bold uppercase text-on-surface focus:bg-primary/5 focus:ring-2 focus:ring-primary outline-none checklist-text-value';

    // Campo de Observações renderizado separadamente abaixo da tabela (sem label)
    const obsField = (node.children || []).find(c => c.id === `${prefix}.observacoes`);
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
    <div class="checklist-field checklist-cable-table-block space-y-3" data-section-id="${prefix}">
        <div class="flex items-center gap-1.5 text-[11px] font-bold text-primary uppercase mb-1">
            <span class="material-symbols-outlined text-[16px] animate-pulse">swipe</span>
            <span>Deslize para os lados para preencher todas as colunas</span>
        </div>
        <div class="overflow-x-auto rounded-xl border border-outline-variant bg-surface custom-scrollbar pb-1">
            <table class="min-w-[960px] w-full border-collapse text-[11px]">
                <thead>
                    <tr>
                        <th rowspan="2" class="${thStyle} w-[110px] min-w-[110px]">Arames Rompidos</th>
                        <th colspan="4" class="${thStyle}">Redução do Diâmetro</th>
                        <th class="${thStyle} w-[115px] min-w-[115px]">Corrosão</th>
                        <th class="${thStyle} w-[125px] min-w-[125px]">Deformação ou Danos</th>
                        <th class="${thStyle} w-[155px] min-w-[155px]">Grau Acumulativo de Deterioração (e outras observações)</th>
                    </tr>
                    <tr>
                        <th class="${subThStyle} w-[95px] min-w-[95px]">Bitola do Cabo</th>
                        <th class="${subThStyle} w-[170px] min-w-[170px]">Diâmetro conforme catálogo de referência (Cimaf/similar)</th>
                        <th class="${subThStyle} w-[115px] min-w-[115px]">Diâmetro valor medido</th>
                        <th class="${subThStyle} w-[145px] min-w-[145px]">Redução do diâmetro em porcentagem (7% máximo conforme norma)</th>
                        <th class="${scaleThStyle} w-[115px] min-w-[115px]">
                            GRAU<br>
                            1 = ok<br>
                            2 = leve<br>
                            3 = médio<br>
                            4 = alto<br>
                            5 = Substituição
                        </th>
                        <th class="${scaleThStyle} w-[125px] min-w-[125px]">
                            GRAU<br>
                            1 = ok<br>
                            2 = leve<br>
                            3 = médio<br>
                            4 = alto<br>
                            5 = Substituição
                        </th>
                        <th class="${scaleThStyle} w-[155px] min-w-[155px]">
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
        </div>
        ${obsHtml ? `<div class="pt-1">${obsHtml}</div>` : ''}
    </div>`;
}

function renderHookInspectionTable(node) {
    const prefix = node.id;
    const thStyle = 'border border-outline-variant p-2.5 text-center text-[11px] font-extrabold uppercase bg-surface-container-low text-on-surface align-middle min-w-[130px]';
    const cellStyle = 'border border-outline-variant p-0 text-center bg-surface';
    const inputStyle = 'w-full bg-transparent text-center border-0 py-2.5 px-2 text-[12px] font-bold uppercase text-on-surface focus:bg-primary/5 focus:ring-2 focus:ring-primary outline-none checklist-text-value';

    // Separa os campos de texto (tabela) do campo de observações e campos inspectables
    const fields = (node.children || []).filter(c => (c.fieldType === 'text') && c.id !== `${prefix}.observacoes`);
    const obsField = (node.children || []).find(c => c.id === `${prefix}.observacoes`);
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
        `<th class="${thStyle}">${escapeHTML(field.label)}</th>`
    ).join('');

    const cellsHtml = fields.map(field =>
        `<td class="${cellStyle}" data-field-id="${field.id}" data-field-type="text">
            <input type="text" class="${inputStyle}" placeholder="OK">
        </td>`
    ).join('');

    return `
    <div class="checklist-field checklist-hook-table-block space-y-3" data-section-id="${prefix}">
        <div class="flex items-center gap-1.5 text-[11px] font-bold text-primary uppercase mb-1">
            <span class="material-symbols-outlined text-[16px] animate-pulse">swipe</span>
            <span>Deslize para os lados para preencher todas as colunas</span>
        </div>
        <div class="overflow-x-auto rounded-xl border border-outline-variant bg-surface custom-scrollbar pb-1">
            <table class="min-w-[670px] w-full border-collapse text-[11px]">
                <thead>
                    <tr>${headersHtml}</tr>
                </thead>
                <tbody>
                    <tr>${cellsHtml}</tr>
                </tbody>
            </table>
        </div>
        ${obsHtml ? `<div class="pt-1">${obsHtml}</div>` : ''}
    </div>`;
}

export function renderNode(node, displayNum, doc = null) {
    if (node.fieldType === 'inspectable') return renderInspectable(node);
    if (node.fieldType === 'text' || node.fieldType === 'textarea') return renderTextField(node);

    // Cabo de aço composto (5.6, 6.6 ou modelos customizados com specialType)
    const isCableComposite = node.specialType === 'cableComposite' ||
        ((node.id === '5.6' || node.id === '6.6') && node.children && node.children.some(c => c.id && c.id.endsWith('.arames')) && node.children.some(c => c.fieldType === 'inspectable'));
    if (isCableComposite) {
        let html = renderSectionHeader(node, displayNum);
        const childPadding = node.level === 1 ? '' : 'pl-container_gutter';
        html += `<div class="${childPadding} mt-stack_sm">`;
        html += renderCableCompositeGroup(node, doc);
        html += '</div>';
        return html;
    }

    // Moitão composto (5.7, 6.7 ou modelos customizados com specialType)
    const isHookComposite = node.specialType === 'hookComposite' ||
        ((node.id === '5.7' || node.id === '6.7') && node.children && node.children.some(c => c.id && c.id.endsWith('.penetrante')) && node.children.some(c => c.fieldType === 'inspectable'));
    if (isHookComposite) {
        let html = renderSectionHeader(node, displayNum);
        const childPadding = node.level === 1 ? '' : 'pl-container_gutter';
        html += `<div class="${childPadding} mt-stack_sm">`;
        html += renderHookCompositeGroup(node, doc);
        html += '</div>';
        return html;
    }

    // Tabelas isoladas (para compatibilidade com schemas antigos ou tabelas puras)
    const isCableTable = node.id === '5.6.1' || node.id === '6.6.1' || node.specialType === 'cableTable';
    if (isCableTable) {
        let html = renderSectionHeader(node, displayNum);
        const childPadding = node.level === 1 ? '' : 'pl-container_gutter';
        html += `<div class="${childPadding} mt-stack_sm">`;
        html += renderCableInspectionTable(node);
        html += '</div>';
        return html;
    }

    const isHookTable = node.id === '5.7.2' || node.id === '6.7.2' || node.specialType === 'hookTable';
    if (isHookTable) {
        let html = renderSectionHeader(node, displayNum);
        const childPadding = node.level === 1 ? '' : 'pl-container_gutter';
        html += `<div class="${childPadding} mt-stack_sm">`;
        html += renderHookInspectionTable(node);
        html += '</div>';
        return html;
    }

    const isGroup = (node.children && node.children.length > 0 && node.children[0].fieldType === 'inspectable') ||
        (Array.isArray(node.children) && node.children.length === 0);

    let html = renderSectionHeader(node, displayNum);
    
    if (isGroup) {
        const childPadding = node.level === 1 ? '' : 'pl-container_gutter';
        html += `<div class="${childPadding} mt-stack_sm">`;
        html += renderInspectableGroup(node, doc);
        html += '</div>';
    } else {
        const childPadding = node.level === 1 ? 'space-y-stack_md' : 'space-y-stack_md pl-container_gutter';
        html += `<div class="${childPadding} mt-stack_sm">`;
        node.children.forEach(child => {
            html += renderNode(child, null, doc);
        });
        html += '</div>';
    }

    if (node.level === 1) {
        html += '<div class="h-px bg-outline-variant w-full my-stack_lg"></div>';
        return `<div class="checklist-section-wrapper" data-section-id="${node.id}">${html}</div>`;
    }
    return html;
}

export function renderResponsibleCard(respId = '', providedUsersList = null, cardIndex = 0) {
    const listToUse = (providedUsersList && Array.isArray(providedUsersList) && providedUsersList.length > 0) 
        ? providedUsersList 
        : ((window.usersList && Array.isArray(window.usersList) && window.usersList.length > 0) ? window.usersList : (usersList || []));

    const optionsHtml = listToUse.map(u => {
        const idStr = String(u.id);
        const selected = (respId !== null && respId !== undefined && respId !== '' && String(respId) === idStr) ? 'selected' : '';
        const nameUpper = (u.name || '').toUpperCase();
        const cargoUpper = (u.cargo || u.role || 'TÉCNICO').toUpperCase();
        return `<option value="${idStr}" ${selected}>${nameUpper} - ${cargoUpper}</option>`;
    }).join('');

    return `
    <div class="checklist-responsible-card border border-outline-variant bg-surface p-card_padding space-y-stack_sm transition-all duration-200 rounded-2xl mt-4" data-card-index="${cardIndex}">
        <div class="flex items-center justify-between border-b border-outline-variant/30 pb-3">
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[#EAB308] text-[24px]">badge</span>
                <span class="text-body-md font-bold uppercase text-on-surface">RESPONSÁVEL / ASSINATURA DIGITAL</span>
            </div>
            <button type="button" onclick="this.closest('.checklist-responsible-card').remove()" class="text-error hover:opacity-80 p-1 flex items-center justify-center cursor-pointer transition-all shrink-0" title="Remover Responsável">
                <span class="material-symbols-outlined text-[22px]">delete</span>
            </button>
        </div>
        <div class="space-y-stack_sm pt-2">
            <label class="text-label-md font-bold text-on-surface-variant uppercase text-xs tracking-wider">SELEÇÃO DE USUÁRIO CADASTRADO</label>
            <select class="w-full bg-surface-container-low border border-outline py-3 px-4 text-body-md font-bold uppercase text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all rounded-xl cursor-pointer checklist-responsible-select">
                <option value="">-- SELEÇÃO DE USUÁRIO --</option>
                ${optionsHtml}
            </select>
        </div>
    </div>`;
}

export function renderRevisionsBlock(revisions = null, providedUsersList = null) {
    const users = (providedUsersList && Array.isArray(providedUsersList) && providedUsersList.length > 0)
        ? providedUsersList
        : ((window.usersList && Array.isArray(window.usersList) && window.usersList.length > 0) ? window.usersList : (usersList || []));

    const rev01 = (revisions && revisions.rev01) || {};
    const rev02 = (revisions && revisions.rev02) || {};
    const rev03 = (revisions && revisions.rev03) || {};

    const renderSelect = (id, selectedVal) => {
        let opts = `<option value="">-- SELECIONE O USUÁRIO --</option>`;
        opts += users.map(u => {
            const idStr = String(u.id);
            const nameUpper = (u.name || '').toUpperCase();
            const cargoUpper = (u.cargo || u.role || 'TÉCNICO').toUpperCase();
            const isSel = (selectedVal && (String(selectedVal) === idStr || selectedVal.toUpperCase() === nameUpper)) ? 'selected' : '';
            return `<option value="${idStr}" ${isSel}>${nameUpper} - ${cargoUpper}</option>`;
        }).join('');
        return `<select id="${id}" class="w-full bg-surface-container-low border border-outline py-2.5 px-3 text-body-sm font-bold uppercase text-on-surface focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all rounded-xl cursor-pointer">
            ${opts}
        </select>`;
    };

    return `
    <div id="checklist-revisions-container" class="border border-outline-variant bg-surface p-card_padding space-y-stack_md transition-all duration-200 rounded-2xl mt-6 mb-4">
        <div class="flex items-center justify-between border-b border-outline-variant/30 pb-3">
            <div class="flex items-center gap-2">
                <span class="material-symbols-outlined text-[#EAB308] text-[24px]">history_edu</span>
                <span class="text-body-md font-bold uppercase text-on-surface">CONTROLE DE REVISÕES (CAPA DO LAUDO)</span>
            </div>
        </div>

        <!-- REV 00 (EMISSÃO INICIAL) -->
        <div class="bg-surface-container-lowest border border-outline-variant/50 p-4 rounded-xl space-y-3">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="bg-primary text-on-primary font-black px-2.5 py-1 text-xs rounded-lg uppercase">REV 00</span>
                    <span class="text-label-md font-bold text-on-surface uppercase">EMISSÃO INICIAL</span>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                <div>
                    <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1">PREPARADO</label>
                    ${renderSelect('checklist-rev01-prepared', rev01.prepared)}
                </div>
                <div>
                    <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1">COLABORAÇÃO</label>
                    ${renderSelect('checklist-rev01-collaboration', rev01.collaboration)}
                </div>
                <div>
                    <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1">CONTROLADO</label>
                    ${renderSelect('checklist-rev01-checked', rev01.checked)}
                </div>
                <div>
                    <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1">APROVADOR</label>
                    ${renderSelect('checklist-rev01-approved', rev01.approved)}
                </div>
            </div>
        </div>

        <!-- REV 01 (REVISÃO 01 - OPCIONAL) -->
        <div class="bg-surface-container-lowest border border-outline-variant/50 p-4 rounded-xl space-y-3">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="bg-primary text-on-primary font-black px-2.5 py-1 text-xs rounded-lg uppercase">REV 01</span>
                    <span class="text-label-md font-bold text-on-surface uppercase">REVISÃO 01 (OPCIONAL)</span>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1">DATA DA REVISÃO 01</label>
                    <input type="date" id="checklist-rev02-date" value="${rev02.date || ''}" class="w-full bg-surface-container-low border border-outline py-2 px-3 text-body-sm font-bold text-on-surface rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none">
                </div>
                <div>
                    <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1">DESCRIÇÃO DA REVISÃO 01</label>
                    <input type="text" id="checklist-rev02-description" value="${rev02.description || 'REVISÃO'}" placeholder="REVISÃO" class="w-full bg-surface-container-low border border-outline py-2 px-3 text-body-sm font-bold uppercase text-on-surface rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none">
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                <div>
                    <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1">PREPARADO</label>
                    ${renderSelect('checklist-rev02-prepared', rev02.prepared)}
                </div>
                <div>
                    <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1">COLABORAÇÃO</label>
                    ${renderSelect('checklist-rev02-collaboration', rev02.collaboration)}
                </div>
                <div>
                    <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1">CONTROLADO</label>
                    ${renderSelect('checklist-rev02-checked', rev02.checked)}
                </div>
                <div>
                    <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1">APROVADOR</label>
                    ${renderSelect('checklist-rev02-approved', rev02.approved)}
                </div>
            </div>
        </div>

        <!-- REV 02 (REVISÃO 02 - OPCIONAL) -->
        <div class="bg-surface-container-lowest border border-outline-variant/50 p-4 rounded-xl space-y-3">
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <span class="bg-primary text-on-primary font-black px-2.5 py-1 text-xs rounded-lg uppercase">REV 02</span>
                    <span class="text-label-md font-bold text-on-surface uppercase">REVISÃO 02 (OPCIONAL)</span>
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                    <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1">DATA DA REVISÃO 02</label>
                    <input type="date" id="checklist-rev03-date" value="${rev03.date || ''}" class="w-full bg-surface-container-low border border-outline py-2 px-3 text-body-sm font-bold text-on-surface rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none">
                </div>
                <div>
                    <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1">DESCRIÇÃO DA REVISÃO 02</label>
                    <input type="text" id="checklist-rev03-description" value="${rev03.description || 'REVISÃO'}" placeholder="REVISÃO" class="w-full bg-surface-container-low border border-outline py-2 px-3 text-body-sm font-bold uppercase text-on-surface rounded-xl focus:ring-2 focus:ring-primary focus:border-primary outline-none">
                </div>
            </div>
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
                <div>
                    <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1">PREPARADO</label>
                    ${renderSelect('checklist-rev03-prepared', rev03.prepared)}
                </div>
                <div>
                    <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1">COLABORAÇÃO</label>
                    ${renderSelect('checklist-rev03-collaboration', rev03.collaboration)}
                </div>
                <div>
                    <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1">CONTROLADO</label>
                    ${renderSelect('checklist-rev03-checked', rev03.checked)}
                </div>
                <div>
                    <label class="block text-xs font-bold text-on-surface-variant uppercase mb-1">APROVADOR</label>
                    ${renderSelect('checklist-rev03-approved', rev03.approved)}
                </div>
            </div>
        </div>
    </div>
    `;
}

export function renderChecklistForm(doc = null) {
    const schemaToUse = (doc && doc.schema && Array.isArray(doc.schema) && doc.schema.length > 0)
        ? doc.schema
        : CHECKLIST_SCHEMA;
    let sectionsHtml = schemaToUse.map(node => renderNode(node, node.id, doc)).join('');
    
    if (doc && doc.customSections) {
        doc.customSections.forEach(node => {
            sectionsHtml += renderNode(node, node.id, doc);
        });
    }

    let responsivesList = (doc && doc.responsaveis && Array.isArray(doc.responsaveis)) ? [...doc.responsaveis] : [];
    while (responsivesList.length < 2) {
        responsivesList.push('');
    }
    const users = (window.usersList && Array.isArray(window.usersList) && window.usersList.length > 0) ? window.usersList : (usersList || []);

    const bottomBtnsAndResponsibles = `
    <div class="flex flex-wrap justify-center items-center gap-stack_md pt-stack_sm pb-stack_md">
        <button type="button" onclick="window.addResponsibleBlock()" class="px-6 py-3.5 border border-dashed border-outline-variant text-on-surface hover:text-primary hover:border-primary transition-all duration-200 uppercase font-bold text-label-md flex items-center gap-2 rounded-xl bg-surface cursor-pointer">
            <span class="material-symbols-outlined text-[20px]">person_add</span>
            ADICIONAR RESPONSÁVEL
        </button>
    </div>
    <div id="checklist-responsibles-container" class="space-y-stack_md pb-stack_md">
        ${responsivesList.map((respId, idx) => renderResponsibleCard(respId, users, idx)).join('')}
    </div>
    `;

    const revisionsHtml = renderRevisionsBlock(doc && doc.revisions, users);

    return `<div id="checklist-sections-container">${sectionsHtml}</div>` + bottomBtnsAndResponsibles + revisionsHtml;
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
