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
    loadAssetTemplates
} from './templates-module.js';
import { CHECKLIST_SCHEMA } from '../../checklist-schema.js';

let draftTemplate = null;
let draftAssetTemplate = null;
let activeTemplatesTab = 'inspections'; // 'inspections' | 'assets'

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
    const templates = getTemplates();
    const assetTemplates = getAssetTemplates();

    const formatDate = (isoStr) => {
        if (!isoStr) return '-';
        try {
            const d = new Date(isoStr);
            return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        } catch (e) {
            return isoStr;
        }
    };

    // Tab 1: Inspeções
    let inspectionsTableRowsHtml = '';
    if (templates.length === 0) {
        inspectionsTableRowsHtml = `
            <tr>
                <td colspan="5" class="px-card_padding py-12 text-center text-on-surface-variant">
                    <span class="material-symbols-outlined text-[48px] text-on-surface-variant/40 mb-2 block">format_list_bulleted_add</span>
                    <p class="text-body-lg font-bold uppercase">Nenhum modelo de inspeção cadastrado</p>
                    <p class="text-body-md text-on-surface-variant mt-1">Clique em "+ INSPEÇÃO" para cadastrar seu primeiro checklist personalizado.</p>
                </td>
            </tr>`;
    } else {
        inspectionsTableRowsHtml = templates.map(t => {
            const itemCount = (t.items || []).length;
            const totalVerifications = (t.items || []).reduce((acc, item) => acc + (item.checklists || []).length, 0);

            return `
            <tr class="hover:bg-surface-container/50 transition-colors border-b border-outline-variant/60">
                <td class="px-card_padding py-stack_md font-bold text-on-surface uppercase text-body-md">
                    <div class="flex items-center gap-stack_sm">
                        <span class="material-symbols-outlined text-primary text-[22px]">assignment</span>
                        <span>${escapeHTML(t.nome)}</span>
                    </div>
                </td>
                <td class="px-card_padding py-stack_md text-on-surface-variant text-body-md">
                    <span class="font-semibold text-on-surface">${itemCount}</span> ${itemCount === 1 ? 'item' : 'itens'}
                    <span class="text-label-md text-on-surface-variant/70">(${totalVerifications} verificações)</span>
                </td>
                <td class="px-card_padding py-stack_md text-on-surface-variant text-body-md">
                    ${formatDate(t.createdAt)}
                </td>
                <td class="px-card_padding py-stack_md text-on-surface-variant text-body-md">
                    ${formatDate(t.updatedAt || t.createdAt)}
                </td>
                <td class="px-card_padding py-stack_md">
                    <div class="flex items-center justify-end gap-2">
                        <button onclick="window.editTemplateAction(event, '${t.id}')"
                            class="border border-outline bg-surface-container-low hover:bg-surface-container text-on-surface text-label-md font-bold py-1.5 px-3 rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                            title="Editar estrutura do modelo">
                            <span class="material-symbols-outlined text-[16px]">edit</span>
                            EDITAR
                        </button>
                        <button onclick="window.duplicateTemplateAction(event, '${t.id}')"
                            class="border border-outline bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface text-label-md font-bold py-1.5 px-3 rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                            title="Duplicar modelo">
                            <span class="material-symbols-outlined text-[16px]">content_copy</span>
                            DUPLICAR
                        </button>
                        <button onclick="window.deleteTemplateAction(event, '${t.id}')"
                            class="border border-outline bg-surface-container-low hover:bg-error/10 hover:border-error text-error text-label-md font-bold p-1.5 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                            title="Excluir modelo">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    // Tab 2: Ativos
    let assetTableRowsHtml = '';
    if (assetTemplates.length === 0) {
        assetTableRowsHtml = `
            <tr>
                <td colspan="5" class="px-card_padding py-12 text-center text-on-surface-variant">
                    <span class="material-symbols-outlined text-[48px] text-on-surface-variant/40 mb-2 block">assignment</span>
                    <p class="text-body-lg font-bold uppercase">Nenhum modelo de ativo cadastrado</p>
                    <p class="text-body-md text-on-surface-variant mt-1">Clique em "+ ATIVO" para configurar modelos com ficha técnica e especificações personalizadas.</p>
                </td>
            </tr>`;
    } else {
        assetTableRowsHtml = assetTemplates.map(a => {
            const fieldCount = (a.customFields || []).length;
            const tipo = a.tipoEquipamento ? a.tipoEquipamento.toUpperCase() : 'GERAL';

            return `
            <tr class="hover:bg-surface-container/50 transition-colors border-b border-outline-variant/60">
                <td class="px-card_padding py-stack_md font-bold text-on-surface uppercase text-body-md">
                    <div class="flex items-center gap-stack_sm">
                        <span class="material-symbols-outlined text-primary text-[22px]">assignment</span>
                        <span>${escapeHTML(a.nome)}</span>
                    </div>
                </td>
                <td class="px-card_padding py-stack_md text-on-surface-variant text-body-md">
                    <span class="font-semibold text-on-surface">${fieldCount}</span> ${fieldCount === 1 ? 'campo' : 'campos'}
                    <span class="text-label-md text-on-surface-variant/70">(${escapeHTML(tipo)})</span>
                </td>
                <td class="px-card_padding py-stack_md text-on-surface-variant text-body-md">
                    ${formatDate(a.createdAt)}
                </td>
                <td class="px-card_padding py-stack_md text-on-surface-variant text-body-md">
                    ${formatDate(a.updatedAt || a.createdAt)}
                </td>
                <td class="px-card_padding py-stack_md">
                    <div class="flex items-center justify-end gap-2">
                        <button onclick="window.editAssetTemplateAction(event, '${a.id}')"
                            class="border border-outline bg-surface-container-low hover:bg-surface-container text-on-surface text-label-md font-bold py-1.5 px-3 rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                            title="Editar modelo de ativo">
                            <span class="material-symbols-outlined text-[16px]">edit</span>
                            EDITAR
                        </button>
                        <button onclick="window.duplicateAssetTemplateAction(event, '${a.id}')"
                            class="border border-outline bg-surface-container-low hover:bg-surface-container text-on-surface-variant hover:text-on-surface text-label-md font-bold py-1.5 px-3 rounded-xl flex items-center gap-1 transition-all cursor-pointer"
                            title="Duplicar modelo de ativo">
                            <span class="material-symbols-outlined text-[16px]">content_copy</span>
                            DUPLICAR
                        </button>
                        <button onclick="window.deleteAssetTemplateAction(event, '${a.id}')"
                            class="border border-outline bg-surface-container-low hover:bg-error/10 hover:border-error text-error text-label-md font-bold p-1.5 rounded-xl flex items-center justify-center transition-all cursor-pointer"
                            title="Excluir modelo de ativo">
                            <span class="material-symbols-outlined text-[18px]">delete</span>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');
    }

    container.innerHTML = `
        <!-- Navegação por Abas (Inspeções vs Ativos) e Botão '+' -->
        <div class="flex border-b border-outline-variant items-center justify-between gap-2">
            <div class="flex items-center gap-2">
                <button type="button" onclick="window.switchTemplatesTab('inspections')"
                    class="px-5 py-3 font-bold uppercase text-label-lg transition-all flex items-center gap-2 border-b-2 cursor-pointer ${isInspections ? 'border-primary text-primary bg-primary/5 rounded-t-xl' : 'border-transparent text-on-surface-variant hover:text-on-surface'}">
                    <span class="material-symbols-outlined text-[20px]">assignment</span>
                    MODELOS DE INSPEÇÃO (CHECKLISTS)
                    <span class="bg-surface-container-high px-2 py-0.5 rounded-full text-label-sm font-bold">${templates.length}</span>
                </button>
                <button type="button" onclick="window.switchTemplatesTab('assets')"
                    class="px-5 py-3 font-bold uppercase text-label-lg transition-all flex items-center gap-2 border-b-2 cursor-pointer ${!isInspections ? 'border-primary text-primary bg-primary/5 rounded-t-xl' : 'border-transparent text-on-surface-variant hover:text-on-surface'}">
                    <span class="material-symbols-outlined text-[20px]">precision_manufacturing</span>
                    MODELOS DE ATIVOS (EQUIPAMENTOS)
                    <span class="bg-surface-container-high px-2 py-0.5 rounded-full text-label-sm font-bold">${assetTemplates.length}</span>
                </button>
                <button type="button" onclick="${isInspections ? 'window.openTemplateModal(event)' : 'window.openAssetTemplateModal(event)'}"
                    class="p-2 text-on-surface hover:bg-surface-container-high rounded-xl font-bold flex items-center justify-center ml-2 transition-colors cursor-pointer"
                    title="${isInspections ? 'Novo Modelo de Inspeção' : 'Novo Modelo de Ativo'}">
                    <span class="material-symbols-outlined text-[22px]">add</span>
                </button>
            </div>
        </div>

        <div class="bg-surface border border-outline shadow-md rounded-xl overflow-hidden mt-stack_md">
            <div class="overflow-x-auto">
                <table class="w-full text-left border-collapse">
                    <thead class="bg-surface-container border-b border-outline">
                        <tr>
                            <th class="px-card_padding py-stack_md text-label-md font-bold text-on-surface-variant uppercase tracking-wider">NOME DO MODELO</th>
                            <th class="px-card_padding py-stack_md text-label-md font-bold text-on-surface-variant uppercase tracking-wider">ESTRUTURA</th>
                            <th class="px-card_padding py-stack_md text-label-md font-bold text-on-surface-variant uppercase tracking-wider">CRIADO EM</th>
                            <th class="px-card_padding py-stack_md text-label-md font-bold text-on-surface-variant uppercase tracking-wider">ÚLTIMA ALTERAÇÃO</th>
                            <th class="px-card_padding py-stack_md text-label-md font-bold text-on-surface-variant uppercase tracking-wider text-right">AÇÕES</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-outline">
                        ${isInspections ? inspectionsTableRowsHtml : assetTableRowsHtml}
                    </tbody>
                </table>
            </div>
        </div>
    `;
}


/**
 * Abre o modal de criação ou edição de modelo
 */
export function openTemplateModal(templateId = null) {
    const modal = document.getElementById('template-editor-modal');
    if (!modal) return;

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

    renderModalEditorContent();
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
        items: [
            {
                id: null,
                nome: '',
                checklists: [
                    { id: null, descricao: '' }
                ]
            }
        ]
    };
}

