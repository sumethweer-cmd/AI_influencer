import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkContent() {
    const { data: items, error } = await supabase
        .from('content_items')
        .select(`
            id, 
            status, 
            gen_sfw, 
            gen_nsfw, 
            batch_size, 
            generated_images!generated_images_content_item_id_fkey(id, image_type, slot_index, status)
        `)
        .in('status', ['In Production', 'QC Pending'])
        .order('updated_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching contents:', error);
        return;
    }

    console.log("=== LATEST 5 CONTENT ITEMS ===");
    for (const item of items) {
        const sfwCount = item.generated_images.filter(i => i.image_type === 'SFW').length;
        const nsfwCount = item.generated_images.filter(i => i.image_type === 'NSFW').length;
        console.log(`Item ID: ${item.id} | Status: ${item.status}`);
        console.log(`  Expected: SFW=${item.gen_sfw ? item.batch_size : 0}, NSFW=${item.gen_nsfw ? item.batch_size : 0}`);
        console.log(`  Actual  : SFW=${sfwCount}, NSFW=${nsfwCount}`);

        // Let's count max slot index
        const sfwSlots = item.generated_images.filter(i => i.image_type === 'SFW').map(i => i.slot_index);
        const nsfwSlots = item.generated_images.filter(i => i.image_type === 'NSFW').map(i => i.slot_index);

        console.log(`  SFW Slots: ${[...new Set(sfwSlots)].sort().join(', ')}`);
        console.log(`  NSFW Slots: ${[...new Set(nsfwSlots)].sort().join(', ')}`);
        console.log('---');
    }
}

checkContent();
