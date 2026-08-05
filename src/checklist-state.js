// Crane Pro - Checklist State (serialização e validação)

import { createEmptyResponses, walkChecklistFields, CHECKLIST_SCHEMA } from './checklist-schema.js';
import { renderObservationBlock, renderResponsibleBlock } from './checklist-render.js';

export function createInspectionDocument(context, existing = null) {
    const base = existing || {};
    return {
        id: base.id || null,
        status: base.status || 'DRAFT',
        type: context.tipo || base.type || 'PREVENTIVA',
        empresa: context.empresa || base.empresa || '',
        equipamentoId: context.equipamentoId || base.equipamentoId || '',
        equipamentoNome: context.equipamentoNome || base.equipamentoNome || '',
        assetInfo: context.assetInfo || base.assetInfo || '',
        date: base.date || new Date().toLocaleDateString('pt-BR'),
        createdAt: base.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        responses: base.responses || createEmptyResponses(),
        generalObservation: base.generalObservation || '',
        generalImages: base.generalImages || [],
        customSections: base.customSections || [],
        customItems: base.customItems || [],
        responsibles: base.responsibles || [],
    };
}

export function collectFormData(rootEl) {
    const responses = createEmptyResponses();

    // 1. Coleta dados de grupos de inspeção (novo layout)
    rootEl.querySelectorAll('.checklist-inspectable-group').forEach(groupEl => {
        const radios = groupEl.querySelectorAll('input[type="radio"]:checked');
        const obsBlocks = groupEl.querySelectorAll('.checklist-obs-block');
        const firstBlock = obsBlocks[0];
        const additionalBlocks = Array.from(obsBlocks).slice(1);

        // O name é "status-ID", então extraímos o ID do primeiro item do grupo
        const firstRadio = groupEl.querySelector('input[type="radio"]');
        let firstItemId = null;
        if (firstRadio) {
            firstItemId = firstRadio.name.replace('status-', '');
        }

        // Inicializa o status de todos os itens do grupo
        groupEl.querySelectorAll('input[type="radio"]').forEach(radio => {
            const id = radio.name.replace('status-', '');
            if (!responses[id]) {
                responses[id] = { status: null, observation: '', images: [], additionalObservations: [] };
            }
        });

        // Grava os status selecionados
        radios.forEach(radio => {
            const id = radio.name.replace('status-', '');
            responses[id].status = radio.value;
        });

        // Grava a observação e as imagens apenas no primeiro item do grupo
        if (firstItemId && responses[firstItemId]) {
            if (firstBlock) {
                const obsEl = firstBlock.querySelector('.checklist-observation');
                const images = Array.from(firstBlock.querySelectorAll('.image-preview-container img')).map(img => img.src);
                responses[firstItemId].observation = obsEl ? obsEl.value : '';
                responses[firstItemId].images = images;
            }

            // Grava blocos de observações adicionais
            responses[firstItemId].additionalObservations = additionalBlocks.map(block => {
                const obsEl = block.querySelector('.checklist-observation');
                const images = Array.from(block.querySelectorAll('.image-preview-container img')).map(img => img.src);
                return {
                    observation: obsEl ? obsEl.value : '',
                    images: images
                };
            });
        }
    });

    // 2. Coleta dados de itens individuais (caso restem)
    rootEl.querySelectorAll('.checklist-inspectable').forEach(el => {
        const id = el.dataset.fieldId;
        const statusEl = el.querySelector('input[name="status-' + id + '"]:checked');
        const obsEl = el.querySelector('.checklist-observation');
        const images = Array.from(el.querySelectorAll('.image-preview-container img')).map(img => img.src);
        responses[id] = {
            status: statusEl ? statusEl.value : null,
            observation: obsEl ? obsEl.value : '',
            images,
        };
    });

    // 3. Coleta campos de texto e textarea normais
    rootEl.querySelectorAll('[data-field-type="text"], [data-field-type="textarea"]').forEach(el => {
        const id = el.dataset.fieldId;
        if (!id || id.startsWith('__')) return;
        const input = el.querySelector('.checklist-text-value');
        
        if (el.dataset.fieldType === 'textarea') {
            const images = Array.from(el.querySelectorAll('.image-preview-container img')).map(img => img.src);
            responses[id] = {
                value: input ? input.value : '',
                images: images
            };
        } else {
            responses[id] = { value: input ? input.value : '' };
        }
    });

    // 4. Coleta itens personalizados adicionados às seções existentes
    const customItems = [];
    rootEl.querySelectorAll('.checklist-custom-item-row').forEach(row => {
        const fieldId = row.dataset.fieldId;
        const labelEl = row.querySelector('span');
        const label = labelEl ? labelEl.innerText.trim() : '';
        const groupEl = row.closest('.checklist-inspectable-group');
        const sectionId = groupEl ? groupEl.dataset.sectionId : '';

        if (fieldId && label && sectionId) {
            customItems.push({
                id: fieldId,
                sectionId: sectionId,
                label: label,
                fieldType: 'inspectable'
            });
        }
    });

    // 5. Coleta blocos de responsáveis e assinaturas digitais
    const responsibles = [];
    rootEl.querySelectorAll('.checklist-responsible-block').forEach(block => {
        const nameInput = block.querySelector('.checklist-responsible-name');
        const roleInput = block.querySelector('.checklist-responsible-role');
        const sigImg = block.querySelector('.checklist-responsible-sig-preview img');

        const name = nameInput ? nameInput.value.trim() : '';
        const role = roleInput ? roleInput.value.trim() : '';
        const signatureImage = sigImg ? sigImg.src : '';

        if (name || signatureImage) {
            responsibles.push({ name, role, signatureImage });
        }
    });

    const generalObs = rootEl.querySelector('#checklist-general-observation');
    const generalImages = Array.from(rootEl.querySelectorAll('#checklist-general-images img')).map(img => img.src);

    return {
        responses,
        generalObservation: generalObs ? generalObs.value : '',
        generalImages,
        customItems,
        responsibles,
    };
}

