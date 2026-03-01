import { NextResponse } from 'next/server'
import { getActivePods, deployPod, terminatePod } from '@/lib/runpod'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        const pods = await getActivePods()
        return NextResponse.json({ success: true, data: pods })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function POST(request: Request) {
    try {
        const { action, gpuTypeId, podId } = await request.json()

        if (action === 'start') {
            const newPodId = await deployPod(`nong-kung-agency-${Date.now()}`, gpuTypeId)
            return NextResponse.json({ success: true, data: { podId: newPodId } })
        }

        if (action === 'stop') {
            if (!podId) throw new Error('Pod ID is required to stop.')
            await terminatePod(podId)
            return NextResponse.json({ success: true, message: 'Pod terminated' })
        }

        return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
