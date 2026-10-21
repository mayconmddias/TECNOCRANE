// Crane Pro - Módulo de Interface do Usuário (MEUS MODELOS)

import {
    getTemplates,
    getTemplateById,
    saveTemplate,
    duplicateTemplate,
    deleteTemplate,
    loadTemplates,
    getAssetTemplates,
    getAssetTemplateById,
    saveAssetTemplate,
    duplicateAssetTemplate,
    deleteAssetTemplate,
    loadAssetTemplates,
    SYSTEM_INSPECTION_TEMPLATE_ID,
    SYSTEM_ASSET_TEMPLATE_ID,
    SYSTEM_INSPECTION_TEMPLATE,
    SYSTEM_ASSET_TEMPLATE
} from './templates-module.js';
import { CHECKLIST_SCHEMA } from '../../checklist-schema.js';

/**
 * Função utilitária global robusta para auto-expansão dinâmica de textareas.
 * Resolve definitivamente os problemas de textos empurrados para cima (scrollTop > 0)
 * e linhas cortadas na parte inferior (subpixel / descenders / margem de respiro).
 */
export function autoResizeTextarea(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return;

    // Garante propriedades estruturais essenciais
    el.style.boxSizing = 'border-box';
    el.style.resize = 'none';

    // Salva a altura mínima definida (inline style, dataset ou classe)
    const minHeight = parseFloat(el.dataset.minHeight) || 
                      (el.classList.contains('field-label') ? 42 : 
                       (el.id && el.id.startsWith('item-nome')) ? 38 : 
                       (el.id && el.id.startsWith('chk-desc')) ? 34 : 36);

    // Reseta temporariamente para 'auto' para permitir que o scrollHeight
    // reflita com 100% de fidelidade o número real de linhas (1, 2, 3, 4, 5+)
    // sem colapsar a zero e sem travar o motor de layout do WebView
    el.style.height = 'auto';

    // scrollHeight inclui conteúdo interno e padding (top + bottom)
    const scrollH = el.scrollHeight;

    // Calcula bordas reais da caixa
    const computed = (typeof window !== 'undefined' && typeof window.getComputedStyle === 'function') ? window.getComputedStyle(el) : null;
    const borderTop = computed ? (parseFloat(computed.borderTopWidth) || 0) : 1;
    const borderBottom = computed ? (parseFloat(computed.borderBottomWidth) || 0) : 1;
    const totalBorder = borderTop + borderBottom;

    // Margem de respiro generosa (+8px) para garantir que:
    // 1. A 3ª, 4ª e linhas seguintes fiquem 100% visíveis, sem encostar na borda inferior
    // 2. A caixa física seja maior que o texto, eliminando rolagem interna forçada
    const targetHeight = Math.max(minHeight, Math.ceil(scrollH + totalBorder + 8));

    el.style.height = targetHeight + 'px';
    el.style.overflowY = 'hidden';

    // Garante que o texto fique perfeitamente posicionado do topo para baixo
    el.scrollTop = 0;
}
if (typeof window !== 'undefined') {
    window.autoResizeTextarea = autoResizeTextarea;
}

let draftTemplate = null;
let draftAssetTemplate = null;
let activeTemplatesTab = 'assets'; // 'assets' | 'inspections'

/**
 * Renderiza a visão principal do módulo MEUS MODELOS
 */
export function renderTemplatesView() {
    const container = document.getElementById('templates-view');
    if (!container) return;

    drawTemplatesUI(container);

    Promise.all([loadTemplates(), loadAssetTemplates()]).then(() => {
        drawTemplatesUI(container);
    }).catch(err => {
        console.warn("CRANE PRO: Aviso ao carregar modelos:", err);
    });
}

export function switchTemplatesTab(tabName) {
    if (tabName !== 'inspections' && tabName !== 'assets') return;
    activeTemplatesTab = tabName;
    const container = document.getElementById('templates-view');
    if (container) drawTemplatesUI(container);
}

