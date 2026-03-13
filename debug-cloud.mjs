import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

async function debug() {
  console.log("--- Cloud Debug Start ---")
  
  // 1. Check Jobs
  const { data: jobs, error: jobErr } = await supabase
    .from('production_jobs')
    .select('status')
  
  if (jobErr) console.error("Job Error:", jobErr)
  else {
    const counts = jobs.reduce((acc, j) => {
      acc[j.status] = (acc[j.status] || 0) + 1
      return acc
    }, {})
    console.log("Job Status Counts:", counts)
  }

  // 2. Check Logs
  const { data: logs, error: logErr } = await supabase
    .from('system_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)
  
  if (logErr) console.error("Log Error:", logErr)
  else {
    console.log("Latest Logs:")
    logs.forEach(l => console.log(`[${l.created_at}] ${l.phase}: ${l.message}`))
  }

  // 3. Pulse Function
  console.log("\n--- Pulsing Edge Function ---")
  const workerUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/process-phase2-batch`
  try {
    const res = await fetch(workerUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
      },
      body: JSON.stringify({ action: 'orchestrate' })
    })
    console.log("Pulse Response Status:", res.status)
    const text = await res.text()
    console.log("Pulse Response Body:", text)
  } catch (e) {
    console.error("Pulse Fetch Error:", e.message)
  }

  console.log("\n--- Cloud Debug End ---")
}

debug()
