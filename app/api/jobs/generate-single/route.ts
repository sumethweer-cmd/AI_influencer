import { NextResponse } from 'next/server'
import { refillSinglePrompt } from '@/lib/gemini'
import { supabaseAdmin, logSystem } from '@/lib/supabase'

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

        // 2. Fetch dependencies to build the final prompt
        let personaTrigger = ''
        if (item.persona) {
            const { data: personaData } = await supabaseAdmin
                .from('ai_personas')
                .select('trigger_word')
                .eq('name', item.persona)
                .single()
            if (personaData) personaTrigger = personaData.trigger_word || ''
        }

        const { data: workflows } = await supabaseAdmin.from('comfyui_workflows').select('*')
        let selectedWf = workflows?.find((w: any) => w.id === item.selected_workflow_id)
        if (!selectedWf) {
            const personaMatches = workflows?.filter((w: any) => w.persona === item.persona)
            selectedWf = (personaMatches?.length ? personaMatches : workflows!)?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
        }
        
        const basePos = selectedWf?.base_positive_prompt ? `${selectedWf.base_positive_prompt}, ` : ''
        const struct = newPromptStructure || {}

        const pose = struct.poses?.[index] || ''
        const camera = struct.camera_settings?.[index] || ''
        const parts = [
            personaTrigger,
            struct.mood_and_tone,
            struct.vibe,
            struct.time_of_day,
            struct.location,
            struct.lighting,
            struct.outfit,
            camera,
            pose
        ]
        
        if (type === 'NSFW') {
            const nsfwPrompt = struct.nsfw_prompts?.[index] || ''
            parts.push(nsfwPrompt)
        }

        const finalPrompt = `${basePos}${Array.from(new Set(parts.filter(p => p && String(p).trim() !== ''))).join(', ')}`

        // 3. Queue Job: delete old jobs for this specific slot to keep 'count' accurate
        await supabaseAdmin
            .from('production_jobs')
            .delete()
            .match({ content_item_id: contentId, slot_index: index, image_type: type })

        const { error: insertError } = await supabaseAdmin
            .from('production_jobs')
            .insert({
                content_item_id: contentId,
                status: 'Pending',
                image_type: type,
                slot_index: index,
                prompt_text: finalPrompt
            })

        if (insertError) throw insertError

        // 4. Update parent item to 'In Production' so UI knows it is generating again
        await supabaseAdmin
            .from('content_items')
            .update({ status: 'In Production' })
            .eq('id', contentId)

        await logSystem('INFO', 'Regen Queue', `Regeneration scheduled for item ${contentId} (Slot ${index}, ${type}) via queue.`)

        return NextResponse.json({ success: true, message: 'Regeneration job added to queue' })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
