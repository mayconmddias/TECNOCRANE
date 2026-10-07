import { companies, allAssetsList, getStoredData, setStoredData, usersList, setUsersList, setAllAssetsList, setCompanies, loadAllDataFromDB, getDBValue, updateArrayInPlace, deleteUserFromCloud, deleteCompanyFromCloud, deleteCompanyAssetsFromCloud, deleteCompanyAllDataFromCloud, deleteAssetFromCloud, deleteOrderFromCloud, deleteReportFromCloud, deleteEventFromCloud, openOrders, setOpenOrders, finalizedReports, setFinalizedReports, syncAllFromSupabase, syncKeyToSupabase, eventsList } from './data.js';
import { monthsMap, monthNames, parseAssetDate, formatDateToDisplay, hashPassword, formatShortName } from './utils.js';
import { renderCompanies as renderCompaniesUI, renderAssetsTable } from './ui-render.js';
import { renderObservationBlock, renderNode, renderCustomChecklistItemRow, renderResponsibleCard } from './checklist-render.js';
import { mountChecklistForm, getFormRoot, collectFormData } from './checklist-ui.js';
import { createInspectionDocument, validateBeforeSend, mergeLegacyReport } from './checklist-state.js';
import { acquireLock, releaseLock, getCurrentUser, setCurrentUser } from './locks.js';
import { getTenantCode, isSupabaseConfigured } from './supabase.js';
import { CHECKLIST_SCHEMA } from './checklist-schema.js';
import { showPrintLoadingOverlay, hidePrintLoadingOverlay, collectAllReportImageUrls, preloadImageUrls, printReportPDF, getChecklistPrintHTML } from './modules/reports/reports-pdf.js';
import { filterReports, formatReportNumber, normalizeComp as normCompReports, normalizeAssetId as normAssetReports } from './modules/reports/reports-service.js';
import { renderTemplatesView, populateAssetTemplateDropdown, openCorretivaItemsPicker } from './modules/templates/templates-ui.js';
import { getTemplates, getTemplateById, convertTemplateToChecklistSchema, loadTemplates, getAssetTemplates, getAssetTemplateById, loadAssetTemplates } from './modules/templates/templates-module.js';
import { reserveNextAssetId, prepareAssetPayload, parseAssetSequenceNumber } from './modules/assets/assets-service.js';
import { generateNextOrderId, saveDraftOrder, deleteDraftOrder, saveFastLocalDraft, getFastLocalDraft, clearFastLocalDraft } from './modules/orders/orders-service.js';

window.hidePrintLoadingOverlay = hidePrintLoadingOverlay;
window.getChecklistPrintHTML = getChecklistPrintHTML;
window.allAssetsList = allAssetsList;
window.companies = companies;

console.log('CRANE PRO: Iniciando carregamento do módulo app.js...');

// --- GLOBAL FUNCTIONS (EXPOSED TO WINDOW) ---
// --- GLOBAL STATE ---

const today = new Date();
today.setHours(0, 0, 0, 0);
let assets = getStoredData('crane_assets', []);
let events = eventsList;

function runMigrationsAndSync() {
    // Recupera o ativo #EQP-0001 original da AUTOKINITON caso tenha sido acidentalmente sobrescrito
    const hasEqp1 = allAssetsList.find(a => a && (a.id === '#EQP-0001' || a.id === '#EQP 0001'));
    if (hasEqp1 && (hasEqp1.tipo === 'TALHA MANUAL' || hasEqp1.empresa !== 'AUTOKINITON')) {
        const originalAutokiniton = {
            id: '#EQP-0001',
            empresa: 'AUTOKINITON',
            nome: 'PONTE ROLANTE VIGA DUPLA',
            tipo: 'PONTE ROLANTE VIGA DUPLA',
            local: 'ARMAZEM A',
            fabricante: 'TECNOCRANE',
            capacidade: '32 TON',
            caboPrincipal: '',
            capacidadeAuxiliar: '',
            caboAuxiliar: '',
            altura: '13 MTS',
            vao: '19.730 MTS',
            tensaoAlimentacao: '',
            tensaoComando: '',
            alimentacaoEquipamento: '',
            motorElevPrincipalAlta: '',
            motorElevPrincipalBaixa: '',
            motorElevAuxiliarAlta: '',
            motorElevAuxiliarBaixa: '',
            motorDirecaoCarro: '',
            motorTranslacaoPonte: '',
            template_id: null,
            template_name: null,
            schema_snapshot: null,
            custom_fields: {},
            is_provisional: false,
            provisional_id: null,
            sync_status: 'synced'
        };

        const reallocated = { ...hasEqp1, id: '#EQP-0004' };
        const updated = allAssetsList.filter(a => a.id !== hasEqp1.id);
        updated.unshift(originalAutokiniton);
        updated.push(reallocated);
        setAllAssetsList(updated);
    }

    // Migração dos ativos no localStorage para corresponder às especificações da nova lista técnica
    assets = assets.map(a => {
        const matchingTechnicalAsset = allAssetsList.find(ta => ta.id === a.id);
        if (matchingTechnicalAsset) {
            return {
                ...a,
                empresa: matchingTechnicalAsset.empresa,
                tipo: matchingTechnicalAsset.tipo,
                local: matchingTechnicalAsset.local
            };
        }
        return a;
    });

    setStoredData('crane_assets', assets);

    // Atualiza eventos garantindo que tipo e local sejam enriquecidos a partir do cadastro tecnico allAssetsList
    if (events && events.length > 0) {
        const enrichedEvents = events.map(e => {
            const ta = allAssetsList.find(a => a.id === e.equipamento || a.id === e.id);
            return {
                ...e,
                tipo: (e.tipo && e.tipo !== 'N/A') ? e.tipo : (ta ? (ta.tipo || ta.nome || 'N/A') : 'N/A'),
                local: (e.local && e.local !== 'SETOR OPERACIONAL') ? e.local : (ta ? (ta.local || 'SETOR OPERACIONAL') : 'SETOR OPERACIONAL')
            };
        });
        updateArrayInPlace(events, enrichedEvents);
        setStoredData('crane_events', events);
    }

    // Migração das ordens de serviço e relatórios no localStorage para usar os novos tipos
    updateArrayInPlace(openOrders, openOrders.map(order => {
        const matchingTechnicalAsset = allAssetsList.find(ta => ta.id === order.equipamentoId || ta.id === order.equipamento);
        if (matchingTechnicalAsset) {
            return {
                ...order,
                empresa: matchingTechnicalAsset.empresa,
                equipamentoNome: matchingTechnicalAsset.nome,
                equipamento: matchingTechnicalAsset.nome,
                tipo: matchingTechnicalAsset.tipo,
                assetInfo: `${matchingTechnicalAsset.nome} — ${matchingTechnicalAsset.empresa}`
            };
        }
        return order;
    }));
    setStoredData('crane_open_orders', openOrders);

    updateArrayInPlace(finalizedReports, finalizedReports.map(report => {
        const matchingTechnicalAsset = allAssetsList.find(ta => ta.id === report.equipamentoId || ta.id === report.equipamento);
        if (matchingTechnicalAsset) {
            return {
                ...report,
                empresa: matchingTechnicalAsset.empresa,
                equipamentoNome: matchingTechnicalAsset.nome,
                equipamento: matchingTechnicalAsset.nome,
                tipo: matchingTechnicalAsset.tipo,
                assetInfo: `${matchingTechnicalAsset.nome} — ${matchingTechnicalAsset.empresa}`
            };
        }
        return report;
    }));

}

// Executa as migrações iniciais síncronas usando o cache do localStorage
runMigrationsAndSync();

function formatDateFromDate(d) {
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}
let selectedCompany = companies.length > 0 ? (typeof companies[0] === 'string' ? companies[0] : companies[0].name) : "";
let isGlobalFilterActive = true;
let currentView = 'dashboard';
let editingOrderId = null;
let reportToDelete = null;
let filterMonthOffset = 0;
let currentViewDate = new Date();

let currentChecklistContext = null;

// --- HELPERS ---

function getCompanyColor(empresa) {
    const colors = [
        { color: 'border-blue-600 bg-blue-50/50', textColor: 'text-blue-900' },
        { color: 'border-emerald-600 bg-emerald-50/50', textColor: 'text-emerald-900' },
        { color: 'border-amber-600 bg-amber-50/50', textColor: 'text-amber-900' },
        { color: 'border-purple-600 bg-purple-50/50', textColor: 'text-purple-900' },
        { color: 'border-cyan-600 bg-cyan-50/50', textColor: 'text-cyan-900' },
        { color: 'border-indigo-600 bg-indigo-50/50', textColor: 'text-indigo-900' },
        { color: 'border-orange-600 bg-orange-50/50', textColor: 'text-orange-900' },
        { color: 'border-teal-600 bg-teal-50/50', textColor: 'text-teal-900' },
        { color: 'border-fuchsia-600 bg-fuchsia-50/50', textColor: 'text-fuchsia-900' },
        { color: 'border-sky-600 bg-sky-50/50', textColor: 'text-sky-900' }
    ];
    let hash = 0;
    const str = String(empresa || '').toUpperCase();
    for (let i = 0; i < str.length; i++) {
        hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % colors.length;
    return colors[index];
}

function formatDate(days) {
    const d = new Date();
    d.setDate(new Date().getDate() + days);
    const day = String(d.getDate()).padStart(2, '0');
    const months = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
    return `${day}/${months[d.getMonth()]}/${d.getFullYear()}`;
}

function saveAssets() {
    setStoredData('crane_assets', assets);
}

// --- UI RENDERERS ---

function renderCompanies() {
    renderCompaniesUI('companies-tbody', companies, selectedCompany, (company) => {
        selectedCompany = company;
        isGlobalFilterActive = false;
        const btn = document.getElementById('filter-toggle-btn');
        if (btn) {
            btn.classList.remove('text-error');
            btn.classList.add('text-zinc-400');
        }
        renderCompanies();
        renderAssets();
    });
}
window.renderCompanies = renderCompanies;


// --- TOGGLE VISIBILIDADE DO CALENDÁRIO OPERACIONAL ---
window.toggleCalendarVisibility = function(isVisible) {
    const calendarSection = document.getElementById('calendar-card-section');
    const assetsCardSection = document.getElementById('operational-assets-card-section');
    const checkbox = document.getElementById('toggle-calendar-checkbox');

    if (checkbox && checkbox.checked !== isVisible) {
        checkbox.checked = isVisible;
    }

    if (calendarSection) {
        if (isVisible) {
            calendarSection.classList.remove('hidden');
        } else {
            calendarSection.classList.add('hidden');
        }
    }

    if (assetsCardSection) {
        if (isVisible) {
            assetsCardSection.classList.remove('max-h-[calc(100vh-140px)]');
            assetsCardSection.classList.add('max-h-[calc(100vh-420px)]');
        } else {
            assetsCardSection.classList.remove('max-h-[calc(100vh-420px)]');
            assetsCardSection.classList.add('max-h-[calc(100vh-140px)]');
        }
    }

    try {
        localStorage.setItem('crane_show_operational_calendar', isVisible ? 'true' : 'false');
    } catch (e) {}
};

window.initCalendarVisibility = function() {
    try {
        const saved = localStorage.getItem('crane_show_operational_calendar');
        const isVisible = saved === null ? true : saved === 'true';
        window.toggleCalendarVisibility(isVisible);
    } catch (e) {
        window.toggleCalendarVisibility(true);
    }
};

// --- VIEW NAVIGATION ---

window.switchView = function(view) {
    // Inspeção abre popup, não troca de view
    if (view === 'inspections') {
        window.openInspecaoModal();
        return;
    }
    if (view === 'calendar') view = 'dashboard';

    currentView = view;
    const views = {
        dashboard: document.getElementById('dashboard-view'),
        assets: document.getElementById('assets-view'),
        users: document.getElementById('users-view'),
        'open-orders': document.getElementById('open-orders-view'),
        reports: document.getElementById('reports-view'),
        templates: document.getElementById('templates-view')
    };
    
    const navs = {
        dashboard: document.getElementById('nav-dashboard'),
        assets: document.getElementById('nav-assets'),
        inspections: document.getElementById('nav-inspections'),
        templates: document.getElementById('nav-templates'),
        users: document.getElementById('nav-users'),
        reports: document.getElementById('nav-reports'),
        'open-orders': document.getElementById('nav-open-orders')
    };

    Object.values(views).forEach(v => v?.classList.add('hidden'));
    Object.values(navs).forEach(n => n?.classList.remove('nav-item-active'));

    if (views[view]) views[view].classList.remove('hidden');
    if (navs[view]) navs[view].classList.add('nav-item-active');

    if (view === 'dashboard') {
        renderAssets();
        renderCalendar();
        window.initCalendarVisibility();
    }
    else if (view === 'users') renderUsers();
    else if (view === 'open-orders') renderOpenOrders();
    else if (view === 'reports') renderReportsView();
    else if (view === 'assets') renderAtivosView();
    else if (view === 'templates') renderTemplatesView();

    // Sincroniza dados com o Supabase em segundo plano ao alternar de menu
    if (isSupabaseConfigured) {
        syncAllFromSupabase().then(async () => {
            const dbAssets = await getDBValue('crane_assets', assets);
            updateArrayInPlace(assets, dbAssets);

            const dbEvents = await getDBValue('crane_events', events);
            updateArrayInPlace(events, dbEvents);

            const dbOpenOrders = await getDBValue('crane_open_orders', openOrders);
            updateArrayInPlace(openOrders, dbOpenOrders);

            const dbFinalizedReports = await getDBValue('crane_reports', finalizedReports);
            updateArrayInPlace(finalizedReports, dbFinalizedReports);

            if (currentView === 'dashboard') {
                renderAssets();
                window.renderCalendar();
            }
            else if (currentView === 'users') renderUsers();
            else if (currentView === 'open-orders') renderOpenOrders();
            else if (currentView === 'reports') renderReportsView();
            else if (currentView === 'assets') renderAtivosView();
        }).catch(err => console.warn('Erro ao resincronizar ao alternar de menu:', err));
    }
};

// Resincroniza a tela automaticamente toda vez que o usuário voltar para esta aba do navegador
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && isSupabaseConfigured) {
        if (typeof window.reloadAppDataAndUI === 'function') {
            window.reloadAppDataAndUI().catch(err => console.warn('Erro ao atualizar tela no foco da aba:', err));
        }
    }
});

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('hidden');
    sidebar.classList.toggle('flex');
    overlay.classList.toggle('hidden');
};

window.openInspecaoModalWithTemplate = function(template) {
    window.selectedInspectionTemplate = template;
    window.openInspecaoModal();
};

window.openInspecaoModal = function() {
    const modal = document.getElementById('inspecao-modal');
    const panel = document.getElementById('inspecao-panel');
    const overlay = document.getElementById('inspecao-overlay');
    const empresaSelect = document.getElementById('inspecao-empresa');

    // Popula empresas de forma robusta suportando tanto objetos quanto strings
    if (empresaSelect) {
        const list = companies || [];
        empresaSelect.innerHTML = list.map(c => {
            const name = typeof c === 'string' ? c : (c?.name || "");
            return `<option value="${name}">${name.toUpperCase()}</option>`;
        }).join('');
    }
    window.updateInspecaoEquipments();

    // Popula seleção de modelos imediatamente e atualiza assincronamente
    const modeloSelect = document.getElementById('inspecao-modelo');
    if (modeloSelect) {
        const populateOptions = (list) => {
            let optionsHtml = '<option value="DEFAULT">PONTE ROLANTE VIGA DUPLA</option>';
            optionsHtml += (list || []).map(t => `<option value="${t.id}">${(t.nome || '').toUpperCase()}</option>`).join('');
            modeloSelect.innerHTML = optionsHtml;
            if (window.selectedInspectionTemplate) {
                modeloSelect.value = window.selectedInspectionTemplate.id;
            }
        };

        // 1. População síncrona imediata a partir da memória
        populateOptions(getTemplates());

        // 2. Atualização assíncrona da nuvem
        loadTemplates().then(templates => {
            populateOptions(templates || getTemplates() || []);
            if (window.selectedInspectionTemplate) {
                modeloSelect.value = window.selectedInspectionTemplate.id;
                window.selectedInspectionTemplate = null;
            }
        });
    }

    const tipoVal = document.getElementById('inspecao-tipo')?.value || 'PREVENTIVA';
    window.onInspecaoTipoChange(tipoVal);

    modal.classList.remove('hidden');
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
};

window.onInspecaoTipoChange = function(tipo) {
    const preenchimentoSelect = document.getElementById('inspecao-preenchimento');
    if (!preenchimentoSelect) return;
    if (tipo === 'CORRETIVA') {
        preenchimentoSelect.value = 'ZERO';
        preenchimentoSelect.disabled = true;
        preenchimentoSelect.classList.add('opacity-50', 'cursor-not-allowed', 'bg-surface-container');
    } else {
        preenchimentoSelect.disabled = false;
        preenchimentoSelect.classList.remove('opacity-50', 'cursor-not-allowed', 'bg-surface-container');
    }
};

