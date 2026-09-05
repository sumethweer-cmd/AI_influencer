'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'

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

const PLATFORMS = [
    { key: 'tiktok', label: 'TikTok', emoji: '🎵' },
    { key: 'instagram', label: 'Instagram', emoji: '📸' },
    { key: 'facebook', label: 'Facebook', emoji: '📘' },
] as const

const toDatetimeLocal = (iso: string) => {
    const d = new Date(iso)
    if (isNaN(d.getTime())) return ''
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

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

    // Applied after an ItemCard successfully saves a field — merges the change
    // straight into local state instead of re-fetching the whole list. Re-fetching
    // flips `loading` back to true, which swaps the entire item list out for a
    // "Loading..." placeholder for a moment — visually indistinguishable from a
    // full page refresh, and it drops scroll position + any expanded cards.
    const patchItemLocal = (id: string, patch: Record<string, any>) => {
        setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i))
    }

    const characters = Array.from(new Set(items.map(i => i.character))).sort()

    // Group multi-segment items (a minimax-h3 item split above the 15s
    // generation limit — see model_specs/minimax-h3.md) so segment 2+ render
    // as parts of one card instead of confusing duplicate-titled cards.
    // A "primary" row has no parent; its segments are itself plus any rows
    // whose parent_content_item_id points back to it, ordered by segment_number.
    const primaryItems = items.filter(i => !i.parent_content_item_id)
    const segmentsByParent = useMemo(() => {
        const map: Record<string, any[]> = {}
        for (const i of items) {
            if (!i.parent_content_item_id) continue
            map[i.parent_content_item_id] = map[i.parent_content_item_id] || []
            map[i.parent_content_item_id].push(i)
        }
        for (const id in map) map[id].sort((a, b) => (a.segment_number ?? 99) - (b.segment_number ?? 99))
        return map
    }, [items])

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
                    {primaryItems.map(item => (
                        <ItemCard
                            key={item.id}
                            item={item}
                            segments={segmentsByParent[item.id] ? [item, ...segmentsByParent[item.id]] : null}
                            expanded={expandedId === item.id}
                            onToggle={() => setExpandedId(expandedId === item.id ? null : item.id)}
                            onSaved={patchItemLocal}
                        />
                    ))}
                </div>
            )}
        </>
    )
}

