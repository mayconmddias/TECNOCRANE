import { createClient } from '@supabase/supabase-js';

let supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
if (supabaseUrl) {
    supabaseUrl = supabaseUrl.replace(/\/rest\/v1\/?$/, '').replace(/\/$/, '');
}
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = !!(supabaseUrl && supabaseAnonKey);

if (!isSupabaseConfigured) {
    console.warn('SUPABASE: URL ou chave ANON não configuradas no arquivo .env. O aplicativo funcionará em modo local (fallback).');
}

export const supabase = isSupabaseConfigured 
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

/**
 * Helper genérico para buscar dados de uma tabela
 */
export async function dbFetchAll(tableName) {
    if (!supabase) return null;
    try {
        const { data, error } = await supabase.from(tableName).select('*');
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
    if (!supabase) return null;
    try {
        const { data, error } = await supabase.from(tableName).upsert(payload);
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
    if (!supabase) return null;
    try {
        const { data, error } = await supabase.from(tableName).delete().eq(queryField, queryValue);
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
    if (!supabase) return null;
    try {
        const { data, error } = await supabase.storage.from(bucketName).upload(path, file, { upsert: true });
        if (error) throw error;
        const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(path);
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
    if (!supabase || !base64Data) return base64Data;
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

        const { data, error } = await supabase.storage.from(bucketName).upload(path, blob, {
            upsert: true,
            contentType: mimeType
        });

        if (error) {
            console.warn(`Supabase Storage upload falhou em ${bucketName}/${path}:`, error);
            return base64Data;
        }

        const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(path);
        return publicUrlData && publicUrlData.publicUrl ? publicUrlData.publicUrl : base64Data;
    } catch (e) {
        console.warn(`Erro no uploadBase64ToStorage para ${bucketName}:`, e);
        return base64Data;
    }
}


