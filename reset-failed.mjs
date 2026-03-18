import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function resetFailed() {
  console.log('Resetting "Failed" jobs to "Pending"...');
  
  const { count, error } = await supabase
    .from('production_jobs')
    .update({ status: 'Pending', error_message: null, updated_at: new Date().toISOString() })
    .eq('status', 'Failed');

  if (error) {
    console.error('Error resetting jobs:', error);
    return;
  }

  console.log(`Successfully reset ${count || 0} jobs to Pending!`);
  console.log('Watching for Orchestrator to pick them up...');
}

resetFailed();
