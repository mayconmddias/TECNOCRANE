/**
 * Crane Pro - Módulo de Agendamento e Gestão Operacional
 * Regras de agendamento, recorrência inteligente e utilitários de calendário.
 */

/**
 * Calcula a data de um agendamento recorrente de forma inteligente.
 * 
 * Regra:
 * - Para o agendamento inicial (monthIndex === 0): preserva a data original selecionada pelo usuário.
 * - Para agendamentos recorrentes (monthIndex > 0):
 *   - Projeta para o mês subsequente respeitando o limite de dias daquele mês (evita overflow de 31 dias).
 *   - Se a data calculada cair em Sábado (dia 6): antecipa para a Sexta-feira imediatamente anterior (-1 dia).
 *   - Se a data calculada cair em Domingo (dia 0): antecipa para a Sexta-feira imediatamente anterior (-2 dias).
 *   - Se cair em dia útil (Segunda a Sexta): mantém a data calculada.
 * 
 * @param {string} baseDateStr - Data base no formato 'YYYY-MM-DD'
 * @param {number} monthIndex - Índice da recorrência (0 = inicial, 1 = 2º mês, etc.)
 * @returns {string} - Data calculada no formato 'YYYY-MM-DD'
 */
export function calculateRecurringDate(baseDateStr, monthIndex = 0) {
    if (!baseDateStr || typeof baseDateStr !== 'string') return baseDateStr;
    if (!monthIndex || monthIndex <= 0) return baseDateStr;

    const parts = baseDateStr.split('-');
    if (parts.length !== 3) return baseDateStr;

    const baseYear = parseInt(parts[0], 10);
    const baseMonth = parseInt(parts[1], 10) - 1; // 0-indexed
    const baseDay = parseInt(parts[2], 10);

    if (isNaN(baseYear) || isNaN(baseMonth) || isNaN(baseDay)) return baseDateStr;

    // Calcula o ano e mês alvo
    const totalMonths = baseMonth + monthIndex;
    const targetYear = baseYear + Math.floor(totalMonths / 12);
    const targetMonth = ((totalMonths % 12) + 12) % 12;

    // Determina a quantidade máxima de dias no mês alvo (evita overflow de 31 dias em meses de 28/30)
    const daysInTargetMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
    const targetDay = Math.min(baseDay, daysInTargetMonth);

    // Cria o objeto Date ao meio-dia para evitar efeitos colaterais de fuso horário / horário de verão
    const dateObj = new Date(targetYear, targetMonth, targetDay, 12, 0, 0);

    // Ajusta finais de semana para a sexta-feira anterior:
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 6) {
        // Sábado -> recua 1 dia para Sexta-feira
        dateObj.setDate(dateObj.getDate() - 1);
    } else if (dayOfWeek === 0) {
        // Domingo -> recua 2 dias para Sexta-feira
        dateObj.setDate(dateObj.getDate() - 2);
    }

    const y = dateObj.getFullYear();
    const m = String(dateObj.getMonth() + 1).padStart(2, '0');
    const d = String(dateObj.getDate()).padStart(2, '0');

    return `${y}-${m}-${d}`;
}

/**
 * Constrói o identificador único para um agendamento.
 * Formato padrão: `${equipamento}-${dateStr}`.
 */
export function buildScheduledEventId(equipamento, dateStr) {
    const cleanEquip = String(equipamento || '').trim();
    const cleanDate = String(dateStr || '').trim();
    if (!cleanEquip || !cleanDate) return '';
    return `${cleanEquip}-${cleanDate}`;
}

/**
 * Filtra a lista de eventos removendo um evento específico por ID.
 * Garante comparação robusta convertendo IDs para string.
 */
export function filterEventsOnSingleDelete(eventsList, eventIdToDelete) {
    if (!Array.isArray(eventsList)) return [];
    if (!eventIdToDelete) return [...eventsList];
    const targetId = String(eventIdToDelete).trim();
    return eventsList.filter(e => e && String(e.id).trim() !== targetId);
}

/**
 * Filtra a lista de eventos removendo todos os eventos pertencentes ao mesmo groupId.
 */
export function filterEventsOnGroupDelete(eventsList, groupIdToDelete) {
    if (!Array.isArray(eventsList)) return [];
    if (groupIdToDelete === null || groupIdToDelete === undefined) return [...eventsList];
    const targetGroupId = String(groupIdToDelete).trim();
    return eventsList.filter(e => {
        if (!e) return false;
        const eGroupId = e.groupId !== null && e.groupId !== undefined ? String(e.groupId).trim() : null;
        return eGroupId !== targetGroupId;
    });
}

/**
 * Retorna os IDs de eventos a serem excluídos do banco de dados na nuvem.
 */
export function getEventCloudIdsToDelete(eventsList, eventId, isGroup = false) {
    if (!Array.isArray(eventsList) || !eventId) return [];
    const targetId = String(eventId).trim();
    const targetEvent = eventsList.find(e => e && String(e.id).trim() === targetId);

    if (isGroup && targetEvent && targetEvent.groupId) {
        const groupTarget = String(targetEvent.groupId).trim();
        return eventsList
            .filter(e => e && e.groupId && String(e.groupId).trim() === groupTarget)
            .map(e => String(e.id).trim());
    }

    return targetEvent ? [String(targetEvent.id).trim()] : [targetId];
}

/**
 * Gera um lote de agendamentos (recorrentes ou únicos) padronizados.
 */
export function generateScheduledEvents({
    empresa,
    equipamento,
    baseDate,
    recorrencia = 1,
    tecnicoStr = '',
    selectedTecs = [],
    assetTipo = 'N/A',
    assetLocal = 'SETOR OPERACIONAL',
    foto = '',
    color = '',
    textColor = '',
    groupId = null
}) {
    if (!empresa || !equipamento || !baseDate) return [];
    const count = Math.max(1, parseInt(recorrencia, 10) || 1);
    const resolvedGroupId = count > 1 ? (groupId || Date.now()) : null;
    const result = [];

    for (let i = 0; i < count; i++) {
        const dateStr = calculateRecurringDate(baseDate, i);
        const eventId = buildScheduledEventId(equipamento, dateStr);
        result.push({
            id: eventId,
            groupId: resolvedGroupId,
            empresa,
            equipamento,
            tipo: assetTipo,
            local: assetLocal,
            foto: foto || '',
            date: dateStr,
            tecnico: tecnicoStr,
            tecnicos: Array.isArray(selectedTecs) ? [...selectedTecs] : [],
            color: color || '',
            textColor: textColor || '',
            status: 'PENDENTE'
        });
    }

    return result;
}

if (typeof window !== 'undefined') {
    window.calculateRecurringDate = calculateRecurringDate;
    window.buildScheduledEventId = buildScheduledEventId;
    window.filterEventsOnSingleDelete = filterEventsOnSingleDelete;
    window.filterEventsOnGroupDelete = filterEventsOnGroupDelete;
    window.getEventCloudIdsToDelete = getEventCloudIdsToDelete;
    window.generateScheduledEvents = generateScheduledEvents;
}

