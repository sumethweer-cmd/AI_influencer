import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkJobs() {
    const { data: jobs, error } = await supabase
        .from('production_jobs')
        .select('*')
        .order('updated_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching jobs:', error);
        return;
    }

    console.log("=== LATEST 5 BATCH JOBS ===");
    for (const job of jobs) {
        console.log(`[${job.updated_at}] ID: ${job.id} | Status: ${job.status} | Completed: ${job.completed_items}/${job.total_items} | Current Item: ${job.current_item_id}`);
    }
}

checkJobs();
