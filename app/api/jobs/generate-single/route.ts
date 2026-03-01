import { NextResponse } from 'next/server'
import { refillSinglePrompt } from '@/lib/gemini'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
    try {
        const { contentId, index, type, regenPrompt } = await req.json()
        if (!contentId || index === undefined) return NextResponse.json({ success: false, error: 'Missing params' }, { status: 400 })

        const { data: item, error: fetchError } = await supabaseAdmin
            .from('content_items')
            .select('*')
            .eq('id', contentId)
            .single()

        if (fetchError || !item) return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 })

        // 1. Refresh Prompts ONLY if requested
        let newPromptStructure = item.prompt_structure
        if (regenPrompt) {
            newPromptStructure = await refillSinglePrompt(item, index, type)
            // Update DB
            const { error: updateError } = await supabaseAdmin
                .from('content_items')
                .update({ prompt_structure: newPromptStructure })
                .eq('id', contentId)

            if (updateError) throw updateError
        }

        // 3. Trigger actual generation (This will call the existing ComfyUI queue logic)
        // For simplicity, we assume the UI will call /api/jobs/generate-vdo or similar if needed,
        // but typically "Regenerate" implies both prompt refresh AND image generation.
        // We'll trigger the background job here.

        const genRes = await fetch(`${new URL(req.url).origin}/api/jobs/phase2-production`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contentIds: [contentId],
                specificIndex: index,
                forceType: type // Custom param for the generator to know which one to pick
            })
        })

        if (!genRes.ok) throw new Error('Failed to trigger generation')

        return NextResponse.json({ success: true, message: 'Regeneration started' })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
