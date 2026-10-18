'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { DEFAULT_SEG_FRAMES, estimate } from '@/lib/trackData'

// Result files on RunningHub expire ~14 days after the job (owner's observation). Counted from submit.
const RETENTION_DAYS = 14

type Segment = { id: string; segment_number: number; title: string | null; status: string; compiled_prompt: string | null }
type Pic = { label: string; url: string }
type RenderTask = {
    id: string
    provider: string
    job_id: string
    content_item_id: string | null
    project_name: string
    status: string
    submitted_at: string
    run_seconds: number | null
    coins: number | null
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
    note: string | null
    scheduled_date: string | null
    pics: Record<string, Pic>
    segments: Segment[]
    render_tasks: RenderTask[]
}
type LibAsset = { id: string; character: string | null; label: string; url: string }

const STAGES = ['บท', 'รูป', 'ส่ง', 'รัน', 'เสร็จ', 'โหลด']

const isRepair = (t: RenderTask, c: Content) => (t.seg_count ?? c.segments.length) < c.segments.length
const headline = (c: Content) => c.render_tasks.find((t) => !isRepair(t, c)) || null
const stateOf = (c: Content) => headline(c)?.status || 'NONE'
const hasPic1 = (c: Content) => Boolean(c.pics['1'])
const stageOf = (c: Content) => {
    const t = headline(c)
    if (!t) return hasPic1(c) ? 1 : 0
    if (t.status === 'SUCCESS') return t.downloaded ? 5 : 4
    if (t.status === 'RUNNING') return 3
    return 2
}
const daysLeft = (iso: string) => RETENTION_DAYS - (Date.now() - new Date(iso).getTime()) / 86400000
const fmtDate = (iso: string | null) => {
    if (!iso) return '-'
    const d = new Date(iso)
    return isNaN(d.getTime()) ? '-' : d.toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })
}
const fmtDur = (sec: number | null) => (sec == null ? '-' : `${Math.floor(sec / 60)} น. ${sec % 60} ว.`)
const needsAction = (c: Content) => {
    const s = stateOf(c)
    const t = headline(c)
    return s === 'NONE' || s === 'FAILED' || s === 'CANCELLED' || (s === 'SUCCESS' && Boolean(t) && !t?.downloaded)
}
const canSend = (c: Content) => hasPic1(c) && ['NONE', 'FAILED', 'CANCELLED'].includes(stateOf(c))

const TAGS: Record<string, [string, string]> = {
    NONE: ['ยังไม่ส่ง', 'idle'],
    QUEUED: ['อยู่ในคิว', 'wait'],
    RUNNING: ['กำลังรัน', 'run'],
    SUCCESS: ['เสร็จ', 'ok'],
    FAILED: ['ล้มเหลว', 'bad'],
    CANCELLED: ['ถูกยกเลิก', 'bad'],
}
const tagOf = (c: Content): [string, string] => {
    const s = stateOf(c)
    const t = headline(c)
    if (s === 'SUCCESS') return t?.downloaded ? ['เสร็จ · โหลดแล้ว', 'ok'] : ['เสร็จ · รอโหลด', 'wait']
    return TAGS[s] || TAGS.NONE
}
const nextLabel = (c: Content) => {
    const s = stateOf(c)
    const t = headline(c)
    if (s === 'NONE') return hasPic1(c) ? 'สั่งเจน' : 'เลือกรูป'
    if (s === 'FAILED' || s === 'CANCELLED') return 'ส่งใหม่'
    if (s === 'SUCCESS') return t?.downloaded ? 'เปิดคลิป' : 'โหลดคลิป'
    return ''
}

type Group = { label: string; f: (c: Content) => boolean }
const GROUPS: Record<string, Group> = {
    all: { label: 'ทั้งหมด', f: () => true },
    todo: { label: 'ต้องทำต่อ', f: needsAction },
    run: { label: 'กำลังรัน/รอคิว', f: (c) => ['RUNNING', 'QUEUED'].includes(stateOf(c)) },
    done: { label: 'เสร็จแล้ว', f: (c) => stateOf(c) === 'SUCCESS' },
    bad: { label: 'มีปัญหา', f: (c) => ['FAILED', 'CANCELLED'].includes(stateOf(c)) },
}

function Stepper({ c }: { c: Content }) {
    const stage = stageOf(c)
    const s = stateOf(c)
    const bad = s === 'FAILED' || s === 'CANCELLED'
    const running = s === 'RUNNING' || s === 'QUEUED'
    return (
        <div className="steps">
            {STAGES.map((name, i) => {
                let cls = ''
                if (bad && i === 2) cls = 'bad'
                else if (i < stage || (stage >= 5 && i <= 5)) cls = 'done'
                else if (i === stage) cls = running ? 'now' : 'todo'
                return (
                    <div key={name} className={`step ${cls}`}>
                        <i />
                        <span>{name}</span>
                    </div>
                )
            })}
        </div>
    )
}

