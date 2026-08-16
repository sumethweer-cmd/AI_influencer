import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkEtsyData() {
    console.log("📊 Checking Etsy records...");
    
    const tables = ['etsy_books', 'etsy_pages', 'etsy_workflows', 'etsy_configs'];
    
    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });
            
        if (error) {
            console.error(`❌ Table ${table} error:`, error.message);
        } else {
            console.log(`✅ Table ${table}: ${count} rows`);
        }
    }
}

checkEtsyData();
