'use client'

import React, { useState, useEffect, useMemo } from 'react'

const STATUS_STYLES: Record<string, string> = {
    pending: 'bg-slate-800 text-slate-300',
    qc_fail: 'bg-rose-900/50 text-rose-400',
    approved: 'bg-emerald-900/50 text-emerald-400',
    posted: 'bg-cyan-900/50 text-cyan-400',
}

const STATUS_LABELS: Record<string, string> = {
    pending: 'Pending',
    qc_fail: 'QA Not Pass',
    approved: 'Approved',
    posted: 'Posted',
}

const CHAR_EMOJI: Record<string, string> = { momo: '💜', anong: '🇹🇭' }

const slugify = (s: string) =>
    (s || 'untitled')
        .trim()
        .replace(/[\\/:*?"<>|]/g, '')
        .replace(/\s+/g, '_')
        .slice(0, 60)

const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
}

const TABS = [
    { key: 'queue', label: '📋 Queue' },
    { key: 'calendar', label: '📅 Calendar' },
    { key: 'assets', label: '🖼️ Assets' },
] as const

type TabKey = typeof TABS[number]['key']

export default function ContentPipelineDashboard() {
    const [tab, setTab] = useState<TabKey>('queue')

    return (
        <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-20">
            <header className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">🧬 Content Pipeline</h2>
                <p className="text-sm text-slate-400 mt-2">
                    ผลลัพธ์จาก content-calendar / content-request skill — จัดตารางลงคอนเทนต์,
                    เก็บรูป reference, และติดตามผลลัพธ์หลังโพสต์ได้ที่นี่
                </p>
                <div className="flex gap-2 mt-4">
                    {TABS.map(t => (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`px-4 py-2 rounded-lg text-sm font-bold border ${tab === t.key
                                ? 'bg-cyan-900/40 border-cyan-700 text-cyan-300'
                                : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'}`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
            </header>

            {tab === 'queue' && <QueueTab />}
            {tab === 'calendar' && <CalendarTab />}
            {tab === 'assets' && <AssetsTab />}
        </div>
    )
}

// ─── Queue Tab ──────────────────────────────────────────────────────────────

function QueueTab() {
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [characterFilter, setCharacterFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [expandedId, setExpandedId] = useState<string | null>(null)

    useEffect(() => {
        fetchItems()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [characterFilter, statusFilter])

    const fetchItems = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (characterFilter) params.set('character', characterFilter)
            if (statusFilter) params.set('status', statusFilter)
            const res = await fetch(`/api/pipeline/items?${params.toString()}`).then(r => r.json())
            if (res.success) setItems(res.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const characters = Array.from(new Set(items.map(i => i.character))).sort()

    return (
        <>
            <div className="flex flex-wrap gap-3 items-center">
                <select
                    value={characterFilter}
                    onChange={e => setCharacterFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">All characters</option>
                    {characters.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
                <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">All statuses</option>
                    {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button onClick={fetchItems} className="text-xs font-bold text-cyan-400 hover:text-white">↻ Refresh</button>
            </div>

            {loading ? (
                <div className="text-slate-400">Loading...</div>
            ) : items.length === 0 ? (
                <div className="border border-dashed border-slate-700 rounded-2xl p-12 text-center">
                    <span className="text-4xl block mb-4 opacity-70">👻</span>
                    <p className="text-slate-400">No content items yet — run content-request/content-calendar to populate this queue.</p>
                </div>
            ) : (
                <div className="flex flex-col gap-4">
                    {items.map(item => (
                        <ItemCard
                            key={item.id}
                            item={item}
                            expanded={expandedId === item.id}
                            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            onUpdated={fetchItems}
                        />
                    ))}
                </div>
            )}
        </>
    )
}

function ItemCard({ item, expanded, onToggle, onUpdated }: { item: any, expanded: boolean, onToggle: () => void, onUpdated: () => void }) {
    const [note, setNote] = useState(item.note || '')
    const [title, setTitle] = useState(item.title || '')
    const [status, setStatus] = useState(item.status)
    const [scheduledDate, setScheduledDate] = useState(item.scheduled_date || '')
    const [followUp, setFollowUp] = useState({
        views: item.views ?? '',
        retention_pct: item.retention_pct ?? '',
        likes: item.likes ?? '',
        comments_count: item.comments_count ?? '',
        shares: item.shares ?? '',
        rating: item.rating ?? '',
        follow_up_notes: item.follow_up_notes || '',
    })
    const [saving, setSaving] = useState(false)

    const saveFields = async (fields: Record<string, any>) => {
        setSaving(true)
        try {
            await fetch(`/api/pipeline/items/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields),
            })
            onUpdated()
        } catch (e) {
            console.error(e)
        } finally {
            setSaving(false)
        }
    }

    const saveFollowUpField = (key: string, value: string) => {
        const updated = { ...followUp, [key]: value }
        setFollowUp(updated)
        const parsed = value === '' ? null : (key === 'follow_up_notes' ? value : Number(value))
        saveFields({ [key]: parsed })
    }

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4 cursor-pointer" onClick={onToggle}>
                <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg">{CHAR_EMOJI[item.character] || '🎭'}</span>
                    <div className="min-w-0">
                        <div className="font-bold text-sm truncate">
                            {item.title || item.core_mechanic || 'Untitled'}
                            <span className="text-slate-500 font-normal"> — {item.character}</span>
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                            {item.content_category || 'uncategorized'}
                            {item.core_mechanic ? ` · ${item.core_mechanic}` : ''}
                            {' · '}{item.delivery_format} {item.visual_format ? `· ${item.visual_format}` : ''} {item.platform ? `· ${item.platform}` : ''} {item.model ? `· ${item.model}` : ''}
                            {item.scheduled_date ? ` · 📅 ${item.scheduled_date}` : ''}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
                        {STATUS_LABELS[status] || status}
                    </span>
                    <span className="text-slate-500 text-xs">{expanded ? '▲' : '▼'}</span>
                </div>
            </div>

            {expanded && (
                <div className="border-t border-slate-800 p-4 flex flex-col gap-4" onClick={e => e.stopPropagation()}>
                    <div>
                        <label className="text-xs font-bold text-slate-400 block mb-1">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            onBlur={() => saveFields({ title })}
                            placeholder="ตั้งชื่อสั้นๆ ให้จำง่าย เช่น 'GPS' หรือ 'Dating an Asian Girl'"
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-cyan-500 outline-none"
                        />
                    </div>
                    {item.character_take && (
                        <div>
                            <label className="text-xs font-bold text-slate-400 block mb-1">Character Take</label>
                            <p className="text-sm bg-slate-950 border border-slate-800 rounded-lg p-3 whitespace-pre-wrap">{item.character_take}</p>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => downloadText(`${item.character}_${slugify(item.title)}_compiled_prompt.txt`, item.compiled_prompt)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold"
                        >
                            📄 Download .txt
                        </button>
                        {item.srt_content && (
                            <button
                                onClick={() => downloadText(`${item.character}_${slugify(item.title)}.srt`, item.srt_content)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold"
                            >
                                💬 Download .srt
                            </button>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-bold text-slate-400 block mb-1">Status</label>
                            <select
                                value={status}
                                onChange={e => { setStatus(e.target.value); saveFields({ status: e.target.value }) }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            >
                                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 block mb-1">Scheduled Date</label>
                            <input
                                type="date"
                                value={scheduledDate}
                                onChange={e => { setScheduledDate(e.target.value); saveFields({ scheduled_date: e.target.value || null }) }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-400 block mb-1">
                            Note {saving && <span className="text-cyan-400 font-normal">saving...</span>}
                        </label>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            onBlur={() => saveFields({ note })}
                            placeholder="บอกว่าขาดอะไร ต้องแก้อะไร — Claude จะอ่านตรงนี้ครั้งหน้าที่สั่งงาน"
                            className="w-full h-24 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:border-cyan-500 outline-none"
                        />
                    </div>

                    <details className="text-xs" open={status === 'posted'}>
                        <summary className="cursor-pointer text-slate-400 font-bold">📈 Follow-up / Performance</summary>
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                            <FollowUpField label="Views" value={followUp.views} onChange={v => saveFollowUpField('views', v)} type="number" />
                            <FollowUpField label="Retention %" value={followUp.retention_pct} onChange={v => saveFollowUpField('retention_pct', v)} type="number" step="0.1" />
                            <FollowUpField label="Likes" value={followUp.likes} onChange={v => saveFollowUpField('likes', v)} type="number" />
                            <FollowUpField label="Comments" value={followUp.comments_count} onChange={v => saveFollowUpField('comments_count', v)} type="number" />
                            <FollowUpField label="Shares" value={followUp.shares} onChange={v => saveFollowUpField('shares', v)} type="number" />
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 block mb-1">Rating (1-5)</label>
                                <select
                                    value={followUp.rating}
                                    onChange={e => saveFollowUpField('rating', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm"
                                >
                                    <option value="">—</option>
                                    {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{'⭐'.repeat(n)}</option>)}
                                </select>
                            </div>
                        </div>
                        <textarea
                            value={followUp.follow_up_notes}
                            onChange={e => setFollowUp({ ...followUp, follow_up_notes: e.target.value })}
                            onBlur={() => saveFields({ follow_up_notes: followUp.follow_up_notes })}
                            placeholder="สิ่งที่เรียนรู้จากคอนเทนต์นี้ — เอาไว้ใช้ตอนวางแผนครั้งต่อไป"
                            className="w-full h-20 mt-3 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:border-cyan-500 outline-none"
                        />
                    </details>

                    {item.validation_report && (
                        <details className="text-xs">
                            <summary className="cursor-pointer text-slate-400 font-bold">Validation Report</summary>
                            <pre className="mt-2 bg-slate-950 border border-slate-800 rounded-lg p-3 overflow-x-auto text-slate-400">
                                {JSON.stringify(item.validation_report, null, 2)}
                            </pre>
                        </details>
                    )}
                </div>
            )}
        </div>
    )
}

function FollowUpField({ label, value, onChange, type = 'text', step }: { label: string, value: any, onChange: (v: string) => void, type?: string, step?: string }) {
    const [local, setLocal] = useState(value ?? '')
    useEffect(() => setLocal(value ?? ''), [value])
    return (
        <div>
            <label className="text-[10px] font-bold text-slate-500 block mb-1">{label}</label>
            <input
                type={type}
                step={step}
                value={local}
                onChange={e => setLocal(e.target.value)}
                onBlur={() => onChange(local)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-sm"
            />
        </div>
    )
}

// ─── Calendar Tab ───────────────────────────────────────────────────────────

function CalendarTab() {
    const today = new Date()
    const [monthCursor, setMonthCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
    const [items, setItems] = useState<any[]>([])
    const [unscheduled, setUnscheduled] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [pickerDate, setPickerDate] = useState<string | null>(null)

    const rangeStart = useMemo(() => {
        const d = new Date(monthCursor)
        d.setDate(1)
        return d
    }, [monthCursor])
    const rangeEnd = useMemo(() => {
        const d = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0)
        return d
    }, [monthCursor])

    const fmt = (d: Date) => d.toISOString().slice(0, 10)

    const fetchData = async () => {
        setLoading(true)
        try {
            const scheduledRes = await fetch(`/api/pipeline/items?scheduled_from=${fmt(rangeStart)}&scheduled_to=${fmt(rangeEnd)}`).then(r => r.json())
            if (scheduledRes.success) setItems(scheduledRes.data)

            const allRes = await fetch(`/api/pipeline/items`).then(r => r.json())
            if (allRes.success) setUnscheduled(allRes.data.filter((i: any) => !i.scheduled_date))
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchData()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [monthCursor])

    const assignDate = async (itemId: string, date: string) => {
        await fetch(`/api/pipeline/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduled_date: date }),
        })
        setPickerDate(null)
        fetchData()
    }

    const clearDate = async (itemId: string) => {
        await fetch(`/api/pipeline/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduled_date: null }),
        })
        fetchData()
    }

    // build the grid: leading blanks + days of month
    const firstWeekday = rangeStart.getDay() // 0 = Sun
    const daysInMonth = rangeEnd.getDate()
    const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)]

    const itemsByDate = useMemo(() => {
        const map: Record<string, any[]> = {}
        for (const it of items) {
            if (!it.scheduled_date) continue
            map[it.scheduled_date] = map[it.scheduled_date] || []
            map[it.scheduled_date].push(it)
        }
        return map
    }, [items])

    const monthLabel = monthCursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })

    return (
        <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() - 1, 1))}
                        className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm"
                    >←</button>
                    <span className="font-bold">{monthLabel}</span>
                    <button
                        onClick={() => setMonthCursor(new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 1))}
                        className="px-3 py-1.5 bg-slate-900 border border-slate-700 rounded-lg text-sm"
                    >→</button>
                </div>
                {unscheduled.length > 0 && (
                    <span className="text-xs text-slate-500">{unscheduled.length} unscheduled item(s) — click a day to assign one</span>
                )}
            </div>

            {loading ? (
                <div className="text-slate-400">Loading...</div>
            ) : (
                <div className="grid grid-cols-7 gap-2">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="text-center text-xs font-bold text-slate-500 pb-1">{d}</div>
                    ))}
                    {cells.map((day, idx) => {
                        if (day === null) return <div key={`b${idx}`} />
                        const dateStr = `${monthCursor.getFullYear()}-${String(monthCursor.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                        const dayItems = itemsByDate[dateStr] || []
                        const isToday = dateStr === fmt(today)
                        return (
                            <div
                                key={dateStr}
                                className={`min-h-[100px] bg-slate-900 border rounded-xl p-2 flex flex-col gap-1 cursor-pointer ${isToday ? 'border-cyan-600' : 'border-slate-800'}`}
                                onClick={() => setPickerDate(dateStr)}
                            >
                                <div className={`text-xs font-bold ${isToday ? 'text-cyan-400' : 'text-slate-500'}`}>{day}</div>
                                {dayItems.map(it => (
                                    <div
                                        key={it.id}
                                        className={`text-[10px] px-1.5 py-1 rounded-md truncate ${STATUS_STYLES[it.status] || STATUS_STYLES.pending}`}
                                        title={`${it.character} — ${it.title || it.core_mechanic || it.content_category || ''}`}
                                        onClick={(e) => { e.stopPropagation(); if (confirm(`Unschedule "${it.title || it.core_mechanic || it.content_category}"?`)) clearDate(it.id) }}
                                    >
                                        {CHAR_EMOJI[it.character] || '🎭'} {it.title || it.core_mechanic || it.content_category || 'item'}
                                    </div>
                                ))}
                            </div>
                        )
                    })}
                </div>
            )}

            {pickerDate && (
                <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={() => setPickerDate(null)}>
                    <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-md w-full max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h3 className="font-bold mb-4">Assign content to {pickerDate}</h3>
                        {unscheduled.length === 0 ? (
                            <p className="text-sm text-slate-400">No unscheduled items available. All items are either scheduled or already posted.</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {unscheduled.map(it => (
                                    <button
                                        key={it.id}
                                        onClick={() => assignDate(it.id, pickerDate)}
                                        className="text-left px-3 py-2 bg-slate-950 border border-slate-800 hover:border-cyan-600 rounded-lg text-sm"
                                    >
                                        <span className="font-bold">{CHAR_EMOJI[it.character] || '🎭'} {it.title || it.core_mechanic || it.content_category || 'item'}</span>
                                        <span className="text-slate-500"> — {it.character}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                        <button onClick={() => setPickerDate(null)} className="mt-4 text-xs text-slate-500 hover:text-white">Close</button>
                    </div>
                </div>
            )}
        </div>
    )
}

// ─── Assets Tab ─────────────────────────────────────────────────────────────

function AssetsTab() {
    const [assets, setAssets] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [characterFilter, setCharacterFilter] = useState('')
    const [uploading, setUploading] = useState(false)
    const [uploadCharacter, setUploadCharacter] = useState('')
    const [uploadLabel, setUploadLabel] = useState('')

    const fetchAssets = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (characterFilter) params.set('character', characterFilter)
            const res = await fetch(`/api/pipeline/assets?${params.toString()}`).then(r => r.json())
            if (res.success) setAssets(res.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchAssets()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [characterFilter])

    const handleFiles = async (files: FileList | null) => {
        if (!files || files.length === 0) return
        setUploading(true)
        try {
            for (const file of Array.from(files)) {
                const formData = new FormData()
                formData.append('file', file)
                if (uploadCharacter) formData.append('character', uploadCharacter)
                formData.append('label', uploadLabel || file.name)
                await fetch('/api/pipeline/assets', { method: 'POST', body: formData })
            }
            fetchAssets()
        } catch (e) {
            console.error(e)
        } finally {
            setUploading(false)
        }
    }

    const deleteAsset = async (id: string) => {
        if (!confirm('Delete this asset permanently?')) return
        await fetch(`/api/pipeline/assets/${id}`, { method: 'DELETE' })
        fetchAssets()
    }

    const downloadAsset = async (url: string, label: string) => {
        const res = await fetch(url)
        const blob = await res.blob()
        const objUrl = URL.createObjectURL(blob)
        const link = document.createElement('a')
        link.href = objUrl
        link.download = label
        link.click()
        URL.revokeObjectURL(objUrl)
    }

    return (
        <div className="flex flex-col gap-6">
            <div
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
                className="border-2 border-dashed border-slate-700 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-4"
            >
                <div className="flex-1 w-full flex flex-col sm:flex-row gap-3">
                    <select
                        value={uploadCharacter}
                        onChange={e => setUploadCharacter(e.target.value)}
                        className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                    >
                        <option value="">Shared / General</option>
                        <option value="momo">momo</option>
                        <option value="anong">anong</option>
                    </select>
                    <input
                        type="text"
                        placeholder="Label (optional)"
                        value={uploadLabel}
                        onChange={e => setUploadLabel(e.target.value)}
                        className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                    />
                    <label className="px-4 py-2 bg-cyan-900/40 border border-cyan-700 text-cyan-300 rounded-lg text-sm font-bold cursor-pointer text-center">
                        {uploading ? 'Uploading...' : '⬆️ Choose files or drop here'}
                        <input type="file" multiple accept="image/*" className="hidden" onChange={e => handleFiles(e.target.files)} disabled={uploading} />
                    </label>
                </div>
            </div>

            <div className="flex items-center gap-3">
                <select
                    value={characterFilter}
                    onChange={e => setCharacterFilter(e.target.value)}
                    className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                >
                    <option value="">All</option>
                    <option value="momo">momo</option>
                    <option value="anong">anong</option>
                </select>
                <button onClick={fetchAssets} className="text-xs font-bold text-cyan-400 hover:text-white">↻ Refresh</button>
            </div>

            {loading ? (
                <div className="text-slate-400">Loading...</div>
            ) : assets.length === 0 ? (
                <div className="border border-dashed border-slate-700 rounded-2xl p-12 text-center">
                    <span className="text-4xl block mb-4 opacity-70">🖼️</span>
                    <p className="text-slate-400">No assets yet — upload reference photos above so they're here from any machine.</p>
                </div>
            ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {assets.map(a => (
                        <div key={a.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden flex flex-col">
                            <div className="aspect-square bg-slate-950">
                                {a.content_type?.startsWith('image/') ? (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img src={a.url} alt={a.label} className="w-full h-full object-cover" />
                                ) : (
                                    <div className="w-full h-full flex items-center justify-center text-3xl">📄</div>
                                )}
                            </div>
                            <div className="p-2 flex flex-col gap-1">
                                <div className="text-xs font-bold truncate" title={a.label}>{a.label}</div>
                                <div className="text-[10px] text-slate-500">{CHAR_EMOJI[a.character] || '🌐'} {a.character || 'shared'}</div>
                                <div className="flex gap-1 mt-1">
                                    <button onClick={() => downloadAsset(a.url, a.label)} className="flex-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 rounded-md py-1">⬇️ Download</button>
                                    <button onClick={() => deleteAsset(a.id)} className="text-[10px] font-bold bg-rose-950/50 hover:bg-rose-900/50 text-rose-400 rounded-md px-2">✕</button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
