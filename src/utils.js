// Crane Pro - Utilities Module

export const monthsMap = {
    'JAN': 0, 'FEV': 1, 'MAR': 2, 'ABR': 3, 'MAI': 4, 'JUN': 5,
    'JUL': 6, 'AGO': 7, 'SET': 8, 'OUT': 9, 'NOV': 10, 'DEZ': 11
};

export const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function parseAssetDate(dateStr) {
    if (!dateStr) return new Date();
    // Suportar tanto DD/MM/YYYY quanto DD/MMM/YYYY e separadores / ou -
    const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
    if (parts.length < 3) return new Date();
    
    let [day, month, year] = parts;
    let monthIdx;
    
    if (isNaN(month)) {
        monthIdx = monthsMap[month.toUpperCase().substring(0, 3)] || 0;
    } else {
        monthIdx = parseInt(month) - 1;
    }
    
    return new Date(year, monthIdx, day);
}

export function formatDateToDisplay(date) {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
}

export function formatDateToISO(date) {
    return date.toISOString().split('T')[0];
}
