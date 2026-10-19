import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { adminGuard } from '@/lib/adminGuard'
import { enqueue, getSettings, runTick, setEnabled, validSiteUrl, type TickResult } from '@/lib/dispatcher'

// Send queue + dispatcher switch used by the Content page.
//   GET    -> { settings, waiting[], recentLog[] }
//   POST   -> { contentIds[], workflowRowId?, siteUrl? }   add to the queue and switch the dispatcher on
//   PATCH  -> { enabled?, siteUrl?, dailyLimit?, maxPerTick? }   switch on/off, set limits
//   DELETE -> { id }   remove a waiting item
export const dynamic = 'force-dynamic'
export const maxDuration = 60

const fail = (e: unknown, status = 500) => NextResponse.json({ success: false, error: e instanceof Error ? e.message : String(e) }, { status })

export async function GET() {
    try {
        if (!supabaseAdmin) return fail(new Error('SUPABASE_SERVICE_ROLE_KEY is not set on the server'))
        const settings = await getSettings()
        const { data: waiting } = await supabaseAdmin
            .from('pipeline_send_queue')
            .select('id,content_item_id,status,attempts,last_error,enqueued_at,sent_at,task_job_id,opts')
            .in('status', ['waiting', 'failed'])
            .order('enqueued_at', { ascending: true })
        const { data: recentLog } = await supabaseAdmin.from('pipeline_dispatch_log').select('at,active_before,sent,queue_maxed,note').order('id', { ascending: false }).limit(10)
        return NextResponse.json({ success: true, settings, waiting: waiting || [], recentLog: recentLog || [] })
    } catch (e) {
        return fail(e)
    }
}

export async function POST(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        const b = await req.json().catch(() => ({}))
        const ids: string[] = Array.isArray(b.contentIds) ? b.contentIds.map(String) : []
        if (!ids.length) return NextResponse.json({ success: false, error: 'contentIds is required' }, { status: 400 })
        const result = await enqueue(ids, b.workflowRowId ? String(b.workflowRowId) : undefined, b.opts && typeof b.opts === 'object' ? b.opts : null)
        let dispatcher: 'started' | 'not_started' | 'already_on' = 'not_started'
        let warning: string | undefined
        if (result.queued.length) {
            const settings = await getSettings()
            if (settings.enabled) dispatcher = 'already_on'
            else if (validSiteUrl(b.siteUrl) || validSiteUrl(settings.site_url)) {
                await setEnabled(true, b.siteUrl)
                dispatcher = 'started'
            } else warning = 'เข้าคิวแล้ว แต่ยังไม่เปิดตัวส่งอัตโนมัติ: ต้องเปิดหน้านี้จากเว็บจริง (https) ไม่ใช่ localhost'
        }
        // a lane may be free right now: do one tick immediately instead of waiting for the next minute
        let tick: TickResult | undefined
        if (result.queued.length && dispatcher !== 'not_started') {
            try {
                tick = await runTick(false)
            } catch (e) {
                warning = (warning ? warning + ' · ' : '') + 'เข้าคิวแล้ว แต่ลองส่งทันทีไม่สำเร็จ: ' + (e instanceof Error ? e.message : String(e))
            }
        }
        return NextResponse.json({ success: true, ...result, dispatcher, warning, tick })
    } catch (e) {
        return fail(e)
    }
}

export async function PATCH(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        if (!supabaseAdmin) return fail(new Error('SUPABASE_SERVICE_ROLE_KEY is not set on the server'))
        const b = await req.json().catch(() => ({}))
        const patch: Record<string, unknown> = {}
        if (b.dailyLimit !== undefined) patch.daily_limit = b.dailyLimit === null || b.dailyLimit === '' ? null : Math.max(0, Number(b.dailyLimit))
        if (b.maxPerTick !== undefined) patch.max_per_tick = Math.min(10, Math.max(1, Number(b.maxPerTick) || 3))
        if (Object.keys(patch).length) await supabaseAdmin.from('pipeline_dispatcher_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)
        if (typeof b.enabled === 'boolean') await setEnabled(b.enabled, b.siteUrl)
        return NextResponse.json({ success: true, settings: await getSettings() })
    } catch (e) {
        return fail(e)
    }
}

export async function DELETE(req: Request) {
    const denied = adminGuard(req)
    if (denied) return denied
    try {
        if (!supabaseAdmin) return fail(new Error('SUPABASE_SERVICE_ROLE_KEY is not set on the server'))
        const b = await req.json().catch(() => ({}))
        if (!b.id) return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 })
        const { error } = await supabaseAdmin.from('pipeline_send_queue').update({ status: 'cancelled' }).eq('id', b.id).eq('status', 'waiting')
        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (e) {
        return fail(e)
    }
}
