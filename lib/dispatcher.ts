import { supabaseAdmin } from '@/lib/supabase'
import { activeJobIds, refreshTasks } from '@/lib/refreshTasks'
import { sendContent, SendError, type SendOpts } from '@/lib/sendJob'

// Auto dispatcher: every tick (pg_cron, every 30 min, only while enabled) it
//   1) refreshes the status of unfinished RunningHub tasks (free),
//   2) sends waiting contents from pipeline_send_queue one by one until RunningHub answers
//      TASK_QUEUE_MAXED (no fixed limit is assumed), a per-tick safety limit or the optional daily limit is hit,
//   3) switches itself off (and removes the cron job) when nothing is waiting and nothing is running.
// Tables/functions: supabase/migrations/20261019010000_pipeline_auto_dispatch.sql

const MAX_ATTEMPTS = 3

export type Settings = {
    enabled: boolean
    max_per_tick: number
    daily_limit: number | null
    site_url: string | null
    last_tick_at: string | null
    last_note: string | null
}

const db = () => {
    if (!supabaseAdmin) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set on the server')
    return supabaseAdmin
}

export async function getSettings(): Promise<Settings> {
    const { data, error } = await db()
        .from('pipeline_dispatcher_settings')
        .select('enabled,max_per_tick,daily_limit,site_url,last_tick_at,last_note')
        .eq('id', 1)
        .single()
    if (error) throw error
    return data as Settings
}

/** Only a real deployed https origin can be called by the database. */
export function validSiteUrl(url: unknown): string | null {
    try {
        const u = new URL(String(url))
        if (u.protocol !== 'https:') return null
        if (u.hostname === 'localhost' || u.hostname.endsWith('.localhost') || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname)) return null
        return u.origin
    } catch {
        return null
    }
}

export async function setEnabled(enabled: boolean, siteUrl?: string | null) {
    const settings = await getSettings()
    const url = enabled ? validSiteUrl(siteUrl) || validSiteUrl(settings.site_url) : settings.site_url
    if (enabled && !url) throw new Error('เปิดตัวส่งอัตโนมัติได้เฉพาะจากเว็บจริง (https) ไม่ใช่ localhost')
    const { error } = await db().rpc('pipeline_dispatcher_schedule', { p_enabled: enabled, p_url: url || '' })
    if (error) throw error
    const { error: upErr } = await db()
        .from('pipeline_dispatcher_settings')
        .update({ enabled, site_url: url, updated_at: new Date().toISOString() })
        .eq('id', 1)
    if (upErr) throw upErr
}

export async function verifyCronSecret(secret: string | null): Promise<boolean> {
    if (!secret) return false
    const { data, error } = await db().rpc('pipeline_verify_cron_secret', { s: secret })
    return !error && data === true
}

export type TickResult = {
    skipped?: string
    activeBefore?: number
    sent?: number
    queueMaxed?: boolean
    waitingLeft?: number
    activeNow?: number
    switchedOff?: boolean
    note: string
}

