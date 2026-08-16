import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function checkRowSize(tableName) {
    const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .limit(10)
        
    if (error) return;
    
    if (data.length > 0) {
        let totalSize = 0;
        data.forEach(row => {
            totalSize += JSON.stringify(row).length;
        });
        const avgSize = totalSize / data.length;
        console.log(`Table ${tableName} -> Sample Avg Row Size: ${(avgSize/1024).toFixed(2)} KB`);
        
        // Output large fields if avg is huge
        if (avgSize > 50000) { // > 50KB per row
            const firstRow = data[0];
            for (let key in firstRow) {
                const len = JSON.stringify(firstRow[key]).length;
                if (len > 10000) {
                    console.log(`   - Column '${key}' is massively large (${(len/1024).toFixed(2)} KB)!`);
                    console.log(`     Sample: ${JSON.stringify(firstRow[key]).substring(0, 100)}...`);
                }
            }
        }
    }
}

async function run() {
    await checkRowSize('system_logs');
    await checkRowSize('generated_images');
    await checkRowSize('content_items');
    await checkRowSize('production_jobs');
}

run();
