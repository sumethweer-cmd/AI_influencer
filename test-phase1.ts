import { runWeeklyPlanner } from './jobs/weekly-planner'

async function test() {
    console.log("Testing Brainstorm...")
    const result = await runWeeklyPlanner('brainstorm', {
        persona: 'Momo',
        prompt: 'แดดร้อน มานอนตากแอร์ห้องเรามั้ย'
    })
    console.log("Result:", result)
}
test()