window.closeInspecaoModal = function() {
    const modal = document.getElementById('inspecao-modal');
    const panel = document.getElementById('inspecao-panel');
    const overlay = document.getElementById('inspecao-overlay');
    panel.classList.remove('opacity-100', 'scale-100');
    panel.classList.add('opacity-0', 'scale-95');
    overlay.classList.remove('opacity-100');
    overlay.classList.add('opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

let pendingImportContext = null;
let pendingImportSchema = null;
let pendingImportLastReport = null;

window.openImportLastInspectionModal = function(context, schema, lastReport) {
    pendingImportContext = context;
    pendingImportSchema = schema;
    pendingImportLastReport = lastReport;

    const modal = document.getElementById('import-last-inspection-modal');
    const panel = document.getElementById('import-last-inspection-panel');
    const overlay = document.getElementById('import-last-inspection-overlay');

    const chkChecklist = document.getElementById('import-chk-checklist');
    const chkObs = document.getElementById('import-chk-obs');
    const chkFotos = document.getElementById('import-chk-fotos');
    if (chkChecklist) chkChecklist.checked = true;
    if (chkObs) chkObs.checked = true;
    if (chkFotos) chkFotos.checked = true;

    modal?.classList.remove('hidden');
    setTimeout(() => {
        overlay?.classList.remove('opacity-0');
        overlay?.classList.add('opacity-100');
        panel?.classList.remove('opacity-0', 'scale-95');
        panel?.classList.add('opacity-100', 'scale-100');
    }, 10);
};

window.closeImportLastInspectionModal = function() {
    const modal = document.getElementById('import-last-inspection-modal');
    const panel = document.getElementById('import-last-inspection-panel');
    const overlay = document.getElementById('import-last-inspection-overlay');
    panel?.classList.remove('opacity-100', 'scale-100');
    panel?.classList.add('opacity-0', 'scale-95');
    overlay?.classList.remove('opacity-100');
    overlay?.classList.add('opacity-0');
    setTimeout(() => modal?.classList.add('hidden'), 300);
};

window.confirmImportLastInspection = function() {
    if (!pendingImportContext || !pendingImportLastReport) {
        window.closeImportLastInspectionModal();
        return;
    }

    const importChecklist = document.getElementById('import-chk-checklist')?.checked ?? false;
    const importObs = document.getElementById('import-chk-obs')?.checked ?? false;
    const importFotos = document.getElementById('import-chk-fotos')?.checked ?? false;

    const lastReport = pendingImportLastReport;
    const savedDoc = JSON.parse(JSON.stringify(lastReport));
    savedDoc.id = null;
    savedDoc.status = 'DRAFT';
    savedDoc.createdAt = new Date().toISOString();
    savedDoc.updatedAt = new Date().toISOString();
    savedDoc.generalImages = importFotos ? (Array.isArray(lastReport.generalImages) ? [...lastReport.generalImages] : []) : [];
    savedDoc.generalObservation = importObs ? (lastReport.generalObservation || '') : '';

    if (savedDoc.responses) {
        Object.keys(savedDoc.responses).forEach(key => {
            const lastResp = lastReport.responses?.[key] || {};
            const resp = savedDoc.responses[key] || {};

            // 1. Status do checklist
            resp.status = importChecklist ? (lastResp.status ?? null) : null;

            // 2. Observações
            if (importObs) {
                resp.observation = lastResp.observation || '';
                resp.additionalObservations = Array.isArray(lastResp.additionalObservations)
                    ? lastResp.additionalObservations.map(obs => ({
                        observation: obs.observation || '',
                        images: importFotos ? (Array.isArray(obs.images) ? [...obs.images] : []) : []
                    }))
                    : [];
            } else {
                resp.observation = '';
                resp.additionalObservations = [];
            }

            // 3. Fotos
            if (importFotos) {
                resp.images = Array.isArray(lastResp.images) ? [...lastResp.images] : [];
            } else {
                resp.images = [];
            }
        });
    }

    const context = pendingImportContext;
    const schema = pendingImportSchema;

    window.closeImportLastInspectionModal();
    window.launchInspectionWithSchema(context, schema, savedDoc);
};

window.updateInspecaoEquipments = function() {
    const company = document.getElementById('inspecao-empresa')?.value;
    const equipSelect = document.getElementById('inspecao-equipamento');
    if (!equipSelect) return;
    const list = allAssetsList || [];
    const filtered = list
        .filter(a => a && a.empresa && company && a.empresa.toLowerCase() === company.toLowerCase())
        .sort((a, b) => (a.id || '').localeCompare(b.id || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
    if (filtered.length > 0) {
        equipSelect.innerHTML = filtered.map(a =>
            `<option value="${a.id}">${a.id} - ${(a.nome || a.id).toUpperCase()}</option>`
        ).join('');
    } else {
        equipSelect.innerHTML = '<option value="">NENHUM ATIVO ENCONTRADO</option>';
    }
};

window.startChecklist = function() {
    const empresa = document.getElementById('inspecao-empresa')?.value;
    const equipamentoId = document.getElementById('inspecao-equipamento')?.value;
    const tipo = document.getElementById('inspecao-tipo')?.value || 'PREVENTIVA';
    const modeloId = document.getElementById('inspecao-modelo')?.value;
    const preenchimento = document.getElementById('inspecao-preenchimento')?.value;

    if (!empresa || !equipamentoId) {
        return window.showAlert('SELECIONE EMPRESA E ATIVO PARA INICIAR.', 'warning');
    }

    let customSchema = null;
    let templateId = null;
    let templateName = null;
    if (modeloId && modeloId !== 'DEFAULT') {
        templateId = modeloId;
        const tpl = getTemplateById(modeloId);
        if (tpl) {
            templateName = tpl.nome;
            customSchema = convertTemplateToChecklistSchema(tpl);
            if (!customSchema || customSchema.length === 0) {
                return window.showAlert('O MODELO SELECIONADO NÃO POSSUI ITENS DE VERIFICAÇÃO CADASTRADOS. EDITE O MODELO OU SELECIONE OUTRO.', 'warning');
            }
        }
    }
    if (!customSchema || customSchema.length === 0) {
        customSchema = CHECKLIST_SCHEMA;
        templateName = 'PONTE ROLANTE VIGA DUPLA';
    }

    const asset = allAssetsList.find(a => a.id === equipamentoId);
    const equipamentoNome = asset ? (asset.nome || asset.id) : equipamentoId;

    const context = {
        tipo,
        empresa,
        equipamentoId,
        equipamentoNome,
        assetInfo: `${equipamentoNome} — ${empresa}`,
        templateId,
        templateName,
        preenchimento
    };

    if (tipo === 'CORRETIVA') {
        window.closeInspecaoModal();
        openCorretivaItemsPicker(context, customSchema, templateName);
        return;
    }

    if (tipo === 'PREVENTIVA' && preenchimento === 'ULTIMA') {
        const matchingReports = (finalizedReports || []).filter(r => r.equipamentoId === equipamentoId || r.equipamento === equipamentoId);
        if (matchingReports.length > 0) {
            matchingReports.sort((a, b) => {
                const dateA = new Date(a.createdAt || a.updatedAt || parseAssetDate(a.date));
                const dateB = new Date(b.createdAt || b.updatedAt || parseAssetDate(b.date));
                return dateB - dateA;
            });
            const lastReport = matchingReports[0];
            window.closeInspecaoModal();
            window.openImportLastInspectionModal(context, customSchema, lastReport);
            return;
        } else {
            window.showAlert('NENHUMA INSPEÇÃO ANTERIOR ENCONTRADA PARA ESTE ATIVO. INICIANDO DO ZERO.', 'warning');
        }
    }

    window.closeInspecaoModal();
    window.launchInspectionWithSchema(context, customSchema, null);
};

window.launchInspectionWithSchema = function(context, schemaToUse, preloadedSavedDoc = null) {
    const { tipo, empresa, equipamentoId, equipamentoNome, templateId, templateName } = context;
    const schemaSnapshot = JSON.parse(JSON.stringify(schemaToUse || CHECKLIST_SCHEMA));

    openChecklistForm({
        tipo,
        empresa,
        equipamentoId,
        equipamentoNome,
        assetInfo: `${equipamentoNome} — ${empresa}`,
        schema: schemaSnapshot,
        schema_snapshot: schemaSnapshot,
        templateId: templateId,
        templateName: templateName
    }, preloadedSavedDoc);
};

let activeCustomSections = [];
let activeCustomItems = [];
let targetSectionIdForChecklistModal = null;
let isSavingOrSendingChecklist = false;
let currentChecklistLockKey = null;

async function openChecklistForm(context, savedDoc = null) {
    currentChecklistContext = context;
    editingOrderId = savedDoc?.id || null;

    const docId = savedDoc?.id || context?.id;
    if (docId) {
        const lockKey = String(docId).startsWith('ORD-') ? `order:${docId}` : `report:${docId}`;
        const lockRes = await acquireLock(lockKey);
        if (!lockRes.success) {
            window.showAlert(`🔒 REGISTRO EM MODO EDIÇÃO POR "${lockRes.lockedBy.toUpperCase()}". AGUARDE A CONCLUSÃO.`, 'warning');
            return;
        }
        if (currentChecklistLockKey && currentChecklistLockKey !== lockKey) {
            releaseLock(currentChecklistLockKey);
        }
        currentChecklistLockKey = lockKey;
    }

    // Resetar o estado de controle de cliques múltiplos
    isSavingOrSendingChecklist = false;

    const modal = document.getElementById('checklist-modal');
    const panel = document.getElementById('checklist-panel');
    const overlay = document.getElementById('checklist-overlay');
    const saveBtn = document.getElementById('checklist-save-btn');
    const titleEl = document.getElementById('checklist-type-title');
    const infoEl = document.getElementById('checklist-asset-info');
    const formRoot = document.getElementById('checklist-form-root');

    let doc = savedDoc
        ? mergeLegacyReport(savedDoc)
        : createInspectionDocument(context);

    // Se houver um rascunho rápido local na sessão (ex: após F5), restaura os dados preenchidos
    if (doc.id) {
        const fastDraft = getFastLocalDraft(doc.id);
        if (fastDraft && fastDraft.responses && Object.keys(fastDraft.responses).length > 0) {
            doc.responses = { ...doc.responses, ...fastDraft.responses };
            if (fastDraft.generalObservation !== undefined) doc.generalObservation = fastDraft.generalObservation;
            if (fastDraft.generalImages && Array.isArray(fastDraft.generalImages)) doc.generalImages = fastDraft.generalImages;
            if (fastDraft.customSections && Array.isArray(fastDraft.customSections)) doc.customSections = fastDraft.customSections;
            if (fastDraft.customItems && Array.isArray(fastDraft.customItems)) doc.customItems = fastDraft.customItems;
            if (fastDraft.responsaveis && Array.isArray(fastDraft.responsaveis)) doc.responsaveis = fastDraft.responsaveis;
        }
    }

    currentChecklistContext = {
        ...context,
        schema: doc.schema_snapshot || doc.schema,
        schema_snapshot: doc.schema_snapshot || doc.schema,
        templateId: doc.templateId,
        templateName: doc.templateName
    };

    activeCustomSections = doc.customSections || [];
    activeCustomItems = doc.customItems || [];
    window.activeCustomItems = activeCustomItems;

    if (titleEl) titleEl.textContent = doc.type || context.tipo;
    if (infoEl) infoEl.textContent = doc.assetInfo || context.assetInfo;

    // Reabilitar o botão de Salvar Rascunho
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.classList.remove('opacity-50', 'pointer-events-none');
        const isEditingReport = editingOrderId && String(editingOrderId).toUpperCase().startsWith('REL');
        if (isEditingReport) {
            saveBtn.classList.add('hidden');
        } else {
            saveBtn.classList.remove('hidden');
        }
    }

    // Reabilitar o botão de Enviar
    const sendBtn = document.querySelector('button[onclick="window.generateWorkOrder()"]');
    if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.classList.remove('opacity-50', 'pointer-events-none');
    }

    window.usersList = usersList;
    if (formRoot) mountChecklistForm(formRoot, doc);

    modal.classList.remove('hidden');
    setTimeout(() => {
        overlay?.classList.remove('opacity-0');
        overlay?.classList.add('opacity-100');
        panel?.classList.remove('opacity-0', 'translate-x-4');
        panel?.classList.add('opacity-100', 'translate-x-0');
    }, 10);
}

// --- MODALS ---

function populateTechnicianDropdowns(select1Id, select2Id, currentVal1 = '', currentVal2 = '') {
    const s1 = document.getElementById(select1Id);
    const s2 = document.getElementById(select2Id);
    if (!s1 || !s2) return;

    const optionsHTML = `<option value="">SELECIONE...</option>` + 
        (usersList || []).map(u => {
            const shortName = formatShortName(u.name || '');
            return `<option value="${u.name}">${shortName.toUpperCase()}</option>`;
        }).join('');

    s1.innerHTML = optionsHTML;
    s2.innerHTML = optionsHTML;

    if (currentVal1) s1.value = currentVal1;
    if (currentVal2) s2.value = currentVal2;
}

window.openProgModal = function(dateStr) {
    const modal = document.getElementById('prog-modal');
    const panel = document.getElementById('prog-panel');
    const companySelect = document.getElementById('prog-empresa');
    if (companySelect) {
        const list = companies || [];
        companySelect.innerHTML = list.map(c => {
            const name = typeof c === 'string' ? c : (c?.name || "");
            return `<option value="${name}">${name.toUpperCase()}</option>`;
        }).join('');
    }
    window.updateProgEquipments();
    populateTechnicianDropdowns('prog-tecnico-1', 'prog-tecnico-2');
    const dateInput = document.getElementById('prog-date');
    if (dateInput) {
        if (dateStr) dateInput.value = dateStr;
        else dateInput.valueAsDate = new Date();
    }
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        panel.classList.remove('opacity-0', 'scale-95');
        panel.classList.add('opacity-100', 'scale-100');
    }, 10);
};

