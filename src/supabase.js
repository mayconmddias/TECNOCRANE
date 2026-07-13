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
