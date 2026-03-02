import { NextResponse } from 'next/server'
import { supabaseAdmin, logSystem } from '@/lib/supabase'
import { sendNotification } from '@/lib/telegram'

// Force schema refresh

export async function POST(request: Request) {
    try {
        const { itemIds } = await request.json()
        if (!itemIds || itemIds.length === 0) {
            return NextResponse.json({ success: false, error: 'No items provided' }, { status: 400 })
        }

        // 1. Fetch all items with their structures and workflows
        const { data: items, error: fetchError } = await supabaseAdmin
            .from('content_items')
            .select('*')
            .in('id', itemIds)

        if (fetchError || !items) throw fetchError || new Error('Failed to fetch items');

        // 2. Fetch all unique personas and workflows involved
        const personas = Array.from(new Set(items.map(i => i.persona).filter(Boolean)))
        const { data: personaData } = await supabaseAdmin
            .from('ai_personas')
            .select('name, trigger_word')
            .in('name', personas)

        const { data: workflows } = await supabaseAdmin
            .from('comfyui_workflows')
            .select('*')

        // 3. Create Production Jobs ( Granular - per Image )
        const jobsToInsert: any[] = []
        
        for (const item of items) {
            const persona = personaData?.find(p => p.name === item.persona)
            const trigger = persona?.trigger_word || ''
            
            // Determine workflow
            let selectedWf = workflows?.find(w => w.id === item.selected_workflow_id)
            if (!selectedWf) {
                const personaMatches = workflows?.filter(w => w.persona === item.persona)
                selectedWf = (personaMatches?.length ? personaMatches : workflows!)?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
            }

            const basePos = selectedWf?.base_positive_prompt ? `${selectedWf.base_positive_prompt}, ` : ''
            const struct = item.prompt_structure || {}
            const batchSize = item.batch_size || 4

            // Create SFW Jobs
            if (item.gen_sfw) {
                for (let i = 0; i < batchSize; i++) {
                    const pose = struct.poses?.[i] || ''
                    const camera = struct.camera_settings?.[i] || ''
                    const parts = [
                        trigger,
                        struct.mood_and_tone,
                        struct.vibe,
                        struct.lighting,
                        struct.outfit,
                        camera,
                        pose
                    ].filter(p => p && String(p).trim() !== '')
                    
                    const finalPrompt = `${basePos}${Array.from(new Set(parts)).join(', ')}`

                    jobsToInsert.push({
                        content_item_id: item.id,
                        status: jobsToInsert.length === 0 ? 'Queued' : 'Pending', // First one is Queued, others are Pending
                        image_type: 'SFW',
                        slot_index: i,
                        prompt_text: finalPrompt
                    })
                }
            }

            // Create NSFW Jobs
            if (item.gen_nsfw) {
                for (let i = 0; i < batchSize; i++) {
                    // ... same logic ...
                    const pose = struct.poses?.[i] || ''
                    const camera = struct.camera_settings?.[i] || ''
                    const nsfwPrompt = struct.nsfw_prompts?.[i] || ''
                    const parts = [
                        trigger,
                        struct.mood_and_tone,
                        struct.vibe,
                        struct.lighting,
                        struct.outfit,
                        camera,
                        pose,
                        nsfwPrompt
                    ].filter(p => p && String(p).trim() !== '')
                    
                    const finalPrompt = `${basePos}${Array.from(new Set(parts)).join(', ')}`

                    jobsToInsert.push({
                        content_item_id: item.id,
                        status: jobsToInsert.length === 0 ? 'Queued' : 'Pending',
                        image_type: 'NSFW',
                        slot_index: i,
                        prompt_text: finalPrompt
                    })
                }
            }
        }

        if (jobsToInsert.length > 0) {
            const { error: insertError } = await supabaseAdmin
                .from('production_jobs')
                .insert(jobsToInsert)
            
            if (insertError) throw insertError;
        }

        // 4. Update parent items to 'In Production'
        await supabaseAdmin
            .from('content_items')
            .update({ status: 'In Production' })
            .in('id', itemIds)

        await logSystem('SUCCESS', 'Phase 1.5: Confirm Plan', `Created ${jobsToInsert.length} granular production jobs for ${itemIds.length} items.`)
        await sendNotification(`⚙️ <b>Job Queue:</b> Created ${jobsToInsert.length} production jobs. Worker started!`)

        return NextResponse.json({ success: true, jobCount: jobsToInsert.length })
    } catch (e: any) {
        console.error('API Error:', e)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
