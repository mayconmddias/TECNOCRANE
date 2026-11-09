/**
 * Crane Pro - Módulo de Relatórios (Lógica de Domínio e Filtragem)
 */

import { formatShortName } from '../../utils.js';

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

/**
 * Obtém a representação formatada estrita dos técnicos executantes da inspeção.
 * Retorna exclusivamente os nomes de até 2 técnicos a partir das assinaturas (report.responsaveis).
 * Se houver apenas 1, retorna "TÉCNICO 1". Se houver 2, retorna "TÉCNICO 1 / TÉCNICO 2".
 * Não inclui outros responsáveis além dos dois técnicos principais.
 * 
 * @param {Object} report Objeto do relatório
 * @param {Array} users Lista de usuários cadastrados
 * @returns {string} Nomes formatados dos até 2 técnicos
 */
export function getReportTechniciansDisplay(report, users = null) {
    if (!report) return "N/A";
    const userPool = (users && Array.isArray(users) && users.length > 0)
        ? users
        : ((typeof window !== 'undefined' && window.usersList && Array.isArray(window.usersList) && window.usersList.length > 0) ? window.usersList : []);

    let responsaveis = report.responsaveis;
    if (typeof responsaveis === 'string') {
        try {
            responsaveis = JSON.parse(responsaveis);
        } catch (e) {
            responsaveis = [];
        }
    }

    const techNames = [];
    if (Array.isArray(responsaveis) && responsaveis.length > 0) {
        // Pega no máximo os dois primeiros técnicos (Técnico 1 e Técnico 2)
        const topTwo = responsaveis.filter(id => id && String(id).trim() !== '').slice(0, 2);
        topTwo.forEach(id => {
            const foundUser = userPool.find(u => String(u.id) === String(id) || (u.name && u.name.trim().toUpperCase() === String(id).trim().toUpperCase()));
            if (foundUser && foundUser.name) {
                const short = formatShortName(foundUser.name);
                if (short && !techNames.includes(short.toUpperCase())) {
                    techNames.push(short.toUpperCase());
                }
            } else if (typeof id === 'string' && isNaN(Number(id))) {
                const short = formatShortName(id);
                if (short && !techNames.includes(short.toUpperCase())) {
                    techNames.push(short.toUpperCase());
                }
            }
        });
    }

    if (techNames.length > 0) {
        return techNames.join(' / ');
    }

    // Fallback para relatórios legados que possuam apenas o campo report.tecnico
    if (report.tecnico && String(report.tecnico).trim() !== '') {
        return formatShortName(report.tecnico).toUpperCase();
    }

    return "N/A";
}

/**
 * Gera de forma atômica e resiliente à concorrência o próximo ID sequencial de relatório (ex: 'REL - 01', 'REL - 02')
 * Consulta o Supabase em tempo real para obter os maiores IDs existentes entre múltiplos usuários.
 * 
 * @param {Array} localReports Lista local de relatórios finalizados
 * @param {Function|null} getSupabaseClient Função para obter o cliente ativo do Supabase
 * @returns {Promise<string>} Próximo ID no formato 'REL - XX'
 */
export async function getNextAvailableReportId(localReports = [], getSupabaseClient = null) {
    let maxNum = 0;
    const updateMax = (id) => {
        if (!id) return;
        const match = String(id).match(/\d+/);
        if (match) {
            const num = parseInt(match[0], 10);
            if (num > maxNum) maxNum = num;
        }
    };

    // 1. Considera relatórios locais
    (localReports || []).forEach(r => updateMax(r?.id));

    // 2. Consulta nuvem em tempo real (Supabase) para evitar conflitos de concorrência
    try {
        const client = typeof getSupabaseClient === 'function' ? getSupabaseClient() : null;
        if (client) {
            const { data, error } = await client.from('finalized_reports').select('id');
            if (!error && Array.isArray(data)) {
                data.forEach(r => updateMax(r?.id));
            }
        }
    } catch (e) {
        console.warn("Aviso: Falha ao consultar IDs de relatórios na nuvem, usando sequência local:", e);
    }

    const nextNum = maxNum + 1;
    return `REL - ${String(nextNum).padStart(2, '0')}`;
}

