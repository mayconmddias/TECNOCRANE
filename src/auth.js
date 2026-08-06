import { usersList, setStoredData, loadAllDataFromDB, syncAllFromSupabase } from './data.js';
import { isSupabaseConfigured, dbFetchAll } from './supabase.js';
import { hashPassword } from './utils.js';

console.log('CRANE PRO: Módulo de Autenticação Carregado.');

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
    
    const currentHash = await hashPassword(current);
    const userPassHash = await hashPassword(usersList[userIdx].password);

    if (userPassHash !== currentHash) return window.showAlert('SENHA ATUAL INCORRETA.', 'warning');

    usersList[userIdx].password = await hashPassword(newPass);
    setStoredData('crane_users', usersList);
    
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
    let candidateUsers = [];
    if (isSupabaseConfigured) {
        try {
            const dbUsers = await dbFetchAll('users');
            if (dbUsers && Array.isArray(dbUsers) && dbUsers.length > 0) {
                candidateUsers = dbUsers;
            }
        } catch (e) {
            console.error('SUPABASE: Erro ao buscar usuários no login:', e);
        }
    }

    if (candidateUsers.length === 0) {
        if (!usersList || usersList.length === 0) {
            await loadAllDataFromDB();
        }
        candidateUsers = usersList || [];
    }

    const passHash = await hashPassword(pass);

    let foundUser = null;
    for (const u of candidateUsers) {
        const uEmail = (u.email || '').trim().toLowerCase();
        if (uEmail === email) {
            const uPass = u.password || '';
            const uHash = await hashPassword(uPass);
            if (uPass === pass || uPass === passHash || uHash === passHash) {
                foundUser = {
                    id: u.id,
                    name: (u.name || '').toUpperCase(),
                    cargo: (u.cargo || u.role || 'TÉCNICO').toUpperCase(),
                    email: uEmail,
                    password: passHash,
                    permission: u.permission || 'TECNICO',
                    signature: u.signature || u.assinatura || ''
                };
                break;
            }
        }
    }

    if (foundUser) {
        // Atualiza/Sincroniza o usuário encontrado no array local usersList
        const idx = usersList.findIndex(u => String(u.id) === String(foundUser.id));
        if (idx !== -1) {
            usersList[idx] = foundUser;
        } else {
            usersList.push(foundUser);
        }
        setStoredData('crane_users', usersList);

        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        // Atualiza perfil na sidebar
        const roleEl = document.getElementById('user-role-display');
        const nameEl = document.getElementById('user-name-display');
        if (roleEl) roleEl.innerText = foundUser.permission || 'TECNICO';
        if (nameEl) nameEl.innerText = foundUser.name || 'USUÁRIO';
        
        // Dispara renderização inicial do app
        if (typeof window.renderAssets === 'function') {
            window.renderAssets();
        }
    } else {
        window.showAlert('E-MAIL OU SENHA INCORRETO.', 'warning');
    }
};

window.handleLogout = function() {
    document.getElementById('main-app').classList.add('hidden');
    document.getElementById('login-view').classList.remove('hidden');
    // Limpa campos por segurança
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    if (emailInput) emailInput.value = '';
    if (passInput) passInput.value = '';
};

