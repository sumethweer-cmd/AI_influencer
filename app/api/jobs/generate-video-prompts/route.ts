import { NextResponse } from 'next/server'
import { generateVideoPrompts } from '@/lib/gemini'

export async function POST(req: Request) {
    try {
        const { imageId, basePrompt, imageType } = await req.json()
        
        if (!imageId || !basePrompt) {
            return NextResponse.json({ success: false, error: 'Missing required parameters' }, { status: 400 })
        }

        const prompts = await generateVideoPrompts(basePrompt, imageType || 'SFW')

        return NextResponse.json({ success: true, prompts })
    } catch (error: any) {
        console.error('Error generating video prompts:', error)
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