export async function runTick(manual: boolean): Promise<TickResult> {
    const settings = await getSettings()
    if (!settings.enabled && !manual) return { skipped: 'disabled', note: 'dispatcher is off' }

    // 1) refresh unfinished tasks
    const before = await activeJobIds()
    for (let i = 0; i < before.length; i += 5) await refreshTasks(before.slice(i, i + 5))
    let active = (await activeJobIds()).length

    // 2) send waiting contents
    const { data: waiting, error: wErr } = await db()
        .from('pipeline_send_queue')
        .select('id,content_item_id,workflow_row_id,attempts,opts')
        .eq('status', 'waiting')
        .order('enqueued_at', { ascending: true })
        .limit(50)
    if (wErr) throw wErr

    const dayStart = new Date()
    dayStart.setUTCHours(0, 0, 0, 0)
    const { count: sentToday } = await db()
        .from('pipeline_send_queue')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'sent')
        .gte('sent_at', dayStart.toISOString())

    let sent = 0
    let queueMaxed = false
    const notes: string[] = []
    for (const item of waiting || []) {
        if (sent >= settings.max_per_tick) {
            notes.push(`per-tick limit ${settings.max_per_tick}`)
            break
        }
        if (settings.daily_limit != null && (sentToday || 0) + sent >= settings.daily_limit) {
            notes.push(`daily limit ${settings.daily_limit}`)
            break
        }
        // never send the same content twice (repairs / re-renders carry opts and are deliberate)
        const { count: already } = item.opts ? { count: 0 } : await db()
            .from('render_tasks')
            .select('id', { count: 'exact', head: true })
            .eq('content_item_id', item.content_item_id)
            .eq('seg_from', 1)
            .in('status', ['QUEUED', 'RUNNING', 'SUCCESS'])
        if (already) {
            await db().from('pipeline_send_queue').update({ status: 'cancelled', last_error: 'already sent' }).eq('id', item.id)
            continue
        }
        try {
            const o = (item.opts || {}) as Partial<SendOpts>
            const r = await sendContent({ ...o, contentId: item.content_item_id, workflowRowId: item.workflow_row_id || undefined })
            await db()
                .from('pipeline_send_queue')
                .update({ status: 'sent', task_job_id: r.taskId, sent_at: new Date().toISOString(), attempts: item.attempts + 1, last_error: null })
                .eq('id', item.id)
            sent++
            active++
        } catch (e) {
            if (e instanceof SendError && e.queueMaxed) {
                queueMaxed = true
                notes.push(`RunningHub queue full with ${active} unfinished task(s)`)
                break
            }
            const attempts = item.attempts + 1
            await db()
                .from('pipeline_send_queue')
                .update({ attempts, last_error: (e instanceof Error ? e.message : String(e)).slice(0, 300), status: attempts >= MAX_ATTEMPTS ? 'failed' : 'waiting' })
                .eq('id', item.id)
            notes.push(`error on ${item.content_item_id.slice(0, 6)} (attempt ${attempts})`)
        }
    }

    // 3) switch off when idle
    const { count: waitingLeft } = await db().from('pipeline_send_queue').select('id', { count: 'exact', head: true }).eq('status', 'waiting')
    const activeNow = (await activeJobIds()).length
    let switchedOff = false
    if (!waitingLeft && !activeNow && settings.enabled) {
        await setEnabled(false)
        switchedOff = true
        notes.push('idle: dispatcher switched off and cron removed')
    }

    const note = `sent ${sent}${notes.length ? '; ' + notes.join('; ') : ''}`
    await db().from('pipeline_dispatch_log').insert({ active_before: before.length, sent, queue_maxed: queueMaxed, note })
    await db().from('pipeline_dispatcher_settings').update({ last_tick_at: new Date().toISOString(), last_note: note }).eq('id', 1)
    return { activeBefore: before.length, sent, queueMaxed, waitingLeft: waitingLeft || 0, activeNow, switchedOff, note }
}

export async function enqueue(contentIds: string[], workflowRowId?: string, opts?: Record<string, unknown> | null) {
    const result = { queued: [] as string[], skipped: [] as { id: string; reason: string }[] }
    for (const id of contentIds) {
        const { data: dupe } = await db().from('pipeline_send_queue').select('id,opts').eq('content_item_id', id).eq('status', 'waiting').limit(5)
        const sameKind = (dupe || []).some((q: { opts?: { segFrom?: number } | null }) => (opts ? q.opts?.segFrom === (opts as { segFrom?: number }).segFrom : !q.opts))
        if (sameKind) { result.skipped.push({ id, reason: 'อยู่ในคิวแล้ว' }); continue }
        const { count: pic1 } = await db()
            .from('pipeline_assets')
            .select('id', { count: 'exact', head: true })
            .eq('content_item_id', id)
            .eq('picture_slot', 1)
        if (!pic1) { result.skipped.push({ id, reason: 'ยังไม่ได้เลือกรูป Picture 1' }); continue }
        const { error } = await db().from('pipeline_send_queue').insert({ content_item_id: id, workflow_row_id: workflowRowId || null, opts: opts || null })
        if (error) { result.skipped.push({ id, reason: error.message }); continue }
        result.queued.push(id)
    }
    return result
}
