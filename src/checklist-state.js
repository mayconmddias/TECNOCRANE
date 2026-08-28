// Crane Pro - Checklist State (serialização e validação)

import { createEmptyResponses, walkChecklistFields, CHECKLIST_SCHEMA } from './checklist-schema.js';
import { renderObservationBlock } from './checklist-render.js';

export function createInspectionDocument(context, existing = null) {
    const base = existing || {};
    const rawSchema = (context && (context.schema_snapshot || context.schema)) || base.schema_snapshot || base.schema || null;
    const schemaSnapshot = rawSchema ? JSON.parse(JSON.stringify(rawSchema)) : null;
    const templateId = (context && context.templateId) || base.templateId || null;
    const templateName = (context && context.templateName) || base.templateName || null;

    return {
        id: base.id || null,
        status: base.status || 'DRAFT',
        type: (context && context.tipo) || base.type || 'PREVENTIVA',
        schema: schemaSnapshot,
        schema_snapshot: schemaSnapshot,
        templateId: templateId,
        templateName: templateName,
        empresa: (context && context.empresa) || base.empresa || '',
        equipamentoId: (context && context.equipamentoId) || base.equipamentoId || '',
        equipamentoNome: (context && context.equipamentoNome) || base.equipamentoNome || '',
        assetInfo: (context && context.assetInfo) || base.assetInfo || '',
        date: base.date || new Date().toLocaleDateString('pt-BR'),
        createdAt: base.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        responses: base.responses || createEmptyResponses(schemaSnapshot),
        generalObservation: base.generalObservation || '',
        generalImages: base.generalImages || [],
        customSections: base.customSections || [],
        customItems: base.customItems || [],
        responsaveis: base.responsaveis || [],
        tecnico: base.tecnico || (context && (context.tecnico || context.userName)) || '',
        revisions: base.revisions || (context && context.revisions) || null,
    };
}

