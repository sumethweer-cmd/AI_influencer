import { NextResponse } from 'next/server'
import { runProductionBatch } from '@/jobs/production-runner'

export const maxDuration = 300; // Allow 5 minutes execution time before Vercel kills it

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}))
    const { contentIds, specificIndex, forceType } = body

    const result = await runProductionBatch(contentIds, specificIndex, forceType)

    if (result.success) {
        return NextResponse.json(result)
    } else {
        return NextResponse.json(result, { status: 500 })
    }
}

export async function GET() {
    return NextResponse.json({ message: 'Use POST to trigger the Production Batch' })
}
