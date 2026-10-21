import { monthsMap, monthNames, parseAssetDate, formatDateToDisplay } from './utils.js';
import { allAssetsList } from './data.js';

export function renderCompanies(containerId, companies, selectedCompany, onSelect) {
    const tbody = document.getElementById(containerId);
    if (!tbody) return;
    tbody.innerHTML = '';

    companies.forEach(company => {
        const companyName = typeof company === 'string' ? company : company.name;
        const isSelected = companyName === selectedCompany;
        const tr = document.createElement('tr');
        tr.className = isSelected
            ? "bg-primary-container cursor-pointer border-l-4 border-primary transition-all duration-200"
            : "bg-surface hover:bg-surface-container transition-all duration-200 cursor-pointer group border-l-4 border-transparent";

        tr.onclick = () => onSelect(companyName);

        tr.innerHTML = `
            <td class="py-stack_sm px-card_padding flex items-center justify-between">
                ${isSelected 
                    ? `<span class="text-on-primary-container text-label-md font-bold uppercase">${companyName}</span>`
                    : `<span class="text-on-surface-variant text-label-md uppercase group-hover:text-on-surface transition-all duration-200">${companyName}</span>`
                }
            </td>`;

        tbody.appendChild(tr);
    });
}

export function getDefaultAssetImage(tipo = '') {
    const t = (tipo || '').toUpperCase();
    if (t.includes('TALHA')) {
        return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" rx="16" fill="%23f4f4f5"/><path d="M20 30 L100 30 L95 40 L25 40 Z" fill="%23eab308"/><rect x="42" y="38" width="36" height="28" rx="4" fill="%2318181b"/><rect x="46" y="44" width="28" height="16" rx="2" fill="%23eab308"/><line x1="60" y1="66" x2="60" y2="88" stroke="%2371717a" stroke-width="3" stroke-dasharray="4 2"/><circle cx="60" cy="94" r="8" fill="none" stroke="%23eab308" stroke-width="4"/><path d="M60 90 L60 106 L66 102" fill="none" stroke="%23eab308" stroke-width="4" stroke-linecap="round"/></svg>`;
    } else if (t.includes('PORTICO') || t.includes('PÓRTICO')) {
        return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" rx="16" fill="%23f4f4f5"/><path d="M25 35 L95 35 L90 45 L30 45 Z" fill="%23eab308"/><line x1="30" y1="45" x2="20" y2="100" stroke="%2318181b" stroke-width="6"/><line x1="90" y1="45" x2="100" y2="100" stroke="%2318181b" stroke-width="6"/><rect x="52" y="42" width="16" height="12" rx="2" fill="%23eab308"/><line x1="60" y1="54" x2="60" y2="76" stroke="%2371717a" stroke-width="2"/><circle cx="60" cy="82" r="5" fill="none" stroke="%23eab308" stroke-width="3"/></svg>`;
    } else {
        return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" rx="16" fill="%23f4f4f5"/><rect x="15" y="32" width="90" height="14" rx="2" fill="%23eab308"/><rect x="15" y="50" width="90" height="14" rx="2" fill="%23eab308"/><rect x="48" y="28" width="24" height="40" rx="4" fill="%2318181b"/><line x1="60" y1="68" x2="60" y2="92" stroke="%2371717a" stroke-width="3"/><circle cx="60" cy="98" r="6" fill="none" stroke="%23eab308" stroke-width="3"/></svg>`;
    }
}

export function getDefaultCompanyLogo() {
    return `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" rx="16" fill="%23ffffff" stroke="%23e4e4e7" stroke-width="2"/><path d="M30 95 L30 42 L60 25 L90 42 L90 95 Z" fill="%2318181b"/><rect x="42" y="48" width="10" height="10" rx="2" fill="%23eab308"/><rect x="68" y="48" width="10" height="10" rx="2" fill="%23eab308"/><rect x="42" y="66" width="10" height="10" rx="2" fill="%23eab308"/><rect x="68" y="66" width="10" height="10" rx="2" fill="%23eab308"/><rect x="52" y="80" width="16" height="15" rx="1" fill="%23eab308"/></svg>`;
}

