import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const workerUrl = `${supabaseUrl}/functions/v1/process-phase2-batch`;

async function triggerWorker() {
  console.log(`Triggering Worker at: ${workerUrl}`);
  
  try {
    const response = await fetch(workerUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json', 
        'Authorization': `Bearer ${serviceKey}` 
      },
      body: JSON.stringify({ action: 'orchestrate' })
    });

    const status = response.status;
    const body = await response.text();
    
    console.log(`Response Status: ${status}`);
    console.log(`Response Body: ${body}`);
    
    if (status === 200) {
        console.log('✅ Trigger sent successfully!');
    } else {
        console.log('❌ Trigger failed.');
    }
  } catch (err) {
    console.error('Fetch Error:', err);
  }
}

triggerWorker();
