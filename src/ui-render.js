// Crane Pro - UI Rendering Module
import { monthsMap, monthNames, parseAssetDate, formatDateToDisplay } from './utils.js';

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
            <td class="py-stack_sm px-card_padding flex items-center justify-between group/row">
                ${isSelected 
                    ? `<span class="text-on-primary-container text-label-md font-bold uppercase">${companyName}</span>`
                    : `<span class="text-on-surface-variant text-label-md uppercase group-hover:text-on-surface transition-all duration-200">${companyName}</span>`
                }
                <button onclick="event.stopPropagation(); window.openEditCompanyModal('${companyName}')" class="opacity-0 group-hover/row:opacity-100 text-on-surface-variant hover:text-on-surface p-1 transition-all duration-200">
                    <span class="material-symbols-outlined" style="font-size:16px;">edit</span>
                </button>
            </td>`;

        tbody.appendChild(tr);
    });
}

export function renderAssetsTable({ tbodyId, theadId, titleId, events, selectedCompany, isGlobalFilterActive, filterMonthOffset, searchTerm }) {
    const tbody = document.getElementById(tbodyId);
    const thead = document.getElementById(theadId);
    const title = document.getElementById(titleId);
    if (!tbody || !title || !thead) return;

    tbody.innerHTML = '';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    title.innerText = searchTerm.length > 0 ? `BUSCA: "${searchTerm.toUpperCase()}"` : "AGENDA DO MÊS";
    thead.innerHTML = `
        <tr class="bg-surface-container border-b border-outline-variant sticky top-0 z-10">
            <th class="py-stack_sm px-card_padding text-label-md text-on-surface-variant uppercase tracking-wider text-left col-empresa">EMPRESA</th>
            <th class="py-stack_sm px-card_padding text-label-md text-on-surface-variant uppercase tracking-wider text-left col-equipamento">ID EQUIPAMENTO</th>
            <th class="py-stack_sm px-card_padding text-label-md text-on-surface-variant uppercase tracking-wider text-left col-tipo">TIPO</th>
            <th class="py-stack_sm px-card_padding text-label-md text-on-surface-variant uppercase tracking-wider text-left col-local">LOCALIZAÇÃO</th>
            <th class="py-stack_sm px-card_padding text-label-md text-on-surface-variant uppercase tracking-wider text-left col-data">PROX. INSPEÇÃO</th>
            <th class="py-stack_sm px-card_padding text-label-md text-on-surface-variant uppercase tracking-wider text-left col-semana">DIA SEMANA</th>
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

    filtered.forEach(event => {
        const tr = document.createElement('tr');
        tr.className = "bg-surface hover:bg-surface-container transition-all duration-200 group border-b border-outline";

        const eventDate = new Date(event.date + 'T00:00:00');
        eventDate.setHours(0, 0, 0, 0);
        const diffDays = Math.round((eventDate - today) / (1000 * 60 * 60 * 24));

        let dateColor = "text-on-surface";
        if (event.status === 'NAO_REALIZADO') {
            dateColor = "text-red-600 font-bold";
        } else if (diffDays <= 0) {
            dateColor = "text-red-600 font-bold";
        } else if (diffDays >= 1 && diffDays <= 7) {
            dateColor = "text-orange-500 font-bold";
        }

        const displayDate = formatDateToDisplay(eventDate);
        const dayNames = ['DOMINGO', 'SEGUNDA', 'TERÇA', 'QUARTA', 'QUINTA', 'SEXTA', 'SÁBADO'];
        const dayOfWeek = dayNames[eventDate.getDay()];

        tr.innerHTML = `
            <td class="py-stack_sm px-card_padding text-body-md uppercase text-on-surface col-empresa">${event.empresa}</td>
            <td class="py-stack_sm px-card_padding font-bold text-body-md uppercase transition-all duration-200 col-equipamento text-on-surface">${event.equipamento}</td>
            <td class="py-stack_sm px-card_padding text-body-md uppercase text-on-surface-variant col-tipo">${event.tipo || 'N/A'}</td>
            <td class="py-stack_sm px-card_padding text-body-md uppercase text-on-surface-variant col-local">${event.local || 'SETOR OPERACIONAL'}</td>
            <td class="py-stack_sm px-card_padding text-body-md font-bold ${dateColor} col-data">
                ${displayDate}
                ${event.status === 'NAO_REALIZADO' ? '<br><span class="text-label-md text-error uppercase">NÃO REALIZADO</span>' : ''}
            </td>
            <td class="py-stack_sm px-card_padding text-body-md text-on-surface-variant uppercase col-semana">${dayOfWeek}</td>
            <td class="py-stack_sm px-card_padding text-right col-acoes">
                <button onclick="window.openEditModal(event, '${event.id}')" class="text-on-surface-variant hover:text-on-surface p-1 transition-all duration-200">
                    <span class="material-symbols-outlined text-headline-md text-on-surface-variant">edit</span>
                </button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}
