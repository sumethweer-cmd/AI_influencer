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

    if (!visible && jobs.length === 0) return null

    const pendingCount = jobs.filter(j => j.status === 'Pending').length
    const processingCount = jobs.filter(j => ['Processing', 'Queued'].includes(j.status)).length
    const pausedCount = jobs.filter(j => j.status === 'Paused').length

    return (
        <div className="fixed bottom-4 right-4 z-50 flex items-end justify-end">
            {!expanded ? (
                // Collapsed State (Small Badge)
                <button
                    onClick={() => setExpanded(true)}
                    className="bg-slate-900 border border-slate-700 hover:border-purple-500 rounded-2xl shadow-2xl p-3 flex items-center gap-3 transition-all group"
                >
                    <div className="flex -space-x-1">
                        {processingCount > 0 && (
                            <div className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500 flex items-center justify-center text-[10px] font-bold text-orange-400 rotate-12 group-hover:rotate-0 transition-transform">
                                ⚙️
                            </div>
                        )}
                        {pendingCount > 0 && (
                            <div className="w-6 h-6 rounded-full bg-blue-500/20 border border-blue-500 flex items-center justify-center text-[10px] font-bold text-blue-400 -rotate-12 group-hover:rotate-0 transition-transform">
                                {pendingCount}
                            </div>
                        )}
                    </div>
                    <div className="text-left leading-tight pr-2">
                        <div className="text-xs font-bold text-slate-200">Queue Manager</div>
                        <div className="text-[10px] text-slate-400">
                            {jobs.length === 0 ? 'Empty' : `${processingCount} Run, ${pendingCount} Wait`}
                        </div>
                    </div>
                    <span className="text-slate-500 group-hover:text-white">⛶</span>
                </button>
            ) : (
                // Expanded State (Full Panel)
                <div className="bg-slate-900 border border-slate-700 rounded-t-2xl rounded-bl-2xl rounded-br-sm shadow-2xl w-96 max-h-[600px] flex flex-col overflow-hidden animate-in slide-in-from-bottom-5">
                    {/* Header */}
                    <div className="p-3 border-b border-slate-800 bg-slate-950/50 flex justify-between items-center cursor-pointer" onClick={() => setExpanded(false)}>
                        <h3 className="font-bold text-sm flex items-center gap-2">
                            <span>⚙️ Queue Manager</span>
                            <span className="bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full text-xs">{jobs.length}</span>
                        </h3>
                        <div className="flex gap-2">
                            <button onClick={(e) => { e.stopPropagation(); setExpanded(false) }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
                                ―
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); setVisible(false) }} className="w-6 h-6 flex items-center justify-center rounded hover:bg-rose-900/50 text-slate-400 hover:text-rose-400 transition-colors">
                                ✕
                            </button>
                        </div>
                    </div>

                    {/* Stats & Controls */}
                    <div className="p-3 border-b border-slate-800 bg-slate-900/80 space-y-2">
                        <div className="flex gap-2 mb-1">
                            <div className="flex-1 bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
                                <div className="text-[10px] text-slate-400 font-bold mb-0.5">RUNNING</div>
                                <div className="text-sm font-black text-orange-400">{processingCount}</div>
                            </div>
                            <div className="flex-1 bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
                                <div className="text-[10px] text-slate-400 font-bold mb-0.5">WAITING</div>
                                <div className="text-sm font-black text-blue-400">{pendingCount}</div>
                            </div>
                            <div className="flex-1 bg-slate-950 p-2 rounded-lg border border-slate-800 text-center">
                                <div className="text-[10px] text-slate-400 font-bold mb-0.5">PAUSED</div>
                                <div className="text-sm font-black text-amber-500">{pausedCount}</div>
                            </div>
                        </div>

                        <div className="flex gap-2">
                            <button onClick={() => handleAction('pause_all')} disabled={loading || pendingCount === 0} className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-bold border border-slate-700 disabled:opacity-50 transition-colors">
                                ⏸ PAUSE PENDING
                            </button>
                            <button onClick={() => handleAction('resume_all')} disabled={loading || pausedCount === 0} className="flex-1 py-1.5 bg-slate-800 hover:bg-slate-700 rounded-lg text-[10px] font-bold border border-slate-700 disabled:opacity-50 transition-colors">
                                ▶ RESUME ALL
                            </button>
                            <button onClick={() => { if (confirm('Clear all pending and paused jobs?')) handleAction('cancel_all') }} disabled={loading || (pendingCount === 0 && pausedCount === 0)} className="flex-1 py-1.5 bg-rose-900/40 text-rose-500 hover:bg-rose-900/60 rounded-lg text-[10px] font-bold border border-rose-900/50 disabled:opacity-50 transition-colors">
                                🗑 CLEAR
                            </button>
                        </div>
                        <label className="flex items-center gap-2 text-[11px] text-slate-300 font-medium cursor-pointer bg-slate-950 px-3 py-2 rounded-lg border border-slate-800 select-none mt-2">
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
                    <div className="overflow-y-auto p-3 space-y-2 flex-1 max-h-[300px] custom-scrollbar bg-slate-950/50">
                        {jobs.length === 0 ? (
                            <div className="text-[11px] text-center italic text-slate-500 py-6">
                                The queue is currently empty.
                            </div>
                        ) : (
                            jobs.map((j) => (
                                <div key={j.id} className={`p-2 rounded-lg border text-xs flex items-center justify-between gap-3 shadow-sm ${j.status === 'Processing' ? 'bg-orange-950/20 border-orange-900/50' : j.status === 'Paused' ? 'bg-amber-950/10 border-amber-900/30 opacity-75' : 'bg-slate-800/50 border-slate-700'}`}>
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
                                            <button onClick={() => handleAction('pause', j.id)} className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-amber-900 text-slate-300 hover:text-amber-500 flex items-center justify-center transition-colors">
                                                ⏸
                                            </button>
                                        )}
                                        {j.status === 'Paused' && (
                                            <button onClick={() => handleAction('resume', j.id)} className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-emerald-900 text-slate-300 hover:text-emerald-500 flex items-center justify-center transition-colors">
                                                ▶
                                            </button>
                                        )}
                                        {['Pending', 'Paused', 'Queued'].includes(j.status) && (
                                            <button onClick={() => handleAction('cancel', j.id)} className="w-7 h-7 rounded-lg bg-slate-800 hover:bg-rose-900 text-slate-300 hover:text-rose-500 flex items-center justify-center transition-colors">
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
