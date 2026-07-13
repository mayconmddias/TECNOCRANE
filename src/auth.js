// Crane Pro - Authentication & Security Module [LOCKED]
import { usersList, setStoredData } from './data.js';

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
        changeEmailInput.value = loginEmailInput.value || '';
    } else {
        loginState.classList.remove('hidden');
        changeState.classList.add('hidden');
        document.getElementById('current-password').value = '';
        document.getElementById('new-password').value = '';
        document.getElementById('confirm-password').value = '';
    }
};

window.handleSaveNewPassword = function() {
    const emailInput = document.getElementById('change-email');
    const currentInput = document.getElementById('current-password');
    const newInput = document.getElementById('new-password');
    const confirmInput = document.getElementById('confirm-password');

    const email = emailInput.value.toLowerCase();
    const current = currentInput.value;
    const newPass = newInput.value;
    const confirm = confirmInput.value;

    if (!email) return window.showAlert('E-MAIL NÃO IDENTIFICADO.', 'warning');
    if (!current || !newPass || !confirm) return window.showAlert('PREENCHA TODOS OS CAMPOS PARA ALTERAR A SENHA.', 'warning');
    if (newPass !== confirm) return window.showAlert('A NOVA SENHA E A CONFIRMAÇÃO NÃO CONFEREM.', 'warning');

    const userIdx = usersList.findIndex(u => u.email === email);
    if (userIdx === -1) return window.showAlert('USUÁRIO NÃO ENCONTRADO.', 'warning');
    if (usersList[userIdx].password !== current) return window.showAlert('SENHA ATUAL INCORRETA.', 'warning');

    usersList[userIdx].password = newPass;
    setStoredData('crane_users', usersList);
    
    window.showAlert('SENHA ALTERADA COM SUCESSO!', 'success', () => {
        currentInput.value = '';
        newInput.value = '';
        confirmInput.value = '';
        window.togglePasswordChange(false);
    });
};

window.handleLogin = function() {
    const emailInput = document.getElementById('login-email');
    const passInput = document.getElementById('login-password');
    const email = emailInput.value.toLowerCase();
    const pass = passInput.value;
    const user = usersList.find(u => u.email === email && u.password === pass);
    if (user) {
        document.getElementById('login-view').classList.add('hidden');
        document.getElementById('main-app').classList.remove('hidden');
        
        // Atualiza perfil na sidebar
        const roleEl = document.getElementById('user-role-display');
        const nameEl = document.getElementById('user-name-display');
        if (roleEl) roleEl.innerText = user.permission;
        if (nameEl) nameEl.innerText = user.name;
        
        // Dispara renderização inicial do app
        if (typeof window.renderAssets === 'function') {
            window.renderAssets();
        }
    } else window.showAlert('USUÁRIO OU SENHA INCORRETOS.', 'warning');
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
