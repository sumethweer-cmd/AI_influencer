import { NextResponse } from 'next/server'
import { runWeeklyPlanner } from '@/jobs/weekly-planner'

export async function POST(request: Request) {
    let method = 'apify'
    let payload = {}

    try {
        const body = await request.json()
        if (body.method) method = body.method
        if (body.payload) payload = body.payload
    } catch (e) {
        // Fallback to default apify if no body or invalid json
    }

    const result = await runWeeklyPlanner(method as any, payload)

    if (result.success) {
        return NextResponse.json(result)
    } else {
        return NextResponse.json(result, { status: 500 })
    }
}

export async function GET() {
    return NextResponse.json({ message: 'Use POST to trigger the Weekly Planner' })
}
