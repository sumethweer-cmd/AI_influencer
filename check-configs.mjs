import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkConfigs() {
  console.log('Checking system_configs in Supabase...');
  
  const { data: configs, error } = await supabase
    .from('system_configs')
    .select('*');

  if (error) {
    console.error('Error fetching configs:', error);
    return;
  }

  console.log('System Configs found:');
  configs.forEach(config => {
    // Hide actual values but show if they exist
    const hasValue = !!config.key_value;
    console.log(`- ${config.key_name}: ${hasValue ? '[EXISTS]' : '[MISSING]'}`);
    if (config.key_name === 'RUNPOD_API_KEY') {
        console.log(`  Value snippet: ${config.key_value?.substring(0, 5)}...`);
    }
  });
}

checkConfigs();