window.closeProgModal = function() {
    const modal = document.getElementById('prog-modal');
    const panel = document.getElementById('prog-panel');
    panel.classList.add('scale-95', 'opacity-0');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

window.updateProgEquipments = function() {
    const company = document.getElementById('prog-empresa').value;
    const equipSelect = document.getElementById('prog-equipamento');
    const filtered = allAssetsList
        .filter(a => a.empresa && company && a.empresa.toLowerCase() === company.toLowerCase())
        .sort((a, b) => (a.id || '').localeCompare(b.id || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
    equipSelect.innerHTML = filtered.map(a => `<option value="${a.id}">${a.id} - ${a.nome}</option>`).join('');
};

window.saveProgEvent = function() {
    const empresa = document.getElementById('prog-empresa').value;
    const equipamento = document.getElementById('prog-equipamento').value;
    const date = document.getElementById('prog-date').value;
    const recorrencia = parseInt(document.getElementById('prog-recorrencia').value);
    const tec1 = document.getElementById('prog-tecnico-1')?.value || '';
    const tec2 = document.getElementById('prog-tecnico-2')?.value || '';

    if (!empresa || !equipamento || !date) return window.showAlert('POR FAVOR, PREENCHA TODOS OS CAMPOS.', 'warning');

    const selectedTecs = [];
    if (tec1) selectedTecs.push(formatShortName(tec1));
    if (tec2 && tec2 !== tec1) selectedTecs.push(formatShortName(tec2));
    const tecnicoStr = selectedTecs.join(' | ');

    const groupId = Date.now();
    const companyColor = getCompanyColor(empresa);

    const matchingAsset = allAssetsList.find(a => a.id === equipamento);
    const assetTipo = matchingAsset ? (matchingAsset.tipo || matchingAsset.nome || 'N/A') : 'N/A';
    const assetLocal = matchingAsset ? (matchingAsset.local || 'SETOR OPERACIONAL') : 'SETOR OPERACIONAL';

    let startDate = new Date(date + 'T12:00:00');
    for (let i = 0; i < recorrencia; i++) {
        const currentEventDate = new Date(startDate);
        currentEventDate.setMonth(startDate.getMonth() + i);
        const dateStr = currentEventDate.toISOString().split('T')[0];
        
        // Garante ID único baseado no equipamento e na data da programação para evitar que novos agendamentos sobrescrevam anteriores
        const eventId = `${equipamento}-${dateStr}`;

        const eventData = {
            id: eventId,
            groupId: recorrencia > 1 ? groupId : null,
            empresa, equipamento,
            tipo: assetTipo,
            local: assetLocal,
            date: dateStr,
            tecnico: tecnicoStr,
            tecnicos: selectedTecs,
            color: companyColor.color, textColor: companyColor.textColor, status: 'PENDENTE'
        };

        const existingIdx = events.findIndex(e => e.id === eventId);
        if (existingIdx !== -1) {
            events[existingIdx] = eventData;
        } else {
            events.push(eventData);
        }
    }
    setStoredData('crane_events', events);
    window.closeProgModal();
    renderCalendar();
    renderAssets();
};

let currentEventLockKey = null;

window.openEditModal = async function(eventOrId, id) {
    const eventId = (typeof eventOrId === 'object' && eventOrId !== null) ? id : eventOrId;
    if (typeof eventOrId === 'object' && eventOrId !== null && eventOrId.stopPropagation) eventOrId.stopPropagation();

    let event = events.find(e => e.id == eventId);
    if (!event) {
        const asset = assets.find(a => a.id == eventId);
        if (asset) {
            event = {
                id: asset.id,
                empresa: asset.empresa,
                tipo: asset.tipo || asset.nome || "N/A",
                equipamento: asset.id,
                date: asset.data.includes('/') || asset.data.includes('-') 
                    ? parseAssetDate(asset.data).toISOString().split('T')[0]
                    : asset.data,
                status: asset.status || 'PENDENTE',
                justificativa: asset.justificativa || ''
            };
        }
    }

    if (!event) return;

    const lockKey = `event:${event.id}`;
    const lockRes = await acquireLock(lockKey);
    if (!lockRes.success) {
        window.showAlert(`🔒 REGISTRO EM MODO EDIÇÃO POR "${lockRes.lockedBy.toUpperCase()}". AGUARDE A CONCLUSÃO.`, 'warning');
        return;
    }
    if (currentEventLockKey && currentEventLockKey !== lockKey) {
        releaseLock(currentEventLockKey);
    }
    currentEventLockKey = lockKey;

    // Identifica o equipamento limpo (ex: #EQP-0001) e busca dados de cadastro
    let rawEquip = event.equipamento;
    if (!rawEquip && event.id) {
        rawEquip = event.id.includes('-20') ? event.id.substring(0, event.id.lastIndexOf('-20')) : event.id;
    }
    
    const assetObj = allAssetsList.find(a => a && (
        String(a.id).trim().toUpperCase() === String(rawEquip).trim().toUpperCase() ||
        String(a.id).trim().toUpperCase() === String(event.id).trim().toUpperCase() ||
        String(a.id).trim().toUpperCase() === String(event.equipamento).trim().toUpperCase()
    ));

    const cleanEquipId = (assetObj && assetObj.id) ? assetObj.id : (rawEquip || event.id);
    const empresaName = (event && event.empresa) || (assetObj && assetObj.empresa) || "N/A";
    const tipoName = (event && event.tipo) || (assetObj && (assetObj.tipo || assetObj.nome)) || "N/A";
    const localName = (assetObj && assetObj.local) || (event && event.local) || "---";

    const els = {
        id: document.getElementById('edit-asset-id'),
        date: document.getElementById('edit-asset-date'),
        status: document.getElementById('edit-asset-status'),
        just: document.getElementById('edit-asset-justificativa'),
        idVal: document.getElementById('edit-asset-id-val'),
        empresaVal: document.getElementById('edit-asset-empresa-val'),
        tipoVal: document.getElementById('edit-asset-tipo-val'),
        localVal: document.getElementById('edit-asset-local-val')
    };

    if (els.id) els.id.innerText = `${cleanEquipId} | ${empresaName}`;
    if (els.date) els.date.value = event.date;
    if (els.status) els.status.value = event.status || 'PENDENTE';
    if (els.just) els.just.value = event.justificativa || '';
    if (els.idVal) els.idVal.innerText = cleanEquipId;
    if (els.empresaVal) els.empresaVal.innerText = empresaName;
    if (els.tipoVal) els.tipoVal.innerText = tipoName;
    if (els.localVal) els.localVal.innerText = localName;

    let curTec1 = '';
    let curTec2 = '';
    if (event && event.tecnicos && Array.isArray(event.tecnicos)) {
        curTec1 = event.tecnicos[0] || '';
        curTec2 = event.tecnicos[1] || '';
    } else if (event && event.tecnico) {
        const parts = event.tecnico.split(/\s*\|\s*/);
        curTec1 = parts[0] || '';
        curTec2 = parts[1] || '';
    }
    const findUser = (name) => {
        if (!name) return '';
        const found = (usersList || []).find(u => u.name.toLowerCase() === name.toLowerCase() || formatShortName(u.name).toLowerCase() === name.toLowerCase());
        return found ? found.name : name;
    };
    populateTechnicianDropdowns('edit-asset-tecnico-1', 'edit-asset-tecnico-2', findUser(curTec1), findUser(curTec2));

    window.updateNaoRealizadoButtonState();

    window.currentEditingEventId = event.id;
    const modal = document.getElementById('edit-asset-modal');
    const panel = document.getElementById('edit-asset-panel');
    if (modal && panel) {
        modal.classList.remove('hidden');
        setTimeout(() => {
            panel.classList.remove('opacity-0', 'scale-95');
            panel.classList.add('opacity-100', 'scale-100');
        }, 10);
    }
};

window.closeEditAssetModal = function() {
    if (currentEventLockKey) {
        releaseLock(currentEventLockKey);
        currentEventLockKey = null;
    }
    const modal = document.getElementById('edit-asset-modal');
    const panel = document.getElementById('edit-asset-panel');
    panel.classList.add('opacity-0', 'scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
};

window.markAsNaoRealizado = function() {
    const statusInput = document.getElementById('edit-asset-status');
    const wrapper = document.getElementById('justification-wrapper');
    const btn = document.getElementById('btn-nao-realizado');
    const dateInput = document.getElementById('edit-asset-date');
    
    if (dateInput) {
        const selectedDateStr = dateInput.value;
        if (selectedDateStr) {
            const selectedDate = new Date(selectedDateStr + 'T00:00:00');
            const todayVal = new Date();
            todayVal.setHours(0, 0, 0, 0);
            if (selectedDate > todayVal) {
                return; // Date in future, cannot mark as not realized
            }
        }
    }

    if (statusInput.value === 'NAO_REALIZADO') {
        statusInput.value = 'PENDENTE';
        wrapper.classList.add('hidden');
        btn.className = "w-full bg-zinc-100 text-zinc-900 font-bold p-4 uppercase hover:bg-zinc-200 transition-colors border border-zinc-200 rounded-xl";
        btn.innerText = 'Marcar como NÃO REALIZADO';
    } else {
        statusInput.value = 'NAO_REALIZADO';
        wrapper.classList.remove('hidden');
        btn.className = "w-full bg-red-600 text-white font-bold p-4 uppercase border border-red-700 transition-colors hover:brightness-110 rounded-xl";
        btn.innerText = 'STATUS: NÃO REALIZADO (CLIQUE PARA CANCELAR)';
    }
};

window.updateNaoRealizadoButtonState = function() {
    const btn = document.getElementById('btn-nao-realizado');
    const dateInput = document.getElementById('edit-asset-date');
    if (!btn || !dateInput) return;

    const selectedDateStr = dateInput.value;
    if (!selectedDateStr) return;

    const selectedDate = new Date(selectedDateStr + 'T00:00:00');
    const todayVal = new Date();
    todayVal.setHours(0, 0, 0, 0);

    const isFuture = selectedDate > todayVal;
    const statusInput = document.getElementById('edit-asset-status');
    const isNaoRealizado = statusInput && statusInput.value === 'NAO_REALIZADO';

    if (isFuture) {
        if (statusInput) statusInput.value = 'PENDENTE';
        const wrapper = document.getElementById('justification-wrapper');
        if (wrapper) wrapper.classList.add('hidden');
        btn.disabled = true;
        btn.className = "w-full bg-zinc-100 text-zinc-400 font-bold p-4 uppercase border border-zinc-200 cursor-not-allowed opacity-50 rounded-xl";
        btn.innerText = 'Marcar como NÃO REALIZADO';
    } else {
        btn.disabled = false;
        if (isNaoRealizado) {
            btn.className = "w-full bg-red-600 text-white font-bold p-4 uppercase border border-red-700 transition-colors hover:brightness-110 rounded-xl";
            btn.innerText = 'STATUS: NÃO REALIZADO (CLIQUE PARA CANCELAR)';
            const wrapper = document.getElementById('justification-wrapper');
            if (wrapper) wrapper.classList.remove('hidden');
        } else {
            btn.className = "w-full bg-zinc-100 text-zinc-900 font-bold p-4 uppercase hover:bg-zinc-200 transition-colors border border-zinc-200 rounded-xl";
            btn.innerText = 'Marcar como NÃO REALIZADO';
            const wrapper = document.getElementById('justification-wrapper');
            if (wrapper) wrapper.classList.add('hidden');
        }
    }
};

window.updateEventFromIndustrial = function() {
    const id = window.currentEditingEventId;
    if (!id) return;

    const dateInput = document.getElementById('edit-asset-date')?.value;
    if (!dateInput) {
        return window.showAlert('SELECIONE UMA DATA VÁLIDA.', 'warning');
    }
    const status = document.getElementById('edit-asset-status')?.value || 'PENDENTE';
    const justificativa = document.getElementById('edit-asset-justificativa')?.value || '';
    
    let eventIdx = events.findIndex(e => String(e.id) === String(id));
    const currentEv = eventIdx !== -1 ? events[eventIdx] : null;
    
    let targetEquip = (currentEv ? currentEv.equipamento : null) || (id.includes('-20') ? id.substring(0, id.lastIndexOf('-20')) : id);
    const assetObj = allAssetsList.find(a => a && (
        String(a.id).trim().toUpperCase() === String(targetEquip).trim().toUpperCase() ||
        String(a.id).trim().toUpperCase() === String(id).trim().toUpperCase()
    ));
    if (assetObj && assetObj.id) {
        targetEquip = assetObj.id;
    }

    const empresa = (currentEv && currentEv.empresa) || (assetObj && assetObj.empresa) || "N/A";
    const tipo = (currentEv && currentEv.tipo) || (assetObj && (assetObj.tipo || assetObj.nome)) || "N/A";
    const local = (assetObj && assetObj.local) || (currentEv && currentEv.local) || "";
    const companyColor = getCompanyColor(empresa);
    const finalId = `${targetEquip}-${dateInput}`;
    
    if (String(id) !== String(finalId)) {
        deleteEventFromCloud(id).catch(e => console.error("Erro ao deletar evento antigo:", e));
    }

    const tec1 = document.getElementById('edit-asset-tecnico-1')?.value || '';
    const tec2 = document.getElementById('edit-asset-tecnico-2')?.value || '';
    const selectedTecs = [];
    if (tec1) selectedTecs.push(formatShortName(tec1));
    if (tec2 && tec2 !== tec1) selectedTecs.push(formatShortName(tec2));
    const tecnicoStr = selectedTecs.join(' | ');

    const eventData = {
        ...(currentEv || {}),
        id: finalId,
        date: dateInput,
        status: status,
        justificativa: justificativa,
        empresa: empresa,
        equipamento: targetEquip,
        tipo: tipo,
        local: local,
        tecnico: tecnicoStr,
        tecnicos: selectedTecs,
        color: status === 'NAO_REALIZADO' ? 'border-red-500 bg-red-50' : companyColor.color,
        textColor: status === 'NAO_REALIZADO' ? 'text-red-700' : companyColor.textColor
    };

    if (eventIdx !== -1) {
        events[eventIdx] = eventData;
    } else {
        events.push(eventData);
    }
    
    setStoredData('crane_events', events);
    window.closeEditAssetModal();
    renderCalendar();
    if (typeof renderAssets === 'function') renderAssets();
    if (typeof renderOpenOrders === 'function') renderOpenOrders();
    window.showAlert('AGENDAMENTO ATUALIZADO COM SUCESSO!', 'success');
};

window.confirmDeleteModal = function() {
    const id = window.currentEditingEventId;
    const event = events.find(e => e.id == id);
    if (!event) return;

    const modal = document.getElementById('modal-delete-prog');
    const msg = document.getElementById('delete-prog-message');
    const groupBtn = document.getElementById('btn-delete-group');

    if (event.groupId) {
        msg.innerText = "ESTA PROGRAMAÇÃO POSSUI RECORRÊNCIA. COMO DESEJA EXCLUIR?";
        groupBtn.classList.remove('hidden');
    } else {
        msg.innerText = "DESEJA EXCLUIR ESTA PROGRAMAÇÃO DEFINITIVAMENTE?";
        groupBtn.classList.add('hidden');
    }

    modal.classList.remove('hidden');
};

window.deleteSingleEvent = async function() {
    const id = window.currentEditingEventId;
    events = events.filter(e => e.id != id);
    setStoredData('crane_events', events);
    if (id) {
        await deleteEventFromCloud(id);
    }
    
    document.getElementById('modal-delete-prog').classList.add('hidden');
    window.closeEditAssetModal();
    renderCalendar();
    renderAssets();
    window.showAlert('PROGRAMAÇÃO EXCLUÍDA COM SUCESSO.', 'success');
};

window.deleteRecurringEvents = async function() {
    const id = window.currentEditingEventId;
    const event = events.find(e => e.id == id);
    if (event && event.groupId) {
        const eventsToDelete = events.filter(e => e.groupId === event.groupId);
        events = events.filter(e => e.groupId !== event.groupId);
        setStoredData('crane_events', events);
        for (const ev of eventsToDelete) {
            await deleteEventFromCloud(ev.id);
        }
    } else if (id) {
        events = events.filter(e => e.id != id);
        setStoredData('crane_events', events);
        await deleteEventFromCloud(id);
    }
    
    document.getElementById('modal-delete-prog').classList.add('hidden');
    window.closeEditAssetModal();
    renderCalendar();
    renderAssets();
    window.showAlert('RECORRÊNCIA EXCLUÍDA COM SUCESSO.', 'success');
};

// --- CALENDAR LOGIC ---

window.renderCalendar = function() {
    const grid = document.getElementById('calendar-grid');
    if (!grid) return;
    grid.innerHTML = '';

    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + filterMonthOffset);
    currentViewDate = targetDate;

    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();

    const monthDisplay = document.getElementById('current-month-display');
    if (monthDisplay) {
        monthDisplay.innerText = `${monthNames[month]}/${year}`.toUpperCase();
    }

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();

    for (let i = firstDay; i > 0; i--) {
        grid.innerHTML += `<div class="calendar-cell bg-zinc-50/30 opacity-40 flex flex-col justify-between"><span class="text-[10px] font-bold text-zinc-300">${daysInPrev - i + 1}</span></div>`;
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
        grid.innerHTML += `
            <div class="calendar-cell cursor-pointer hover:bg-zinc-100 transition-colors flex flex-col justify-start ${isToday ? 'bg-zinc-100 border-2 border-zinc-500 ring-inset z-10' : ''}" 
                 data-date="${dateStr}" 
                 onclick="window.openProgModal('${dateStr}')">
                <span class="text-[10px] lg:text-[11px] font-bold ${isToday ? 'text-black font-black' : 'text-zinc-500'} leading-none">${String(day).padStart(2, '0')}</span>
                <div class="mt-1 space-y-0.5 event-container overflow-hidden"></div>
            </div>`;
    }
    const total = grid.children.length;
    for (let i = 1; i <= (42 - total); i++) {
        grid.innerHTML += `<div class="calendar-cell bg-zinc-50/30 opacity-40 flex flex-col justify-between"><span class="text-[10px] font-bold text-zinc-300">${String(i).padStart(2, '0')}</span></div>`;
    }
    renderEventsOnGrid();
};

function renderEventsOnGrid() {
    events.forEach(event => {
        const cell = document.querySelector(`[data-date="${event.date}"]`);
        if (cell) {
            const container = cell.querySelector('.event-container');
            const eventEl = document.createElement('div');
            const isNaoRealizado = event.status === 'NAO_REALIZADO';
            const colorClass = isNaoRealizado ? 'border-red-500 bg-red-50/50 text-red-700' : (event.color ? `${event.color} ${event.textColor}` : 'border-primary-container bg-primary/5 text-black');
            
            eventEl.className = `flex items-center justify-between group border-l-2 ${colorClass} pl-1.5 py-0.5 pr-1 hover:brightness-95 transition-all cursor-pointer shadow-sm rounded-sm mt-0.5 text-[8px] lg:text-[9px]`;
            eventEl.onclick = (e) => { e.stopPropagation(); window.openEditModal(event.id); };
            eventEl.innerHTML = `
                <div class="flex flex-col flex-1 overflow-hidden">
                    <span class="text-[8px] lg:text-[9px] font-bold uppercase truncate block leading-tight">${event.empresa} - ${event.equipamento}</span>
                    ${isNaoRealizado ? '<span class="text-[7px] font-black text-red-600 uppercase tracking-tighter">NÃO REALIZADO</span>' : ''}
                </div>
                <span class="material-symbols-outlined text-[10px] text-zinc-400 group-hover:text-black transition-colors shrink-0 ml-0.5">edit</span>
            `;
            container.appendChild(eventEl);
        }
    });
}

window.changeMonth = function(delta) {
    window.changeFilterMonth(delta);
};

// --- CHECKLIST / INSPECTION ---

window.openChecklistModal = async function(id = null) {
    if (!id) {
        openChecklistForm(currentChecklistContext || {
            tipo: 'PREVENTIVA',
            empresa: '',
            equipamentoId: '',
            equipamentoNome: '',
            assetInfo: '---',
        });
        return;
    }

    let order = openOrders.find(o => String(o.id) === String(id));
    if (!order || !order.responses || Object.keys(order.responses || {}).length === 0) {
        const localOrders = await getDBValue('crane_open_orders', []);
        const foundLocal = localOrders.find(o => String(o.id) === String(id));
        if (foundLocal) {
            order = order ? { ...order, ...foundLocal } : foundLocal;
            const idx = openOrders.findIndex(o => String(o.id) === String(id));
            if (idx !== -1) openOrders[idx] = order;
        }
    }
    if (order) {
        const resolvedSchema = order.schema_snapshot || order.schema || null;
        openChecklistForm({
            tipo: order.type || 'PREVENTIVA',
            empresa: order.empresa || '',
            equipamentoId: order.equipamentoId || '',
            equipamentoNome: order.equipamentoNome || '',
            assetInfo: order.assetInfo || '',
            schema: resolvedSchema,
            schema_snapshot: resolvedSchema,
            templateId: order.templateId || null,
            templateName: order.templateName || null
        }, order);
        return;
    }

    let report = finalizedReports.find(r => String(r.id) === String(id));
    if (!report || !report.responses || Object.keys(report.responses || {}).length === 0) {
        const localReports = await getDBValue('crane_reports', []);
        const foundLocal = localReports.find(r => String(r.id) === String(id));
        if (foundLocal) {
            report = report ? { ...report, ...foundLocal } : foundLocal;
            const idx = finalizedReports.findIndex(r => String(r.id) === String(id));
            if (idx !== -1) finalizedReports[idx] = report;
        }
    }
    if (report) {
        const resolvedSchema = report.schema_snapshot || report.schema || null;
        openChecklistForm({
            tipo: report.type || 'PREVENTIVA',
            empresa: report.empresa || '',
            equipamentoId: report.equipamentoId || report.equipamento || '',
            equipamentoNome: report.equipamentoNome || report.equipamento || '',
            assetInfo: report.assetInfo || '',
            schema: resolvedSchema,
            schema_snapshot: resolvedSchema,
            templateId: report.templateId || null,
            templateName: report.templateName || null
        }, report);
    }
};

window.closeChecklistModal = function() {
    if (currentChecklistLockKey) {
        releaseLock(currentChecklistLockKey);
        currentChecklistLockKey = null;
    }
    const modal = document.getElementById('checklist-modal');
    const panel = document.getElementById('checklist-panel');
    const overlay = document.getElementById('checklist-overlay');
    const formRoot = document.getElementById('checklist-form-root');

    editingOrderId = null;
    currentChecklistContext = null;
    activeCustomSections = [];
    activeCustomItems = [];
    window.activeCustomItems = [];
    isSavingOrSendingChecklist = false;
    if (formRoot) formRoot.innerHTML = '';

    panel?.classList.add('opacity-0', 'translate-x-4');
    panel?.classList.remove('opacity-100', 'translate-x-0');
    overlay?.classList.remove('opacity-100');
    overlay?.classList.add('opacity-0');
    setTimeout(() => modal?.classList.add('hidden'), 75);
};

window.savePartialInspection = async function() {
    if (isSavingOrSendingChecklist) return;
    const formRoot = getFormRoot() || document.getElementById('checklist-form-root');
    if (!formRoot || !currentChecklistContext) return;

    if (editingOrderId && String(editingOrderId).toUpperCase().startsWith('REL')) {
        return window.showAlert('RELATÓRIO FINALIZADO DEVE SER ENVIADO PELO BOTÃO "ENVIAR".', 'warning');
    }

    isSavingOrSendingChecklist = true;
    const btn = document.getElementById('checklist-save-btn');
    if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'pointer-events-none');
    }

    const formData = collectFormData(formRoot);
    const existing = (editingOrderId && String(editingOrderId).startsWith('ORD-'))
        ? openOrders.find(o => String(o.id) === String(editingOrderId))
        : null;
    const resolvedSchema = currentChecklistContext?.schema_snapshot || currentChecklistContext?.schema || existing?.schema_snapshot || existing?.schema || null;

    const docId = (editingOrderId && String(editingOrderId).startsWith('ORD-'))
        ? editingOrderId
        : generateNextOrderId(openOrders);
    editingOrderId = docId;

    const loggedUser = getCurrentUser();
    const currentUserName = loggedUser?.name || document.getElementById('user-name-display')?.innerText || "MAYCON DIAS";

    const doc = createInspectionDocument(currentChecklistContext, {
        ...(existing || {}),
        ...formData,
        schema: resolvedSchema,
        schema_snapshot: resolvedSchema,
        templateId: currentChecklistContext?.templateId || existing?.templateId || null,
        templateName: currentChecklistContext?.templateName || existing?.templateName || null,
        customSections: activeCustomSections,
        customItems: activeCustomItems,
        status: 'DRAFT',
        id: docId,
        tecnico: existing?.tecnico || currentUserName,
    });

    try {
        await saveDraftOrder(doc, openOrders);
        syncKeyToSupabase('crane_open_orders', openOrders).catch(e => console.warn('Supabase sync background notice:', e));
    } catch (e) {
        console.error("Erro ao salvar rascunho:", e);
        isSavingOrSendingChecklist = false;
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'pointer-events-none');
        }
        return window.showAlert('ERRO AO SALVAR RASCUNHO.', 'warning');
    }

    window.showAlert('INSPEÇÃO SALVA EM "OS EM ABERTO"', 'success');
    window.closeChecklistModal();
    renderOpenOrders();
};

window.generateWorkOrder = function() {
    if (isSavingOrSendingChecklist) return;
    const formRoot = getFormRoot() || document.getElementById('checklist-form-root');
    if (!formRoot || !currentChecklistContext) return;

    const validationErrors = validateBeforeSend(formRoot);
    if (validationErrors.length > 0) {
        return window.showAlert('PREENCHA A OBSERVAÇÃO NOS ITENS MARCADOS COMO NOK.', 'warning');
    }

    isSavingOrSendingChecklist = true;
    const btn = document.querySelector('button[onclick="window.generateWorkOrder()"]');
    if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'pointer-events-none');
    }

    function generateNextReportId() {
        let maxNum = 0;
        const allReports = finalizedReports || [];
        allReports.forEach(r => {
            if (r && r.id) {
                const match = String(r.id).match(/\d+/);
                if (match) {
                    const num = parseInt(match[0], 10);
                    if (num > maxNum) maxNum = num;
                }
            }
        });
        const nextNum = maxNum + 1;
        return `REL - ${String(nextNum).padStart(2, '0')}`;
    }

    const formData = collectFormData(formRoot);
    const isEditingRel = editingOrderId && (String(editingOrderId).startsWith('REL-') || String(editingOrderId).startsWith('REL - '));
    const reportId = isEditingRel ? editingOrderId : generateNextReportId();

    const loggedUser = getCurrentUser();
    const userName = loggedUser?.name || document.getElementById('user-name-display')?.innerText || "MAYCON DIAS";
    const existing = isEditingRel
        ? finalizedReports.find(r => String(r.id) === String(editingOrderId))
        : (editingOrderId ? openOrders.find(o => String(o.id) === String(editingOrderId)) : null);

    const resolvedSchema = currentChecklistContext?.schema_snapshot || currentChecklistContext?.schema || existing?.schema_snapshot || existing?.schema || null;

    const newReport = createInspectionDocument(currentChecklistContext, {
        ...(existing || {}),
        ...formData,
        schema: resolvedSchema,
        schema_snapshot: resolvedSchema,
        templateId: currentChecklistContext?.templateId || existing?.templateId || null,
        templateName: currentChecklistContext?.templateName || existing?.templateName || null,
        customSections: activeCustomSections,
        customItems: activeCustomItems,
        status: 'FINALIZED',
        id: reportId,
        type: currentChecklistContext.tipo,
        empresa: currentChecklistContext.empresa,
        equipamentoId: currentChecklistContext.equipamentoId,
        equipamentoNome: currentChecklistContext.equipamentoNome,
        assetInfo: currentChecklistContext.assetInfo,
        equipamento: currentChecklistContext.equipamentoNome,
        tecnico: userName,
    });

    const tempReports = [...finalizedReports];
    let newOpenOrders = [...openOrders];

    if (editingOrderId && String(editingOrderId).startsWith('ORD-')) {
        newOpenOrders = newOpenOrders.filter(o => o.id !== editingOrderId);
        clearFastLocalDraft(editingOrderId);
        deleteOrderFromCloud(editingOrderId).catch(err => console.error("Erro ao deletar ordem concluída do Supabase:", err));
    }

    if (isEditingRel) {
        const idx = tempReports.findIndex(r => r.id === editingOrderId);
        if (idx !== -1) tempReports[idx] = newReport;
        else tempReports.push(newReport);
    } else {
        tempReports.push(newReport);
    }

    try {
        setStoredData('crane_reports', tempReports);
        if (editingOrderId && String(editingOrderId).startsWith('ORD-')) {
            setStoredData('crane_open_orders', newOpenOrders);
            updateArrayInPlace(openOrders, newOpenOrders);
        }
        updateArrayInPlace(finalizedReports, tempReports);
    } catch (e) {
        console.error("Erro ao salvar relatório:", e);
        isSavingOrSendingChecklist = false;
        if (btn) {
            btn.disabled = false;
            btn.classList.remove('opacity-50', 'pointer-events-none');
        }
        return window.showAlert('ERRO AO SALVAR O RELATÓRIO.', 'warning');
    }

    window.closeChecklistModal();
    renderOpenOrders();
    renderReportsView();
    window.showAlert('RELATÓRIO ENVIADO COM SUCESSO.', 'success');
};

