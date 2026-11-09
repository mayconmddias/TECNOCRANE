// Crane Pro - Utilities Module

export const monthsMap = {
    'JAN': 0, 'FEV': 1, 'MAR': 2, 'ABR': 3, 'MAI': 4, 'JUN': 5,
    'JUL': 6, 'AGO': 7, 'SET': 8, 'OUT': 9, 'NOV': 10, 'DEZ': 11
};

export const monthNames = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export function parseAssetDate(dateStr) {
    if (!dateStr) return new Date();
    // Suportar tanto DD/MM/YYYY quanto DD/MMM/YYYY e separadores / ou -
    const parts = dateStr.includes('/') ? dateStr.split('/') : dateStr.split('-');
    if (parts.length < 3) return new Date();
    
    let [day, month, year] = parts;
    let monthIdx;
    
    if (isNaN(month)) {
        monthIdx = monthsMap[month.toUpperCase().substring(0, 3)] || 0;
    } else {
        monthIdx = parseInt(month) - 1;
    }
    
    return new Date(year, monthIdx, day);
}

export function formatDateToDisplay(date) {
    const d = date.getDate().toString().padStart(2, '0');
    const m = (date.getMonth() + 1).toString().padStart(2, '0');
    const y = date.getFullYear();
    return `${d}-${m}-${y}`;
}

export function formatDateToISO(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Escapa caracteres HTML para prevenção de Cross-Site Scripting (XSS)
 */
export function escapeHTML(str) {
    if (!str || typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

/**
 * Gera um hash SHA-256 puro (sem salt) para compatibilidade retroativa
 */
export async function rawHashPassword(password) {
    if (!password) return '';
    if (/^[a-f0-9]{64}$/i.test(password)) return password;
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Gera um hash SHA-256 para senhas usando a Web Crypto API nativa do navegador (com salt padronizado)
 */
export async function hashPassword(password) {
    if (!password) return '';
    // Se a senha já for um hash SHA-256 (64 caracteres hexadecimais), retorna diretamente
    if (/^[a-f0-9]{64}$/i.test(password)) return password;
    
    const encoder = new TextEncoder();
    const data = encoder.encode(password + '_crane_salt_v1');
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Valida a senha contra o hash armazenado suportando:
 * 1. Hash padrão com salt (_crane_salt_v1)
 * 2. Hash SHA-256 puro legado (ex: senhas salvas antes da introdução do salt)
 * 3. Texto plano direto (fallback de compatibilidade legado)
 */
export async function verifyPassword(password, storedPassword) {
    if (!password || !storedPassword) return { valid: false, needsUpgrade: false };
    const cleanPass = String(password).trim();
    const cleanStored = String(storedPassword).trim();

    // 1. Plaintext fallback (legado de testes ou registros crus)
    if (cleanStored === cleanPass) {
        const salted = await hashPassword(cleanPass);
        return { valid: true, needsUpgrade: true, upgradedHash: salted };
    }

    // 2. Hash salgado padrão atual
    const saltedHash = await hashPassword(cleanPass);
    if (cleanStored === saltedHash) {
        return { valid: true, needsUpgrade: false, upgradedHash: saltedHash };
    }

    // 3. Hash SHA-256 legado puro (sem salt, como senhas criadas no padrão anterior)
    const rawHash = await rawHashPassword(cleanPass);
    if (cleanStored === rawHash) {
        return { valid: true, needsUpgrade: true, upgradedHash: saltedHash };
    }

    return { valid: false, needsUpgrade: false };
}

/**
 * Comprime uma imagem via Canvas HTML5 para otimizar armazenamento e latência de rede
 */
export function compressImage(source, maxWidth = 1200, maxHeight = 1200, quality = 0.7) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
            let width = img.width;
            let height = img.height;

            if (width > maxWidth) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
            }
            if (height > maxHeight) {
                width = Math.round((width * maxHeight) / height);
                height = maxHeight;
            }

            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            const compressedBase64 = canvas.toDataURL('image/jpeg', quality);
            resolve(compressedBase64);
        };
        img.onerror = () => resolve(source);
        if (typeof source === 'string') {
            img.src = source;
        } else if (source instanceof File || source instanceof Blob) {
            const reader = new FileReader();
            reader.onload = (e) => { img.src = e.target.result; };
            reader.readAsDataURL(source);
        } else {
            resolve(source);
        }
    });
}

/**
 * Formata um nome completo para exibição curta preservando preposições (ex: "JOSE DA SILVA", "APARECIDO DA SILVA")
 */
export function formatShortName(fullName) {
    if (!fullName || typeof fullName !== 'string') return '';
    const parts = fullName.trim().split(/\s+/);
    if (parts.length <= 1) return parts[0] || '';
    
    const prepositions = new Set(['de', 'da', 'do', 'dos', 'das', 'e', 'del', 'du', 'di', 'van', 'von', 'der']);
    const firstName = parts[0];
    
    if (prepositions.has(parts[1].toLowerCase())) {
        if (parts.length >= 3) {
            return `${firstName} ${parts[1]} ${parts[2]}`;
        }
        return `${firstName} ${parts[1]}`;
    }
    return `${firstName} ${parts[1]}`;
}


