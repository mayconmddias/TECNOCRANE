import { companies, allAssetsList, getStoredData, setStoredData, usersList, setUsersList, setAllAssetsList, setCompanies, loadAllDataFromDB, getDBValue, updateArrayInPlace } from './data.js';
import { monthsMap, monthNames, parseAssetDate, formatDateToDisplay } from './utils.js';
import { renderCompanies as renderCompaniesUI, renderAssetsTable } from './ui-render.js';
import { renderObservationBlock, renderNode } from './checklist-render.js';
import { mountChecklistForm, getFormRoot, collectFormData } from './checklist-ui.js';
import { createInspectionDocument, validateBeforeSend, mergeLegacyReport } from './checklist-state.js';
import { CHECKLIST_SCHEMA } from './checklist-schema.js';

console.log('CRANE PRO: Iniciando carregamento do módulo app.js...');

// --- GLOBAL FUNCTIONS (EXPOSED TO WINDOW) ---
// --- GLOBAL STATE ---

const today = new Date();
today.setHours(0, 0, 0, 0);
let assets = getStoredData('crane_assets', []);
let events = [];
let openOrders = getStoredData('crane_open_orders', []);
let finalizedReports = getStoredData('crane_reports', []);

function runMigrationsAndSync() {
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

    // Se assets estiver vazio, gera dados aleatórios baseados no allAssetsList técnico
    if (assets.length === 0 && allAssetsList.length > 0) {
        allAssetsList.forEach(asset => {
            const randomDays = Math.floor(Math.random() * 60) - 10;
            const d = new Date();
            d.setDate(d.getDate() + randomDays);
            
            assets.push({
                id: asset.id,
                empresa: asset.empresa,
                tipo: asset.tipo || asset.nome || "N/A",
                local: asset.local || "SETOR OPERACIONAL",
                data: formatDateFromDate(d)
            });
        });
    }
    setStoredData('crane_assets', assets);

    // Sempre regenera events a partir dos assets para garantir consistência
    events = assets.map(a => {
        try {
            const dateObj = parseAssetDate(a.data);
            if (isNaN(dateObj.getTime())) throw new Error('Invalid date');
            const companyColor = getCompanyColor(a.empresa || "N/A");
            return {
                id: a.id,
                empresa: a.empresa,
                tipo: a.tipo || "N/A",
                local: a.local || "SETOR OPERACIONAL",
                equipamento: a.id,
                date: dateObj.toISOString().split('T')[0],
                color: a.status === 'NAO_REALIZADO' ? 'border-red-500 bg-red-50' : companyColor.color,
                textColor: a.status === 'NAO_REALIZADO' ? 'text-red-700' : companyColor.textColor,
                status: a.status || 'PENDENTE'
            };
        } catch (e) {
            return null;
        }
    }).filter(e => e !== null);
    setStoredData('crane_events', events);

    // Migração das ordens de serviço e relatórios no localStorage para usar os novos tipos
    openOrders = openOrders.map(order => {
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
    });
    setStoredData('crane_open_orders', openOrders);

    finalizedReports = finalizedReports.map(report => {
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
    });

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
    events = assets.map(a => {
        try {
            const dateObj = parseAssetDate(a.data);
            const isoDate = dateObj.toISOString().split('T')[0];
            const companyColor = getCompanyColor(a.empresa || "N/A");
            return {
                id: a.id,
                empresa: a.empresa,
                tipo: a.tipo || "N/A",
                local: a.local || "SETOR OPERACIONAL",
                equipamento: a.id,
                date: isoDate,
                color: a.status === 'NAO_REALIZADO' ? 'border-red-500 bg-red-50' : companyColor.color,
                textColor: a.status === 'NAO_REALIZADO' ? 'text-red-700' : companyColor.textColor,
                status: a.status || 'PENDENTE'
            };
        } catch (e) {
            console.error('Erro ao processar data do ativo:', a.id, a.data);
            return null;
        }
    }).filter(e => e !== null);
    setStoredData('crane_events', events);
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


// --- VIEW NAVIGATION ---

window.switchView = function(view) {
    // Inspeção abre popup, não troca de view
    if (view === 'inspections') {
        window.openInspecaoModal();
        return;
    }

    currentView = view;
    const views = {
        dashboard: document.getElementById('dashboard-view'),
        calendar: document.getElementById('calendar-view'),
        assets: document.getElementById('assets-view'),
        users: document.getElementById('users-view'),
        'open-orders': document.getElementById('open-orders-view'),
        reports: document.getElementById('reports-view')
    };
    
    const navs = {
        dashboard: document.getElementById('nav-dashboard'),
        calendar: document.getElementById('nav-calendar'),
        assets: document.getElementById('nav-assets'),
        inspections: document.getElementById('nav-inspections'),
        users: document.getElementById('nav-users'),
        reports: document.getElementById('nav-reports'),
        'open-orders': document.getElementById('nav-open-orders')
    };

    Object.values(views).forEach(v => v?.classList.add('hidden'));
    Object.values(navs).forEach(n => n?.classList.remove('nav-item-active'));

    if (views[view]) views[view].classList.remove('hidden');
    if (navs[view]) navs[view].classList.add('nav-item-active');

    if (view === 'dashboard') renderAssets();
    else if (view === 'calendar') renderCalendar();
    else if (view === 'users') renderUsers();
    else if (view === 'open-orders') renderOpenOrders();
    else if (view === 'reports') renderReportsView();
    else if (view === 'assets') renderAtivosView();
};

window.toggleSidebar = function() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    sidebar.classList.toggle('hidden');
    sidebar.classList.toggle('flex');
    overlay.classList.toggle('hidden');
};

// --- MODAL INSPEÇÃO ---

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

window.updateInspecaoEquipments = function() {
    const company = document.getElementById('inspecao-empresa')?.value;
    const equipSelect = document.getElementById('inspecao-equipamento');
    if (!equipSelect) return;
    const list = allAssetsList || [];
    const filtered = list.filter(a => a && a.empresa && company && a.empresa.toLowerCase() === company.toLowerCase());
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
    const tipo = document.getElementById('inspecao-tipo')?.value;
    const preenchimento = document.getElementById('inspecao-preenchimento')?.value;

    if (!empresa || !equipamentoId) {
        return window.showAlert('SELECIONE EMPRESA E ATIVO PARA INICIAR.', 'warning');
    }

    const asset = allAssetsList.find(a => a.id === equipamentoId);
    const equipamentoNome = asset ? (asset.nome || asset.id) : equipamentoId;

    window.closeInspecaoModal();

    let savedDoc = null;
    if (preenchimento === 'ULTIMA') {
        const matchingReports = (finalizedReports || []).filter(r => r.equipamentoId === equipamentoId || r.equipamento === equipamentoId);
        if (matchingReports.length > 0) {
            // Ordenar decrescentemente por data
            matchingReports.sort((a, b) => {
                const dateA = new Date(a.createdAt || a.updatedAt || parseAssetDate(a.date));
                const dateB = new Date(b.createdAt || b.updatedAt || parseAssetDate(b.date));
                return dateB - dateA;
            });
            const lastReport = matchingReports[0];
            
            // Clonar o relatório
            savedDoc = JSON.parse(JSON.stringify(lastReport));
            savedDoc.id = null; // não sobrescrever o ID
            savedDoc.status = 'DRAFT';
            savedDoc.createdAt = new Date().toISOString();
            savedDoc.updatedAt = new Date().toISOString();
            savedDoc.generalImages = [];
            
            if (savedDoc.responses) {
                Object.keys(savedDoc.responses).forEach(key => {
                    const resp = savedDoc.responses[key];
                    if (resp) {
                        if (resp.status !== undefined) {
                            resp.status = null;
                        }
                        if (resp.images) {
                            resp.images = [];
                        }
                        if (resp.additionalObservations) {
                            resp.additionalObservations = resp.additionalObservations.map(obs => ({
                                observation: obs.observation || '',
                                images: []
                            }));
                        }
                    }
                });
            }
        } else {
            window.showAlert('NENHUMA INSPEÇÃO ANTERIOR ENCONTRADA PARA ESTE ATIVO. INICIANDO DO ZERO.', 'warning');
        }
    }

    openChecklistForm({
        tipo,
        empresa,
        equipamentoId,
        equipamentoNome,
        assetInfo: `${equipamentoNome} — ${empresa}`,
    }, savedDoc);
};

let activeCustomSections = [];
let isSavingOrSendingChecklist = false;

