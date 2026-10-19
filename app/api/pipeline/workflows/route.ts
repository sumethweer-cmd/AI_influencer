import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { adminGuard } from '@/lib/adminGuard'

// RunningHub workflows the Content page can send to (table pipeline_render_workflows).
//   GET    -> list (default first)
//   POST   -> { name, workflowId (id or full runninghub.ai/workflow/<id> URL), nodeEditor?, nodeProject?, isDefault?, note? }
//   PATCH  -> { id, makeDefault? , name?, nodeEditor?, nodeProject?, note? }
//   DELETE -> { id }
export const dynamic = 'force-dynamic'

const parseWorkflowId = (v: unknown): string | null => {
    const m = String(v ?? '').match(/(\d{8,})/)
    return m ? m[1] : null
}
const noKey = () => NextResponse.json({ success: false, error: 'SUPABASE_SERVICE_ROLE_KEY is not set on the server' }, { status: 500 })
const fail = (e: unknown, status = 500) =>
    NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status })

export async function GET() {
    try {
        if (!supabaseAdmin) return noKey()
        const { data, error } = await supabaseAdmin
            .from('pipeline_render_workflows')
            .select('id,name,provider,workflow_id,node_editor,node_project,megapixel_mode,is_default,note,created_at')
            .order('is_default', { ascending: false })
            .order('created_at', { ascending: false })
        if (error) throw error
        return NextResponse.json({ success: true, workflows: data })
    } catch (e) {
        return fail(e)
    }
}

export async function POST(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        if (!supabaseAdmin) return noKey()
        const b = await req.json().catch(() => ({}))
        const workflowId = parseWorkflowId(b.workflowId)
        if (!b.name || !workflowId) return NextResponse.json({ success: false, error: 'ต้องมีชื่อ และ workflow id (ตัวเลขยาว หรือลิงก์ของ workflow)' }, { status: 400 })

        const { count } = await supabaseAdmin.from('pipeline_render_workflows').select('id', { count: 'exact', head: true })
        const makeDefault = b.isDefault === true || !count // the first one becomes the default
        if (makeDefault) await supabaseAdmin.from('pipeline_render_workflows').update({ is_default: false }).eq('is_default', true)

        const { data, error } = await supabaseAdmin
            .from('pipeline_render_workflows')
            .insert({
                name: String(b.name).slice(0, 80),
                workflow_id: workflowId,
                node_editor: String(b.nodeEditor || '26'),
                node_project: String(b.nodeProject || '17'),
                megapixel_mode: b.megapixelMode === true,
                is_default: makeDefault,
                note: b.note ? String(b.note).slice(0, 300) : null,
            })
            .select()
            .single()
        if (error) throw error
        return NextResponse.json({ success: true, workflow: data })
    } catch (e) {
        return fail(e)
    }
}

export async function PATCH(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        if (!supabaseAdmin) return noKey()
        const b = await req.json().catch(() => ({}))
        if (!b.id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
        if (b.makeDefault) await supabaseAdmin.from('pipeline_render_workflows').update({ is_default: false }).eq('is_default', true)
        const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
        if (b.makeDefault) patch.is_default = true
        if (typeof b.name === 'string' && b.name.trim()) patch.name = b.name.trim().slice(0, 80)
        if (b.nodeEditor) patch.node_editor = String(b.nodeEditor)
        if (b.nodeProject) patch.node_project = String(b.nodeProject)
        if (typeof b.note === 'string') patch.note = b.note.slice(0, 300)
        const { error } = await supabaseAdmin.from('pipeline_render_workflows').update(patch).eq('id', b.id)
        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (e) {
        return fail(e)
    }
}

export async function DELETE(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        if (!supabaseAdmin) return noKey()
        const b = await req.json().catch(() => ({}))
        if (!b.id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
        const { error } = await supabaseAdmin.from('pipeline_render_workflows').delete().eq('id', b.id)
        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (e) {
        return fail(e)
    }
}
