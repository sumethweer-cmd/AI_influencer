'use client'

import React, { useCallback, useEffect, useMemo, useState } from 'react'

// Result files on RunningHub expire ~14 days after the job (the owner's
// observation, not an official number). Counted conservatively from submit.
const RETENTION_DAYS = 14

type Segment = {
    id: string
    segment_number: number
    title: string | null
    status: string
    compiled_prompt: string | null
}

type RenderTask = {
    id: string
    provider: string
    job_id: string
    content_item_id: string | null
    project_name: string
    status: string
    submitted_at: string
    running_at: string | null
    finished_at: string | null
    run_seconds: number | null
    coins: number | null
    segments: number | null
    seg_from: number | null
    seg_count: number | null
    file_url: string | null
    downloaded: boolean
    local_path: string | null
    error: string | null
    note: string | null
}

type Content = {
    id: string
    title: string | null
    character: string
    model: string | null
    platform: string | null
    delivery_format: string | null
    status: string
    note: string | null
    scheduled_date: string | null
    created_at: string
    segments: Segment[]
    render_tasks: RenderTask[]
}

const PROMPT_STYLES: Record<string, string> = {
    pending: 'bg-slate-700 text-slate-200',
    qc_fail: 'bg-rose-900/60 text-rose-300',
    approved: 'bg-emerald-900/60 text-emerald-300',
    posted: 'bg-cyan-900/60 text-cyan-300',
}

const RENDER_STYLES: Record<string, string> = {
    NOT_SENT: 'bg-slate-800 text-slate-400',
    QUEUED: 'bg-amber-900/60 text-amber-300',
    RUNNING: 'bg-blue-900/60 text-blue-300',
    SUCCESS: 'bg-emerald-900/60 text-emerald-300',
    FAILED: 'bg-rose-900/60 text-rose-300',
    CANCELLED: 'bg-rose-900/60 text-rose-300',
}

const RENDER_LABELS: Record<string, string> = {
    NOT_SENT: 'ยังไม่ส่ง',
    QUEUED: 'ส่งแล้ว (คิว)',
    RUNNING: 'กำลังรัน',
    SUCCESS: 'เสร็จ',
    FAILED: 'ล้มเหลว',
    CANCELLED: 'ยกเลิก',
}

// The "headline" render state of a content: the newest task's status, or NOT_SENT.
const renderStateOf = (c: Content): string => c.render_tasks[0]?.status || 'NOT_SENT'

const daysLeft = (submittedAt: string) =>
    RETENTION_DAYS - (Date.now() - new Date(submittedAt).getTime()) / 86400000

const fmtDate = (iso: string | null) => {
    if (!iso) return '-'
    const d = new Date(iso)
    if (isNaN(d.getTime())) return '-'
    return d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}

const fmtDur = (sec: number | null) => {
    if (sec == null) return '-'
    const m = Math.floor(sec / 60)
    return `${m} น. ${sec % 60} ว.`
}

function Badge({ label, cls }: { label: string; cls: string }) {
    return <span className={`inline-block px-2 py-0.5 rounded text-xs font-bold whitespace-nowrap ${cls}`}>{label}</span>
}

function Expiry({ task }: { task: RenderTask }) {
    if (task.status !== 'SUCCESS') return null
    if (task.downloaded) return <span className="text-xs text-emerald-400">โหลดเก็บแล้ว</span>
    const left = daysLeft(task.submitted_at)
    if (left <= 0) return <span className="text-xs text-rose-400">เกิน {RETENTION_DAYS} วัน ไฟล์อาจหายแล้ว</span>
    const cls = left <= 3 ? 'text-rose-400' : left <= 7 ? 'text-amber-400' : 'text-slate-400'
    return <span className={`text-xs ${cls}`}>เหลือ ~{Math.ceil(left)} วัน</span>
}