// --- USERS ---

function renderUsers(searchTerm = '') {
    const tbody = document.getElementById('users-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    const filtered = searchTerm ? usersList.filter(u => u.name.toLowerCase().includes(searchTerm)) : [...usersList];
    filtered.sort((a, b) => a.name.localeCompare(b.name));
    filtered.forEach(user => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-zinc-50 transition-colors group";
        const displayName = formatShortName(user.name);
        tr.innerHTML = `
            <td class="p-4 text-table-data font-bold uppercase">${displayName}</td>
            <td class="p-4 text-table-data text-zinc-500 lowercase">${user.email}</td>
            <td class="p-4 text-table-data">
                <span class="px-2 py-1 ${user.permission === 'ADMINISTRADOR' ? 'bg-primary-container/20 text-on-surface' : 'bg-zinc-100 text-zinc-600'} text-[10px] font-bold">${user.permission}</span>
            </td>
            <td class="p-4 text-right">
                <button onclick="window.openEditUserModal('${user.id}')" class="text-zinc-400 hover:text-black p-1">
                    <span class="material-symbols-outlined text-lg">edit</span>
                </button>
            </td>`;
        tbody.appendChild(tr);
    });
}

window.openUserModal = function() {
    const modal = document.getElementById('user-modal');
    const panel = modal.querySelector('.relative');
    
    const typeContainer = document.getElementById('user-registration-type-container');
    if (typeContainer) typeContainer.classList.remove('hidden');
    
    const typeSelect = document.getElementById('user-registration-type');
    if (typeSelect) typeSelect.value = 'USUARIO';
    
    document.getElementById('user-modal-title').innerText = 'CADASTRO DE USUÁRIO';
    document.getElementById('user-modal-subtitle').innerText = 'CONFIGURAÇÕES DE ACESSO';
    document.getElementById('user-id-input').value = '';
    document.getElementById('user-name-input').value = '';
    document.getElementById('user-cargo-input').value = '';
    document.getElementById('user-email-input').value = '';
    document.getElementById('user-password-input').value = '';
    document.getElementById('user-permission-select').value = 'TECNICO';
    
    // Tenta carregar a empresa interna do storage
    const internalCompany = getStoredData('crane_internal_company', null);

    const removeLogoBtn = document.getElementById('remove-interno-logo-btn');
    if (internalCompany) {
        document.getElementById('interno-empresa-name').value = internalCompany.name || '';
        document.getElementById('interno-empresa-cnpj').value = internalCompany.cnpj || '';
        document.getElementById('interno-empresa-endereco').value = internalCompany.endereco || '';
        document.getElementById('interno-empresa-numero').value = internalCompany.numero || '';
        document.getElementById('interno-empresa-bairro').value = internalCompany.bairro || '';
        document.getElementById('interno-empresa-cep').value = internalCompany.cep || '';
        document.getElementById('interno-empresa-cidade').value = internalCompany.cidade || '';
        document.getElementById('interno-empresa-estado').value = internalCompany.estado || '';
        
        const previewContainer = document.getElementById('interno-logo-preview-container');
        if (previewContainer) {
            if (internalCompany.logo) {
                previewContainer.innerHTML = `<img src="${internalCompany.logo}" class="w-full h-full object-cover" />`;
                if (removeLogoBtn) removeLogoBtn.classList.remove('hidden');
            } else {
                previewContainer.innerHTML = '<span class="material-symbols-outlined text-on-surface-variant">add_a_photo</span>';
                if (removeLogoBtn) removeLogoBtn.classList.add('hidden');
            }
        }
        window.currentInternoLogoBase64 = internalCompany.logo || null;
    } else {
        // Limpa campos de cadastro interno se não houver cadastro prévio
        ['interno-empresa-name', 'interno-empresa-cnpj', 'interno-empresa-endereco', 'interno-empresa-numero', 'interno-empresa-bairro', 'interno-empresa-cep', 'interno-empresa-cidade', 'interno-empresa-estado'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const previewContainer = document.getElementById('interno-logo-preview-container');
        if (previewContainer) {
            previewContainer.innerHTML = '<span class="material-symbols-outlined text-on-surface-variant">add_a_photo</span>';
        }
        if (removeLogoBtn) removeLogoBtn.classList.add('hidden');
        window.currentInternoLogoBase64 = null;
    }
    
    const fileInput = document.getElementById('interno-empresa-logo');
    if (fileInput) fileInput.value = '';
    
    document.getElementById('btn-user-delete').style.display = 'none'; // Hide delete when creating
    
    window.currentUserSignatureBase64 = null;
    const sigPreview = document.getElementById('user-signature-preview-container');
    if (sigPreview) sigPreview.innerHTML = '<span class="text-xs text-on-surface-variant uppercase font-bold text-center px-2">Sem Assinatura</span>';
    document.getElementById('remove-user-signature-btn')?.classList.add('hidden');

    window.handleUserRegistrationTypeChange();
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        panel.classList.remove('opacity-0', 'scale-95');
        panel.classList.add('opacity-100', 'scale-100');
    }, 10);
};

let currentUserLockKey = null;

window.openEditUserModal = async function(id) {
    const user = usersList.find(u => String(u.id) === String(id));
    if (!user) return;

    const lockKey = `user:${id}`;
    const lockRes = await acquireLock(lockKey);
    if (!lockRes.success) {
        window.showAlert(`🔒 REGISTRO EM MODO EDIÇÃO POR "${lockRes.lockedBy.toUpperCase()}". AGUARDE A CONCLUSÃO.`, 'warning');
        return;
    }
    if (currentUserLockKey && currentUserLockKey !== lockKey) {
        releaseLock(currentUserLockKey);
    }
    currentUserLockKey = lockKey;
    
    const modal = document.getElementById('user-modal');
    const panel = modal.querySelector('.relative');
    
    const typeContainer = document.getElementById('user-registration-type-container');
    if (typeContainer) typeContainer.classList.add('hidden');
    
    const typeSelect = document.getElementById('user-registration-type');
    if (typeSelect) typeSelect.value = 'USUARIO';
    
    document.getElementById('user-modal-title').innerText = 'EDITAR USUÁRIO';
    document.getElementById('user-modal-subtitle').innerText = 'CONFIGURAÇÕES DE ACESSO';
    document.getElementById('user-id-input').value = user.id;
    document.getElementById('user-name-input').value = (user.name || '').toUpperCase();
    document.getElementById('user-cargo-input').value = (user.cargo || (user.permission === 'ADMINISTRADOR' ? 'GERENTE' : 'INSPETOR TÉCNICO')).toUpperCase();
    document.getElementById('user-email-input').value = (user.email || '').toLowerCase();
    document.getElementById('user-password-input').value = user.password || '';
    document.getElementById('user-permission-select').value = user.permission || 'TECNICO';
    
    document.getElementById('btn-user-delete').style.display = 'block'; // Show delete when editing
    
    window.currentUserSignatureBase64 = user.signature || null;
    const sigPreview = document.getElementById('user-signature-preview-container');
    const removeSigBtn = document.getElementById('remove-user-signature-btn');
    if (user.signature) {
        if (sigPreview) sigPreview.innerHTML = `<img src="${user.signature}" class="w-full h-full object-contain p-1" />`;
        removeSigBtn?.classList.remove('hidden');
    } else {
        if (sigPreview) sigPreview.innerHTML = '<span class="text-xs text-on-surface-variant uppercase font-bold text-center px-2">Sem Assinatura</span>';
        removeSigBtn?.classList.add('hidden');
    }

    window.handleUserRegistrationTypeChange();
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        panel.classList.remove('opacity-0', 'scale-95');
        panel.classList.add('opacity-100', 'scale-100');
    }, 10);
};

window.handleUserRegistrationTypeChange = function() {
    const typeSelect = document.getElementById('user-registration-type');
    const type = typeSelect ? typeSelect.value : 'USUARIO';
    
    const fieldsUsuario = document.getElementById('fields-usuario-container');
    const fieldsInterno = document.getElementById('fields-cadastro-interno-container');
    const footerUsuario = document.getElementById('user-footer-buttons');
    const footerInterno = document.getElementById('interno-footer-buttons');
    
    const modal = document.getElementById('user-modal');
    const panel = modal.querySelector('.relative');
    
    const isEdit = document.getElementById('user-id-input').value !== '';

    if (type === 'USUARIO') {
        if (fieldsUsuario) fieldsUsuario.classList.remove('hidden');
        if (fieldsInterno) fieldsInterno.classList.add('hidden');
        if (footerUsuario) footerUsuario.classList.remove('hidden');
        if (footerInterno) footerInterno.classList.add('hidden');
        
        if (panel) {
            panel.classList.remove('max-w-3xl');
            panel.classList.add('max-w-md');
        }
        
        document.getElementById('user-modal-title').innerText = isEdit ? 'EDITAR USUÁRIO' : 'CADASTRO DE USUÁRIO';
        document.getElementById('user-modal-subtitle').innerText = 'CONFIGURAÇÕES DE ACESSO';
    } else {
        if (fieldsUsuario) fieldsUsuario.classList.add('hidden');
        if (fieldsInterno) fieldsInterno.classList.remove('hidden');
        if (footerUsuario) footerUsuario.classList.add('hidden');
        if (footerInterno) footerInterno.classList.remove('hidden');
        
        if (panel) {
            panel.classList.remove('max-w-md');
            panel.classList.add('max-w-3xl');
        }
        
        document.getElementById('user-modal-title').innerText = 'CENTRAL DE CADASTRO';
        document.getElementById('user-modal-subtitle').innerText = 'SISTEMA INTEGRADO DE GESTÃO';
    }
};

window.handleInternoLogoPreview = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result;
        window.currentInternoLogoBase64 = base64;
        
        const previewContainer = document.getElementById('interno-logo-preview-container');
        if (previewContainer) {
            previewContainer.innerHTML = `<img src="${base64}" class="w-full h-full object-cover" />`;
        }
        const removeLogoBtn = document.getElementById('remove-interno-logo-btn');
        if (removeLogoBtn) removeLogoBtn.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
};

window.removeInternoLogo = function() {
    window.currentInternoLogoBase64 = "";
    const previewContainer = document.getElementById('interno-logo-preview-container');
    if (previewContainer) {
        previewContainer.innerHTML = '<span class="material-symbols-outlined text-on-surface-variant">add_a_photo</span>';
    }
    const fileInput = document.getElementById('interno-empresa-logo');
    if (fileInput) fileInput.value = '';
    const removeLogoBtn = document.getElementById('remove-interno-logo-btn');
    if (removeLogoBtn) removeLogoBtn.classList.add('hidden');
};

window.saveCadastroInterno = function() {
    const name = document.getElementById('interno-empresa-name').value.trim();
    const cnpj = document.getElementById('interno-empresa-cnpj').value.trim();
    const endereco = document.getElementById('interno-empresa-endereco').value.trim();
    const numero = document.getElementById('interno-empresa-numero').value.trim();
    const bairro = document.getElementById('interno-empresa-bairro').value.trim();
    const cep = document.getElementById('interno-empresa-cep').value.trim();
    const cidade = document.getElementById('interno-empresa-cidade').value.trim();
    const estado = document.getElementById('interno-empresa-estado').value.trim();
    const logo = window.currentInternoLogoBase64 !== null ? window.currentInternoLogoBase64 : "";

    if (!name) {
        return window.showAlert('O NOME DA EMPRESA É OBRIGATÓRIO.', 'warning');
    }

    // Tenta carregar a empresa interna antiga para identificar se o nome mudou ou se é a mesma
    const internalCompany = getStoredData('crane_internal_company', null);
    let oldName = (internalCompany && internalCompany.name) ? internalCompany.name : "";

    // Verifica se existe outra empresa com este nome, exceto se for a mesma empresa que estamos editando
    const exists = (companies || []).some(c => {
        const cName = typeof c === 'string' ? c : c.name;
        if (oldName && cName.toLowerCase() === oldName.toLowerCase()) {
            return false; // É a mesma empresa
        }
        return cName.toLowerCase() === name.toLowerCase();
    });
    
    if (exists) {
        return window.showAlert('UMA EMPRESA COM ESTE NOME JÁ ESTÁ CADASTRADA.', 'warning');
    }

    const newCompany = {
        name: name.toUpperCase(),
        cnpj,
        endereco: endereco.toUpperCase(),
        numero: numero.toUpperCase(),
        bairro: bairro.toUpperCase(),
        cep,
        cidade: cidade.toUpperCase(),
        estado: estado.toUpperCase(),
        logo,
        tenant_code: getTenantCode() || '001'
    };

    // Salva a empresa interna no localStorage/IndexedDB
    setStoredData('crane_internal_company', newCompany);

    // Remove a empresa do cadastro geral de empresas (caso tenha sido adicionada anteriormente)
    let updatedCompanies = (companies || []).filter(c => {
        const cName = typeof c === 'string' ? c : c.name;
        const isOld = oldName && cName.toLowerCase() === oldName.toLowerCase();
        const isNew = cName.toLowerCase() === name.toLowerCase();
        return !isOld && !isNew;
    });
    setCompanies(updatedCompanies);
    
    // Sincroniza referências
    if (oldName && oldName.toLowerCase() !== newCompany.name.toLowerCase()) {
        const updatedAssetsList = allAssetsList.map(a => a.empresa.toLowerCase() === oldName.toLowerCase() ? { ...a, empresa: newCompany.name } : a);
        setAllAssetsList(updatedAssetsList);
        
        if (typeof assets !== 'undefined') {
            assets = assets.map(a => a.empresa.toLowerCase() === oldName.toLowerCase() ? { ...a, empresa: newCompany.name } : a);
            setStoredData('crane_assets', assets);
        }
        if (typeof events !== 'undefined') {
            events = events.map(e => e.empresa.toLowerCase() === oldName.toLowerCase() ? { ...e, empresa: newCompany.name } : e);
            setStoredData('crane_events', events);
        }
        if (typeof finalizedReports !== 'undefined') {
            updateArrayInPlace(finalizedReports, finalizedReports.map(r => r.empresa.toLowerCase() === oldName.toLowerCase() ? { ...r, empresa: newCompany.name } : r));
            setStoredData('crane_reports', finalizedReports);
        }
    }

    window.showAlert('CADASTRO INTERNO SALVO COM SUCESSO!', 'success');
    window.closeUserModal();

    if (typeof renderCompanies === 'function') renderCompanies();
    if (typeof renderAssets === 'function') renderAssets();
    
    if (typeof currentView !== 'undefined') {
        if (currentView === 'assets' && typeof renderAtivosView === 'function') renderAtivosView();
        if (currentView === 'reports' && typeof renderReportsView === 'function') renderReportsView();
    }
};

window.saveUserOrCompany = function() {
    const typeSelect = document.getElementById('user-registration-type');
    const type = typeSelect ? typeSelect.value : 'USUARIO';
    
    if (type === 'USUARIO') {
        window.saveUserFromForm();
    } else {
        window.saveCadastroInterno();
    }
};

window.saveUser = function() {
    return window.saveUserFromForm();
};

window.closeUserModal = function() {
    if (currentUserLockKey) {
        releaseLock(currentUserLockKey);
        currentUserLockKey = null;
    }
    const modal = document.getElementById('user-modal');
    if (!modal) return;
    const panel = modal.querySelector('.relative');
    if (panel) {
        panel.classList.remove('opacity-100', 'scale-100');
        panel.classList.add('opacity-0', 'scale-95');
    }
    setTimeout(() => {
        modal.classList.add('hidden');
    }, 200);
};

window.saveUserFromForm = async function() {
    const idVal = document.getElementById('user-id-input').value;
    const name = document.getElementById('user-name-input').value.trim();
    const cargo = document.getElementById('user-cargo-input').value.trim();
    const email = document.getElementById('user-email-input').value.trim();
    const password = document.getElementById('user-password-input').value.trim();
    const permission = document.getElementById('user-permission-select').value;
    
    if (!name || !email || !password) {
        return window.showAlert('PREENCHA TODOS OS CAMPOS.', 'warning');
    }
    
    const hashedPassword = await hashPassword(password);

    let updatedList = [];
    let savedUser = null;
    if (idVal) {
        updatedList = usersList.map(u => {
            if (String(u.id) === String(idVal)) {
                savedUser = {
                    ...u,
                    name: name.toUpperCase(),
                    cargo: cargo.toUpperCase(),
                    email: email.toLowerCase(),
                    password: hashedPassword,
                    permission: permission,
                    signature: window.currentUserSignatureBase64 !== null ? window.currentUserSignatureBase64 : (u.signature || ""),
                    tenant_code: u.tenant_code || getTenantCode() || '001'
                };
                return savedUser;
            }
            return u;
        });
    } else {
        const nextId = usersList.length > 0 ? Math.max(...usersList.map(u => Number(u.id) || 0)) + 1 : 1;
        savedUser = {
            id: nextId,
            name: name.toUpperCase(),
            cargo: cargo.toUpperCase(),
            email: email.toLowerCase(),
            password: hashedPassword,
            permission: permission,
            signature: window.currentUserSignatureBase64 || "",
            tenant_code: getTenantCode() || '001'
        };
        updatedList = [...usersList, savedUser];
    }
    
    setUsersList(updatedList);

    // Se o usuário editado for o usuário logado atualmente, atualiza a sessão ativa
    const loggedUser = getCurrentUser();
    if (savedUser && loggedUser && (String(loggedUser.id) === String(savedUser.id) || (loggedUser.email && loggedUser.email.toLowerCase() === savedUser.email.toLowerCase()))) {
        setCurrentUser(savedUser);
        const roleEl = document.getElementById('user-role-display');
        const nameEl = document.getElementById('user-name-display');
        if (roleEl) roleEl.innerText = savedUser.permission || 'TECNICO';
        if (nameEl) nameEl.innerText = savedUser.name || 'USUÁRIO';
    }

    window.closeUserModal();
    renderUsers();
    window.showAlert('USUÁRIO SALVO COM SUCESSO.', 'success');
};

window.deleteUserFromForm = function() {
    const idVal = document.getElementById('user-id-input').value;
    if (!idVal) return;
    
    window.showAlert('DESEJA EXCLUIR ESTE USUÁRIO DEFINITIVAMENTE?', 'warning', () => {
        const updatedList = usersList.filter(u => String(u.id) !== String(idVal));
        setUsersList(updatedList);
        deleteUserFromCloud(idVal);
        window.closeUserModal();
        renderUsers();
        window.showAlert('USUÁRIO EXCLUÍDO COM SUCESSO.', 'success');
    });
};

// --- REPORTS UI ---

function renderOpenOrders() {
    const tbody = document.getElementById('open-orders-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    openOrders.forEach(order => {
        const parts = (order.assetInfo || '').split('—').map(s => s.trim());
        const equip = order.equipamentoNome || parts[0] || '---';
        const emp = order.empresa || parts[1] || '---';
        const tr = document.createElement('tr');
        tr.className = "hover:bg-zinc-50 transition-colors group";
        tr.innerHTML = `
            <td class="p-4 font-bold text-table-data uppercase text-zinc-900">${order.id}</td>
            <td class="p-4 text-table-data uppercase text-zinc-500">${emp}</td>
            <td class="p-4 text-table-data uppercase font-bold text-zinc-900">${equip}</td>
            <td class="p-4"><span class="px-2 py-1 bg-amber-100 text-amber-700 text-[9px] font-black uppercase border border-amber-200">EM ABERTO</span></td>
            <td class="p-4 text-right">
                <div class="flex items-center justify-end gap-1">
                    <button onclick="window.openChecklistModal('${order.id}')" class="text-zinc-400 hover:text-black p-1 transition-colors" title="Editar Ordem">
                        <span class="material-symbols-outlined text-lg">edit_note</span>
                    </button>
                    <button onclick="window.deleteOpenOrder('${order.id}')" class="text-zinc-400 hover:text-error p-1 transition-colors" title="Excluir Ordem">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            </td>`;
        tbody.appendChild(tr);
    });
}
window.renderOpenOrders = renderOpenOrders;

