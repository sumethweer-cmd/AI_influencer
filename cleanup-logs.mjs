import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
    console.error("❌ Missing Supabase credentials in .env.local")
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function cleanupLogs() {
    console.log("🧹 Starting Log Cleanup...")
    
    // Calculate date - 7 days ago
    const cutOffDate = new Date()
    cutOffDate.setDate(cutOffDate.getDate() - 7)
    const isoDate = cutOffDate.toISOString()

    console.log(`📅 Deleting logs older than: ${isoDate}`)

    // 1. Get count first
    const { count, error: countErr } = await supabase
        .from('system_logs')
        .select('*', { count: 'exact', head: true })
        .lt('created_at', isoDate)

    if (countErr) {
        console.error("❌ Failed to get log count:", countErr)
        return
    }

    console.log(`📊 Found ${count} logs to delete.`)

    if (count === 0) {
        console.log("✅ No logs to delete. Database is clean enough.")
        return
    }

    // 2. Delete
    const { data, error: delErr } = await supabase
        .from('system_logs')
        .delete()
        .lt('created_at', isoDate)

    if (delErr) {
        console.error("❌ Failed to delete logs:", delErr)
        return
    }

    console.log(`✅ Successfully deleted old logs. Space should be reclaimed soon.`)
}

cleanupLogs()