export default function PipelineOverviewPage() {
    const [contents, setContents] = useState<Content[]>([])
    const [orphans, setOrphans] = useState<RenderTask[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [openId, setOpenId] = useState<string | null>(null)
    const [filter, setFilter] = useState<string>('ALL')
    const [character, setCharacter] = useState<string>('ALL')
    const [query, setQuery] = useState('')
    const [token, setToken] = useState('')
    const [refreshing, setRefreshing] = useState(false)
    const [progress, setProgress] = useState<string | null>(null)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/pipeline/overview', { cache: 'no-store' })
            const json = await res.json()
            if (!json.success) throw new Error(json.error || 'โหลดไม่สำเร็จ')
            setContents(json.contents)
            setOrphans(json.orphanTasks || [])
        } catch (e: any) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        load()
    }, [load])

    useEffect(() => {
        try {
            setToken(sessionStorage.getItem('pipeline_admin_token') || '')
        } catch {}
    }, [])

    // Unfinished RunningHub jobs (anything linked to a content, plus unlinked ones).
    const activeJobIds = useMemo(() => {
        const all: RenderTask[] = [...contents.flatMap((c) => c.render_tasks), ...orphans]
        return all.filter((t) => t.provider === 'runninghub' && (t.status === 'QUEUED' || t.status === 'RUNNING')).map((t) => t.job_id)
    }, [contents, orphans])

    // Asks the server to check RunningHub for these jobs, 5 at a time.
    const refreshRh = async () => {
        if (!activeJobIds.length || refreshing) return
        setRefreshing(true)
        setError(null)
        try {
            sessionStorage.setItem('pipeline_admin_token', token)
        } catch {}
        let done = 0
        let failed = 0
        try {
            for (let i = 0; i < activeJobIds.length; i += 5) {
                const batch = activeJobIds.slice(i, i + 5)
                setProgress(`เช็กแล้ว ${done}/${activeJobIds.length}`)
                const res = await fetch('/api/pipeline/refresh', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-admin-token': token },
                    body: JSON.stringify({ jobIds: batch }),
                })
                const json = await res.json()
                if (!json.success) throw new Error(json.error || 'เช็กสถานะไม่สำเร็จ')
                failed += (json.results || []).filter((r: { error?: string }) => r.error).length
                done += batch.length
            }
            setProgress(`เช็กครบ ${done} งาน${failed ? ` (มี ${failed} งานเช็กไม่ได้)` : ''}`)
            await load()
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
            setProgress(null)
        } finally {
            setRefreshing(false)
        }
    }

    const counts = useMemo(() => {
        const c: Record<string, number> = { NOT_SENT: 0, QUEUED: 0, RUNNING: 0, SUCCESS: 0, FAILED: 0, CANCELLED: 0 }
        for (const x of contents) c[renderStateOf(x)] = (c[renderStateOf(x)] || 0) + 1
        return c
    }, [contents])

    const needDownload = useMemo(
        () =>
            contents.filter((c) => c.render_tasks.some((t) => t.status === 'SUCCESS' && !t.downloaded)).length,
        [contents]
    )

    const characters = useMemo(() => Array.from(new Set(contents.map((c) => c.character))).sort(), [contents])

    const rows = useMemo(
        () =>
            contents.filter((c) => {
                if (filter !== 'ALL' && renderStateOf(c) !== filter) return false
                if (character !== 'ALL' && c.character !== character) return false
                if (query && !(c.title || '').toLowerCase().includes(query.toLowerCase())) return false
                return true
            }),
        [contents, filter, character, query]
    )

    const open = contents.find((c) => c.id === openId) || null

    const tiles: { key: string; label: string }[] = [
        { key: 'ALL', label: 'ทั้งหมด' },
        { key: 'NOT_SENT', label: 'ยังไม่ส่ง' },
        { key: 'QUEUED', label: 'ส่งแล้ว/คิว' },
        { key: 'RUNNING', label: 'กำลังรัน' },
        { key: 'SUCCESS', label: 'เสร็จ' },
        { key: 'FAILED', label: 'ล้มเหลว' },
        { key: 'CANCELLED', label: 'ยกเลิก' },
    ]

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                    <h2 className="text-2xl font-bold">Pipeline Overview</h2>
                    <p className="text-sm text-slate-400">
                        1 แถว = 1 content (กดเพื่อดู segment และงานเรนเดอร์) · อ่านข้อมูลอย่างเดียว
                    </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                    <input
                        type="password"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="รหัสผ่าน (ถ้าตั้งไว้)"
                        className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm w-40"
                    />
                    <button
                        onClick={refreshRh}
                        disabled={refreshing || !activeJobIds.length}
                        title="ถามสถานะงานที่ยังไม่จบจาก RunningHub (ไม่เสียเหรียญ)"
                        className="px-4 py-2 rounded-lg bg-cyan-700 hover:bg-cyan-600 text-sm font-bold disabled:opacity-40"
                    >
                        {refreshing ? 'กำลังเช็ก…' : `⟳ เช็กสถานะ RH (${activeJobIds.length})`}
                    </button>
                    <button
                        onClick={load}
                        disabled={loading}
                        className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-sm font-bold disabled:opacity-50"
                    >
                        {loading ? 'กำลังโหลด…' : '↻ โหลดใหม่จากฐานข้อมูล'}
                    </button>
                </div>
            </div>

            {progress && <div className="text-sm text-cyan-300">{progress}</div>}

            {error && (
                <div className="rounded-lg border border-rose-800 bg-rose-950/50 text-rose-300 px-4 py-3 text-sm">
                    {error}
                </div>
            )}

            {/* Dashboard tiles */}
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
                {tiles.map((t) => {
                    const n = t.key === 'ALL' ? contents.length : counts[t.key] || 0
                    const active = filter === t.key
                    return (
                        <button
                            key={t.key}
                            onClick={() => setFilter(t.key)}
                            className={`rounded-xl border px-4 py-3 text-left transition ${
                                active ? 'border-cyan-500 bg-cyan-950/40' : 'border-slate-800 bg-slate-950/40 hover:border-slate-600'
                            }`}
                        >
                            <div className="text-2xl font-bold">{n}</div>
                            <div className="text-xs text-slate-400">{t.label}</div>
                        </button>
                    )
                })}
            </div>

            {needDownload > 0 && (
                <div className="rounded-lg border border-amber-800 bg-amber-950/40 text-amber-200 px-4 py-3 text-sm">
                    มี {needDownload} content ที่เรนเดอร์เสร็จแล้วแต่ยังไม่ได้โหลดเก็บ — ลิงก์ผลลัพธ์หมดอายุราว {RETENTION_DAYS} วันหลังส่งงาน
                </div>
            )}

            {/* Filters */}
            <div className="flex flex-wrap gap-3 items-center">
                <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="ค้นหาชื่อเรื่อง"
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm w-64"
                />
                <select
                    value={character}
                    onChange={(e) => setCharacter(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
                >
                    <option value="ALL">ทุกตัวละคร</option>
                    {characters.map((c) => (
                        <option key={c} value={c}>
                            {c}
                        </option>
                    ))}
                </select>
                <span className="text-sm text-slate-500">แสดง {rows.length} จาก {contents.length}</span>
            </div>

            {/* Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-sm">
                    <thead className="bg-slate-950 text-slate-400 text-left">
                        <tr>
                            <th className="px-4 py-3">เรื่อง</th>
                            <th className="px-4 py-3">ตัวละคร</th>
                            <th className="px-4 py-3 text-center">Seg</th>
                            <th className="px-4 py-3">Prompt</th>
                            <th className="px-4 py-3">เรนเดอร์</th>
                            <th className="px-4 py-3">ส่งเมื่อ</th>
                            <th className="px-4 py-3">ผลลัพธ์</th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((c) => {
                            const rs = renderStateOf(c)
                            const t = c.render_tasks[0]
                            return (
                                <tr
                                    key={c.id}
                                    onClick={() => setOpenId(c.id)}
                                    className={`border-t border-slate-800 cursor-pointer hover:bg-slate-800/50 ${
                                        openId === c.id ? 'bg-slate-800/60' : ''
                                    }`}
                                >
                                    <td className="px-4 py-3 font-bold">{c.title || '(ไม่มีชื่อ)'}</td>
                                    <td className="px-4 py-3">{c.character}</td>
                                    <td className="px-4 py-3 text-center">{c.segments.length}</td>
                                    <td className="px-4 py-3">
                                        <Badge label={c.status} cls={PROMPT_STYLES[c.status] || PROMPT_STYLES.pending} />
                                    </td>
                                    <td className="px-4 py-3">
                                        <Badge label={RENDER_LABELS[rs] || rs} cls={RENDER_STYLES[rs] || RENDER_STYLES.NOT_SENT} />
                                    </td>
                                    <td className="px-4 py-3 text-slate-400">{t ? fmtDate(t.submitted_at) : '-'}</td>
                                    <td className="px-4 py-3">{t ? <Expiry task={t} /> : null}</td>
                                </tr>
                            )
                        })}
                        {!rows.length && !loading && (
                            <tr>
                                <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                                    ไม่มีรายการ
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {orphans.length > 0 && (
                <div className="rounded-xl border border-slate-800 p-4">
                    <h3 className="font-bold mb-2">งานเรนเดอร์ที่ยังไม่ผูกกับ content ({orphans.length})</h3>
                    <p className="text-xs text-slate-500 mb-2">ส่งงานโดยไม่ระบุ content_item_id จึงไม่รู้ว่าเป็นของเรื่องไหน</p>
                    <ul className="text-sm space-y-1">
                        {orphans.map((t) => (
                            <li key={t.id} className="flex gap-3 items-center flex-wrap">
                                <Badge label={RENDER_LABELS[t.status] || t.status} cls={RENDER_STYLES[t.status] || RENDER_STYLES.NOT_SENT} />
                                <span>{t.project_name}</span>
                                <span className="text-slate-500">task {t.job_id}</span>
                                <span className="text-slate-500">{fmtDate(t.submitted_at)}</span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}

            {/* Detail */}
            {open && (
                <div className="rounded-xl border border-cyan-900 bg-slate-950/60 p-5 space-y-5">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="text-xl font-bold">{open.title || '(ไม่มีชื่อ)'}</h3>
                            <p className="text-xs text-slate-500 break-all">content id: {open.id}</p>
                            <p className="text-sm text-slate-400 mt-1">
                                {open.character} · {open.model || '-'} · {open.platform || '-'} · กำหนด {open.scheduled_date || '-'}
                            </p>
                            {open.note && <p className="text-xs text-slate-500 mt-1 break-all">note: {open.note}</p>}
                        </div>
                        <button onClick={() => setOpenId(null)} className="text-slate-400 hover:text-white text-sm">
                            ปิด ✕
                        </button>
                    </div>

                    <div>
                        <h4 className="font-bold mb-2">Segment ({open.segments.length})</h4>
                        <div className="space-y-2">
                            {open.segments.map((s) => (
                                <details key={s.id} className="rounded-lg border border-slate-800 bg-slate-900/60">
                                    <summary className="cursor-pointer px-4 py-2 flex items-center gap-3 flex-wrap">
                                        <span className="font-bold">SEG {s.segment_number}</span>
                                        <Badge label={s.status} cls={PROMPT_STYLES[s.status] || PROMPT_STYLES.pending} />
                                        <span className="text-xs text-slate-500">
                                            {(s.compiled_prompt || '').split(/\s+/).filter(Boolean).length} คำ · {s.id}
                                        </span>
                                    </summary>
                                    <pre className="px-4 py-3 text-xs whitespace-pre-wrap text-slate-300 border-t border-slate-800 max-h-96 overflow-auto">
                                        {s.compiled_prompt || '(ว่าง)'}
                                    </pre>
                                </details>
                            ))}
                        </div>
                    </div>

                    <div>
                        <h4 className="font-bold mb-2">งานเรนเดอร์ ({open.render_tasks.length})</h4>
                        {open.render_tasks.length === 0 ? (
                            <p className="text-sm text-slate-500">ยังไม่เคยส่งงาน</p>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="text-slate-400 text-left">
                                        <tr>
                                            <th className="py-2 pr-4">สถานะ</th>
                                            <th className="py-2 pr-4">ที่</th>
                                            <th className="py-2 pr-4">job_id</th>
                                            <th className="py-2 pr-4">ส่งเมื่อ</th>
                                            <th className="py-2 pr-4">เวลารัน</th>
                                            <th className="py-2 pr-4">เหรียญ</th>
                                            <th className="py-2 pr-4">ผลลัพธ์</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {open.render_tasks.map((t) => (
                                            <tr key={t.id} className="border-t border-slate-800 align-top">
                                                <td className="py-2 pr-4">
                                                    <Badge label={RENDER_LABELS[t.status] || t.status} cls={RENDER_STYLES[t.status] || RENDER_STYLES.NOT_SENT} />
                                                </td>
                                                <td className="py-2 pr-4">{t.provider}</td>
                                                <td className="py-2 pr-4 text-xs break-all">{t.job_id}</td>
                                                <td className="py-2 pr-4 text-slate-400">{fmtDate(t.submitted_at)}</td>
                                                <td className="py-2 pr-4 text-slate-400">{fmtDur(t.run_seconds)}</td>
                                                <td className="py-2 pr-4 text-slate-400">{t.coins ?? '-'}</td>
                                                <td className="py-2 pr-4 space-y-1">
                                                    {t.file_url ? (
                                                        <a
                                                            href={t.file_url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="text-cyan-400 hover:underline"
                                                        >
                                                            เปิด/โหลดคลิป
                                                        </a>
                                                    ) : (
                                                        <span className="text-slate-500">-</span>
                                                    )}
                                                    <div>
                                                        <Expiry task={t} />
                                                    </div>
                                                    {t.downloaded && t.local_path && (
                                                        <div className="text-xs text-slate-500 break-all">เก็บที่: {t.local_path}</div>
                                                    )}
                                                    {t.error && <div className="text-xs text-rose-400 break-all">{t.error}</div>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
