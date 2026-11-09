// Crane Pro - Authentication Service (Domain Module)
import { verifyPassword, hashPassword } from '../../utils.js';
import { dbFetchAll, dbUpsert, isSupabaseConfigured } from '../../supabase.js';

/**
 * Validação centralizada e estrita de credenciais:
 * - Apenas e-mail válido e senha.
 * - Suporta tanto hash salgado atual quanto hash legado puro (com sinalização de upgrade).
 * - Sem tratamento diferenciado por usuário.
 * 
 * @param {Array} candidateUsers Lista de usuários do Supabase ou cache local
 * @param {string} email E-mail informado pelo usuário
 * @param {string} pass Senha em texto puro informada pelo usuário
 * @returns {Promise<Object|null>} Objeto com os dados do usuário autenticado ou null
 */
export async function validateCredentials(candidateUsers, email, pass) {
    if (!email || !pass) return null;
    const normalizedEmail = String(email).trim().toLowerCase();
    const cleanPass = String(pass).trim();

    if (!Array.isArray(candidateUsers) || candidateUsers.length === 0) {
        return null;
    }

    const matchedUser = candidateUsers.find(u => {
        const uEmail = (u && u.email ? String(u.email) : '').trim().toLowerCase();
        return uEmail === normalizedEmail;
    });

    if (!matchedUser) return null;

    const uPass = matchedUser.password || '';
    const verifyResult = await verifyPassword(cleanPass, uPass);

    if (!verifyResult.valid) return null;

    const finalHash = verifyResult.upgradedHash || await hashPassword(cleanPass);

    return {
        user: {
            id: matchedUser.id,
            name: (matchedUser.name || '').toUpperCase(),
            cargo: (matchedUser.cargo || matchedUser.role || 'TÉCNICO').toUpperCase(),
            email: normalizedEmail,
            password: finalHash,
            permission: matchedUser.permission || 'TECNICO',
            signature: matchedUser.signature || matchedUser.assinatura || '',
            avatar: matchedUser.avatar || matchedUser.foto || '',
            tenant_code: matchedUser.tenant_code || '001'
        },
        needsUpgrade: !!verifyResult.needsUpgrade,
        upgradedHash: finalHash
    };
}

/**
 * Atualiza a senha de um usuário no Supabase de forma atômica e isolada
 * 
 * @param {string|number} userId ID do usuário
 * @param {string} newPassword Nova senha em texto puro
 * @returns {Promise<boolean>} Sucesso da operação
 */
export async function updateUserPasswordInCloud(userId, newPassword) {
    if (!userId || !newPassword) return false;
    const cleanPass = String(newPassword).trim();
    const passHash = await hashPassword(cleanPass);

    if (isSupabaseConfigured) {
        try {
            const numId = typeof userId === 'number' ? userId : (parseInt(userId, 10) || userId);
            await dbUpsert('users', [{
                id: numId,
                password: passHash
            }]);
            return true;
        } catch (e) {
            console.error('AUTH SERVICE: Erro ao atualizar senha no Supabase:', e);
            return false;
        }
    }
    return false;
}

/**
 * Busca a lista de usuários diretamente da tabela 'users' de forma isolada
 * 
 * @returns {Promise<Array>} Lista de usuários cadastrados
 */
export async function fetchUsersFromCloud() {
    if (!isSupabaseConfigured) return [];
    try {
        const data = await dbFetchAll('users');
        return Array.isArray(data) ? data : [];
    } catch (e) {
        console.error('AUTH SERVICE: Erro ao buscar usuários no Supabase:', e);
        return [];
    }
}
