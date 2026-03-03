import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { regenerateContentPrompts } from '@/lib/gemini'

export async function POST(req: Request) {
    try {
        const { contentId, mode } = await req.json()
        if (!contentId || !mode) return NextResponse.json({ success: false, error: 'Missing params' }, { status: 400 })

        const { data: item, error: fetchError } = await supabaseAdmin
            .from('content_items')
            .select('*')
            .eq('id', contentId)
            .single()

        if (fetchError || !item) return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 })

        const newPromptStructure = await regenerateContentPrompts(item, mode)

        const { error: updateError } = await supabaseAdmin
            .from('content_items')
            .update({
                prompt_structure: newPromptStructure
            })
            .eq('id', contentId)

        if (updateError) throw updateError

        return NextResponse.json({ success: true, data: newPromptStructure })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