type SendDialog = { content: Content; segFrom: number; segCount: number; prompt: string; repair: boolean; unshift: boolean } | null

export default function ContentPage() {
    const [contents, setContents] = useState<Content[]>([])
    const [orphans, setOrphans] = useState<RenderTask[]>([])
    const [library, setLibrary] = useState<LibAsset[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [info, setInfo] = useState<string | null>(null)
    const [openId, setOpenId] = useState<string | null>(null)
    const [tab, setTab] = useState<'info' | 'pics' | 'segs' | 'render'>('info')
    const [filter, setFilter] = useState('all')
    const [query, setQuery] = useState('')
    const [checked, setChecked] = useState<Set<string>>(new Set())
    const [token, setToken] = useState('')
    const [busy, setBusy] = useState(false)
    const [picker, setPicker] = useState<{ contentId: string; slot: number } | null>(null)
    const [pickChar, setPickChar] = useState('ทั้งหมด')
    const [dialog, setDialog] = useState<SendDialog>(null)
    const [edit, setEdit] = useState<Record<string, string>>({}) // segment id -> unsaved text
    const fileRef = useRef<HTMLInputElement>(null)

    const headers = useCallback(
        () => ({ 'Content-Type': 'application/json', 'x-admin-token': token }),
        [token]
    )

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const [o, l] = await Promise.all([
                fetch('/api/pipeline/overview', { cache: 'no-store' }).then((r) => r.json()),
                fetch('/api/pipeline/library', { cache: 'no-store' }).then((r) => r.json()),
            ])
            if (!o.success) throw new Error(o.error || 'โหลดไม่สำเร็จ')
            setContents(o.contents)
            setOrphans(o.orphanTasks || [])
            if (l.success) setLibrary(l.assets)
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setLoading(false)
        }
    }, [])

    useEffect(() => {
        load()
        try {
            setToken(sessionStorage.getItem('pipeline_admin_token') || '')
        } catch {}
    }, [load])
    useEffect(() => {
        try {
            sessionStorage.setItem('pipeline_admin_token', token)
        } catch {}
    }, [token])

    const call = async (url: string, method: string, body: unknown) => {
        const res = await fetch(url, { method, headers: headers(), body: JSON.stringify(body) })
        const json = await res.json().catch(() => ({ success: false, error: `HTTP ${res.status}` }))
        if (!json.success) throw new Error(json.error || `HTTP ${res.status}`)
        return json
    }
    const run = async (fn: () => Promise<void>) => {
        setBusy(true)
        setError(null)
        try {
            await fn()
        } catch (e) {
            setError(e instanceof Error ? e.message : String(e))
        } finally {
            setBusy(false)
        }
    }

    const open = contents.find((c) => c.id === openId) || null
    const counts = useMemo(() => Object.fromEntries(Object.entries(GROUPS).map(([k, g]) => [k, contents.filter(g.f).length])), [contents])
    const rows = useMemo(
        () =>
            contents.filter(GROUPS[filter].f).filter((c) => `${c.title || ''} ${c.character}`.toLowerCase().includes(query.toLowerCase())),
        [contents, filter, query]
    )
    const running = counts.run
    const waiting = contents.filter((c) => stateOf(c) === 'NONE').length
    const toDownload = contents.filter((c) => stateOf(c) === 'SUCCESS' && !headline(c)?.downloaded)
    const urgent = toDownload
        .map((c) => ({ c, left: daysLeft(headline(c)!.submitted_at) }))
        .sort((a, b) => a.left - b.left)[0]

    const activeJobIds = useMemo(
        () =>
            [...contents.flatMap((c) => c.render_tasks), ...orphans]
                .filter((t) => t.provider === 'runninghub' && ['QUEUED', 'RUNNING'].includes(t.status))
                .map((t) => t.job_id),
        [contents, orphans]
    )

    const refreshRh = () =>
        run(async () => {
            let done = 0
            for (let i = 0; i < activeJobIds.length; i += 5) {
                setInfo(`เช็กแล้ว ${done}/${activeJobIds.length}`)
                await call('/api/pipeline/refresh', 'POST', { jobIds: activeJobIds.slice(i, i + 5) })
                done += Math.min(5, activeJobIds.length - i)
            }
            setInfo(`เช็กครบ ${done} งาน`)
            await load()
        })

    const savePrompt = (seg: Segment) =>
        run(async () => {
            await call('/api/pipeline/segment', 'PATCH', { id: seg.id, compiled_prompt: edit[seg.id] })
            setEdit((e) => {
                const n = { ...e }
                delete n[seg.id]
                return n
            })
            setInfo(`บันทึก SEG ${seg.segment_number} แล้ว`)
            await load()
        })

    const setSlot = (contentId: string, slot: number, assetId: string | null) =>
        run(async () => {
            await call('/api/pipeline/slot', 'POST', { contentId, slot, assetId })
            setPicker(null)
            await load()
        })

    const uploadNew = (file: File, contentId: string, slot: number, character: string) =>
        run(async () => {
            const ticket = await call('/api/pipeline/library', 'POST', { filename: file.name, character })
            const { error: upErr } = await supabase.storage.from('pipeline-assets').uploadToSignedUrl(ticket.path, ticket.token, file)
            if (upErr) throw new Error(`อัปโหลดไม่สำเร็จ: ${upErr.message}`)
            const rec = await call('/api/pipeline/library', 'PUT', {
                path: ticket.path,
                url: ticket.publicUrl,
                character,
                label: `${character} · ${file.name.replace(/\.[^.]+$/, '')}`,
                contentType: file.type,
                sizeBytes: file.size,
            })
            await call('/api/pipeline/slot', 'POST', { contentId, slot, assetId: rec.asset.id })
            setPicker(null)
            setInfo('อัปโหลดแล้ว และเก็บเข้าคลังรูปให้ใช้ซ้ำได้')
            await load()
        })

    const markDownloaded = (t: RenderTask) =>
        run(async () => {
            await call('/api/pipeline/task', 'PATCH', { id: t.id, downloaded: true })
            await load()
        })

    const send = () =>
        run(async () => {
            if (!dialog) return
            const d = dialog
            const out = await call('/api/pipeline/send', 'POST', {
                confirm: true,
                contentId: d.content.id,
                segFrom: d.segFrom,
                segCount: d.segCount,
                prompt: d.repair ? d.prompt : undefined,
                unshift: d.unshift,
            })
            setDialog(null)
            setInfo(`ส่งแล้ว: task ${out.taskId}`)
            await load()
        })

    const sendChecked = () =>
        run(async () => {
            const list = contents.filter((c) => checked.has(c.id) && canSend(c))
            let n = 0
            for (const c of list) {
                setInfo(`กำลังส่ง ${n + 1}/${list.length}: ${c.title}`)
                await call('/api/pipeline/send', 'POST', { confirm: true, contentId: c.id })
                n++
            }
            setChecked(new Set())
            setInfo(`ส่งแล้ว ${n} เรื่อง`)
            await load()
        })

    const openSend = (c: Content) => setDialog({ content: c, segFrom: 1, segCount: c.segments.length, prompt: '', repair: false, unshift: false })
    const openRepair = (c: Content, seg: Segment) =>
        setDialog({
            content: c,
            segFrom: seg.segment_number,
            segCount: 1,
            prompt: edit[seg.id] ?? seg.compiled_prompt ?? '',
            repair: true,
            unshift: seg.segment_number > 1,
        })

    const mainAction = (c: Content) => {
        const l = nextLabel(c)
        const t = headline(c)
        if (l === 'เลือกรูป') {
            setOpenId(c.id)
            setTab('pics')
        } else if (l === 'สั่งเจน' || l === 'ส่งใหม่') openSend(c)
        else if ((l === 'โหลดคลิป' || l === 'เปิดคลิป') && t?.file_url) window.open(t.file_url, '_blank')
    }

    const estFrames = dialog ? Array(dialog.segCount).fill(DEFAULT_SEG_FRAMES).reduce((a: number, b: number) => a + b, 0) : 0
    const est = estimate(estFrames)
    const chars = ['ทั้งหมด', ...Array.from(new Set(library.map((a) => (a.character || 'อื่นๆ')))).sort()]

    return (
        <div className="pl">
            <style>{CSS}</style>
            <header className="top">
                <h1>คอนเทนต์ของฉัน</h1>
                <div className="actions">
                    <input
                        type="password"
                        className="tok"
                        value={token}
                        onChange={(e) => setToken(e.target.value)}
                        placeholder="รหัสผ่าน (ถ้าตั้งไว้)"
                        aria-label="รหัสผ่าน"
                    />
                    <button onClick={refreshRh} disabled={busy || !activeJobIds.length} title="ถามสถานะงานที่ยังไม่จบจาก RunningHub (ไม่เสียเหรียญ)">
                        {busy && info?.startsWith('เช็ก') ? 'กำลังเช็ก…' : `เช็กสถานะ RunningHub (${activeJobIds.length})`}
                    </button>
                    <button className="primary" onClick={sendChecked} disabled={busy || ![...checked].length}>
                        สั่งเจนที่เลือก ({checked.size})
                    </button>
                </div>
            </header>

            {error && <div className="banner bad" role="alert">{error}</div>}
            {info && !error && <div className="banner ok" role="status">{info}</div>}

            <div className="summary">
                ตอนนี้ <b>กำลังรัน {running}</b> · <b>รอส่ง {waiting}</b> · <b>เสร็จแล้วยังไม่ได้โหลด {toDownload.length}</b>
                {urgent && (
                    <span className="warn">
                        {' '}
                        — &quot;{urgent.c.title}&quot; {urgent.left <= 0 ? `เกิน ${RETENTION_DAYS} วันแล้ว ไฟล์อาจหาย` : `หมดอายุในอีก ~${Math.ceil(urgent.left)} วัน`}
                    </span>
                )}
            </div>

            <div className="toolbar">
                <div className="chips" role="group" aria-label="กรองตามสถานะ">
                    {Object.entries(GROUPS).map(([k, g]) => (
                        <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>
                            {g.label}
                            <small>{counts[k]}</small>
                        </button>
                    ))}
                </div>
                <input className="search" type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ค้นหาชื่อเรื่องหรือตัวละคร" aria-label="ค้นหา" />
                <button onClick={load} disabled={loading}>{loading ? 'กำลังโหลด…' : 'โหลดใหม่'}</button>
            </div>

            <div className={`layout ${open ? 'open' : ''}`}>
                <section className="list" aria-label="รายการคอนเทนต์">
                    <div className="head">
                        <span />
                        <span>เรื่อง</span>
                        <span>ความคืบหน้า</span>
                        <span>สถานะ / ต้องทำอะไรต่อ</span>
                    </div>
                    {rows.map((c) => {
                        const [tl, tc] = tagOf(c)
                        const nl = nextLabel(c)
                        const hot = nl === 'สั่งเจน' || nl === 'โหลดคลิป' || nl === 'ส่งใหม่'
                        return (
                            <div
                                key={c.id}
                                className={`row ${openId === c.id ? 'sel' : ''}`}
                                tabIndex={0}
                                onClick={() => {
                                    setOpenId(c.id)
                                    setTab('info')
                                }}
                                onKeyDown={(e) => e.key === 'Enter' && setOpenId(c.id)}
                            >
                                <input
                                    type="checkbox"
                                    aria-label={`เลือก ${c.title}`}
                                    checked={checked.has(c.id)}
                                    disabled={!canSend(c)}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) =>
                                        setChecked((s) => {
                                            const n = new Set(s)
                                            if (e.target.checked) n.add(c.id)
                                            else n.delete(c.id)
                                            return n
                                        })
                                    }
                                />
                                <div>
                                    <div className="title">{c.title || '(ไม่มีชื่อ)'}</div>
                                    <div className="sub">{c.character} · {c.segments.length} segment</div>
                                </div>
                                <Stepper c={c} />
                                <div className="next">
                                    <span className={`tag t-${tc}`}>{tl}</span>
                                    {nl ? (
                                        <button
                                            className={hot ? 'primary' : ''}
                                            onClick={(e) => {
                                                e.stopPropagation()
                                                mainAction(c)
                                            }}
                                        >
                                            {nl}
                                        </button>
                                    ) : (
                                        <span className="sub">รอ RH ทำงาน ไม่ต้องทำอะไร</span>
                                    )}
                                </div>
                            </div>
                        )
                    })}
                    {!rows.length && !loading && <div className="empty">{contents.length ? 'ไม่มีรายการในตัวกรองนี้' : 'ยังไม่มีคอนเทนต์ — ให้ผู้ช่วยสร้าง prompt แล้วส่งเข้ามา'}</div>}
                </section>

                {open && (
                    <aside className="drawer">
                        <button className="close" onClick={() => setOpenId(null)}>ปิด</button>
                        <h2>{open.title || '(ไม่มีชื่อ)'}</h2>
                        <div className="sub">
                            {open.character} · {open.segments.length} segment · <span className={`tag t-${tagOf(open)[1]}`}>{tagOf(open)[0]}</span>
                        </div>
                        <div className="tabs" role="tablist">
                            {([['info', 'ภาพรวม'], ['pics', 'รูปอ้างอิง'], ['segs', 'Segments'], ['render', 'การเรนเดอร์']] as const).map(([k, l]) => (
                                <button key={k} className="tab" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>
                            ))}
                        </div>

                        {tab === 'info' && (
                            <div>
                                {(() => {
                                    const t = headline(open)
                                    return (
                                        <>
                                            {t && t.status === 'SUCCESS' && !t.downloaded && (
                                                <div className="banner warn">คลิปเสร็จแล้วแต่ยังไม่ได้โหลด ลิงก์หมดอายุในอีก <b>~{Math.max(0, Math.ceil(daysLeft(t.submitted_at)))} วัน</b> (นับจากวันส่งงาน)</div>
                                            )}
                                            <p>{t ? `ส่งเมื่อ ${fmtDate(t.submitted_at)} · task ${t.job_id}` : hasPic1(open) ? 'รูปครบแล้ว พร้อมสั่งเจน' : 'ยังไม่ได้เลือกรูป Picture 1'}</p>
                                            <Stepper c={open} />
                                            <p className="sub" style={{ marginTop: 14 }}>
                                                สิ่งที่ต้องทำต่อ: <b>{nextLabel(open) || 'ไม่ต้องทำอะไร รอ RH'}</b>
                                            </p>
                                            {open.note && <p className="sub" style={{ wordBreak: 'break-all' }}>บันทึก: {open.note}</p>}
                                            <p className="sub" style={{ wordBreak: 'break-all' }}>id: {open.id}</p>
                                        </>
                                    )
                                })()}
                            </div>
                        )}

                        {tab === 'pics' && (
                            <div className="slots">
                                {[1, 2, 3].map((n) => {
                                    const p = open.pics[String(n)]
                                    return (
                                        <div key={n} className={`slot ${p ? 'filled' : ''}`}>
                                            {p && /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.url} alt={p.label} loading="lazy" />}
                                            <b>Picture {n}</b>
                                            <span className="sub">{n === 1 ? 'ตัวละคร' : n === 2 ? 'ตัวละครที่สอง/ผี' : 'ฉากหลัง (ไม่บังคับ)'}</span>
                                            <button onClick={() => { setPicker({ contentId: open.id, slot: n }); setPickChar('ทั้งหมด') }}>{p ? 'เปลี่ยนรูป' : 'เลือกรูป'}</button>
                                            {p && <button className="link" onClick={() => setSlot(open.id, n, null)}>เอาออก</button>}
                                        </div>
                                    )
                                })}
                            </div>
                        )}

                        {tab === 'segs' && (
                            <div>
                                <p className="sub">กดชื่อ segment เพื่อเปิด · แก้ได้ทีละ segment · เจนซ่อมเฉพาะ segment นั้นได้ (ได้คลิปเดี่ยวไปตัดต่อเอง)</p>
                                {open.segments.map((s) => {
                                    const text = edit[s.id] ?? s.compiled_prompt ?? ''
                                    const dirty = edit[s.id] !== undefined
                                    return (
                                        <details key={s.id} className="seg">
                                            <summary>
                                                <b>SEG {s.segment_number}</b>
                                                <span className="sub">{DEFAULT_SEG_FRAMES / 24} วินาที · {text.split(/\s+/).filter(Boolean).length} คำ</span>
                                                {dirty && <span className="edited">แก้ไขแล้ว ยังไม่ได้บันทึก</span>}
                                            </summary>
                                            <textarea
                                                value={text}
                                                spellCheck={false}
                                                aria-label={`prompt SEG ${s.segment_number}`}
                                                onChange={(e) => setEdit((m) => ({ ...m, [s.id]: e.target.value }))}
                                            />
                                            <div className="segbar">
                                                <button className="primary" disabled={!dirty || busy} onClick={() => savePrompt(s)}>บันทึก</button>
                                                <button
                                                    disabled={!dirty}
                                                    onClick={() => setEdit((m) => { const n = { ...m }; delete n[s.id]; return n })}
                                                >
                                                    ยกเลิก
                                                </button>
                                                <button onClick={() => navigator.clipboard?.writeText(text)}>คัดลอก</button>
                                                <span className="spacer" />
                                                <button disabled={!hasPic1(open)} title={hasPic1(open) ? '' : 'ต้องเลือกรูป Picture 1 ก่อน'} onClick={() => openRepair(open, s)}>
                                                    เจนเฉพาะ segment นี้…
                                                </button>
                                            </div>
                                        </details>
                                    )
                                })}
                            </div>
                        )}

                        {tab === 'render' && (
                            <div className="tblwrap">
                                {open.render_tasks.length === 0 ? (
                                    <p className="sub">ยังไม่เคยส่งงาน</p>
                                ) : (
                                    <table className="t">
                                        <thead>
                                            <tr><th>สถานะ</th><th>งาน</th><th>เลข task</th><th>ส่งเมื่อ</th><th>เวลารัน</th><th>ผลลัพธ์</th></tr>
                                        </thead>
                                        <tbody>
                                            {open.render_tasks.map((t) => {
                                                const rep = isRepair(t, open)
                                                const [tl, tc] = TAGS[t.status] || TAGS.NONE
                                                return (
                                                    <tr key={t.id}>
                                                        <td><span className={`tag t-${tc}`}>{tl}</span></td>
                                                        <td>{rep ? `ซ่อม SEG ${t.seg_from}${(t.seg_count || 1) > 1 ? `–${(t.seg_from || 1) + (t.seg_count || 1) - 1}` : ''}` : 'ทั้งเรื่อง'}</td>
                                                        <td className="mono">{t.job_id}</td>
                                                        <td>{fmtDate(t.submitted_at)}</td>
                                                        <td>{fmtDur(t.run_seconds)}</td>
                                                        <td>
                                                            {t.file_url ? <a href={t.file_url} target="_blank" rel="noreferrer">เปิด/โหลดคลิป</a> : '-'}
                                                            {t.status === 'SUCCESS' && (
                                                                <div className="sub">
                                                                    {t.downloaded ? 'โหลดเก็บแล้ว' : `เหลือ ~${Math.max(0, Math.ceil(daysLeft(t.submitted_at)))} วัน`}
                                                                    {!t.downloaded && <button className="link" onClick={() => markDownloaded(t)}>ทำเครื่องหมายว่าโหลดแล้ว</button>}
                                                                </div>
                                                            )}
                                                            {t.error && <div className="sub bad-text">{t.error}</div>}
                                                        </td>
                                                    </tr>
                                                )
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </aside>
                )}
            </div>

            {orphans.length > 0 && (
                <details className="orph">
                    <summary>งานเรนเดอร์ที่ยังไม่ผูกกับ content ({orphans.length})</summary>
                    <ul>
                        {orphans.map((t) => (
                            <li key={t.id}>
                                <span className={`tag t-${(TAGS[t.status] || TAGS.NONE)[1]}`}>{(TAGS[t.status] || TAGS.NONE)[0]}</span> {t.project_name} · task {t.job_id} · {fmtDate(t.submitted_at)}
                            </li>
                        ))}
                    </ul>
                </details>
            )}

            {/* Picture picker */}
            {picker && (
                <div className="modal on" role="dialog" aria-modal="true" aria-label="เลือกรูปอ้างอิง" onClick={(e) => e.target === e.currentTarget && setPicker(null)}>
                    <div className="sheet">
                        <div className="between">
                            <h2>เลือกรูปสำหรับ Picture {picker.slot}</h2>
                            <button onClick={() => setPicker(null)}>ปิด</button>
                        </div>
                        <div className="chips">
                            {chars.map((c) => (
                                <button key={c} className="chip" aria-pressed={pickChar === c} onClick={() => setPickChar(c)}>{c}</button>
                            ))}
                        </div>
                        <div className="grid">
                            <button className="pick up" disabled={busy} onClick={() => fileRef.current?.click()}>
                                <span className="plus">＋</span>อัปโหลดรูปใหม่
                            </button>
                            <input
                                ref={fileRef}
                                type="file"
                                accept="image/*"
                                hidden
                                onChange={(e) => {
                                    const f = e.target.files?.[0]
                                    const who = prompt('รูปนี้เป็นของตัวละครไหน? (เช่น anong, meena)', pickChar !== 'ทั้งหมด' ? pickChar : '')
                                    if (f && who) uploadNew(f, picker.contentId, picker.slot, who.trim().toLowerCase())
                                    e.target.value = ''
                                }}
                            />
                            {library
                                .filter((a) => pickChar === 'ทั้งหมด' || (a.character || 'อื่นๆ') === pickChar)
                                .map((a) => (
                                    <button key={a.id} className="pick" onClick={() => setSlot(picker.contentId, picker.slot, a.id)}>
                                        {/* eslint-disable-next-line @next/next/no-img-element */}
                                        <img src={a.url} alt={a.label} loading="lazy" />
                                        <span>{a.label}</span>
                                    </button>
                                ))}
                        </div>
                        <p className="sub">รูปที่อัปโหลดใหม่จะถูกเก็บเป็นรูปในคลัง ใช้ซ้ำกับเรื่องอื่นได้</p>
                    </div>
                </div>
            )}

            {/* Send / repair confirmation */}
            {dialog && (
                <div className="modal on" role="dialog" aria-modal="true" aria-label="ยืนยันสั่งเจน" onClick={(e) => e.target === e.currentTarget && setDialog(null)}>
                    <div className="sheet narrow">
                        <h2>
                            {dialog.repair
                                ? `เจนเฉพาะ SEG ${dialog.segFrom} — ${dialog.content.title}`
                                : `สั่งเจน "${dialog.content.title}" (${dialog.segCount} segment)`}
                        </h2>
                        {dialog.repair ? (
                            <>
                                <p className="sub">เรนเดอร์ segment นี้เป็นคลิปเดี่ยว (ได้ 1 ไฟล์) แล้วเอาไปตัดต่อแทนช่วงที่เพี้ยนเอง แก้ prompt ในกล่องข้างล่างได้ก่อนส่ง</p>
                                <textarea className="rp" value={dialog.prompt} onChange={(e) => setDialog({ ...dialog, prompt: e.target.value })} spellCheck={false} aria-label="prompt ที่จะส่ง" />
                                {dialog.segFrom > 1 && (
                                    <label className="chk">
                                        <input type="checkbox" checked={dialog.unshift} onChange={(e) => setDialog({ ...dialog, unshift: e.target.checked })} />
                                        ลบ 0.917 วินาทีออกจาก timestamp (prompt นี้เขียนแบบ context ไว้ เรนเดอร์เดี่ยวเป็น shot แรก)
                                    </label>
                                )}
                            </>
                        ) : (
                            <p className="sub">ส่งทุก segment เป็นงานเดียว ใช้รูป Picture 1–{Object.keys(dialog.content.pics).length} ของเรื่องนี้</p>
                        )}
                        <p className="sub">
                            ประมาณการ: คลิป {est.videoSec} วินาที ใช้เวลาราว {est.minutes} นาที และราว {est.coins} เหรียญ (ค่าประมาณจากที่เคยวัด ไม่ใช่ราคาจริง) เหรียญคิดตามเวลารันจริงของ RunningHub
                        </p>
                        <div className="actions end">
                            <button onClick={() => setDialog(null)}>ยกเลิก</button>
                            <button className="primary" disabled={busy || (dialog.repair && !dialog.prompt.trim())} onClick={send}>
                                {busy ? 'กำลังส่ง…' : 'ยืนยันและสั่งเจน'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}

const CSS = `
.pl{--bg:#f6f4ef;--card:#fff;--ink:#26231f;--muted:#6f695d;--line:#e4dfd5;--brand:#2f5d50;--brand-soft:#e3eee9;
 --wait:#7a5c00;--wait-bg:#fbf1cf;--run:#1f5f99;--run-bg:#dfeefa;--ok:#2c6b3f;--ok-bg:#dff1e4;--bad:#a3322a;--bad-bg:#f9e0dd;--idle:#625d53;--idle-bg:#ece8de;
 background:var(--bg);color:var(--ink);border-radius:16px;padding:22px;font:16px/1.6 "Leelawadee UI","Sarabun","Noto Sans Thai",Tahoma,sans-serif}
.pl *{box-sizing:border-box}
.pl h1{font-size:26px;margin:0}.pl h2{margin:0;font-size:20px}
.pl button{font:inherit;cursor:pointer;border-radius:10px;border:1px solid var(--line);background:var(--card);color:var(--ink);padding:8px 16px;min-height:44px}
.pl button:hover:not(:disabled){border-color:#b5ae9d}.pl button:disabled{opacity:.45;cursor:not-allowed}
.pl button.primary{background:var(--brand);border-color:var(--brand);color:#fff;font-weight:600}
.pl button.primary:hover:not(:disabled){background:#264c41}
.pl button.link{border:0;background:none;color:var(--brand);text-decoration:underline;padding:4px 6px;min-height:32px}
.pl button:focus-visible,.pl input:focus-visible,.pl .row:focus-visible,.pl textarea:focus-visible,.pl summary:focus-visible{outline:3px solid #7ab3a2;outline-offset:2px}
.pl .top{display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-bottom:12px}
.pl .actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}.pl .actions.end{justify-content:flex-end;margin-top:12px}
.pl .tok,.pl .search{border:1px solid var(--line);border-radius:10px;padding:8px 14px;font:inherit;min-height:44px;background:var(--card);color:var(--ink)}
.pl .tok{width:170px}.pl .search{flex:1;min-width:200px}
.pl .banner{border-radius:10px;padding:10px 14px;margin:0 0 12px;font-size:15px}
.pl .banner.ok{background:var(--ok-bg);color:var(--ok)}.pl .banner.bad{background:var(--bad-bg);color:var(--bad)}.pl .banner.warn{background:var(--wait-bg);color:#5c4700}
.pl .summary{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px 18px;margin-bottom:14px;font-size:18px}
.pl .summary .warn{color:var(--bad);font-weight:600}
.pl .toolbar{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:14px;align-items:center}
.pl .chips{display:flex;gap:8px;flex-wrap:wrap}
.pl .chip{border-radius:999px;padding:6px 16px;min-height:40px}.pl .chip[aria-pressed="true"]{background:var(--ink);color:#fff;border-color:var(--ink)}
.pl .chip small{opacity:.7;margin-left:6px}
.pl .layout{display:grid;grid-template-columns:minmax(0,1fr);gap:16px}
.pl .layout.open{grid-template-columns:minmax(0,1.05fr) minmax(0,.95fr)}
@media (max-width:1000px){.pl .layout.open{grid-template-columns:1fr}}
.pl .list{background:var(--card);border:1px solid var(--line);border-radius:14px;overflow:hidden}
.pl .head,.pl .row{display:grid;grid-template-columns:28px minmax(140px,1.3fr) minmax(210px,1.7fr) minmax(150px,1fr);gap:12px;align-items:center;padding:12px 16px}
.pl .head{font-size:13px;color:var(--muted);background:#faf8f3;border-bottom:1px solid var(--line)}
.pl .row{border-bottom:1px solid var(--line);cursor:pointer}.pl .row:last-child{border-bottom:0}.pl .row:hover{background:#faf8f3}.pl .row.sel{background:var(--brand-soft)}
.pl .title{font-weight:700}.pl .sub{font-size:13px;color:var(--muted)}
.pl .empty{padding:30px;text-align:center;color:var(--muted)}
.pl .steps{display:flex}
.pl .step{display:flex;flex-direction:column;align-items:center;gap:2px;flex:1;position:relative;font-size:11px;color:var(--muted)}
.pl .step i{width:14px;height:14px;border-radius:50%;border:2px solid #c9c2b2;background:#fff;display:block;z-index:1}
.pl .step.done i{background:var(--ok);border-color:var(--ok)}
.pl .step.now i{background:var(--run);border-color:var(--run);box-shadow:0 0 0 4px var(--run-bg)}
.pl .step.bad i{background:var(--bad);border-color:var(--bad)}
.pl .step.todo i{border-color:var(--wait);background:var(--wait-bg)}
.pl .step:not(:last-child)::after{content:"";position:absolute;top:6px;left:50%;width:100%;height:2px;background:#d8d2c3}
.pl .step.done:not(:last-child)::after{background:var(--ok)}
.pl .tag{display:inline-block;border-radius:6px;padding:2px 9px;font-size:13px;font-weight:600}
.pl .t-idle{background:var(--idle-bg);color:var(--idle)}.pl .t-wait{background:var(--wait-bg);color:var(--wait)}.pl .t-run{background:var(--run-bg);color:var(--run)}.pl .t-ok{background:var(--ok-bg);color:var(--ok)}.pl .t-bad{background:var(--bad-bg);color:var(--bad)}
.pl .next{display:flex;flex-direction:column;gap:4px;align-items:flex-start}.pl .next button{padding:5px 14px;min-height:40px;font-size:14px}
.pl .drawer{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:18px 20px;align-self:start;position:sticky;top:16px}
.pl .close{float:right;min-height:36px;padding:4px 12px}
.pl .tabs{display:flex;gap:4px;margin:14px 0;border-bottom:1px solid var(--line);flex-wrap:wrap}
.pl .tab{border:0;border-bottom:3px solid transparent;border-radius:0;background:none;padding:8px 12px}
.pl .tab[aria-selected="true"]{border-bottom-color:var(--brand);font-weight:700}
.pl .slots{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.pl .slot{border:2px dashed #c9c2b2;border-radius:12px;min-height:170px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:6px;text-align:center;padding:8px;background:#faf8f3}
.pl .slot.filled{border-style:solid;border-color:var(--ok);background:var(--ok-bg)}
.pl .slot img{width:72px;height:96px;object-fit:cover;border-radius:8px}
.pl .seg{border:1px solid var(--line);border-radius:10px;margin-bottom:8px;overflow:hidden}
.pl .seg summary{cursor:pointer;padding:10px 14px;min-height:44px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}
.pl .seg textarea,.pl .rp{width:100%;min-height:220px;border:0;border-top:1px solid var(--line);padding:12px 14px;font:13px/1.6 Consolas,"Leelawadee UI",monospace;background:#fffdf5;color:var(--ink);resize:vertical;display:block}
.pl .rp{border:1px solid var(--line);border-radius:10px;min-height:260px;margin:8px 0}
.pl .segbar{display:flex;gap:8px;flex-wrap:wrap;align-items:center;padding:10px 14px;border-top:1px solid var(--line)}
.pl .spacer{flex:1}.pl .edited{color:var(--wait);font-weight:600;font-size:13px}
.pl .tblwrap{overflow-x:auto}.pl table.t{width:100%;border-collapse:collapse;font-size:14px}
.pl table.t th{text-align:left;color:var(--muted);font-weight:500;padding:6px 8px 6px 0}.pl table.t td{padding:8px 8px 8px 0;border-top:1px solid var(--line);vertical-align:top}
.pl .mono{font-family:Consolas,monospace;font-size:12px;word-break:break-all}.pl .bad-text{color:var(--bad)}
.pl .orph{margin-top:16px;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 16px}.pl .orph ul{margin:8px 0 0;padding-left:18px;font-size:14px}
.pl .modal{position:fixed;inset:0;background:rgba(38,35,31,.55);display:flex;align-items:center;justify-content:center;padding:16px;z-index:60}
.pl .sheet{background:var(--card);border-radius:16px;max-width:780px;width:100%;max-height:90vh;overflow:auto;padding:20px}.pl .sheet.narrow{max-width:640px}
.pl .between{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-bottom:12px}
.pl .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(110px,1fr));gap:10px;margin:12px 0}
.pl .pick{padding:8px;font-size:12px;text-align:center;border:2px solid var(--line);border-radius:12px;display:flex;flex-direction:column;gap:6px;align-items:center;min-height:44px}
.pl .pick img{width:100%;height:120px;object-fit:cover;border-radius:8px}.pl .pick:hover:not(:disabled){border-color:var(--brand)}
.pl .pick.up{border-style:dashed;color:var(--brand);font-weight:700;justify-content:center;min-height:150px}.pl .plus{font-size:28px}
.pl .chk{display:flex;gap:10px;align-items:flex-start;font-size:14px;margin:6px 0}
@media (prefers-reduced-motion:no-preference){.pl .row,.pl button{transition:background .15s,border-color .15s}}
`