function drawTemplatesUI(container) {
    const isInspections = activeTemplatesTab === 'inspections';

    // Garante que o modelo padrão fique sempre no topo e os do usuário em seguida ordenados de A a Z
    const allTemplates = getTemplates() || [];
    const systemTpl = allTemplates.find(t => String(t.id) === SYSTEM_INSPECTION_TEMPLATE_ID) || SYSTEM_INSPECTION_TEMPLATE;
    const userTemplates = allTemplates
        .filter(t => String(t.id) !== SYSTEM_INSPECTION_TEMPLATE_ID)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
    const templates = [systemTpl, ...userTemplates];

    const allAssetTemplates = getAssetTemplates() || [];
    const systemAssetTpl = allAssetTemplates.find(a => String(a.id) === SYSTEM_ASSET_TEMPLATE_ID) || SYSTEM_ASSET_TEMPLATE;
    const userAssetTemplates = allAssetTemplates
        .filter(a => String(a.id) !== SYSTEM_ASSET_TEMPLATE_ID)
        .sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));
    const assetTemplates = [systemAssetTpl, ...userAssetTemplates];

    const formatDateOnly = (isoStr) => {
        if (!isoStr) return '-';
        try {
            const d = new Date(isoStr);
            return d.toLocaleDateString('pt-BR');
        } catch (e) {
            return isoStr;
        }
    };

    // Tab 1: Cards de Inspeção
    let inspectionsCardsHtml = '';
    if (templates.length === 0) {
        inspectionsCardsHtml = `
            <div class="col-span-full bg-white border border-[#e6d5a8] rounded-2xl p-10 text-center text-[#6a6a6a] shadow-sm">
                <span class="material-symbols-outlined text-[48px] text-primary/60 mb-2 block">format_list_bulleted_add</span>
                <p class="text-body-lg font-bold uppercase text-[#1f1f1f]">Nenhum formulário de inspeção cadastrado</p>
                <p class="text-body-md text-[#6a6a6a] mt-1">Crie um novo modelo de ativo para gerar automaticamente o formulário de inspeção vinculado.</p>
            </div>`;
    } else {
        inspectionsCardsHtml = templates.map(t => {
            const isSystem = t.isSystemDefault || String(t.id) === SYSTEM_INSPECTION_TEMPLATE_ID;
            const criador = isSystem ? 'Sistema (Crane Pro)' : (t.createdBy || 'Usuário');
            const dataCriacao = formatDateOnly(t.createdAt);
            const itemsCount = (t.items || []).length;

            return `
            <div class="bg-white border ${isSystem ? 'border-amber-300 shadow-amber-50/50' : 'border-[#e6d5a8]'} text-[#1f1f1f] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4">
                <div class="space-y-2">
                    <div>
                        <div class="text-body-lg font-bold text-[#1f1f1f] uppercase leading-snug">
                            <span class="text-[#6a6a6a] font-medium">Inspeção:</span> ${escapeHTML(t.nome)}
                        </div>
                    </div>
                    <div class="text-[12px] text-[#6a6a6a] space-y-0.5 pt-1 border-t border-[#e6d5a8]/60">
                        <div><span class="font-semibold text-[#1f1f1f]">Criado:</span> ${dataCriacao}</div>
                        <div><span class="font-semibold text-[#1f1f1f]">Responsável:</span> ${escapeHTML(criador)}</div>
                        <div><span class="font-semibold text-[#1f1f1f]">Itens:</span> ${itemsCount} seção(ões)</div>
                    </div>
                </div>
                <div class="pt-3 border-t border-[#e6d5a8]/60 flex items-center justify-between gap-2">
                    ${isSystem ? `
                        <button onclick="window.viewTemplateAction(event, '${t.id}')"
                            class="w-full border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-label-sm font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            title="Visualizar modelo padrão">
                            <span class="material-symbols-outlined text-[18px]">visibility</span>
                            VISUALIZAR
                        </button>
                    ` : `
                        <button onclick="window.editTemplateAction(event, '${t.id}')"
                            class="w-full border border-[#e6d5a8] bg-[#fff8e0] hover:bg-[#fff0c2] text-[#1f1f1f] text-label-sm font-bold py-2 px-3 rounded-xl flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                            title="Editar estrutura da inspeção">
                            <span class="material-symbols-outlined text-[18px]">edit</span>
                            EDITAR
                        </button>
                    `}
                </div>
            </div>`;
        }).join('');
    }

    // Tab 2: Cards de Ativos
    let assetCardsHtml = '';
    if (assetTemplates.length === 0) {
        assetCardsHtml = `
            <div class="col-span-full bg-white border border-[#e6d5a8] rounded-2xl p-10 text-center text-[#6a6a6a] shadow-sm">
                <span class="material-symbols-outlined text-[48px] text-primary/60 mb-2 block">precision_manufacturing</span>
                <p class="text-body-lg font-bold uppercase text-[#1f1f1f]">Nenhum modelo de ativo cadastrado</p>
                <p class="text-body-md text-[#6a6a6a] mt-1">Clique no botão "+" acima para cadastrar o primeiro modelo de ativo.</p>
            </div>`;
    } else {
        assetCardsHtml = assetTemplates.map(a => {
            const isSystem = a.isSystemDefault || String(a.id) === SYSTEM_ASSET_TEMPLATE_ID;
            const criador = isSystem ? 'Sistema (Crane Pro)' : (a.createdBy || 'Usuário');
            const dataCriacao = formatDateOnly(a.createdAt);

            return `
            <div class="bg-white border ${isSystem ? 'border-amber-300 shadow-amber-50/50' : 'border-[#e6d5a8]'} text-[#1f1f1f] rounded-2xl p-4 shadow-sm hover:shadow-md transition-all flex flex-col justify-between gap-4">
                <div class="space-y-2">
                    <div>
                        <div class="text-body-lg font-bold text-[#1f1f1f] uppercase leading-snug">
                            <span class="text-[#6a6a6a] font-medium">Ativo:</span> ${escapeHTML(a.nome)}
                        </div>
                    </div>
                    <div class="text-[12px] text-[#6a6a6a] space-y-0.5 pt-1 border-t border-[#e6d5a8]/60">
                        <div><span class="font-semibold text-[#1f1f1f]">Criado:</span> ${dataCriacao}</div>
                        <div><span class="font-semibold text-[#1f1f1f]">Responsável:</span> ${escapeHTML(criador)}</div>
                    </div>
                </div>
                <div class="pt-3 border-t border-[#e6d5a8]/60 flex items-center justify-between gap-2">
                    ${isSystem ? `
                        <div class="grid grid-cols-2 gap-2 w-full">
                            <button onclick="window.viewAssetTemplateAction(event, '${a.id}')"
                                class="border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-label-sm font-bold py-1.5 px-3 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer"
                                title="Visualizar modelo de ativo padrão">
                                <span class="material-symbols-outlined text-[16px]">visibility</span>
                                VISUALIZAR
                            </button>
                            <button onclick="window.duplicateAssetTemplateAction(event, '${a.id}')"
                                class="border border-[#e6d5a8] bg-[#fff8e0] hover:bg-[#fff0c2] text-[#1f1f1f] text-label-sm font-bold py-1.5 px-3 rounded-xl flex items-center justify-center gap-1 transition-all cursor-pointer"
                                title="Duplicar modelo de ativo">
                                <span class="material-symbols-outlined text-[16px]">content_copy</span>
                                DUPLICAR
                            </button>
                        </div>
                    ` : `
                        <div class="flex items-center gap-2">
                            <button onclick="window.editAssetTemplateAction(event, '${a.id}')"
                                class="border border-[#e6d5a8] bg-[#fff8e0] hover:bg-[#fff0c2] text-[#1f1f1f] text-label-sm font-bold py-1.5 px-3 rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                                title="Editar modelo de ativo">
                                <span class="material-symbols-outlined text-[16px]">edit</span>
                                EDITAR
                            </button>
                            <button onclick="window.duplicateAssetTemplateAction(event, '${a.id}')"
                                class="border border-[#e6d5a8] bg-[#fff8e0] hover:bg-[#fff0c2] text-[#4a4a4a] hover:text-[#1f1f1f] text-label-sm font-bold py-1.5 px-3 rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                                title="Duplicar modelo de ativo">
                                <span class="material-symbols-outlined text-[16px]">content_copy</span>
                                DUPLICAR
                            </button>
                        </div>
                        <button onclick="window.deleteAssetTemplateAction(event, '${a.id}')"
                            class="border border-red-200 bg-red-50 hover:bg-red-100 text-red-600 text-label-sm font-bold p-2 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                            title="Excluir modelo de ativo">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    `}
                </div>
            </div>`;
        }).join('');
    }

    container.innerHTML = `
        <div class="w-full max-w-full overflow-x-hidden pb-28 md:pb-6">
            <!-- Navegação por Abas (Ativos vs Inspeção) e Botão '+' no canto direito -->
            <div class="flex border-b border-outline-variant items-center justify-between gap-1.5 sm:gap-2 w-full max-w-full">
                <!-- Abas com largura flexível para telas mobile: Ativos à esquerda, Inspeção à direita -->
                <div class="flex items-center gap-1 sm:gap-2 flex-1 min-w-0">
                    <button type="button" onclick="window.switchTemplatesTab('assets')"
                        class="flex-1 sm:flex-none px-2.5 sm:px-5 py-2.5 sm:py-3 font-bold uppercase text-[11px] sm:text-label-lg transition-all flex items-center justify-center gap-1 sm:gap-2 border-b-2 cursor-pointer ${!isInspections ? 'border-primary text-primary bg-primary/5 rounded-t-xl' : 'border-transparent text-on-surface-variant hover:text-on-surface'}">
                        <span class="material-symbols-outlined text-[18px] sm:text-[20px]">precision_manufacturing</span>
                        <span>Ativos</span>
                        <span class="bg-surface-container-high px-1.5 py-0.5 rounded-full text-[10px] sm:text-label-sm font-bold">${assetTemplates.length}</span>
                    </button>
                    <button type="button" onclick="window.switchTemplatesTab('inspections')"
                        class="flex-1 sm:flex-none px-2.5 sm:px-5 py-2.5 sm:py-3 font-bold uppercase text-[11px] sm:text-label-lg transition-all flex items-center justify-center gap-1 sm:gap-2 border-b-2 cursor-pointer ${isInspections ? 'border-primary text-primary bg-primary/5 rounded-t-xl' : 'border-transparent text-on-surface-variant hover:text-on-surface'}">
                        <span class="material-symbols-outlined text-[18px] sm:text-[20px]">assignment</span>
                        <span>Inspeção</span>
                        <span class="bg-surface-container-high px-1.5 py-0.5 rounded-full text-[10px] sm:text-label-sm font-bold">${templates.length}</span>
                    </button>
                </div>

                <!-- Botão '+' SEMPRE VISÍVEL no canto direito -->
                <button type="button" onclick="window.openAssetTemplateModal(event)"
                    class="shrink-0 bg-primary hover:brightness-105 text-on-primary font-bold w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shadow-md transition-all cursor-pointer"
                    title="Novo Modelo">
                    <span class="material-symbols-outlined text-[22px]">add</span>
                </button>
            </div>

            <!-- Grade Responsiva de Cards de Formulários -->
            <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4 mt-stack_md">
                ${isInspections ? inspectionsCardsHtml : assetCardsHtml}
            </div>
        </div>
    `;
}


/**
 * Abre o modal de criação ou edição de modelo
 */
export function openTemplateModal(templateId = null, isReadOnly = false) {
    const modal = document.getElementById('template-editor-modal');
    if (!modal) return;

    const isSystem = templateId === SYSTEM_INSPECTION_TEMPLATE_ID;
    const readOnlyMode = isReadOnly || isSystem;

    if (templateId) {
        const existing = getTemplateById(templateId);
        if (existing) {
            draftTemplate = JSON.parse(JSON.stringify(existing));
        } else {
            draftTemplate = createEmptyDraft();
        }
    } else {
        draftTemplate = createEmptyDraft();
    }

    draftTemplate._isReadOnly = readOnlyMode;
    renderModalEditorContent();

    // Controle de visibilidade do botão Salvar
    const saveBtn = modal.querySelector('button[onclick*="saveTemplateFromModal"]');
    if (saveBtn) {
        if (readOnlyMode) {
            saveBtn.classList.add('hidden');
        } else {
            saveBtn.classList.remove('hidden');
        }
    }

    modal.classList.remove('hidden');
}

/**
 * Fecha o modal de modelo
 */
export function closeTemplateModal() {
    const modal = document.getElementById('template-editor-modal');
    if (modal) {
        modal.classList.add('hidden');
    }
    draftTemplate = null;
}

function createEmptyDraft() {
    return {
        id: null,
        nome: '',
        items: []
    };
}

/**
 * Renderiza o formulário interativo do modal editor
 */
function renderModalEditorContent() {
    const titleEl = document.getElementById('template-modal-title');
    const bodyEl = document.getElementById('template-modal-body');
    const nameInput = document.getElementById('template-name-input');
    const isReadOnly = draftTemplate && !!draftTemplate._isReadOnly;

    if (titleEl) {
        if (isReadOnly) {
            titleEl.innerText = 'VISUALIZAR ESTRUTURA DE INSPEÇÃO (PADRÃO)';
        } else {
            titleEl.innerText = draftTemplate && draftTemplate.id ? 'EDITAR ESTRUTURA DE INSPEÇÃO' : 'ESTRUTURA DE INSPEÇÃO';
        }
    }

    if (nameInput) {
        nameInput.value = draftTemplate ? draftTemplate.nome || '' : '';
        nameInput.disabled = true;
        nameInput.readOnly = true;
        nameInput.title = 'O nome deste formulário é vinculado ao Modelo de Ativo e não pode ser editado diretamente.';
        nameInput.classList.add('opacity-80', 'cursor-not-allowed', 'bg-surface-container');
    }

    if (!bodyEl) return;

    const items = (draftTemplate && draftTemplate.items) || [];

    const readOnlyBannerHtml = isReadOnly ? `
        <div class="bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-3.5 flex items-center gap-3 select-none mb-4 shadow-xs">
            <span class="material-symbols-outlined text-amber-600 text-[24px]">lock</span>
            <div>
                <p class="text-body-md font-bold uppercase">Modelo Padrão do Sistema (Somente Leitura)</p>
                <p class="text-[12px] text-amber-800">Este checklist serve como modelo de referência técnica e não pode ser modificado. Para criar formulários personalizados, crie ou duplique um Modelo de Ativo na aba Ativos.</p>
            </div>
        </div>
    ` : '';

    const emptyChecklistNoticeHtml = (!isReadOnly && items.length === 0) ? `
        <div class="bg-surface-container-low border border-outline-variant rounded-2xl p-8 text-center text-on-surface-variant space-y-2.5 my-2">
            <span class="material-symbols-outlined text-[48px] text-primary/70 block">note_add</span>
            <p class="text-body-lg font-bold uppercase text-on-surface">Formulário de Inspeção Limpo</p>
            <p class="text-body-md text-on-surface-variant max-w-md mx-auto">
                Este formulário foi iniciado limpo. Você pode adicionar itens próprios do zero ou clicar no botão <strong>"+ ADICIONAR ITEM PADRÃO"</strong> para importar seções completas de Ponte Rolante.
            </p>
        </div>
    ` : '';

    const itemsHtml = items.map((item, itemIdx) => {
        const checklists = item.checklists || [];

        // Remove número duplicado inicial do nome se já existir para exibição limpa com o número amarelo
        let rawName = (item.nome || '').trim();
        let cleanName = rawName;
        const matchNum = rawName.match(/^(\d+(?:\.\d+)?(?:\s*–\s*|\s*-\s*|\s+))(.*)$/);
        if (matchNum && matchNum[2]) {
            cleanName = matchNum[2].trim();
        }

        const isCableCandidate = /^5\.6\b/.test(item.nome || '') || /^6\.6\b/.test(item.nome || '') || item.specialType === 'cableComposite' || item.specialType === 'cableTable';
        const isHookCandidate = /^5\.7\b/.test(item.nome || '') || /^6\.7\b/.test(item.nome || '') || item.specialType === 'hookComposite' || item.specialType === 'hookTable';

        let specialTableControlHtml = '';

        if (isCableCandidate) {
            const isChecked = item.specialType !== 'none';
            const thStyle = 'text-align: center; font-weight: 600; border: 1px solid #e5e7eb; color: #374151; background: #f9fafb; font-size: 11px; padding: 6px 4px;';
            const thGrauStyle = 'text-align: center; font-weight: 600; font-size: 9px; text-transform: none; line-height: 1.3; border: 1px solid #e5e7eb; color: #374151; background: #f9fafb; padding: 4px 2px;';
            const tdStyle = 'text-align: center; vertical-align: middle; border: 1px solid #e5e7eb; color: #6b7280; font-size: 11px; font-weight: 600; padding: 6px 4px;';

            specialTableControlHtml = `
            <div class="bg-surface-container-low/80 border border-outline-variant rounded-xl p-3.5 space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5">
                        <span class="material-symbols-outlined text-primary text-[22px]">table_chart</span>
                        <div>
                            <span class="text-body-md font-bold uppercase text-on-surface block">Tabela de Inspeção do Cabo de Aço (NBR ISO 4309)</span>
                            <span class="text-[11px] text-on-surface-variant">Arames rompidos, bitola, diâmetros, corrosão, deformação e danos</span>
                        </div>
                    </div>
                    <label class="inline-flex items-center gap-2 ${isReadOnly ? 'pointer-events-none opacity-80' : 'cursor-pointer'} group bg-surface px-3 py-1.5 rounded-lg border border-outline hover:border-primary transition-all">
                        <input type="checkbox"
                            id="toggle-special-${itemIdx}"
                            ${isChecked ? 'checked' : ''}
                            ${isReadOnly ? 'disabled' : ''}
                            onchange="window.toggleDraftItemSpecialType(${itemIdx}, 'cableComposite', this.checked)"
                            class="w-4.5 h-4.5 rounded border-outline text-primary focus:ring-primary cursor-pointer">
                        <span class="text-label-md font-bold uppercase ${isChecked ? 'text-primary' : 'text-on-surface-variant'}">
                            ${isChecked ? 'Tabela Incluída' : 'Tabela Desativada'}
                        </span>
                    </label>
                </div>

                ${isChecked ? `
                <div class="overflow-x-auto border border-outline-variant rounded-lg bg-surface">
                    <table class="w-full border-collapse" style="min-width: 650px;">
                        <thead>
                            <tr>
                                <th rowspan="2" style="${thStyle} width: 10%;">Arames Rompidos</th>
                                <th colspan="4" style="${thStyle} width: 45%;">Redução do Diâmetro</th>
                                <th style="${thStyle} width: 15%;">Corrosão</th>
                                <th style="${thStyle} width: 15%;">Deformação ou Danos</th>
                                <th style="${thStyle} width: 15%;">Grau Acumulativo de Deterioração</th>
                            </tr>
                            <tr>
                                <th style="${thStyle} width: 10%;">Bitola do Cabo</th>
                                <th style="${thStyle} width: 12%;">Diâmetro Catálogo</th>
                                <th style="${thStyle} width: 11%;">Diâmetro Medido</th>
                                <th style="${thStyle} width: 12%;">Redução % (Máx 7%)</th>
                                <th style="${thGrauStyle}">Grau 1 a 5</th>
                                <th style="${thGrauStyle}">Grau 1 a 5</th>
                                <th style="${thGrauStyle}">Grau 1 a 5</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="${tdStyle}">NÃO</td>
                                <td style="${tdStyle}">3/4"</td>
                                <td style="${tdStyle}">19mm</td>
                                <td style="${tdStyle}">19mm</td>
                                <td style="${tdStyle}">NÃO</td>
                                <td style="${tdStyle}">1</td>
                                <td style="${tdStyle}">1</td>
                                <td style="${tdStyle}">1</td>
                            </tr>
                        </tbody>
                    </table>
                </div>` : ''}
            </div>`;
        } else if (isHookCandidate) {
            const isChecked = item.specialType !== 'none';
            const thStyle = 'text-align: center; font-weight: 600; border: 1px solid #e5e7eb; color: #374151; background: #f9fafb; font-size: 11px; padding: 6px 4px; text-transform: uppercase;';
            const tdStyle = 'text-align: center; vertical-align: middle; border: 1px solid #e5e7eb; color: #6b7280; font-size: 11px; font-weight: 600; padding: 6px 4px;';

            specialTableControlHtml = `
            <div class="bg-surface-container-low/80 border border-outline-variant rounded-xl p-3.5 space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-3">
                    <div class="flex items-center gap-2.5">
                        <span class="material-symbols-outlined text-primary text-[22px]">table_chart</span>
                        <div>
                            <span class="text-body-md font-bold uppercase text-on-surface block">Tabela de Inspeção do Moitão (DIN 15400)</span>
                            <span class="text-[11px] text-on-surface-variant">Abertura do gancho, líquido penetrante, proteção, norma DIN, capacidade</span>
                        </div>
                    </div>
                    <label class="inline-flex items-center gap-2 ${isReadOnly ? 'pointer-events-none opacity-80' : 'cursor-pointer'} group bg-surface px-3 py-1.5 rounded-lg border border-outline hover:border-primary transition-all">
                        <input type="checkbox"
                            id="toggle-special-${itemIdx}"
                            ${isChecked ? 'checked' : ''}
                            ${isReadOnly ? 'disabled' : ''}
                            onchange="window.toggleDraftItemSpecialType(${itemIdx}, 'hookComposite', this.checked)"
                            class="w-4.5 h-4.5 rounded border-outline text-primary focus:ring-primary cursor-pointer">
                        <span class="text-label-md font-bold uppercase ${isChecked ? 'text-primary' : 'text-on-surface-variant'}">
                            ${isChecked ? 'Tabela Incluída' : 'Tabela Desativada'}
                        </span>
                    </label>
                </div>

                ${isChecked ? `
                <div class="overflow-x-auto border border-outline-variant rounded-lg bg-surface">
                    <table class="w-full border-collapse" style="min-width: 550px;">
                        <thead>
                            <tr>
                                <th style="${thStyle}">Abertura do Gancho</th>
                                <th style="${thStyle}">Líquido Penetrante</th>
                                <th style="${thStyle}">Proteção de Partes Móveis</th>
                                <th style="${thStyle}">Gancho conforme DIN 15400</th>
                                <th style="${thStyle}">Indicação de Capacidade</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td style="${tdStyle}">CONFORME</td>
                                <td style="${tdStyle}">SEM TRINCAS</td>
                                <td style="${tdStyle}">OK</td>
                                <td style="${tdStyle}">SIM</td>
                                <td style="${tdStyle}">LEGÍVEL</td>
                            </tr>
                        </tbody>
                    </table>
                </div>` : ''}
            </div>`;
        }

        const checklistsHtml = checklists.map((chk, chkIdx) => `
            <div class="flex items-start justify-between gap-3 py-2 border-b border-outline-variant/30 last:border-b-0 hover:bg-surface-container-low/40 px-2 rounded-lg transition-colors group">
                <div class="flex items-start gap-3 flex-1 min-w-[200px]">
                    <div class="w-4.5 h-4.5 border-2 border-outline-variant rounded flex items-center justify-center text-on-surface-variant/40 shrink-0 select-none mt-1">
                    </div>
                    <textarea
                        id="chk-desc-${itemIdx}-${chkIdx}"
                        rows="1"
                        ${isReadOnly ? 'disabled readonly' : ''}
                        onchange="window.updateDraftChecklist(${itemIdx}, ${chkIdx}, this.value)"
                        oninput="window.autoResizeTextarea(this); window.updateDraftChecklist(${itemIdx}, ${chkIdx}, this.value)"
                        onfocus="window.autoResizeTextarea(this)"
                        placeholder="Descrição da verificação (ex: ALINHAMENTO E NIVELAMENTO)"
                        style="min-height: 34px;"
                        class="w-full bg-transparent text-body-md font-bold uppercase text-on-surface hover:bg-surface-container-low focus:bg-surface-container-low focus:ring-1 focus:ring-primary border border-transparent hover:border-outline rounded-md py-1 px-2 outline-none resize-none overflow-hidden transition-colors leading-snug ${isReadOnly ? 'cursor-default select-text' : ''}">${escapeHTML(chk.descricao || '')}</textarea>
                </div>

                <div class="flex items-center gap-4 shrink-0 mt-1">
                    <!-- Simulador de Rádio OK / NOK (Visual Idêntico ao Formulário) -->
                    <div class="flex items-center gap-3 select-none pointer-events-none opacity-80">
                        <div class="flex items-center gap-1.5 text-label-md font-bold text-on-surface">
                            <span class="w-4 h-4 rounded-full border-2 border-outline flex items-center justify-center"></span>
                            <span>OK</span>
                        </div>
                        <div class="flex items-center gap-1.5 text-label-md font-bold text-on-surface">
                            <span class="w-4 h-4 rounded-full border-2 border-outline flex items-center justify-center"></span>
                            <span>NOK</span>
                        </div>
                    </div>

                    ${!isReadOnly ? `
                    <!-- Botões de Ação da Linha de Verificação -->
                    <div class="flex items-center gap-0.5 border-l border-outline-variant/40 pl-2">
                        <button type="button" onclick="window.moveDraftChecklist(${itemIdx}, ${chkIdx}, -1)" ${chkIdx === 0 ? 'disabled' : ''}
                            class="p-1 text-on-surface-variant hover:text-primary disabled:opacity-20 transition-colors cursor-pointer" title="Mover para cima">
                            <span class="material-symbols-outlined text-[18px]">arrow_upward</span>
                        </button>
                        <button type="button" onclick="window.moveDraftChecklist(${itemIdx}, ${chkIdx}, 1)" ${chkIdx === checklists.length - 1 ? 'disabled' : ''}
                            class="p-1 text-on-surface-variant hover:text-primary disabled:opacity-20 transition-colors cursor-pointer" title="Mover para baixo">
                            <span class="material-symbols-outlined text-[18px]">arrow_downward</span>
                        </button>
                        <button type="button" onclick="window.removeDraftChecklist(${itemIdx}, ${chkIdx})"
                            class="p-1 text-error hover:bg-error/10 rounded transition-colors cursor-pointer" title="Excluir verificação">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    </div>` : ''}
                </div>
            </div>
        `).join('');

        return `
        <div class="bg-surface border border-outline-variant rounded-2xl p-card_padding space-y-stack_md shadow-xs">
            <!-- Cabeçalho da Seção com Número Amarelo e Ações -->
            <div class="border-b border-outline-variant/60 pb-3 flex flex-wrap items-start justify-between gap-3">
                <div class="flex items-start gap-3 flex-1 min-w-[280px]">
                    <div class="w-5 h-5 border-2 border-outline-variant rounded flex items-center justify-center text-on-surface-variant/40 shrink-0 select-none mt-1">
                    </div>
                    <span class="text-primary font-bold text-headline-md shrink-0 leading-none mt-1">${itemIdx + 1}</span>
                    <textarea
                        id="item-nome-${itemIdx}"
                        rows="1"
                        ${isReadOnly ? 'disabled readonly' : ''}
                        onchange="window.updateDraftItemName(${itemIdx}, this.value)"
                        oninput="window.autoResizeTextarea(this); window.updateDraftItemName(${itemIdx}, this.value)"
                        onfocus="window.autoResizeTextarea(this)"
                        placeholder="NOME DO ITEM (EX: SISTEMA DE ALIMENTAÇÃO DA PONTE ROLANTE)"
                        style="min-height: 38px;"
                        class="w-full bg-transparent font-bold text-headline-md uppercase text-on-surface hover:bg-surface-container-low focus:bg-surface-container-low focus:ring-2 focus:ring-primary focus:border-primary border border-transparent hover:border-outline rounded-lg py-1 px-2.5 outline-none resize-none overflow-hidden transition-colors leading-snug ${isReadOnly ? 'cursor-default select-text' : ''}">${escapeHTML(cleanName || rawName)}</textarea>
                </div>

                ${!isReadOnly ? `
                <div class="flex items-center gap-1 shrink-0">
                    <button type="button" onclick="window.addDraftObservationBlock(${itemIdx})"
                        class="w-8 h-8 flex items-center justify-center text-on-surface hover:text-primary hover:bg-primary/10 rounded-lg transition-colors cursor-pointer" title="Adicionar Bloco de Observação e Foto">
                        <span class="material-symbols-outlined text-[24px]">add</span>
                    </button>
                    <button type="button" onclick="window.moveDraftItem(${itemIdx}, -1)" ${itemIdx === 0 ? 'disabled' : ''}
                        class="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg disabled:opacity-30 transition-colors cursor-pointer" title="Subir item">
                        <span class="material-symbols-outlined text-[20px]">arrow_upward</span>
                    </button>
                    <button type="button" onclick="window.moveDraftItem(${itemIdx}, 1)" ${itemIdx === items.length - 1 ? 'disabled' : ''}
                        class="w-8 h-8 flex items-center justify-center text-on-surface-variant hover:text-primary hover:bg-surface-container rounded-lg disabled:opacity-30 transition-colors cursor-pointer" title="Descer item">
                        <span class="material-symbols-outlined text-[20px]">arrow_downward</span>
                    </button>
                    <button type="button" onclick="window.removeDraftItem(${itemIdx})"
                        class="w-8 h-8 flex items-center justify-center text-error hover:bg-error/10 rounded-lg transition-colors cursor-pointer" title="Excluir item">
                        <span class="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                </div>` : ''}
            </div>

            <!-- Lista de Verificações no Padrão do Formulário com Rolagem Horizontal Segura em Mobile -->
            <div class="overflow-x-auto -mx-1 px-1 custom-scrollbar pb-1">
                <div class="min-w-[580px] space-y-1">
                    ${checklistsHtml}
                </div>
            </div>

            ${!isReadOnly ? `
            <!-- Botão Adicionar Verificação no Formato Padrão -->
            <div>
                <button type="button" onclick="window.addDraftChecklist(${itemIdx})"
                    class="text-label-md font-bold text-secondary hover:text-secondary-container hover:underline uppercase flex items-center gap-1 py-1 cursor-pointer transition-colors">
                    <span class="material-symbols-outlined text-[18px]">add_circle</span>
                    + ADICIONAR VERIFICAÇÃO
                </button>
            </div>` : ''}

            <!-- Tabela Técnica Opcional -->
            ${specialTableControlHtml}

            <!-- Rodapé da Seção com Observação Padrão e Fotos (Sem lixeira) -->
            <div class="space-y-2 pt-2 border-t border-outline-variant/30">
                ${!isReadOnly ? `
                <div class="flex justify-end gap-2">
                    <button type="button" class="w-9 h-9 border border-outline bg-surface-container-low text-on-surface-variant hover:text-green-600 rounded-xl flex items-center justify-center transition-all cursor-pointer" title="Anexar Fotos">
                        <span class="material-symbols-outlined text-[20px]">add_a_photo</span>
                    </button>
                </div>` : ''}
                <div class="w-full bg-surface-container-low border border-outline rounded-xl py-2 px-4 text-body-md text-on-surface-variant select-none">
                    OBSERVAÇÃO
                </div>
            </div>

            <!-- Blocos de Observações Adicionais (Gerados pelo botão + com lixeira) -->
            ${(() => {
                const extraCount = item.extraObservations || 0;
                let blocksHtml = '';
                for (let oIdx = 0; oIdx < extraCount; oIdx++) {
                    blocksHtml += `
                    <div class="space-y-2 pt-2 border-t border-outline-variant/30">
                        ${!isReadOnly ? `
                        <div class="flex justify-end gap-2">
                            <button type="button" onclick="window.removeDraftObservationBlock(${itemIdx}, ${oIdx})" class="w-9 h-9 border border-outline bg-surface-container-low text-error hover:bg-error/10 rounded-xl flex items-center justify-center transition-all cursor-pointer" title="Excluir Observação Adicional">
                                <span class="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                            <button type="button" class="w-9 h-9 border border-outline bg-surface-container-low text-on-surface-variant hover:text-green-600 rounded-xl flex items-center justify-center transition-all cursor-pointer" title="Anexar Fotos">
                                <span class="material-symbols-outlined text-[20px]">add_a_photo</span>
                            </button>
                        </div>` : ''}
                        <div class="w-full bg-surface-container-low border border-outline rounded-xl py-2 px-4 text-body-md text-on-surface-variant select-none">
                            OBSERVAÇÃO ADICIONAL ${oIdx + 1}
                        </div>
                    </div>`;
                }
                return blocksHtml;
            })()}
        </div>`;
    }).join('');

    bodyEl.innerHTML = `
        <div class="space-y-stack_lg">
            ${readOnlyBannerHtml}
            ${emptyChecklistNoticeHtml}
            ${itemsHtml}

            ${!isReadOnly ? `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                <button type="button" onclick="window.addDraftItem()"
                    class="w-full bg-surface border-2 border-dashed border-primary/60 hover:border-primary text-on-surface hover:bg-primary/5 font-bold uppercase text-body-md py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer">
                    <span class="material-symbols-outlined text-primary">add_box</span>
                    + ADICIONAR ITEM
                </button>
                <button type="button" onclick="window.openDefaultItemsModal(event)"
                    class="w-full bg-surface border-2 border-dashed border-secondary/60 hover:border-secondary text-on-surface hover:bg-secondary/5 font-bold uppercase text-body-md py-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer">
                    <span class="material-symbols-outlined text-secondary">library_add</span>
                    + ADICIONAR ITEM PADRÃO
                </button>
            </div>` : ''}
        </div>
    `;

    // Auto-ajustar altura dinâmica de todos os textareas para que nenhum texto fique cortado
    const adjustAllEditorTextareas = () => {
        if (!bodyEl) return;
        bodyEl.querySelectorAll('textarea').forEach(ta => {
            autoResizeTextarea(ta);
        });
    };
    setTimeout(adjustAllEditorTextareas, 0);
    setTimeout(adjustAllEditorTextareas, 100);
}

// Global Handlers para Manipulação do Rascunho
let isTemplateActionProcessing = false;

async function executeWithAntiDoubleClick(evt, fn) {
    if (isTemplateActionProcessing) return;
    isTemplateActionProcessing = true;

    let targetBtn = null;
    if (evt) {
        if (evt.currentTarget && typeof evt.currentTarget.setAttribute === 'function') {
            targetBtn = evt.currentTarget;
        } else if (evt.target && typeof evt.target.closest === 'function') {
            targetBtn = evt.target.closest('button');
        }
    }

    if (targetBtn) {
        targetBtn.disabled = true;
        targetBtn.classList.add('opacity-50', 'pointer-events-none');
    }

    try {
        await fn();
    } finally {
        setTimeout(() => {
            isTemplateActionProcessing = false;
            if (targetBtn) {
                targetBtn.disabled = false;
                targetBtn.classList.remove('opacity-50', 'pointer-events-none');
            }
        }, 400);
    }
}

if (typeof window !== 'undefined') {
    window.updateDraftTemplateName = function(val) {
        if (draftTemplate) draftTemplate.nome = val;
    };

    window.updateDraftItemName = function(itemIdx, val) {
        if (draftTemplate && draftTemplate.items[itemIdx]) {
            draftTemplate.items[itemIdx].nome = val;
        }
    };

    window.toggleDraftItemSpecialType = function(itemIdx, type, isChecked) {
        if (!draftTemplate || !draftTemplate.items[itemIdx]) return;
        draftTemplate.items[itemIdx].specialType = isChecked ? type : 'none';
        renderModalEditorContent();
    };

    window.updateDraftChecklist = function(itemIdx, chkIdx, val) {
        if (draftTemplate && draftTemplate.items[itemIdx] && draftTemplate.items[itemIdx].checklists[chkIdx]) {
            draftTemplate.items[itemIdx].checklists[chkIdx].descricao = val;
        }
    };

    window.addDraftItem = function() {
        if (!draftTemplate) return;
        draftTemplate.items.push({
            id: null,
            nome: '',
            checklists: [{ id: null, descricao: '' }]
        });
        renderModalEditorContent();
    };

    window.removeDraftItem = function(itemIdx) {
        if (!draftTemplate) return;
        if (draftTemplate.items.length <= 1) {
            return window.showAlert('O modelo deve possuir pelo menos 1 item.', 'warning');
        }
        draftTemplate.items.splice(itemIdx, 1);
        renderModalEditorContent();
    };

    window.moveDraftItem = function(itemIdx, direction) {
        if (!draftTemplate) return;
        const targetIdx = itemIdx + direction;
        if (targetIdx < 0 || targetIdx >= draftTemplate.items.length) return;
        
        const temp = draftTemplate.items[itemIdx];
        draftTemplate.items[itemIdx] = draftTemplate.items[targetIdx];
        draftTemplate.items[targetIdx] = temp;
        renderModalEditorContent();
    };

    window.addDraftChecklist = function(itemIdx) {
        if (!draftTemplate || !draftTemplate.items[itemIdx]) return;
        if (!Array.isArray(draftTemplate.items[itemIdx].checklists)) {
            draftTemplate.items[itemIdx].checklists = [];
        }
        draftTemplate.items[itemIdx].checklists.push({ id: null, descricao: '' });
        renderModalEditorContent();
    };

    window.removeDraftChecklist = function(itemIdx, chkIdx) {
        if (!draftTemplate || !draftTemplate.items[itemIdx]) return;
        draftTemplate.items[itemIdx].checklists.splice(chkIdx, 1);
        renderModalEditorContent();
    };

    window.addDraftObservationBlock = function(itemIdx) {
        if (!draftTemplate || !draftTemplate.items[itemIdx]) return;
        draftTemplate.items[itemIdx].extraObservations = (draftTemplate.items[itemIdx].extraObservations || 0) + 1;
        renderModalEditorContent();
    };

    window.removeDraftObservationBlock = function(itemIdx, obsIdx) {
        if (!draftTemplate || !draftTemplate.items[itemIdx]) return;
        const currentCount = draftTemplate.items[itemIdx].extraObservations || 0;
        if (currentCount > 0) {
            draftTemplate.items[itemIdx].extraObservations = currentCount - 1;
            renderModalEditorContent();
        }
    };

    window.moveDraftChecklist = function(itemIdx, chkIdx, direction) {
        if (!draftTemplate || !draftTemplate.items[itemIdx]) return;
        const checklists = draftTemplate.items[itemIdx].checklists;
        const targetIdx = chkIdx + direction;
        if (targetIdx < 0 || targetIdx >= checklists.length) return;

        const temp = checklists[chkIdx];
        checklists[chkIdx] = checklists[targetIdx];
        checklists[targetIdx] = temp;
        renderModalEditorContent();
    };

    window.saveTemplateFromModal = function(evt) {
        executeWithAntiDoubleClick(evt, async () => {
            if (!draftTemplate) return;

            const nameInput = document.getElementById('template-name-input');
            if (nameInput) draftTemplate.nome = nameInput.value;

            try {
                await saveTemplate(draftTemplate);
                closeTemplateModal();
                window.showAlert('Modelo salvo com sucesso!', 'success');
                renderTemplatesView();
            } catch (e) {
                window.showAlert(e.message || 'Erro ao salvar modelo.', 'error');
            }
        });
    };

    window.openTemplateModal = function(evt, id = null) {
        executeWithAntiDoubleClick(evt, async () => {
            openTemplateModal(id);
        });
    };

    window.closeTemplateModal = closeTemplateModal;

    window.renderTemplatesView = renderTemplatesView;

    window.editTemplateAction = function(evt, id) {
        executeWithAntiDoubleClick(evt, async () => {
            openTemplateModal(id, false);
        });
    };

    window.viewTemplateAction = function(evt, id) {
        executeWithAntiDoubleClick(evt, async () => {
            openTemplateModal(id, true);
        });
    };

    window.duplicateTemplateAction = function(evt, id) {
        executeWithAntiDoubleClick(evt, async () => {
            try {
                await duplicateTemplate(id);
                window.showAlert('Modelo duplicado com sucesso.', 'success');
                renderTemplatesView();
            } catch (e) {
                window.showAlert(e.message || 'Erro ao duplicar modelo.', 'error');
            }
        });
    };

    window.deleteTemplateAction = function(evt, id) {
        executeWithAntiDoubleClick(evt, async () => {
            const template = getTemplateById(id);
            if (!template) return;

            const confirmMsg = `Excluir o modelo "${template.nome}"?\n\nEssa ação excluirá o modelo, mas não excluirá inspeções já realizadas utilizando este modelo.`;
            if (confirm(confirmMsg)) {
                try {
                    await deleteTemplate(id);
                    window.showAlert('Modelo excluído com sucesso.', 'success');
                    renderTemplatesView();
                } catch (err) {
                    window.showAlert('Erro ao excluir modelo.', 'error');
                }
            }
        });
    };

    window.useTemplateAction = function(evt, id) {
        executeWithAntiDoubleClick(evt, async () => {
            const template = getTemplateById(id);
            if (!template) return;

            if (typeof window.openInspecaoModalWithTemplate === 'function') {
                window.openInspecaoModalWithTemplate(template);
            } else if (typeof window.openInspecaoModal === 'function') {
                window.selectedInspectionTemplate = template;
                window.openInspecaoModal();
            }
        });
    };

    window.switchTemplatesTab = switchTemplatesTab;

    // --- MODELOS DE ATIVOS (FICHA TÉCNICA) ---
    window.openAssetTemplateModal = function(evt, id = null) {
        executeWithAntiDoubleClick(evt, async () => {
            openAssetTemplateModal(id);
        });
    };

    window.closeAssetTemplateModal = closeAssetTemplateModal;
    window.addAssetTemplateFieldRow = addAssetTemplateFieldRow;
    window.removeAssetTemplateFieldRow = removeAssetTemplateFieldRow;
    window.moveAssetTemplateFieldUp = moveAssetTemplateFieldUp;
    window.moveAssetTemplateFieldDown = moveAssetTemplateFieldDown;
    window.openAssetDefaultFieldsPickerModal = openAssetDefaultFieldsPickerModal;
    window.closeAssetDefaultFieldsPickerModal = closeAssetDefaultFieldsPickerModal;
    window.toggleAllAssetDefaultFields = toggleAllAssetDefaultFields;
    window.updateAssetDefaultFieldsCount = updateAssetDefaultFieldsCount;
    window.importSelectedAssetDefaultFields = importSelectedAssetDefaultFields;
    window.useAssetTemplateAction = useAssetTemplateAction;

    window.saveAssetTemplateFromModal = function(evt) {
        executeWithAntiDoubleClick(evt, async () => {
            await saveAssetTemplateFromModal();
        });
    };

    window.editAssetTemplateAction = function(evt, id) {
        executeWithAntiDoubleClick(evt, async () => {
            openAssetTemplateModal(id, false);
        });
    };

    window.viewAssetTemplateAction = function(evt, id) {
        executeWithAntiDoubleClick(evt, async () => {
            openAssetTemplateModal(id, true);
        });
    };

    window.duplicateAssetTemplateAction = function(evt, id) {
        executeWithAntiDoubleClick(evt, async () => {
            try {
                await duplicateAssetTemplate(id);
                window.showAlert('Modelo de ativo duplicado com sucesso.', 'success');
                renderTemplatesView();
            } catch (e) {
                window.showAlert(e.message || 'Erro ao duplicar modelo de ativo.', 'error');
            }
        });
    };

    window.deleteAssetTemplateAction = function(evt, id) {
        executeWithAntiDoubleClick(evt, async () => {
            const template = getAssetTemplateById(id);
            if (!template) return;

            if (template.isSystemDefault || String(id) === SYSTEM_ASSET_TEMPLATE_ID) {
                return window.showAlert('O Formulário modelo Ativo padrão não pode ser excluído.', 'warning');
            }

            const confirmMsg = `Excluir o modelo de ativo "${template.nome}"?\n\nATENÇÃO: O formulário de inspeção vinculado a ele também será excluído em cascata.\n(Inspeções e ativos já finalizados não serão alterados).`;
            if (confirm(confirmMsg)) {
                try {
                    await deleteAssetTemplate(id);
                    window.showAlert('Modelo de ativo e formulário de inspeção vinculado excluídos com sucesso.', 'success');
                    renderTemplatesView();
                } catch (err) {
                    window.showAlert('Erro ao excluir modelo de ativo.', 'error');
                }
            }
        });
    };

    window.populateAssetTemplateDropdown = populateAssetTemplateDropdown;

    window.openDefaultItemsModal = openDefaultItemsModal;
    window.closeDefaultItemsModal = closeDefaultItemsModal;
    window.filterDefaultItemsTree = filterDefaultItemsTree;
    window.toggleAllDefaultItems = toggleAllDefaultItems;
    window.toggleDefaultMainSectionCheckboxes = toggleDefaultMainSectionCheckboxes;
    window.toggleDefaultSubSectionCheckboxes = toggleDefaultSubSectionCheckboxes;
    window.onDefaultFieldChange = onDefaultFieldChange;
    window.updateDefaultItemsCount = updateDefaultItemsCount;
    window.importSelectedDefaultItems = importSelectedDefaultItems;
}

// ============================================================================
// CATÁLOGO DE ITENS PADRÃO PARA ATIVOS
// ============================================================================

export const DEFAULT_ASSET_FIELDS_CATALOG = [
    { label: 'ALIMENTAÇÃO DO EQUIPAMENTO', type: 'text' },
    { label: 'DIÂMETRO DO CABO DE AÇO PRINCIPAL', type: 'text' },
    { label: 'CAPACIDADE DE PESO AUXILIAR', type: 'number' },
    { label: 'DIÂMETRO DO CABO DE AÇO AUXILIAR', type: 'text' },
    { label: 'ALTURA DE ELEVAÇÃO', type: 'number' },
    { label: 'TENSÃO DE ALIMENTAÇÃO', type: 'text' },
    { label: 'TENSÃO DE COMANDO', type: 'text' },
    { label: 'MOTOR ELEVAÇÃO PRINCIPAL (VEL. ALTA)', type: 'text' },
    { label: 'MOTOR ELEVAÇÃO PRINCIPAL (VEL. BAIXA)', type: 'text' },
    { label: 'MOTOR ELEVAÇÃO AUXILIAR (VEL. ALTA)', type: 'text' },
    { label: 'MOTOR ELEVAÇÃO AUXILIAR (VEL. BAIXA)', type: 'text' },
    { label: 'MOTOR DIREÇÃO CARRO', type: 'text' },
    { label: 'MOTOR TRANSLAÇÃO PONTE', type: 'text' }
];

// ============================================================================
// MODAL DE MODELO DE ATIVO
// ============================================================================

export function openAssetTemplateModal(templateId = null, isReadOnly = false) {
    const modal = document.getElementById('asset-template-editor-modal');
    if (!modal) return;

    const isSystem = templateId === SYSTEM_ASSET_TEMPLATE_ID;
    const readOnlyMode = isReadOnly || isSystem;

    if (templateId) {
        const existing = getAssetTemplateById(templateId);
        if (existing) {
            draftAssetTemplate = JSON.parse(JSON.stringify(existing));
        } else {
            draftAssetTemplate = createEmptyAssetTemplateDraft();
        }
    } else {
        draftAssetTemplate = createEmptyAssetTemplateDraft();
    }

    draftAssetTemplate._isReadOnly = readOnlyMode;
    renderAssetModalContent();

    // Controle de visibilidade do botão Salvar e de inclusão de novos campos
    const saveBtn = modal.querySelector('button[onclick*="saveAssetTemplateFromModal"]');
    if (saveBtn) {
        if (readOnlyMode) {
            saveBtn.classList.add('hidden');
        } else {
            saveBtn.classList.remove('hidden');
        }
    }

    const addFieldBtns = modal.querySelectorAll('button[onclick*="addAssetTemplateFieldRow"], button[onclick*="openAssetDefaultFieldsPickerModal"]');
    addFieldBtns.forEach(btn => {
        if (readOnlyMode) {
            btn.classList.add('hidden');
        } else {
            btn.classList.remove('hidden');
        }
    });

    modal.classList.remove('hidden');
}

export function closeAssetTemplateModal() {
    const modal = document.getElementById('asset-template-editor-modal');
    if (modal) modal.classList.add('hidden');
    draftAssetTemplate = null;
}

export function useAssetTemplateAction(evt, id) {
    executeWithAntiDoubleClick(evt, async () => {
        const template = getAssetTemplateById(id);
        if (!template) return;

        // Abre a central de cadastro para NOVO ATIVO
        if (typeof window.openUnifiedRegistrationModal === 'function') {
            window.openUnifiedRegistrationModal('ativo');
        }

        // Aguarda renderização do modal para preencher o seletor de template
        setTimeout(() => {
            const selectEl = document.getElementById('reg-ativo-template-select');
            if (selectEl) {
                selectEl.value = id;
                if (typeof window.handleAssetTemplateChange === 'function') {
                    window.handleAssetTemplateChange();
                }
            }
            window.showAlert(`Modelo "${template.nome}" aplicado no formulário de ativo!`, 'success');
        }, 150);
    });
}

function createEmptyAssetTemplateDraft() {
    return {
        id: null,
        nome: '',
        tipoEquipamento: 'PONTE ROLANTE VIGA DUPLA',
        customFields: []
    };
}

function renderAssetModalContent() {
    const titleEl = document.getElementById('asset-template-modal-title');
    const nameInput = document.getElementById('asset-template-name-input');
    const tipoInput = document.getElementById('asset-template-tipo-default');
    const container = document.getElementById('asset-template-fields-container');
    const isReadOnly = draftAssetTemplate && !!draftAssetTemplate._isReadOnly;

    if (titleEl) {
        if (isReadOnly) {
            titleEl.innerText = 'VISUALIZAR MODELO DE ATIVO (PADRÃO)';
        } else {
            titleEl.innerText = draftAssetTemplate && draftAssetTemplate.id ? 'EDITAR MODELO DE ATIVO' : 'CRIAR MODELO DE ATIVO';
        }
    }
    if (nameInput) {
        nameInput.value = (draftAssetTemplate && draftAssetTemplate.nome) || '';
        nameInput.disabled = isReadOnly;
        nameInput.readOnly = isReadOnly;
        if (isReadOnly) {
            nameInput.classList.add('opacity-80', 'cursor-not-allowed', 'bg-surface-container');
        } else {
            nameInput.classList.remove('opacity-80', 'cursor-not-allowed', 'bg-surface-container');
        }
    }
    if (tipoInput) {
        tipoInput.value = (draftAssetTemplate && draftAssetTemplate.tipoEquipamento) || '';
        tipoInput.disabled = isReadOnly;
        if (isReadOnly) {
            tipoInput.classList.add('opacity-80', 'cursor-not-allowed', 'bg-surface-container');
        } else {
            tipoInput.classList.remove('opacity-80', 'cursor-not-allowed', 'bg-surface-container');
        }
    }

    if (!container) return;
    container.innerHTML = '';

    if (isReadOnly) {
        const banner = document.createElement('div');
        banner.className = 'bg-amber-50 border border-amber-300 text-amber-900 rounded-xl p-3.5 flex items-center gap-3 select-none mb-3 shadow-xs';
        banner.innerHTML = `
            <span class="material-symbols-outlined text-amber-600 text-[24px]">lock</span>
            <div>
                <p class="text-body-md font-bold uppercase">Modelo Padrão do Sistema (Somente Leitura)</p>
                <p class="text-[12px] text-amber-800">Esta ficha técnica padrão de Ponte Rolante Viga Dupla serve como modelo de exemplo. Para criar sua própria ficha técnica, clique em <strong>"DUPLICAR"</strong> no card deste modelo.</p>
            </div>
        `;
        container.appendChild(banner);
    }

    const fields = (draftAssetTemplate && draftAssetTemplate.customFields) || [];
    fields.forEach((f, idx) => {
        container.appendChild(createAssetFieldRowElement(f, idx));
    });

    // Ajusta a altura dinâmica de todos os textareas de rótulo para que todo o texto fique visível
    const adjustAssetLabels = () => {
        container.querySelectorAll('textarea.field-label').forEach(ta => {
            autoResizeTextarea(ta);
        });
    };
    setTimeout(adjustAssetLabels, 0);
    setTimeout(adjustAssetLabels, 100);
}

function createAssetFieldRowElement(field, idx) {
    const isReadOnly = draftAssetTemplate && !!draftAssetTemplate._isReadOnly;
    const row = document.createElement('div');
    row.className = 'asset-field-row bg-surface-container/60 p-3 rounded-xl border border-outline-variant flex items-start gap-3 min-w-[590px] w-full';
    row.innerHTML = `
        <div class="flex-1 min-w-[260px]">
            <label class="text-label-sm text-on-surface-variant uppercase font-bold">RÓTULO DO CAMPO *</label>
            <textarea ${isReadOnly ? 'disabled readonly' : ''} rows="1" class="field-label w-full bg-surface-container-low border border-outline rounded-xl py-2 px-3 text-body-md font-bold uppercase text-on-surface focus:ring-2 focus:ring-primary outline-none transition-colors resize-none overflow-hidden leading-snug ${isReadOnly ? 'cursor-default select-text' : ''}" style="min-height: 42px;" placeholder="EX: TIPO DE FREIO" oninput="window.autoResizeTextarea(this)" onfocus="window.autoResizeTextarea(this)">${escapeHTML(field.label || '')}</textarea>
        </div>
        <div class="w-[130px] shrink-0">
            <label class="text-label-sm text-on-surface-variant uppercase font-bold">TIPO</label>
            <select ${isReadOnly ? 'disabled' : ''} class="field-type w-full bg-surface-container-low border border-outline rounded-xl py-2 px-3 text-body-md font-bold uppercase text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all ${isReadOnly ? 'cursor-default select-text' : ''}">
                <option value="text" ${field.type === 'text' ? 'selected' : ''}>TEXTO</option>
                <option value="number" ${field.type === 'number' ? 'selected' : ''}>NÚMERO</option>
                <option value="date" ${field.type === 'date' ? 'selected' : ''}>DATA</option>
            </select>
        </div>
        ${!isReadOnly ? `
        <div class="w-[110px] shrink-0 flex items-center justify-end gap-1.5 pt-5 pr-1">
            <button type="button" onclick="window.moveAssetTemplateFieldUp(this)" class="p-1.5 rounded-lg border border-outline hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all cursor-pointer" title="Mover para cima">
                <span class="material-symbols-outlined text-[18px]">arrow_upward</span>
            </button>
            <button type="button" onclick="window.moveAssetTemplateFieldDown(this)" class="p-1.5 rounded-lg border border-outline hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all cursor-pointer" title="Mover para baixo">
                <span class="material-symbols-outlined text-[18px]">arrow_downward</span>
            </button>
            <button type="button" onclick="window.removeAssetTemplateFieldRow(this)" class="p-1.5 rounded-lg text-error hover:bg-error/10 hover:border-error transition-all cursor-pointer" title="Remover Campo">
                <span class="material-symbols-outlined text-[20px]">delete</span>
            </button>
        </div>` : ''}
    `;
    return row;
}

export function moveAssetTemplateFieldUp(btn) {
    const row = btn.closest('.asset-field-row');
    if (!row) return;
    const prev = row.previousElementSibling;
    if (prev && prev.classList.contains('asset-field-row')) {
        row.parentNode.insertBefore(row, prev);
    }
}

export function moveAssetTemplateFieldDown(btn) {
    const row = btn.closest('.asset-field-row');
    if (!row) return;
    const next = row.nextElementSibling;
    if (next && next.classList.contains('asset-field-row')) {
        row.parentNode.insertBefore(next, row);
    }
}

export function addAssetTemplateFieldRow(fieldData = null) {
    const container = document.getElementById('asset-template-fields-container');
    if (!container) return;
    const defaultField = fieldData || { label: '', type: 'text' };
    const row = createAssetFieldRowElement(defaultField, container.children.length);
    container.appendChild(row);
    const ta = row.querySelector('textarea.field-label');
    if (ta) {
        autoResizeTextarea(ta);
        setTimeout(() => ta.focus(), 50);
    }
}

export function removeAssetTemplateFieldRow(btn) {
    const row = btn.closest('.asset-field-row');
    if (row) row.remove();
}

// --- SELETOR DE ITENS TÉCNICOS PADRÃO ---

export function openAssetDefaultFieldsPickerModal() {
    const modal = document.getElementById('asset-default-fields-picker-modal');
    const container = document.getElementById('asset-default-fields-list');
    if (!modal || !container) return;

    // Coleta campos já adicionados para desmarcar ou evitar duplicados
    const existingLabels = Array.from(document.querySelectorAll('.asset-field-row .field-label'))
        .map(input => input.value.trim().toUpperCase());

    container.innerHTML = DEFAULT_ASSET_FIELDS_CATALOG.map((f, idx) => {
        const isAlreadyAdded = existingLabels.includes(f.label.toUpperCase());
        return `
            <label class="flex items-center justify-between p-3 bg-surface-container-low hover:bg-surface-container border border-outline-variant rounded-xl cursor-pointer transition-all ${isAlreadyAdded ? 'opacity-50' : ''}">
                <div class="flex items-center gap-3">
                    <input type="checkbox" class="asset-default-chk h-5 w-5 text-primary rounded border-outline focus:ring-primary cursor-pointer" data-label="${escapeHTML(f.label)}" data-type="${f.type}" onchange="window.updateAssetDefaultFieldsCount()" ${isAlreadyAdded ? 'disabled' : ''}>
                    <span class="font-bold text-body-md text-on-surface uppercase">${escapeHTML(f.label)}</span>
                </div>
                <span class="bg-surface px-2.5 py-0.5 rounded-lg text-label-sm font-bold text-on-surface-variant border border-outline-variant uppercase">${f.type === 'number' ? 'NÚMERO' : (f.type === 'date' ? 'DATA' : 'TEXTO')}</span>
            </label>
        `;
    }).join('');

    updateAssetDefaultFieldsCount();
    modal.classList.remove('hidden');
}

export function closeAssetDefaultFieldsPickerModal() {
    const modal = document.getElementById('asset-default-fields-picker-modal');
    if (modal) modal.classList.add('hidden');
}

export function toggleAllAssetDefaultFields(selectAll) {
    const checkboxes = document.querySelectorAll('.asset-default-chk:not([disabled])');
    checkboxes.forEach(chk => {
        chk.checked = !!selectAll;
    });
    updateAssetDefaultFieldsCount();
}

export function updateAssetDefaultFieldsCount() {
    const countEl = document.getElementById('asset-default-fields-selected-count');
    const checked = document.querySelectorAll('.asset-default-chk:checked').length;
    if (countEl) {
        countEl.innerText = `${checked} selecionado${checked === 1 ? '' : 's'}`;
    }
}

export function importSelectedAssetDefaultFields() {
    const checkedBoxes = Array.from(document.querySelectorAll('.asset-default-chk:checked'));
    if (checkedBoxes.length === 0) {
        return window.showAlert('Selecione pelo menos um item para incluir.', 'warning');
    }

    checkedBoxes.forEach(chk => {
        const label = chk.getAttribute('data-label');
        const type = chk.getAttribute('data-type') || 'text';
        if (label) {
            addAssetTemplateFieldRow({ label, type });
        }
    });

    closeAssetDefaultFieldsPickerModal();
    window.showAlert(`${checkedBoxes.length} item(ns) incluído(s) no modelo!`, 'success');
}

async function saveAssetTemplateFromModal() {
    const nameInput = document.getElementById('asset-template-name-input');
    const tipoInput = document.getElementById('asset-template-tipo-default');
    const rows = document.querySelectorAll('.asset-field-row');

    const nome = (nameInput?.value || '').trim();
    if (!nome) {
        return window.showAlert('Informe o nome do modelo de ativo.', 'warning');
    }

    const customFields = [];
    rows.forEach((row, idx) => {
        const label = (row.querySelector('.field-label')?.value || '').trim();
        const type = row.querySelector('.field-type')?.value || 'text';

        if (label) {
            customFields.push({
                id: `cf_${idx + 1}_${label.toLowerCase().replace(/[^a-z0-9]/g, '_')}`,
                label: label.toUpperCase(),
                type: type.toLowerCase()
            });
        }
    });

    const payload = {
        id: draftAssetTemplate ? draftAssetTemplate.id : null,
        nome: nome.toUpperCase(),
        tipoEquipamento: (tipoInput?.value || 'PONTE ROLANTE').trim().toUpperCase(),
        customFields
    };

    try {
        await saveAssetTemplate(payload);
        closeAssetTemplateModal();
        window.showAlert('Modelo de ativo salvo com sucesso!', 'success');
        renderTemplatesView();
    } catch (e) {
        window.showAlert(e.message || 'Erro ao salvar modelo de ativo.', 'error');
    }
}

/**
 * Popula qualquer select de modelo de ativo exibindo EXCLUSIVAMENTE modelos criados por usuários
 */
export function populateAssetTemplateDropdown(selectEl, selectedId = null) {
    if (!selectEl) return;
    const rawList = getAssetTemplates() || [];
    
    // Filtrar estritamente para NÃO incluir o modelo padrão do sistema
    const userTemplates = rawList.filter(t => 
        String(t.id) !== SYSTEM_ASSET_TEMPLATE_ID && !t.isSystemDefault
    );
    
    const allOptions = userTemplates.map(t => ({
        id: t.id,
        nome: t.nome || t.tipoEquipamento || ''
    }));
    
    allOptions.sort((a, b) => (a.nome || '').localeCompare(b.nome || '', 'pt-BR', { sensitivity: 'base' }));

    let html = '';
    if (allOptions.length === 0) {
        html = '<option value="">NENHUM MODELO DE ATIVO CADASTRADO</option>';
    } else {
        allOptions.forEach((tpl, idx) => {
            const isSel = (selectedId !== null && selectedId !== undefined && selectedId !== '' && String(tpl.id) === String(selectedId)) || 
                          ((selectedId === null || selectedId === undefined || selectedId === '') && idx === 0) ? 'selected' : '';
            html += `<option value="${tpl.id}" ${isSel}>${escapeHTML(tpl.nome.toUpperCase())}</option>`;
        });
    }

    selectEl.innerHTML = html;
}


export function getHierarchyDefaultTree(schema = CHECKLIST_SCHEMA) {
    return (schema || []).map(mainSec => {
        const cleanMainTitle = (mainSec.title || '')
            .replace(/<[^>]*>/g, ' ')
            .trim();

        const subSections = [];

        function parseChildren(childrenList, parentPrefix = '') {
            (childrenList || []).forEach(child => {
                const cleanChildTitle = (child.title || child.label || '')
                    .replace(/<[^>]*>/g, ' ')
                    .trim();

                const isCable = child.id === '5.6.1' || child.id === '6.6.1' || child.specialType === 'cableTable';
                const isHook = child.id === '5.7.2' || child.id === '6.7.2' || child.specialType === 'hookTable';
                const isCableComposite = child.id === '5.6' || child.id === '6.6';
                const isHookComposite = child.id === '5.7' || child.id === '6.7';

                if (isCable) {
                    subSections.push({
                        id: String(child.id),
                        title: cleanChildTitle,
                        isSpecialTable: true,
                        specialType: 'cableTable',
                        description: 'Tabela NBR ISO 4309 (Arames Rompidos, Bitola, Diâmetros, Graus de Corrosão/Danos/Deterioração)',
                        fields: []
                    });
                } else if (isHook) {
                    subSections.push({
                        id: String(child.id),
                        title: cleanChildTitle,
                        isSpecialTable: true,
                        specialType: 'hookTable',
                        description: 'Tabela de Inspeção do Conjunto de Moitão DIN 15400 (Abertura do Gancho, Líquido Penetrante, Proteções)',
                        fields: []
                    });
                } else if (child.children && child.children.length > 0) {
                    // Pega APENAS os campos do tipo inspectable para o checklist
                    const inspectables = child.children.filter(c => c.fieldType === 'inspectable');
                    if (inspectables.length > 0) {
                        subSections.push({
                            id: String(child.id),
                            title: cleanChildTitle,
                            isSpecialTable: false,
                            specialType: isCableComposite ? 'cableComposite' : isHookComposite ? 'hookComposite' : null,
                            fields: inspectables.map(f => ({
                                id: String(f.id),
                                label: (f.label || '').replace(/<[^>]*>/g, ' ').trim()
                            }))
                        });
                    }
                    const deepSubs = child.children.filter(c => c.children && c.children.length > 0);
                    if (deepSubs.length > 0) {
                        parseChildren(deepSubs, cleanChildTitle);
                    }
                } else if ((child.fieldType === 'inspectable' || child.fieldType === 'textarea' || child.fieldType === 'text') && !parentPrefix) {
                    let directGroup = subSections.find(s => s.id === mainSec.id);
                    if (!directGroup) {
                        directGroup = {
                            id: String(mainSec.id),
                            title: cleanMainTitle,
                            isSpecialTable: false,
                            fields: []
                        };
                        subSections.push(directGroup);
                    }
                    directGroup.fields.push({
                        id: String(child.id),
                        label: cleanChildTitle
                    });
                }
            });
        }

        parseChildren(mainSec.children || []);

        return {
            id: String(mainSec.id),
            title: cleanMainTitle,
            subSections: subSections
        };
    }).filter(sec => sec.subSections.length > 0);
}

export function openDefaultItemsModal(evt) {
    executeWithAntiDoubleClick(evt, async () => {
        const modal = document.getElementById('default-items-modal');
        const searchInput = document.getElementById('default-items-search-input');
        if (searchInput) searchInput.value = '';
        renderDefaultItemsTree('');
        if (modal) modal.classList.remove('hidden');
    });
}

export function closeDefaultItemsModal() {
    const modal = document.getElementById('default-items-modal');
    if (modal) modal.classList.add('hidden');
}

export function renderDefaultItemsTree(searchTerm = '') {
    const container = document.getElementById('default-items-tree-container');
    if (!container) return;

    const sections = getHierarchyDefaultTree(CHECKLIST_SCHEMA);
    const term = (searchTerm || '').trim().toLowerCase();

    let filteredSections = sections;
    if (term) {
        filteredSections = sections.map(sec => {
            const secTitleMatch = sec.title.toLowerCase().includes(term);
            const matchedSubs = sec.subSections.map(sub => {
                const subTitleMatch = sub.title.toLowerCase().includes(term);
                const matchedFields = sub.fields.filter(f => f.label.toLowerCase().includes(term));
                if (secTitleMatch || subTitleMatch) {
                    return sub;
                } else if (matchedFields.length > 0) {
                    return { ...sub, fields: matchedFields };
                }
                return null;
            }).filter(Boolean);

            if (matchedSubs.length > 0) {
                return { ...sec, subSections: matchedSubs };
            }
            return null;
        }).filter(Boolean);
    }

    if (filteredSections.length === 0) {
        container.innerHTML = `
            <div class="py-12 text-center text-on-surface-variant">
                <span class="material-symbols-outlined text-[48px] opacity-40 mb-2 block">search_off</span>
                <p class="text-body-lg font-bold uppercase">Nenhum item encontrado para "${escapeHTML(searchTerm)}"</p>
            </div>`;
        updateDefaultItemsCount();
        return;
    }

    const html = filteredSections.map(sec => {
        const match = sec.title.match(/^(\d+(?:\s*–\s*|\s+))?(.*)$/);
        let numPart = '';
        let textPart = sec.title;
        if (match && match[1]) {
            numPart = match[1];
            textPart = match[2];
        }

        const subSectionsHtml = sec.subSections.map(sub => {
            if (sub.isSpecialTable) {
                return `
                <div class="bg-surface-container-high/60 border border-primary/40 rounded-xl p-4 space-y-2 shadow-xs" data-sub-wrapper="${sub.id}">
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" class="default-chk-sub rounded border-outline text-primary focus:ring-primary w-5 h-5 mt-0.5" data-sec-id="${sec.id}" data-sub-id="${sub.id}" data-sub-title="${escapeHTML(sub.title)}" data-is-special="true" data-special-type="${sub.specialType}" onchange="window.updateDefaultItemsCount()">
                        <div class="space-y-1">
                            <span class="text-body-lg font-bold uppercase text-on-surface group-hover:text-primary transition-colors block">${escapeHTML(sub.title)}</span>
                            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-md font-bold bg-primary/20 text-on-surface uppercase">
                                <span class="material-symbols-outlined text-[16px] text-primary">table_chart</span>
                                TABELA ESPECIAL: ${escapeHTML(sub.description)}
                            </span>
                        </div>
                    </label>
                </div>`;
            }

            const fieldsHtml = sub.fields.map(field => `
                <label class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-container/70 cursor-pointer transition-colors text-body-md uppercase text-on-surface border border-transparent hover:border-outline-variant/40">
                    <input type="checkbox" class="default-chk-field rounded border-outline text-primary focus:ring-primary w-4.5 h-4.5" data-sec-id="${sec.id}" data-sub-id="${sub.id}" data-sub-title="${escapeHTML(sub.title)}" data-special-type="${sub.specialType || ''}" data-field-id="${field.id}" data-field-label="${escapeHTML(field.label)}" onchange="window.onDefaultFieldChange('${sub.id}')">
                    <span class="leading-tight">${escapeHTML(field.label)}</span>
                </label>
            `).join('');

            return `
            <div class="bg-surface border border-outline-variant rounded-xl p-4 space-y-3 shadow-xs" data-sub-wrapper="${sub.id}">
                <div class="flex items-center justify-between border-b border-outline-variant/60 pb-2.5">
                    <label class="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" class="default-chk-sub rounded border-outline text-primary focus:ring-primary w-5 h-5" data-sec-id="${sec.id}" data-sub-id="${sub.id}" data-sub-title="${escapeHTML(sub.title)}" data-special-type="${sub.specialType || ''}" onchange="window.toggleDefaultSubSectionCheckboxes('${sub.id}', this.checked)">
                        <span class="text-body-lg font-bold uppercase text-on-surface group-hover:text-primary transition-colors">${escapeHTML(sub.title)}</span>
                    </label>
                    <span class="text-label-md font-bold text-on-surface-variant/70 uppercase bg-surface-container-high px-2.5 py-1 rounded-lg">${sub.fields.length} verificações</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                    ${fieldsHtml}
                </div>
            </div>`;
        }).join('');

        return `
        <div class="bg-surface-container-low border-2 border-outline/70 rounded-2xl p-5 space-y-4 shadow-sm" data-sec-wrapper="${sec.id}">
            <div class="flex items-center justify-between border-b-2 border-outline-variant pb-3 bg-surface-container/40 -mx-5 -mt-5 p-5 rounded-t-2xl">
                <label class="flex items-center gap-3.5 cursor-pointer group">
                    <input type="checkbox" class="default-chk-sec rounded border-outline text-primary focus:ring-primary w-6 h-6" onchange="window.toggleDefaultMainSectionCheckboxes('${sec.id}', this.checked)">
                    <span class="text-headline-md font-bold uppercase text-on-surface tracking-tight group-hover:text-primary transition-colors">
                        ${numPart ? `<span class="text-primary font-bold mr-2">${numPart}</span>` : ''}${escapeHTML(textPart)}
                    </span>
                </label>
                <span class="text-label-md font-bold text-primary uppercase bg-primary/10 border border-primary/20 px-3 py-1 rounded-xl">${sec.subSections.length} ${sec.subSections.length === 1 ? 'subseção' : 'subseções'}</span>
            </div>
            <div class="space-y-3.5 pt-1">
                ${subSectionsHtml}
            </div>
        </div>`;
    }).join('');

    container.innerHTML = html;
    updateDefaultItemsCount();
}

export function updateDefaultItemsCount() {
    const countEl = document.getElementById('default-items-selected-count');
    if (!countEl) return;
    const checkedSubs = document.querySelectorAll('#default-items-tree-container input.default-chk-sub:checked');
    const checkedFields = document.querySelectorAll('#default-items-tree-container input.default-chk-field:checked');
    const totalCount = checkedSubs.length + checkedFields.length;
    countEl.innerText = `${totalCount} selecionados`;
}

export function filterDefaultItemsTree(term) {
    renderDefaultItemsTree(term);
}

export function toggleAllDefaultItems(isChecked) {
    const container = document.getElementById('default-items-tree-container');
    if (!container) return;
    container.querySelectorAll('input[type="checkbox"]').forEach(chk => chk.checked = isChecked);
    updateDefaultItemsCount();
}

export function toggleDefaultMainSectionCheckboxes(secId, isChecked) {
    const wrapper = document.querySelector(`[data-sec-wrapper="${secId}"]`);
    if (!wrapper) return;
    wrapper.querySelectorAll('input[type="checkbox"]').forEach(chk => chk.checked = isChecked);
    updateDefaultItemsCount();
}

export function toggleDefaultSubSectionCheckboxes(subId, isChecked) {
    const wrapper = document.querySelector(`[data-sub-wrapper="${subId}"]`);
    if (!wrapper) return;
    wrapper.querySelectorAll('input[type="checkbox"]').forEach(chk => chk.checked = isChecked);
    updateDefaultItemsCount();
}

export function onDefaultFieldChange(subId) {
    const wrapper = document.querySelector(`[data-sub-wrapper="${subId}"]`);
    if (!wrapper) return;
    const subChk = wrapper.querySelector('input.default-chk-sub');
    const fieldChks = Array.from(wrapper.querySelectorAll('input.default-chk-field'));
    const anyChecked = fieldChks.some(f => f.checked);
    const allChecked = fieldChks.every(f => f.checked);
    if (subChk) {
        subChk.checked = allChecked;
        subChk.indeterminate = anyChecked && !allChecked;
    }
    updateDefaultItemsCount();
}

export function importSelectedDefaultItems(evt) {
    executeWithAntiDoubleClick(evt, async () => {
        if (!draftTemplate) draftTemplate = createEmptyDraft();

        const selectedSubCheckboxes = Array.from(document.querySelectorAll('#default-items-tree-container input.default-chk-sub:checked'));
        const selectedFieldCheckboxes = Array.from(document.querySelectorAll('#default-items-tree-container input.default-chk-field:checked'));

        if (selectedSubCheckboxes.length === 0 && selectedFieldCheckboxes.length === 0) {
            return window.showAlert('Selecione pelo menos um item ou verificação para incluir.', 'warning');
        }

        const itemsToAppend = [];

        // 1. Processa subseções / tabelas especiais marcadas
        selectedSubCheckboxes.forEach(subChk => {
            const subTitle = subChk.dataset.subTitle || 'SUBSEÇÃO PADRÃO';
            const isSpecial = subChk.dataset.isSpecial === 'true';
            const specialType = subChk.dataset.specialType || null;

            if (isSpecial) {
                itemsToAppend.push({
                    id: null,
                    nome: subTitle,
                    specialType: specialType,
                    checklists: [{ id: null, descricao: specialType === 'cableTable' ? 'Tabela de Inspeção do Cabo de Aço (NBR ISO 4309)' : 'Tabela de Inspeção do Moitão (DIN 15400)' }]
                });
            } else {
                const fieldsInSub = selectedFieldCheckboxes.filter(f => f.dataset.subId === subChk.dataset.subId);
                const checklists = fieldsInSub.length > 0
                    ? fieldsInSub.map(f => ({ id: null, descricao: f.dataset.fieldLabel }))
                    : Array.from(document.querySelectorAll(`[data-sub-wrapper="${subChk.dataset.subId}"] input.default-chk-field`)).map(f => ({ id: null, descricao: f.dataset.fieldLabel }));

                if (checklists.length > 0) {
                    itemsToAppend.push({
                        id: null,
                        nome: subTitle,
                        specialType: specialType || null,
                        checklists: checklists
                    });
                }
            }
        });

        // 2. Processa verificações avulsas onde a subseção inteira NÃO foi marcada
        const subIdsAlreadyProcessed = new Set(selectedSubCheckboxes.map(s => s.dataset.subId));
        const standaloneFieldsMap = new Map();

        selectedFieldCheckboxes.forEach(fieldChk => {
            const subId = fieldChk.dataset.subId;
            if (!subIdsAlreadyProcessed.has(subId)) {
                const subTitle = fieldChk.dataset.subTitle || 'VERIFICAÇÕES SELECIONADAS';
                const specialType = fieldChk.dataset.specialType || null;
                if (!standaloneFieldsMap.has(subTitle)) {
                    standaloneFieldsMap.set(subTitle, { specialType, labels: [] });
                }
                standaloneFieldsMap.get(subTitle).labels.push(fieldChk.dataset.fieldLabel);
            }
        });

        standaloneFieldsMap.forEach((entry, subTitle) => {
            itemsToAppend.push({
                id: null,
                nome: subTitle,
                specialType: entry.specialType || null,
                checklists: entry.labels.map(lbl => ({ id: null, descricao: lbl }))
            });
        });

        // Se o draftTemplate possuía apenas 1 item totalmente vazio, substitui
        if (draftTemplate.items.length === 1 && !draftTemplate.items[0].nome.trim() && (draftTemplate.items[0].checklists.length === 1 && !draftTemplate.items[0].checklists[0].descricao.trim())) {
            draftTemplate.items = [];
        }

        draftTemplate.items.push(...itemsToAppend);

        closeDefaultItemsModal();
        renderModalEditorContent();
        window.showAlert('Itens do formulário padrão adicionados ao modelo com sucesso!', 'success');
    });
}

// --- SELETOR DE ITENS PARA INSPEÇÃO CORRETIVA ---
let currentCorretivaContext = null;
let currentCorretivaBaseSchema = null;
let currentCorretivaCustomSections = [];

/**
 * Filtra um schema de checklist mantendo apenas os nós e itens selecionados
 */
export function filterSchemaForCorretiva(baseSchema, selectedIdsSet) {
    if (!baseSchema || !Array.isArray(baseSchema) || !selectedIdsSet || selectedIdsSet.size === 0) {
        return [];
    }

    function filterNode(node) {
        if (!node) return null;
        const nodeIdStr = String(node.id);

        // Se o nó foi diretamente marcado (ex: tabela especial ou inspectable)
        if (selectedIdsSet.has(nodeIdStr)) {
            return JSON.parse(JSON.stringify(node));
        }

        // Se o nó possui filhos, filtra recursivamente
        if (node.children && Array.isArray(node.children)) {
            const filteredChildren = node.children
                .map(child => filterNode(child))
                .filter(Boolean);

            if (filteredChildren.length > 0) {
                const copy = JSON.parse(JSON.stringify(node));
                copy.children = filteredChildren;
                return copy;
            }
        }

        return null;
    }

    return baseSchema
        .map(sec => filterNode(sec))
        .filter(Boolean);
}

/**
 * Abre o modal de seleção de itens para a inspeção corretiva
 */
export function openCorretivaItemsPicker(context, baseSchema, templateName = '') {
    currentCorretivaContext = context;
    currentCorretivaBaseSchema = baseSchema || CHECKLIST_SCHEMA;
    currentCorretivaCustomSections = [];

    const modal = document.getElementById('corretiva-items-modal');
    const panel = document.getElementById('corretiva-items-panel');
    const overlay = document.getElementById('corretiva-items-overlay');
    const searchInput = document.getElementById('corretiva-items-search-input');
    const subtitleEl = document.getElementById('corretiva-modal-subtitle');

    if (searchInput) searchInput.value = '';
    if (subtitleEl) {
        const assetName = context.equipamentoNome || context.equipamentoId || 'ATIVO';
        subtitleEl.innerText = `ATIVO: ${assetName.toUpperCase()}`;
    }

    renderCorretivaItemsTree('');

    if (modal) modal.classList.remove('hidden');
    setTimeout(() => {
        if (overlay) {
            overlay.classList.remove('opacity-0');
            overlay.classList.add('opacity-100');
        }
        if (panel) {
            panel.classList.remove('opacity-0', 'scale-95');
            panel.classList.add('opacity-100', 'scale-100');
        }
    }, 10);
}

export function closeCorretivaItemsModal() {
    const modal = document.getElementById('corretiva-items-modal');
    const panel = document.getElementById('corretiva-items-panel');
    const overlay = document.getElementById('corretiva-items-overlay');
    if (panel) {
        panel.classList.remove('opacity-100', 'scale-100');
        panel.classList.add('opacity-0', 'scale-95');
    }
    if (overlay) {
        overlay.classList.remove('opacity-100');
        overlay.classList.add('opacity-0');
    }
    setTimeout(() => {
        if (modal) modal.classList.add('hidden');
    }, 300);
}

export function openCorretivaCustomItemModal() {
    const modal = document.getElementById('corretiva-custom-item-modal');
    const panel = document.getElementById('corretiva-custom-item-panel');
    const overlay = document.getElementById('corretiva-custom-item-overlay');
    const titleInput = document.getElementById('corretiva-custom-title');
    const chkInput = document.getElementById('corretiva-custom-checklists');
    const includeObs = document.getElementById('corretiva-custom-include-obs');

    if (titleInput) {
        titleInput.value = '';
        titleInput.style.height = 'auto';
    }
    if (chkInput) chkInput.value = '';
    if (includeObs) includeObs.checked = true;

    if (modal) modal.classList.remove('hidden');
    setTimeout(() => {
        if (overlay) {
            overlay.classList.remove('opacity-0');
            overlay.classList.add('opacity-100');
        }
        if (panel) {
            panel.classList.remove('opacity-0', 'scale-95');
            panel.classList.add('opacity-100', 'scale-100');
        }
    }, 10);
    setTimeout(() => titleInput?.focus(), 150);
}

export function closeCorretivaCustomItemModal() {
    const modal = document.getElementById('corretiva-custom-item-modal');
    const panel = document.getElementById('corretiva-custom-item-panel');
    const overlay = document.getElementById('corretiva-custom-item-overlay');
    if (panel) {
        panel.classList.remove('opacity-100', 'scale-100');
        panel.classList.add('opacity-0', 'scale-95');
    }
    if (overlay) {
        overlay.classList.remove('opacity-100');
        overlay.classList.add('opacity-0');
    }
    setTimeout(() => {
        if (modal) modal.classList.add('hidden');
    }, 300);
}

export function confirmCorretivaCustomItem() {
    const titleInput = document.getElementById('corretiva-custom-title');
    const chkInput = document.getElementById('corretiva-custom-checklists');
    const includeObsInput = document.getElementById('corretiva-custom-include-obs');

    const titleVal = (titleInput?.value || '').trim();
    if (!titleVal) {
        return window.showAlert('INFORME O NOME DO ITEM.', 'warning');
    }

    const chkText = (chkInput?.value || '').trim();
    const checklistLines = chkText ? chkText.split('\n').map(l => l.trim()).filter(l => l.length > 0) : [];
    const includeObs = includeObsInput ? includeObsInput.checked : true;

    if (checklistLines.length === 0 && !includeObs) {
        return window.showAlert('ADICIONE AO MENOS 1 ITEM DE CHECKLIST OU ATIVE O CAMPO DE OBSERVAÇÕES COM FOTOS.', 'warning');
    }

    const sectionId = `corretiva_custom_${Date.now()}`;
    let children = [];

    if (checklistLines.length > 0) {
        children = checklistLines.map((line, idx) => ({
            id: `${sectionId}_chk_${idx + 1}`,
            label: line,
            fieldType: 'inspectable'
        }));
    } else {
        children = [
            {
                id: `${sectionId}_obs`,
                label: 'OBSERVAÇÕES E PARECER TÉCNICO',
                fieldType: 'textarea'
            }
        ];
    }

    const cleanTitle = titleVal.replace(/^(\d+(?:\.\d+)*\s*[-–.]*\s*)/, '').trim();
    const customSection = {
        id: sectionId,
        title: cleanTitle || titleVal,
        isCustomCorretiva: true,
        level: 1,
        inspectable: false,
        includeObs: includeObs,
        children: children,
        selected: true
    };

    if (!currentCorretivaCustomSections) currentCorretivaCustomSections = [];
    currentCorretivaCustomSections.push(customSection);

    closeCorretivaCustomItemModal();
    renderCorretivaItemsTree(document.getElementById('corretiva-items-search-input')?.value || '');
    updateCorretivaItemsCount();
    window.showAlert(`Item "${cleanTitle || titleVal}" adicionado à lista da corretiva!`, 'success');
}

export function removeCorretivaCustomSection(secId) {
    if (!currentCorretivaCustomSections) return;
    currentCorretivaCustomSections = currentCorretivaCustomSections.filter(s => String(s.id) !== String(secId));
    renderCorretivaItemsTree(document.getElementById('corretiva-items-search-input')?.value || '');
    updateCorretivaItemsCount();
}

export function toggleCorretivaCustomSection(secId, isChecked) {
    const sec = (currentCorretivaCustomSections || []).find(s => String(s.id) === String(secId));
    if (sec) sec.selected = isChecked;
    document.querySelectorAll(`.corretiva-chk-custom-item[data-sec-id="${secId}"]`).forEach(chk => {
        chk.checked = isChecked;
    });
    updateCorretivaItemsCount();
}

export function onCorretivaCustomItemChange(secId) {
    const checked = document.querySelectorAll(`.corretiva-chk-custom-item[data-sec-id="${secId}"]:checked`);
    const secChk = document.querySelector(`.corretiva-chk-custom-sec[data-sec-id="${secId}"]`);
    if (secChk) {
        secChk.checked = checked.length > 0;
        const sec = (currentCorretivaCustomSections || []).find(s => String(s.id) === String(secId));
        if (sec) sec.selected = secChk.checked;
    }
    updateCorretivaItemsCount();
}

export function renderCorretivaItemsTree(searchTerm = '') {
    const container = document.getElementById('corretiva-items-tree-container');
    if (!container) return;

    const schemaToUse = currentCorretivaBaseSchema || CHECKLIST_SCHEMA;
    const sections = getHierarchyDefaultTree(schemaToUse);
    const term = (searchTerm || '').trim().toLowerCase();

    // 1. Filtra seções padrão
    let filteredSections = sections;
    if (term) {
        filteredSections = sections.map(sec => {
            const secTitleMatch = sec.title.toLowerCase().includes(term);
            const matchedSubs = sec.subSections.map(sub => {
                const subTitleMatch = sub.title.toLowerCase().includes(term);
                const matchedFields = sub.fields.filter(f => f.label.toLowerCase().includes(term));
                if (secTitleMatch || subTitleMatch) {
                    return sub;
                } else if (matchedFields.length > 0) {
                    return { ...sub, fields: matchedFields };
                }
                return null;
            }).filter(Boolean);

            if (matchedSubs.length > 0) {
                return { ...sec, subSections: matchedSubs };
            }
            return null;
        }).filter(Boolean);
    }

    // 2. Filtra seções customizadas
    let customSectionsToRender = currentCorretivaCustomSections || [];
    if (term) {
        customSectionsToRender = customSectionsToRender.filter(sec => {
            const matchTitle = (sec.title || '').toLowerCase().includes(term);
            const matchChild = (sec.children || []).some(c => (c.label || '').toLowerCase().includes(term));
            return matchTitle || matchChild;
        });
    }

    if (filteredSections.length === 0 && customSectionsToRender.length === 0) {
        container.innerHTML = `
            <div class="py-12 text-center text-on-surface-variant">
                <span class="material-symbols-outlined text-[48px] opacity-40 mb-2 block">search_off</span>
                <p class="text-body-lg font-bold uppercase">Nenhum item encontrado para "${escapeHTML(searchTerm)}"</p>
            </div>`;
        updateCorretivaItemsCount();
        return;
    }

    // 3. Renderiza blocos de itens customizados adicionados
    const customHtml = customSectionsToRender.map(customSec => {
        const inspectables = (customSec.children || []).filter(c => c.fieldType === 'inspectable');
        const hasObs = (customSec.children || []).some(c => c.fieldType === 'textarea') || customSec.includeObs;

        const inspectablesHtml = inspectables.map(child => `
            <label class="flex items-center gap-3 p-2.5 rounded-lg bg-surface hover:bg-surface-container/70 cursor-pointer transition-colors text-body-md uppercase text-on-surface border border-outline-variant/50">
                <input type="checkbox" class="corretiva-chk-custom-item rounded border-outline text-primary focus:ring-primary w-4.5 h-4.5" data-sec-id="${customSec.id}" data-item-id="${child.id}" ${customSec.selected !== false ? 'checked' : ''} onchange="window.onCorretivaCustomItemChange('${customSec.id}')">
                <span class="leading-tight font-semibold">${escapeHTML(child.label)}</span>
            </label>
        `).join('');

        const obsBadge = hasObs ? `
            <div class="flex items-center gap-2 px-3 py-2 bg-surface rounded-lg border border-outline-variant/40 text-xs text-on-surface-variant uppercase font-medium">
                <span class="material-symbols-outlined text-primary text-[18px]">add_a_photo</span>
                <span>Inclui campo de observações técnicas com fotos</span>
            </div>
        ` : '';

        return `
        <div class="bg-[#fffdf5] border-2 border-[#e6d5a8] rounded-2xl p-5 space-y-3.5 shadow-sm" data-corretiva-custom-sec="${customSec.id}">
            <div class="flex items-center justify-between border-b border-[#e6d5a8]/60 pb-3 bg-[#fff8e0]/60 -mx-5 -mt-5 p-5 rounded-t-2xl">
                <label class="flex items-center gap-3.5 cursor-pointer group flex-1">
                    <input type="checkbox" class="corretiva-chk-custom-sec rounded border-outline text-primary focus:ring-primary w-6 h-6" data-sec-id="${customSec.id}" ${customSec.selected !== false ? 'checked' : ''} onchange="window.toggleCorretivaCustomSection('${customSec.id}', this.checked)">
                    <div>
                        <span class="text-headline-md font-bold uppercase text-on-surface tracking-tight group-hover:text-primary transition-colors block">
                            ${escapeHTML(customSec.title)}
                        </span>
                        <span class="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#fa520f]/15 text-[#fa520f] uppercase mt-0.5">
                            <span class="material-symbols-outlined text-[14px]">tune</span>
                            ITEM PERSONALIZADO
                        </span>
                    </div>
                </label>
                <button type="button" onclick="window.removeCorretivaCustomSection('${customSec.id}')" class="w-9 h-9 flex items-center justify-center rounded-xl text-error hover:bg-error/10 transition-colors cursor-pointer shrink-0 ml-2" title="Excluir item personalizado">
                    <span class="material-symbols-outlined text-[22px]">delete</span>
                </button>
            </div>
            <div class="space-y-2 pt-1">
                ${inspectables.length > 0 ? `<div class="grid grid-cols-1 md:grid-cols-2 gap-2">${inspectablesHtml}</div>` : ''}
                ${obsBadge}
            </div>
        </div>`;
    }).join('');

    // 4. Renderiza seções do formulário padrão
    const standardHtml = filteredSections.map(sec => {
        const match = sec.title.match(/^(\d+(?:\s*–\s*|\s+))?(.*)$/);
        let numPart = '';
        let textPart = sec.title;
        if (match && match[1]) {
            numPart = match[1];
            textPart = match[2];
        }

        const subSectionsHtml = sec.subSections.map(sub => {
            if (sub.isSpecialTable) {
                return `
                <div class="bg-surface-container-high/60 border border-primary/40 rounded-xl p-4 space-y-2 shadow-xs" data-corretiva-sub="${sub.id}">
                    <label class="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" class="corretiva-chk-item rounded border-outline text-primary focus:ring-primary w-5 h-5 mt-0.5" data-node-id="${sub.id}" data-is-special="true" onchange="window.updateCorretivaItemsCount()">
                        <div class="space-y-1">
                            <span class="text-body-lg font-bold uppercase text-on-surface group-hover:text-primary transition-colors block">${escapeHTML(sub.title)}</span>
                            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-label-md font-bold bg-primary/20 text-on-surface uppercase">
                                <span class="material-symbols-outlined text-[16px] text-primary">table_chart</span>
                                TABELA ESPECIAL: ${escapeHTML(sub.description)}
                            </span>
                        </div>
                    </label>
                </div>`;
            }

            const fieldsHtml = sub.fields.map(field => `
                <label class="flex items-center gap-3 p-2.5 rounded-lg hover:bg-surface-container/70 cursor-pointer transition-colors text-body-md uppercase text-on-surface border border-transparent hover:border-outline-variant/40">
                    <input type="checkbox" class="corretiva-chk-item corretiva-field-${sub.id} rounded border-outline text-primary focus:ring-primary w-4.5 h-4.5" data-node-id="${field.id}" data-sub-id="${sub.id}" onchange="window.onCorretivaFieldChange('${sub.id}')">
                    <span class="leading-tight">${escapeHTML(field.label)}</span>
                </label>
            `).join('');

            return `
            <div class="bg-surface border border-outline-variant rounded-xl p-4 space-y-3 shadow-xs" data-corretiva-sub="${sub.id}">
                <div class="flex items-center justify-between border-b border-outline-variant/60 pb-2.5">
                    <label class="flex items-center gap-3 cursor-pointer group">
                        <input type="checkbox" class="corretiva-chk-sub rounded border-outline text-primary focus:ring-primary w-5 h-5" data-sub-id="${sub.id}" onchange="window.toggleCorretivaSubCheckboxes('${sub.id}', this.checked)">
                        <span class="text-body-lg font-bold uppercase text-on-surface group-hover:text-primary transition-colors">${escapeHTML(sub.title)}</span>
                    </label>
                    <span class="text-label-md font-bold text-on-surface-variant/70 uppercase bg-surface-container-high px-2.5 py-1 rounded-lg">${sub.fields.length} verificações</span>
                </div>
                <div class="grid grid-cols-1 md:grid-cols-2 gap-2 pt-1">
                    ${fieldsHtml}
                </div>
            </div>`;
        }).join('');

        return `
        <div class="bg-surface-container-low border-2 border-outline/70 rounded-2xl p-5 space-y-4 shadow-sm" data-corretiva-sec="${sec.id}">
            <div class="flex items-center justify-between border-b-2 border-outline-variant pb-3 bg-surface-container/40 -mx-5 -mt-5 p-5 rounded-t-2xl">
                <label class="flex items-center gap-3.5 cursor-pointer group">
                    <input type="checkbox" class="corretiva-chk-sec rounded border-outline text-primary focus:ring-primary w-6 h-6" onchange="window.toggleCorretivaMainSection('${sec.id}', this.checked)">
                    <span class="text-headline-md font-bold uppercase text-on-surface tracking-tight group-hover:text-primary transition-colors">
                        ${numPart ? `<span class="text-primary font-bold mr-2">${numPart}</span>` : ''}${escapeHTML(textPart)}
                    </span>
                </label>
                <span class="text-label-md font-bold text-primary uppercase bg-primary/10 border border-primary/20 px-3 py-1 rounded-xl">${sec.subSections.length} ${sec.subSections.length === 1 ? 'subseção' : 'subseções'}</span>
            </div>
            <div class="space-y-3.5 pt-1">
                ${subSectionsHtml}
            </div>
        </div>`;
    }).join('');

    container.innerHTML = customHtml + standardHtml;
    updateCorretivaItemsCount();
}

export function updateCorretivaItemsCount() {
    const counterEl = document.getElementById('corretiva-selected-counter');
    const confirmBtn = document.getElementById('corretiva-confirm-btn');
    if (!counterEl && !confirmBtn) return;

    const checkedStandard = document.querySelectorAll('#corretiva-items-tree-container input.corretiva-chk-item:checked');
    
    let customCount = 0;
    (currentCorretivaCustomSections || []).forEach(sec => {
        const secChk = document.querySelector(`.corretiva-chk-custom-sec[data-sec-id="${sec.id}"]`);
        if (secChk && secChk.checked) {
            const inspectables = (sec.children || []).filter(c => c.fieldType === 'inspectable');
            if (inspectables.length > 0) {
                const checkedItems = document.querySelectorAll(`.corretiva-chk-custom-item[data-sec-id="${sec.id}"]:checked`);
                customCount += checkedItems.length;
            } else {
                customCount += 1;
            }
        }
    });

    const count = checkedStandard.length + customCount;

    if (counterEl) {
        counterEl.innerText = `${count} ${count === 1 ? 'ITEM SELECIONADO' : 'ITENS SELECIONADOS'}`;
    }
    if (confirmBtn) {
        confirmBtn.innerText = count > 0 
            ? `INICIAR INSPEÇÃO CORRETIVA (${count} ${count === 1 ? 'ITEM' : 'ITENS'})`
            : 'INICIAR INSPEÇÃO CORRETIVA';
    }
}

export function toggleCorretivaMainSection(secId, isChecked) {
    const secWrapper = document.querySelector(`[data-corretiva-sec="${secId}"]`);
    if (!secWrapper) return;
    secWrapper.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        chk.checked = isChecked;
    });
    updateCorretivaItemsCount();
}

export function toggleCorretivaSubCheckboxes(subId, isChecked) {
    const subWrapper = document.querySelector(`[data-corretiva-sub="${subId}"]`);
    if (!subWrapper) return;
    subWrapper.querySelectorAll('.corretiva-chk-item').forEach(chk => {
        chk.checked = isChecked;
    });
    updateCorretivaItemsCount();
}

export function onCorretivaFieldChange(subId) {
    const subWrapper = document.querySelector(`[data-corretiva-sub="${subId}"]`);
    if (!subWrapper) return;
    const allFields = subWrapper.querySelectorAll('.corretiva-chk-item');
    const checkedFields = subWrapper.querySelectorAll('.corretiva-chk-item:checked');
    const subChk = subWrapper.querySelector('.corretiva-chk-sub');
    if (subChk) {
        subChk.checked = (allFields.length > 0 && checkedFields.length === allFields.length);
    }
    updateCorretivaItemsCount();
}

export function toggleAllCorretivaItems(isChecked) {
    const container = document.getElementById('corretiva-items-tree-container');
    if (!container) return;
    container.querySelectorAll('input[type="checkbox"]').forEach(chk => {
        chk.checked = isChecked;
    });
    if (currentCorretivaCustomSections) {
        currentCorretivaCustomSections.forEach(s => s.selected = isChecked);
    }
    updateCorretivaItemsCount();
}

export function onCorretivaSearchInput(term) {
    renderCorretivaItemsTree(term);
}

export function confirmCorretivaChecklist() {
    const checkedItems = Array.from(document.querySelectorAll('#corretiva-items-tree-container input.corretiva-chk-item:checked'));
    
    // 1. Filtra itens do template padrão
    const selectedIdsSet = new Set(checkedItems.map(chk => String(chk.dataset.nodeId)));
    const baseSchema = currentCorretivaBaseSchema || CHECKLIST_SCHEMA;
    const filteredStandardSchema = filterSchemaForCorretiva(baseSchema, selectedIdsSet);

    // 2. Coleta itens customizados selecionados
    const activeCustomSections = [];
    (currentCorretivaCustomSections || []).forEach(sec => {
        const secChk = document.querySelector(`.corretiva-chk-custom-sec[data-sec-id="${sec.id}"]`);
        if (secChk && secChk.checked) {
            const inspectables = (sec.children || []).filter(c => c.fieldType === 'inspectable');
            if (inspectables.length > 0) {
                const checkedSubIds = new Set(
                    Array.from(document.querySelectorAll(`.corretiva-chk-custom-item[data-sec-id="${sec.id}"]:checked`))
                        .map(c => String(c.dataset.itemId))
                );
                const filteredChildren = (sec.children || []).filter(c => 
                    c.fieldType !== 'inspectable' || checkedSubIds.has(String(c.id))
                );
                if (filteredChildren.length > 0) {
                    activeCustomSections.push({
                        ...sec,
                        children: filteredChildren
                    });
                }
            } else {
                activeCustomSections.push(sec);
            }
        }
    });

    const finalSchema = [...filteredStandardSchema, ...activeCustomSections];

    if (finalSchema.length === 0) {
        return window.showAlert('SELECIONE AO MENOS 1 ITEM PARA INICIAR A INSPEÇÃO CORRETIVA.', 'warning');
    }

    const ctx = currentCorretivaContext;
    closeCorretivaItemsModal();

    if (typeof window !== 'undefined' && window.launchInspectionWithSchema) {
        window.launchInspectionWithSchema(ctx, finalSchema);
    }
}

// Binds globais para o modal de inspeção corretiva
if (typeof window !== 'undefined') {
    window.openCorretivaItemsPicker = openCorretivaItemsPicker;
    window.closeCorretivaItemsModal = closeCorretivaItemsModal;
    window.openCorretivaCustomItemModal = openCorretivaCustomItemModal;
    window.closeCorretivaCustomItemModal = closeCorretivaCustomItemModal;
    window.confirmCorretivaCustomItem = confirmCorretivaCustomItem;
    window.removeCorretivaCustomSection = removeCorretivaCustomSection;
    window.toggleCorretivaCustomSection = toggleCorretivaCustomSection;
    window.onCorretivaCustomItemChange = onCorretivaCustomItemChange;
    window.renderCorretivaItemsTree = renderCorretivaItemsTree;
    window.updateCorretivaItemsCount = updateCorretivaItemsCount;
    window.toggleCorretivaMainSection = toggleCorretivaMainSection;
    window.toggleCorretivaSubCheckboxes = toggleCorretivaSubCheckboxes;
    window.onCorretivaFieldChange = onCorretivaFieldChange;
    window.toggleAllCorretivaItems = toggleAllCorretivaItems;
    window.onCorretivaSearchInput = onCorretivaSearchInput;
    window.confirmCorretivaChecklist = confirmCorretivaChecklist;
}

function escapeHTML(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
