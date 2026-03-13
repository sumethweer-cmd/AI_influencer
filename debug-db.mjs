import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

// Manual parsing of .env.local to be 100% sure
const envContent = fs.readFileSync('.env.local', 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
    const [key, ...vals] = line.split('=')
    if (key && vals.length > 0) {
        env[key.trim()] = vals.join('=').trim().replace(/^"|"$/g, '')
    }
})

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
)

async function debug() {
  console.log("Supabase URL:", env.NEXT_PUBLIC_SUPABASE_URL || env.SUPABASE_URL)
  
  const { data: jobs, error } = await supabase
    .from('production_jobs')
    .select('status, id')
    .limit(10)
  
  if (error) {
    console.error("Query Error:", error)
  } else {
    console.log("Job Samples:", jobs)
  }
}

debug()
