/**
 * Módulo de Relatórios - Pré-carregamento determinístico de mídia e trava visual "Carregando Impressão"
 */

/**
 * Exibe o overlay de progresso com a mensagem "Carregando Impressão"
 */
export function showPrintLoadingOverlay() {
    if (typeof document === 'undefined') return;
    let overlay = document.getElementById('crane-print-loading-overlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'crane-print-loading-overlay';
        overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: rgba(15, 23, 42, 0.85);
            backdrop-filter: blur(6px);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: #ffffff;
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        `;
        overlay.innerHTML = `
            <div style="background: #1e293b; border: 1px solid #334155; border-radius: 12px; padding: 28px 40px; text-align: center; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.5);">
                <div style="width: 48px; height: 48px; border: 4px solid #334155; border-top-color: #facc15; border-radius: 50%; animation: craneSpin 0.8s linear infinite; margin: 0 auto 16px auto;"></div>
                <div style="font-size: 18px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; color: #f8fafc;">Carregando Impressão</div>
                <div style="font-size: 12px; color: #94a3b8; margin-top: 6px;">Preparando mídias e diagramação A4...</div>
            </div>
            <style>
                @keyframes craneSpin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
}

/**
 * Oculta o overlay de carregamento
 */
export function hidePrintLoadingOverlay() {
    if (typeof document === 'undefined') return;
    const overlay = document.getElementById('crane-print-loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
}

/**
 * Mapeia deterministicamente todas as URLs de mídias presentes no relatório
 */
export function collectAllReportImageUrls(report, company, internalCompany, usersList = []) {
    const urls = new Set();

    if (company && company.logo && typeof company.logo === 'string' && company.logo.trim() !== '') {
        urls.add(company.logo.trim());
    }
    if (internalCompany && internalCompany.logo && typeof internalCompany.logo === 'string' && internalCompany.logo.trim() !== '') {
        urls.add(internalCompany.logo.trim());
    }

    if (report) {
        if (Array.isArray(report.generalImages)) {
            report.generalImages.forEach(img => {
                if (img && typeof img === 'string' && img.trim() !== '') urls.add(img.trim());
            });
        }

        if (report.responses && typeof report.responses === 'object') {
            Object.values(report.responses).forEach(resp => {
                if (resp && typeof resp === 'object') {
                    if (Array.isArray(resp.images)) {
                        resp.images.forEach(img => {
                            if (img && typeof img === 'string' && img.trim() !== '') urls.add(img.trim());
                        });
                    }
                    if (Array.isArray(resp.additionalObservations)) {
                        resp.additionalObservations.forEach(obs => {
                            if (obs && Array.isArray(obs.images)) {
                                obs.images.forEach(img => {
                                    if (img && typeof img === 'string' && img.trim() !== '') urls.add(img.trim());
                                });
                            }
                        });
                    }
                }
            });
        }

        // Assinaturas
        let selectedResponsaveisList = [];
        if (report.responsaveis && Array.isArray(report.responsaveis) && report.responsaveis.length > 0) {
            selectedResponsaveisList = report.responsaveis.map(id => {
                return usersList.find(u => String(u.id) === String(id));
            }).filter(Boolean);
        }

        if (selectedResponsaveisList.length === 0) {
            const defaultUser = usersList.find(u => u && u.name && u.name.toUpperCase() === (report.tecnico || '').toUpperCase());
            if (defaultUser && defaultUser.signature && typeof defaultUser.signature === 'string' && defaultUser.signature.trim() !== '') {
                urls.add(defaultUser.signature.trim());
            }
        } else {
            selectedResponsaveisList.forEach(u => {
                if (u && u.signature && typeof u.signature === 'string' && u.signature.trim() !== '') {
                    urls.add(u.signature.trim());
                }
            });
        }
    }

    return Array.from(urls);
}

/**
 * Pré-carrega todas as URLs em memória via objetos Image nativos
 */
export async function preloadImageUrls(urls) {
    if (!urls || urls.length === 0) return;

    const promises = urls.map(url => {
        return new Promise((resolve) => {
            const img = new Image();
            img.onload = () => resolve(true);
            img.onerror = () => resolve(false);
            img.src = url;
            if (img.complete) {
                resolve(true);
            }
        });
    });

    await Promise.allSettled(promises);
}

/**
 * Trava determinística que aguarda a decodificação completa das imagens no DOM do iframe antes do reflow/paginação
 */
export async function waitForIframeImages(iframeDoc) {
    if (!iframeDoc) return;
    const images = Array.from(iframeDoc.querySelectorAll('img'));
    if (images.length === 0) return;

    const promises = images.map(img => {
        return new Promise(resolve => {
            if (img.complete && img.naturalHeight !== 0) {
                if ('decode' in img) {
                    img.decode().then(resolve).catch(resolve);
                } else {
                    resolve();
                }
            } else {
                img.onload = () => {
                    if ('decode' in img) {
                        img.decode().then(resolve).catch(resolve);
                    } else {
                        resolve();
                    }
                };
                img.onerror = resolve;
            }
        });
    });

    await Promise.allSettled(promises);
}
