'use client'

import React, { useEffect, useState } from 'react'

export default function LogsPage() {
    const [logs, setLogs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)

    useEffect(() => {
        fetchLogs()
    }, [])

    async function fetchLogs() {
        setLoading(true)
        try {
            const res = await fetch('/api/logs')
            const json = await res.json()
            if (json.success) setLogs(json.data)
        } catch (e) {
            console.error('Failed to fetch logs:', e)
        }
        setLoading(false)
    }

    const tokenLogs = logs.filter(lg => lg.message.includes('Tokens Used'))
    const totalTokens = tokenLogs.reduce((acc, curr) => acc + (curr.metadata?.totalTokens || 0), 0)

    const levelColors: Record<string, string> = {
        INFO: 'text-blue-400',
        SUCCESS: 'text-emerald-400',
        WARNING: 'text-amber-400',
        ERROR: 'text-rose-400'
    }

    return (
        <div className="space-y-8">
            <header className="flex flex-wrap items-center justify-between gap-4">
                <div>
                    <h2 className="text-3xl font-bold">System Logs & Token Analytics</h2>
                    <p className="text-slate-400 mt-1">Review system events and Gemini API token usage.</p>
                </div>
                <button
                    onClick={fetchLogs}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors border border-slate-700"
                >
                    Refresh
                </button>
            </header>

            {/* Token Analytics Summary */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6">
                    <h3 className="text-sm font-bold text-slate-400 mb-2">Total Tokens Used</h3>
                    <div className="text-4xl font-black text-orange-400">{totalTokens.toLocaleString()}</div>
                    <p className="text-xs text-slate-500 mt-2">Across all Gemini API calls</p>
                </div>
                {/* Future Analytics Plugs */}
                <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 opacity-50">
                    <h3 className="text-sm font-bold text-slate-400 mb-2">Runpod Generation Time</h3>
                    <div className="text-4xl font-black text-slate-300">0.0<span className="text-lg text-slate-500 font-normal"> min</span></div>
                    <p className="text-xs text-slate-500 mt-2">Estimated cost parsing coming later</p>
                </div>
            </div>

            <div className="bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-xl">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-800/50 text-slate-400 text-xs uppercase tracking-wider">
                        <tr>
                            <th className="p-4 font-semibold">Time</th>
                            <th className="p-4 font-semibold">Level</th>
                            <th className="p-4 font-semibold">Phase</th>
                            <th className="p-4 font-semibold">Message</th>
                            <th className="p-4 font-semibold">Metadata</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/50">
                        {loading ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-500">Loading logs...</td>
                            </tr>
                        ) : logs.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="p-8 text-center text-slate-500">No logs found.</td>
                            </tr>
                        ) : (
                            logs.map((log) => (
                                <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="p-4 whitespace-nowrap text-slate-400">
                                        {new Date(log.created_at).toLocaleString()}
                                    </td>
                                    <td className={`p-4 font-bold ${levelColors[log.level] || 'text-slate-300'}`}>
                                        {log.level}
                                    </td>
                                    <td className="p-4 whitespace-nowrap">
                                        <span className="px-2 py-1 bg-slate-800 rounded text-xs text-slate-300 border border-slate-700">
                                            {log.phase}
                                        </span>
                                    </td>
                                    <td className="p-4 font-medium text-slate-200">
                                        {log.message}
                                    </td>
                                    <td className="p-4 text-xs text-slate-400 font-mono">
                                        {log.metadata ? (
                                            <details className="cursor-pointer group">
                                                <summary className="hover:text-white transition-colors">View Details</summary>
                                                <pre className="mt-2 p-3 bg-slate-950 rounded border border-slate-800 overflow-x-auto text-[10px] leading-relaxed group-open:animate-in group-open:fade-in group-open:slide-in-from-top-1">
                                                    {JSON.stringify(log.metadata, null, 2)}
                                                </pre>
                                            </details>
                                        ) : '-'}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    )
}
