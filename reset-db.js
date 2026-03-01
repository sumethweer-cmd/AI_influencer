const fs = require('fs')

async function reset() {
    const envFile = fs.readFileSync('.env.local', 'utf8')
    const keyMatch = envFile.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)
    const keyMatch2 = envFile.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)

    if (!keyMatch || !keyMatch2) {
        console.log('Keys not found'); return;
    }

    const url = keyMatch[1].trim()
    const serviceKey = keyMatch2[1].trim()

    console.log('Resetting stuck "In Production" items back to "Draft"...')

    const res = await fetch(`${url}/rest/v1/content_items?status=eq.In Production`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'apikey': serviceKey,
            'Authorization': `Bearer ${serviceKey}`
        },
        body: JSON.stringify({ status: 'Draft' })
    })

    if (res.ok) {
        console.log('Successfully reset items!')
    } else {
        const txt = await res.text()
        console.error('Error:', txt)
    }
}
reset()
