import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';

/**
 * Inicializa os recursos nativos quando o aplicativo estiver rodando dentro do APK (Capacitor).
 */
export async function initNativeFeatures() {
    if (!Capacitor.isNativePlatform()) {
        console.log('CRANE PRO: Rodando em ambiente Web/Browser.');
        return;
    }

    console.log('CRANE PRO: Rodando como APK Nativo Android.');

    // 1. Configurar StatusBar
    try {
        await StatusBar.setStyle({ style: Style.Dark });
        await StatusBar.setBackgroundColor({ color: '#000000' });
        await StatusBar.setOverlaysWebView({ overlay: false });
    } catch (err) {
        console.warn('Erro ao configurar StatusBar:', err);
    }

    // 2. Ocultar SplashScreen imediatamente e após startup
    const hideSplash = async () => {
        try {
            await SplashScreen.hide();
        } catch (err) {
            console.warn('Erro ao ocultar SplashScreen:', err);
        }
    };
    
    hideSplash();
    setTimeout(hideSplash, 100);
    setTimeout(hideSplash, 500);

    // 3. Tratar o Botão Voltar do Android (Hardware Back Button)
    try {
        App.addListener('backButton', ({ canGoBack }) => {
            // Verifica se há modais abertos no DOM para fechar antes de sair do app
            const openModals = document.querySelectorAll('[id$="-modal"]:not(.hidden), [id^="modal-"]:not(.hidden), [role="dialog"]:not(.hidden)');
            
            // Encontra o modal visível mais recente
            let activeModal = null;
            for (let i = openModals.length - 1; i >= 0; i--) {
                const modal = openModals[i];
                const style = window.getComputedStyle(modal);
                if (style.display !== 'none' && style.visibility !== 'hidden' && modal.id !== 'toast' && modal.id !== 'print-loading-overlay') {
                    activeModal = modal;
                    break;
                }
            }

            if (activeModal) {
                // Tenta disparar o botão de fechar do modal se existir
                const closeBtn = activeModal.querySelector('[data-close-modal], [onclick*="close"], button.close');
                if (closeBtn) {
                    closeBtn.click();
                } else {
                    activeModal.classList.add('hidden');
                }
                return;
            }

            // Se estiver em uma tela secundária/aba e puder voltar
            if (canGoBack) {
                window.history.back();
            } else {
                // Pergunta se deseja sair do aplicativo
                const confirmExit = window.confirm('Deseja realmente sair do CRANE PRO?');
                if (confirmExit) {
                    App.exitApp();
                }
            }
        });
    } catch (err) {
        console.warn('Erro ao registrar listener de backButton:', err);
    }
}
