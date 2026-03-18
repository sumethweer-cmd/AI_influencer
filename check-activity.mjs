import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkWorkerActivity() {
  console.log('--- System Activity Report ---');
  
  const { data: logs, error } = await supabase
    .from('system_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }

  const now = new Date();
  console.log(`Current Time (Local): ${now.toLocaleString()}`);
  console.log(`Current Time (UTC):   ${now.toISOString()}`);
  console.log('\nRecent Logs (Total: ' + logs.length + '):');
  
  logs.forEach(log => {
    const logTime = new Date(log.created_at);
    const diffMs = now - logTime;
    const diffSec = Math.floor(diffMs / 1000);
    const timeStr = diffSec < 60 ? `${diffSec}s ago` : `${Math.floor(diffSec/60)}m ${diffSec%60}s ago`;
    
    console.log(`[${log.level}] ${log.created_at} (${timeStr}) [${log.phase}]: ${log.message}`);
  });

  const { data: stats } = await supabase
    .from('production_jobs')
    .select('status');
  
  const counts = (stats || []).reduce((acc, job) => {
    acc[job.status] = (acc[job.status] || 0) + 1;
    return acc;
  }, {});

  console.log('\n--- Job Status Summary ---');
  console.log(JSON.stringify(counts, null, 2));
}

checkWorkerActivity();
