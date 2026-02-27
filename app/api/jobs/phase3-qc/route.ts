import { NextResponse } from 'next/server'
import { runQCManager } from '@/jobs/qc-manager'

export async function POST() {
    const result = await runQCManager()

    if (result.success) {
        return NextResponse.json(result)
    } else {
        return NextResponse.json(result, { status: 500 })
    }
}

export async function GET() {
    return NextResponse.json({ message: 'Use POST to trigger the QC Manager' })
}