window.deleteOpenOrder = async function(orderId) {
    if (!orderId) return;
    await deleteDraftOrder(orderId, openOrders);
    renderOpenOrders();
    window.showAlert('ORDEM DE SERVIÇO EXCLUÍDA.', 'success');
};

let reportsSelectedCompany = selectedCompany;
let reportsSelectedAssetId = null;

function formatTechnicianName(fullName) {
    if (!fullName) return "N/A";
    return formatShortName(fullName);
}

function renderReportsView() {
    const comTbody = document.getElementById('reports-companies-tbody');
    const assTbody = document.getElementById('reports-assets-tbody');
    const repTbody = document.getElementById('reports-tbody');
    if (!comTbody || !assTbody || !repTbody) return;

    const currentList = companies || [];
    
    // Se não houver empresas cadastradas no sistema
    if (currentList.length === 0) {
        comTbody.innerHTML = `<tr><td class="p-8 text-center text-on-surface-variant uppercase font-bold text-label-md">NENHUMA EMPRESA CADASTRADA</td></tr>`;
        assTbody.innerHTML = `<tr><td colspan="3" class="p-8 text-center text-on-surface-variant uppercase font-bold text-label-md">NENHUM ATIVO TÉCNICO ENCONTRADO</td></tr>`;
        repTbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-on-surface-variant uppercase font-bold text-label-md">NENHUM RELATÓRIO ENCONTRADO</td></tr>`;
        reportsSelectedCompany = "";
        reportsSelectedAssetId = null;
        return;
    }

    // Se houver empresas, verifica se a empresa atualmente selecionada é válida
    const validCompany = currentList.find(c => {
        const name = typeof c === 'string' ? c : (c?.name || "");
        return normCompReports(name) === normCompReports(reportsSelectedCompany);
    });
    if (!validCompany || !reportsSelectedCompany) {
        const firstComp = currentList[0];
        reportsSelectedCompany = typeof firstComp === 'string' ? firstComp : (firstComp?.name || "");
        reportsSelectedAssetId = null;
    }

    // 1. Render Card 1 (Companies)
    renderCompaniesUI('reports-companies-tbody', companies, reportsSelectedCompany, (company) => {
        reportsSelectedCompany = company;
        reportsSelectedAssetId = null; // reset asset selection when changing company
        renderReportsView();
    });

    // 2. Render Card 2 (Assets: ID EQUIPAMENTO, LOCALIZAÇÃO, TIPO)
    const filteredAssets = allAssetsList
        .filter(a => a.empresa && reportsSelectedCompany && normCompReports(a.empresa) === normCompReports(reportsSelectedCompany))
        .sort((a, b) => {
            const numA = parseInt(String(a.id || '').replace(/\D+/g, ''), 10) || 0;
            const numB = parseInt(String(b.id || '').replace(/\D+/g, ''), 10) || 0;
            if (numA !== numB) return numA - numB;
            return String(a.id || '').localeCompare(String(b.id || ''), undefined, { numeric: true });
        });
    assTbody.innerHTML = filteredAssets.map(a => {
        const isSelected = reportsSelectedAssetId && (a.id === reportsSelectedAssetId || normAssetReports(a.id) === normAssetReports(reportsSelectedAssetId));
        const bgClass = isSelected ? "bg-primary-container border-l-4 border-primary font-bold" : "hover:bg-surface-container cursor-pointer border-l-4 border-transparent";
        return `
            <tr class="${bgClass} transition-colors duration-200" onclick="window.selectReportsAsset('${a.id}')">
                <td class="px-card_padding py-3 text-label-md font-bold uppercase text-on-surface">${a.id}</td>
                <td class="px-card_padding py-3 text-label-md uppercase text-on-surface-variant">${(a.local || 'N/A').toUpperCase()}</td>
                <td class="px-card_padding py-3 text-label-md uppercase text-on-surface-variant">${(a.tipo || a.nome || 'N/A').toUpperCase()}</td>
            </tr>
        `;
    }).join('') || `<tr><td colspan="3" class="p-8 text-center text-on-surface-variant uppercase font-bold text-label-md">NENHUM ATIVO TÉCNICO ENCONTRADO PARA ESTA EMPRESA</td></tr>`;

    // 3. Render Card 3 (Reports)
    const filteredReports = filterReports(finalizedReports, reportsSelectedCompany, reportsSelectedAssetId, allAssetsList);

    repTbody.innerHTML = '';
    filteredReports.forEach((report, index) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-zinc-50 transition-colors group border-b border-outline-variant";
        
        const repNumber = formatReportNumber(report, index);
        const typeLabel = (report.type || 'PREVENTIVA').toUpperCase();
        const techName = formatTechnicianName(report.tecnico || 'MAYCON DIAS');

        tr.innerHTML = `
            <td class="px-card_padding py-3 text-label-md font-bold text-zinc-900">${repNumber}</td>
            <td class="px-card_padding py-3 text-label-md uppercase text-zinc-600">${typeLabel}</td>
            <td class="px-card_padding py-3 text-label-md uppercase text-zinc-500">${report.date || ''}</td>
            <td class="px-card_padding py-3 text-label-md uppercase text-zinc-700">${techName}</td>
            <td class="px-card_padding py-3 text-right">
                <button onclick="window.toggleActionMenu(event, '${report.id}')" class="text-zinc-400 hover:text-black p-1">
                    <span class="material-symbols-outlined text-lg pointer-events-none">more_vert</span>
                </button>
            </td>
        `;
        repTbody.appendChild(tr);
    });

    if (filteredReports.length === 0) {
        repTbody.innerHTML = `<tr><td colspan="5" class="p-8 text-center text-on-surface-variant uppercase font-bold text-label-md">NENHUM RELATÓRIO ENCONTRADO</td></tr>`;
    }
}
window.renderReportsView = renderReportsView;

window.selectReportsAsset = function(assetId) {
    if (reportsSelectedAssetId === assetId) {
        reportsSelectedAssetId = null; // Toggle off se clicado novamente para ver todos os relatórios da empresa
    } else {
        reportsSelectedAssetId = assetId;
    }
    renderReportsView();
};

window.toggleActionMenu = function(event, id) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('global-action-menu');
    if (!menu) return;
    if (menu.style.display === 'block' && menu.getAttribute('data-current-id') == id) {
        menu.style.display = 'none';
        return;
    }
    menu.setAttribute('data-current-id', id);
    let left = event.clientX - 150;
    let top = event.clientY + 10;
    if (top + 200 > window.innerHeight) top = window.innerHeight - 210;
    if (left < 10) left = 10;
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    menu.style.display = 'block';
    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.style.display = 'none';
            menu.classList.add('hidden');
            document.removeEventListener('mousedown', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('mousedown', closeMenu), 50);
};

window.execMenuAction = async function(action) {
    const id = document.getElementById('global-action-menu').getAttribute('data-current-id');
    document.getElementById('global-action-menu').style.display = 'none';
    if (action === 'edit') await editReport(id);
    if (action === 'pdf') {
        await window.printReportPDF(id);
    }
    if (action === 'delete') {
        window.reportIdParaExcluir = id;
        document.getElementById('modal-confirm-exclusao').classList.remove('hidden');
    }
};

window.printReportPDF = async function(reportId) {
    return await printReportPDF(reportId, { finalizedReports, companies, allAssetsList, usersList });
};

window.toggleAssetActionMenu = function(event, id) {
    if (event) event.stopPropagation();
    const menu = document.getElementById('asset-action-menu');
    if (!menu) return;
    
    menu.setAttribute('data-current-id', id);
    let left = event.clientX - 150;
    let top = event.clientY + 10;
    
    if (top + 150 > window.innerHeight) top = window.innerHeight - 160;
    if (left < 10) left = 10;
    
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
    menu.style.display = 'block';
    menu.classList.remove('hidden');

    const closeMenu = (e) => {
        if (!menu.contains(e.target)) {
            menu.style.display = 'none';
            menu.classList.add('hidden');
            document.removeEventListener('mousedown', closeMenu);
        }
    };
    setTimeout(() => document.addEventListener('mousedown', closeMenu), 50);
};

window.execAssetAction = function(action) {
    const id = document.getElementById('asset-action-menu').getAttribute('data-current-id');
    document.getElementById('asset-action-menu').style.display = 'none';
    document.getElementById('asset-action-menu').classList.add('hidden');
    
    if (action === 'edit-schedule') window.openEditModal(id);
};



async function editReport(id) {
    const normalizeId = (val) => String(val || '').replace(/[\s\-_]/g, '').toLowerCase();
    let report = (finalizedReports || []).find(r => 
        String(r.id) === String(id) ||
        normalizeId(r.id) === normalizeId(id) ||
        (String(r.id).replace(/\D+/g, '') !== '' && String(r.id).replace(/\D+/g, '') === String(id).replace(/\D+/g, ''))
    );
    if (!report || !report.responses || Object.keys(report.responses || {}).length === 0) {
        const localReports = await getDBValue('crane_reports', []);
        const foundLocal = (localReports || []).find(r => 
            String(r.id) === String(id) ||
            normalizeId(r.id) === normalizeId(id) ||
            (String(r.id).replace(/\D+/g, '') !== '' && String(r.id).replace(/\D+/g, '') === String(id).replace(/\D+/g, ''))
        );
        if (foundLocal) {
            report = report ? { ...report, ...foundLocal } : foundLocal;
            const idx = finalizedReports.findIndex(r => 
                String(r.id) === String(id) ||
                normalizeId(r.id) === normalizeId(id) ||
                (String(r.id).replace(/\D+/g, '') !== '' && String(r.id).replace(/\D+/g, '') === String(id).replace(/\D+/g, ''))
            );
            if (idx !== -1) finalizedReports[idx] = report;
        }
    }
    if (report) {
        openChecklistForm({
            tipo: report.type,
            empresa: report.empresa,
            equipamentoId: report.equipamentoId || report.equipamento,
            equipamentoNome: report.equipamentoNome || report.equipamento,
            assetInfo: report.assetInfo,
            schema: report.schema,
            templateId: report.templateId,
            templateName: report.templateName
        }, report);
    }
}

window.finalizarExclusaoDefinitiva = function() {
    if (window.reportIdParaExcluir) {
        deleteReportFromCloud(window.reportIdParaExcluir);
    }
    setFinalizedReports(finalizedReports.filter(r => r.id !== window.reportIdParaExcluir));
    renderReportsView();
    const modal = document.getElementById('modal-confirm-exclusao');
    if (modal) modal.classList.add('hidden');
    window.showAlert('RELATÓRIO EXCLUÍDO COM SUCESSO.', 'success');
};

window.renderAssets = function(searchTerm = '') {
    renderAssetsTable({
        tbodyId: 'assets-tbody',
        theadId: 'assets-thead',
        titleId: 'selected-company-name',
        events,
        selectedCompany,
        isGlobalFilterActive,
        filterMonthOffset,
        searchTerm
    });
    
    // Always update month display
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + filterMonthOffset);
    const monthDisplay = document.getElementById('filter-month-display');
    if (monthDisplay) {
        monthDisplay.innerText = `${monthNames[targetDate.getMonth()]}/${targetDate.getFullYear()}`.toUpperCase();
    }
};

window.changeFilterMonth = function(delta) {
    filterMonthOffset += delta;
    currentViewDate = new Date();
    currentViewDate.setMonth(currentViewDate.getMonth() + filterMonthOffset);
    renderAssets();
    renderCalendar();
};

window.exportOperationalDashboardData = function() {
    const targetDate = new Date();
    targetDate.setMonth(targetDate.getMonth() + filterMonthOffset);
    const monthName = monthNames[targetDate.getMonth()].toUpperCase();
    const year = targetDate.getFullYear();
    const monthYearStr = `${monthName}/${year}`;

    // 1. Filtrar eventos do mês visível
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();

    let filteredEvents = events.filter(e => {
        if (!e || !e.date) return false;
        const d = new Date(e.date + 'T12:00:00');
        if (isNaN(d.getTime())) return false;
        return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
    });

    filteredEvents.sort((a, b) => new Date(a.date) - new Date(b.date));

    // 2. Carregar dados do Cadastro Interno (Empresa Executante)
    const internalCompany = getStoredData('crane_internal_company', null);

    const companyName = (internalCompany && internalCompany.name) ? internalCompany.name.toUpperCase() : "CRANE PRO";
    const companyCnpj = (internalCompany && internalCompany.cnpj) ? internalCompany.cnpj : "---";
    const companyAddress = (internalCompany && internalCompany.endereco) ? 
        `${internalCompany.endereco}, ${internalCompany.numero || ''} - ${internalCompany.bairro || ''}` : "---";
    const companyCep = (internalCompany && internalCompany.cep) ? internalCompany.cep : "---";
    
    // Suporta novos campos Cidade/Estado
    const companyCityState = (internalCompany && (internalCompany.cidade || internalCompany.estado)) ? 
        `${internalCompany.cidade || ''} - ${internalCompany.estado || ''}` : (internalCompany && internalCompany.referencia ? internalCompany.referencia : "---");
        
    const companyLogo = (internalCompany && internalCompany.logo) ? 
        `<img src="${internalCompany.logo}" style="max-height: 60px; max-width: 200px; object-fit: contain;">` : 
        `<div style="font-size: 22px; font-weight: 900; color: #1e3a8a;">${companyName}</div>`;

    // 3. Criar iframe invisível na própria página para evitar abrir nova aba no navegador
    let printFrame = document.getElementById('crane-dashboard-print-iframe');
    if (printFrame) {
        printFrame.remove();
    }
    printFrame = document.createElement('iframe');
    printFrame.id = 'crane-dashboard-print-iframe';
    printFrame.style.position = 'fixed';
    printFrame.style.left = '-9999px';
    printFrame.style.top = '-9999px';
    printFrame.style.width = '1000px';
    printFrame.style.height = '1000px';
    printFrame.style.border = '0';
    printFrame.style.opacity = '0';
    printFrame.style.pointerEvents = 'none';
    document.body.appendChild(printFrame);

    const printWindow = printFrame.contentWindow;

    // Gerar linhas da tabela de eventos
    let tableRows = '';
    const dayNames = ['DOMINGO', 'SEGUNDA-FEIRA', 'TERÇA-FEIRA', 'QUARTA-FEIRA', 'QUINTA-FEIRA', 'SEXTA-FEIRA', 'SÁBADO'];

    if (filteredEvents.length === 0) {
        tableRows = `
            <tr>
                <td colspan="7" style="text-align: center; padding: 24px; color: #6b7280; font-weight: bold; font-size: 12px; text-transform: uppercase;">
                    Nenhuma programação encontrada para este mês.
                </td>
            </tr>
        `;
    } else {
        filteredEvents.forEach(ev => {
            const evDate = new Date(ev.date + 'T12:00:00');
            
            // Formatador manual de data para evitar problemas de fuso horário do toLocaleDateString
            const formattedDate = `${String(evDate.getDate()).padStart(2, '0')}/${String(evDate.getMonth() + 1).padStart(2, '0')}/${evDate.getFullYear()}`;
            const dayOfWeek = dayNames[evDate.getDay()];
            
            let statusBadgeColor = "background: #f3f4f6; color: #374151;";
            let statusText = "PENDENTE";
            
            if (ev.status === 'REALIZADO' || ev.status === 'FINALIZED') {
                statusBadgeColor = "background: #d1fae5; color: #065f46;";
                statusText = "REALIZADO";
            } else if (ev.status === 'NAO_REALIZADO') {
                statusBadgeColor = "background: #fee2e2; color: #991b1b;";
                statusText = "NÃO REALIZADO";
            }

            tableRows += `
                <tr style="border-bottom: 1px solid #e5e7eb;">
                    <td style="padding: 10px 8px; text-align: left; text-transform: uppercase;">${ev.empresa}</td>
                    <td style="padding: 10px 8px; text-align: left; font-weight: bold;">${ev.equipamento}</td>
                    <td style="padding: 10px 8px; text-align: left; text-transform: uppercase; color: #4b5563;">${ev.tipo || '---'}</td>
                    <td style="padding: 10px 8px; text-align: left; text-transform: uppercase; color: #4b5563;">${ev.local || '---'}</td>
                    <td style="padding: 10px 8px; text-align: left; font-weight: bold;">${formattedDate}</td>
                    <td style="padding: 10px 8px; text-align: left; color: #4b5563; text-transform: uppercase;">${dayOfWeek}</td>
                </tr>
            `;
        });
    }

    printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Agenda de Inspeções - ${monthYearStr}</title>
    <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap');
        
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: 'Inter', sans-serif;
            color: #1f2937;
            background: #ffffff;
            line-height: 1.4;
            font-size: 11px;
            padding: 24px;
        }

        .header-container {
            display: grid;
            grid-template-columns: auto 1fr;
            gap: 20px;
            align-items: center;
            border-bottom: 2px solid #1f2937;
            padding-bottom: 16px;
            margin-bottom: 20px;
        }

        .logo-box {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .company-details {
            text-align: right;
            font-size: 10px;
            color: #4b5563;
        }

        .company-details h1 {
            font-size: 16px;
            font-weight: 800;
            color: #111827;
            margin-bottom: 4px;
            text-transform: uppercase;
        }

        .document-title {
            text-align: center;
            background: #f3f4f6;
            border: 1px solid #e5e7eb;
            color: #111827;
            font-size: 13px;
            font-weight: 800;
            text-transform: uppercase;
            padding: 10px;
            margin-bottom: 20px;
            border-radius: 6px;
            letter-spacing: 0.5px;
        }

        table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 10px;
        }

        th {
            background: #1f2937;
            color: #ffffff;
            font-weight: 700;
            font-size: 9px;
            text-transform: uppercase;
            padding: 10px 8px;
            text-align: left;
            border: 1px solid #1f2937;
        }

        td {
            padding: 10px 8px;
            border: 1px solid #e5e7eb;
            font-size: 9px;
        }

        @media print {
            body {
                padding: 10px;
            }
            button {
                display: none;
            }
        }
    </style>
</head>
<body>
    <!-- CABEÇALHO -->
    <div class="header-container">
        <div class="logo-box">
            ${companyLogo}
        </div>
        <div class="company-details">
            <h1>${companyName}</h1>
            <div>CNPJ: ${companyCnpj}</div>
            <div>Endereço: ${companyAddress}</div>
            <div>CEP: ${companyCep} | Cidade: ${companyCityState}</div>
        </div>
    </div>

    <!-- TÍTULO DO DOCUMENTO -->
    <div class="document-title">
        Agenda Mensal de Manutenção e Inspeção - ${monthYearStr}
    </div>

    <!-- TABELA DE ATIVOS -->
    <table>
        <thead>
            <tr>
                <th style="width: 30%">Cliente / Empresa</th>
                <th style="width: 15%">ID Equipamento</th>
                <th style="width: 15%">Tipo</th>
                <th style="width: 16%">Localização</th>
                <th style="width: 12%">Prox. Inspeção</th>
                <th style="width: 12%">Dia Semana</th>
            </tr>
        </thead>
        <tbody>
            ${tableRows}
        </tbody>
    </table>

    <script>
        window.onload = function() {
            setTimeout(function() {
                window.focus();
                window.print();
            }, 300);
        };
    </script>
