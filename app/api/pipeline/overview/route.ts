import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

// Read-only overview for /dashboard/pipeline: one entry per content (the
// main row = segment 1), its segments, and its render tasks (RunningHub /
// RunPod ledger). render_tasks has RLS on with no policies, so it can only
// be read with the service-role key, i.e. here on the server.
export const dynamic = 'force-dynamic'

const ITEM_COLUMNS =
    'id,character,title,model,platform,delivery_format,status,note,scheduled_date,segment_number,parent_content_item_id,created_at,compiled_prompt'

export async function GET() {
    try {
        if (!supabaseAdmin) {
            return NextResponse.json(
                { success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server' },
                { status: 500 }
            )
        }

        const { data: items, error: itemsErr } = await supabaseAdmin
            .from('pipeline_content_items')
            .select(ITEM_COLUMNS)
            .order('created_at', { ascending: false })
            .limit(1000)
        if (itemsErr) throw itemsErr

        const { data: tasks, error: tasksErr } = await supabaseAdmin
            .from('render_tasks')
            .select(
                'id,provider,job_id,content_item_id,project_name,status,submitted_at,running_at,finished_at,run_seconds,coins,segments,seg_from,seg_count,file_url,downloaded,local_path,error,note'
            )
            .order('submitted_at', { ascending: false })
            .limit(1000)
        if (tasksErr) throw tasksErr

        const { data: slotRows, error: slotErr } = await supabaseAdmin
            .from('pipeline_assets')
            .select('content_item_id,picture_slot,label,url')
            .not('content_item_id', 'is', null)
            .not('picture_slot', 'is', null)
        if (slotErr) throw slotErr
        const picsByItem = new Map<string, Record<number, { label: string; url: string }>>()
        for (const a of slotRows || []) {
            const m = picsByItem.get(a.content_item_id) || {}
            m[a.picture_slot] = { label: a.label, url: a.url }
            picsByItem.set(a.content_item_id, m)
        }

        const children = new Map<string, any[]>()
        for (const it of items || []) {
            if (it.parent_content_item_id) {
                const list = children.get(it.parent_content_item_id) || []
                list.push(it)
                children.set(it.parent_content_item_id, list)
            }
        }

        const tasksByItem = new Map<string, any[]>()
        for (const t of tasks || []) {
            if (!t.content_item_id) continue
            const list = tasksByItem.get(t.content_item_id) || []
            list.push(t)
            tasksByItem.set(t.content_item_id, list)
        }

        const contents = (items || [])
            .filter((it: any) => !it.parent_content_item_id)
            .map((main: any) => {
                const segs = [main, ...(children.get(main.id) || [])]
                    .sort((a, b) => (a.segment_number || 1) - (b.segment_number || 1))
                    .map((s) => ({
                        id: s.id,
                        segment_number: s.segment_number || 1,
                        title: s.title,
                        status: s.status,
                        compiled_prompt: s.compiled_prompt,
                    }))
                return {
                    id: main.id,
                    title: main.title,
                    character: main.character,
                    model: main.model,
                    platform: main.platform,
                    delivery_format: main.delivery_format,
                    status: main.status,
                    note: main.note,
                    scheduled_date: main.scheduled_date,
                    created_at: main.created_at,
                    pics: picsByItem.get(main.id) || {},
                    segments: segs,
                    render_tasks: tasksByItem.get(main.id) || [],
                }
            })

        // Tasks not linked to any content (sent without --pull <id>): still show them.
        const linked = new Set(contents.map((c: any) => c.id))
        const orphanTasks = (tasks || []).filter((t: any) => !t.content_item_id || !linked.has(t.content_item_id))

        return NextResponse.json({ success: true, contents, orphanTasks })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
