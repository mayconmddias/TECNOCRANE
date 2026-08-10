import { createClient } from '@supabase/supabase-js';

// Utilitários de Codificação/Criptografia do Token do Tenant (Evita exposição no localStorage)
const TOKEN_PREFIX = 'crane_sec_';

export function encodeTenantCode(code) {
    if (!code) return '';
    try {
        const raw = `${TOKEN_PREFIX}${code}_${Date.now()}`;
        return btoa(raw);
    } catch (e) {
        return code;
    }
}

export function decodeTenantToken(token) {
    if (!token) return '001';
    try {
        const decoded = atob(token);
        if (decoded.startsWith(TOKEN_PREFIX)) {
            const parts = decoded.replace(TOKEN_PREFIX, '').split('_');
            return parts[0] || '001';
        }
    } catch (e) {}
    return '001';
}

let initialUrl = import.meta.env.VITE_SUPABASE_URL;
if (initialUrl) {
    initialUrl = initialUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}
let initialKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(initialUrl && initialKey);

if (!isSupabaseConfigured) {
    console.warn('SUPABASE: URL ou chave ANON não configuradas no arquivo .env. O aplicativo funcionará em modo local (fallback).');
}

// Instância padrão Master/Piloto (Tecnocrane - 001)
const defaultClient = isSupabaseConfigured ? createClient(initialUrl, initialKey) : null;

let activeClient = defaultClient;
let activeTenantCode = '001';

// Restaura tenant memorizado no localStorage se existir
if (typeof window !== 'undefined') {
    try {
        const savedToken = localStorage.getItem('_crane_sec_tkn');
        if (savedToken) {
            activeTenantCode = decodeTenantToken(savedToken);
        }
        const savedUrl = sessionStorage.getItem('crane_tenant_url');
        const savedKey = sessionStorage.getItem('crane_tenant_key');
        if (savedUrl && savedKey) {
            activeClient = createClient(savedUrl, savedKey);
        }
    } catch (e) {}
}

export function getTenantCode() {
    return activeTenantCode || '001';
}

export function setTenantSupabase(url, anonKey, tenantCode = '001') {
    if (!url || !anonKey) return;
    try {
        const cleanUrl = url.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
        activeClient = createClient(cleanUrl, anonKey);
        activeTenantCode = tenantCode;

        if (typeof window !== 'undefined') {
            const encodedToken = encodeTenantCode(tenantCode);
            localStorage.setItem('_crane_sec_tkn', encodedToken);
            sessionStorage.setItem('crane_tenant_url', cleanUrl);
            sessionStorage.setItem('crane_tenant_key', anonKey);
        }
        console.log(`SUPABASE: Conectado ao banco de dados do Cliente ${tenantCode}`);
    } catch (e) {
        console.error(`SUPABASE: Erro ao alterar para o cliente ${tenantCode}:`, e);
    }
}

export function getActiveSupabase() {
    return activeClient || defaultClient;
}

export const supabase = new Proxy({}, {
    get(target, prop) {
        const client = getActiveSupabase();
        if (!client) return null;
        const value = client[prop];
        return typeof value === 'function' ? value.bind(client) : value;
    }
});

/**
 * Helper genérico para buscar dados de uma tabela
 */
export async function dbFetchAll(tableName) {
    const client = getActiveSupabase();
    if (!client) return null;
    try {
        const { data, error } = await client.from(tableName).select('*');
        if (error) throw error;
        return data;
    } catch (e) {
        console.error(`Erro ao buscar dados da tabela ${tableName} no Supabase:`, e);
        return null;
    }
}

/**
 * Helper genérico para upsert (inserir ou atualizar) dados
 */
export async function dbUpsert(tableName, payload) {
    const client = getActiveSupabase();
    if (!client) return null;
    try {
        const { data, error } = await client.from(tableName).upsert(payload);
        if (error) throw error;
        return data;
    } catch (e) {
        console.error(`Erro ao enviar dados para a tabela ${tableName} no Supabase:`, e);
        throw e;
    }
}

/**
 * Helper genérico para deletar um registro por ID
 */
export async function dbDelete(tableName, queryField, queryValue) {
    const client = getActiveSupabase();
    if (!client) return null;
    try {
        const { data, error } = await client.from(tableName).delete().eq(queryField, queryValue);
        if (error) throw error;
        return data;
    } catch (e) {
        console.error(`Erro ao deletar da tabela ${tableName} no Supabase:`, e);
        throw e;
    }
}

/**
 * Helper genérico para upload de mídia no Supabase Storage
 */
export async function uploadMediaFile(bucketName, path, file) {
    const client = getActiveSupabase();
    if (!client) return null;
    try {
        const { data, error } = await client.storage.from(bucketName).upload(path, file, { upsert: true });
        if (error) throw error;
        const { data: publicUrlData } = client.storage.from(bucketName).getPublicUrl(path);
        return publicUrlData ? publicUrlData.publicUrl : null;
    } catch (e) {
        console.warn(`Supabase Storage (${bucketName}):`, e);
        return null;
    }
}

/**
 * Converte base64 para Blob e faz upload no Supabase Storage se for base64.
 * Se já for uma URL (http/https), apenas retorna a própria URL.
 */
export async function uploadBase64ToStorage(bucketName, folderPath, base64Data, fileName) {
    const client = getActiveSupabase();
    if (!client || !base64Data) return base64Data;
    if (typeof base64Data !== 'string') return base64Data;
    
    if (base64Data.startsWith('http://') || base64Data.startsWith('https://')) {
        return base64Data;
    }
    
    if (!base64Data.startsWith('data:')) {
        return base64Data;
    }

    try {
        const parts = base64Data.split(';base64,');
        if (parts.length < 2) return base64Data;
        const mimeType = parts[0].replace('data:', '') || 'image/jpeg';
        const raw = atob(parts[1]);
        const uInt8Array = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; ++i) {
            uInt8Array[i] = raw.charCodeAt(i);
        }
        const blob = new Blob([uInt8Array], { type: mimeType });

        const extMatch = mimeType.match(/\/([a-zA-Z0-9]+)$/);
        const ext = extMatch ? extMatch[1] : 'jpg';
        const fullFileName = fileName.endsWith(`.${ext}`) ? fileName : `${fileName}.${ext}`;
        const cleanFolder = folderPath.replace(/^\/+|\/+$/g, '');
        const path = `${cleanFolder}/${fullFileName}`;

        const { data, error } = await client.storage.from(bucketName).upload(path, blob, {
            upsert: true,
            contentType: mimeType
        });

        if (error) {
            console.warn(`Supabase Storage upload falhou em ${bucketName}/${path}:`, error);
            return base64Data;
        }

        const { data: publicUrlData } = client.storage.from(bucketName).getPublicUrl(path);
        return publicUrlData && publicUrlData.publicUrl ? publicUrlData.publicUrl : base64Data;
    } catch (e) {
        console.warn(`Erro no uploadBase64ToStorage para ${bucketName}:`, e);
        return base64Data;
    }
}


