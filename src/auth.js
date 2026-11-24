import { usersList, setStoredData, loadAllDataFromDB, syncAllFromSupabase } from './data.js';
import { isSupabaseConfigured, dbFetchAll } from './supabase.js';
import { hashPassword, verifyPassword } from './utils.js';
import { setCurrentUser, releaseAllLocks, getStoredLoggedUser } from './locks.js';
import { validateCredentials, updateUserPasswordInCloud, fetchUsersFromCloud } from './modules/auth/auth-service.js';

console.log('CRANE PRO: Módulo de Autenticação Carregado.');

/**
 * Atualiza o avatar e os textos de identificação do usuário em toda a interface
 */
export function updateUserDisplay(user) {
    if (!user) return;
    const name = (user.name || 'Usuário').toUpperCase();
    const role = (user.permission || 'Técnico').toUpperCase();
    const initials = name.split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('') || 'CP';

    let avatarImg = user.avatar || user.foto || '';
    if (!avatarImg && typeof usersList !== 'undefined' && Array.isArray(usersList)) {
        const matched = usersList.find(u => (u && u.id && user.id && String(u.id) === String(user.id)) || (u && u.email && user.email && String(u.email).toLowerCase() === String(user.email).toLowerCase()));
        if (matched && (matched.avatar || matched.foto)) {
            avatarImg = matched.avatar || matched.foto;
        }
    }

    const roleEl = document.getElementById('user-role-display');
    const nameEl = document.getElementById('user-name-display');
    if (roleEl) roleEl.innerText = role;
    if (nameEl) nameEl.innerText = name;

    const avatarContainer = document.getElementById('mobile-user-avatar');
    if (avatarContainer) {
        if (avatarImg) {
            avatarContainer.innerHTML = `<img src="${avatarImg}" class="w-full h-full object-cover" alt="${name}">`;
        } else {
            avatarContainer.innerHTML = `<span id="mobile-avatar-initials">${initials}</span>`;
        }
    }

    const sheetAvatar = document.getElementById('mobile-sheet-avatar');
    const sheetInitials = document.getElementById('mobile-sheet-avatar-initials');
    if (sheetAvatar) {
        if (avatarImg) {
            sheetAvatar.innerHTML = `<img src="${avatarImg}" class="w-full h-full object-cover" alt="${name}">`;
        } else {
            sheetAvatar.innerHTML = `<span id="mobile-sheet-avatar-initials">${initials}</span>`;
        }
    } else if (sheetInitials) {
        sheetInitials.innerText = initials;
    }

    const sheetName = document.getElementById('mobile-sheet-user-name');
    if (sheetName) sheetName.innerText = name;

    const sheetRole = document.getElementById('mobile-sheet-user-role');
    if (sheetRole) sheetRole.innerText = role;
}

if (typeof window !== 'undefined') {
    window.updateUserDisplay = updateUserDisplay;
    if (typeof window.updateMobileUserInfo !== 'function') {
        window.updateMobileUserInfo = updateUserDisplay;
    }
}

/**
 * Restaura a sessão do usuário logado caso exista no localStorage/sessionStorage
 */
export function restoreUserSession() {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const user = getStoredLoggedUser();
    if (user && user.id && user.id !== 'anon') {
        setCurrentUser(user);
        
        const applyUI = () => {
            const loginView = document.getElementById('login-view');
            const mainApp = document.getElementById('main-app');
            if (loginView) loginView.classList.add('hidden');
            if (mainApp) mainApp.classList.remove('hidden');

            updateUserDisplay(user);
            if (typeof window.updateMobileUserInfo === 'function') {
                window.updateMobileUserInfo(user);
            }
            if (typeof window.applyUserRolePermissions === 'function') {
                window.applyUserRolePermissions(user);
            }

            if (typeof window.reloadAppDataAndUI === 'function') {
                window.reloadAppDataAndUI();
            } else if (typeof window.renderAssets === 'function') {
                window.renderAssets();
            }
        };

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', applyUI);
        } else {
            applyUI();
        }
    }
}

// Executa restauração imediata de sessão no startup
restoreUserSession();

/**
 * Funções expostas globalmente (window) para manter compatibilidade com o HTML.
 */