export function applyFormData(rootEl, data) {
    if (!data) return;
    const responses = data.responses || {};

    // Restaurar blocos de responsáveis e assinaturas digitais
    if (data.responsibles && Array.isArray(data.responsibles)) {
        const respContainer = rootEl.querySelector('#checklist-responsibles-container');
        if (respContainer) {
            respContainer.innerHTML = '';
            data.responsibles.forEach(r => {
                const temp = document.createElement('div');
                temp.innerHTML = renderResponsibleBlock(r);
                const blockEl = temp.firstElementChild;
                respContainer.appendChild(blockEl);
                if (window.populateUserSelectInBlock) {
                    window.populateUserSelectInBlock(blockEl);
                }
                if (r.name) {
                    const select = blockEl.querySelector('.checklist-responsible-user-select');
                    if (select) {
                        select.value = r.name.toUpperCase();
                    }
                }
            });
        }
    }

    // Restaurar itens de checklist personalizados adicionados às seções
    if (data.customItems && Array.isArray(data.customItems)) {
        data.customItems.forEach(item => {
            if (!rootEl.querySelector(`[data-field-id="${item.id}"]`)) {
                const groupEl = rootEl.querySelector(`.checklist-inspectable-group[data-section-id="${item.sectionId}"]`);
                if (groupEl) {
                    const container = groupEl.querySelector('.divide-y');
                    if (container) {
                        const itemHtml = `
                        <div class="flex items-center justify-between border-b border-outline-variant/30 py-3 last:border-b-0 checklist-custom-item-row" data-field-id="${item.id}" data-field-type="inspectable">
                            <span class="text-body-md font-bold uppercase text-on-surface flex-1 mr-4">${item.label.toUpperCase()}</span>
                            <div class="flex items-center gap-stack_lg">
                                <button type="button" onclick="this.closest('.checklist-custom-item-row').remove()" class="text-error hover:bg-error/10 p-1.5 rounded-lg transition-colors mr-2 flex items-center justify-center shrink-0" title="Excluir Item">
                                    <span class="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                                <label class="flex items-center gap-stack_sm cursor-pointer group">
                                    <input type="radio" name="status-${item.id}" value="OK" class="checklist-status-ok border-outline text-green-600 focus:ring-green-600 bg-surface-container-low transition-all duration-200">
                                    <span class="text-label-md uppercase text-on-surface group-hover:text-green-600 transition-all duration-200">OK</span>
                                </label>
                                <label class="flex items-center gap-stack_sm cursor-pointer group">
                                    <input type="radio" name="status-${item.id}" value="NOK" class="checklist-status-nok border-outline text-error focus:ring-error bg-surface-container-low transition-all duration-200">
                                    <span class="text-label-md uppercase text-on-surface group-hover:text-error transition-all duration-200">NOK</span>
                                </label>
                            </div>
                        </div>`;
                        const temp = document.createElement('div');
                        temp.innerHTML = itemHtml;
                        container.appendChild(temp.firstElementChild);
                    }
                }
            }
        });
    }

    Object.entries(responses).forEach(([id, val]) => {
        if (val.status !== undefined) {
            // 1. Tenta restaurar no novo layout agrupado
            const radio = rootEl.querySelector(`input[name="status-${id}"][value="${val.status}"]`);
            if (radio) {
                radio.checked = true;
                if (val.status === 'NOK') {
                    const groupEl = radio.closest('.checklist-inspectable-group');
                    if (groupEl) markNokState(groupEl, true);
                }
            }

            // Se for o item que carrega as observações/imagens do grupo
            if (val.observation || (val.images && val.images.length > 0) || (val.additionalObservations && val.additionalObservations.length > 0)) {
                const anyRadio = rootEl.querySelector(`input[name="status-${id}"]`);
                if (anyRadio) {
                    const groupEl = anyRadio.closest('.checklist-inspectable-group');
                    if (groupEl) {
                        const blocksContainer = groupEl.querySelector('.checklist-obs-blocks-container');
                        if (blocksContainer) {
                            blocksContainer.innerHTML = '';
                            
                            // Renderiza o primeiro bloco (não removível)
                            const firstBlockHtml = renderObservationBlock({ observation: val.observation || '', images: val.images || [] }, false);
                            blocksContainer.innerHTML = firstBlockHtml;
                            
                            // Renderiza os blocos adicionais (removíveis)
                            if (val.additionalObservations) {
                                val.additionalObservations.forEach(blockData => {
                                    const blockHtml = renderObservationBlock(blockData, true);
                                    blocksContainer.innerHTML += blockHtml;
                                });
                            }
                        }
                    }
                }
            }

            // 2. Tenta restaurar no layout individual
            const el = rootEl.querySelector(`.checklist-inspectable[data-field-id="${id}"]`);
            if (el) {
                if (val.status) {
                    const r = el.querySelector(`input[name="status-${id}"][value="${val.status}"]`);
                    if (r) r.checked = true;
                }
                const obs = el.querySelector('.checklist-observation');
                if (obs) obs.value = val.observation || '';
                const container = el.querySelector('.image-preview-container');
                if (container && val.images) {
                    container.innerHTML = '';
                    val.images.forEach(src => {
                        const event = new CustomEvent('checklist-restore-image', { detail: { container, src } });
                        rootEl.dispatchEvent(event);
                    });
                }
                if (val.status === 'NOK') markNokState(el, true);
            }
        } else if (val.value !== undefined || val.images !== undefined) {
            const wrapper = rootEl.querySelector(`[data-field-id="${id}"]`);
            if (wrapper) {
                const input = wrapper.querySelector('.checklist-text-value');
                if (input) input.value = val.value;
                
                const container = wrapper.querySelector('.image-preview-container');
                if (container && val.images) {
                    container.innerHTML = '';
                    val.images.forEach(src => {
                        const event = new CustomEvent('checklist-restore-image', { detail: { container, src } });
                        rootEl.dispatchEvent(event);
                    });
                }
            }
        }
    });

    const generalObs = rootEl.querySelector('#checklist-general-observation');
    if (generalObs) generalObs.value = data.generalObservation || '';

    const generalContainer = rootEl.querySelector('#checklist-general-images');
    if (generalContainer && data.generalImages) {
        generalContainer.innerHTML = '';
        data.generalImages.forEach(src => {
            const event = new CustomEvent('checklist-restore-image', { detail: { container: generalContainer, src } });
            rootEl.dispatchEvent(event);
        });
    }

    // Auto-resize all textareas after restoring saved data
    requestAnimationFrame(() => {
        rootEl.querySelectorAll('textarea.checklist-observation, textarea.checklist-text-value').forEach(ta => {
            ta.style.height = 'auto';
            ta.style.height = ta.scrollHeight + 'px';
        });
    });
}