export function renderAssetsTable({ tbodyId, theadId, titleId, events, selectedCompany, isGlobalFilterActive, filterMonthOffset, searchTerm }) {
    const tbody = document.getElementById(tbodyId);
    const thead = document.getElementById(theadId);
    const title = titleId ? document.getElementById(titleId) : null;
    const mobileContainer = document.getElementById('assets-mobile-container');
    if (!tbody || !thead) return;

    tbody.innerHTML = '';
    if (mobileContainer) mobileContainer.innerHTML = '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (title) {
        title.innerText = searchTerm.length > 0 ? `BUSCA: "${searchTerm.toUpperCase()}"` : "AGENDA DO MÊS";
    }
    thead.innerHTML = `
        <tr class="bg-surface-container border-b border-outline-variant sticky top-0 z-10">
            <th class="py-stack_sm px-card_padding text-label-md text-on-surface-variant uppercase tracking-wider text-left col-empresa">EMPRESA</th>
            <th class="py-stack_sm px-card_padding text-label-md text-on-surface-variant uppercase tracking-wider text-left col-equipamento">ID EQUIPAMENTO</th>
            <th class="py-stack_sm px-card_padding text-label-md text-on-surface-variant uppercase tracking-wider text-left col-tipo">TIPO</th>
            <th class="py-stack_sm px-card_padding text-label-md text-on-surface-variant uppercase tracking-wider text-left col-local">LOCALIZAÇÃO</th>
            <th class="py-stack_sm px-card_padding text-label-md text-on-surface-variant uppercase tracking-wider text-left col-data">PROX. INSPEÇÃO</th>
            <th class="py-stack_sm px-card_padding text-label-md text-on-surface-variant uppercase tracking-wider text-left col-semana">DIA SEMANA</th>
            <th class="py-stack_sm px-card_padding text-label-md text-on-surface-variant uppercase tracking-wider text-left col-tecnico">TÉCNICO</th>
            <th class="py-stack_sm px-card_padding text-label-md text-on-surface-variant uppercase tracking-wider text-right col-acoes">AÇÕES</th>
        </tr>
    `;

    // Filtro sempre considera todos os ativos (isGlobalFilterActive forçado em app.js)
    let filtered = [];
    if (searchTerm.length > 0) {
        const words = searchTerm.toLowerCase().split(' ').filter(w => w.length > 0);
        filtered = events.filter(e => {
            const target = `${e.empresa} ${e.equipamento}`.toLowerCase();
            return words.every(w => target.includes(w));
        });
    } else {
        const targetDate = new Date();
        targetDate.setMonth(targetDate.getMonth() + filterMonthOffset);
        const targetMonth = targetDate.getMonth();
        const targetYear = targetDate.getFullYear();

        filtered = events.filter(e => {
            if (!e || !e.date) return false;
            const d = new Date(e.date + 'T12:00:00');
            if (isNaN(d.getTime())) return false; // Data inválida
            return d.getMonth() === targetMonth && d.getFullYear() === targetYear;
        });
    }

    filtered.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Renderiza Mobile Cards (Fundo Branco de Alto Contraste - Padrão Mockup)
    if (mobileContainer) {
        if (filtered.length === 0) {
            mobileContainer.innerHTML = `
                <div class="bg-white rounded-xl p-6 text-center border border-[#e6d5a8] shadow-sm text-[#4a4a4a]">
                    <span class="material-symbols-outlined text-3xl text-[#fa520f] mb-2">event_busy</span>
                    <p class="font-bold text-[13px] text-[#1f1f1f] uppercase">Nenhuma programação encontrada</p>
                    <p class="text-[12px] text-[#6a6a6a] mt-1">Nenhum ativo agendado para o mês selecionado.</p>
                </div>
            `;
        } else {
            filtered.forEach(event => {
                const eventDate = new Date(event.date + 'T00:00:00');
                eventDate.setHours(0, 0, 0, 0);
                const diffDays = Math.round((eventDate - today) / (1000 * 60 * 60 * 24));

                let dateColor = "text-[#15803d] font-bold";
                if (event.status === 'NAO_REALIZADO' || diffDays <= 0) {
                    dateColor = "text-red-600 font-bold";
                } else if (diffDays >= 1 && diffDays <= 7) {
                    dateColor = "text-[#d97706] font-bold";
                }

                const displayDate = formatDateToDisplay(eventDate);
                const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
                const dayOfWeek = dayNames[eventDate.getDay()];

                const eqId = String(event.equipamento || event.id || '').trim().toUpperCase();
                const matchingAsset = (allAssetsList || []).find(a => String(a.id || '').trim().toUpperCase() === eqId) ||
                                      (typeof assets !== 'undefined' && Array.isArray(assets) ? assets.find(a => String(a.id || '').trim().toUpperCase() === eqId) : null);
                const displayNome = (matchingAsset?.nome || matchingAsset?.tipo || event.tipo || 'Equipamento').toUpperCase();
                const displayTipo = (event.tipo && event.tipo !== 'N/A')
                    ? event.tipo
                    : (matchingAsset ? (matchingAsset.tipo || matchingAsset.nome || 'N/A') : 'N/A');
                const displayLocal = (event.local && event.local !== 'SETOR OPERACIONAL')
                    ? event.local
                    : (matchingAsset ? (matchingAsset.local || 'SETOR OPERACIONAL') : 'SETOR OPERACIONAL');

                let displayTecnicos = event.tecnico || '';
                if (!displayTecnicos && Array.isArray(event.tecnicos) && event.tecnicos.length > 0) {
                    displayTecnicos = event.tecnicos.join(' | ');
                }
                displayTecnicos = displayTecnicos ? displayTecnicos.toUpperCase() : '---';

                const fotoUrl = event.foto || matchingAsset?.foto || matchingAsset?.photo || matchingAsset?.imagemUrl || getDefaultAssetImage(displayTipo);

                const card = document.createElement('div');
                card.className = "bg-white text-[#1f1f1f] rounded-xl p-3 shadow-sm border border-[#e6d5a8] flex gap-3.5 items-center cursor-pointer hover:shadow-md transition-all active:scale-[0.99]";
                card.onclick = (e) => {
                    if (typeof window.openEditModal === 'function') {
                        window.openEditModal(e, event.id);
                    }
                };

                const imgBox = document.createElement('div');
                imgBox.className = "w-20 h-20 rounded-lg bg-[#fff8e0] flex-shrink-0 overflow-hidden flex items-center justify-center border border-[#e6d5a8]";
                
                const imgEl = document.createElement('img');
                imgEl.alt = displayNome;
                imgEl.className = "w-full h-full object-cover";
                imgEl.src = fotoUrl;
                imgEl.onerror = function() {
                    this.onerror = null;
                    this.src = getDefaultAssetImage(displayTipo);
                };
                imgBox.appendChild(imgEl);

                const infoBox = document.createElement('div');
                infoBox.className = "flex-1 min-w-0 text-left text-[12px] leading-tight space-y-1 text-[#4a4a4a]";
                infoBox.innerHTML = `
                    <div class="font-bold text-[#1f1f1f] text-[13px] truncate leading-tight">Ativo: ${displayNome}</div>
                    <div class="text-[#1f1f1f] font-semibold flex items-center gap-1.5">ID: <span class="font-mono font-bold text-[#fa520f] bg-[#fff0c2] px-1.5 py-0.5 rounded border border-[#e6d5a8] text-[11px] leading-none">${event.equipamento || event.id}</span></div>
                    <div class="text-[#4a4a4a] truncate font-medium">Empresa: <span class="text-[#1f1f1f] font-bold">${event.empresa || '---'}</span></div>
                    <div class="text-[#4a4a4a] truncate font-medium">Local: <span class="text-[#1f1f1f] font-semibold">${displayLocal}</span></div>
                    <div class="text-[#4a4a4a] truncate font-medium">Técnicos: <span class="text-[#1f1f1f] font-semibold">${displayTecnicos}</span></div>
                    <div class="${dateColor} pt-0.5 text-[11px] font-semibold">Data: ${displayDate} - ${dayOfWeek}</div>
                `;

                card.appendChild(imgBox);
                card.appendChild(infoBox);
                mobileContainer.appendChild(card);
            });
        }
    }

    // Renderiza Desktop Table
    filtered.forEach(event => {
        const tr = document.createElement('tr');
        tr.className = "bg-surface hover:bg-surface-container transition-all duration-200 group border-b border-outline";

        const eventDate = new Date(event.date + 'T00:00:00');
        eventDate.setHours(0, 0, 0, 0);
        const diffDays = Math.round((eventDate - today) / (1000 * 60 * 60 * 24));

        let dateColor = "text-[#15803d] font-bold";
        if (event.status === 'NAO_REALIZADO' || diffDays <= 0) {
            dateColor = "text-red-600 font-bold";
        } else if (diffDays >= 1 && diffDays <= 7) {
            dateColor = "text-[#d97706] font-bold";
        }

        const displayDate = formatDateToDisplay(eventDate);
        const dayNames = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
        const dayOfWeek = dayNames[eventDate.getDay()];

        const eqId = String(event.equipamento || event.id || '').trim().toUpperCase();
        const matchingAsset = (allAssetsList || []).find(a => String(a.id || '').trim().toUpperCase() === eqId) ||
                              (typeof assets !== 'undefined' && Array.isArray(assets) ? assets.find(a => String(a.id || '').trim().toUpperCase() === eqId) : null);
        const displayTipo = (event.tipo && event.tipo !== 'N/A')
            ? event.tipo
            : (matchingAsset ? (matchingAsset.tipo || matchingAsset.nome || 'N/A') : 'N/A');
        const displayLocal = (event.local && event.local !== 'SETOR OPERACIONAL')
            ? event.local
            : (matchingAsset ? (matchingAsset.local || 'SETOR OPERACIONAL') : 'SETOR OPERACIONAL');

        let displayTecnicos = event.tecnico || '';
        if (!displayTecnicos && Array.isArray(event.tecnicos) && event.tecnicos.length > 0) {
            displayTecnicos = event.tecnicos.join(' | ');
        }
        displayTecnicos = displayTecnicos ? displayTecnicos.toUpperCase() : '---';

        tr.innerHTML = `
            <td class="py-stack_sm px-card_padding text-body-md uppercase text-on-surface col-empresa truncate">${event.empresa}</td>
            <td class="py-stack_sm px-card_padding font-bold text-body-md uppercase transition-all duration-200 col-equipamento text-on-surface whitespace-nowrap">${event.equipamento}</td>
            <td class="py-stack_sm px-card_padding text-body-md uppercase text-on-surface-variant col-tipo truncate">${displayTipo}</td>
            <td class="py-stack_sm px-card_padding text-body-md uppercase text-on-surface-variant col-local truncate">${displayLocal}</td>
            <td class="py-stack_sm px-card_padding text-body-md font-bold ${dateColor} col-data whitespace-nowrap">
                ${displayDate}
                ${event.status === 'NAO_REALIZADO' ? '<br><span class="text-label-md text-error uppercase">NÃO REALIZADO</span>' : ''}
            </td>
            <td class="py-stack_sm px-card_padding text-body-md text-on-surface-variant uppercase col-semana whitespace-nowrap">${dayOfWeek}</td>
            <td class="py-stack_sm px-card_padding text-body-md font-semibold text-on-surface uppercase col-tecnico whitespace-nowrap">${displayTecnicos}</td>
            <td class="py-stack_sm px-card_padding text-right col-acoes">
                <button onclick="window.openEditModal(event, '${event.id}')" class="text-on-surface-variant hover:text-on-surface p-1 transition-all duration-200">
                    <span class="material-symbols-outlined text-headline-md text-on-surface-variant">edit</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