window.showAlert = function(message, type = 'success', onConfirm = null) {
    const modal = document.getElementById('custom-alert-modal');
    const overlay = document.getElementById('custom-alert-overlay');
    const panel = document.getElementById('custom-alert-panel');
    const msgEl = document.getElementById('custom-alert-message');
    const iconEl = document.getElementById('custom-alert-icon');
    
    if (!modal || !msgEl || !iconEl) return;

    msgEl.innerText = message;
    iconEl.innerText = type === 'success' ? 'check_circle' : 'warning';
    
    // Header styling based on type
    const header = iconEl.closest('.bg-zinc-50\\/50');
    if (header) {
        header.classList.remove('border-primary-container', 'border-error/20');
        header.classList.add(type === 'success' ? 'border-primary-container' : 'border-error/20');
    }

    iconEl.parentElement.classList.remove('bg-primary-container', 'bg-error/10');
    iconEl.parentElement.classList.add(type === 'success' ? 'bg-primary-container' : 'bg-error/10');
    
    iconEl.classList.remove('text-black', 'text-error');
    iconEl.classList.add(type === 'success' ? 'text-black' : 'text-error');
    
    window.currentAlertCallback = onConfirm;
    
    const confirmBtn = document.getElementById('custom-alert-confirm-btn');
    const cancelBtn = document.getElementById('custom-alert-cancel-btn');
    
    if (onConfirm) {
        confirmBtn.innerText = 'CONFIRMAR';
        cancelBtn.classList.remove('hidden');
    } else {
        confirmBtn.innerText = 'OK';
        cancelBtn.classList.add('hidden');
    }

    modal.style.display = 'flex';
    modal.classList.remove('hidden');
    
    setTimeout(() => {
        overlay.classList.add('opacity-100');
        panel.classList.remove('scale-95', 'opacity-0');
        panel.classList.add('scale-100', 'opacity-100');
    }, 10);
};

window.confirmCustomAlert = function() {
    const cb = window.currentAlertCallback;
    window.currentAlertCallback = null;
    window.closeCustomAlert();
    if (typeof cb === 'function') cb();
};

window.closeCustomAlert = function() {
    const modal = document.getElementById('custom-alert-modal');
    const overlay = document.getElementById('custom-alert-overlay');
    const panel = document.getElementById('custom-alert-panel');
    if (!modal || !overlay || !panel) return;

    overlay.classList.remove('opacity-100');
    panel.classList.remove('scale-100', 'opacity-100');
    panel.classList.add('scale-95', 'opacity-0');
    
    setTimeout(() => {
        modal.style.display = 'none';
        modal.classList.add('hidden');
        window.currentAlertCallback = null; // Clear if closed via cancel/overlay
    }, 300);
};

window.togglePasswordChange = function(show) {
    const loginState = document.getElementById('login-state');
    const changeState = document.getElementById('change-password-state');
    const loginEmailInput = document.getElementById('login-email');
    const changeEmailInput = document.getElementById('change-email');

    if (show) {
        loginState.classList.add('hidden');
        changeState.classList.remove('hidden');
        changeEmailInput.value = loginEmailInput ? (loginEmailInput.value || '').trim() : '';
    } else {
        loginState.classList.remove('hidden');
        changeState.classList.add('hidden');
        const curr = document.getElementById('current-password');
        const nPass = document.getElementById('new-password');
        const cPass = document.getElementById('confirm-password');
        if (curr) curr.value = '';
        if (nPass) nPass.value = '';
        if (cPass) cPass.value = '';
    }
};

window.handleSaveNewPassword = async function() {
    const emailInput = document.getElementById('change-email');
    const currentInput = document.getElementById('current-password');
    const newInput = document.getElementById('new-password');
    const confirmInput = document.getElementById('confirm-password');

    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    const current = currentInput ? currentInput.value.trim() : '';
    const newPass = newInput ? newInput.value.trim() : '';
    const confirm = confirmInput ? confirmInput.value.trim() : '';

    if (!email) return window.showAlert('E-MAIL NÃO IDENTIFICADO.', 'warning');
    if (!current || !newPass || !confirm) return window.showAlert('PREENCHA TODOS OS CAMPOS PARA ALTERAR A SENHA.', 'warning');
    if (newPass !== confirm) return window.showAlert('A NOVA SENHA E A CONFIRMAÇÃO NÃO CONFEREM.', 'warning');

    if (!usersList || usersList.length === 0) {
        await loadAllDataFromDB();
        await syncAllFromSupabase();
    }

    const userIdx = usersList.findIndex(u => (u.email || '').trim().toLowerCase() === email);
    if (userIdx === -1) return window.showAlert('USUÁRIO NÃO ENCONTRADO.', 'warning');
    
    const verifyResult = await verifyPassword(current, usersList[userIdx].password);
    if (!verifyResult.valid) return window.showAlert('SENHA ATUAL INCORRETA.', 'warning');

    const newHashed = await hashPassword(newPass);
    usersList[userIdx].password = newHashed;
    setStoredData('crane_users', usersList);
    
    // Atualiza imediatamente a senha no Supabase
    if (usersList[userIdx].id) {
        updateUserPasswordInCloud(usersList[userIdx].id, newPass).catch(err => {
            console.warn('AUTH: Aviso ao salvar nova senha no Supabase:', err);
        });
    }
    
    window.showAlert('SENHA ALTERADA COM SUCESSO!', 'success', () => {
        if (currentInput) currentInput.value = '';
        if (newInput) newInput.value = '';
        if (confirmInput) confirmInput.value = '';
        window.togglePasswordChange(false);
    });
};

