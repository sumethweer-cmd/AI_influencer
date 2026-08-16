import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const supabase = createClient(supabaseUrl, supabaseKey)

async function auditCounts() {
    console.log(`🔍 Checking row counts for suspicious tables...`)
    
    const tables = [
        'system_logs',
        'activity_log',
        'generated_images',
        'content_items',
        'production_jobs',
        'content_prompts',
        'personas',
        'edge_logs' // Custom edge logs if any
    ]
    
    for (const table of tables) {
        try {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true })
            
            if (error) {
                // Table might not exist, skip silently or log briefly
                if (!error.message.includes("relation") && !error.message.includes("does not exist")) {
                    console.error(`Error checking ${table}:`, error.message)
                }
            } else {
                console.log(`📊 Table ${table}: ${count} rows`)
            }
        } catch (e) {
            // Ignore
        }
    }
}

auditCounts()