function openChecklistForm(context, savedDoc = null) {
    currentChecklistContext = context;
    editingOrderId = savedDoc?.id || null;

    // Resetar o estado de controle de cliques múltiplos
    isSavingOrSendingChecklist = false;

    const modal = document.getElementById('checklist-modal');
    const panel = document.getElementById('checklist-panel');
    const overlay = document.getElementById('checklist-overlay');
    const saveBtn = document.getElementById('checklist-save-btn');
    const titleEl = document.getElementById('checklist-type-title');
    const infoEl = document.getElementById('checklist-asset-info');
    const formRoot = document.getElementById('checklist-form-root');

    const doc = savedDoc
        ? mergeLegacyReport(savedDoc)
        : createInspectionDocument(context);

    activeCustomSections = doc.customSections || [];

    if (titleEl) titleEl.textContent = doc.type || context.tipo;
    if (infoEl) infoEl.textContent = doc.assetInfo || context.assetInfo;

    // Reabilitar o botão de Salvar Rascunho
    if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.classList.remove('opacity-50', 'pointer-events-none');
        if (editingOrderId && String(editingOrderId).startsWith('REL-')) {
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
    const filtered = allAssetsList.filter(a => a.empresa && company && a.empresa.toLowerCase() === company.toLowerCase());
    equipSelect.innerHTML = filtered.map(a => `<option value="${a.id}">${a.id} - ${a.nome}</option>`).join('');
};

window.saveProgEvent = function() {
    const empresa = document.getElementById('prog-empresa').value;
    const equipamento = document.getElementById('prog-equipamento').value;
    const date = document.getElementById('prog-date').value;
    const recorrencia = parseInt(document.getElementById('prog-recorrencia').value);

    if (!empresa || !equipamento || !date) return window.showAlert('POR FAVOR, PREENCHA TODOS OS CAMPOS.', 'warning');

    const groupId = Date.now();
    const companyColor = getCompanyColor(empresa);

    let startDate = new Date(date + 'T12:00:00');
    for (let i = 0; i < recorrencia; i++) {
        const currentEventDate = new Date(startDate);
        currentEventDate.setMonth(startDate.getMonth() + i);
        const dateStr = currentEventDate.toISOString().split('T')[0];
        
        // Se for o primeiro evento (ou sem recorrência), o ID é exatamente o ID do ativo.
        // Se for recorrência futura, adiciona a data para manter a chave primária única no Supabase.
        const eventId = i === 0 ? equipamento : `${equipamento}-${dateStr}`;

        const eventData = {
            id: eventId,
            groupId: recorrencia > 1 ? groupId : null,
            empresa, equipamento, date: dateStr,
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

window.openEditModal = function(eventOrId, id) {
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

    const els = {
        id: document.getElementById('edit-asset-id'),
        date: document.getElementById('edit-asset-date'),
        status: document.getElementById('edit-asset-status'),
        just: document.getElementById('edit-asset-justificativa'),
        idVal: document.getElementById('edit-asset-id-val'),
        empresaVal: document.getElementById('edit-asset-empresa-val'),
        tipoVal: document.getElementById('edit-asset-tipo-val')
    };

    if (els.id) els.id.innerText = `${event.id} | ${event.empresa}`;
    if (els.date) els.date.value = event.date;
    if (els.status) els.status.value = event.status || 'PENDENTE';
    if (els.just) els.just.value = event.justificativa || '';
    if (els.idVal) els.idVal.innerText = event.id;
    if (els.empresaVal) els.empresaVal.innerText = event.empresa;
    if (els.tipoVal) els.tipoVal.innerText = event.tipo || "N/A";

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
    const dateInput = document.getElementById('edit-asset-date').value;
    const status = document.getElementById('edit-asset-status').value;
    const justificativa = document.getElementById('edit-asset-justificativa').value;
    const id = window.currentEditingEventId;

    let eventIdx = events.findIndex(e => e.id == id);
    const empresa = events[eventIdx]?.empresa || assets.find(a => a.id == id)?.empresa || "N/A";
    const tipo = events[eventIdx]?.tipo || assets.find(a => a.id == id)?.tipo || assets.find(a => a.id == id)?.nome || "N/A";
    const companyColor = getCompanyColor(empresa);
    const eventData = {
        id: id,
        date: dateInput,
        status: status,
        justificativa: justificativa,
        empresa: empresa,
        equipamento: id,
        tipo: tipo,
        color: status === 'NAO_REALIZADO' ? 'border-red-500 bg-red-50' : companyColor.color,
        textColor: status === 'NAO_REALIZADO' ? 'text-red-700' : companyColor.textColor
    };

    if (eventIdx !== -1) events[eventIdx] = { ...events[eventIdx], ...eventData };
    else events.push(eventData);
    
    setStoredData('crane_events', events);
    window.closeEditAssetModal();
    renderCalendar();
    renderAssets();
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

window.deleteSingleEvent = function() {
    const id = window.currentEditingEventId;
    events = events.filter(e => e.id != id);
    setStoredData('crane_events', events);
    
    document.getElementById('modal-delete-prog').classList.add('hidden');
    window.closeEditAssetModal();
    renderCalendar();
    renderAssets();
    window.showAlert('PROGRAMAÇÃO EXCLUÍDA COM SUCESSO.', 'success');
};

window.deleteRecurringEvents = function() {
    const id = window.currentEditingEventId;
    const event = events.find(e => e.id == id);
    if (event && event.groupId) {
        events = events.filter(e => e.groupId !== event.groupId);
        setStoredData('crane_events', events);
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
    const monthDisplay = document.getElementById('current-month-display');
    if (!grid || !monthDisplay) return;
    grid.innerHTML = '';

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();
    monthDisplay.innerText = `${monthNames[month]}/${year}`.toUpperCase();

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrev = new Date(year, month, 0).getDate();

    for (let i = firstDay; i > 0; i--) {
        grid.innerHTML += `<div class="calendar-cell bg-zinc-50/30 opacity-40"><span class="text-[11px] font-bold text-zinc-300">${daysInPrev - i + 1}</span></div>`;
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = new Date().toDateString() === new Date(year, month, day).toDateString();
        grid.innerHTML += `
            <div class="calendar-cell cursor-pointer hover:bg-zinc-100 transition-colors ${isToday ? 'bg-zinc-100 border-2 border-zinc-500 ring-inset z-10' : ''}" 
                 data-date="${dateStr}" 
                 onclick="window.openProgModal('${dateStr}')">
                <span class="text-[11px] lg:text-[12px] font-bold ${isToday ? 'text-black font-black' : 'text-zinc-500'}">${String(day).padStart(2, '0')}</span>
                <div class="mt-2 space-y-1 event-container"></div>
            </div>`;
    }
    const total = grid.children.length;
    for (let i = 1; i <= (42 - total); i++) {
        grid.innerHTML += `<div class="calendar-cell bg-zinc-50/30 opacity-40"><span class="text-[11px] font-bold text-zinc-300">${String(i).padStart(2, '0')}</span></div>`;
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
            
            eventEl.className = `flex items-center justify-between group border-l-2 ${colorClass} pl-2 py-0.5 pr-1 hover:brightness-95 transition-all cursor-pointer shadow-sm`;
            eventEl.onclick = (e) => { e.stopPropagation(); window.openEditModal(event.id); };
            eventEl.innerHTML = `
                <div class="flex flex-col flex-1 overflow-hidden">
                    <span class="text-[8px] lg:text-[9px] font-bold uppercase truncate block">${event.empresa} - ${event.equipamento}</span>
                    ${isNaoRealizado ? '<span class="text-[7px] font-black text-red-600 uppercase tracking-tighter">NÃO REALIZADO</span>' : ''}
                </div>
                <span class="material-symbols-outlined text-[11px] text-zinc-400 group-hover:text-black transition-colors">edit</span>
            `;
            container.appendChild(eventEl);
        }
    });
}

window.changeMonth = function(delta) {
    currentViewDate.setMonth(currentViewDate.getMonth() + delta);
    renderCalendar();
};

// --- CHECKLIST / INSPECTION ---

window.openChecklistModal = function(id = null) {
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

    const order = openOrders.find(o => o.id === id);
    if (order) {
        openChecklistForm({
            tipo: order.type,
            empresa: order.empresa,
            equipamentoId: order.equipamentoId,
            equipamentoNome: order.equipamentoNome,
            assetInfo: order.assetInfo,
        }, order);
        return;
    }

    const report = finalizedReports.find(r => r.id === id);
    if (report) {
        openChecklistForm({
            tipo: report.type,
            empresa: report.empresa,
            equipamentoId: report.equipamentoId || report.equipamento,
            equipamentoNome: report.equipamentoNome || report.equipamento,
            assetInfo: report.assetInfo,
        }, report);
    }
};

window.closeChecklistModal = function() {
    const modal = document.getElementById('checklist-modal');
    const panel = document.getElementById('checklist-panel');
    const overlay = document.getElementById('checklist-overlay');
    const formRoot = document.getElementById('checklist-form-root');

    editingOrderId = null;
    currentChecklistContext = null;
    activeCustomSections = [];
    isSavingOrSendingChecklist = false;
    if (formRoot) formRoot.innerHTML = '';

    panel?.classList.add('opacity-0', 'translate-x-4');
    panel?.classList.remove('opacity-100', 'translate-x-0');
    overlay?.classList.remove('opacity-100');
    overlay?.classList.add('opacity-0');
    setTimeout(() => modal?.classList.add('hidden'), 75);
};

window.savePartialInspection = function() {
    if (isSavingOrSendingChecklist) return;
    const formRoot = getFormRoot() || document.getElementById('checklist-form-root');
    if (!formRoot || !currentChecklistContext) return;

    isSavingOrSendingChecklist = true;
    const btn = document.getElementById('checklist-save-btn');
    if (btn) {
        btn.disabled = true;
        btn.classList.add('opacity-50', 'pointer-events-none');
    }

    const formData = collectFormData(formRoot);
    let doc;
    const tempOpenOrders = [...openOrders];

    if (editingOrderId && tempOpenOrders.find(o => o.id === editingOrderId)) {
        const existing = tempOpenOrders.find(o => o.id === editingOrderId);
        doc = createInspectionDocument(currentChecklistContext, {
            ...existing,
            ...formData,
            customSections: activeCustomSections,
            id: editingOrderId,
        });
        const idx = tempOpenOrders.findIndex(o => o.id === editingOrderId);
        tempOpenOrders[idx] = doc;
    } else {
        const newId = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
        doc = createInspectionDocument(currentChecklistContext, {
            ...formData,
            customSections: activeCustomSections,
            status: 'DRAFT',
            id: newId,
        });
        tempOpenOrders.push(doc);
    }

    try {
        setStoredData('crane_open_orders', tempOpenOrders);
        updateArrayInPlace(openOrders, tempOpenOrders);
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

    const formData = collectFormData(formRoot);
    const reportId = (editingOrderId && String(editingOrderId).startsWith('REL-'))
        ? editingOrderId
        : 'REL-' + Math.floor(1000 + Math.random() * 9000);

    const userName = document.getElementById('user-name-display')?.innerText || "MAYCON DIAS";
    const newReport = createInspectionDocument(currentChecklistContext, {
        ...formData,
        customSections: activeCustomSections,
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
    }

    if (editingOrderId && String(editingOrderId).startsWith('REL-')) {
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
        const nameParts = user.name.trim().split(' ');
        const displayName = nameParts.length > 1 ? `${nameParts[0]} ${nameParts[1]}` : nameParts[0];
        tr.innerHTML = `
            <td class="p-4 text-table-data font-bold uppercase">${displayName}</td>
            <td class="p-4 text-table-data text-zinc-500 lowercase">${user.email}</td>
            <td class="p-4 text-table-data">
                <span class="px-2 py-1 ${user.permission === 'ADMINISTRADOR' ? 'bg-primary-container/20 text-on-surface' : 'bg-zinc-100 text-zinc-600'} text-[10px] font-bold">${user.permission}</span>
            </td>
            <td class="p-4 text-right">
                <button onclick="window.openEditUserModal(${user.id})" class="text-zinc-400 hover:text-black p-1">
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
    
    // Tenta carregar a empresa interna do localStorage
    const internalCompanyRaw = localStorage.getItem('crane_internal_company');
    let internalCompany = null;
    if (internalCompanyRaw) {
        try {
            internalCompany = JSON.parse(internalCompanyRaw);
        } catch (e) {
            console.error("Erro ao fazer parse da empresa interna:", e);
        }
    }

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
            } else {
                previewContainer.innerHTML = '<span class="material-symbols-outlined text-on-surface-variant">add_a_photo</span>';
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
        window.currentInternoLogoBase64 = null;
    }
    
    document.getElementById('btn-user-delete').style.display = 'none'; // Hide delete when creating
    
    window.handleUserRegistrationTypeChange();
    
    modal.classList.remove('hidden');
    setTimeout(() => {
        panel.classList.remove('opacity-0', 'scale-95');
        panel.classList.add('opacity-100', 'scale-100');
    }, 10);
};

window.openEditUserModal = function(id) {
    const user = usersList.find(u => u.id === id);
    if (!user) return;
    
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
    };
    reader.readAsDataURL(file);
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
    const logo = window.currentInternoLogoBase64 || "";

    if (!name) {
        return window.showAlert('O NOME DA EMPRESA É OBRIGATÓRIO.', 'warning');
    }

    // Tenta carregar a empresa interna antiga para identificar se o nome mudou ou se é a mesma
    const internalCompanyRaw = localStorage.getItem('crane_internal_company');
    let oldName = "";
    if (internalCompanyRaw) {
        try {
            oldName = JSON.parse(internalCompanyRaw).name;
        } catch (e) {}
    }

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
        logo
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
            finalizedReports = finalizedReports.map(r => r.empresa.toLowerCase() === oldName.toLowerCase() ? { ...r, empresa: newCompany.name } : r);
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
        window.saveUser();
    } else {
        window.saveCadastroInterno();
    }
};

window.closeUserModal = function() {
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

window.saveUser = function() {
    const idVal = document.getElementById('user-id-input').value;
    const name = document.getElementById('user-name-input').value.trim();
    const cargo = document.getElementById('user-cargo-input').value.trim();
    const email = document.getElementById('user-email-input').value.trim();
    const password = document.getElementById('user-password-input').value.trim();
    const permission = document.getElementById('user-permission-select').value;
    
    if (!name || !email || !password || !cargo) {
        return window.showAlert('PREENCHA TODOS OS CAMPOS.', 'warning');
    }
    
    let updatedList = [];
    if (idVal) {
        const userId = parseInt(idVal);
        updatedList = usersList.map(u => {
            if (u.id === userId) {
                return {
                    ...u,
                    name: name.toUpperCase(),
                    cargo: cargo.toUpperCase(),
                    email: email.toLowerCase(),
                    password: password,
                    permission: permission
                };
            }
            return u;
        });
    } else {
        const nextId = usersList.length > 0 ? Math.max(...usersList.map(u => Number(u.id) || 0)) + 1 : 1;
        updatedList = [...usersList, {
            id: nextId,
            name: name.toUpperCase(),
            cargo: cargo.toUpperCase(),
            email: email.toLowerCase(),
            password: password,
            permission: permission
        }];
    }
    
    setUsersList(updatedList);
    window.closeUserModal();
    renderUsers();
    window.showAlert('USUÁRIO SALVO COM SUCESSO.', 'success');
};

window.deleteUserFromForm = function() {
    const idVal = document.getElementById('user-id-input').value;
    if (!idVal) return;
    
    const userId = parseInt(idVal);
    window.showAlert('DESEJA EXCLUIR ESTE USUÁRIO DEFINITIVAMENTE?', 'warning', () => {
        const updatedList = usersList.filter(u => u.id !== userId);
        setUsersList(updatedList);
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
            <td class="p-4 text-right"><button onclick="window.openChecklistModal('${order.id}')" class="text-zinc-400 hover:text-black p-1"><span class="material-symbols-outlined text-lg">edit_note</span></button></td>`;
        tbody.appendChild(tr);
    });
}

let reportsSelectedCompany = selectedCompany;
let reportsSelectedAssetId = null;

function formatTechnicianName(fullName) {
    if (!fullName) return "N/A";
    const parts = fullName.trim().split(/\s+/);
    if (parts.length === 1) return parts[0];
    return `${parts[0]} ${parts[1]}`;
}

window.selectReportsAsset = function(assetId) {
    if (reportsSelectedAssetId === assetId) {
        reportsSelectedAssetId = null;
    } else {
        reportsSelectedAssetId = assetId;
    }
    renderReportsView();
};

function renderReportsView() {
    const comTbody = document.getElementById('reports-companies-tbody');
    const assTbody = document.getElementById('reports-assets-tbody');
    const repTbody = document.getElementById('reports-tbody');
    if (!comTbody || !assTbody || !repTbody) return;

    // Se a empresa selecionada nos relatórios não for válida na lista atual, reseta
    const currentList = companies || [];
    const validCompany = currentList.find(c => {
        const name = typeof c === 'string' ? c : (c?.name || "");
        return name.toLowerCase() === reportsSelectedCompany.toLowerCase();
    });
    if (!validCompany && currentList.length > 0) {
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
    const filteredAssets = allAssetsList.filter(a => a.empresa && reportsSelectedCompany && a.empresa.toLowerCase() === reportsSelectedCompany.toLowerCase());
    assTbody.innerHTML = filteredAssets.map(a => {
        const isSelected = a.id === reportsSelectedAssetId;
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
    let filteredReports = finalizedReports.filter(r => r.empresa && reportsSelectedCompany && r.empresa.toLowerCase() === reportsSelectedCompany.toLowerCase());
    if (reportsSelectedAssetId) {
        filteredReports = filteredReports.filter(r => (r.equipamentoId === reportsSelectedAssetId || r.equipamento === reportsSelectedAssetId));
    }

    repTbody.innerHTML = '';
    filteredReports.forEach((report, index) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-zinc-50 transition-colors group border-b border-outline-variant";
        
        const repNumber = '#' + String(index + 1).padStart(2, '0');
        const typeLabel = (report.type || 'PREVENTIVA').toUpperCase();
        const techName = formatTechnicianName(report.tecnico || document.getElementById('user-name-display')?.innerText || 'MAYCON DIAS');

        tr.innerHTML = `
            <td class="px-card_padding py-3 text-label-md font-bold text-zinc-900">${repNumber}</td>
            <td class="px-card_padding py-3 text-label-md uppercase text-zinc-600">${typeLabel}</td>
            <td class="px-card_padding py-3 text-label-md uppercase text-zinc-500">${report.date}</td>
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

window.selectReportsAsset = function(assetId) {
    if (reportsSelectedAssetId === assetId) {
        reportsSelectedAssetId = null; // Toggle off if clicked again
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

window.execMenuAction = function(action) {
    const id = document.getElementById('global-action-menu').getAttribute('data-current-id');
    document.getElementById('global-action-menu').style.display = 'none';
    if (action === 'edit') editReport(id);
    if (action === 'pdf') {
        window.showAlert('GERANDO PDF DO RELATÓRIO...', 'success');
        setTimeout(() => {
            window.printReportPDF(id);
        }, 500);
    }
    if (action === 'delete') {
        window.reportIdParaExcluir = id;
        document.getElementById('modal-confirm-exclusao').classList.remove('hidden');
    }
};

window.printReportPDF = function(reportId) {
    const report = finalizedReports.find(r => r.id === reportId);
    if (!report) return window.showAlert('RELATÓRIO NÃO ENCONTRADO.', 'error');

    let company = companies.find(c => c.name.toLowerCase() === report.empresa.toLowerCase());
    if (!company) {
        const internalCompanyRaw = localStorage.getItem('crane_internal_company');
        if (internalCompanyRaw) {
            try {
                company = JSON.parse(internalCompanyRaw);
            } catch (e) {
                console.error("Erro ao ler empresa interna de fallback:", e);
            }
        }
    }
    if (!company) company = {};

    const asset = allAssetsList.find(a => a.id === report.equipamentoId) || {};

    // Tenta carregar a empresa do cadastro interno para exibir seu logotipo no cabeçalho do PDF
    const internalCompanyRaw = localStorage.getItem('crane_internal_company');
    let internalCompany = null;
    if (internalCompanyRaw) {
        try {
            internalCompany = JSON.parse(internalCompanyRaw);
        } catch (e) {}
    }

    const reportTypeUpper = (report.type || 'PREVENTIVA').toUpperCase();
    
    // Formatações de data
    const formatReportDate = (dateStr, delimiter = '/') => {
        if (!dateStr) return '';
        const parts = dateStr.split('-');
        if (parts.length === 3) {
            return `${parts[2]}${delimiter}${parts[1]}${delimiter}${parts[0]}`;
        }
        return dateStr;
    };
    const reportDateFormattedHeader = formatReportDate(report.date, '/');
    const reportDateFormattedTable = formatReportDate(report.date, '-');
    
    const internalCompanyName = (internalCompany && internalCompany.name) ? internalCompany.name.toUpperCase() : "TECNOCRANE";
    
    const clientLogoHtml = (company && company.logo)
        ? `<img src="${company.logo}">`
        : `<div class="footer-meta-logo-text">${(company && company.name || "CLIENTE").toUpperCase()}</div>`;

    const headerLogoHtml = (internalCompany && internalCompany.logo)
        ? `<img src="${internalCompany.logo}" style="max-height: 55px; max-width: 180px; object-fit: contain;">`
        : `<div style="font-weight: 900; font-size: 20px; color: #000000; letter-spacing: -0.5px;">${internalCompanyName}</div>`;

    const sectionsHTML = getChecklistPrintHTML(report);

    // Calcula estatísticas gerais
    let totalItems = 0;
    let okCount = 0;
    let nokCount = 0;
    if (report.responses) {
        Object.values(report.responses).forEach(resp => {
            if (resp.status !== undefined) {
                totalItems++;
                if (resp.status === 'OK') okCount++;
                if (resp.status === 'NOK') nokCount++;
            }
        });
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        return window.showAlert('POR FAVOR, HABILITE OS POP-UPS NO SEU NAVEGADOR PARA GERAR O PDF.', 'warning');
    }

    printWindow.document.write(`
<!DOCTYPE html>
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
        .print-header {
            display: grid;
            grid-template-columns: 200px 1fr 200px;
            align-items: center;
            border-bottom: 2px solid #000000;
            padding-bottom: 12px;
            margin-bottom: 16px;
        }

        .header-left {
            display: flex;
            align-items: center;
            justify-content: flex-start;
        }

        .header-title-block {
            text-align: center;
        }

        .header-title-block h1 {
            font-size: 14px;
            font-weight: 800;
            color: #000000;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin: 0;
            padding: 0;
            line-height: 1;
        }

        .header-right {
            text-align: right;
        }

        .report-badge {
            display: inline-block;
            background: #facc15;
            color: #000000;
            font-size: 10px;
            font-weight: 900;
            padding: 4px 8px;
            border-radius: 4px;
            margin-bottom: 4px;
        }

        .report-meta-text {
            font-size: 8px;
            text-transform: uppercase;
            color: #4b5563;
            font-weight: 600;
        }

        /* Seções de Metadados (Empresa e Ativo) */
        .metadata-section {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin-bottom: 16px;
        }

        .meta-card {
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            background: #f9fafb;
            padding: 10px;
        }

        .meta-card-title {
            font-size: 9px;
            font-weight: 800;
            text-transform: uppercase;
            color: #000000;
            border-bottom: 1px solid #e5e7eb;
            padding-bottom: 4px;
            margin-bottom: 6px;
            letter-spacing: 0.3px;
        }

        .meta-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 6px;
        }

        .meta-item {
            font-size: 8px;
            text-transform: uppercase;
        }

        .meta-item strong {
            color: #374151;
            font-weight: 700;
        }

        .meta-item span {
            color: #4b5563;
            font-weight: 600;
            display: block;
            margin-top: 1px;
            font-size: 9px;
        }

        /* Resumo Estatístico */
        .stats-bar {
            display: flex;
            justify-content: space-around;
            background: #f3f4f6;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
            padding: 8px;
            margin-bottom: 16px;
            text-align: center;
        }

        .stat-box {
            flex: 1;
        }

        .stat-box-title {
            font-size: 7px;
            font-weight: 800;
            text-transform: uppercase;
            color: #6b7280;
        }

        .stat-box-val {
            font-size: 12px;
            font-weight: 800;
            margin-top: 2px;
        }

        .stat-ok { color: #10b981; }
        .stat-nok { color: #ef4444; }
        .stat-total { color: #000000; }

        /* Checklist Conteúdo */
        .print-section {
            margin-top: 12px;
        }

        .main-section {
            margin-top: 16px;
        }

        .print-section-title {
            font-size: 11px;
            font-weight: 800;
            color: #1f2937;
            text-transform: uppercase;
            margin-bottom: 8px;
            padding-bottom: 4px;
        }

        .print-section-content {
            padding-left: 8px;
        }

        /* Items e Tabelas */
        .print-group-container {
            margin-bottom: 8px;
            page-break-inside: avoid;
        }

        .print-group-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 4px;
        }

        .print-group-table th, .print-group-table td {
            border: 1px solid #e5e7eb;
            padding: 4px 6px;
            text-align: left;
            font-size: 8px;
            text-transform: uppercase;
        }

        .print-group-table th {
            background: #f9fafb;
            color: #374151;
            font-weight: 800;
        }

        .print-group-row td {
            font-weight: 600;
            color: #4b5563;
        }

        .print-item {
            border: 1px solid #f3f4f6;
            background: #fafafa;
            border-radius: 4px;
            padding: 6px;
            margin-bottom: 6px;
            page-break-inside: avoid;
        }

        .print-item-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .print-item-label {
            font-size: 8.5px;
            font-weight: 700;
            text-transform: uppercase;
        }

        .status-badge {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 14px;
            font-weight: bold;
            background: none !important;
            border: none !important;
            padding: 0;
            margin: 0;
        }

        .status-ok {
            background: none !important;
            color: #10b981 !important;
        }

        .status-nok {
            background: none !important;
            color: #ef4444 !important;
        }

        .status-na {
            background: none !important;
            color: #9ca3af !important;
        }

        .print-obs {
            margin-top: 4px;
            background: #ffffff;
            padding: 4px;
            font-size: 8px;
            color: #4b5563;
            text-transform: uppercase;
        }

        .print-images-grid {
            display: grid;
            grid-template-columns: repeat(3, 160px);
            gap: 12px;
            margin-top: 8px;
            justify-content: center;
        }

        .print-images-grid img {
            width: 160px;
            height: 140px;
            object-fit: cover;
            border: 1px solid #e5e7eb;
            border-radius: 6px;
        }

        /* Rodapé de Assinatura */
        .signature-footer {
            margin-top: 40px;
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            page-break-inside: avoid;
        }

        .signature-block {
            text-align: center;
            border-top: 1px solid #374151;
            padding-top: 8px;
            font-size: 8.5px;
            text-transform: uppercase;
        }

        .signature-block strong {
            display: block;
            margin-bottom: 2px;
        }

        .signature-block span {
            color: #6b7280;
        }

        /* Estilos da Capa Personalizada */
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

        .header-meta-cell .report-badge {
            margin-bottom: 2px;
        }

        .cover-page {
            page-break-after: always;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            height: 265mm; /* Preenche a área útil exata da página A4 considerando 1.5cm de margem do body */
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
            border-left: none;
            border-right: none;
            padding: 10px 15px;
            background-color: #f9fafb;
            border-radius: 0;
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
            margin-bottom: 0;
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
            border-left: none;
            border-right: none;
            border-bottom: none;
            align-items: stretch;
            margin-top: -1px;
            margin-bottom: 0;
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
            .no-print {
                display: none;
            }
            .page-break {
                page-break-before: always;
            }
            /* Garantir cores de fundo ao imprimir */
            * {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
            }
        }

        /* Estilos de Layout para Medição em Tela e Impressão */
        .print-page {
            page-break-after: always;
            break-after: page;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            height: 265mm; /* Preenche a área útil exata da página A4 */
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
        <!-- Cabeçalho da Capa -->
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

        <!-- Corpo da Capa com Bordas Integradas -->
        <div class="cover-body-container">
            <!-- Título Central -->
            <div class="cover-center-block">
                <div class="cover-center-title">
                    RELATÓRIO DE MANUTENÇÃO ${reportTypeUpper}
                </div>
                <div class="cover-center-subtitle" style="margin-top: 8px;">
                    #${report.equipamentoId} — ${report.equipamentoNome.toUpperCase()}
                </div>
            </div>

            <!-- Rodapé da Capa -->
            <div>
                <!-- Disclaimer de Propriedade Intelectual -->
                <div class="disclaimer-box">
                    <p>Este documento contém informações de propriedade da ${internalCompanyName} e só deve ser utilizado exclusivamente pelo destinatário com relação às finalidades pelas quais foi recebido. E qualquer forma de reprodução ou divulgação sem o consentimento da ${internalCompanyName} é vetada.</p>
                    <p>This document is property of ${internalCompanyName}. It is strictly forbidden to reproduce this document, in whole or in part, and to provide to others any related information without the previous written consent by ${internalCompanyName}</p>
                </div>

                <!-- Tabela de Revisão -->
                <table class="revision-table">
                    <tr>
                        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                    </tr>
                    <tr>
                        <td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td>
                    </tr>
                    <tr class="val-row">
                        <td>01</td>
                        <td>${reportDateFormattedTable}</td>
                        <td>EMISSÃO INICIAL</td>
                        <td>GILBERTO M</td>
                        <td>MERILDO I.</td>
                        <td>REINALDO A.</td>
                        <td>DAVISON R.</td>
                    </tr>
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

                <!-- Grid de Metadados -->
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
                            <div class="meta-subitem">
                                <strong>ID Equipamento</strong>
                                <span>${report.equipamentoId || '---'}</span>
                            </div>
                            <div class="meta-subitem">
                                <strong>Tipo/Nome</strong>
                                <span>${report.equipamentoNome || '---'}</span>
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
                                <strong>Capac. Principal</strong>
                                <span>${asset.capacidade || '---'}</span>
                            </div>
                            <div class="meta-subitem">
                                <strong>Vão Ponte</strong>
                                <span>${asset.vao || '---'}</span>
                            </div>
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
        <div id="temp-signatures" class="signature-footer" style="margin-top: 60px; display: grid; width: 100%;">
            <div class="signature-block">
                <span>RESPONSÁVEL</span>
            </div>
            <div class="signature-block">
                <span>RESPONSÁVEL</span>
            </div>
        </div>
    </div>

    <!-- LOCAL ONDE AS PÁGINAS GERADAS SERÃO INSERIDAS -->
    <div id="print-pages-container"></div>

    <script>
        window.onload = function() {
            // Aguarda o carregamento de todas as imagens para ter as medidas reais
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
                
                // Define a largura de medição para corresponder exatamente à área de impressão (180mm)
                source.style.width = '180mm';
                
                // Função recursiva para achatar qualquer nível de aninhamento de seções
                function flattenSection(sec) {
                    const result = [];
                    const children = Array.from(sec.children);
                    const contentEl = children.find(c => c.classList && c.classList.contains('print-section-content'));
                    
                    if (!contentEl) {
                        result.push(sec.cloneNode(true));
                        return result;
                    }
                    
                    const nestedSections = Array.from(contentEl.children).filter(
                        child => child.classList && child.classList.contains('print-section')
                    );
                    
                    if (nestedSections.length > 0) {
                        const titleEl = children.find(c => c.classList && c.classList.contains('print-section-title'));
                        if (titleEl) {
                            result.push(titleEl.cloneNode(true));
                        }
                        nestedSections.forEach(nested => {
                            const nestedResults = flattenSection(nested);
                            nestedResults.forEach(r => result.push(r));
                        });
                    } else {
                        result.push(sec.cloneNode(true));
                    }
                    return result;
                }
                
                // Achata TODAS as seções recursivamente
                const flatElements = [];
                Array.from(temp.children).forEach(mainSec => {
                    const results = flattenSection(mainSec);
                    results.forEach(r => flatElements.push(r));
                });
                
                // Limpa o temp-measurer e insere a lista plana para medição
                temp.innerHTML = '';
                flatElements.forEach(el => temp.appendChild(el));
                
                // Força reflow
                void temp.offsetHeight;
                
                const sections = Array.from(temp.children);
                
                // Calibração: mede a altura de 265mm útil da print-page em pixels
                const pageRuler = document.createElement('div');
                pageRuler.style.cssText = 'height:265mm;width:0;position:absolute;visibility:hidden;';
                document.body.appendChild(pageRuler);
                const totalPagePx = pageRuler.offsetHeight;
                document.body.removeChild(pageRuler);
                
                // Mede o cabeçalho real
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
                
                // Altura útil de conteúdo = altura total da página - cabeçalho - margem de segurança de 60px
                const maxPageHeight = totalPagePx - headerPx - 60; 
                const sigsHeight = sigs.offsetHeight || 120;
                
                const pages = [];
                let currentPageSections = [];
                let currentPageHeight = 0;
                
                sections.forEach((sec, idx) => {
                    // Obtém margens reais do elemento para um cálculo de altura 100% fiel ao layout
                    const style = window.getComputedStyle(sec);
                    const marginTop = parseFloat(style.marginTop) || 0;
                    const marginBottom = parseFloat(style.marginBottom) || 0;
                    const h = sec.offsetHeight + marginTop + marginBottom;
                    
                    // Prevenção de Orfandade de Títulos H2, H3 e H4
                    const tagName = sec.tagName.toLowerCase();
                    const isHeading = tagName === 'h2' || tagName === 'h3' || tagName === 'h4';
                    let willNextElementFit = true;
                    if (isHeading && idx + 1 < sections.length) {
                        const nextSec = sections[idx + 1];
                        const nextStyle = window.getComputedStyle(nextSec);
                        const nextMarginTop = parseFloat(nextStyle.marginTop) || 0;
                        const nextMarginBottom = parseFloat(nextStyle.marginBottom) || 0;
                        const nextH = nextSec.offsetHeight + nextMarginTop + nextMarginBottom;
                        if (currentPageHeight + h + nextH > maxPageHeight) {
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
                
                const totalPages = pages.length + 1; // + 1 para a Capa
                
                // Atualiza total de páginas na capa
                const coverPagesPlaceholder = document.querySelector('.cover-page .total-pages-placeholder');
                if (coverPagesPlaceholder) {
                    coverPagesPlaceholder.innerText = totalPages;
                }
                
                // Atualiza o texto dinâmico na capa (PAGINA: 1 / TOTAL)
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
                    
                    // Cabeçalho da página de conteúdo
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
                
                // Oculta a fonte original
                document.getElementById('print-content-source').style.display = 'none';
                
                setTimeout(() => {
                    window.print();
                }, 500);
            }
        };
    </script>
</body>
</html>
    `);
    printWindow.document.close();
};

function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function getChecklistPrintHTML(report) {
    const responses = report.responses || {};

    function renderPrintNode(node) {
        if (node.fieldType === 'inspectable') {
            const resp = responses[node.id] || {};
            const status = resp.status || '-';
            const observation = resp.observation || '';
            const images = (resp.images || []).filter(img => img && String(img).trim() !== "");

            let statusClass = 'status-na';
            let statusSymbol = '-';
            if (status === 'OK') {
                statusClass = 'status-ok';
                statusSymbol = '✔';
            } else if (status === 'NOK') {
                statusClass = 'status-nok';
                statusSymbol = '✖';
            }

            let obsHtml = '';
            if (observation) {
                obsHtml = `<div class="print-obs">${escapeHTML(observation)}</div>`;
            }

            let imgsHtml = '';
            if (images && images.length > 0) {
                imgsHtml = `
                <div class="print-images-grid">
                    ${images.map(img => `<img src="${img}" alt="Foto da Inspeção">`).join('')}
                </div>`;
            }

            return `
            <div class="print-item">
                <div class="print-item-header">
                    <span class="print-item-label">${node.label}</span>
                    <span class="status-badge ${statusClass}">${statusSymbol}</span>
                </div>
                ${imgsHtml}
                ${obsHtml}
            </div>`;
        }

        if (node.fieldType === 'textarea' || node.fieldType === 'text') {
            const resp = responses[node.id] || {};
            const val = resp.value || '';
            const images = (resp.images || []).filter(img => img && String(img).trim() !== "");

            let imgsHtml = '';
            if (images && images.length > 0) {
                imgsHtml = `
                <div class="print-images-grid">
                    ${images.map(img => `<img src="${img}" alt="Foto da Inspeção">`).join('')}
                </div>`;
            }

            return `
            <div class="print-item">
                <div class="print-item-header" style="margin-bottom: 4px;">
                    <span class="print-item-label">${node.label}</span>
                </div>
                ${imgsHtml}
                <div class="print-obs" style="background: #f3f4f6; padding: 6px; font-weight: 600;">
                    ${escapeHTML(val) || '(SEM OBSERVAÇÕES)'}
                </div>
            </div>`;
        }

        // --- Interceptação especial: Tabela de Inspeção do Cabo de Aço (5.6.1 e 6.6.1) ---
        if (node.id === '5.6.1' || node.id === '6.6.1') {
            const prefix = node.id;
            const arames = (responses[`${prefix}.arames`] || {}).value || '';
            const bitola = (responses[`${prefix}.bitola`] || {}).value || '';
            const diametro = (responses[`${prefix}.diametro`] || {}).value || '';
            const diametro_medido = (responses[`${prefix}.diametro_medido`] || {}).value || '';
            const reducao = (responses[`${prefix}.reducao`] || {}).value || '';
            const corrosao = (responses[`${prefix}.corrosao`] || {}).value || '';
            const danos = (responses[`${prefix}.danos`] || {}).value || '';
            const deterioracao = (responses[`${prefix}.deterioracao`] || {}).value || '';
            const obsText = (responses[`${prefix}.observacoes`] || {}).value || '';

            const cableSubfields = ['arames', 'bitola', 'diametro', 'diametro_medido', 'reducao', 'corrosao', 'danos', 'deterioracao', 'observacoes'];
            let cableAllImages = [];
            cableSubfields.forEach(sub => {
                const resp = responses[`${prefix}.${sub}`] || {};
                const imgs = (resp.images || []).filter(img => img && String(img).trim() !== "");
                cableAllImages = cableAllImages.concat(imgs);
            });

            let cableObsHtml = '';
            if (obsText) {
                cableObsHtml = `
                <div class="print-obs" style="margin-top: 4px; background: #ffffff; border: 1px solid #e5e7eb; padding: 6px; font-weight: 600; color: #4b5563;">
                    <strong>Observações do Cabo de Aço:</strong> ${escapeHTML(obsText)}
                </div>`;
            }

            let cableImgsHtml = '';
            if (cableAllImages.length > 0) {
                cableImgsHtml = `
                <div class="print-images-grid" style="margin-top: 4px;">
                    ${cableAllImages.map(img => `<img src="${img}" alt="Foto da Inspeção">`).join('')}
                </div>`;
            }

            // Extrair labels diretamente do schema (node.children)
            const lblArames     = node.children[0].label;
            const lblBitola     = node.children[1].label;
            const lblDiametro   = node.children[2].label;
            const lblDiamMedido = node.children[3].label;
            const lblReducao    = node.children[4].label;
            const lblCorrosaoFull   = node.children[5].label;
            const lblDanosFull      = node.children[6].label;
            const lblDeterioraFull  = node.children[7].label;

            // Separar nome e escala de grau dos campos que contêm "Grau" ou "1 = ok"
            function splitGrauLabel(label) {
                const match = label.match(/^(.+?)\s*(?:Grau\s*)?(\d\s*=.+)$/i);
                if (match) {
                    const scale = match[2].replace(/;\s*/g, '<br>').replace(/\s*=\s*/g, ' = ');
                    return { name: match[1].trim(), scale: 'GRAU<br>' + scale };
                }
                return { name: label, scale: '' };
            }

            const grauCorrosao   = splitGrauLabel(lblCorrosaoFull);
            const grauDanos      = splitGrauLabel(lblDanosFull);
            const grauDeteriora  = splitGrauLabel(lblDeterioraFull);

            const thStyle = 'text-align: center; font-weight: 600; border: 1px solid #e5e7eb; color: #374151; background: #ffffff;';
            const thGrauStyle = 'text-align: center; font-weight: 600; font-size: 7px; text-transform: none; line-height: 1.4; border: 1px solid #e5e7eb; color: #374151; background: #ffffff; padding: 2px;';
            const tdStyle = 'text-align: center; vertical-align: middle; border: 1px solid #e5e7eb; color: #4b5563; font-weight: 600;';

            const cableTableHtml = `
            <div class="print-group-container">
                <table class="print-group-table" style="table-layout: fixed; width: 100%; border-collapse: collapse; background: #ffffff;">
                    <thead>
                        <tr>
                            <th rowspan="2" style="${thStyle} vertical-align: middle; width: 8%;">${escapeHTML(lblArames)}</th>
                            <th colspan="4" style="${thStyle} width: 44%;">Redução do Diâmetro</th>
                            <th style="${thStyle} vertical-align: middle; width: 13%;">${escapeHTML(grauCorrosao.name)}</th>
                            <th style="${thStyle} vertical-align: middle; width: 15%;">${escapeHTML(grauDanos.name)}</th>
                            <th style="${thStyle} vertical-align: middle; width: 16%;">${escapeHTML(grauDeteriora.name)} (e outras observações)</th>
                        </tr>
                        <tr>
                            <th style="${thStyle} width: 8%;">${escapeHTML(lblBitola)}</th>
                            <th style="${thStyle} width: 14%;">${escapeHTML(lblDiametro)}</th>
                            <th style="${thStyle} width: 9%;">${escapeHTML(lblDiamMedido)}</th>
                            <th style="${thStyle} width: 13%;">${escapeHTML(lblReducao)}</th>
                            <th style="${thGrauStyle}">${grauCorrosao.scale}</th>
                            <th style="${thGrauStyle}">${grauDanos.scale}</th>
                            <th style="${thGrauStyle}">${grauDeteriora.scale}</th>
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
                </table>
                ${cableObsHtml}
                ${cableImgsHtml}
            </div>`;

            const cableHeadingTag = node.level === 1 ? 'h2' : node.level === 2 ? 'h3' : 'h4';
            const cableSectionClass = node.level === 1 ? 'print-section main-section' : 'print-section';

            return `
            <div class="${cableSectionClass}">
                <${cableHeadingTag} class="print-section-title">${node.title}</${cableHeadingTag}>
                <div class="print-section-content">
                    ${cableTableHtml}
                </div>
            </div>`;
        }
        // --- Fim da interceptação da Tabela de Inspeção do Cabo de Aço ---

        // --- Interceptação especial: Tabela do Moitão (5.7.2 e 6.7.2) ---
        if (node.id === '5.7.2' || node.id === '6.7.2') {
            const prefix = node.id;
            // Lê os campos dinamicamente do schema (filtrando observacoes)
            const hookFields = node.children.filter(c => c.id !== `${prefix}.observacoes`);
            const obsText = (responses[`${prefix}.observacoes`] || {}).value || '';

            // Coleta todas as imagens dos campos
            let hookAllImages = [];
            node.children.forEach(child => {
                const resp = responses[child.id] || {};
                const imgs = (resp.images || []).filter(img => img && String(img).trim() !== "");
                hookAllImages = hookAllImages.concat(imgs);
            });

            const thStyle = 'text-align: center; font-weight: 600; border: 1px solid #e5e7eb; color: #374151; background: #ffffff; padding: 6px 4px; text-transform: uppercase; font-size: 8px;';
            const tdStyle = 'text-align: center; vertical-align: middle; border: 1px solid #e5e7eb; color: #4b5563; font-weight: 600; padding: 6px 4px;';

            const headersHtml = hookFields.map(field =>
                `<th style="${thStyle}">${escapeHTML(field.label)}</th>`
            ).join('');

            const cellsHtml = hookFields.map(field => {
                const val = (responses[field.id] || {}).value || '-';
                return `<td style="${tdStyle}">${escapeHTML(val)}</td>`;
            }).join('');

            let hookObsHtml = '';
            if (obsText) {
                hookObsHtml = `
                <div class="print-obs" style="margin-top: 4px;">
                    ${escapeHTML(obsText)}
                </div>`;
            }

            let hookImgsHtml = '';
            if (hookAllImages.length > 0) {
                hookImgsHtml = `
                <div class="print-images-grid" style="margin-top: 4px;">
                    ${hookAllImages.map(img => `<img src="${img}" alt="Foto da Inspeção">`).join('')}
                </div>`;
            }

            const hookTableHtml = `
            <div class="print-group-container">
                <table class="print-group-table" style="table-layout: fixed; width: 100%; border-collapse: collapse; background: #ffffff;">
                    <thead>
                        <tr>${headersHtml}</tr>
                    </thead>
                    <tbody>
                        <tr class="print-group-row">${cellsHtml}</tr>
                    </tbody>
                </table>
                ${hookObsHtml}
                ${hookImgsHtml}
            </div>`;

            const hookHeadingTag = node.level === 1 ? 'h2' : node.level === 2 ? 'h3' : 'h4';
            const hookSectionClass = node.level === 1 ? 'print-section main-section' : 'print-section';

            return `
            <div class="${hookSectionClass}">
                <${hookHeadingTag} class="print-section-title">${node.title}</${hookHeadingTag}>
                <div class="print-section-content">
                    ${hookTableHtml}
                </div>
            </div>`;
        }
        // --- Fim da interceptação da Tabela do Moitão ---

        const isGroup = node.children && node.children.length > 0 && node.children[0].fieldType === 'inspectable';
        let childrenHtml = '';

        if (isGroup) {
            const itemsHtml = node.children.map(child => {
                const resp = responses[child.id] || {};
                const status = resp.status || '-';
                let statusClass = 'status-na';
                let statusSymbol = '-';
                if (status === 'OK') {
                    statusClass = 'status-ok';
                    statusSymbol = '✔';
                } else if (status === 'NOK') {
                    statusClass = 'status-nok';
                    statusSymbol = '✖';
                }

                return `
                <tr class="print-group-row">
                    <td>${child.label}</td>
                    <td style="text-align: center; width: 80px;"><span class="status-badge ${statusClass}">${statusSymbol}</span></td>
                </tr>`;
            }).join('');

            // O grupo armazena a observação/imagens no ID do seu primeiro filho
            const firstChildId = node.children && node.children.length > 0 ? node.children[0].id : null;
            const groupResp = firstChildId ? responses[firstChildId] || {} : {};
            const groupObs = groupResp.observation || '';
            const groupImgs = (groupResp.images || []).filter(img => img && String(img).trim() !== "");
            const additionalObs = groupResp.additionalObservations || [];

            let groupObsHtml = '';
            if (groupObs) {
                groupObsHtml = `<div class="print-obs">${escapeHTML(groupObs)}</div>`;
            }

            let groupImgsHtml = '';
            if (groupImgs && groupImgs.length > 0) {
                groupImgsHtml = `
                <div class="print-images-grid">
                    ${groupImgs.map(img => `<img src="${img}" alt="Foto da Inspeção">`).join('')}
                </div>`;
            }

            let additionalObsHtml = '';
            if (additionalObs && additionalObs.length > 0) {
                additionalObsHtml = additionalObs.map(addBlock => {
                    const addObs = addBlock.observation || '';
                    const addImgs = (addBlock.images || []).filter(img => img && String(img).trim() !== "");

                    let addObsText = '';
                    if (addObs) {
                        addObsText = `<div class="print-obs">${escapeHTML(addObs)}</div>`;
                    }

                    let addImgsBlockHtml = '';
                    if (addImgs && addImgs.length > 0) {
                        addImgsBlockHtml = `
                        <div class="print-images-grid">
                            ${addImgs.map(img => `<img src="${img}" alt="Foto da Inspeção">`).join('')}
                        </div>`;
                    }

                    return `${addImgsBlockHtml}${addObsText}`;
                }).join('');
            }

            childrenHtml = `
            <div class="print-group-container">
                <table class="print-group-table">
                    <thead>
                        <tr>
                            <th>Descrição</th>
                            <th style="text-align: center; width: 80px;">Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
                ${groupImgsHtml}
                ${groupObsHtml}
                ${additionalObsHtml}
            </div>`;
        } else {
            childrenHtml = node.children.map(child => renderPrintNode(child)).join('');
        }

        if (!childrenHtml) return '';

        const headingTag = node.level === 1 ? 'h2' : node.level === 2 ? 'h3' : 'h4';
        const sectionClass = node.level === 1 ? 'print-section main-section' : 'print-section';

        return `
        <div class="${sectionClass}">
            <${headingTag} class="print-section-title">${node.title}</${headingTag}>
            <div class="print-section-content">
                ${childrenHtml}
            </div>
        </div>`;
    }

    const standardSectionsHTML = CHECKLIST_SCHEMA.map(node => renderPrintNode(node)).join('');

    let customSectionsHTML = '';
    if (report.customSections && report.customSections.length > 0) {
        customSectionsHTML = `
        <div class="print-section main-section">
            <h2 class="print-section-title" style="color: #d97706; border-bottom: 2px solid #f59e0b;">ITENS PERSONALIZADOS ADICIONAIS</h2>
            <div class="print-section-content">
                ${report.customSections.map(node => renderPrintNode(node)).join('')}
            </div>
        </div>`;
    }

    return standardSectionsHTML + customSectionsHTML;
}

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



function editReport(id) {
    const report = finalizedReports.find(r => r.id === id);
    if (report) {
        openChecklistForm({
            tipo: report.type,
            empresa: report.empresa,
            equipamentoId: report.equipamentoId || report.equipamento,
            equipamentoNome: report.equipamentoNome || report.equipamento,
            assetInfo: report.assetInfo,
        }, report);
    }
}

window.finalizarExclusaoDefinitiva = function() {
    finalizedReports = finalizedReports.filter(r => r.id !== window.reportIdParaExcluir);
    setStoredData('crane_reports', finalizedReports);
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
    renderAssets();
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
    const internalCompanyRaw = localStorage.getItem('crane_internal_company');
    let internalCompany = null;
    if (internalCompanyRaw) {
        try {
            internalCompany = JSON.parse(internalCompanyRaw);
        } catch (e) {
            console.error("Erro ao carregar empresa interna para PDF:", e);
        }
    }

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

    // 3. Abrir janela e escrever HTML
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        return window.showAlert('POR FAVOR, HABILITE OS POP-UPS NO SEU NAVEGADOR PARA GERAR O PDF.', 'warning');
    }

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

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Carrega todos os dados do IndexedDB para as variáveis globais
    await loadAllDataFromDB();
    
    // 2. Carrega as listas locais do app.js vindas do DB mantendo as referências originais de memória intactas
    const dbAssets = await getDBValue('crane_assets', assets);
    updateArrayInPlace(assets, dbAssets);

    const dbEvents = await getDBValue('crane_events', events);
    updateArrayInPlace(events, dbEvents);

    const dbOpenOrders = await getDBValue('crane_open_orders', openOrders);
    updateArrayInPlace(openOrders, dbOpenOrders);

    const dbFinalizedReports = await getDBValue('crane_reports', finalizedReports);
    updateArrayInPlace(finalizedReports, dbFinalizedReports);

    // 3. Roda as migrações com os dados atualizados do DB
    runMigrationsAndSync();

    // Garante que os eventos existam antes de renderizar
    if (events.length === 0 && assets.length > 0) {
        saveAssets();
    }
    
    renderCompanies();
    renderAssets();
    
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

    // Sidebar de empresas na vista de ativos
    renderCompaniesUI('assets-view-companies-tbody', companies, selectedCompany, (company) => {
        selectedCompany = company;
        renderAtivosView();
    });

    const filteredAssets = allAssetsList.filter(a => a.empresa && selectedCompany && a.empresa.toLowerCase() === selectedCompany.toLowerCase());
    
    tbody.innerHTML = filteredAssets.map(a => `
        <tr class="hover:bg-surface-container transition-colors duration-200 group">
            <td class="px-card_padding py-3 text-label-md font-bold uppercase text-on-surface">
                <div class="flex items-center justify-between">
                    <span>${a.id}</span>
                    <button onclick="event.stopPropagation(); window.openEditAssetModal('${a.id}', '${a.empresa}')" class="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-on-surface p-0.5 transition-all duration-200 flex items-center justify-center rounded">
                        <span class="material-symbols-outlined" style="font-size:16px;">edit</span>
                    </button>
                </div>
            </td>
            <td class="px-card_padding py-3 text-label-md uppercase text-on-surface-variant">${(a.local || 'N/A').toUpperCase()}</td>
            <td class="px-card_padding py-3 text-label-md uppercase text-on-surface-variant">${(a.tipo || a.nome || 'N/A').toUpperCase()}</td>
            <td class="px-card_padding py-3 text-label-md uppercase text-on-surface-variant">${(a.capacidade || 'N/A').toUpperCase()}</td>
            <td class="px-card_padding py-3 text-label-md uppercase text-on-surface-variant">${(a.vao || 'N/A').toUpperCase()}</td>
            <td class="px-card_padding py-3 text-label-md uppercase text-on-surface-variant">${(a.altura || 'N/A').toUpperCase()}</td>
            <td class="px-card_padding py-3 text-label-md uppercase text-on-surface-variant">${(a.fabricante || 'N/A').toUpperCase()}</td>
        </tr>
    `).join('') || `<tr><td colspan="7" class="p-8 text-center text-on-surface-variant uppercase font-bold text-label-md">Nenhum ativo técnico encontrado para esta empresa</td></tr>`;
}

// --- UNIFIED REGISTRATION ---

window.openUnifiedRegistrationModal = function() {
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
            btnCancel.onclick = () => document.getElementById('modal-unified-registration').classList.add('hidden');
        }
    }

    if (type === 'empresa') {
        fieldsEmpresa.classList.remove('hidden');
        if (!keepFields) clearEmpresaFields();
    } else if (type === 'ativo') {
        fieldsAtivo.classList.remove('hidden');
        if (!keepFields) clearAtivoFields();
    } else if (type === 'edit-ativo') {
        fieldsAtivo.classList.remove('hidden');
        editSelectors.classList.remove('hidden');
        empresaContainer.classList.add('hidden');
        document.getElementById('reg-ativo-id').disabled = false;
        
        if (!keepFields) {
            const selectEditEmpresa = document.getElementById('reg-edit-empresa');
            if (selectEditEmpresa) selectEditEmpresa.value = '';
            const selectEditAtivo = document.getElementById('reg-edit-ativo-id');
            if (selectEditAtivo) selectEditAtivo.innerHTML = '<option value="">SELECIONAR EMPRESA PRIMEIRO</option>';
            clearAtivoFields();
        }
    }
};

window.deleteAssetFromModal = function() {
    const assetId = document.getElementById('reg-edit-ativo-id').value;
    if (!assetId) {
        return window.showAlert('SELECIONE UM ATIVO PARA EXCLUIR.', 'warning');
    }
    
    window.showAlert(`DESEJA EXCLUIR O ATIVO "${assetId}" E TODOS OS SEUS EVENTOS E HISTÓRICOS?`, 'warning', () => {
        // 1. Remove from allAssetsList
        const newAllAssets = allAssetsList.filter(a => a.id !== assetId);
        setAllAssetsList(newAllAssets);
        
        // 2. Remove from assets (dashboard list)
        assets = assets.filter(a => a.id !== assetId);
        setStoredData('crane_assets', assets);
        
        // 3. Remove from events (calendar events)
        events = events.filter(ev => ev.id !== assetId && ev.equipamento !== assetId);
        setStoredData('crane_events', events);
        
        // 4. Remove from openOrders
        openOrders = openOrders.filter(order => order.equipamentoId !== assetId && order.equipamento !== assetId);
        setStoredData('crane_open_orders', openOrders);
        
        // 5. Remove from finalizedReports
        finalizedReports = finalizedReports.filter(rep => rep.equipamentoId !== assetId && rep.equipamento !== assetId);
        setStoredData('crane_reports', finalizedReports);
        
        // Close modal and refresh UI
        document.getElementById('modal-unified-registration').classList.add('hidden');
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

    const filtered = allAssetsList.filter(a => a.empresa && empresa && a.empresa.toLowerCase() === empresa.toLowerCase());
    if (filtered.length === 0) {
        selectAtivo.innerHTML = `<option value="">NENHUM ATIVO ENCONTRADO</option>`;
    } else {
        selectAtivo.innerHTML = `<option value="">SELECIONAR ATIVO...</option>` + 
            filtered.map(a => `<option value="${a.id}">${a.id} - ${a.nome.toUpperCase()}</option>`).join('');
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
        document.getElementById('reg-ativo-cabo-principal').value = asset.caboPrincipal || '';
        document.getElementById('reg-ativo-capacidade-auxiliar').value = (asset.capacidadeAuxiliar || "").replace(/[^\d.]/g, '');
        document.getElementById('reg-ativo-cabo-auxiliar').value = asset.caboAuxiliar || '';
        document.getElementById('reg-ativo-altura-elevacao').value = (asset.altura || asset.alturaElevacao || "").replace(/[^\d.]/g, '');
        document.getElementById('reg-ativo-vao-ponte').value = (asset.vao || asset.vaoPonte || "").replace(/[^\d.]/g, '');
        
        document.getElementById('reg-ativo-tensao-alimentacao').value = asset.tensaoAlimentacao || '';
        document.getElementById('reg-ativo-tensao-comando').value = asset.tensaoComando || '';
        document.getElementById('reg-ativo-alimentacao-equipamento').value = asset.alimentacaoEquipamento || '';
        document.getElementById('reg-ativo-motor-elev-principal-alta').value = asset.motorElevPrincipalAlta || '';
        document.getElementById('reg-ativo-motor-elev-principal-baixa').value = asset.motorElevPrincipalBaixa || '';
        document.getElementById('reg-ativo-motor-elev-auxiliar-alta').value = asset.motorElevAuxiliarAlta || '';
        document.getElementById('reg-ativo-motor-elev-auxiliar-baixa').value = asset.motorElevAuxiliarBaixa || '';
        document.getElementById('reg-ativo-motor-direcao-carro').value = asset.motorDirecaoCarro || '';
        document.getElementById('reg-ativo-motor-translacao-ponte').value = asset.motorTranslacaoPonte || '';
    }
};

window.saveUnifiedRegistration = function() {
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

        const newCompany = { name, cnpj, endereco, numero, bairro, cep, cidade, estado, referencia, logo };
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

        // Formata com sufixos
        const capacidade = capPrincipalRaw ? `${capPrincipalRaw} TON` : "";
        const vao = vaoRaw ? `${vaoRaw} MTS` : "";
        const altura = alturaRaw ? `${alturaRaw} MTS` : "";
        const capacidadeAuxiliar = capAuxiliarRaw ? `${capAuxiliarRaw} TON` : "";

        const assetData = { 
            id, empresa, nome: tipo, tipo, local, fabricante,
            capacidade, caboPrincipal, capacidadeAuxiliar, caboAuxiliar,
            altura, vao, tensaoAlimentacao, tensaoComando, alimentacaoEquipamento,
            motorElevPrincipalAlta, motorElevPrincipalBaixa, motorElevAuxiliarAlta, motorElevAuxiliarBaixa,
            motorDirecaoCarro, motorTranslacaoPonte
        };
        
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

        // Sincronizar ordens de serviço em aberto e relatórios finalizados
        if (isEdit && oldId) {
            openOrders = openOrders.map(order => {
                if (order.equipamentoId === oldId || order.equipamento === oldId) {
                    return { ...order, equipamentoId: id, equipamento: id, empresa, tipo };
                }
                return order;
            });
            setStoredData('crane_open_orders', openOrders);
            
            finalizedReports = finalizedReports.map(rep => {
                if (rep.equipamentoId === oldId || rep.equipamento === oldId) {
                    return { ...rep, equipamentoId: id, equipamento: id, empresa, tipo };
                }
                return rep;
            });
            setStoredData('crane_reports', finalizedReports);
        }

        setStoredData('crane_assets', assets);
        setStoredData('crane_events', events);
        
        window.showAlert(isEdit ? 'ATIVO ATUALIZADO COM SUCESSO!' : 'NOVO ATIVO CADASTRADO COM SUCESSO!', 'success');
    }

    document.getElementById('modal-unified-registration').classList.add('hidden');
    renderCompanies();
    renderAssets();
    if (currentView === 'assets') renderAtivosView();
};

window.openEditCompanyModal = function(companyName) {
    const modal = document.getElementById('modal-edit-company');
    const panel = modal.querySelector('.relative');
    const deleteBtn = document.getElementById('btn-delete-company-sidebar');
    
    // Encontra o objeto da empresa correspondente
    const companyObj = (companies || []).find(c => {
        const name = typeof c === 'string' ? c : (c?.name || "");
        return name.toLowerCase() === companyName.toLowerCase();
    }) || { name: companyName };

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
            modal.classList.add('hidden');
        });
    };

    modal.classList.remove('hidden');
    setTimeout(() => {
        panel.classList.remove('opacity-0', 'scale-95');
        panel.classList.add('opacity-100', 'scale-100');
    }, 10);
};

window.openEditAssetModal = function(assetId, companyName) {
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

window.saveCompanyChange = function() {
    const oldName = window.currentEditingCompanyName;
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

    // 1. Update companies list (objects/strings)
    const newCompanies = (companies || []).map(c => {
        const name = typeof c === 'string' ? c : (c?.name || "");
        if (name.toLowerCase() === oldName.toLowerCase()) {
            return {
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
        }
        return c;
    });
    setCompanies(newCompanies);

    // 2. Propagate name change to other collections if name changed
    if (oldName.toLowerCase() !== newName.toLowerCase()) {
        // Update allAssetsList (Master)
        const newAllAssets = allAssetsList.map(a => {
            if (a.empresa.toLowerCase() === oldName.toLowerCase()) return { ...a, empresa: newName };
            return a;
        });
        setAllAssetsList(newAllAssets);

        // Update dashboard assets
        assets = assets.map(a => {
            if (a.empresa.toLowerCase() === oldName.toLowerCase()) return { ...a, empresa: newName };
            return a;
        });
        setStoredData('crane_assets', assets);

        // Update calendar events
        events = events.map(e => {
            if (e.empresa.toLowerCase() === oldName.toLowerCase()) return { ...e, empresa: newName };
            return e;
        });
        setStoredData('crane_events', events);

        // Update finalized reports if they exist
        finalizedReports = finalizedReports.map(r => {
            if (r.empresa.toLowerCase() === oldName.toLowerCase()) return { ...r, empresa: newName };
            return r;
        });
        setStoredData('crane_reports', finalizedReports);

        if (selectedCompany.toLowerCase() === oldName.toLowerCase()) {
            selectedCompany = newName;
        }
        if (reportsSelectedCompany.toLowerCase() === oldName.toLowerCase()) {
            reportsSelectedCompany = newName;
        }
    }

    document.getElementById('modal-edit-company').classList.add('hidden');
    renderCompanies();
    renderAssets();
    window.renderCalendar();
    if (currentView === 'assets') renderAtivosView();
    if (currentView === 'reports') renderReportsView();
    window.showAlert('DADOS DA EMPRESA ATUALIZADOS EM TODO O SISTEMA.', 'success');
};

window.deleteCompany = function(empresaNome) {
    const target = empresaNome.trim().toLowerCase();
    
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
