import { NextResponse } from 'next/server'
import { runProductionBatch } from '@/jobs/production-runner'

export async function POST() {
    const result = await runProductionBatch()

    if (result.success) {
        return NextResponse.json(result)
    } else {
        return NextResponse.json(result, { status: 500 })
    }
}

export async function GET() {
    return NextResponse.json({ message: 'Use POST to trigger the Production Batch' })
}
