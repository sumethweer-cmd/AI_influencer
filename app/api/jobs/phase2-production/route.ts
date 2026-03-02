import { NextResponse } from 'next/server'
import { supabaseAdmin, logSystem } from '@/lib/supabase'

export const maxDuration = 300; 

export async function POST(req: Request) {
    try {
        const body = await req.json().catch(() => ({}))
        const { contentIds } = body

        if (!contentIds || contentIds.length === 0) {
            return NextResponse.json({ success: false, error: 'No contentIds provided' }, { status: 400 })
        }

        // 1. Fetch items and existing images
        const { data: items, error: fetchErr } = await supabaseAdmin
            .from('content_items')
            .select('*, generated_images(*), production_jobs(*)')
            .in('id', contentIds)

        if (fetchErr || !items || items.length === 0) {
            return NextResponse.json({ success: false, error: 'Items not found' }, { status: 404 })
        }

        // 2. Fetch dependencies
        const personas = Array.from(new Set(items.map((i: any) => i.persona).filter(Boolean)))
        const { data: personaData } = await supabaseAdmin
            .from('ai_personas')
            .select('name, trigger_word')
            .in('name', personas)

        const { data: workflows } = await supabaseAdmin.from('comfyui_workflows').select('*')

        const jobsToInsert: any[] = []

        // 3. Find missing slots and create jobs
        for (const item of items) {
            const batchSize = item.batch_size || 4
            const existingImages = item.generated_images || []
            const existingJobs = item.production_jobs || [] // jobs currently pending/processing
            const struct = item.prompt_structure || {}

            const persona = personaData?.find((p: any) => p.name === item.persona)
            const trigger = persona?.trigger_word || ''

            let selectedWf = workflows?.find((w: any) => w.id === item.selected_workflow_id)
            if (!selectedWf) {
                const personaMatches = workflows?.filter((w: any) => w.persona === item.persona)
                selectedWf = (personaMatches?.length ? personaMatches : workflows!)?.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
            }
            const basePos = selectedWf?.base_positive_prompt ? `${selectedWf.base_positive_prompt}, ` : ''

            const missingSFW = []
            const missingNSFW = []

            for (let i = 0; i < batchSize; i++) {
                // SFW Check
                if (item.gen_sfw) {
                    const hasImage = existingImages.find((img: any) => img.image_type === 'SFW' && img.slot_index === i)
                    const hasActiveJob = existingJobs.find((j: any) => j.image_type === 'SFW' && j.slot_index === i && ['Pending', 'Queued', 'Processing'].includes(j.status))
                    if (!hasImage && !hasActiveJob) missingSFW.push(i)
                }
                // NSFW Check
                if (item.gen_nsfw) {
                    const hasImage = existingImages.find((img: any) => img.image_type === 'NSFW' && img.slot_index === i)
                    const hasActiveJob = existingJobs.find((j: any) => j.image_type === 'NSFW' && j.slot_index === i && ['Pending', 'Queued', 'Processing'].includes(j.status))
                    if (!hasImage && !hasActiveJob) missingNSFW.push(i)
                }
            }

            const buildPrompt = (idx: number, isNsfw: boolean) => {
                const pose = struct.poses?.[idx] || ''
                const camera = struct.camera_settings?.[idx] || ''
                const parts = [trigger, struct.mood_and_tone, struct.vibe, struct.lighting, struct.outfit, camera, pose]
                if (isNsfw) parts.push(struct.nsfw_prompts?.[idx] || '')
                return `${basePos}${Array.from(new Set(parts.filter(p => p && String(p).trim() !== ''))).join(', ')}`
            }

            for (const idx of missingSFW) {
                jobsToInsert.push({ content_item_id: item.id, status: 'Pending', image_type: 'SFW', slot_index: idx, prompt_text: buildPrompt(idx, false) })
            }
            for (const idx of missingNSFW) {
                jobsToInsert.push({ content_item_id: item.id, status: 'Pending', image_type: 'NSFW', slot_index: idx, prompt_text: buildPrompt(idx, true) })
            }
        }

        if (jobsToInsert.length > 0) {
            const { error: insertErr } = await supabaseAdmin.from('production_jobs').insert(jobsToInsert)
            if (insertErr) throw insertErr
        }

        // Update items to In Production again
        await supabaseAdmin.from('content_items').update({ status: 'In Production' }).in('id', contentIds)

        await logSystem('INFO', 'Phase2: Production', `Queued ${jobsToInsert.length} missing jobs for ${contentIds.length} items.`)

        return NextResponse.json({ success: true, queued: jobsToInsert.length })

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function GET() {
    return NextResponse.json({ message: 'Use POST to trigger the Production Batch' })
}
