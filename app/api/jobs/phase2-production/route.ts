import { NextResponse } from 'next/server'
import { runProductionBatch } from '@/jobs/production-runner'

export async function POST(req: Request) {
    const body = await req.json().catch(() => ({}))
    const { contentIds, specificIndex, forceType } = body

    // Trigger the production batch asynchronously without awaiting it.
    // This allows the API to return immediately and prevents the browser's 
    // network timeout or navigation from aborting the Next.js process midway.
    runProductionBatch(contentIds, specificIndex, forceType).catch(err => {
        console.error('Background batch error:', err)
    })

    // Return immediately
    return NextResponse.json({ success: true, message: 'Batch production started in background' })
}

export async function GET() {
    return NextResponse.json({ message: 'Use POST to trigger the Production Batch' })
}
