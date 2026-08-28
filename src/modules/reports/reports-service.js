/**
 * Crane Pro - Módulo de Relatórios (Lógica de Domínio e Filtragem)
 */

/**
 * Normaliza o nome da empresa para comparação insensível a maiúsculas e espaços
 */
export function normalizeComp(val) {
    return String(val || '').trim().toLowerCase();
}

/**
 * Normaliza o identificador do ativo (remove símbolos #, -, _, espaços e caixa alta)
 */
export function normalizeAssetId(val) {
    return String(val || '').replace(/[#\s\-_]/g, '').toLowerCase();
}

/**
 * Formata o número/código do relatório para exibição (ex: '#01', '#REL-02')
 */
export function formatReportNumber(report, index = 0) {
    let repNumber = (report && report.id) ? String(report.id) : '';
    if (repNumber.toUpperCase().startsWith('REL')) {
        const match = repNumber.match(/\d+/);
        if (match) {
            return '#' + String(match[0]).padStart(2, '0');
        }
    }
    if (repNumber && !repNumber.startsWith('#')) {
        const match = repNumber.match(/\d+/);
        if (match) {
            return '#' + String(match[0]).padStart(2, '0');
        }
        return '#' + repNumber;
    }
    if (repNumber.startsWith('#')) {
        return repNumber;
    }
    return '#' + String(index + 1).padStart(2, '0');
}

/**
 * Verifica se um relatório corresponde a um determinado ativo técnico
 * @param {Object} report Objeto do relatório
 * @param {string} selectedAssetId ID do ativo selecionado
 * @param {Array} allAssetsList Lista completa de ativos cadastrados
 */
export function matchesReportAsset(report, selectedAssetId, allAssetsList = []) {
    if (!report || !selectedAssetId) return true;

    const targetIdNorm = normalizeAssetId(selectedAssetId);
    const targetCompNorm = normalizeComp(selectedAssetId);

    const eqId = report.equipamentoId || report.equipamentoid || report.equipamento_id || '';
    const eqNome = report.equipamentoNome || report.equipamentonome || report.equipamento_nome || report.equipamento || '';
    const assetInfo = String(report.assetInfo || '');

    // 1. Casamento direto com os campos do relatório
    if (eqId) {
        if (normalizeAssetId(eqId) === targetIdNorm || String(eqId).trim().toLowerCase() === String(selectedAssetId).trim().toLowerCase()) {
            return true;
        }
    }
    if (eqNome) {
        if (normalizeComp(eqNome) === targetCompNorm || normalizeAssetId(eqNome) === targetIdNorm) {
            return true;
        }
    }

    // 2. Busca o objeto completo do ativo selecionado na lista de ativos para cruzar nomes e tipos
    const selAsset = (allAssetsList || []).find(a => 
        a && (a.id === selectedAssetId || normalizeAssetId(a.id) === targetIdNorm)
    );

    if (selAsset) {
        const selIdNorm = normalizeAssetId(selAsset.id);
        const selNomeNorm = normalizeComp(selAsset.nome);
        const selTipoNorm = normalizeComp(selAsset.tipo);

        // Verifica se o ID do relatório casa com o ID do ativo
        if (eqId && normalizeAssetId(eqId) === selIdNorm) return true;

        // Verifica se o nome/tipo do relatório casa com o nome ou tipo do ativo
        if (eqNome) {
            const eqNomeNorm = normalizeComp(eqNome);
            if (selNomeNorm && eqNomeNorm === selNomeNorm) return true;
            if (selTipoNorm && eqNomeNorm === selTipoNorm) return true;
            if (selIdNorm && normalizeAssetId(eqNome) === selIdNorm) return true;
        }

        // Verifica se o campo 'equipamento' legado continha o nome ou ID do ativo
        if (report.equipamento) {
            const legEquipNorm = normalizeComp(report.equipamento);
            if (selNomeNorm && legEquipNorm === selNomeNorm) return true;
            if (selTipoNorm && legEquipNorm === selTipoNorm) return true;
            if (selIdNorm && normalizeAssetId(report.equipamento) === selIdNorm) return true;
        }

        // Verifica se assetInfo contém o ID ou nome do ativo
        if (assetInfo) {
            const infoLower = assetInfo.toLowerCase();
            if (selAsset.id && infoLower.includes(String(selAsset.id).toLowerCase())) return true;
            if (selAsset.nome && infoLower.includes(String(selAsset.nome).toLowerCase())) return true;
        }
    }

    return false;
}

/**
 * Filtra e ordena a lista de relatórios por empresa e opcionalmente por ativo técnico
 * @param {Array} reports Lista de relatórios
 * @param {string} selectedCompany Empresa selecionada
 * @param {string|null} selectedAssetId Ativo selecionado (opcional)
 * @param {Array} allAssetsList Lista de ativos cadastrados
 * @returns {Array} Lista filtrada e ordenada
 */
export function filterReports(reports, selectedCompany, selectedAssetId = null, allAssetsList = []) {
    if (!Array.isArray(reports)) return [];
    if (!selectedCompany) return [];

    const normTargetCompany = normalizeComp(selectedCompany);

    // 1. Filtra por empresa
    let filtered = reports.filter(r => {
        if (!r) return false;
        const comp = r.empresa || r.company || r.empresaNome || r.cliente || '';
        if (!comp && r.assetInfo) {
            return normalizeComp(r.assetInfo).includes(normTargetCompany);
        }
        return normalizeComp(comp) === normTargetCompany;
    });

    // 2. Filtra por ativo selecionado, caso informado
    if (selectedAssetId) {
        filtered = filtered.filter(r => matchesReportAsset(r, selectedAssetId, allAssetsList));
    }

    // 3. Ordena decrescentemente por data / ID
    return filtered.sort((a, b) => {
        const dateA = new Date(a.createdAt || a.updatedAt || a.date || 0).getTime();
        const dateB = new Date(b.createdAt || b.updatedAt || b.date || 0).getTime();
        if (dateA && dateB && dateA !== dateB) return dateB - dateA;

        // Fallback por ID numérico
        const numA = parseInt((String(a.id || '').match(/\d+/) || [0])[0], 10);
        const numB = parseInt((String(b.id || '').match(/\d+/) || [0])[0], 10);
        return numB - numA;
    });
}