</body>
</html>
    `);
    printWindow.document.close();
};

function maskCNPJ(value) {
    const digits = value.replace(/\D/g, '').substring(0, 14);
    let masked = '';
    if (digits.length > 0) {
        masked += digits.substring(0, 2);
    }
    if (digits.length > 2) {
        masked += '.' + digits.substring(2, 5);
    }
    if (digits.length > 5) {
        masked += '.' + digits.substring(5, 8);
    }
    if (digits.length > 8) {
        masked += '/' + digits.substring(8, 12);
    }
    if (digits.length > 12) {
        masked += '-' + digits.substring(12, 14);
    }
    return masked;
}

function maskCEP(value) {
    const digits = value.replace(/\D/g, '').substring(0, 8);
    let masked = '';
    if (digits.length > 0) {
        masked += digits.substring(0, 5);
    }
    if (digits.length > 5) {
        masked += '-' + digits.substring(5, 8);
    }
    return masked;
}

window.reloadAppDataAndUI = async function() {
    if (isSupabaseConfigured) {
        await syncAllFromSupabase();
    }
    await loadAllDataFromDB();

    const dbAssets = await getDBValue('crane_assets', assets);
    updateArrayInPlace(assets, dbAssets);

    const dbEvents = await getDBValue('crane_events', events);
    updateArrayInPlace(events, dbEvents);
    updateArrayInPlace(events, eventsList);

    const dbOpenOrders = await getDBValue('crane_open_orders', openOrders);
    updateArrayInPlace(openOrders, dbOpenOrders);

    const dbFinalizedReports = await getDBValue('crane_reports', finalizedReports);
    updateArrayInPlace(finalizedReports, dbFinalizedReports);

    runMigrationsAndSync();

    if (typeof renderCompanies === 'function') renderCompanies();
    if (typeof renderAssets === 'function') renderAssets();
    if (typeof window.renderCalendar === 'function') window.renderCalendar();
    if (typeof renderAtivosView === 'function') renderAtivosView();
    if (typeof renderReportsView === 'function') renderReportsView();
};

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Carrega todos os dados do IndexedDB para as variáveis globais
    await loadAllDataFromDB();
    
    // 2. Carrega as listas locais do app.js vindas do DB mantendo as referências originais de memória intactas
    const dbAssets = await getDBValue('crane_assets', assets);
    updateArrayInPlace(assets, dbAssets);

    const dbEvents = await getDBValue('crane_events', events);
    updateArrayInPlace(events, dbEvents);
    updateArrayInPlace(events, eventsList);

    const dbOpenOrders = await getDBValue('crane_open_orders', openOrders);
    updateArrayInPlace(openOrders, dbOpenOrders);

    const dbFinalizedReports = await getDBValue('crane_reports', finalizedReports);
    updateArrayInPlace(finalizedReports, dbFinalizedReports);

    // Carrega modelos dinâmicos de inspeção e de ativos
    try {
        await Promise.all([loadTemplates(), loadAssetTemplates()]);
    } catch (e) {
        console.warn('CRANE PRO: Erro ao carregar templates na inicialização:', e);
    }

    // 3. Roda as migrações com os dados atualizados do DB
    runMigrationsAndSync();
    
    renderCompanies();
    renderAssets();
    renderCalendar();
    window.initCalendarVisibility();
    
    // Add masks for CNPJ and CEP
    const cnpjInput = document.getElementById('reg-empresa-cnpj');
    if (cnpjInput) {
        cnpjInput.addEventListener('input', (e) => {
            e.target.value = maskCNPJ(e.target.value);
        });
    }
    const cepInput = document.getElementById('reg-empresa-cep');
    if (cepInput) {
        cepInput.addEventListener('input', (e) => {
            e.target.value = maskCEP(e.target.value);
        });
    }

    const editCnpjInput = document.getElementById('edit-company-cnpj-input');
    if (editCnpjInput) {
        editCnpjInput.addEventListener('input', (e) => {
            e.target.value = maskCNPJ(e.target.value);
        });
    }
    const editCepInput = document.getElementById('edit-company-cep-input');
    if (editCepInput) {
        editCepInput.addEventListener('input', (e) => {
            e.target.value = maskCEP(e.target.value);
        });
    }
    
    console.log('CRANE PRO: Aplicação inicializada com sucesso.');
});

function renderAtivosView() {
    const tbody = document.getElementById('assets-view-tbody');
    if (!tbody) return;

    const currentList = companies || [];
    if (currentList.length === 0) {
        renderCompaniesUI('assets-view-companies-tbody', [], '', () => {});
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-on-surface-variant uppercase font-bold text-label-md">NENHUMA EMPRESA OU ATIVO CADASTRADO</td></tr>`;
        selectedCompany = "";
        return;
    }

    const validCompany = currentList.find(c => {
        const name = typeof c === 'string' ? c : (c?.name || "");
        return name.toLowerCase() === (selectedCompany || "").toLowerCase();
    });
    if (!validCompany || !selectedCompany) {
        const firstComp = currentList[0];
        selectedCompany = typeof firstComp === 'string' ? firstComp : (firstComp?.name || "");
    }

    // Sidebar de empresas na vista de ativos
    renderCompaniesUI('assets-view-companies-tbody', companies, selectedCompany, (company) => {
        selectedCompany = company;
        renderAtivosView();
    });

    const filteredAssets = allAssetsList
        .filter(a => a.empresa && selectedCompany && a.empresa.toLowerCase() === selectedCompany.toLowerCase())
        .sort((a, b) => {
            const numA = parseInt(String(a.id || '').replace(/\D+/g, ''), 10) || 0;
            const numB = parseInt(String(b.id || '').replace(/\D+/g, ''), 10) || 0;
            if (numA !== numB) return numA - numB;
            return String(a.id || '').localeCompare(String(b.id || ''), undefined, { numeric: true });
        });
    
    tbody.innerHTML = filteredAssets.map(a => {
        const customFields = a.custom_fields || a.customFields || {};
        let displayCapacidade = a.capacidade;
        if (!displayCapacidade && customFields) {
            const capKey = Object.keys(customFields).find(k => k.toLowerCase().includes('capacidade') || k.toLowerCase().includes('peso'));
            if (capKey && customFields[capKey]) displayCapacidade = customFields[capKey];
        }

        let displayVao = a.vao;
        if (!displayVao && customFields) {
            const vaoKey = Object.keys(customFields).find(k => k.toLowerCase().includes('vao') || k.toLowerCase().includes('ano') || k.toLowerCase().includes('data'));
            if (vaoKey && customFields[vaoKey]) displayVao = customFields[vaoKey];
        }

        return `
        <tr class="hover:bg-surface-container transition-colors duration-200 group border-b border-outline-variant/60">
            <td class="px-card_padding py-3 text-label-md font-bold uppercase text-on-surface truncate">
                <span class="truncate">${a.id}</span>
            </td>
            <td class="px-card_padding py-3 text-label-md uppercase text-on-surface-variant truncate" title="${(a.local || 'N/A').toUpperCase()}">${(a.local || 'N/A').toUpperCase()}</td>
            <td class="px-card_padding py-3 text-label-md uppercase text-on-surface-variant truncate" title="${(a.tipo || a.nome || 'N/A').toUpperCase()}">${(a.tipo || a.nome || 'N/A').toUpperCase()}</td>
            <td class="px-card_padding py-3 text-label-md uppercase text-on-surface-variant truncate" title="${(displayCapacidade || 'N/A').toUpperCase()}">${(displayCapacidade || 'N/A').toUpperCase()}</td>
            <td class="px-card_padding py-3 text-label-md uppercase text-on-surface-variant truncate" title="${(displayVao || 'N/A').toUpperCase()}">${(displayVao || 'N/A').toUpperCase()}</td>
            <td class="px-card_padding py-3 text-label-md uppercase text-on-surface-variant truncate" title="${(a.fabricante || 'N/A').toUpperCase()}">${(a.fabricante || 'N/A').toUpperCase()}</td>
        </tr>
        `;
    }).join('') || `<tr><td colspan="6" class="p-8 text-center text-on-surface-variant uppercase font-bold text-label-md">NENHUM ATIVO TÉCNICO ENCONTRADO PARA ESTA EMPRESA</td></tr>`;
}

window.renderAtivosView = renderAtivosView;

// --- UNIFIED REGISTRATION ---

window.openUnifiedRegistrationModal = async function() {
    const modal = document.getElementById('modal-unified-registration');
    const panel = modal.querySelector('.relative');
    const typeSelect = document.getElementById('reg-type-select');
    
    typeSelect.value = 'empresa';
    window.handleRegistrationTypeChange();
    
    // Fill company dropdowns
    const selectAtivo = document.getElementById('reg-ativo-empresa');
    const selectEditEmpresa = document.getElementById('reg-edit-empresa');
    const list = companies || [];
    const companyOptions = list.map(c => {
        const name = typeof c === 'string' ? c : (c?.name || "");
        return `<option value="${name}">${name.toUpperCase()}</option>`;
    }).join('');
    
    selectAtivo.innerHTML = companyOptions;
    selectEditEmpresa.innerHTML = `<option value="">SELECIONAR...</option>` + companyOptions;
    document.getElementById('reg-edit-ativo-id').innerHTML = `<option value="">SELECIONAR EMPRESA PRIMEIRO</option>`;

    // Popular templates de ativo
    const tplSelect = document.getElementById('reg-ativo-template-select');
    if (tplSelect) populateAssetTemplateDropdown(tplSelect);

    // Clear Empresa fields
    ['reg-empresa-name', 'reg-empresa-cnpj', 'reg-empresa-endereco', 'reg-empresa-numero', 'reg-empresa-bairro', 'reg-empresa-cep', 'reg-empresa-referencia', 'reg-empresa-cidade', 'reg-empresa-estado'].forEach(id => {
        document.getElementById(id).value = '';
    });
    document.getElementById('logo-preview-container').innerHTML = '<span class="material-symbols-outlined text-zinc-400">add_a_photo</span>';
    window.currentLogoBase64 = null;

    // Clear Ativo fields
    [
        'reg-ativo-id', 'reg-ativo-tipo', 'reg-ativo-local', 'reg-ativo-fabricante',
        'reg-ativo-capacidade-principal', 'reg-ativo-cabo-principal',
        'reg-ativo-capacidade-auxiliar', 'reg-ativo-cabo-auxiliar',
        'reg-ativo-altura-elevacao', 'reg-ativo-vao-ponte',
        'reg-ativo-tensao-alimentacao', 'reg-ativo-tensao-comando',
        'reg-ativo-alimentacao-equipamento',
        'reg-ativo-motor-elev-principal-alta', 'reg-ativo-motor-elev-principal-baixa',
        'reg-ativo-motor-elev-auxiliar-alta', 'reg-ativo-motor-elev-auxiliar-baixa',
        'reg-ativo-motor-direcao-carro', 'reg-ativo-motor-translacao-ponte'
    ].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.value = '';
            el.disabled = false;
        }
    });
    const initialTipoEl = document.getElementById('reg-ativo-tipo');
    if (initialTipoEl) initialTipoEl.value = 'PONTE ROLANTE VIGA DUPLA';

    modal.classList.remove('hidden');
    setTimeout(() => {
        panel.classList.remove('opacity-0', 'scale-95');
        panel.classList.add('opacity-100', 'scale-100');
    }, 10);
};

