const fs = require('fs')

async function testBatch() {
    console.log('Hitting local API to trigger batch...')
    const res = await fetch('http://localhost:3000/api/jobs/phase2-production', {
        method: 'POST'
    })
    console.log('Status', res.status)
    const text = await res.text()
    console.log('Body:', text)
}

testBatch().catch(console.error);
