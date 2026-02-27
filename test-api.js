async function run() {
    try {
        const res = await fetch('http://localhost:3002/api/jobs/phase1-planner', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                method: 'brainstorm',
                payload: { prompt: 'Karen ต้องนั่ง OT ดึกในออฟฟิศคนเดียว แต่จริงๆ แอบนัดผู้ชายมา' }
            })
        });
        const text = await res.text();
        console.log('Status:', res.status);
        console.log('Response:', text);
    } catch (e) {
        console.error('Fetch error:', e);
    }
}
run();
