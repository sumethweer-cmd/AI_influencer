import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { adminGuard } from '@/lib/adminGuard'
import { rhCreate, rhUploadImage, type NodeInfo } from '@/lib/runninghub'
import { buildTrackData, DEFAULT_SEG_FRAMES, unshiftTimestamps, cleanPrompt } from '@/lib/trackData'

// Sends a content (all segments) or a subset of its segments (repair) to RunningHub as ONE task.
// THIS SPENDS COINS once RunningHub runs it, so it requires { confirm: true } and (when set)
// the PIPELINE_ADMIN_TOKEN header. Pictures come from the content's Picture slots.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const slug = (s: string) =>
    (s || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'content'

type Row = {
    id: string
    title: string | null
    note: string | null
    compiled_prompt: string | null
    segment_number: number | null
    parent_content_item_id: string | null
}

function framesFromNote(note: string | null, count: number): number[] {
    try {
        const f = JSON.parse(note || '{}').frames
        if (Array.isArray(f) && f.length >= count && f.every((n) => Number.isFinite(n) && n > 0)) return f.map(Number)
    } catch {}
    return Array(count).fill(DEFAULT_SEG_FRAMES)
}

export async function POST(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        if (!supabaseAdmin) return NextResponse.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server' }, { status: 500 })
        const body = await req.json().catch(() => ({}))
        if (body.confirm !== true) return NextResponse.json({ success: false, error: 'ต้องยืนยัน (confirm) ก่อนสั่งเจน เพราะเสียเหรียญ' }, { status: 400 })

        // Which workflow: the one picked in the page (body.workflowRowId), else the default row of
        // pipeline_render_workflows, else (legacy) the env variables.
        let workflowId = process.env.RUNNINGHUB_WORKFLOW_ID || ''
        let nodeEditor = process.env.RH_NODE_EDITOR || '26'
        let nodeProject = process.env.RH_NODE_PROJECT || '17'
        {
            const q = supabaseAdmin
                .from('pipeline_render_workflows')
                .select('workflow_id,node_editor,node_project')
                .eq('provider', 'runninghub')
            const { data: wf } = body.workflowRowId ? await q.eq('id', String(body.workflowRowId)).maybeSingle() : await q.eq('is_default', true).maybeSingle()
            if (wf) {
                workflowId = String(wf.workflow_id)
                nodeEditor = String(wf.node_editor)
                nodeProject = String(wf.node_project)
            } else if (body.workflowRowId) {
                return NextResponse.json({ success: false, error: 'ไม่พบ workflow ที่เลือก' }, { status: 400 })
            }
        }
        if (!workflowId) return NextResponse.json({ success: false, error: 'ยังไม่ได้ตั้ง workflow — กดปุ่ม "Workflow" บนหน้า แล้วเพิ่ม workflow id ก่อน' }, { status: 400 })

        const contentId = String(body.contentId || '')
        if (!contentId) return NextResponse.json({ success: false, error: 'contentId is required' }, { status: 400 })

        const { data: rows, error } = await supabaseAdmin
            .from('pipeline_content_items')
            .select('id,title,note,compiled_prompt,segment_number,parent_content_item_id')
            .or(`id.eq.${contentId},parent_content_item_id.eq.${contentId}`)
        if (error) throw error
        const segs = ((rows || []) as Row[]).sort((a, b) => (a.segment_number || 1) - (b.segment_number || 1))
        const main = segs.find((s) => s.id === contentId)
        if (!main) return NextResponse.json({ success: false, error: 'ไม่พบ content' }, { status: 404 })

        const total = segs.length
        const segFrom = Math.max(1, Number(body.segFrom) || 1)
        const segCount = Math.max(1, Number(body.segCount) || total - segFrom + 1)
        const chosen = segs.filter((s) => (s.segment_number || 1) >= segFrom && (s.segment_number || 1) < segFrom + segCount)
        if (!chosen.length) return NextResponse.json({ success: false, error: 'ไม่พบ segment ที่เลือก' }, { status: 400 })
        const isSubset = chosen.length < total
        const allFrames = framesFromNote(main.note, total)

        // The first chosen segment is rendered as a "shot". If it was written as a context segment
        // (segment_number > 1) its timestamps are shifted; undo that unless told not to.
        const unshift = body.unshift !== false && (chosen[0].segment_number || 1) > 1
        const segInputs = chosen.map((s, i) => {
            let prompt = i === 0 && typeof body.prompt === 'string' && body.prompt.trim() ? body.prompt : s.compiled_prompt || ''
            if (!prompt.trim()) throw new Error(`SEG ${s.segment_number} ไม่มี prompt`)
            if (i === 0 && unshift) prompt = unshiftTimestamps(cleanPrompt(prompt))
            return { prompt, frames: allFrames[(s.segment_number || 1) - 1] || DEFAULT_SEG_FRAMES }
        })

        // Pictures from the content's slots; must be 1..k with no gaps (they map to <Picture N>).
        const { data: slots, error: slotErr } = await supabaseAdmin
            .from('pipeline_assets')
            .select('url,label,picture_slot,storage_path')
            .eq('content_item_id', contentId)
            .not('picture_slot', 'is', null)
            .order('picture_slot', { ascending: true })
        if (slotErr) throw slotErr
        const pics = (slots || []) as { url: string; label: string; picture_slot: number; storage_path: string | null }[]
        if (!pics.length || pics[0].picture_slot !== 1) return NextResponse.json({ success: false, error: 'ยังไม่ได้เลือกรูป Picture 1' }, { status: 400 })
        pics.forEach((p, i) => {
            if (p.picture_slot !== i + 1) throw new Error(`รูปต้องเรียง Picture 1, 2, 3 ต่อกัน (ขาด Picture ${i + 1})`)
        })

        // Project name: unique per content, suffixed for repairs.
        const short = contentId.replace(/-/g, '').slice(0, 6)
        let projectName = `${slug(main.title || '')}_${short}`
        if (isSubset) {
            const { count } = await supabaseAdmin
                .from('render_tasks')
                .select('id', { count: 'exact', head: true })
                .eq('content_item_id', contentId)
                .eq('seg_from', segFrom)
                .eq('seg_count', chosen.length)
            projectName += `_seg${segFrom}${chosen.length > 1 ? `-${segFrom + chosen.length - 1}` : ''}_fix${(count || 0) + 1}`
        }

        // 1) upload pictures to RunningHub  2) create the task  3) record it
        const names: string[] = []
        for (let i = 0; i < pics.length; i++) names.push(await rhUploadImage(pics[i].url, `p${i + 1}_${short}.png`))

        const seed = Math.floor(Math.random() * 2 ** 48)
        const nodeInfoList: NodeInfo[] = [
            { nodeId: nodeEditor, fieldName: 'track_data', fieldValue: buildTrackData(segInputs, names) },
            { nodeId: nodeProject, fieldName: 'project_name', fieldValue: projectName },
            { nodeId: nodeProject, fieldName: 'seed', fieldValue: seed },
        ]
        const created = await rhCreate(String(workflowId), nodeInfoList)

        const note = JSON.stringify({
            kind: isSubset ? 'repair' : 'full',
            unshift,
            prompt_snapshot: isSubset ? segInputs.map((s, i) => `--- SEG ${chosen[i].segment_number} ---\n${s.prompt}`).join('\n') : undefined,
        })
        const promptVersion = crypto.createHash('sha1').update(segInputs.map((s) => s.prompt).join('\u0000')).digest('hex').slice(0, 10)
        const { error: insErr } = await supabaseAdmin.from('render_tasks').insert({
            provider: 'runninghub',
            job_id: created.taskId,
            content_item_id: contentId,
            project_name: projectName,
            workflow_id: String(workflowId),
            status: ['QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'].includes(created.status) ? created.status : 'QUEUED',
            segments: chosen.length,
            seg_from: segFrom,
            seg_count: chosen.length,
            total_frames: segInputs.reduce((n, s) => n + s.frames, 0),
            seed,
            prompt_version: promptVersion,
            note,
        })
        if (insErr) {
            // The job IS running at RunningHub; don't lose its id.
            return NextResponse.json(
                { success: false, error: `ส่งงานแล้ว (taskId ${created.taskId}) แต่บันทึกลงตารางไม่สำเร็จ: ${insErr.message}` },
                { status: 500 }
            )
        }

        return NextResponse.json({ success: true, taskId: created.taskId, projectName, segments: chosen.length, kind: isSubset ? 'repair' : 'full' })
    } catch (e: unknown) {
        return NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 })
    }
}