window.handleRegistrationTypeChange = function(keepFields = false) {
    const type = document.getElementById('reg-type-select').value;
    const fieldsEmpresa = document.getElementById('reg-fields-empresa');
    const fieldsAtivo = document.getElementById('reg-fields-ativo');
    const editSelectors = document.getElementById('reg-edit-selectors');
    const empresaContainer = document.getElementById('reg-ativo-empresa-container');
    
    // Reset fields visibility
    fieldsEmpresa.classList.add('hidden');
    fieldsAtivo.classList.add('hidden');
    editSelectors.classList.add('hidden');
    empresaContainer.classList.remove('hidden');

    // Popula templates de ativos no select
    const tplSelect = document.getElementById('reg-ativo-template-select');
    if (tplSelect) populateAssetTemplateDropdown(tplSelect);

    function clearEmpresaFields() {
        ['reg-empresa-name', 'reg-empresa-cnpj', 'reg-empresa-endereco', 'reg-empresa-numero', 'reg-empresa-bairro', 'reg-empresa-cep', 'reg-empresa-referencia'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        const preview = document.getElementById('logo-preview-container');
        if (preview) preview.innerHTML = '<span class="material-symbols-outlined text-zinc-400">add_a_photo</span>';
        window.currentLogoBase64 = null;
    }

    function clearAtivoFields() {
        [
            'reg-ativo-id', 'reg-ativo-tipo', 'reg-ativo-local', 'reg-ativo-fabricante',
            'reg-ativo-capacidade-principal', 'reg-ativo-cabo-principal',
            'reg-ativo-capacidade-auxiliar', 'reg-ativo-cabo-auxiliar',
            'reg-ativo-altura-elevacao', 'reg-ativo-vao-ponte',
            'reg-ativo-tensao-alimentacao', 'reg-ativo-tensao-comando',
            'reg-ativo-alimentacao-equipamento',
            'reg-ativo-motor-elev-principal-alta', 'reg-ativo-motor-elev-principal-baixa',
            'reg-ativo-motor-elev-auxiliar-alta', 'reg-ativo-motor-elev-auxiliar-baixa',
            'reg-ativo-motor-direcao-carro', 'reg-ativo-motor-translacao-ponte'
        ].forEach(id => {
            const el = document.getElementById(id);
            if (el) {
                el.value = '';
                el.disabled = false;
            }
        });
        const tipoEl = document.getElementById('reg-ativo-tipo');
        if (tipoEl) tipoEl.value = 'PONTE ROLANTE VIGA DUPLA';
        const dynamicWrapper = document.getElementById('reg-ativo-dynamic-fields-wrapper');
        const dynamicContainer = document.getElementById('reg-ativo-dynamic-fields');
        const defaultExtendedFields = document.getElementById('reg-ativo-default-extended-fields');
        if (defaultExtendedFields) defaultExtendedFields.classList.remove('hidden');
        if (dynamicWrapper) dynamicWrapper.classList.add('hidden');
        if (dynamicContainer) dynamicContainer.innerHTML = '';
        if (tplSelect) tplSelect.value = '';
    }

    const btnCancel = document.getElementById('reg-btn-cancel');
    if (btnCancel) {
        if (type === 'edit-ativo') {
            btnCancel.textContent = 'EXCLUIR';
            btnCancel.className = 'p-card_padding border border-error text-error font-bold uppercase hover:bg-error-container/10 transition-all rounded-xl cursor-pointer text-center';
            btnCancel.onclick = () => window.deleteAssetFromModal();
        } else {
            btnCancel.textContent = 'CANCELAR';
            btnCancel.className = 'p-card_padding border border-outline text-on-surface-variant font-bold uppercase hover:bg-surface-container transition-all rounded-xl cursor-pointer text-center';
            btnCancel.onclick = () => window.closeUnifiedRegistrationModal();
        }
    }

    if (type === 'empresa') {
        fieldsEmpresa.classList.remove('hidden');
        if (!keepFields) clearEmpresaFields();
    } else if (type === 'ativo') {
        fieldsAtivo.classList.remove('hidden');
        const idInput = document.getElementById('reg-ativo-id');
        if (idInput) {
            idInput.readOnly = true;
            idInput.classList.add('bg-zinc-100', 'cursor-not-allowed');
        }
        if (!keepFields) {
            clearAtivoFields();
            // Preenche automaticamente o próximo ID sequencial
            reserveNextAssetId().then(res => {
                const idEl = document.getElementById('reg-ativo-id');
                if (idEl && (!idEl.value || idEl.value.trim() === '')) {
                    idEl.value = res.id;
                }
            }).catch(err => {
                console.warn('CRANE PRO: Erro ao obter próximo ID sequencial:', err);
            });
        }
    } else if (type === 'edit-ativo') {
        fieldsAtivo.classList.remove('hidden');
        editSelectors.classList.remove('hidden');
        empresaContainer.classList.add('hidden');
        const idInput = document.getElementById('reg-ativo-id');
        if (idInput) {
            idInput.readOnly = true;
            idInput.classList.add('bg-zinc-100', 'cursor-not-allowed');
        }
        
        if (!keepFields) {
            const selectEditEmpresa = document.getElementById('reg-edit-empresa');
            if (selectEditEmpresa) selectEditEmpresa.value = '';
            const selectEditAtivo = document.getElementById('reg-edit-ativo-id');
            if (selectEditAtivo) selectEditAtivo.innerHTML = '<option value="">SELECIONAR EMPRESA PRIMEIRO</option>';
            clearAtivoFields();
        }
    }
};

window.handleAssetTemplateChange = function(prefilledValues = null) {
    const templateSelect = document.getElementById('reg-ativo-template-select');
    const templateId = templateSelect ? templateSelect.value : '';
    const wrapper = document.getElementById('reg-ativo-dynamic-fields-wrapper');
    const container = document.getElementById('reg-ativo-dynamic-fields');
    const defaultExtendedFields = document.getElementById('reg-ativo-default-extended-fields');
    const tipoInput = document.getElementById('reg-ativo-tipo');
    
    if (!wrapper || !container) return;

    if (!templateId) {
        // Padrão: PONTE ROLANTE VIGA DUPLA
        if (defaultExtendedFields) defaultExtendedFields.classList.remove('hidden');
        wrapper.classList.add('hidden');
        container.innerHTML = '';
        if (tipoInput) {
            tipoInput.value = 'PONTE ROLANTE VIGA DUPLA';
        }
        return;
    }

    const tpl = getAssetTemplateById(templateId);
    if (!tpl) {
        if (defaultExtendedFields) defaultExtendedFields.classList.remove('hidden');
        wrapper.classList.add('hidden');
        container.innerHTML = '';
        if (tipoInput) {
            tipoInput.value = 'PONTE ROLANTE VIGA DUPLA';
        }
        return;
    }

    // Modelo customizado selecionado: OCULTA SEMPRE os 14 campos estendidos legados do padrão Crane Pro!
    if (defaultExtendedFields) defaultExtendedFields.classList.add('hidden');

    // Preenche automaticamente o campo Tipo com o nome/tipo do modelo selecionado
    if (tipoInput) {
        tipoInput.value = (tpl.nome || tpl.tipoEquipamento || '').toUpperCase();
    }

    const customFields = Array.isArray(tpl.customFields) ? tpl.customFields : [];
    if (customFields.length > 0) {
        container.innerHTML = '';
        customFields.forEach(f => {
            const fieldDiv = document.createElement('div');
            fieldDiv.className = 'space-y-stack_sm';
            const fieldId = f.id || `cf_${(f.label || '').toLowerCase().replace(/[^a-z0-9]/g, '_')}`;
            
            let val = '';
            if (prefilledValues && typeof prefilledValues === 'object') {
                if (prefilledValues[fieldId] !== undefined) {
                    val = prefilledValues[fieldId];
                } else if (f.label) {
                    const labelKey = Object.keys(prefilledValues).find(k => k.toLowerCase() === f.label.toLowerCase() || k.toLowerCase().replace(/[^a-z0-9]/g, '_') === fieldId);
                    if (labelKey && prefilledValues[labelKey] !== undefined) val = prefilledValues[labelKey];
                }
            }

            let inputHtml = '';
            if (f.type === 'number') {
                inputHtml = `
                    <input type="number" step="any" data-field-id="${fieldId}" value="${val}" class="reg-dynamic-field-input w-full bg-surface-container-low border border-outline py-2.5 px-4 text-body-md font-bold uppercase text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all rounded-xl" placeholder="0.00">
                `;
            } else if (f.type === 'date') {
                inputHtml = `
                    <input type="date" data-field-id="${fieldId}" value="${val}" class="reg-dynamic-field-input w-full bg-surface-container-low border border-outline py-2.5 px-4 text-body-md font-bold uppercase text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all rounded-xl">
                `;
            } else {
                inputHtml = `
                    <input type="text" data-field-id="${fieldId}" value="${val}" class="reg-dynamic-field-input w-full bg-surface-container-low border border-outline py-2.5 px-4 text-body-md font-bold uppercase text-on-surface focus:ring-2 focus:ring-primary outline-none transition-all rounded-xl" placeholder="PREENCHA...">
                `;
            }

            fieldDiv.innerHTML = `
                <label class="text-label-md text-on-surface-variant uppercase font-bold">${f.label}</label>
                ${inputHtml}
            `;
            container.appendChild(fieldDiv);
        });
        wrapper.classList.remove('hidden');
    } else {
        // Modelo com 0 campos customizados adicionais: oculta campos customizados e mantém APENAS os 7 fixos
        wrapper.classList.add('hidden');
        container.innerHTML = '';
    }
};

window.deleteAssetFromModal = function() {
    const assetId = document.getElementById('reg-edit-ativo-id').value;
    if (!assetId) {
        return window.showAlert('SELECIONE UM ATIVO PARA EXCLUIR.', 'warning');
    }
    
    window.showAlert(`DESEJA EXCLUIR O ATIVO "${assetId}" E TODOS OS SEUS EVENTOS E HISTÓRICOS?`, 'warning', () => {
        // Exclui o ativo do banco de dados na nuvem (Supabase)
        deleteAssetFromCloud(assetId);

        // 1. Remove from allAssetsList
        const newAllAssets = allAssetsList.filter(a => a.id !== assetId);
        setAllAssetsList(newAllAssets);
        
        // 2. Remove from assets (dashboard list)
        assets = assets.filter(a => a.id !== assetId);
        setStoredData('crane_assets', assets);
        
        // 3. Remove from events (calendar events)
        const eventsToDelete = events.filter(ev => ev.id === assetId || ev.equipamento === assetId);
        events = events.filter(ev => ev.id !== assetId && ev.equipamento !== assetId);
        setStoredData('crane_events', events);
        eventsToDelete.forEach(ev => deleteEventFromCloud(ev.id));
        
        // 4. Remove from openOrders
        const ordersToDelete = openOrders.filter(order => order.equipamentoId === assetId || order.equipamento === assetId);
        setOpenOrders(openOrders.filter(order => order.equipamentoId !== assetId && order.equipamento !== assetId));
        ordersToDelete.forEach(ord => deleteOrderFromCloud(ord.id));
        
        // 5. Remove from finalizedReports
        const reportsToDelete = finalizedReports.filter(rep => rep.equipamentoId === assetId || rep.equipamento === assetId);
        setFinalizedReports(finalizedReports.filter(rep => rep.equipamentoId !== assetId && rep.equipamento !== assetId));
        reportsToDelete.forEach(rep => deleteReportFromCloud(rep.id));
        
        // Close modal and refresh UI
        window.closeUnifiedRegistrationModal();
        renderCompanies();
        renderAssets();
        if (currentView === 'assets') renderAtivosView();
        window.renderCalendar();
        
        window.showAlert('ATIVO EXCLUÍDO COM SUCESSO.', 'success');
    });
};

window.updateEditAssetList = function() {
    const empresa = document.getElementById('reg-edit-empresa').value;
    const selectAtivo = document.getElementById('reg-edit-ativo-id');
    
    if (!empresa) {
        selectAtivo.innerHTML = `<option value="">SELECIONAR EMPRESA PRIMEIRO</option>`;
        return;
    }

    const filtered = allAssetsList
        .filter(a => a.empresa && empresa && a.empresa.toLowerCase() === empresa.toLowerCase())
        .sort((a, b) => (a.id || '').localeCompare(b.id || '', 'pt-BR', { numeric: true, sensitivity: 'base' }));
    if (filtered.length === 0) {
        selectAtivo.innerHTML = `<option value="">NENHUM ATIVO ENCONTRADO</option>`;
    } else {
        selectAtivo.innerHTML = `<option value="">SELECIONAR ATIVO...</option>` + 
            filtered.map(a => `<option value="${a.id}">${a.id} - ${(a.nome || a.tipo || '').toUpperCase()}</option>`).join('');
    }
};

window.loadAssetDataForEdit = function() {
    const id = document.getElementById('reg-edit-ativo-id').value;
    if (!id) return;

    const asset = allAssetsList.find(a => a.id === id);
    if (asset) {
        document.getElementById('reg-ativo-id').value = asset.id || '';
        document.getElementById('reg-ativo-tipo').value = (asset.tipo || asset.nome || "").toUpperCase();
        document.getElementById('reg-ativo-local').value = (asset.local || "").toUpperCase();
        document.getElementById('reg-ativo-fabricante').value = (asset.fabricante || "").toUpperCase();
        
        // Remove sufixos para o input numérico e preenche
        document.getElementById('reg-ativo-capacidade-principal').value = (asset.capacidade || asset.capacidadePrincipal || "").replace(/[^\d.]/g, '');
        document.getElementById('reg-ativo-cabo-principal').value = asset.caboPrincipal || asset.caboprincipal || '';
        document.getElementById('reg-ativo-capacidade-auxiliar').value = (asset.capacidadeAuxiliar || asset.capacidadeauxiliar || "").replace(/[^\d.]/g, '');
        document.getElementById('reg-ativo-cabo-auxiliar').value = asset.caboAuxiliar || asset.caboauxiliar || '';
        document.getElementById('reg-ativo-altura-elevacao').value = (asset.altura || asset.alturaElevacao || "").replace(/[^\d.]/g, '');
        document.getElementById('reg-ativo-vao-ponte').value = (asset.vao || asset.vaoPonte || "").replace(/[^\d.]/g, '');
        
        document.getElementById('reg-ativo-tensao-alimentacao').value = asset.tensaoAlimentacao || asset.tensaoalimentacao || '';
        document.getElementById('reg-ativo-tensao-comando').value = asset.tensaoComando || asset.tensaocomando || '';
        document.getElementById('reg-ativo-alimentacao-equipamento').value = asset.alimentacaoEquipamento || asset.alimentacaoequipamento || '';
        document.getElementById('reg-ativo-motor-elev-principal-alta').value = asset.motorElevPrincipalAlta || asset.motorelevprincipalalta || '';
        document.getElementById('reg-ativo-motor-elev-principal-baixa').value = asset.motorElevPrincipalBaixa || asset.motorelevprincipalbaixa || '';
        document.getElementById('reg-ativo-motor-elev-auxiliar-alta').value = asset.motorElevAuxiliarAlta || asset.motorelevauxiliaralta || '';
        document.getElementById('reg-ativo-motor-elev-auxiliar-baixa').value = asset.motorElevAuxiliarBaixa || asset.motorelevauxiliarbaixa || '';
        document.getElementById('reg-ativo-motor-direcao-carro').value = asset.motorDirecaoCarro || asset.motordirecaocarro || '';
        document.getElementById('reg-ativo-motor-translacao-ponte').value = asset.motorTranslacaoPonte || asset.motortranslacaoponte || '';

        // Carrega template de ativo e campos customizados se existirem
        const tplSelect = document.getElementById('reg-ativo-template-select');
        if (tplSelect) {
            let targetTemplateId = asset.template_id || asset.templateId || '';
            
            // Se não houver template_id explícito gravado, busca template correspondente por tipo de equipamento ou nome
            if (!targetTemplateId) {
                const assetTipoNorm = (asset.tipo || asset.nome || '').trim().toLowerCase();
                const availableTemplates = getAssetTemplates() || [];
                const matchedTpl = availableTemplates.find(t => {
                    const tNome = (t.nome || '').trim().toLowerCase();
                    const tTipo = (t.tipoEquipamento || '').trim().toLowerCase();
                    return tNome === assetTipoNorm || tTipo === assetTipoNorm || (assetTipoNorm && tNome && (assetTipoNorm.includes(tNome) || tNome.includes(assetTipoNorm)));
                });
                if (matchedTpl) {
                    targetTemplateId = matchedTpl.id;
                }
            }

            populateAssetTemplateDropdown(tplSelect, targetTemplateId);
            tplSelect.value = targetTemplateId || '';

            if (targetTemplateId) {
                window.handleAssetTemplateChange(asset.custom_fields || asset.customFields || asset);
            } else {
                window.handleAssetTemplateChange();
            }
        }
    }
};

window.saveUnifiedRegistration = async function() {
    const type = document.getElementById('reg-type-select').value;

    if (type === 'empresa') {
        const name = document.getElementById('reg-empresa-name').value.trim();
        const cnpj = document.getElementById('reg-empresa-cnpj').value.trim();
        const endereco = document.getElementById('reg-empresa-endereco').value.trim();
        const numero = document.getElementById('reg-empresa-numero').value.trim();
        const bairro = document.getElementById('reg-empresa-bairro').value.trim();
        const cep = document.getElementById('reg-empresa-cep').value.trim();
        const cidade = document.getElementById('reg-empresa-cidade').value.trim().toUpperCase();
        const estado = document.getElementById('reg-empresa-estado').value.trim().toUpperCase();
        const referencia = document.getElementById('reg-empresa-referencia').value.trim();
        const logo = window.currentLogoBase64 || "";

        if (!name) return window.showAlert('O NOME DA EMPRESA É OBRIGATÓRIO.', 'warning');

        const existingComp = companies.find(c => {
            const cName = typeof c === 'string' ? c : (c?.name || "");
            return cName.toLowerCase() === name.toLowerCase();
        });
        if (existingComp) {
            return window.showAlert(`⚠️ A EMPRESA "${name.toUpperCase()}" JÁ ESTÁ CADASTRADA. CASO DESEJE ALTERAR SEUS DADOS, UTILIZE A OPÇÃO EDITAR.`, 'warning');
        }

        const id = 'comp_' + (cnpj ? cnpj.replace(/\D+/g, '') : (Date.now() + '_' + name.toLowerCase().replace(/\W+/g, '_')));
        const newCompany = { id, name, cnpj, endereco, numero, bairro, cep, cidade, estado, referencia, logo };
        setCompanies([...companies, newCompany]);
        selectedCompany = name;
        
        window.showAlert('NOVA EMPRESA CADASTRADA COM SUCESSO!', 'success');
    } else {
        // Lógica para Novo Ativo OU Edição de Ativo
        const isEdit = type === 'edit-ativo';
        const oldId = isEdit ? document.getElementById('reg-edit-ativo-id').value : null;
        const empresa = isEdit ? document.getElementById('reg-edit-empresa').value : document.getElementById('reg-ativo-empresa').value;
        const id = document.getElementById('reg-ativo-id').value.trim();
        const tipo = document.getElementById('reg-ativo-tipo').value.trim();
        const local = document.getElementById('reg-ativo-local').value.trim();
        const fabricante = document.getElementById('reg-ativo-fabricante').value.trim();

        const capPrincipalRaw = document.getElementById('reg-ativo-capacidade-principal').value.trim();
        const caboPrincipal = document.getElementById('reg-ativo-cabo-principal').value.trim();
        const capAuxiliarRaw = document.getElementById('reg-ativo-capacidade-auxiliar').value.trim();
        const caboAuxiliar = document.getElementById('reg-ativo-cabo-auxiliar').value.trim();
        const alturaRaw = document.getElementById('reg-ativo-altura-elevacao').value.trim();
        const vaoRaw = document.getElementById('reg-ativo-vao-ponte').value.trim();
        
        const tensaoAlimentacao = document.getElementById('reg-ativo-tensao-alimentacao').value.trim();
        const tensaoComando = document.getElementById('reg-ativo-tensao-comando').value.trim();
        const alimentacaoEquipamento = document.getElementById('reg-ativo-alimentacao-equipamento').value.trim();
        const motorElevPrincipalAlta = document.getElementById('reg-ativo-motor-elev-principal-alta').value.trim();
        const motorElevPrincipalBaixa = document.getElementById('reg-ativo-motor-elev-principal-baixa').value.trim();
        const motorElevAuxiliarAlta = document.getElementById('reg-ativo-motor-elev-auxiliar-alta').value.trim();
        const motorElevAuxiliarBaixa = document.getElementById('reg-ativo-motor-elev-auxiliar-baixa').value.trim();
        const motorDirecaoCarro = document.getElementById('reg-ativo-motor-direcao-carro').value.trim();
        const motorTranslacaoPonte = document.getElementById('reg-ativo-motor-translacao-ponte').value.trim();

        if (!empresa || !id || !tipo) return window.showAlert('PREENCHA TODOS OS CAMPOS OBRIGATÓRIOS.', 'warning');

        // Bloqueio rigoroso contra duplicidade de ID na criação de novo ativo
        if (!isEdit) {
            const existingAsset = allAssetsList.find(a => {
                if (!a || !a.id) return false;
                const parseA = parseAssetSequenceNumber(a.id);
                const parseCurr = parseAssetSequenceNumber(id);
                if (parseA && parseCurr && parseA === parseCurr) return true;
                return String(a.id).trim().toUpperCase() === String(id).trim().toUpperCase();
            });

            if (existingAsset) {
                return window.showAlert(`⚠️ O ID "${id}" JÁ ESTÁ CADASTRADO PARA O EQUIPAMENTO "${(existingAsset.nome || existingAsset.tipo).toUpperCase()}" DA EMPRESA "${(existingAsset.empresa).toUpperCase()}". POR FAVOR, UTILIZE OUTRO NÚMERO DE ID.`, 'warning');
            }
        }

        // Formata com sufixos
        const capacidade = capPrincipalRaw ? `${capPrincipalRaw} TON` : "";
        const vao = vaoRaw ? `${vaoRaw} MTS` : "";
        const altura = alturaRaw ? `${alturaRaw} MTS` : "";
        const capacidadeAuxiliar = capAuxiliarRaw ? `${capAuxiliarRaw} TON` : "";

        // Coleta campos customizados do template
        const templateSelect = document.getElementById('reg-ativo-template-select');
        const selectedTemplateId = templateSelect ? templateSelect.value : null;
        const selectedTemplate = selectedTemplateId ? getAssetTemplateById(selectedTemplateId) : null;
        
        const customFields = {};
        const dynamicInputs = document.querySelectorAll('.reg-dynamic-field-input');
        dynamicInputs.forEach(input => {
            const fId = input.getAttribute('data-field-id');
            if (fId) {
                customFields[fId] = input.value;
            }
        });

        const baseAsset = { 
            id, empresa, nome: tipo, tipo, local, fabricante,
            capacidade, caboPrincipal, capacidadeAuxiliar, caboAuxiliar,
            altura, vao, tensaoAlimentacao, tensaoComando, alimentacaoEquipamento,
            motorElevPrincipalAlta, motorElevPrincipalBaixa, motorElevAuxiliarAlta, motorElevAuxiliarBaixa,
            motorDirecaoCarro, motorTranslacaoPonte
        };

        const assetData = prepareAssetPayload(baseAsset, selectedTemplate, customFields, false);
        
        const searchId = (isEdit && oldId) ? oldId : id;

        // 1. Lista Técnica Principal
        const existingIdx = allAssetsList.findIndex(a => a.id === searchId);
        if (existingIdx !== -1) {
            allAssetsList[existingIdx] = assetData;
            setAllAssetsList(allAssetsList);
        } else {
            setAllAssetsList([...allAssetsList, assetData]);
        }

        // 2. Sincronização com Dashboard (Gestão Operacional)
        // Atualiza tanto o array 'assets' quanto o array 'events'
        const dashIdx = assets.findIndex(a => a.id === searchId);
        if (dashIdx !== -1) {
            assets[dashIdx] = { ...assets[dashIdx], id: id, empresa, local, tipo };
        } else {
            assets.push({ id, empresa, local, tipo, data: new Date().toISOString().split('T')[0] });
        }
        
        // Sincronizar também os eventos existentes
        events.forEach((ev, idx) => {
            if (ev.id == searchId || ev.equipamento == searchId) {
                events[idx] = { ...events[idx], id: id, equipamento: id, empresa, local, tipo };
            }
        });

        // Sincronizar ordens de serviço em aberto (rascunhos)
        if (isEdit && oldId) {
            if (oldId !== id) {
                // Se o ativo possuir laudos finalizados, impede a alteração de ID
                const hasFinalizedReports = finalizedReports.some(rep => rep.equipamentoId === oldId || rep.equipamento === oldId);
                if (hasFinalizedReports) {
                    return window.showAlert('O ID DO EQUIPAMENTO NÃO PODE SER ALTERADO POIS JÁ POSSUI LAUDOS FINALIZADOS EMITIDOS.', 'warning');
                }
                // Se não possuir laudos, exclui o ID antigo no Supabase
                deleteAssetFromCloud(oldId);
            }

            setOpenOrders(openOrders.map(order => {
                if (order.equipamentoId === oldId || order.equipamento === oldId) {
                    return { ...order, equipamentoId: id, equipamento: id, empresa, tipo };
                }
                return order;
            }));
            
            // Laudos finalizados são pericialmente imutáveis e jamais devem ser alterados
        }

        if (empresa) {
            selectedCompany = empresa;
        }

        setStoredData('crane_assets', assets);
        setStoredData('crane_events', events);
        
        window.showAlert(isEdit ? 'ATIVO ATUALIZADO COM SUCESSO!' : 'NOVO ATIVO CADASTRADO COM SUCESSO!', 'success');
    }

    window.closeUnifiedRegistrationModal();
    renderCompanies();
    renderAssets();
    if (currentView === 'assets') renderAtivosView();
    window.renderCalendar();
};

window.closeUnifiedRegistrationModal = function() {
    if (currentAssetLockKey) {
        releaseLock(currentAssetLockKey);
        currentAssetLockKey = null;
    }
    document.getElementById('modal-unified-registration')?.classList.add('hidden');
};

let currentCompanyLockKey = null;

window.openEditCompanyModal = async function(companyName) {
    const lockKey = `company:${companyName}`;
    const lockRes = await acquireLock(lockKey);
    if (!lockRes.success) {
        window.showAlert(`🔒 REGISTRO EM MODO EDIÇÃO POR "${lockRes.lockedBy.toUpperCase()}". AGUARDE A CONCLUSÃO.`, 'warning');
        return;
    }
    if (currentCompanyLockKey && currentCompanyLockKey !== lockKey) {
        releaseLock(currentCompanyLockKey);
    }
    currentCompanyLockKey = lockKey;

    const modal = document.getElementById('modal-edit-company');
    const panel = modal.querySelector('.relative');
    const deleteBtn = document.getElementById('btn-delete-company-sidebar');
    
    // Encontra o objeto da empresa correspondente
    const companyObj = (companies || []).find(c => {
        const name = typeof c === 'string' ? c : (c?.name || "");
        return name.toLowerCase() === companyName.toLowerCase();
    }) || { name: companyName };

    const compId = companyObj.id || ('comp_' + (companyObj.cnpj ? String(companyObj.cnpj).replace(/\D+/g, '') : companyName.toLowerCase().replace(/\W+/g, '_')));

    const idInput = document.getElementById('edit-company-id-input');
    const oldNameInput = document.getElementById('edit-company-old-name-input');
    if (idInput) idInput.value = compId;
    if (oldNameInput) oldNameInput.value = companyObj.name || companyName;

    document.getElementById('edit-company-name-input').value = (companyObj.name || "").toUpperCase();
    document.getElementById('edit-company-cnpj-input').value = companyObj.cnpj || "";
    document.getElementById('edit-company-endereco-input').value = (companyObj.endereco || "").toUpperCase();
    document.getElementById('edit-company-numero-input').value = (companyObj.numero || "").toUpperCase();
    document.getElementById('edit-company-bairro-input').value = (companyObj.bairro || "").toUpperCase();
    document.getElementById('edit-company-cep-input').value = companyObj.cep || "";
    document.getElementById('edit-company-cidade-input').value = (companyObj.cidade || "").toUpperCase();
    document.getElementById('edit-company-estado-input').value = (companyObj.estado || "").toUpperCase();
    document.getElementById('edit-company-referencia-input').value = companyObj.referencia || "";
    
    window.currentEditingCompanyName = companyName;
    window.currentEditingLogoBase64 = companyObj.logo || "";

    const preview = document.getElementById('edit-logo-preview-container');
    if (preview) {
        if (companyObj.logo) {
            preview.innerHTML = `<img src="${companyObj.logo}" class="w-full h-full object-cover" />`;
        } else {
            preview.innerHTML = `<span class="material-symbols-outlined text-on-surface-variant">add_a_photo</span>`;
        }
    }

    deleteBtn.onclick = () => {
        window.showAlert(`DESEJA EXCLUIR A EMPRESA "${companyName.toUpperCase()}" E TODOS OS SEUS ATIVOS?`, 'warning', () => {
            window.deleteCompany(companyName);
            window.closeEditCompanyModal();
        });
    };

    modal.classList.remove('hidden');
    setTimeout(() => {
        panel.classList.remove('opacity-0', 'scale-95');
        panel.classList.add('opacity-100', 'scale-100');
    }, 10);
};

let currentAssetLockKey = null;

window.openEditAssetModal = async function(assetId, companyName) {
    const lockKey = `asset:${assetId}`;
    const lockRes = await acquireLock(lockKey);
    if (!lockRes.success) {
        window.showAlert(`🔒 REGISTRO EM MODO EDIÇÃO POR "${lockRes.lockedBy.toUpperCase()}". AGUARDE A CONCLUSÃO.`, 'warning');
        return;
    }
    if (currentAssetLockKey && currentAssetLockKey !== lockKey) {
        releaseLock(currentAssetLockKey);
    }
    currentAssetLockKey = lockKey;

    const modal = document.getElementById('modal-unified-registration');
    const panel = modal.querySelector('.relative');
    const typeSelect = document.getElementById('reg-type-select');
    
    // Configura o tipo para "Editar Ativo Existente"
    typeSelect.value = 'edit-ativo';
    window.handleRegistrationTypeChange(true);
    
    // Atualiza opções de empresas e seleciona a empresa do ativo
    const selectAtivo = document.getElementById('reg-ativo-empresa');
    const selectEditEmpresa = document.getElementById('reg-edit-empresa');
    const list = companies || [];
    const companyOptions = list.map(c => {
        const name = typeof c === 'string' ? c : (c?.name || "");
        return `<option value="${name}">${name.toUpperCase()}</option>`;
    }).join('');
    
    selectAtivo.innerHTML = companyOptions;
    selectEditEmpresa.innerHTML = `<option value="">SELECIONAR...</option>` + companyOptions;
    
    // Resolve correspondência de nome de empresa de forma case-insensitive
    const foundCompanyObj = list.find(c => {
        const name = typeof c === 'string' ? c : (c?.name || "");
        return name.toLowerCase() === companyName.toLowerCase();
    });
    const matchedCompanyName = foundCompanyObj 
        ? (typeof foundCompanyObj === 'string' ? foundCompanyObj : foundCompanyObj.name) 
        : companyName;
        
    selectEditEmpresa.value = matchedCompanyName;
    
    // Atualiza a lista de ativos para a empresa selecionada
    window.updateEditAssetList();
    
    // Seleciona o ativo correto
    const selectEditAtivo = document.getElementById('reg-edit-ativo-id');
    selectEditAtivo.value = assetId;
    
    // Carrega os dados do ativo no formulário
    window.loadAssetDataForEdit();
    
    // Abre o modal
    modal.classList.remove('hidden');
    setTimeout(() => {
        panel.classList.remove('opacity-0', 'scale-95');
        panel.classList.add('opacity-100', 'scale-100');
    }, 10);
};

window.handleEditCompanyLogoPreview = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result;
        window.currentEditingLogoBase64 = base64;
        const preview = document.getElementById('edit-logo-preview-container');
        if (preview) {
            preview.innerHTML = `<img src="${base64}" class="w-full h-full object-cover" />`;
        }
    };
    reader.readAsDataURL(file);
};

