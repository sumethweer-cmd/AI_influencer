import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectPending() {
  console.log('Inspecting Pending Jobs...');
  
  const { data: pending, error } = await supabase
    .from('production_jobs')
    .select('*')
    .eq('status', 'Pending')
    .limit(10);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${pending.length} Pending jobs:`);
  pending.forEach(job => {
    console.log(`- Job ID: ${job.id}, Created: ${job.created_at}, Type: ${job.image_type}`);
  });

  // Check all statuses
  const { data: stats, errorStatus } = await supabase
    .from('production_jobs')
    .select('status');
  
  const counts = (stats || []).reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});

  console.log('\n--- Full Status Count ---');
  console.log(JSON.stringify(counts, null, 2));

  if (errorStatus) console.error('Count Error:', errorStatus);
}

inspectPending();
