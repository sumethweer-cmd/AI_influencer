import { NextResponse } from 'next/server'
import { runAutoPoster } from '@/jobs/scheduler'

export async function POST() {
    const result = await runAutoPoster()

    if (result.success) {
        return NextResponse.json(result)
    } else {
        return NextResponse.json(result, { status: 500 })
    }
}

export async function GET() {
    return NextResponse.json({ message: 'Use POST to trigger the Auto Poster' })
}
