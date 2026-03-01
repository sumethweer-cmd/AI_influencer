import { createClient } from '@supabase/supabase-js'
import { LogLevel } from '@/types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Client for client-side (public)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client for server-side (admin/jobs)
// Only initialize if we have the key (server-side only)
export const supabaseAdmin = supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey)
    : null as any

/**
 * System Logger to save logs to Supabase
 */
export async function logSystem(
    level: LogLevel,
    phase: string,
    message: string,
    metadata?: Record<string, unknown>
) {
    try {
        const { error } = await supabaseAdmin.from('system_logs').insert({
            level,
            phase,
            message,
            metadata
        })

        if (error) console.error('Error saving log to Supabase:', error)

        // Also log to console for local debugging
        const color = level === 'ERROR' ? '\x1b[31m' : level === 'SUCCESS' ? '\x1b[32m' : '\x1b[36m'
        console.log(`${color}[${phase}] ${level}: ${message}\x1b[0m`, metadata || '')
    } catch (err) {
        console.error('Failed to log system event:', err)
    }
}

export async function uploadToStorage(
    bucket: string,
    path: string,
    fileBody: Buffer | Blob | File,
    contentType: string = 'image/png',
    maxRetries: number = 3
): Promise<string> {
    if (!supabaseAdmin) throw new Error("Supabase Admin client not initialized");

    let lastError = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const { data, error } = await supabaseAdmin.storage
                .from(bucket)
                .upload(path, fileBody, {
                    contentType,
                    upsert: true,
                });

            if (error) {
                throw new Error(`Storage upload failed: ${error.message}`);
            }

            const { data: publicUrlData } = supabaseAdmin.storage
                .from(bucket)
                .getPublicUrl(path);

            return publicUrlData.publicUrl;
        } catch (err: any) {
            lastError = err;
            console.warn(`[Attempt ${attempt}/${maxRetries}] Storage upload failed for ${path}: ${err.message}`);
            if (attempt < maxRetries) {
                // Exponential backoff: 2s, 4s, 8s...
                await new Promise(res => setTimeout(res, Math.pow(2, attempt) * 1000));
            }
        }
    }

    throw new Error(`Failed to upload after ${maxRetries} attempts. Last error: ${lastError?.message}`);
}
