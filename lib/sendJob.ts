import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { rhCreate, rhUploadImage, type NodeInfo } from '@/lib/runninghub'
import { buildTrackData, DEFAULT_RESOLUTION, DEFAULT_SEG_FRAMES, parseRenderSettings, planSegments, WORKFLOW_RESOLUTION, type Continuity } from '@/lib/trackData'

// Sends a content (all segments) or a subset of its segments (repair) to RunningHub as ONE task and
// records it in render_tasks. Used by /api/pipeline/send (button) and /api/pipeline/dispatch (auto).
// THIS SPENDS COINS once RunningHub runs the task. Callers are responsible for confirmation/auth.

export class SendError extends Error {
    status: number
    queueMaxed: boolean
    constructor(message: string, status = 500) {
        super(message)
        this.status = status
        this.queueMaxed = message.includes('TASK_QUEUE_MAXED')
    }
}

export type SendOpts = {
    contentId: string
    workflowRowId?: string
    segFrom?: number
    segCount?: number
    prompt?: string // replaces the first chosen segment's prompt (repair dialog)
    unshift?: boolean
    continuity?: Record<string, Continuity> // overrides the saved per-segment setting
    resolution?: string | null // overrides the saved resolution; '' or 'workflow' = leave the workflow's own value
    dryRun?: boolean // build everything but do NOT upload/create at RunningHub (free preview)
}
export type SendPreview = {
    resolution: string | null
    nodeEditor: string
    nodeProject: string
    workflowId: string
    pictures: number
    segments: { segment: number; continuity: string; task_mode: string; ref_image_size: string; frames: number; timestampsShifted: boolean; promptChars: number }[]
}
export type SendResult = { taskId: string; projectName: string; segments: number; kind: 'full' | 'repair'; preview?: SendPreview }

type Row = {
    id: string
    title: string | null
    note: string | null
    compiled_prompt: string | null
    segment_number: number | null
    parent_content_item_id: string | null
}

const slug = (s: string) => (s || 'untitled').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24) || 'content'

function framesFromNote(note: string | null, count: number): number[] {
    try {
        const f = JSON.parse(note || '{}').frames
        if (Array.isArray(f) && f.length >= count && f.every((n) => Number.isFinite(n) && n > 0)) return f.map(Number)
    } catch {}
    return Array(count).fill(DEFAULT_SEG_FRAMES)
}

