import { supabaseAdmin } from '@/lib/supabase'
import { refreshTasks } from '@/lib/refreshTasks'
import { taskEtaMs } from '@/lib/trackData'
import { sendContent, SendError, type SendOpts } from '@/lib/sendJob'

// Auto dispatcher with two render lanes (RunningHub runs 2 tasks at once). A lane is free when its task has finished;
// a free lane immediately takes the next waiting content. Instead of a fixed 30-minute tick, every task has an ETA
// (clip length tracks generation time, see RUN_SEC_PER_VIDEO_SEC): pg_cron looks every minute but only calls this route
// when settings.next_tick_at is due, and each tick sets the next due time = the earliest ETA among running tasks.
//   1) refresh (free status call) the tasks that should be finished by now,
//   2) give every free lane the next waiting content until RunningHub answers TASK_QUEUE_MAXED,
//   3) switch itself off (and remove the cron job) when nothing is waiting and nothing is running.
// Tables/functions: supabase/migrations/20261019010000_pipeline_auto_dispatch.sql, 20261019030000_pipeline_lanes_eta.sql

const MAX_ATTEMPTS = 3
const RECHECK_SEC = 90 // after the ETA has passed, look again this often
const BACKOFF_SEC = 180 // RunningHub refused (queue full) or an item failed: try again later

export type Settings = {
    enabled: boolean
    max_per_tick: number
    lanes: number
    next_tick_at: string | null
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
        .select('enabled,max_per_tick,lanes,next_tick_at,daily_limit,site_url,last_tick_at,last_note')
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
    nextTickAt?: string | null
    note: string
}

export type ActiveTask = { id: string; job_id: string; content_item_id: string | null; status: string; submitted_at: string; seg_count: number | null; lane: number | null }

export async function activeTasks(): Promise<ActiveTask[]> {
    const { data, error } = await db()
        .from('render_tasks')
        .select('id,job_id,content_item_id,status,submitted_at,seg_count,lane')
        .eq('provider', 'runninghub')
        .in('status', ['QUEUED', 'RUNNING'])
        .order('submitted_at', { ascending: true })
    if (error) throw error
    return (data || []) as ActiveTask[]
}

export async function runTick(manual: boolean): Promise<TickResult> {
    const settings = await getSettings()
    if (!settings.enabled && !manual) return { skipped: 'disabled', note: 'dispatcher is off' }
    const lanes = Math.max(1, settings.lanes || 2)
    const now = Date.now()

    // 1) refresh the tasks that should be done by now (all of them on a manual tick)
    let active = await activeTasks()
    const before = active.length
    const due = active.filter((t) => manual || now >= taskEtaMs(t)).map((t) => t.job_id)
    for (let i = 0; i < due.length; i += 5) await refreshTasks(due.slice(i, i + 5))
    active = await activeTasks()

    // 2) lanes in use (tasks sent by hand have no lane yet: they take the first free one)
    const used = new Set<number>(active.map((t) => t.lane).filter((l): l is number => !!l))
    for (const t of active) {
        if (t.lane) continue
        let l = 1
        while (used.has(l)) l++
        used.add(l)
        t.lane = l
        await db().from('render_tasks').update({ lane: l }).eq('id', t.id)
    }
    const free = Array.from({ length: lanes }, (_, i) => i + 1).filter((l) => !used.has(l))

    // 3) send waiting contents into the free lanes
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
    let hadError = false
    const notes: string[] = []
    const queue = [...(waiting || [])]
    while (free.length && queue.length) {
        if (settings.daily_limit != null && (sentToday || 0) + sent >= settings.daily_limit) {
            notes.push(`daily limit ${settings.daily_limit}`)
            break
        }
        const item = queue.shift()!
        // never send the same content twice (repairs / re-renders carry opts and are deliberate)
        const { count: already } = item.opts
            ? { count: 0 }
            : await db()
                  .from('render_tasks')
                  .select('id', { count: 'exact', head: true })
                  .eq('content_item_id', item.content_item_id)
                  .eq('seg_from', 1)
                  .in('status', ['QUEUED', 'RUNNING', 'SUCCESS'])
        if (already) {
            await db().from('pipeline_send_queue').update({ status: 'cancelled', last_error: 'already sent' }).eq('id', item.id)
            continue
        }
        const lane = free[0]
        try {
            const o = (item.opts || {}) as Partial<SendOpts>
            const r = await sendContent({ ...o, contentId: item.content_item_id, workflowRowId: item.workflow_row_id || undefined })
            await db().from('render_tasks').update({ lane }).eq('job_id', r.taskId)
            await db()
                .from('pipeline_send_queue')
                .update({ status: 'sent', task_job_id: r.taskId, sent_at: new Date().toISOString(), attempts: item.attempts + 1, last_error: null })
                .eq('id', item.id)
            free.shift()
            used.add(lane)
            sent++
            notes.push(`lane ${lane} <- ${item.content_item_id.slice(0, 6)}`)
        } catch (e) {
            if (e instanceof SendError && e.queueMaxed) {
                queueMaxed = true
                notes.push(`RunningHub queue full (lane ${lane} could not start)`)
                break
            }
            hadError = true
            const attempts = item.attempts + 1
            await db()
                .from('pipeline_send_queue')
                .update({ attempts, last_error: (e instanceof Error ? e.message : String(e)).slice(0, 300), status: attempts >= MAX_ATTEMPTS ? 'failed' : 'waiting' })
                .eq('id', item.id)
            notes.push(`error on ${item.content_item_id.slice(0, 6)} (attempt ${attempts})`)
        }
    }

    // 4) when to look again, or switch off when idle
    const { count: waitingLeft } = await db().from('pipeline_send_queue').select('id', { count: 'exact', head: true }).eq('status', 'waiting')
    const activeNow = await activeTasks()
    let switchedOff = false
    let nextTickAt: string | null = null
    if (!waitingLeft && !activeNow.length && settings.enabled) {
        await setEnabled(false)
        switchedOff = true
        notes.push('idle: dispatcher switched off and cron removed')
    } else {
        const t = Date.now()
        const cands = activeNow.map((a) => Math.max(taskEtaMs(a), t + RECHECK_SEC * 1000))
        if (waitingLeft && (queueMaxed || hadError || !activeNow.length)) cands.push(t + BACKOFF_SEC * 1000)
        // a lane is free and something is waiting (e.g. daily limit): look again soon
        else if (waitingLeft && free.length) cands.push(t + BACKOFF_SEC * 1000)
        if (cands.length) {
            nextTickAt = new Date(Math.min(...cands)).toISOString()
            await db().from('pipeline_dispatcher_settings').update({ next_tick_at: nextTickAt }).eq('id', 1)
        }
    }

    const note = `sent ${sent}${notes.length ? '; ' + notes.join('; ') : ''}`
    await db().from('pipeline_dispatch_log').insert({ active_before: before, sent, queue_maxed: queueMaxed, note })
    await db().from('pipeline_dispatcher_settings').update({ last_tick_at: new Date().toISOString(), last_note: note }).eq('id', 1)
    return { activeBefore: before, sent, queueMaxed, waitingLeft: waitingLeft || 0, activeNow: activeNow.length, switchedOff, nextTickAt, note }
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
