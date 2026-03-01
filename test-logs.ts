import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function test() {
    const { data, error } = await supabaseAdmin.from('system_logs').select('*').order('created_at', { ascending: false }).limit(5)
    if (error) {
        console.error(error)
    } else {
        console.log(JSON.stringify(data, null, 2))
    }
}
test()