/**
 * Renderiza o formulário interativo do modal editor
 */
function renderModalEditorContent() {
    const titleEl = document.getElementById('template-modal-title');
    const bodyEl = document.getElementById('template-modal-body');
    const nameInput = document.getElementById('template-name-input');

    if (titleEl) {
        titleEl.innerText = draftTemplate && draftTemplate.id ? 'EDITAR MODELO' : 'CRIAR NOVO MODELO';
    }

    if (nameInput) {
        nameInput.value = draftTemplate ? draftTemplate.nome || '' : '';
    }

    if (!bodyEl) return;

    const items = (draftTemplate && draftTemplate.items) || [];

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
                    <label class="inline-flex items-center gap-2 cursor-pointer group bg-surface px-3 py-1.5 rounded-lg border border-outline hover:border-primary transition-all">
                        <input type="checkbox"
                            id="toggle-special-${itemIdx}"
                            ${isChecked ? 'checked' : ''}
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
                    <label class="inline-flex items-center gap-2 cursor-pointer group bg-surface px-3 py-1.5 rounded-lg border border-outline hover:border-primary transition-all">
                        <input type="checkbox"
                            id="toggle-special-${itemIdx}"
                            ${isChecked ? 'checked' : ''}
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
            <div class="flex items-center justify-between gap-3 py-2 border-b border-outline-variant/30 last:border-b-0 hover:bg-surface-container-low/40 px-2 rounded-lg transition-all group">
                <div class="flex items-center gap-3 flex-1 min-w-[200px]">
                    <div class="w-4.5 h-4.5 border-2 border-outline-variant rounded flex items-center justify-center text-on-surface-variant/40 shrink-0 select-none">
                    </div>
                    <input type="text"
                        id="chk-desc-${itemIdx}-${chkIdx}"
                        value="${escapeHTML(chk.descricao || '')}"
                        onchange="window.updateDraftChecklist(${itemIdx}, ${chkIdx}, this.value)"
                        oninput="window.updateDraftChecklist(${itemIdx}, ${chkIdx}, this.value)"
                        placeholder="Descrição da verificação (ex: ALINHAMENTO E NIVELAMENTO)"
                        class="w-full bg-transparent text-body-md font-bold uppercase text-on-surface hover:bg-surface-container-low focus:bg-surface-container-low focus:ring-1 focus:ring-primary border border-transparent hover:border-outline rounded-md py-1 px-2 outline-none transition-all">
                </div>

                <div class="flex items-center gap-4 shrink-0">
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
                    </div>
                </div>
            </div>
        `).join('');

        return `
        <div class="bg-surface border border-outline-variant rounded-2xl p-card_padding space-y-stack_md shadow-xs">
            <!-- Cabeçalho da Seção com Número Amarelo e Ações -->
            <div class="border-b border-outline-variant/60 pb-3 flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-3 flex-1 min-w-[280px]">
                    <div class="w-5 h-5 border-2 border-outline-variant rounded flex items-center justify-center text-on-surface-variant/40 shrink-0 select-none">
                    </div>
                    <span class="text-primary font-bold text-headline-md shrink-0">${itemIdx + 1}</span>
                    <input type="text"
                        id="item-nome-${itemIdx}"
                        value="${escapeHTML(cleanName || rawName)}"
                        onchange="window.updateDraftItemName(${itemIdx}, this.value)"
                        oninput="window.updateDraftItemName(${itemIdx}, this.value)"
                        placeholder="NOME DO ITEM (EX: SISTEMA DE ALIMENTAÇÃO DA PONTE ROLANTE)"
                        class="w-full bg-transparent font-bold text-headline-md uppercase text-on-surface hover:bg-surface-container-low focus:bg-surface-container-low focus:ring-2 focus:ring-primary focus:border-primary border border-transparent hover:border-outline rounded-lg py-1 px-2.5 outline-none transition-all">
                </div>

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
                </div>
            </div>

            <!-- Lista de Verificações no Padrão do Formulário -->
            <div class="space-y-1">
                ${checklistsHtml}
            </div>

            <!-- Botão Adicionar Verificação no Formato Padrão -->
            <div>
                <button type="button" onclick="window.addDraftChecklist(${itemIdx})"
                    class="text-label-md font-bold text-secondary hover:text-secondary-container hover:underline uppercase flex items-center gap-1 py-1 cursor-pointer transition-colors">
                    <span class="material-symbols-outlined text-[18px]">add_circle</span>
                    + ADICIONAR VERIFICAÇÃO
                </button>
            </div>

            <!-- Tabela Técnica Opcional -->
            ${specialTableControlHtml}

            <!-- Rodapé da Seção com Observação Padrão e Fotos (Sem lixeira) -->
            <div class="space-y-2 pt-2 border-t border-outline-variant/30">
                <div class="flex justify-end gap-2">
                    <button type="button" class="w-9 h-9 border border-outline bg-surface-container-low text-on-surface-variant hover:text-green-600 rounded-xl flex items-center justify-center transition-all cursor-pointer" title="Anexar Fotos">
                        <span class="material-symbols-outlined text-[20px]">add_a_photo</span>
                    </button>
                </div>
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
                        <div class="flex justify-end gap-2">
                            <button type="button" onclick="window.removeDraftObservationBlock(${itemIdx}, ${oIdx})" class="w-9 h-9 border border-outline bg-surface-container-low text-error hover:bg-error/10 rounded-xl flex items-center justify-center transition-all cursor-pointer" title="Excluir Observação Adicional">
                                <span class="material-symbols-outlined text-[20px]">delete</span>
                            </button>
                            <button type="button" class="w-9 h-9 border border-outline bg-surface-container-low text-on-surface-variant hover:text-green-600 rounded-xl flex items-center justify-center transition-all cursor-pointer" title="Anexar Fotos">
                                <span class="material-symbols-outlined text-[20px]">add_a_photo</span>
                            </button>
                        </div>
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
            ${itemsHtml}

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
            </div>
        </div>
    `;
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
            openTemplateModal(id);
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
            openAssetTemplateModal(id);
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

            const confirmMsg = `Excluir o modelo de ativo "${template.nome}"?\n\nEssa ação excluirá o modelo, mas não alterará ativos existentes cadastrados com este modelo.`;
            if (confirm(confirmMsg)) {
                try {
                    await deleteAssetTemplate(id);
                    window.showAlert('Modelo de ativo excluído com sucesso.', 'success');
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

export function openAssetTemplateModal(templateId = null) {
    const modal = document.getElementById('asset-template-editor-modal');
    if (!modal) return;

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

    renderAssetModalContent();
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

    if (titleEl) {
        titleEl.innerText = draftAssetTemplate && draftAssetTemplate.id ? 'EDITAR MODELO DE ATIVO' : 'CRIAR MODELO DE ATIVO';
    }
    if (nameInput) {
        nameInput.value = (draftAssetTemplate && draftAssetTemplate.nome) || '';
    }
    if (tipoInput) {
        tipoInput.value = (draftAssetTemplate && draftAssetTemplate.tipoEquipamento) || '';
    }

    if (!container) return;
    container.innerHTML = '';

    const fields = (draftAssetTemplate && draftAssetTemplate.customFields) || [];
    fields.forEach((f, idx) => {
        container.appendChild(createAssetFieldRowElement(f, idx));
    });
}

function createAssetFieldRowElement(field, idx) {
    const row = document.createElement('div');
    row.className = 'asset-field-row bg-surface-container/60 p-3 rounded-xl border border-outline-variant grid grid-cols-12 gap-3 items-center';
    row.innerHTML = `
        <div class="col-span-7">
            <label class="text-label-sm text-on-surface-variant uppercase font-bold">RÓTULO DO CAMPO *</label>
            <input type="text" class="field-label w-full bg-surface-container-low border border-outline rounded-xl py-2 px-3 text-body-md font-bold uppercase text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all" placeholder="EX: TIPO DE FREIO" value="${escapeHTML(field.label || '')}">
        </div>
        <div class="col-span-3">
            <label class="text-label-sm text-on-surface-variant uppercase font-bold">TIPO</label>
            <select class="field-type w-full bg-surface-container-low border border-outline rounded-xl py-2 px-3 text-body-md font-bold uppercase text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all">
                <option value="text" ${field.type === 'text' ? 'selected' : ''}>TEXTO</option>
                <option value="number" ${field.type === 'number' ? 'selected' : ''}>NÚMERO</option>
                <option value="date" ${field.type === 'date' ? 'selected' : ''}>DATA</option>
            </select>
        </div>
        <div class="col-span-2 flex items-center justify-end gap-1.5 pt-4">
            <button type="button" onclick="window.moveAssetTemplateFieldUp(this)" class="p-1.5 rounded-lg border border-outline hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all cursor-pointer" title="Mover para cima">
                <span class="material-symbols-outlined text-[18px]">arrow_upward</span>
            </button>
            <button type="button" onclick="window.moveAssetTemplateFieldDown(this)" class="p-1.5 rounded-lg border border-outline hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface transition-all cursor-pointer" title="Mover para baixo">
                <span class="material-symbols-outlined text-[18px]">arrow_downward</span>
            </button>
            <button type="button" onclick="window.removeAssetTemplateFieldRow(this)" class="p-1.5 rounded-lg text-error hover:bg-error/10 hover:border-error transition-all cursor-pointer" title="Remover Campo">
                <span class="material-symbols-outlined text-[20px]">delete</span>
            </button>
        </div>
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
 * Popula qualquer select de modelo de ativo
 */
export function populateAssetTemplateDropdown(selectEl, selectedId = null) {
    if (!selectEl) return;
    const list = getAssetTemplates() || [];

    let html = `<option value="">PONTE ROLANTE VIGA DUPLA</option>`;
    list.forEach(tpl => {
        const isSel = selectedId && String(tpl.id) === String(selectedId) ? 'selected' : '';
        html += `<option value="${tpl.id}" ${isSel}>${escapeHTML(tpl.nome.toUpperCase())}</option>`;
    });

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

    const modal = document.getElementById('corretiva-items-modal');
    const panel = document.getElementById('corretiva-items-panel');
    const overlay = document.getElementById('corretiva-items-overlay');
    const searchInput = document.getElementById('corretiva-items-search-input');
    const subtitleEl = document.getElementById('corretiva-modal-subtitle');

    if (searchInput) searchInput.value = '';
    if (subtitleEl) {
        const assetName = context.equipamentoNome || context.equipamentoId || 'ATIVO';
        const baseName = templateName || 'PONTE ROLANTE VIGA DUPLA';
        subtitleEl.innerText = `ATIVO: ${assetName.toUpperCase()} — BASE: ${baseName.toUpperCase()}`;
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

export function renderCorretivaItemsTree(searchTerm = '') {
    const container = document.getElementById('corretiva-items-tree-container');
    if (!container) return;

    const schemaToUse = currentCorretivaBaseSchema || CHECKLIST_SCHEMA;
    const sections = getHierarchyDefaultTree(schemaToUse);
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
        updateCorretivaItemsCount();
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

    container.innerHTML = html;
    updateCorretivaItemsCount();
}

export function updateCorretivaItemsCount() {
    const counterEl = document.getElementById('corretiva-selected-counter');
    const confirmBtn = document.getElementById('corretiva-confirm-btn');
    if (!counterEl && !confirmBtn) return;

    const checkedItems = document.querySelectorAll('#corretiva-items-tree-container input.corretiva-chk-item:checked');
    const count = checkedItems.length;

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
    updateCorretivaItemsCount();
}

export function onCorretivaSearchInput(term) {
    renderCorretivaItemsTree(term);
}

export function confirmCorretivaChecklist() {
    const checkedItems = Array.from(document.querySelectorAll('#corretiva-items-tree-container input.corretiva-chk-item:checked'));
    if (checkedItems.length === 0) {
        return window.showAlert('SELECIONE AO MENOS 1 ITEM PARA INICIAR A INSPEÇÃO CORRETIVA.', 'warning');
    }

    const selectedIdsSet = new Set(checkedItems.map(chk => String(chk.dataset.nodeId)));
    const baseSchema = currentCorretivaBaseSchema || CHECKLIST_SCHEMA;
    const filteredSchema = filterSchemaForCorretiva(baseSchema, selectedIdsSet);

    if (!filteredSchema || filteredSchema.length === 0) {
        return window.showAlert('ERRO AO PROCESSAR OS ITENS SELECIONADOS. POR FAVOR, SELECIONE NOVAMENTE.', 'warning');
    }

    const ctx = currentCorretivaContext;
    closeCorretivaItemsModal();

    if (typeof window !== 'undefined' && window.launchInspectionWithSchema) {
        window.launchInspectionWithSchema(ctx, filteredSchema);
    }
}

// Binds globais para o modal de inspeção corretiva
if (typeof window !== 'undefined') {
    window.openCorretivaItemsPicker = openCorretivaItemsPicker;
    window.closeCorretivaItemsModal = closeCorretivaItemsModal;
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
