'use client'

import React, { useEffect, useState } from 'react'
import { ProductionJob } from '@/types'

export default function ProductionMonitor() {
    const [job, setJob] = useState<ProductionJob | null>(null)
    const [visible, setVisible] = useState(false)

    useEffect(() => {
        let timer: NodeJS.Timeout

        async function pollStatus() {
            try {
                const res = await fetch('/api/jobs/monitor')
                const json = await res.json()
                if (json.success && json.data) {
                    const currentJob = json.data as ProductionJob
                    setJob(currentJob)

                    // Show the monitor if the job is active or completed recently
                    if (currentJob.status !== 'Completed' && currentJob.status !== 'Failed') {
                        setVisible(true)
                    } else {
                        // Hide after 10 seconds if it's done/failed
                        setTimeout(() => setVisible(false), 10000)
                    }
                }
            } catch (err) {
                console.error('Failed to poll production status', err)
            }
        }

        // Poll immediately, then every 3 seconds
        pollStatus()
        timer = setInterval(pollStatus, 3000)

        return () => clearInterval(timer)
    }, [])

    if (!visible || !job) return null

    const progress = job.total_items > 0 ? Math.round((job.completed_items / job.total_items) * 100) : 0
    const isActive = job.status !== 'Completed' && job.status !== 'Failed'

    return (
        <div className="fixed bottom-6 right-6 w-96 bg-slate-800 rounded-xl border border-slate-700 shadow-2xl overflow-hidden z-50 animate-in slide-in-from-bottom-5">
            <div className={`h-1.5 w-full \${isActive ? 'bg-orange-500/20' : 'bg-emerald-500/20'}`}>
                <div
                    className={`h-full transition-all duration-1000 ease-out \${isActive ? 'bg-orange-500' : 'bg-emerald-500'}`}
                    style={{ width: `\${progress}%` }}
                />
            </div>
            <div className="p-5 space-y-3">
                <div className="flex justify-between items-start">
                    <div>
                        <h3 className="text-sm font-bold text-slate-200">Production Engine</h3>
                        <p className={`text-xs font-mono mt-1 ${job.status === 'Failed' ? 'text-rose-400' :
                                job.status === 'Completed' ? 'text-emerald-400' : 'text-orange-400 animate-pulse'
                            }`}>
                            {job.status}
                        </p>
                    </div>
                    <div className="text-xl font-bold text-slate-400 font-mono">
                        {progress}%
                    </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                        🖼️ {job.completed_items} / {job.total_items} Images
                    </span>
                    {job.runpod_job_id && (
                        <span className="font-mono bg-slate-900 px-2 py-0.5 rounded border border-slate-700">
                            Pod: {job.runpod_job_id.slice(0, 8)}...
                        </span>
                    )}
                </div>

                {job.error_message && (
                    <div className="mt-2 text-xs text-rose-400 bg-rose-950/50 p-2 rounded border border-rose-900 line-clamp-2" title={job.error_message}>
                        {job.error_message}
                    </div>
                )}
            </div>
        </div>
    )
}
