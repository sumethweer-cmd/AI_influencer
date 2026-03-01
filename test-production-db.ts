import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function test() {
    console.log("=== Latest System Logs ===")
    const { data: logs } = await supabaseAdmin.from('system_logs').select('*').order('created_at', { ascending: false }).limit(5)
    console.log(JSON.stringify(logs, null, 2))

    console.log("\n=== Latest Content Items ===")
    const { data: items } = await supabaseAdmin.from('content_items').select('id, sequence_number, status, batch_size').order('created_at', { ascending: false }).limit(2)
    console.log(JSON.stringify(items, null, 2))

    console.log("\n=== Latest Generated Images ===")
    const { data: images } = await supabaseAdmin.from('generated_images').select('*').order('created_at', { ascending: false }).limit(5)
    console.log(JSON.stringify(images, null, 2))
}
test()