export async function sendContent(opts: SendOpts): Promise<SendResult> {
    if (!supabaseAdmin) throw new SendError('SUPABASE_SERVICE_ROLE_KEY is not set on the server')

    // Which workflow: the picked row, else the default row, else (legacy) the env variables.
    let workflowId = process.env.RUNNINGHUB_WORKFLOW_ID || ''
    let nodeEditor = process.env.RH_NODE_EDITOR || '26'
    let nodeProject = process.env.RH_NODE_PROJECT || '17'
    {
        const q = supabaseAdmin.from('pipeline_render_workflows').select('workflow_id,node_editor,node_project').eq('provider', 'runninghub')
        const { data: wf } = opts.workflowRowId ? await q.eq('id', String(opts.workflowRowId)).maybeSingle() : await q.eq('is_default', true).maybeSingle()
        if (wf) {
            workflowId = String(wf.workflow_id)
            nodeEditor = String(wf.node_editor)
            nodeProject = String(wf.node_project)
        } else if (opts.workflowRowId) {
            throw new SendError('ไม่พบ workflow ที่เลือก', 400)
        }
    }
    if (!workflowId) throw new SendError('ยังไม่ได้ตั้ง workflow — กดปุ่ม "Workflow" บนหน้า แล้วเพิ่ม workflow id ก่อน', 400)

    const contentId = String(opts.contentId || '')
    if (!contentId) throw new SendError('contentId is required', 400)

    const { data: rows, error } = await supabaseAdmin
        .from('pipeline_content_items')
        .select('id,title,note,compiled_prompt,segment_number,parent_content_item_id')
        .or(`id.eq.${contentId},parent_content_item_id.eq.${contentId}`)
    if (error) throw new SendError(error.message)
    const segs = ((rows || []) as Row[]).sort((a, b) => (a.segment_number || 1) - (b.segment_number || 1))
    const main = segs.find((s) => s.id === contentId)
    if (!main) throw new SendError('ไม่พบ content', 404)

    const total = segs.length
    const segFrom = Math.max(1, Number(opts.segFrom) || 1)
    const segCount = Math.max(1, Number(opts.segCount) || total - segFrom + 1)
    const chosen = segs.filter((s) => (s.segment_number || 1) >= segFrom && (s.segment_number || 1) < segFrom + segCount)
    if (!chosen.length) throw new SendError('ไม่พบ segment ที่เลือก', 400)
    const isSubset = chosen.length < total
    const allFrames = framesFromNote(main.note, total)

    // Continuity per segment (saved on the content, overridable here). The first chosen segment is
    // always a "shot"; a context-written segment rendered as a shot gets its timestamps shifted back.
    const saved = parseRenderSettings(main.note)
    const continuity = { ...saved.continuity, ...(opts.continuity || {}) }
    // explicit override > saved on the content > default (720 x 1280). '' / 'workflow' = send nothing.
    const resolutionRaw = opts.resolution !== undefined && opts.resolution !== null ? opts.resolution : saved.resolution ?? DEFAULT_RESOLUTION
    const resolution = resolutionRaw && resolutionRaw !== WORKFLOW_RESOLUTION ? resolutionRaw.trim() : null
    const plan = planSegments(
        chosen.map((s, i) => {
            const prompt = i === 0 && typeof opts.prompt === 'string' && opts.prompt.trim() ? opts.prompt : s.compiled_prompt || ''
            if (!prompt.trim()) throw new SendError(`SEG ${s.segment_number} ไม่มี prompt`, 400)
            return { segNo: s.segment_number || 1, prompt, frames: allFrames[(s.segment_number || 1) - 1] || DEFAULT_SEG_FRAMES }
        }),
        continuity,
        opts.unshift !== false
    )
    const segInputs = plan.inputs
    const unshift = plan.adjusted.length > 0

    // Pictures from the content's slots; must be 1..k with no gaps (they map to <Picture N>).
    const { data: slots, error: slotErr } = await supabaseAdmin
        .from('pipeline_assets')
        .select('url,label,picture_slot')
        .eq('content_item_id', contentId)
        .not('picture_slot', 'is', null)
        .order('picture_slot', { ascending: true })
    if (slotErr) throw new SendError(slotErr.message)
    const pics = (slots || []) as { url: string; label: string; picture_slot: number }[]
    if (!pics.length || pics[0].picture_slot !== 1) throw new SendError('ยังไม่ได้เลือกรูป Picture 1', 400)
    pics.forEach((p, i) => {
        if (p.picture_slot !== i + 1) throw new SendError(`รูปต้องเรียง Picture 1, 2, 3 ต่อกัน (ขาด Picture ${i + 1})`, 400)
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

    if (opts.dryRun) {
        const td = JSON.parse(buildTrackData(segInputs, pics.map((_, i) => `<Picture ${i + 1}>`)))
        return {
            taskId: '(dry-run: nothing sent)',
            projectName,
            segments: chosen.length,
            kind: isSubset ? 'repair' : 'full',
            preview: {
                resolution: resolution || null,
                nodeEditor,
                nodeProject,
                workflowId: String(workflowId),
                pictures: pics.length,
                segments: td.tracks[0].segments.map((sg: { content: { continuity_mode: string; task_mode: string; ref_image_size: string; user_prompt: string }; start_frame: number; end_frame: number }, i: number) => ({
                    segment: chosen[i].segment_number || i + 1,
                    continuity: sg.content.continuity_mode,
                    task_mode: sg.content.task_mode,
                    ref_image_size: sg.content.ref_image_size,
                    frames: sg.end_frame - sg.start_frame,
                    timestampsShifted: plan.adjusted.includes(chosen[i].segment_number || i + 1),
                    promptChars: sg.content.user_prompt.length,
                })),
            },
        }
    }

    // 1) upload pictures to RunningHub  2) create the task  3) record it
    let created: { taskId: string; status: string }
    const seed = Math.floor(Math.random() * 2 ** 48)
    try {
        const names: string[] = []
        for (let i = 0; i < pics.length; i++) names.push(await rhUploadImage(pics[i].url, `p${i + 1}_${short}.png`))
        const nodeInfoList: NodeInfo[] = [
            { nodeId: nodeEditor, fieldName: 'track_data', fieldValue: buildTrackData(segInputs, names) },
            { nodeId: nodeProject, fieldName: 'project_name', fieldValue: projectName },
            { nodeId: nodeProject, fieldName: 'seed', fieldValue: seed },
        ]
        if (resolution) nodeInfoList.push({ nodeId: nodeEditor, fieldName: 'resolution', fieldValue: resolution })
        created = await rhCreate(String(workflowId), nodeInfoList)
    } catch (e) {
        throw new SendError(e instanceof Error ? e.message : String(e))
    }

    const note = JSON.stringify({
        kind: isSubset ? 'repair' : 'full',
        unshift,
        resolution: resolution || null,
        continuity: segInputs.map((s, i) => `${chosen[i].segment_number}:${s.continuity}`).join(','),
        prompt_snapshot: isSubset ? segInputs.map((s, i) => `--- SEG ${chosen[i].segment_number} ---\n${s.prompt}`).join('\n') : undefined,
    })
    const promptVersion = crypto.createHash('sha1').update(segInputs.map((s) => s.prompt).join('\u0000')).digest('hex').slice(0, 10)
    const status = ['QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'].includes(created.status) ? created.status : 'QUEUED'
    const { error: insErr } = await supabaseAdmin.from('render_tasks').insert({
        provider: 'runninghub',
        job_id: created.taskId,
        content_item_id: contentId,
        project_name: projectName,
        workflow_id: String(workflowId),
        status,
        running_at: status === 'RUNNING' ? new Date().toISOString() : null,
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
        throw new SendError(`ส่งงานแล้ว (taskId ${created.taskId}) แต่บันทึกลงตารางไม่สำเร็จ: ${insErr.message}`)
    }

    return { taskId: created.taskId, projectName, segments: chosen.length, kind: isSubset ? 'repair' : 'full' }
}