function ItemCard({ item, segments, expanded, onToggle, onSaved }: { item: any, segments?: any[] | null, expanded: boolean, onToggle: () => void, onSaved: (id: string, patch: Record<string, any>) => void }) {
    const [note, setNote] = useState(item.note || '')
    const [title, setTitle] = useState(item.title || '')
    const [status, setStatus] = useState(item.status)
    // Multi-segment items (a minimax-h3 item split above the 15s generation
    // limit — see model_specs/minimax-h3.md) share one card; only the
    // compiled prompt / SRT / download section switches per part. Everything
    // else (scheduling, note, assets, follow-up) belongs to the whole piece
    // and is always read/written on the primary (segment 1) row, `item`.
    const [activeSegmentIdx, setActiveSegmentIdx] = useState(0)
    const activeSegment = segments ? segments[activeSegmentIdx] : item
    const [compiledPrompt, setCompiledPrompt] = useState(activeSegment.compiled_prompt || '')
    const [srtContent, setSrtContent] = useState(activeSegment.srt_content || '')
    const [savingPrompt, setSavingPrompt] = useState(false)
    const [savingSrt, setSavingSrt] = useState(false)

    // Re-sync the prompt/SRT editors when the active part changes.
    useEffect(() => {
        setCompiledPrompt(activeSegment.compiled_prompt || '')
        setSrtContent(activeSegment.srt_content || '')
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeSegment.id])
    const [scheduledDate, setScheduledDate] = useState(item.scheduled_date || '')
    const [scheduledTime, setScheduledTime] = useState(item.scheduled_time ? item.scheduled_time.slice(0, 5) : '')
    const [postedAt, setPostedAt] = useState(item.posted_at ? toDatetimeLocal(item.posted_at) : '')
    const [platformMetrics, setPlatformMetrics] = useState<Record<string, any>>(item.platform_metrics || {})
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

    // Saves straight to the row and patches the parent's local list — no
    // whole-list refetch, so the page never flashes back to a loading state.
    const saveFields = async (fields: Record<string, any>) => {
        setSaving(true)
        try {
            await fetch(`/api/pipeline/items/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fields),
            })
            onSaved(item.id, fields)
        } catch (e) {
            console.error(e)
        } finally {
            setSaving(false)
        }
    }

    const saveCompiledPrompt = async () => {
        setSavingPrompt(true)
        try {
            await fetch(`/api/pipeline/items/${activeSegment.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ compiled_prompt: compiledPrompt }),
            })
            onSaved(activeSegment.id, { compiled_prompt: compiledPrompt })
        } catch (e) {
            console.error(e)
        } finally {
            setSavingPrompt(false)
        }
    }

    const saveSrtContent = async () => {
        setSavingSrt(true)
        try {
            await fetch(`/api/pipeline/items/${activeSegment.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ srt_content: srtContent }),
            })
            onSaved(activeSegment.id, { srt_content: srtContent })
        } catch (e) {
            console.error(e)
        } finally {
            setSavingSrt(false)
        }
    }

    const saveFollowUpField = (key: string, value: string) => {
        const updated = { ...followUp, [key]: value }
        setFollowUp(updated)
        const parsed = value === '' ? null : (key === 'follow_up_notes' ? value : Number(value))
        saveFields({ [key]: parsed })
    }

    const savePostedAt = (value: string) => {
        setPostedAt(value)
        saveFields({ posted_at: value ? new Date(value).toISOString() : null })
    }

    const savePlatformField = (platform: string, field: string, value: string) => {
        const current = platformMetrics[platform] || {}
        const parsed = value === '' ? null : Number(value)
        const updated = { ...platformMetrics, [platform]: { ...current, [field]: parsed } }
        setPlatformMetrics(updated)
        saveFields({ platform_metrics: updated })
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
                            {item.scheduled_date ? ` · 📅 ${item.scheduled_date}${item.scheduled_time ? ` ${item.scheduled_time.slice(0, 5)}` : ''}` : ''}
                            {item.posted_at ? ` · 🕐 ${new Date(item.posted_at).toLocaleString()}` : ''}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                    {segments && segments.length > 1 && (
                        <span className="text-[10px] font-bold px-2 py-1 rounded-full bg-indigo-900/50 text-indigo-300" title="Split into multiple generation calls — see model_specs/minimax-h3.md's 15s duration limit">
                            🎬 {segments.length} parts
                        </span>
                    )}
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

                    {segments && segments.length > 1 && (
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-slate-400">🎬 Generation parts:</span>
                            {segments.map((seg, i) => (
                                <button
                                    key={seg.id}
                                    onClick={() => setActiveSegmentIdx(i)}
                                    className={`px-3 py-1 rounded-lg text-xs font-bold border ${activeSegmentIdx === i ? 'bg-indigo-900/50 border-indigo-600 text-indigo-300' : 'bg-slate-950 border-slate-700 text-slate-400 hover:border-slate-500'}`}
                                >
                                    Part {seg.segment_number ?? i + 1}/{segments.length}
                                </button>
                            ))}
                            <span className="text-[11px] text-slate-500">generate each part separately, then join the clips in order</span>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => downloadText(`${item.character}_${slugify(item.title)}${segments && segments.length > 1 ? `_part${activeSegment.segment_number ?? activeSegmentIdx + 1}` : ''}_compiled_prompt.txt`, activeSegment.compiled_prompt)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold"
                        >
                            📄 Download .txt
                        </button>
                        {activeSegment.srt_content && (
                            <button
                                onClick={() => downloadText(`${item.character}_${slugify(item.title)}${segments && segments.length > 1 ? `_part${activeSegment.segment_number ?? activeSegmentIdx + 1}` : ''}.srt`, activeSegment.srt_content)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold"
                            >
                                💬 Download .srt
                            </button>
                        )}
                    </div>

                    <details className="text-xs">
                        <summary className="cursor-pointer text-slate-400 font-bold">
                            📄 Compiled Prompt (view / edit){segments && segments.length > 1 ? ` — Part ${activeSegment.segment_number ?? activeSegmentIdx + 1}/${segments.length}` : ''}
                        </summary>
                        <div className="mt-2 flex flex-col gap-2">
                            <textarea
                                value={compiledPrompt}
                                onChange={e => setCompiledPrompt(e.target.value)}
                                spellCheck={false}
                                className="w-full h-72 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap focus:border-cyan-500 outline-none"
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={saveCompiledPrompt}
                                    disabled={savingPrompt || compiledPrompt === activeSegment.compiled_prompt}
                                    className="px-4 py-1.5 bg-cyan-900/40 border border-cyan-700 text-cyan-300 rounded-lg text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {savingPrompt ? 'Saving...' : '💾 Save Prompt'}
                                </button>
                                {compiledPrompt !== activeSegment.compiled_prompt && !savingPrompt && (
                                    <span className="text-amber-400">unsaved changes</span>
                                )}
                            </div>
                        </div>
                    </details>

                    <details className="text-xs">
                        <summary className="cursor-pointer text-slate-400 font-bold">
                            💬 SRT (view / edit){segments && segments.length > 1 ? ` — Part ${activeSegment.segment_number ?? activeSegmentIdx + 1}/${segments.length}` : ''}
                        </summary>
                        <div className="mt-2 flex flex-col gap-2">
                            <textarea
                                value={srtContent}
                                onChange={e => setSrtContent(e.target.value)}
                                spellCheck={false}
                                placeholder="No .srt yet — you can write/paste one here and save it."
                                className="w-full h-48 bg-slate-950 border border-slate-800 rounded-lg p-3 text-xs font-mono whitespace-pre-wrap focus:border-cyan-500 outline-none"
                            />
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={saveSrtContent}
                                    disabled={savingSrt || srtContent === (activeSegment.srt_content || '')}
                                    className="px-4 py-1.5 bg-cyan-900/40 border border-cyan-700 text-cyan-300 rounded-lg text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    {savingSrt ? 'Saving...' : '💾 Save SRT'}
                                </button>
                                {srtContent !== (activeSegment.srt_content || '') && !savingSrt && (
                                    <span className="text-amber-400">unsaved changes</span>
                                )}
                            </div>
                        </div>
                    </details>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
                                style={{ colorScheme: 'dark' }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 block mb-1">Scheduled Time (แนะนำตามช่วง peak)</label>
                            <input
                                type="time"
                                value={scheduledTime}
                                onChange={e => { setScheduledTime(e.target.value); saveFields({ scheduled_time: e.target.value || null }) }}
                                style={{ colorScheme: 'dark' }}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 block mb-1">Posted At (วัน+เวลาที่ลงจริง)</label>
                            <input
                                type="datetime-local"
                                value={postedAt}
                                onChange={e => savePostedAt(e.target.value)}
                                style={{ colorScheme: 'dark' }}
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

                        <div className="mt-3">
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Total (all platforms combined)</label>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
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
                        </div>

                        <div className="mt-4">
                            <label className="text-[10px] font-bold text-slate-500 block mb-1">Breakdown by Platform</label>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs border-separate border-spacing-y-1">
                                    <thead>
                                        <tr className="text-slate-500 text-left">
                                            <th className="pr-2 font-bold">Platform</th>
                                            <th className="px-1 font-bold">Views</th>
                                            <th className="px-1 font-bold">Likes</th>
                                            <th className="px-1 font-bold">Comments</th>
                                            <th className="px-1 font-bold">Shares</th>
                                            <th className="px-1 font-bold">Retention %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {PLATFORMS.map(p => (
                                            <tr key={p.key} className="bg-slate-950">
                                                <td className="pr-2 py-1.5 pl-2 rounded-l-lg font-bold whitespace-nowrap">{p.emoji} {p.label}</td>
                                                <td className="px-1"><PlatformMetricInput value={platformMetrics[p.key]?.views} onChange={v => savePlatformField(p.key, 'views', v)} /></td>
                                                <td className="px-1"><PlatformMetricInput value={platformMetrics[p.key]?.likes} onChange={v => savePlatformField(p.key, 'likes', v)} /></td>
                                                <td className="px-1"><PlatformMetricInput value={platformMetrics[p.key]?.comments} onChange={v => savePlatformField(p.key, 'comments', v)} /></td>
                                                <td className="px-1"><PlatformMetricInput value={platformMetrics[p.key]?.shares} onChange={v => savePlatformField(p.key, 'shares', v)} /></td>
                                                <td className="px-1 rounded-r-lg"><PlatformMetricInput value={platformMetrics[p.key]?.retention_pct} onChange={v => savePlatformField(p.key, 'retention_pct', v)} step="0.1" /></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
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

                    <ItemAssets item={item} />

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

function PlatformMetricInput({ value, onChange, step }: { value: any, onChange: (v: string) => void, step?: string }) {
    const [local, setLocal] = useState(value ?? '')
    useEffect(() => setLocal(value ?? ''), [value])
    return (
        <input
            type="number"
            step={step}
            value={local}
            onChange={e => setLocal(e.target.value)}
            onBlur={() => onChange(local)}
            placeholder="—"
            className="w-20 bg-slate-900 border border-slate-700 rounded-md px-2 py-1 text-xs"
        />
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

const readJsonOrThrow = async (res: Response, context: string) => {
    let json: any
    try {
        json = await res.json()
    } catch {
        throw new Error(`${context} returned an unreadable response (HTTP ${res.status}). This usually means the request was rejected before it reached our server (e.g. a platform size limit).`)
    }
    if (!res.ok || json.success === false) {
        throw new Error(json?.error || `${context} failed (HTTP ${res.status})`)
    }
    return json
}

// Uploads a file straight to Supabase Storage via a signed upload token
// (never passes through our own Next.js server), then records its metadata
// — avoids the ~4.5MB request-body limit serverless platforms impose on API
// routes, which video clips blow past easily.
const uploadAsset = async (file: File, meta: {
    character?: string | null, itemId?: string | null, pictureSlot?: number | null, assetType?: string, label?: string,
}) => {
    let signRes: Response
    try {
        signRes = await fetch('/api/pipeline/assets/signed-url', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ filename: file.name, character: meta.character, itemId: meta.itemId }),
        })
    } catch (e: any) {
        throw new Error(`Network error requesting an upload slot: ${e.message}`)
    }
    const { path, token, publicUrl } = await readJsonOrThrow(signRes, 'Requesting an upload slot')

    const { error: uploadError } = await supabase.storage.from('pipeline-assets').uploadToSignedUrl(path, token, file, {
        contentType: file.type || 'application/octet-stream',
    })
    if (uploadError) {
        throw new Error(`Storage rejected the upload: ${uploadError.message}`)
    }

    const finalizeRes = await fetch('/api/pipeline/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            path, url: publicUrl,
            character: meta.character, label: meta.label || file.name,
            itemId: meta.itemId, pictureSlot: meta.pictureSlot, assetType: meta.assetType || 'reference',
            contentType: file.type || null, sizeBytes: file.size,
        }),
    })
    const finalized = await readJsonOrThrow(finalizeRes, 'Saving the upload')
    return finalized.data
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

function ItemAssets({ item }: { item: any }) {
    const [assets, setAssets] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [uploadingSlot, setUploadingSlot] = useState<number | null>(null)
    const [uploadingOutput, setUploadingOutput] = useState(false)
    const [uploadingAnalytics, setUploadingAnalytics] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const maxSlot = useMemo(() => {
        const matches = [...(item.compiled_prompt || '').matchAll(/<Picture (\d+)>/g)]
        return matches.length ? Math.max(...matches.map(m => Number(m[1]))) : 3
    }, [item.compiled_prompt])

    const fetchAssets = async () => {
        setLoading(true)
        try {
            const res = await fetch(`/api/pipeline/assets?item_id=${item.id}`).then(r => r.json())
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
    }, [item.id])

    const referenceAssets = assets.filter(a => a.asset_type === 'reference' || !a.asset_type)
    const outputAssets = assets.filter(a => a.asset_type === 'output')
    const analyticsAssets = assets.filter(a => a.asset_type === 'analytics')
    const assetForSlot = (slot: number) => referenceAssets.find(a => a.picture_slot === slot)

    const uploadToSlot = async (slot: number, file: File) => {
        setUploadingSlot(slot)
        setError(null)
        try {
            await uploadAsset(file, {
                character: item.character, itemId: item.id, pictureSlot: slot, assetType: 'reference',
                label: `${item.title || item.character} — Picture ${slot}`,
            })
            fetchAssets()
        } catch (e: any) {
            console.error(e)
            setError(e.message)
        } finally {
            setUploadingSlot(null)
        }
    }

    const uploadOutput = async (files: FileList | null) => {
        if (!files || files.length === 0) return
        setUploadingOutput(true)
        setError(null)
        try {
            for (const file of Array.from(files)) {
                await uploadAsset(file, { character: item.character, itemId: item.id, assetType: 'output', label: file.name })
            }
            fetchAssets()
        } catch (e: any) {
            console.error(e)
            setError(e.message)
        } finally {
            setUploadingOutput(false)
        }
    }

    const uploadAnalytics = async (files: FileList | null) => {
        if (!files || files.length === 0) return
        setUploadingAnalytics(true)
        setError(null)
        try {
            for (const file of Array.from(files)) {
                await uploadAsset(file, { character: item.character, itemId: item.id, assetType: 'analytics', label: file.name })
            }
            fetchAssets()
        } catch (e: any) {
            console.error(e)
            setError(e.message)
        } finally {
            setUploadingAnalytics(false)
        }
    }

    const removeAsset = async (assetId: string) => {
        if (!confirm('Remove this file?')) return
        await fetch(`/api/pipeline/assets/${assetId}`, { method: 'DELETE' })
        fetchAssets()
    }

    return (
        <div className="flex flex-col gap-5">
            {error && (
                <div className="bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-lg px-3 py-2 flex items-start justify-between gap-2">
                    <span>⚠️ {error}</span>
                    <button onClick={() => setError(null)} className="shrink-0 text-rose-400 hover:text-white">✕</button>
                </div>
            )}
            <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                    🖼️ Reference Images (Picture 1-{maxSlot}) {loading && <span className="text-cyan-400 font-normal">loading...</span>}
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {Array.from({ length: maxSlot }, (_, i) => i + 1).map(slot => {
                        const asset = assetForSlot(slot)
                        return (
                            <div key={slot} className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
                                <div className="aspect-square bg-slate-900 flex items-center justify-center relative">
                                    {asset ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={asset.url} alt={`Picture ${slot}`} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-slate-600 text-xs">{slot === 1 ? 'Character' : `Picture ${slot}`}</span>
                                    )}
                                </div>
                                <div className="p-1.5 flex flex-col gap-1">
                                    <div className="text-[10px] text-slate-500 text-center">Picture {slot}</div>
                                    <div className="flex gap-1">
                                        <label className="flex-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 rounded-md py-1 text-center cursor-pointer">
                                            {uploadingSlot === slot ? '...' : (asset ? '🔁 Replace' : '⬆️ Upload')}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                onChange={e => { if (e.target.files?.[0]) uploadToSlot(slot, e.target.files[0]) }}
                                                disabled={uploadingSlot !== null}
                                            />
                                        </label>
                                        {asset && (
                                            <>
                                                <button onClick={() => downloadAsset(asset.url, `${item.character}_${slugify(item.title)}_picture${slot}`)} className="text-[10px] font-bold bg-slate-800 hover:bg-slate-700 rounded-md px-1.5">⬇️</button>
                                                <button onClick={() => removeAsset(asset.id)} className="text-[10px] font-bold bg-rose-950/50 hover:bg-rose-900/50 text-rose-400 rounded-md px-1.5">✕</button>
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                    🎬 Generated Output (final clip/render for this content)
                </label>
                <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {outputAssets.map(asset => (
                            <div key={asset.id} className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
                                <div className="aspect-square bg-slate-900 flex items-center justify-center">
                                    {asset.content_type?.startsWith('video/') ? (
                                        <video src={asset.url} controls className="w-full h-full object-cover" />
                                    ) : asset.content_type?.startsWith('image/') ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={asset.url} alt={asset.label} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-3xl">📄</span>
                                    )}
                                </div>
                                <div className="p-1.5 flex flex-col gap-1">
                                    <div className="text-[10px] text-slate-500 truncate text-center" title={asset.label}>{asset.label}</div>
                                    <div className="flex gap-1">
                                        <button onClick={() => downloadAsset(asset.url, asset.label)} className="flex-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 rounded-md py-1">⬇️ Download</button>
                                        <button onClick={() => removeAsset(asset.id)} className="text-[10px] font-bold bg-rose-950/50 hover:bg-rose-900/50 text-rose-400 rounded-md px-1.5">✕</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <label className="px-4 py-2 bg-cyan-900/40 border border-cyan-700 text-cyan-300 rounded-lg text-xs font-bold cursor-pointer text-center w-fit">
                        {uploadingOutput ? 'Uploading...' : '⬆️ Upload generated clip / image'}
                        <input
                            type="file"
                            multiple
                            accept="video/*,image/*"
                            className="hidden"
                            onChange={e => uploadOutput(e.target.files)}
                            disabled={uploadingOutput}
                        />
                    </label>
                </div>
            </div>

            <div>
                <label className="text-xs font-bold text-slate-400 block mb-1">
                    📊 Analytics Screenshots (retention graph, traffic source, ฯลฯ)
                </label>
                <div className="flex flex-col gap-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                        {analyticsAssets.map(asset => (
                            <div key={asset.id} className="bg-slate-950 border border-slate-800 rounded-lg overflow-hidden flex flex-col">
                                <div className="aspect-square bg-slate-900 flex items-center justify-center">
                                    {asset.content_type?.startsWith('image/') ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={asset.url} alt={asset.label} className="w-full h-full object-contain" />
                                    ) : (
                                        <span className="text-3xl">📄</span>
                                    )}
                                </div>
                                <div className="p-1.5 flex flex-col gap-1">
                                    <div className="text-[10px] text-slate-500 truncate text-center" title={asset.label}>{asset.label}</div>
                                    <div className="flex gap-1">
                                        <button onClick={() => downloadAsset(asset.url, asset.label)} className="flex-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 rounded-md py-1">⬇️ Download</button>
                                        <button onClick={() => removeAsset(asset.id)} className="text-[10px] font-bold bg-rose-950/50 hover:bg-rose-900/50 text-rose-400 rounded-md px-1.5">✕</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <label className="px-4 py-2 bg-cyan-900/40 border border-cyan-700 text-cyan-300 rounded-lg text-xs font-bold cursor-pointer text-center w-fit">
                        {uploadingAnalytics ? 'Uploading...' : '⬆️ Upload analytics screenshot'}
                        <input
                            type="file"
                            multiple
                            accept="image/*"
                            className="hidden"
                            onChange={e => uploadAnalytics(e.target.files)}
                            disabled={uploadingAnalytics}
                        />
                    </label>
                </div>
            </div>
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
            // Segment 2+ of a split minimax-h3 item (see model_specs/minimax-h3.md's
            // 15s duration limit) are generation sub-parts of one piece of content,
            // not independently postable — only the primary (segment 1) row gets a
            // calendar slot, so later segments are filtered out here.
            const scheduledRes = await fetch(`/api/pipeline/items?scheduled_from=${fmt(rangeStart)}&scheduled_to=${fmt(rangeEnd)}`).then(r => r.json())
            if (scheduledRes.success) setItems(scheduledRes.data.filter((i: any) => !i.parent_content_item_id))

            const allRes = await fetch(`/api/pipeline/items`).then(r => r.json())
            if (allRes.success) setUnscheduled(allRes.data.filter((i: any) => !i.scheduled_date && !i.parent_content_item_id))
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
        const moved = unscheduled.find(i => i.id === itemId)
        setUnscheduled(prev => prev.filter(i => i.id !== itemId))
        if (moved) setItems(prev => [...prev, { ...moved, scheduled_date: date }])
    }

    const clearDate = async (itemId: string) => {
        await fetch(`/api/pipeline/items/${itemId}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ scheduled_date: null }),
        })
        const cleared = items.find(i => i.id === itemId)
        setItems(prev => prev.filter(i => i.id !== itemId))
        if (cleared) setUnscheduled(prev => [...prev, { ...cleared, scheduled_date: null }])
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
        for (const date in map) {
            map[date].sort((a, b) => (a.scheduled_time || '99:99').localeCompare(b.scheduled_time || '99:99'))
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
                                className={`min-h-[100px] bg-slate-900 border rounded-xl p-2 flex flex-col gap-1 cursor-pointer hover:border-cyan-700 ${isToday ? 'border-cyan-600' : 'border-slate-800'}`}
                                onClick={() => setPickerDate(dateStr)}
                            >
                                <div className={`text-xs font-bold ${isToday ? 'text-cyan-400' : 'text-slate-500'}`}>{day}</div>
                                {dayItems.map(it => (
                                    <div
                                        key={it.id}
                                        className={`text-[10px] px-1.5 py-1 rounded-md truncate ${STATUS_STYLES[it.status] || STATUS_STYLES.pending}`}
                                        title={`${it.scheduled_time ? it.scheduled_time.slice(0, 5) + ' — ' : ''}${it.character} — ${it.title || it.core_mechanic || it.content_category || ''}`}
                                    >
                                        {it.scheduled_time ? `${it.scheduled_time.slice(0, 5)} ` : ''}{CHAR_EMOJI[it.character] || '🎭'} {it.title || it.core_mechanic || it.content_category || 'item'}
                                    </div>
                                ))}
                            </div>
                        )
                    })}
                </div>
            )}

            {pickerDate && (
                <DayDetailDialog
                    date={pickerDate}
                    items={itemsByDate[pickerDate] || []}
                    unscheduled={unscheduled}
                    onAssign={(itemId) => assignDate(itemId, pickerDate)}
                    onClear={clearDate}
                    onClose={() => setPickerDate(null)}
                />
            )}
        </div>
    )
}

