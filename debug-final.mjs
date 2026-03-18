import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uzlpqpomtoolgpljjtmv.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bHBxcG9tdG9vbGdwbGpqdG12Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzMxNzI5MCwiZXhwIjoyMDg4ODkzMjkwfQ.S_5LgD88ooFxYJUEn4kzEwMV1P9rcFTJkYSngWvQ4j4'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function run() {
    console.log("Checking System Logs...")
    const { data: logs, error } = await supabase
        .from('system_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10)
    
    if (error) {
        console.error(error)
        return
    }

    logs.forEach(l => {
        console.log(`[${l.created_at}] [${l.level}] ${l.phase}: ${l.message}`)
        if (l.metadata) console.log("Metadata:", l.metadata)
    })
}

run()
