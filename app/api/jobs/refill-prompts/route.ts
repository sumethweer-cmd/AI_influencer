import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { refillPromptStructure } from '@/lib/gemini'

export async function POST(req: Request) {
    try {
        const { contentId, targetBatchSize } = await req.json()
        if (!contentId || !targetBatchSize) return NextResponse.json({ success: false, error: 'Missing params' }, { status: 400 })

        const { data: item, error: fetchError } = await supabaseAdmin
            .from('content_items')
            .select('*')
            .eq('id', contentId)
            .single()

        if (fetchError || !item) return NextResponse.json({ success: false, error: 'Item not found' }, { status: 404 })

        const newPromptStructure = await refillPromptStructure(item, targetBatchSize)

        const { error: updateError } = await supabaseAdmin
            .from('content_items')
            .update({
                prompt_structure: newPromptStructure,
                batch_size: targetBatchSize
            })
            .eq('id', contentId)

        if (updateError) throw updateError

        return NextResponse.json({ success: true, data: newPromptStructure })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
