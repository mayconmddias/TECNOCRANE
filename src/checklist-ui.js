// Crane Pro - Checklist UI (eventos e interações)

import { renderChecklistForm, renderImagePreview } from './checklist-render.js';
import { applyFormData, collectFormData, markNokState } from './checklist-state.js';

let formRoot = null;

export function mountChecklistForm(container, savedData = null) {
    container.innerHTML = renderChecklistForm(savedData);
    formRoot = container;
    bindChecklistEvents(container);
    if (savedData) applyFormData(container, savedData);
}

export function getFormRoot() {
    return formRoot;
}

function bindChecklistEvents(root) {
    if (root.dataset.eventsBound) return;
    root.dataset.eventsBound = "true";

    root.addEventListener('change', e => {
        const target = e.target;
        if (target.matches('.checklist-status-ok, .checklist-status-nok')) {
            const field = target.closest('.checklist-inspectable, .checklist-inspectable-group');
            if (field) markNokState(field, target.value === 'NOK');
        }
    });

    root.addEventListener('click', e => {
        const removeBtn = e.target.closest('.checklist-remove-image');
        if (removeBtn) {
            removeBtn.parentElement.remove();
            return;
        }
        const zone = e.target.closest('.checklist-upload-zone');
        if (zone) zone.querySelector('.checklist-file-input')?.click();
    });

    root.addEventListener('change', e => {
        if (e.target.matches('.checklist-file-input')) {
            handleFileInput(e.target);
        }
    });

    root.addEventListener('checklist-restore-image', e => {
        const { container, src } = e.detail;
        container.insertAdjacentHTML('beforeend', renderImagePreview(src));
    });

    // Auto-resize textareas on input
    function autoResizeTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
    }

    root.addEventListener('input', e => {
        if (e.target.matches('textarea.checklist-observation, textarea.checklist-text-value')) {
            autoResizeTextarea(e.target);
        }
    });

    // Initial auto-resize for textareas that already have content
    requestAnimationFrame(() => {
        root.querySelectorAll('textarea.checklist-observation, textarea.checklist-text-value').forEach(ta => {
            if (ta.value) autoResizeTextarea(ta);
        });
    });
}

function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height = Math.round((height * maxWidth) / width);
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width = Math.round((width * maxHeight) / height);
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                resolve(dataUrl);
            };
            img.onerror = () => {
                resolve(e.target.result);
            };
            img.src = e.target.result;
        };
        reader.onerror = () => {
            resolve("");
        };
        reader.readAsDataURL(file);
    });
}

function handleFileInput(input) {
    const zone = input.closest('.checklist-upload-zone');
    const isGeneral = zone?.classList.contains('checklist-general-upload');
    const container = isGeneral
        ? document.getElementById('checklist-general-images')
        : zone?.closest('.checklist-obs-block')?.querySelector('.image-preview-container') ||
          zone?.closest('.checklist-textarea-photo-block')?.querySelector('.image-preview-container') ||
          zone?.closest('.checklist-inspectable, .checklist-inspectable-group')?.querySelector('.image-preview-container');
    if (!container) return;

    Array.from(input.files).forEach(file => {
        compressImage(file).then(compressedSrc => {
            if (compressedSrc) {
                container.insertAdjacentHTML('beforeend', renderImagePreview(compressedSrc));
            }
        });
    });
    input.value = '';
}

export { collectFormData, applyFormData };