export function collectFormData(rootEl, schemaContext = null) {
    const responses = {};

    // 1. Coleta dados de grupos de inspeção (layout agrupado e customizado)
    rootEl.querySelectorAll('.checklist-inspectable-group').forEach(groupEl => {
        const sectionId = groupEl.dataset.sectionId || '';
        const radios = groupEl.querySelectorAll('input[type="radio"]:checked');
        const obsBlocks = groupEl.querySelectorAll('.checklist-obs-block');
        const firstBlock = obsBlocks[0];
        const additionalBlocks = Array.from(obsBlocks).slice(1);

        // Extrai o ID do primeiro item do grupo
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
            if (responses[id]) {
                responses[id].status = radio.value;
            }
        });

        const firstObsEl = firstBlock ? firstBlock.querySelector('.checklist-observation, textarea') : null;
        const firstImages = firstBlock ? Array.from(firstBlock.querySelectorAll('.image-preview-container img')).map(img => img.src) : [];
        const firstObsText = firstObsEl ? firstObsEl.value : '';

        const addObsList = additionalBlocks.map(block => {
            const obsEl = block.querySelector('.checklist-observation, textarea');
            const images = Array.from(block.querySelectorAll('.image-preview-container img')).map(img => img.src);
            return {
                observation: obsEl ? obsEl.value : '',
                images: images
            };
        });

        // Grava no primeiro item do grupo se houver, ou na chave da seção se não houver itens de checklist
        if (firstItemId && responses[firstItemId]) {
            responses[firstItemId].observation = firstObsText;
            responses[firstItemId].images = firstImages;
            responses[firstItemId].additionalObservations = addObsList;
        } else if (sectionId) {
            responses[sectionId] = {
                observation: firstObsText,
                images: firstImages,
                additionalObservations: addObsList
            };
        }
    });

    // 2. Coleta dados de itens individuais (caso restem)
    rootEl.querySelectorAll('.checklist-inspectable').forEach(el => {
        const id = el.dataset.fieldId;
        if (!id) return;
        const statusEl = el.querySelector('input[name="status-' + id + '"]:checked');
        const obsEl = el.querySelector('.checklist-observation, textarea');
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
        const input = el.querySelector('.checklist-text-value, textarea, input');
        
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

    const responsaveis = Array.from(rootEl.querySelectorAll('.checklist-responsible-select'))
        .map(sel => sel.value)
        .filter(val => val && val.trim() !== '');

    const getSelectVal = (id) => {
        const el = rootEl.querySelector('#' + id);
        return el ? el.value.trim() : '';
    };
    const getInputVal = (id) => {
        const el = rootEl.querySelector('#' + id);
        return el ? el.value.trim() : '';
    };

    const revisions = {
        rev01: {
            rev: '01',
            prepared: getSelectVal('checklist-rev01-prepared'),
            collaboration: getSelectVal('checklist-rev01-collaboration'),
            checked: getSelectVal('checklist-rev01-checked'),
            approved: getSelectVal('checklist-rev01-approved'),
        },
        rev02: {
            rev: '02',
            date: getInputVal('checklist-rev02-date'),
            description: getInputVal('checklist-rev02-description') || 'REVISÃO',
            prepared: getSelectVal('checklist-rev02-prepared'),
            collaboration: getSelectVal('checklist-rev02-collaboration'),
            checked: getSelectVal('checklist-rev02-checked'),
            approved: getSelectVal('checklist-rev02-approved'),
        },
        rev03: {
            rev: '03',
            date: getInputVal('checklist-rev03-date'),
            description: getInputVal('checklist-rev03-description') || 'REVISÃO',
            prepared: getSelectVal('checklist-rev03-prepared'),
            collaboration: getSelectVal('checklist-rev03-collaboration'),
            checked: getSelectVal('checklist-rev03-checked'),
            approved: getSelectVal('checklist-rev03-approved'),
        }
    };

    return {
        responses,
        generalObservation: generalObs ? generalObs.value : '',
        generalImages,
        responsaveis,
        revisions
    };
}

export function applyFormData(rootEl, data) {
    if (!data) return;
    const responses = data.responses || {};
    const restoredGroups = new Set();

    Object.entries(responses).forEach(([id, val]) => {
        if (!val || typeof val !== 'object' || id === '__meta' || id.startsWith('__')) return;

        // 1. Tenta restaurar status de rádio
        if (val.status !== undefined && val.status !== null) {
            let radio = rootEl.querySelector(`input[name="status-${id}"][value="${val.status}"]`);
            if (!radio) {
                // Fallback para IDs legados
                const fallbackId = id
                    .replace(/^7\.6\.1\./, '7.7.')
                    .replace(/^7\.6\.2\./, '7.7.')
                    .replace(/^7\.6\.3\./, '7.7.')
                    .replace(/^7\.6\.4\./, '7.7.')
                    .replace(/^8\.7\.1\./, '8.7.')
                    .replace(/^8\.7\.2\./, '8.7.')
                    .replace(/^5\.7\.1\./, '5.7.')
                    .replace(/^6\.7\.1\./, '6.7.');
                radio = rootEl.querySelector(`input[name="status-${fallbackId}"][value="${val.status}"]`);
            }

            if (radio) {
                radio.checked = true;
                if (val.status === 'NOK') {
                    const groupEl = radio.closest('.checklist-inspectable-group, .checklist-inspectable');
                    if (groupEl) markNokState(groupEl, true);
                }
            }
        }

        // 2. Restauração de Observações e Imagens no Grupo (por ID de item ou por ID de seção)
        if (val.observation || (val.images && val.images.length > 0) || (val.additionalObservations && val.additionalObservations.length > 0)) {
            let groupEl = rootEl.querySelector(`.checklist-inspectable-group[data-section-id="${id}"]`);
            if (!groupEl) {
                const anyRadio = rootEl.querySelector(`input[name="status-${id}"]`);
                if (anyRadio) {
                    groupEl = anyRadio.closest('.checklist-inspectable-group');
                }
            }

            if (groupEl && !restoredGroups.has(groupEl)) {
                restoredGroups.add(groupEl);
                const blocksContainer = groupEl.querySelector('.checklist-obs-blocks-container');
                if (blocksContainer) {
                    blocksContainer.innerHTML = '';
                    
                    const uniqueImages = Array.from(new Set(val.images || []));
                    const isCustom = groupEl.dataset.sectionId && groupEl.dataset.sectionId.startsWith('custom_');
                    const firstBlockHtml = renderObservationBlock({ observation: val.observation || '', images: uniqueImages }, false, isCustom, groupEl.dataset.sectionId);
                    blocksContainer.innerHTML = firstBlockHtml;
                    
                    // Renderiza os blocos adicionais (removíveis)
                    if (val.additionalObservations && Array.isArray(val.additionalObservations)) {
                        val.additionalObservations.forEach(blockData => {
                            const blockHtml = renderObservationBlock(blockData, true);
                            blocksContainer.innerHTML += blockHtml;
                        });
                    }
                }
            }
        }

        // 3. Tenta restaurar no layout individual
        const el = rootEl.querySelector(`.checklist-inspectable[data-field-id="${id}"]`);
        if (el) {
            if (val.status) {
                const r = el.querySelector(`input[name="status-${id}"][value="${val.status}"]`);
                if (r) r.checked = true;
            }
            const obs = el.querySelector('.checklist-observation, textarea');
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

        // 4. Campos de texto ou textarea
        if (val.value !== undefined || (val.images !== undefined && !val.status)) {
            let wrapper = rootEl.querySelector(`[data-field-id="${id}"]`);
            if (!wrapper) {
                const fallbackId = id
                    .replace(/^5\.6\.1\./, '5.6.')
                    .replace(/^6\.6\.1\./, '6.6.')
                    .replace(/^5\.7\.2\./, '5.7.')
                    .replace(/^6\.7\.2\./, '6.7.')
                    .replace(/\.abertura$/, '.gancho_abertura');
                wrapper = rootEl.querySelector(`[data-field-id="${fallbackId}"]`);
            }

            if (wrapper) {
                const input = wrapper.querySelector('.checklist-text-value, textarea, input');
                if (input && val.value !== undefined) input.value = val.value;
                
                const container = wrapper.querySelector('.image-preview-container');
                if (container && Array.isArray(val.images)) {
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
    if (generalObs && data.generalObservation !== undefined) generalObs.value = data.generalObservation || '';

    const generalContainer = rootEl.querySelector('#checklist-general-images');
    if (generalContainer && data.generalImages && Array.isArray(data.generalImages)) {
        generalContainer.innerHTML = '';
        data.generalImages.forEach(src => {
            const event = new CustomEvent('checklist-restore-image', { detail: { container: generalContainer, src } });
            rootEl.dispatchEvent(event);
        });
    }

    if (data && data.revisions) {
        const rev = data.revisions;
        const setVal = (id, val) => {
            const el = rootEl.querySelector('#' + id);
            if (el && val !== undefined && val !== null) el.value = val;
        };

        if (rev.rev01) {
            setVal('checklist-rev01-prepared', rev.rev01.prepared);
            setVal('checklist-rev01-collaboration', rev.rev01.collaboration);
            setVal('checklist-rev01-checked', rev.rev01.checked);
            setVal('checklist-rev01-approved', rev.rev01.approved);
        }
        if (rev.rev02) {
            setVal('checklist-rev02-date', rev.rev02.date);
            setVal('checklist-rev02-description', rev.rev02.description);
            setVal('checklist-rev02-prepared', rev.rev02.prepared);
            setVal('checklist-rev02-collaboration', rev.rev02.collaboration);
            setVal('checklist-rev02-checked', rev.rev02.checked);
            setVal('checklist-rev02-approved', rev.rev02.approved);
        }
        if (rev.rev03) {
            setVal('checklist-rev03-date', rev.rev03.date);
            setVal('checklist-rev03-description', rev.rev03.description);
            setVal('checklist-rev03-prepared', rev.rev03.prepared);
            setVal('checklist-rev03-collaboration', rev.rev03.collaboration);
            setVal('checklist-rev03-checked', rev.rev03.checked);
            setVal('checklist-rev03-approved', rev.rev03.approved);
        }
    }

    // Auto-resize all textareas after restoring saved data
    requestAnimationFrame(() => {
        rootEl.querySelectorAll('textarea.checklist-observation, textarea.checklist-text-value, textarea').forEach(ta => {
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
            const obs = groupEl.querySelector('.checklist-observation, textarea.checklist-text-value, textarea');
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
        const obs = el.querySelector('.checklist-observation, textarea.checklist-text-value');
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
        const obs = el.querySelector('.checklist-observation, textarea.checklist-text-value');
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
    if (!report) return createInspectionDocument({});
    const resolvedSchema = report.schema_snapshot || report.schema || (report.responses && report.responses.__meta && report.responses.__meta.schema) || null;
    const schemaSnapshot = resolvedSchema ? JSON.parse(JSON.stringify(resolvedSchema)) : null;

    return {
        ...report,
        schema: schemaSnapshot,
        schema_snapshot: schemaSnapshot,
        templateId: report.templateId || (report.responses && report.responses.__meta && report.responses.__meta.templateId) || null,
        templateName: report.templateName || (report.responses && report.responses.__meta && report.responses.__meta.templateName) || null,
        responses: (report.responses && Object.keys(report.responses).length > 0) ? report.responses : createEmptyResponses(schemaSnapshot),
        customSections: report.customSections || [],
        customItems: report.customItems || [],
        responsaveis: report.responsaveis || [],
        revisions: report.revisions || (report.responses && report.responses.__meta && report.responses.__meta.revisions) || null,
    };
}
