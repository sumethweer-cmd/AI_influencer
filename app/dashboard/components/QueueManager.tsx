'use client'

import React, { useEffect, useState } from 'react'

type Job = {
    id: string
    status: string
    image_type: string
    slot_index: number
    created_at: string
    content_items: {
        id: string
        topic: string
        persona: string
    }
}

export default function QueueManager() {
    const [jobs, setJobs] = useState<Job[]>([])
    const [autoTerminate, setAutoTerminate] = useState(false)
    const [visible, setVisible] = useState(true)
    const [expanded, setExpanded] = useState(false)
    const [loading, setLoading] = useState(false)

    const fetchQueue = async () => {
        try {
            const res = await fetch('/api/jobs/queue-actions')
            const json = await res.json()
            if (json.success) {
                setJobs(json.jobs)
                setAutoTerminate(json.autoTerminate)
            }
        } catch (err) {
            console.error('Failed to fetch queue', err)
        }
    }

    useEffect(() => {
        fetchQueue()
        const timer = setInterval(fetchQueue, 5000)
        return () => clearInterval(timer)
    }, [])

    const handleAction = async (action: string, jobId?: string, value?: boolean) => {
        setLoading(true)
        try {
            const res = await fetch('/api/jobs/queue-actions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action, jobId, value })
            })
            const json = await res.json()
            if (!json.success) {
                alert('Action failed: ' + (json.error || 'Unknown error'))
            }
            await fetchQueue()
        } catch (err) {
            alert('Action failed: Network or server error')
        } finally {
            setLoading(false)
        }
    }

    if (!visible) return null

    const pendingCount = jobs.filter(j => j.status === 'Pending' || j.status === 'Queued').length
    const processingCount = jobs.filter(j => j.status === 'Processing').length
    const pausedCount = jobs.filter(j => j.status === 'Paused').length

    return (
        <div className="fixed bottom-20 right-6 w-[350px] bg-slate-900 rounded-xl border border-slate-700 shadow-2xl overflow-hidden z-[100] flex flex-col transition-all duration-300">
            {/* Header */}
            <div
                className={`px-4 py-3 flex justify-between items-center cursor-pointer select-none transition-colors ${processingCount > 0 ? 'bg-orange-600/20 hover:bg-orange-600/30 border-b border-orange-500/30' : 'bg-slate-800 hover:bg-slate-700 border-b border-slate-700'}`}
                onClick={() => setExpanded(!expanded)}
            >
                <div className="flex items-center gap-2">
                    <span className={processingCount > 0 ? 'animate-spin' : ''}>⚙️</span>
                    <h3 className="text-sm font-bold text-slate-200">
                        Queue Manager <span className="text-xs font-normal text-slate-400">({jobs.length})</span>
                    </h3>
                </div>
                <div className="flex gap-2 text-[10px] font-bold">
                    <span className="text-orange-400">{processingCount} Run</span>
                    <span className="text-slate-400">{pendingCount} Wait</span>
                    {pausedCount > 0 && <span className="text-amber-500">{pausedCount} Paused</span>}
                </div>
            </div>

            {/* Body */}
            {expanded && (
                <div className="flex flex-col max-h-[400px]">
                    {/* Controls */}
                    <div className="p-3 bg-slate-800 border-b border-slate-700 space-y-3">
                        <div className="flex gap-2">
                            <button onClick={() => handleAction('pause_all')} disabled={loading || pendingCount === 0} className="flex-1 py-1 bg-amber-900/40 text-amber-500 hover:bg-amber-900/60 rounded text-[10px] font-bold border border-amber-900/50 disabled:opacity-50 transition-colors">
                                ⏸ PAUSE ALL
                            </button>
                            <button onClick={() => handleAction('resume_all')} disabled={loading || pausedCount === 0} className="flex-1 py-1 bg-emerald-900/40 text-emerald-500 hover:bg-emerald-900/60 rounded text-[10px] font-bold border border-emerald-900/50 disabled:opacity-50 transition-colors">
                                ▶ RESUME ALL
                            </button>
                            <button onClick={() => { if (confirm('Clear all pending and paused jobs?')) handleAction('cancel_all') }} disabled={loading || (pendingCount === 0 && pausedCount === 0)} className="flex-1 py-1 bg-rose-900/40 text-rose-500 hover:bg-rose-900/60 rounded text-[10px] font-bold border border-rose-900/50 disabled:opacity-50 transition-colors">
                                🗑 CLEAR
                            </button>
                        </div>
                        <label className="flex items-center gap-2 text-[11px] text-slate-300 font-medium cursor-pointer bg-slate-900 px-3 py-2 rounded-lg border border-slate-700 select-none">
                            <input
                                type="checkbox"
                                checked={autoTerminate}
                                onChange={(e) => handleAction('toggle_runpod', undefined, e.target.checked)}
                                disabled={loading}
                                className="accent-rose-500 w-3 h-3"
                            />
                            <span>Terminate Runpod when queue is empty</span>
                            <span className="ml-auto text-rose-500 font-bold opacity-80">COST SAVER</span>
                        </label>
                    </div>

                    {/* Job List */}
                    <div className="overflow-y-auto p-2 space-y-2 flex-1 custom-scrollbar bg-slate-950/50">
                        {jobs.length === 0 ? (
                            <div className="text-[11px] text-center italic text-slate-500 py-6">
                                The queue is currently empty.
                            </div>
                        ) : (
                            jobs.map((j) => (
                                <div key={j.id} className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-2 shadow-sm ${j.status === 'Processing' ? 'bg-orange-950/20 border-orange-900/50' : j.status === 'Paused' ? 'bg-amber-950/10 border-amber-900/30 opacity-75' : 'bg-slate-800/50 border-slate-700'}`}>
                                    <div className="flex-1 min-w-0 pr-2">
                                        <div className="flex items-center gap-1.5 mb-0.5">
                                            <span className={`text-[9px] font-black px-1.5 rounded uppercase ${j.status === 'Processing' ? 'bg-orange-600/20 text-orange-500' :
                                                j.status === 'Paused' ? 'bg-amber-600/20 text-amber-500' :
                                                    'bg-slate-700 text-slate-400'
                                                }`}>
                                                {j.status}
                                            </span>
                                            <span className="text-[9px] font-bold text-slate-500">{j.image_type} #{j.slot_index + 1}</span>
                                        </div>
                                        <div className="truncate font-medium text-slate-300 title" title={j.content_items?.topic}>
                                            {j.content_items?.topic || 'Unknown Topic'}
                                        </div>
                                    </div>

                                    <div className="flex gap-1 shrink-0">
                                        {j.status === 'Pending' && (
                                            <button onClick={() => handleAction('pause', j.id)} className="w-6 h-6 rounded bg-slate-700 hover:bg-amber-900 text-slate-300 hover:text-amber-500 flex items-center justify-center transition-colors">
                                                ⏸
                                            </button>
                                        )}
                                        {j.status === 'Paused' && (
                                            <button onClick={() => handleAction('resume', j.id)} className="w-6 h-6 rounded bg-slate-700 hover:bg-emerald-900 text-slate-300 hover:text-emerald-500 flex items-center justify-center transition-colors">
                                                ▶
                                            </button>
                                        )}
                                        {['Pending', 'Paused', 'Queued'].includes(j.status) && (
                                            <button onClick={() => handleAction('cancel', j.id)} className="w-6 h-6 rounded bg-slate-700 hover:bg-rose-900 text-slate-300 hover:text-rose-500 flex items-center justify-center transition-colors">
                                                ✕
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
