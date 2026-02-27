import { generatePlanFromPrompt } from './lib/gemini'

async function test() {
    try {
        console.log('Testing generatePlanFromPrompt...')
        const res = await generatePlanFromPrompt('Karen ต้องนั่ง OT ดึกในออฟฟิศคนเดียว แต่จริงๆ แอบนัดผู้ชายมา', 'Karen')
        console.log('Success!', res.contents[0])
    } catch (e: any) {
        console.error('Error:', e.message)
    }
}
test()