window.saveCompanyChange = async function() {
    const idInput = document.getElementById('edit-company-id-input');
    const oldNameInput = document.getElementById('edit-company-old-name-input');
    const companyId = idInput ? idInput.value : '';
    const oldName = (oldNameInput && oldNameInput.value) ? oldNameInput.value.trim() : (window.currentEditingCompanyName || '');
    const newName = document.getElementById('edit-company-name-input').value.trim();
    const cnpj = document.getElementById('edit-company-cnpj-input').value.trim();
    const endereco = document.getElementById('edit-company-endereco-input').value.trim();
    const numero = document.getElementById('edit-company-numero-input').value.trim();
    const bairro = document.getElementById('edit-company-bairro-input').value.trim();
    const cep = document.getElementById('edit-company-cep-input').value.trim();
    const cidade = document.getElementById('edit-company-cidade-input').value.trim().toUpperCase();
    const estado = document.getElementById('edit-company-estado-input').value.trim().toUpperCase();
    const referencia = document.getElementById('edit-company-referencia-input').value.trim();
    const logo = window.currentEditingLogoBase64 || "";
    
    if (!newName) return window.showAlert('O NOME DA EMPRESA NÃO PODE SER VAZIO.', 'warning');

    const updatedCompany = {
        id: companyId || ('comp_' + (cnpj ? cnpj.replace(/\D+/g, '') : newName.toLowerCase().replace(/\W+/g, '_'))),
        name: newName,
        cnpj: cnpj,
        endereco: endereco,
        numero: numero,
        bairro: bairro,
        cep: cep,
        cidade: cidade,
        estado: estado,
        referencia: referencia,
        logo: logo
    };

    // 1. Atualiza in-place a lista de empresas (substituição inequívoca por ID ou nome antigo)
    let found = false;
    const newCompanies = (companies || []).map(c => {
        const cId = typeof c === 'object' && c !== null ? c.id : null;
        const cName = typeof c === 'string' ? c : (c?.name || "");
        if ((companyId && cId === companyId) || (oldName && cName.toLowerCase() === oldName.toLowerCase()) || cName.toLowerCase() === newName.toLowerCase()) {
            found = true;
            return updatedCompany;
        }
        return c;
    });

    if (!found) {
        newCompanies.push(updatedCompany);
    }

    setCompanies(newCompanies);

    // 2. Se o nome mudou, propaga para todas as outras coleções e remove o registro antigo da nuvem
    if (oldName && oldName.toLowerCase() !== newName.toLowerCase()) {
        await deleteCompanyFromCloud(oldName);

        // Atualiza allAssetsList (Master)
        const newAllAssets = allAssetsList.map(a => {
            if (a.empresa && a.empresa.toLowerCase() === oldName.toLowerCase()) return { ...a, empresa: newName };
            return a;
        });
        setAllAssetsList(newAllAssets);

        // Atualiza dashboard assets
        assets = assets.map(a => {
            if (a.empresa && a.empresa.toLowerCase() === oldName.toLowerCase()) return { ...a, empresa: newName };
            return a;
        });
        setStoredData('crane_assets', assets);

        // Atualiza eventos do calendário
        events = events.map(e => {
            if (e.empresa && e.empresa.toLowerCase() === oldName.toLowerCase()) return { ...e, empresa: newName };
            return e;
        });
        setStoredData('crane_events', events);

        // Atualiza relatórios finalizados
        setFinalizedReports(finalizedReports.map(r => {
            if (r.empresa && r.empresa.toLowerCase() === oldName.toLowerCase()) return { ...r, empresa: newName };
            return r;
        }));

        if (selectedCompany && selectedCompany.toLowerCase() === oldName.toLowerCase()) {
            selectedCompany = newName;
        }
        if (reportsSelectedCompany && reportsSelectedCompany.toLowerCase() === oldName.toLowerCase()) {
            reportsSelectedCompany = newName;
        }
    }

    window.closeEditCompanyModal();
    renderCompanies();
    renderAssets();
    window.renderCalendar();
    if (currentView === 'assets') renderAtivosView();
    if (currentView === 'reports') renderReportsView();
    window.showAlert('DADOS DA EMPRESA ATUALIZADOS COM SUCESSO!', 'success');
};

window.closeEditCompanyModal = function() {
    if (currentCompanyLockKey) {
        releaseLock(currentCompanyLockKey);
        currentCompanyLockKey = null;
    }
    document.getElementById('modal-edit-company')?.classList.add('hidden');
};

window.deleteCompany = function(empresaNome) {
    const target = empresaNome.trim().toLowerCase();
    
    // Exclui a empresa e todos os seus dados derivados do banco de dados na nuvem (Supabase)
    deleteCompanyAllDataFromCloud(empresaNome);

    // 1. Remove from companies list (objects/strings)
    const newCompanies = (companies || []).filter(c => {
        const name = typeof c === 'string' ? c : (c?.name || "");
        return name.toLowerCase() !== target;
    });
    setCompanies(newCompanies);

    // 2. Remove all assets for this company
    const newAllAssets = allAssetsList.filter(a => a.empresa.toLowerCase() !== target);
    setAllAssetsList(newAllAssets);

    // 3. Remove from dashboard assets
    assets = assets.filter(a => a.empresa.toLowerCase() !== target);
    setStoredData('crane_assets', assets);

    // 4. Remove all events for this company
    events = events.filter(e => e.empresa.toLowerCase() !== target);
    setStoredData('crane_events', events);

    // 5. Remove open orders and finalized reports for this company
    setOpenOrders(openOrders.filter(o => (o.empresa || '').trim().toLowerCase() !== target));
    setFinalizedReports(finalizedReports.filter(r => (r.empresa || '').trim().toLowerCase() !== target));

    if (selectedCompany.toLowerCase() === target) {
        const firstComp = newCompanies[0];
        selectedCompany = typeof firstComp === 'string' ? firstComp : (firstComp?.name || "");
    }

    if (reportsSelectedCompany.toLowerCase() === target) {
        const firstComp = newCompanies[0];
        reportsSelectedCompany = typeof firstComp === 'string' ? firstComp : (firstComp?.name || "");
        reportsSelectedAssetId = null;
    }

    document.getElementById('edit-asset-data-modal')?.classList.add('hidden');
    renderCompanies();
    renderAssets();
    window.renderCalendar();
    if (currentView === 'assets') renderAtivosView();
    if (currentView === 'reports') renderReportsView();
    window.showAlert('EMPRESA E ATIVOS EXCLUÍDOS COM SUCESSO.', 'success');
};

window.toggleSectionMenu = function(event, sectionId) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    const existingMenu = document.getElementById('section-floating-menu');
    const isSameSection = existingMenu && existingMenu.dataset.sectionId === sectionId;
    if (existingMenu) {
        existingMenu.remove();
    }
    if (isSameSection) return;

    const btn = event?.currentTarget || event?.target?.closest('button');
    const parentContainer = btn?.parentElement || document.body;

    const menu = document.createElement('div');
    menu.id = 'section-floating-menu';
    menu.dataset.sectionId = sectionId;
    menu.className = 'absolute right-0 top-full mt-2 z-[999] bg-surface border border-outline-variant rounded-2xl shadow-xl p-2.5 min-w-[200px] flex flex-col gap-1 text-left animate-fadeIn';
    menu.innerHTML = `
        <button type="button" onclick="window.selectSectionMenuOption('obs', '${sectionId}')" class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container-low text-on-surface font-bold text-xs uppercase transition-all duration-150 cursor-pointer">
            <span class="material-symbols-outlined text-[#EAB308] text-[22px]">chat_bubble_outline</span>
            <span>OBSERVAÇÕES</span>
        </button>
        <button type="button" onclick="window.selectSectionMenuOption('checklist', '${sectionId}')" class="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-surface-container-low text-on-surface font-bold text-xs uppercase transition-all duration-150 cursor-pointer">
            <span class="material-symbols-outlined text-[#EAB308] text-[22px]">playlist_add</span>
            <span>CHECKLIST</span>
        </button>
    `;
    
    parentContainer.appendChild(menu);
};

window.selectSectionMenuOption = function(option, sectionId) {
    document.getElementById('section-floating-menu')?.remove();
    if (option === 'obs') {
        window.addAdditionalObservationBlock(null, sectionId);
    } else if (option === 'checklist') {
        window.openSectionChecklistItemModal(sectionId);
    }
};

document.addEventListener('click', (e) => {
    if (!e.target.closest('#section-floating-menu') && !e.target.closest('button[onclick*="toggleSectionMenu"]')) {
        document.getElementById('section-floating-menu')?.remove();
    }
});

window.openSectionChecklistItemModal = function(sectionId) {
    targetSectionIdForChecklistModal = sectionId;
    const modal = document.getElementById('section-checklist-item-modal');
    const input = document.getElementById('section-checklist-item-title');
    if (input) input.value = '';
    modal?.classList.remove('hidden');
    setTimeout(() => input?.focus(), 50);
};

window.closeSectionChecklistItemModal = function() {
    document.getElementById('section-checklist-item-modal')?.classList.add('hidden');
    targetSectionIdForChecklistModal = null;
};

window.saveSectionChecklistItem = function() {
    const titleInput = document.getElementById('section-checklist-item-title');
    const titleVal = titleInput?.value.trim();
    if (!titleVal) {
        return window.showAlert('INFORME A DESCRIÇÃO DO ITEM DE CHECKLIST.', 'warning');
    }
    if (!targetSectionIdForChecklistModal) {
        return window.showAlert('SEÇÃO NÃO IDENTIFICADA.', 'error');
    }

    const sectionId = targetSectionIdForChecklistModal;
    const itemId = `custom_item_${sectionId}_${Date.now()}`;
    const newItem = {
        id: itemId,
        label: titleVal,
        fieldType: 'inspectable',
        sectionId: sectionId
    };

    activeCustomItems.push(newItem);
    window.activeCustomItems = activeCustomItems;

    const card = document.querySelector(`.checklist-inspectable-group[data-section-id="${sectionId}"]`);
    if (card) {
        const itemsContainer = card.querySelector('.checklist-items-container') || card.querySelector('.divide-y');
        if (itemsContainer) {
            const itemHtml = renderCustomChecklistItemRow(newItem, sectionId);
            itemsContainer.insertAdjacentHTML('beforeend', itemHtml);
            const addedRow = itemsContainer.lastElementChild;
            addedRow?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }

    window.closeSectionChecklistItemModal();
};

window.removeCustomChecklistItem = function(itemId, sectionId) {
    activeCustomItems = activeCustomItems.filter(ci => ci.id !== itemId);
    window.activeCustomItems = activeCustomItems;
    const row = document.querySelector(`[data-custom-item-id="${itemId}"]`);
    if (row) row.remove();
};

window.addResponsibleBlock = function(respId = '') {
    const container = document.getElementById('checklist-responsibles-container');
    if (!container) return;
    window.usersList = usersList;
    const cardIndex = container.children.length;
    const html = renderResponsibleCard(respId, usersList, cardIndex);
    container.insertAdjacentHTML('beforeend', html);
    const added = container.lastElementChild;
    added?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

window.handleUserSignatureUpload = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result;
        window.currentUserSignatureBase64 = base64;
        const sigPreview = document.getElementById('user-signature-preview-container');
        if (sigPreview) {
            sigPreview.innerHTML = `<img src="${base64}" class="w-full h-full object-contain p-1" />`;
        }
        document.getElementById('remove-user-signature-btn')?.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
};

window.removeUserSignature = function() {
    window.currentUserSignatureBase64 = "";
    const sigPreview = document.getElementById('user-signature-preview-container');
    if (sigPreview) {
        sigPreview.innerHTML = '<span class="text-xs text-on-surface-variant uppercase font-bold text-center px-2">Sem Assinatura</span>';
    }
    document.getElementById('remove-user-signature-btn')?.classList.add('hidden');
    const fileInput = document.getElementById('user-signature-input');
    if (fileInput) fileInput.value = '';
};
window.addAdditionalObservationBlock = function(buttonEl, sectionId) {
    const card = document.querySelector(`.checklist-inspectable-group[data-section-id="${sectionId}"]`);
    if (!card) return;
    const container = card.querySelector('.checklist-obs-blocks-container');
    if (!container) return;
    
    const temp = document.createElement('div');
    temp.innerHTML = renderObservationBlock(null, true);
    const newBlock = temp.firstElementChild;
    container.appendChild(newBlock);
};

window.openCustomItemModal = function() {
    const modal = document.getElementById('custom-item-modal');
    const titleInput = document.getElementById('custom-item-title');
    const subsInput = document.getElementById('custom-item-subitems');
    if (titleInput) {
        // Sugere o próximo número (ex: 11)
        const nextNum = 11 + activeCustomSections.length;
        titleInput.value = `${nextNum} SISTEMA ADICIONAL`;
    }
    if (subsInput) subsInput.value = '';
    modal?.classList.remove('hidden');
};

window.closeCustomItemModal = function() {
    document.getElementById('custom-item-modal')?.classList.add('hidden');
};

window.saveCustomItem = function() {
    const titleVal = document.getElementById('custom-item-title')?.value.trim();
    const subsVal = document.getElementById('custom-item-subitems')?.value.trim();
    if (!titleVal) {
        return window.showAlert('INFORME O TÍTULO DO ITEM.', 'warning');
    }

    const lines = subsVal ? subsVal.split('\n').map(l => l.trim()).filter(l => l.length > 0) : [];
    const sectionId = `custom_${Date.now()}`;
    
    let children = [];
    if (lines.length === 0) {
        // Se nenhum subitem for inserido, cria apenas um campo de observações + fotos
        children = [
            {
                id: `${sectionId}_obs`,
                label: 'OBSERVAÇÕES',
                fieldType: 'textarea'
            }
        ];
    } else {
        // Se houver subitens, cria cada um com OK/NOK (o renderizador do grupo adiciona automaticamente o campo de observações/fotos abaixo deles)
        children = lines.map((label, index) => {
            return {
                id: `${sectionId}_sub_${index}`,
                label: label,
                fieldType: 'inspectable'
            };
        });
    }

    const newNode = {
        id: sectionId,
        title: titleVal,
        level: 1,
        children: children
    };

    activeCustomSections.push(newNode);
    
    // Renderiza e anexa no container
    const container = document.getElementById('checklist-sections-container');
    if (container) {
        const nextNum = 11 + activeCustomSections.length - 1;
        const html = renderNode(newNode, nextNum);
        container.insertAdjacentHTML('beforeend', html);
        
        // Rolagem suave até o novo item
        const addedEl = container.lastElementChild;
        if (addedEl) {
            addedEl.scrollIntoView({ behavior: 'smooth', block: 'end' });
        }
    }

    window.closeCustomItemModal();
    window.showAlert('ITEM ADICIONADO AO CHECKLIST.', 'success');
};

window.removeCustomSection = function(id) {
    const sectionId = id.split('_sub_')[0].split('_obs')[0];
    
    window.showAlert('DESEJA EXCLUIR ESTE ITEM ADICIONAL?', 'warning', () => {
        // Remove da lista em memória
        activeCustomSections = activeCustomSections.filter(sec => sec.id !== sectionId);
        
        // Remove do DOM
        const wrapper = document.querySelector(`.checklist-section-wrapper[data-section-id="${sectionId}"]`);
        if (wrapper) {
            wrapper.remove();
        }
        window.showAlert('ITEM ADICIONAL EXCLUÍDO.', 'success');
    });
};

window.handleLogoPreview = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result;
        window.currentLogoBase64 = base64;
        
        const previewContainer = document.getElementById('logo-preview-container');
        if (previewContainer) {
            previewContainer.innerHTML = `<img src="${base64}" class="w-full h-full object-cover" />`;
        }
    };
    reader.readAsDataURL(file);
};

// Listener para auto-save rápido síncrono local (zero lag, < 1ms)
if (typeof document !== 'undefined') {
    document.addEventListener('checklist-input-change', () => {
        if (!editingOrderId) return;
        const formRoot = getFormRoot() || document.getElementById('checklist-form-root');
        if (!formRoot) return;
        const formData = collectFormData(formRoot);
        saveFastLocalDraft({
            id: editingOrderId,
            ...formData,
            customSections: activeCustomSections,
            customItems: activeCustomItems,
            templateId: currentChecklistContext?.templateId || null,
            templateName: currentChecklistContext?.templateName || null,
            schema_snapshot: currentChecklistContext?.schema_snapshot || null
        });
    });
}
