'use client'

import React, { useState, useEffect } from 'react'

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

const downloadText = (filename: string, content: string) => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    link.click()
    URL.revokeObjectURL(url)
}

export default function ContentPipelineDashboard() {
    const [items, setItems] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [characterFilter, setCharacterFilter] = useState('')
    const [statusFilter, setStatusFilter] = useState('')
    const [expandedId, setExpandedId] = useState<string | null>(null)

    useEffect(() => {
        fetchItems()
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
        <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-20">
            <header className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                <h2 className="text-2xl font-bold flex items-center gap-2">🧬 Content Pipeline Queue</h2>
                <p className="text-sm text-slate-400 mt-2">
                    ผลลัพธ์จาก content-calendar / content-request skill — โหลด prompt/srt,
                    เขียน note, และอัปเดตสถานะได้ที่นี่ เพื่อให้ Claude อ่านย้อนกลับได้ครั้งถัดไป
                </p>
            </header>

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
        </div>
    )
}

function ItemCard({ item, expanded, onToggle, onUpdated }: { item: any, expanded: boolean, onToggle: () => void, onUpdated: () => void }) {
    const [note, setNote] = useState(item.note || '')
    const [status, setStatus] = useState(item.status)
    const [saving, setSaving] = useState(false)

    const saveField = async (field: 'note' | 'status', value: string) => {
        setSaving(true)
        try {
            await fetch(`/api/pipeline/items/${item.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [field]: value }),
            })
            onUpdated()
        } catch (e) {
            console.error(e)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="p-4 flex items-center justify-between gap-4 cursor-pointer" onClick={onToggle}>
                <div className="flex items-center gap-3 min-w-0">
                    <span className="text-lg">{item.character === 'momo' ? '💜' : item.character === 'anong' ? '🇹🇭' : '🎭'}</span>
                    <div className="min-w-0">
                        <div className="font-bold text-sm truncate">
                            {item.character} — {item.content_category || 'uncategorized'}
                            {item.core_mechanic ? <span className="text-slate-500 font-normal"> · {item.core_mechanic}</span> : null}
                        </div>
                        <div className="text-xs text-slate-500 truncate">
                            {item.delivery_format} {item.visual_format ? `· ${item.visual_format}` : ''} {item.platform ? `· ${item.platform}` : ''} {item.model ? `· ${item.model}` : ''}
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
                    {item.character_take && (
                        <div>
                            <label className="text-xs font-bold text-slate-400 block mb-1">Character Take</label>
                            <p className="text-sm bg-slate-950 border border-slate-800 rounded-lg p-3 whitespace-pre-wrap">{item.character_take}</p>
                        </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                        <button
                            onClick={() => downloadText(`${item.character}_${item.id}_compiled_prompt.txt`, item.compiled_prompt)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold"
                        >
                            📄 Download .txt
                        </button>
                        {item.srt_content && (
                            <button
                                onClick={() => downloadText(`${item.character}_${item.id}.srt`, item.srt_content)}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg text-xs font-bold"
                            >
                                💬 Download .srt
                            </button>
                        )}
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-400 block mb-1">Status</label>
                        <select
                            value={status}
                            onChange={e => { setStatus(e.target.value); saveField('status', e.target.value) }}
                            className="bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm"
                        >
                            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="text-xs font-bold text-slate-400 block mb-1">
                            Note {saving && <span className="text-cyan-400 font-normal">saving...</span>}
                        </label>
                        <textarea
                            value={note}
                            onChange={e => setNote(e.target.value)}
                            onBlur={() => saveField('note', note)}
                            placeholder="บอกว่าขาดอะไร ต้องแก้อะไร — Claude จะอ่านตรงนี้ครั้งหน้าที่สั่งงาน"
                            className="w-full h-24 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:border-cyan-500 outline-none"
                        />
                    </div>

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
