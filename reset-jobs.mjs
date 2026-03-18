import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://uzlpqpomtoolgpljjtmv.supabase.co'
const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6bHBxcG9tdG9vbGdwbGpqdG12Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MzMxNzI5MCwiZXhwIjoyMDg4ODkzMjkwfQ.S_5LgD88ooFxYJUEn4kzEwMV1P9rcFTJkYSngWvQ4j4'

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

async function run() {
    console.log("Forcing Reset of Pending Jobs...")
    const { data, error } = await supabase
        .from('production_jobs')
        .update({ status: 'Failed', error_message: 'Manual Reset: Worker hung' })
        .eq('status', 'Pending')
    
    if (error) console.error(error)
    else console.log("Reset successful. Jobs should now show as Failed.")
}

run()