window.handleLogin = async function() {
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    const email = emailInput ? emailInput.value.trim().toLowerCase() : '';
    const pass = passInput ? passInput.value.trim() : '';

    if (!email || !pass) return window.showAlert('E-MAIL OU SENHA INCORRETO.', 'warning');

    // 1. Busca os dados dos usuários diretamente no Supabase em tempo real (ou do IndexedDB/memória local)
    let candidateUsers = await fetchUsersFromCloud();

    if (!candidateUsers || candidateUsers.length === 0) {
        if (!usersList || usersList.length === 0) {
            await loadAllDataFromDB();
        }
        candidateUsers = usersList || [];
    }

    const authResult = await validateCredentials(candidateUsers, email, pass);
    if (!authResult || !authResult.user) {
        return window.showAlert('E-MAIL OU SENHA INCORRETO.', 'warning');
    }

    const foundUser = authResult.user;

    // Se o usuário possuía hash legado (ex: senhas anteriores ao salt), migra de forma transparente
    if (authResult.needsUpgrade && authResult.upgradedHash) {
        updateUserPasswordInCloud(foundUser.id, pass).catch(err => {
            console.warn('AUTH: Aviso ao atualizar hash de segurança no Supabase:', err);
        });
    }

    // Se o usuário não tiver avatar no login, busca se já existe em usersList
    if (!foundUser.avatar && Array.isArray(usersList)) {
        const localMatch = usersList.find(u => (u && u.id && foundUser.id && String(u.id) === String(foundUser.id)) || (u && u.email && foundUser.email && String(u.email).toLowerCase() === String(foundUser.email).toLowerCase()));
        if (localMatch && (localMatch.avatar || localMatch.foto)) {
            foundUser.avatar = localMatch.avatar || localMatch.foto;
        }
    }

    // Registra o usuário logado no sistema de travas
    setCurrentUser(foundUser);

    // Atualiza/Sincroniza o usuário encontrado no array local usersList
    const idx = usersList.findIndex(u => String(u.id) === String(foundUser.id));
    if (idx !== -1) {
        usersList[idx] = { ...usersList[idx], ...foundUser };
    } else {
        usersList.push(foundUser);
    }
    setStoredData('crane_users', usersList);

    document.getElementById('login-view').classList.add('hidden');
    document.getElementById('main-app').classList.remove('hidden');
    
    // Atualiza perfil na sidebar e no mobile
    updateUserDisplay(foundUser);
    if (typeof window.updateMobileUserInfo === 'function') {
        window.updateMobileUserInfo(foundUser);
    }
    if (typeof window.applyUserRolePermissions === 'function') {
        window.applyUserRolePermissions(foundUser);
    }
    
    // Dispara sincronização e renderização completa dos dados atualizados da nuvem
    if (typeof window.switchView === 'function') {
        window.switchView('dashboard');
    } else if (typeof window.renderAssets === 'function') {
        window.renderAssets();
    }

    if (typeof window.reloadAppDataAndUI === 'function') {
        await window.reloadAppDataAndUI();
    }
};

window.handleLogout = function() {
    releaseAllLocks();
    setCurrentUser(null);
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
    // Limpa campos por segurança
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    if (emailInput) emailInput.value = '';
    if (passInput) passInput.value = '';

    // Reseta visual do avatar e dados do usuário na tela
    const avatarContainer = document.getElementById('mobile-user-avatar');
    if (avatarContainer) avatarContainer.innerHTML = '<span id="mobile-avatar-initials">--</span>';
    const sheetAvatar = document.getElementById('mobile-sheet-avatar');
    if (sheetAvatar) sheetAvatar.innerHTML = '<span id="mobile-sheet-avatar-initials">--</span>';
    const roleEl = document.getElementById('user-role-display');
    const nameEl = document.getElementById('user-name-display');
    if (roleEl) roleEl.innerText = 'TECNICO';
    if (nameEl) nameEl.innerText = 'USUÁRIO';
};

