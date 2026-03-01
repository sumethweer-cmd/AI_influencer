import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

async function reset() {
    console.log('Resetting stuck "In Production" items back to "Draft"...')
    const { data, error } = await supabaseAdmin
        .from('content_items')
        .update({ status: 'Draft' })
        .eq('status', 'In Production')

    if (error) {
        console.error('Error:', error.message)
    } else {
        console.log('Successfully reset items!')
    }

    // Also reset any "production_jobs" if needed, but the UI only cares about the most recent one.
}

reset()
