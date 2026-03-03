import { NextResponse } from 'next/server'
import { supabaseAdmin, logSystem } from '@/lib/supabase'

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

        const batchSize = item.batch_size || 4

        // 1. Fetch dependencies to build the final prompt
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
        const struct = item.prompt_structure || {}

        // 2. Clear old pending/failed/processing jobs for these types to avoid duplicates
        const typesToDelete = mode === 'ALL' ? ['SFW', 'NSFW'] : [mode]
        await supabaseAdmin
            .from('production_jobs')
            .delete()
            .in('image_type', typesToDelete)
            .eq('content_item_id', contentId)

        // 3. Build & Queue New Jobs
        const jobsToInsert = []

        for (let i = 0; i < batchSize; i++) {
            const pose = struct.poses?.[i] || ''
            const camera = struct.camera_settings?.[i] || ''
            
            const partsCore = [
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

            if (mode === 'ALL' || mode === 'SFW') {
                const finalPrompt = `${basePos}${Array.from(new Set(partsCore.filter(p => p && String(p).trim() !== ''))).join(', ')}`
                jobsToInsert.push({
                    content_item_id: contentId,
                    status: 'Pending',
                    image_type: 'SFW',
                    slot_index: i,
                    prompt_text: finalPrompt
                })
            }

            if (mode === 'ALL' || mode === 'NSFW') {
                const partsNsfw = [...partsCore, struct.nsfw_prompts?.[i] || '']
                const finalPromptNsfw = `${basePos}${Array.from(new Set(partsNsfw.filter(p => p && String(p).trim() !== ''))).join(', ')}`
                jobsToInsert.push({
                    content_item_id: contentId,
                    status: 'Pending',
                    image_type: 'NSFW',
                    slot_index: i,
                    prompt_text: finalPromptNsfw
                })
            }
        }

        if (jobsToInsert.length > 0) {
            const { error: insertError } = await supabaseAdmin
                .from('production_jobs')
                .insert(jobsToInsert)

            if (insertError) throw insertError
        }

        // 4. Update parent item to 'In Production' so UI knows it is generating again
        await supabaseAdmin
            .from('content_items')
            .update({ status: 'In Production' })
            .eq('id', contentId)

        await logSystem('INFO', 'Regen Queue', `Batch regeneration scheduled for item ${contentId} (Mode: ${mode}) via queue.`)

        return NextResponse.json({ success: true, message: `Batch ${mode} image generation queued!`, queuedCount: jobsToInsert.length })
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 })
    }
}