export function validateBeforeSend(rootEl) {
    const errors = [];

    // Validação para grupos
    rootEl.querySelectorAll('.checklist-inspectable-group').forEach(groupEl => {
        const noks = groupEl.querySelectorAll('input[value="NOK"]:checked');
        if (noks.length > 0) {
            const obs = groupEl.querySelector('.checklist-observation');
            if (!obs || !obs.value.trim()) {
                noks.forEach(nok => {
                    const id = nok.name.replace('status-', '');
                    errors.push(id);
                });
                markNokState(groupEl, true, true);
            }
        }
    });

    // Validação para individuais
    rootEl.querySelectorAll('.checklist-inspectable').forEach(el => {
        const id = el.dataset.fieldId;
        const nok = el.querySelector(`input[name="status-${id}"][value="NOK"]:checked`);
        if (nok) {
            const obs = el.querySelector('.checklist-observation');
            if (!obs || !obs.value.trim()) {
                errors.push(id);
                markNokState(el, true, true);
            }
        }
    });

    return errors;
}

export function markNokState(el, isNok, requireObs = false) {
    if (isNok) {
        el.classList.add('border-l-4', 'border-error', 'bg-error/5');
        const obs = el.querySelector('.checklist-observation');
        if (obs) {
            obs.classList.add('border-error');
            if (requireObs) obs.placeholder = 'Observação obrigatória (NOK)';
        }
    } else {
        if (el.classList.contains('checklist-inspectable-group')) {
            const hasNok = el.querySelector('input[value="NOK"]:checked');
            if (hasNok) return; // Mantém o destaque se ainda houver algum NOK marcado
        }
        el.classList.remove('border-l-4', 'border-error', 'bg-error/5');
        const obs = el.querySelector('.checklist-observation');
        if (obs) {
            obs.classList.remove('border-error');
            obs.placeholder = 'Observação';
        }
    }
}

export function countInspectableFields() {
    let count = 0;
    walkChecklistFields(CHECKLIST_SCHEMA, f => {
        if (f.fieldType === 'inspectable') count++;
    });
    return count;
}

export function mergeLegacyReport(report) {
    if (report.responses) return report;
    const doc = createInspectionDocument({
        tipo: report.type,
        empresa: report.empresa,
        equipamentoId: report.equipamento,
        equipamentoNome: report.equipamento,
        assetInfo: report.assetInfo,
    }, { ...report, responses: createEmptyResponses() });
    return doc;
}
