import { NextResponse } from 'next/server'
import { generateVideoFromImage } from '@/jobs/video-generator'

export async function POST(request: Request) {
    try {
        const { imageId, vdo_prompt } = await request.json()

        if (!imageId) {
            return NextResponse.json({ success: false, error: 'Missing imageId' }, { status: 400 })
        }

        // We run it asynchrously or synchronously? 
        // For 1:1, we probably want to return quickly and let it run in background, 
        // but the UI expects a queue status.

        // Let's run it and return the promise status indirectly via DB
        generateVideoFromImage(imageId, vdo_prompt).catch(err => {
            console.error('Background Video Job Failed:', err)
        })

        return NextResponse.json({ success: true, message: 'Video generation queued' })
    } catch (e: any) {
        console.error('Video API error:', e)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
