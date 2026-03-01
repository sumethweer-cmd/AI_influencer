'use client'

import React, { useEffect, useState } from 'react'
import { RunpodPod } from '@/types'

export default function RunpodManager() {
    const [pods, setPods] = useState<RunpodPod[]>([])
    const [loading, setLoading] = useState(true)
    const [actioning, setActioning] = useState(false)
    const [gpuType, setGpuType] = useState('NVIDIA GeForce RTX 4090')
    const [autoRefresh, setAutoRefresh] = useState(true)

    const fetchPods = async () => {
        try {
            const res = await fetch('/api/runpod')
            const json = await res.json()
            if (json.success) {
                setPods(json.data)
            }
        } catch (e) {
            console.error('Failed to fetch pods')
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        fetchPods()

        let interval: NodeJS.Timeout
        if (autoRefresh) {
            interval = setInterval(fetchPods, 10000) // Poll every 10 seconds
        }
        return () => clearInterval(interval)
    }, [autoRefresh])

    const handleStartPod = async () => {
        if (!confirm(`Are you sure you want to start a new \${gpuType} instance? This will incur costs.`)) return
        setActioning(true)
        try {
            const res = await fetch('/api/runpod', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'start', gpuTypeId: gpuType })
            })
            if (res.ok) {
                alert('Pod is deploying! It may take a minute to boot up.')
                fetchPods()
            } else {
                alert('Failed to start pod.')
            }
        } catch (e) {
            alert('Error starting pod.')
        } finally {
            setActioning(false)
        }
    }

    const handleTerminate = async (podId: string) => {
        if (!confirm('Are you certain you want to terminate this pod? Any running tasks inside it will fail.')) return
        setActioning(true)
        try {
            const res = await fetch('/api/runpod', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'stop', podId })
            })
            if (res.ok) {
                alert('Termination signal sent.')
                fetchPods()
            }
        } catch (e) {
            alert('Error terminating pod.')
        } finally {
            setActioning(false)
        }
    }

    const activeCount = pods.length

    return (
        <div className="bg-slate-900 border-2 border-slate-700/50 rounded-2xl p-5 shadow-2xl space-y-5">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-sm font-bold text-slate-300 flex items-center gap-2">
                        <span>⚡</span> RUNPOD CONTROL CENTER
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-1">
                        <a href="https://www.runpod.io/console/billing" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">View Remaining Credits ↗</a>
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <span className="relative flex h-3 w-3">
                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${activeCount > 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}></span>
                        <span className={`relative inline-flex rounded-full h-3 w-3 ${activeCount > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                    </span>
                    <span className="text-xs font-bold text-slate-300">{activeCount > 0 ? `${activeCount} Active` : 'Offline'}</span>
                </div>
            </div>

            <div className="space-y-4">
                {/* Deployment Controls */}
                <div className="p-4 bg-slate-800/50 border border-slate-700 rounded-xl space-y-3">
                    <label className="text-xs font-bold text-slate-400 block">DEPLOY NEW INSTANCE</label>
                    <div className="flex flex-col gap-3">
                        <select
                            value={gpuType}
                            onChange={e => setGpuType(e.target.value)}
                            disabled={actioning}
                            className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs outline-none focus:border-orange-500 transition-colors"
                        >
                            <option value="NVIDIA GeForce RTX 3090">RTX 3090 (24GB) ~ $0.44/hr</option>
                            <option value="NVIDIA GeForce RTX 4090">RTX 4090 (24GB) ~ $0.74/hr</option>
                            <option value="NVIDIA GeForce RTX 5090">RTX 5090 (32GB) ~ $0.89/hr</option>
                            <option value="NVIDIA RTX A6000">RTX A6000 (48GB) ~ $0.80/hr</option>
                        </select>
                        <button
                            onClick={handleStartPod}
                            disabled={actioning}
                            className="w-full px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm rounded-lg transition-all shadow-[0_0_15px_rgba(5,150,105,0.2)] hover:shadow-[0_0_20px_rgba(5,150,105,0.4)] whitespace-nowrap"
                        >
                            {actioning ? 'Deploying...' : '🚀 Start Pod'}
                        </button>
                    </div>
                </div>

                {/* Active Pods List */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                        <label className="text-xs font-bold text-slate-400">ACTIVE PODS</label>
                        <button onClick={fetchPods} className="text-[10px] text-slate-500 hover:text-white transition-colors">
                            ↻ Refresh
                        </button>
                    </div>

                    {loading ? (
                        <div className="h-20 bg-slate-800 animate-pulse rounded-xl border border-slate-700" />
                    ) : pods.length === 0 ? (
                        <div className="p-6 bg-slate-800/30 border border-dashed border-slate-700 rounded-xl text-center">
                            <p className="text-sm text-slate-500 italic">No pods currently running. Production engine is halted.</p>
                        </div>
                    ) : (
                        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                            {pods.map(pod => (
                                <div key={pod.id} className="p-4 bg-slate-800 border-l-4 border-l-emerald-500 border-t border-r border-b border-slate-700 rounded-xl flex flex-col gap-3">
                                    <div className="flex items-start justify-between">
                                        <div>
                                            <h4 className="font-bold text-sm text-slate-200">{pod.name || pod.id}</h4>
                                            <p className="text-[10px] font-mono text-slate-400 mt-1">ID: {pod.id}</p>
                                        </div>
                                        <span className="px-2 py-1 bg-emerald-900/50 text-emerald-400 text-[10px] font-bold uppercase tracking-wider rounded border border-emerald-500/30">
                                            {pod.desiredStatus}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
                                        <div className="text-xs font-mono text-slate-400">
                                            {pod.runtime?.gpus[0]?.id || 'N/A'}
                                        </div>
                                        <button
                                            onClick={() => handleTerminate(pod.id)}
                                            disabled={actioning}
                                            className="px-3 py-1.5 bg-rose-900/50 hover:bg-rose-600 text-rose-300 hover:text-white text-xs font-bold rounded transiton-all border border-rose-500/30 hover:border-transparent disabled:opacity-50"
                                        >
                                            🛑 Terminate
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="text-[10px] text-orange-400/80 bg-orange-900/20 p-3 rounded-lg border border-orange-500/20 leading-relaxed">
                <strong>Attention:</strong> The Production Engine will now <u>only</u> run if there is an active Pod here. The system will no longer automatically start or stop pods on your behalf to prevent accidental GPU costs or premature termination.
            </div>
        </div>
    )
}
