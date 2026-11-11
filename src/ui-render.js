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

export function calculateGridCardPosition(index, rowsPerCol = 5, numCols = 3) {
    const validRows = Math.max(1, rowsPerCol);
    const validCols = Math.max(1, numCols);
    const blockSize = validRows * validCols;
    const blockIndex = Math.floor(index / blockSize);
    const indexInBlock = index % blockSize;
    const col = Math.floor(indexInBlock / validRows); // 0 to numCols - 1
    const rowInBlock = indexInBlock % validRows;      // 0 to validRows - 1
    const globalRow = blockIndex * validRows + rowInBlock + 1; // 1-based for CSS Grid
    const globalCol = col + 1;                                  // 1-based for CSS Grid
    return { row: globalRow, col: globalCol };
}

export function getRowsPerColumn(isCalendarVisible = true) {
    if (typeof window !== 'undefined' && window.innerHeight) {
        // Reservamos espaço para header + filtros + padding (~140px sem calendário, ~340px com calendário)
        const reserved = isCalendarVisible ? 340 : 140;
        const available = window.innerHeight - reserved;
        // Cada card ocupa 148px de altura + 12px de gap = 160px
        const computed = Math.floor((available + 12) / 160);
        if (computed >= 3) {
            return isCalendarVisible ? Math.min(computed, 6) : computed;
        }
    }
    return isCalendarVisible ? 5 : 8;
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
        <tr class="bg-[#fff8e0] border-b border-[#e6d5a8] sticky top-0 z-10 text-[#1f1f1f] select-none">
            <th class="py-2.5 px-3 text-[11px] font-extrabold uppercase tracking-wider text-[#1f1f1f] text-left">EMPRESA</th>
            <th class="py-2.5 px-3 text-[11px] font-extrabold uppercase tracking-wider text-[#1f1f1f] text-left whitespace-nowrap">ID</th>
            <th class="py-2.5 px-3 text-[11px] font-extrabold uppercase tracking-wider text-[#1f1f1f] text-left">ATIVO</th>
            <th class="py-2.5 px-3 text-[11px] font-extrabold uppercase tracking-wider text-[#1f1f1f] text-left">LOCALIZAÇÃO</th>
            <th class="py-2.5 px-3 text-[11px] font-extrabold uppercase tracking-wider text-[#1f1f1f] text-left whitespace-nowrap">PROX. INSPEÇÃO</th>
            <th class="py-2.5 px-3 text-[11px] font-extrabold uppercase tracking-wider text-[#1f1f1f] text-left whitespace-nowrap">DIA SEMANA</th>
            <th class="py-2.5 px-3 text-[11px] font-extrabold uppercase tracking-wider text-[#1f1f1f] text-left">NOME DOS TÉCNICOS</th>
            <th class="py-2.5 px-3 text-[11px] font-extrabold uppercase tracking-wider text-[#1f1f1f] text-right">AÇÕES</th>
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

    const desktopContainer = document.getElementById('assets-desktop-container');
    if (desktopContainer) desktopContainer.innerHTML = '';

    // Renderiza Mobile e Desktop Cards (Fundo Branco de Alto Contraste - Padrão Mockup)
    const renderCardElement = (event) => {
        const eventDate = new Date(event.date + 'T00:00:00');
        eventDate.setHours(0, 0, 0, 0);
        const diffDays = Math.round((eventDate - today) / (1000 * 60 * 60 * 24));

        let dateColor = "text-[#15803d] font-bold";
        if (event.status === 'NAO_REALIZADO' || diffDays <= 0) {
            dateColor = "text-red-600 font-bold";
        } else if (diffDays >= 1 && diffDays <= 7) {
            dateColor = "text-[#d97706] font-bold";
        }

        const dateObj = new Date(event.date + 'T12:00:00');
        let formattedDateHyphen = '--/--/----';
        let weekdayName = '---';
        if (!isNaN(dateObj.getTime())) {
            const dDay = String(dateObj.getDate()).padStart(2, '0');
            const dMonth = String(dateObj.getMonth() + 1).padStart(2, '0');
            const dYear = dateObj.getFullYear();
            formattedDateHyphen = `${dDay}-${dMonth}-${dYear}`;
            const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
            weekdayName = dayNames[dateObj.getDay()] || '';
        }

        // Identificação limpa e normalizada do ID do equipamento (ex: '#EQP-0001', 'EQP-0001', ou id composto '#EQP-0001-2026-10-09')
        let rawEquip = String(event.equipamento || '').trim();
        if (!rawEquip && event.id) {
            rawEquip = event.id.includes('-20') ? event.id.substring(0, event.id.lastIndexOf('-20')) : event.id;
        }
        const cleanNormId = rawEquip.toLowerCase().replace(/[^a-z0-9]/g, '');
        const evEmpresa = (event.empresa || '').trim().toLowerCase();

        // Obtém a lista atualizada de ativos do sistema priorizando o estado global carregado
        const candidateAssets = (typeof window !== 'undefined' && Array.isArray(window.allAssetsList) && window.allAssetsList.length > 0)
            ? window.allAssetsList
            : (Array.isArray(allAssetsList) && allAssetsList.length > 0 ? allAssetsList : (typeof assets !== 'undefined' && Array.isArray(assets) ? assets : []));

        // Busca resiliente do ativo cadastrado:
        // 1ª tentativa: Correspondência por ID normalizado + Empresa
        let matchingAsset = candidateAssets.find(a => {
            if (!a || !a.id) return false;
            const aNormId = String(a.id).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            const idMatch = (aNormId && cleanNormId && aNormId === cleanNormId) ||
                            (String(a.id).trim().toUpperCase() === rawEquip.toUpperCase()) ||
                            (event.id && String(a.id).trim().toUpperCase() === String(event.id).trim().toUpperCase());
            if (!idMatch) return false;
            if (!evEmpresa || !a.empresa) return true;
            return a.empresa.trim().toLowerCase() === evEmpresa;
        });

        // 2ª tentativa: Se não encontrou por empresa exata, busca pelo ID único
        if (!matchingAsset && cleanNormId) {
            matchingAsset = candidateAssets.find(a => {
                if (!a || !a.id) return false;
                const aNormId = String(a.id).trim().toLowerCase().replace(/[^a-z0-9]/g, '');
                return (aNormId && aNormId === cleanNormId) || String(a.id).trim().toUpperCase() === rawEquip.toUpperCase();
            });
        }

        const displayNome = (matchingAsset?.nome || matchingAsset?.tipo || event.tipo || 'Equipamento').toUpperCase();
        const displayTipo = (event.tipo && event.tipo !== 'N/A')
            ? event.tipo
            : (matchingAsset ? (matchingAsset.tipo || matchingAsset.nome || 'N/A') : 'N/A');
        const displayLocal = String((event.local && event.local !== 'SETOR OPERACIONAL')
            ? event.local
            : (matchingAsset ? (matchingAsset.local || 'SETOR OPERACIONAL') : 'SETOR OPERACIONAL')).toUpperCase();

        let displayTecnicos = event.tecnico || '';
        if (!displayTecnicos && Array.isArray(event.tecnicos) && event.tecnicos.length > 0) {
            displayTecnicos = event.tecnicos.join(' | ');
        }
        displayTecnicos = displayTecnicos ? displayTecnicos.toUpperCase() : '---';

        let fotoUrl = '';
        if (matchingAsset) {
            fotoUrl = (typeof matchingAsset.foto === 'string' && matchingAsset.foto.trim() !== '' ? matchingAsset.foto : '') ||
                      (matchingAsset.custom_fields && typeof matchingAsset.custom_fields.foto === 'string' && matchingAsset.custom_fields.foto.trim() !== '' ? matchingAsset.custom_fields.foto : '') ||
                      (typeof matchingAsset.photo === 'string' && matchingAsset.photo.trim() !== '' ? matchingAsset.photo : '') ||
                      (typeof matchingAsset.imagemUrl === 'string' && matchingAsset.imagemUrl.trim() !== '' ? matchingAsset.imagemUrl : '');
        }
        if (!fotoUrl && event && typeof event.foto === 'string' && event.foto.trim() !== '') {
            fotoUrl = event.foto;
        }
        if (!fotoUrl) {
            fotoUrl = getDefaultAssetImage(displayTipo);
        }

        const card = document.createElement('div');
        card.className = "bg-white text-[#1f1f1f] rounded-2xl p-3.5 shadow-sm border border-[#e6d5a8] flex gap-3.5 items-center justify-between cursor-pointer hover:shadow-md transition-all active:scale-[0.99] min-h-[148px] h-[148px]";
        card.onclick = (e) => {
            if (typeof window.openEditModal === 'function') {
                window.openEditModal(e, event.id);
            }
        };

        const imgBox = document.createElement('div');
        imgBox.className = "w-20 h-20 rounded-xl bg-[#fff8e0] flex-shrink-0 overflow-hidden flex items-center justify-center border border-[#e6d5a8]";
        
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
            <div class="font-bold text-[#1f1f1f] text-[13px] truncate leading-tight">Empresa: ${(event.empresa || '---').toUpperCase()}</div>
            <div class="text-[#4a4a4a] truncate font-medium">Ativo: <span class="text-[#1f1f1f] font-semibold uppercase">${displayNome}</span></div>
            <div class="text-[#4a4a4a] font-medium flex items-center gap-1.5">ID: <span class="font-mono font-bold text-[#fa520f] bg-[#fff0c2] px-1.5 py-0.5 rounded border border-[#e6d5a8] text-[11px] leading-none">${event.equipamento || event.id}</span></div>
            <div class="text-[#4a4a4a] truncate font-medium">Local: <span class="text-[#1f1f1f] font-semibold uppercase">${displayLocal}</span></div>
            <div class="text-[#4a4a4a] truncate font-medium">Técnicos: <span class="text-[#1f1f1f] font-semibold uppercase">${displayTecnicos}</span></div>
        `;

        const dateBadge = document.createElement('div');
        dateBadge.className = "bg-[#fff8e0] border border-[#e6d5a8] rounded-2xl px-3.5 py-3 flex flex-col items-center justify-center shrink-0 min-w-[95px] md:min-w-[105px] shadow-sm select-none text-center";
        dateBadge.innerHTML = `
            <span class="text-[11px] font-bold text-zinc-700 leading-none">Data</span>
            <span class="text-[12px] md:text-[13px] font-black text-zinc-900 leading-tight my-1 tracking-tight">${formattedDateHyphen}</span>
            <span class="text-[11px] font-bold text-zinc-700 leading-none">${weekdayName}</span>
        `;

        card.appendChild(imgBox);
        card.appendChild(infoBox);
        card.appendChild(dateBadge);
        return card;
    };

    const emptyHTML = `
        <div class="col-span-full bg-white rounded-xl p-6 text-center border border-[#e6d5a8] shadow-sm text-[#4a4a4a]">
            <span class="material-symbols-outlined text-3xl text-[#fa520f] mb-2">event_busy</span>
            <p class="font-bold text-[13px] text-[#1f1f1f] uppercase">Nenhuma programação encontrada</p>
            <p class="text-[12px] text-[#6a6a6a] mt-1">Nenhum ativo agendado para o mês selecionado.</p>
        </div>
    `;

    if (filtered.length === 0) {
        if (mobileContainer) mobileContainer.innerHTML = emptyHTML;
        if (desktopContainer) desktopContainer.innerHTML = emptyHTML;
    } else {
        if (mobileContainer) {
            filtered.forEach(event => {
                mobileContainer.appendChild(renderCardElement(event));
            });
        }

        if (desktopContainer) {
            const calendarSection = document.getElementById('calendar-card-section');
            const isCalendarVisible = !calendarSection || !calendarSection.classList.contains('hidden');
            let numCols = 3;
            if (typeof window !== 'undefined' && window.innerWidth < 1024) {
                numCols = 2;
            }
            const rowsPerCol = getRowsPerColumn(isCalendarVisible);

            filtered.forEach((event, idx) => {
                const card = renderCardElement(event);
                const { row, col } = calculateGridCardPosition(idx, rowsPerCol, numCols);
                card.style.gridRow = `${row} / span 1`;
                card.style.gridColumn = `${col} / span 1`;
                desktopContainer.appendChild(card);
            });
        }
    }

    // Renderiza Desktop Table
    if (filtered.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-zinc-500 uppercase font-bold text-xs">Nenhum agendamento encontrado para o mês selecionado</td></tr>`;
    } else {
        filtered.forEach(event => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-[#fffdf7] border-b border-[#e6d5a8]/60 transition-colors text-[11px] text-[#1f1f1f] cursor-pointer group";
            tr.onclick = (e) => {
                if (!e.target.closest('button') && typeof window.openEditModal === 'function') {
                    window.openEditModal(e, event.id);
                }
            };

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
            const dayOfWeek = dayNames[eventDate.getDay()] || '';

            const eqId = String(event.equipamento || event.id || '').trim().toUpperCase();
            const matchingAsset = (allAssetsList || []).find(a => String(a.id || '').trim().toUpperCase() === eqId) ||
                                  (typeof assets !== 'undefined' && Array.isArray(assets) ? assets.find(a => String(a.id || '').trim().toUpperCase() === eqId) : null);
            const displayTipo = (event.tipo && event.tipo !== 'N/A')
                ? event.tipo
                : (matchingAsset ? (matchingAsset.tipo || matchingAsset.nome || 'N/A') : 'N/A');
            const displayLocal = String((event.local && event.local !== 'SETOR OPERACIONAL')
                ? event.local
                : (matchingAsset ? (matchingAsset.local || 'SETOR OPERACIONAL') : 'SETOR OPERACIONAL')).toUpperCase();

            let displayTecnicos = event.tecnico || '';
            if (!displayTecnicos && Array.isArray(event.tecnicos) && event.tecnicos.length > 0) {
                displayTecnicos = event.tecnicos.join(' | ');
            }
            displayTecnicos = displayTecnicos ? displayTecnicos.toUpperCase() : '---';

            tr.innerHTML = `
                <td class="py-2.5 px-3 font-bold uppercase truncate max-w-[180px] text-zinc-900">${String(event.empresa || '---').toUpperCase()}</td>
                <td class="py-2.5 px-3 whitespace-nowrap"><span class="font-mono font-bold text-[#fa520f] bg-[#fff0c2] px-1.5 py-0.5 rounded border border-[#e6d5a8] text-[10.5px] leading-none">${event.equipamento || event.id}</span></td>
                <td class="py-2.5 px-3 font-bold uppercase truncate max-w-[160px] text-zinc-900">${displayTipo}</td>
                <td class="py-2.5 px-3 uppercase truncate max-w-[160px] text-zinc-600 font-medium">${displayLocal}</td>
                <td class="py-2.5 px-3 whitespace-nowrap font-bold ${dateColor}">
                    ${displayDate}
                    ${event.status === 'NAO_REALIZADO' ? '<br><span class="text-[9px] font-black text-red-600 uppercase">NÃO REALIZADO</span>' : ''}
                </td>
                <td class="py-2.5 px-3 whitespace-nowrap uppercase font-semibold text-zinc-700">${dayOfWeek}</td>
                <td class="py-2.5 px-3 whitespace-nowrap uppercase font-semibold text-zinc-800">${displayTecnicos}</td>
                <td class="py-2.5 px-3 text-right whitespace-nowrap">
                    <button onclick="window.openEditModal(event, '${event.id}')" class="text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 p-1 rounded-lg transition-colors cursor-pointer border border-zinc-200" title="Editar Agendamento">
                        <span class="material-symbols-outlined text-[18px] pointer-events-none">edit</span>
                    </button>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }
}