function DayDetailDialog({ date, items, unscheduled, onAssign, onClear, onClose }: {
    date: string, items: any[], unscheduled: any[],
    onAssign: (itemId: string) => void, onClear: (itemId: string) => void, onClose: () => void,
}) {
    const [showAssign, setShowAssign] = useState(items.length === 0)

    const statLine = (it: any) => {
        const parts: string[] = []
        if (it.views != null) parts.push(`👁️ ${it.views}`)
        if (it.likes != null) parts.push(`❤️ ${it.likes}`)
        if (it.comments_count != null) parts.push(`💬 ${it.comments_count}`)
        if (it.shares != null) parts.push(`🔁 ${it.shares}`)
        if (it.retention_pct != null) parts.push(`⏱️ ${it.retention_pct}%`)
        if (it.rating != null) parts.push('⭐'.repeat(it.rating))
        return parts
    }

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 max-w-lg w-full max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                <h3 className="font-bold mb-4">{date}</h3>

                {items.length === 0 ? (
                    <p className="text-sm text-slate-400 mb-4">No content scheduled for this day yet.</p>
                ) : (
                    <div className="flex flex-col gap-2 mb-4">
                        {items.map(it => {
                            const stats = statLine(it)
                            return (
                                <div key={it.id} className="bg-slate-950 border border-slate-800 rounded-lg p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <div className="min-w-0">
                                            <div className="font-bold text-sm truncate">
                                                {CHAR_EMOJI[it.character] || '🎭'} {it.title || it.core_mechanic || it.content_category || 'item'}
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {it.character}{it.scheduled_time ? ` · 🕐 ${it.scheduled_time.slice(0, 5)}` : ''}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={`text-[10px] uppercase font-bold px-2 py-1 rounded-full ${STATUS_STYLES[it.status] || STATUS_STYLES.pending}`}>
                                                {STATUS_LABELS[it.status] || it.status}
                                            </span>
                                            <button
                                                onClick={() => { if (confirm(`Unschedule "${it.title || it.core_mechanic}"?`)) onClear(it.id) }}
                                                className="text-[10px] font-bold bg-rose-950/50 hover:bg-rose-900/50 text-rose-400 rounded-md px-1.5 py-1"
                                            >✕</button>
                                        </div>
                                    </div>
                                    {stats.length > 0 ? (
                                        <div className="flex flex-wrap gap-2 mt-2 text-xs text-slate-400">
                                            {stats.map((s, i) => <span key={i}>{s}</span>)}
                                        </div>
                                    ) : (
                                        <div className="text-xs text-slate-600 mt-2">No performance data logged yet — add it from the Queue tab once posted.</div>
                                    )}
                                </div>
                            )
                        })}
                    </div>
                )}

                {showAssign ? (
                    <div>
                        <div className="text-xs font-bold text-slate-400 mb-2">+ Assign content to this day</div>
                        {unscheduled.length === 0 ? (
                            <p className="text-sm text-slate-400">No unscheduled items available.</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {unscheduled.map(it => (
                                    <button
                                        key={it.id}
                                        onClick={() => onAssign(it.id)}
                                        className="text-left px-3 py-2 bg-slate-950 border border-slate-800 hover:border-cyan-600 rounded-lg text-sm"
                                    >
                                        <span className="font-bold">{CHAR_EMOJI[it.character] || '🎭'} {it.title || it.core_mechanic || it.content_category || 'item'}</span>
                                        <span className="text-slate-500"> — {it.character}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <button onClick={() => setShowAssign(true)} className="text-xs font-bold text-cyan-400 hover:text-white">+ Assign more content to this day</button>
                )}

                <button onClick={onClose} className="mt-4 text-xs text-slate-500 hover:text-white block">Close</button>
            </div>
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
    const [error, setError] = useState<string | null>(null)

    const fetchAssets = async () => {
        setLoading(true)
        try {
            const params = new URLSearchParams()
            if (characterFilter) params.set('character', characterFilter)
            params.set('general', 'true')
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
        setError(null)
        try {
            for (const file of Array.from(files)) {
                await uploadAsset(file, { character: uploadCharacter || null, label: uploadLabel || file.name })
            }
            fetchAssets()
        } catch (e: any) {
            console.error(e)
            setError(e.message)
        } finally {
            setUploading(false)
        }
    }

    const deleteAsset = async (id: string) => {
        if (!confirm('Delete this asset permanently?')) return
        await fetch(`/api/pipeline/assets/${id}`, { method: 'DELETE' })
        fetchAssets()
    }

    return (
        <div className="flex flex-col gap-6">
            {error && (
                <div className="bg-rose-950/50 border border-rose-800 text-rose-300 text-xs rounded-lg px-3 py-2 flex items-start justify-between gap-2">
                    <span>⚠️ {error}</span>
                    <button onClick={() => setError(null)} className="shrink-0 text-rose-400 hover:text-white">✕</button>
                </div>
            )}
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
