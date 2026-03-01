const fs = require('fs')

async function resetJobs() {
    const envFile = fs.readFileSync('.env.local', 'utf8')
    const urlMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)
    const keyMatch = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)

    if (!urlMatch || !keyMatch) {
        console.log('Keys not found'); return;
    }

    const url = urlMatch[1].trim()
    const serviceKey = keyMatch[1].trim()

    console.log('Clearing old production_jobs...')

    const res = await fetch(`${url}/rest/v1/production_jobs?id=not.is.null`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
        }
    })

    if (res.ok || res.status === 204) {
        console.log('Successfully cleared production jobs!')
    } else {
        const txt = await res.text()
        console.error('Error:', res.status, txt)
    }
}
resetJobs()
