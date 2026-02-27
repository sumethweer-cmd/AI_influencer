import { supabaseAdmin } from './supabase'

/**
 * Utility to fetch configuration from Supabase
 * Falls back to process.env if not found in DB
 */
export async function getConfig(keyName: string): Promise<string | undefined> {
    try {
        const { data, error } = await supabaseAdmin
            .from('system_configs')
            .select('key_value')
            .eq('key_name', keyName)
            .single()

        if (error || !data || !data.key_value) {
            // Fallback for development if DB is empty
            return process.env[keyName]
        }

        return data.key_value
    } catch (err) {
        return process.env[keyName]
    }
}

/**
 * Update a config status after verification
 */
export async function updateConfigStatus(keyName: string, isValid: boolean) {
    await supabaseAdmin
        .from('system_configs')
        .update({
            is_valid: isValid,
            last_verified_at: new Date().toISOString()
        })
        .eq('key_name', keyName)
}
