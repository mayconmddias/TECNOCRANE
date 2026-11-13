/**
 * Módulo de Regras de Controle de Acesso e Permissões (RBAC)
 * Crane Pro: TECNICO vs ADMINISTRADOR
 */

/**
 * Normaliza e verifica se o usuário possui perfil de Administrador.
 * @param {Object|null} user 
 * @returns {boolean}
 */
export function isCurrentUserAdmin(user) {
    if (!user) return false;
    const role = String(user.permission || user.role || user.cargo || '').trim().toUpperCase();
    return role === 'ADMINISTRADOR' || role === 'ADMIN';
}

/**
 * Normaliza e verifica se o usuário é Técnico.
 * @param {Object|null} user 
 * @returns {boolean}
 */
export function isCurrentUserTechnician(user) {
    return !isCurrentUserAdmin(user);
}

/**
 * Normaliza nome para comparação insensível a maiúsculas/espaços.
 * @param {string} name 
 * @returns {string}
 */
export function normalizeUserName(name) {
    return String(name || '').trim().toUpperCase();
}

/**
 * Calcula a data de expiração de edição de um relatório.
 * Regra: Data de criação (ou data do laudo) + 15 dias corridos + dias extras prorrogados.
 * @param {Object} report 
 * @returns {Date|null}
 */
export function getReportEditDeadline(report) {
    if (!report) return null;

    let baseDate = null;
    if (report.createdAt) {
        const d = new Date(report.createdAt);
        if (!isNaN(d.getTime())) baseDate = d;
    }

    if (!baseDate && report.data) {
        // formato DD/MM/YYYY ou YYYY-MM-DD
        const str = String(report.data).trim();
        if (str.includes('/')) {
            const [dia, mes, ano] = str.split('/');
            const d = new Date(Number(ano), Number(mes) - 1, Number(dia), 23, 59, 59);
            if (!isNaN(d.getTime())) baseDate = d;
        } else if (str.includes('-')) {
            const parts = str.split('-');
            if (parts.length === 3) {
                const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]), 23, 59, 59);
                if (!isNaN(d.getTime())) baseDate = d;
            }
        }
    }

    if (!baseDate) {
        // Fallback caso não haja data válida registrada
        baseDate = new Date();
    }

    // Dias base: 15 dias corridos
    const extraDays = Number(report.extended_days || report.extendedDays || 0);
    const deadline = new Date(baseDate.getTime());
    deadline.setDate(deadline.getDate() + 15 + extraDays);
    deadline.setHours(23, 59, 59, 999);

    // Se houver uma data explícita extended_until
    if (report.extended_until || report.extendedUntil) {
        const untilDate = new Date(report.extended_until || report.extendedUntil);
        if (!isNaN(untilDate.getTime()) && untilDate > deadline) {
            return untilDate;
        }
    }

    return deadline;
}

/**
 * Verifica se um relatório ainda está dentro do prazo de edição.
 * @param {Object} report 
 * @param {Date} [referenceDate] 
 * @returns {boolean}
 */
export function isReportWithinEditPeriod(report, referenceDate = new Date()) {
    const deadline = getReportEditDeadline(report);
    if (!deadline) return false;
    return referenceDate.getTime() <= deadline.getTime();
}

/**
 * Verifica se o relatório pertence (foi criado por) determinado usuário técnico.
 * @param {Object} report 
 * @param {Object} user 
 * @returns {boolean}
 */
export function isReportAuthor(report, user) {
    if (!report || !user) return false;
    const currentUserName = normalizeUserName(user.name);
    if (!currentUserName) return false;

    const author1 = normalizeUserName(report.tecnico || report.tecnico1 || report.createdBy || report.author);
    const author2 = normalizeUserName(report.tecnico2);

    return author1 === currentUserName || author2 === currentUserName;
}

/**
 * Verifica se o usuário atual tem permissão para editar o relatório.
 * Regra:
 * - Administrador: pode editar qualquer relatório a qualquer tempo.
 * - Técnico: pode editar apenas se for o autor e estiver dentro do prazo (15 dias + prorrogações).
 * @param {Object} report 
 * @param {Object} user 
 * @param {Date} [referenceDate] 
 * @returns {boolean}
 */
export function canEditReport(report, user, referenceDate = new Date()) {
    if (isCurrentUserAdmin(user)) return true;
    if (!report || !user) return false;
    if (!isReportAuthor(report, user)) return false;
    return isReportWithinEditPeriod(report, referenceDate);
}

/**
 * Verifica se o usuário atual tem permissão para excluir um relatório.
 * Regra: Apenas Administrador pode excluir relatórios.
 * @param {Object} user 
 * @returns {boolean}
 */
export function canDeleteReport(user) {
    return isCurrentUserAdmin(user);
}

/**
 * Verifica se o usuário atual pode prorrogar o prazo de edição de um relatório.
 * Regra: Apenas Administrador.
 * @param {Object} user 
 * @returns {boolean}
 */
export function canExtendReportEditPeriod(user) {
    return isCurrentUserAdmin(user);
}

/**
 * Verifica se o usuário atual pode gerenciar (retomar ou excluir) uma ordem de serviço em aberto.
 * Regra:
 * - Administrador: pode retomar e excluir qualquer OS aberta.
 * - Técnico: pode retomar e excluir apenas se a OS estiver atribuída a ele ou criada por ele.
 * @param {Object} order 
 * @param {Object} user 
 * @returns {boolean}
 */
export function canManageOpenOrder(order, user) {
    if (isCurrentUserAdmin(user)) return true;
    if (!order || !user) return false;

    const currentUserName = normalizeUserName(user.name);
    if (!currentUserName) return false;

    const assignedTo = normalizeUserName(order.assignedTo || order.assigned_to);
    const creator = normalizeUserName(order.createdBy || order.created_by || order.tecnico || order.tecnico1);
    const coWorker = normalizeUserName(order.tecnico2);

    if (assignedTo && assignedTo === currentUserName) return true;
    if (creator && creator === currentUserName) return true;
    if (coWorker && coWorker === currentUserName) return true;

    return false;
}

/**
 * Verifica se o usuário pode alterar o técnico responsável pela OS aberta.
 * Regra: Apenas Administrador.
 * @param {Object} user 
 * @returns {boolean}
 */
export function canReassignOpenOrder(user) {
    return isCurrentUserAdmin(user);
}

/**
 * Verifica se o usuário pode criar, alterar ou excluir agendamentos na Programação.
 * Regra: Apenas Administrador. Técnicos têm acesso somente leitura.
 * @param {Object} user 
 * @returns {boolean}
 */
export function canManageScheduling(user) {
    return isCurrentUserAdmin(user);
}

/**
 * Verifica se o usuário pode criar, editar ou excluir Empresas e Ativos Técnicos.
 * Regra: Apenas Administrador. Técnicos têm acesso somente de visualização/navegação.
 * @param {Object} user 
 * @returns {boolean}
 */
export function canManageCompaniesAndAssets(user) {
    return isCurrentUserAdmin(user);
}

/**
 * Verifica se o usuário tem permissão para acessar a tela de Formulários.
 * Regra: Apenas Administrador.
 * @param {Object} user 
 * @returns {boolean}
 */
export function canAccessTemplates(user) {
    return isCurrentUserAdmin(user);
}

/**
 * Verifica se o usuário tem permissão para acessar o Cadastro Interno.
 * Regra: Apenas Administrador.
 * @param {Object} user 
 * @returns {boolean}
 */
export function canAccessUsers(user) {
    return isCurrentUserAdmin(user);
}

