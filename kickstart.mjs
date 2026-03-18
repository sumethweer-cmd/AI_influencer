import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const functionUrl = `${supabaseUrl}/functions/v1/process-phase2-batch`

async function kickstart() {
    console.log(`📡 Sending Kickstart Pulse to ${functionUrl}...`)
    
    if (!supabaseUrl) {
        console.error("❌ SUPABASE_URL is missing!")
        return
    }

    try {
        const res = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({ action: 'orchestrate' })
        })
        
        const json = await res.json()
        console.log("✅ Kickstart Response:", json)
        console.log("🚀 The Autonomous Heartbeat has been started. The engine is now self-polling.")
    } catch (err) {
        console.error("❌ Kickstart Failed:", err.message)
    }
}

kickstart()
