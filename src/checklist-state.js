// Crane Pro - Checklist State (serialização e validação)

import { createEmptyResponses, walkChecklistFields, CHECKLIST_SCHEMA } from './checklist-schema.js';
import { renderObservationBlock } from './checklist-render.js';

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

    const generalObs = rootEl.querySelector('#checklist-general-observation');
    const generalImages = Array.from(rootEl.querySelectorAll('#checklist-general-images img')).map(img => img.src);

    return {
        responses,
        generalObservation: generalObs ? generalObs.value : '',
        generalImages,
    };
}

export function applyFormData(rootEl, data) {
    if (!data) return;
    const responses = data.responses || {};

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
