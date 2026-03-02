'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ContentItem } from '@/types'
import RunpodManager from './components/RunpodManager'
import CreativeStudioModal from '@/components/CreativeStudioModal'
import GlobalSettingsModal from '@/components/GlobalSettingsModal'

export default function DashboardPage() {
    const [items, setItems] = useState<ContentItem[]>([])
    const [workflows, setWorkflows] = useState<any[]>([])
    const [personas, setPersonas] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [jobStats, setJobStats] = useState<any>(null)
    const [showScoutModal, setShowScoutModal] = useState(false)
    const [showSettingsModal, setShowSettingsModal] = useState(false)
    const [activePersona, setActivePersona] = useState<string>('All')
    const [activeTab, setActiveTab] = useState<'workspace' | 'calendar'>('workspace')
    const [statusFilter, setStatusFilter] = useState<string>('All')
    const [selectedIds, setSelectedIds] = useState<string[]>([])

    useEffect(() => {
        Promise.all([fetchItems(), fetchWorkflows(), fetchPersonas()])
    }, [])

    async function fetchPersonas() {
        try {
            const res = await fetch('/api/personas')
            const json = await res.json()
            if (json.success) setPersonas(json.data)
        } catch (e) {
            console.error('Failed to fetch personas:', e)
        }
    }

    async function fetchWorkflows() {
        try {
            const res = await fetch('/api/workflows')
            const json = await res.json()
            if (json.success) setWorkflows(json.data)
        } catch (e) {
            console.error('Failed to fetch workflows:', e)
        }
    }

    async function fetchItems() {
        setLoading(true)
        try {
            const res = await fetch('/api/content')
            const json = await res.json()
            if (json.success) setItems(json.data)
        } catch (e) {
            console.error('Failed to fetch items:', e)
        }
        setLoading(false)
    }

    async function fetchJobStats() {
        try {
            const res = await fetch('/api/jobs/queue-stats')
            const json = await res.json()
            if (json.success) setJobStats(json.stats)
        } catch (e) {
            console.error('Failed to fetch job stats:', e)
        }
    }

    // Polling for job stats if any item is In Production
    useEffect(() => {
        const hasActiveJobs = items.some(item => item.status === 'In Production')
        if (!hasActiveJobs && (!jobStats || jobStats.pending === 0)) return

        const interval = setInterval(() => {
            fetchJobStats()
            // If jobs are moving, also refresh items to show new images
            if (jobStats && (jobStats.processing > 0 || jobStats.pending > 0)) {
                fetchItems()
            }
        }, 10000)

        return () => clearInterval(interval)
    }, [items, jobStats])

    const baseItems = activePersona === 'All'
        ? items
        : items.filter(item => item.persona === activePersona)

    const filteredItems = baseItems.filter(item =>
        statusFilter === 'All' ? true : item.status === statusFilter
    )

    const draftItems = filteredItems.filter(item => item.status === 'Draft')
    const hasDrafts = draftItems.length > 0

    const handleConfirmPlan = async () => {
        if (!confirm(`Are you sure you want to confirm these ${draftItems.length} items and queue them for Phase 2 Image Generation?`)) return

        try {
            const res = await fetch('/api/jobs/confirm-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemIds: draftItems.map(i => i.id) })
            })
            if (res.ok) {
                alert('Plan Confirmed! Items have been queued for Background Generation. You may close this tab.')
                fetchItems()
                setSelectedIds([])
            } else {
                alert('❌ Failed to confirm plan. Check settings and logs.')
            }
        } catch (e) {
            alert('Error confirming plan.')
            console.error(e)
        }
    }

    const handleBulkDelete = async () => {
        if (!confirm(`Are you sure you want to delete ${selectedIds.length} items?`)) return
        try {
            const res = await fetch('/api/content/bulk-delete', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds })
            })
            if (res.ok) {
                setSelectedIds([])
                fetchItems()
            }
        } catch (e) {
            alert('Bulk delete failed')
        }
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === filteredItems.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(filteredItems.map(i => i.id))
        }
    }

    return (
        <div className="flex flex-col lg:flex-row gap-8">
            {/* Left Sidebar Persona Tab */}
            <aside className="w-full lg:w-64 shrink-0 space-y-4">
                <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4 sticky top-8">
                    <h3 className="text-sm font-bold text-slate-400 mb-4 px-2 tracking-wider">PERSONA VIEW</h3>
                    <div className="flex flex-col gap-2">
                        <button
                            onClick={() => setActivePersona('All')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${activePersona === 'All' ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'hover:bg-slate-800 text-slate-300 border border-transparent'
                                }`}
                        >
                            <span>🌟</span> All Influencers
                        </button>
                        {personas.map(p => (
                            <button
                                key={p.id}
                                onClick={() => setActivePersona(p.name)}
                                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${activePersona === p.name ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30' : 'hover:bg-slate-800 text-slate-300 border border-transparent'
                                    }`}
                            >
                                <span className="w-5 text-center">{p.name === 'Momo' ? '👱‍♀️' : p.name === 'Karen' ? '👩‍💼' : '🎭'}</span>
                                {p.name}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="sticky top-[340px]">
                    <RunpodManager />
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 space-y-8">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-6">
                        <div>
                            <h2 className="text-3xl font-bold">Weekly Approval</h2>
                            <p className="text-slate-400 mt-1">Review and schedule generated ({activePersona}) content.</p>
                        </div>
                        <div className="hidden md:flex flex-col items-center px-6 py-2 bg-orange-600/10 border border-orange-500/20 rounded-2xl">
                            <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Storage & QC</span>
                            <span className="text-xl font-black text-orange-500">
                                {items.filter(i => (i.generated_images?.length || 0) > 0).length} <span className="text-xs">STOCKED</span>
                            </span>
                        </div>
                    </div>
                    <div className="flex gap-3">
                        {hasDrafts && (
                            <button
                                onClick={handleConfirmPlan}
                                className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 rounded-xl text-sm font-black flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20 animate-pulse border border-orange-400"
                            >
                                <span>✅</span> Confirm Plan & Start Gen
                            </button>
                        )}
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95 border border-slate-700"
                        >
                            <span>⚙️</span> Global Settings
                        </button>
                        <button
                            onClick={() => setShowScoutModal(true)}
                            className="px-5 py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95 border border-slate-700"
                        >
                            <span>🚀</span> Start Phase 1
                        </button>
                    </div>
                </header>

                {/* Job Queue Progress */}
                {jobStats && (jobStats.pending > 0 || jobStats.processing > 0 || jobStats.completed > 0) && jobStats.total > 0 && (
                    <div className="bg-slate-900/50 border border-slate-700/50 rounded-2xl p-4 animate-in fade-in slide-in-from-top-4">
                        <div className="flex justify-between items-center mb-2">
                            <div className="flex items-center gap-2">
                                <span className="relative flex h-2 w-2">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500"></span>
                                </span>
                                <span className="text-xs font-black uppercase tracking-widest text-orange-400">Production Queue Active</span>
                            </div>
                            <span className="text-xs font-bold text-slate-400">{jobStats.completed} / {jobStats.total} Images Generated</span>
                        </div>
                        <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-orange-600 to-rose-500 shadow-[0_0_10px_rgba(249,115,22,0.5)] transition-all duration-1000"
                                style={{ width: `${(jobStats.completed / jobStats.total) * 100}%` }}
                            />
                        </div>
                        {jobStats.processing > 0 && (
                            <p className="text-[10px] text-slate-500 mt-2 italic">Currently generating {jobStats.processing} image(s)...</p>
                        )}
                        {jobStats.failed > 0 && (
                            <p className="text-[10px] text-rose-500 mt-1">⚠️ {jobStats.failed} jobs failed. Check system logs for details.</p>
                        )}
                    </div>
                )}

                {/* Tabs & Filters UI */}
                <div className="flex flex-col md:flex-row justify-between border-b border-slate-800 gap-4">
                    <div className="flex gap-8">
                        <button
                            onClick={() => setActiveTab('workspace')}
                            className={`pb-4 text-sm font-black transition-all relative ${activeTab === 'workspace' ? 'text-orange-500' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            ACTIVE WORKSPACE
                            {activeTab === 'workspace' && <div className="absolute bottom-0 left-0 w-full h-1 bg-orange-500 rounded-t-full shadow-[0_0_10px_rgba(249,115,22,0.5)]" />}
                        </button>
                        <button
                            onClick={() => setActiveTab('calendar')}
                            className={`pb-4 text-sm font-black transition-all relative ${activeTab === 'calendar' ? 'text-indigo-400' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            POST CALENDAR
                            {activeTab === 'calendar' && <div className="absolute bottom-0 left-0 w-full h-1 bg-indigo-500 rounded-t-full shadow-[0_0_10px_rgba(99,102,241,0.5)]" />}
                        </button>
                    </div>

                    {activeTab === 'workspace' && (
                        <div className="pb-4 flex items-center gap-4">
                            <select
                                value={statusFilter}
                                onChange={e => setStatusFilter(e.target.value)}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-300 focus:border-orange-500 outline-none cursor-pointer"
                            >
                                <option value="All">All Statuses</option>
                                <option value="Draft">Draft</option>
                                <option value="In Production">In Production</option>
                                <option value="QC Pending">QC Pending</option>
                                <option value="Awaiting Approval">Awaiting Approval</option>
                                <option value="Scheduled">Scheduled</option>
                                <option value="Published">Published</option>
                            </select>

                            <div className="h-4 w-px bg-slate-800 mx-2" />

                            <button
                                onClick={toggleSelectAll}
                                className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-orange-500 transition-colors"
                            >
                                {selectedIds.length === filteredItems.length ? 'Deselect All' : 'Select All'}
                            </button>

                            {selectedIds.length > 0 && (
                                <button
                                    onClick={handleBulkDelete}
                                    className="px-3 py-1 bg-rose-950/50 text-rose-500 rounded-lg text-[10px] font-black border border-rose-900/30 hover:bg-rose-900/60 transition-all animate-in fade-in slide-in-from-right-2"
                                >
                                    🗑️ DELETE {selectedIds.length} SELECTED
                                </button>
                            )}
                        </div>
                    )}
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-pulse">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-64 bg-slate-800 rounded-2xl border border-slate-700" />
                        ))}
                    </div>
                ) : activeTab === 'workspace' ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {filteredItems.length > 0 ? (
                            filteredItems.map(item => (
                                <ContentCard
                                    key={item.id}
                                    item={item}
                                    workflows={workflows}
                                    personas={personas}
                                    onUpdate={fetchItems}
                                    isSelected={selectedIds.includes(item.id)}
                                    onToggleSelect={() => {
                                        setSelectedIds(prev => prev.includes(item.id)
                                            ? prev.filter(id => id !== item.id)
                                            : [...prev, item.id]
                                        )
                                    }}
                                />
                            ))
                        ) : (
                            <div className="col-span-full py-20 flex flex-col items-center justify-center bg-slate-800/50 rounded-3xl border-2 border-dashed border-slate-700">
                                <span className="text-6xl mb-6">🏜️</span>
                                <h3 className="text-xl font-bold">No Content Created Yet</h3>
                                <p className="text-slate-400 mt-2 max-w-sm text-center">
                                    To get started, you need to configure your API keys and then trigger the Phase 1 Planner.
                                </p>
                                <div className="mt-8 flex gap-4">
                                    <a
                                        href="/dashboard/settings"
                                        className="px-6 py-3 bg-slate-700 hover:bg-slate-600 rounded-xl font-bold transition-all"
                                    >
                                        ⚙️ Setup API Keys
                                    </a>
                                    <button
                                        onClick={() => setShowScoutModal(true)}
                                        className="px-6 py-3 bg-orange-600 hover:bg-orange-500 rounded-xl font-bold transition-all shadow-lg"
                                    >
                                        🚀 Start Phase 1
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    /* Calendar View Implementation */
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center">
                            <h3 className="text-xl font-bold text-slate-300 flex items-center justify-center gap-3">
                                <span>📅</span> Schedule & Published Posts
                            </h3>
                            <p className="text-slate-500 mt-2 text-sm italic">Tracking all posts across Instagram, Twitter, and Fanvue.</p>
                        </div>

                        <div className="grid grid-cols-1 gap-4">
                            {filteredItems.filter(i => i.status === 'Scheduled' || i.status === 'Published').length === 0 ? (
                                <div className="py-20 text-center text-slate-600 font-mono text-sm uppercase tracking-widest">
                                    -- No scheduled activities found --
                                </div>
                            ) : (
                                filteredItems.filter(i => i.status === 'Scheduled' || i.status === 'Published')
                                    .sort((a: any, b: any) => new Date(a.scheduled_at!).getTime() - new Date(b.scheduled_at!).getTime())
                                    .map(item => (
                                        <div key={item.id} className="bg-slate-800/50 border border-slate-800 p-4 rounded-2xl flex items-center gap-6 hover:border-indigo-500/30 transition-all group">
                                            <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-900 shrink-0">
                                                {item.generated_images?.[0] && (
                                                    <img src={item.generated_images[0].file_path.startsWith('http') ? item.generated_images[0].file_path : item.generated_images[0].file_path.replace('/storage/', '/api/')} className="w-full h-full object-cover" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${item.status === 'Published' ? 'bg-purple-900 text-purple-300' : 'bg-emerald-900 text-emerald-300'}`}>
                                                        {item.status}
                                                    </span>
                                                    <h4 className="font-bold text-slate-200">{item.topic}</h4>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-1">
                                                    Scheduled for: {new Date(item.scheduled_at!).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="flex gap-2">
                                                {item.post_to_ig && <span title="Instagram" className="text-xl">📸</span>}
                                                {item.post_to_x && <span title="X / Twitter" className="text-xl">𝕏</span>}
                                                {item.post_to_fanvue && <span title="Fanvue" className="text-xl">💎</span>}
                                            </div>
                                            <button
                                                onClick={() => { setActiveTab('workspace'); /* Focus logic */ }}
                                                className="opacity-0 group-hover:opacity-100 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-[10px] font-black transition-all"
                                            >
                                                VIEW IN WORKSPACE
                                            </button>
                                        </div>
                                    ))
                            )}
                        </div>
                    </div>
                )}
            </div>

            {showScoutModal && (
                <ScoutModal personas={personas} onClose={() => setShowScoutModal(false)} onStarted={fetchItems} />
            )}

            {showSettingsModal && (
                <GlobalSettingsModal onClose={() => setShowSettingsModal(false)} onUpdate={fetchItems} />
            )}
        </div>
    )
}

function ScoutModal({ personas, onClose, onStarted }: { personas: any[], onClose: () => void, onStarted: () => void }) {
    const [method, setMethod] = useState<'apify' | 'brainstorm' | 'image'>('apify')
    const [persona, setPersona] = useState(personas[0]?.name || 'Momo')
    const [prompt, setPrompt] = useState('')
    const [imageStr, setImageStr] = useState('')
    const [mimeType, setMimeType] = useState('')
    const [starting, setStarting] = useState(false)

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setMimeType(file.type)
        const reader = new FileReader()
        reader.onloadend = () => {
            const base64String = (reader.result as string).split(',')[1]
            setImageStr(base64String)
        }
        reader.readAsDataURL(file)
    }

    const handleSubmit = async () => {
        setStarting(true)
        const payload: any = { persona }
        if (method === 'brainstorm') payload.prompt = prompt
        if (method === 'image') {
            payload.prompt = prompt
            payload.imageBase64 = imageStr
            payload.mimeType = mimeType
        }

        try {
            const res = await fetch('/api/jobs/phase1-planner', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ method, payload })
            })
            if (res.ok) {
                alert('🚀 Phase 1 job started successfully! Please wait a few minutes for generation.')
                onStarted()
                onClose()
            } else {
                alert('❌ Failed to start job. Check settings and logs.')
            }
        } catch (err) {
            alert('Error triggering job.')
        }
        setStarting(false)
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-lg shadow-2xl">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-xl font-bold">Start Phase 1: Strategic Scout</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white">✕</button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="text-sm font-bold text-slate-400 mb-2 block">Target Persona</label>
                        <select
                            value={persona}
                            onChange={(e: any) => setPersona(e.target.value)}
                            className="w-full bg-slate-800 border-[1.5px] border-slate-700/50 hover:border-slate-600 rounded-xl p-3 text-sm focus:border-indigo-500 outline-none transition-colors"
                        >
                            {personas.map(p => (
                                <option key={p.id} value={p.name}>
                                    {p.name === 'Momo' ? '👱‍♀️' : p.name === 'Karen' ? '👩‍💼' : '🎭'} {p.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="text-sm font-bold text-slate-400 mb-2 block">Scout Method</label>
                        <select
                            value={method}
                            onChange={(e: any) => setMethod(e.target.value)}
                            className="w-full bg-slate-800 border-slate-700 rounded-lg p-3 text-sm focus:border-orange-500 outline-none"
                        >
                            <option value="apify">🌐 Option 1: Trend Scraping (Apify/X/IG)</option>
                            <option value="brainstorm">🧠 Option 2: AI Brainstorming (Manual Theme)</option>
                            <option value="image">📸 Option 3: Reference Image Analysis</option>
                        </select>
                    </div>

                    {method === 'apify' && (
                        <div className="bg-blue-900/30 text-blue-300 p-4 rounded-lg text-sm border border-blue-800/50">
                            ℹ️ We will scrape current hashtags from X and Instagram to generate 21 content ideas automatically.
                        </div>
                    )}

                    {method === 'brainstorm' && (
                        <div>
                            <label className="text-sm font-bold text-slate-400 mb-2 block">Prompt / Theme Instruction</label>
                            <textarea
                                value={prompt}
                                onChange={e => setPrompt(e.target.value)}
                                placeholder="e.g., Summer beach vibes in Phuket, focusing on swimwear and outdoor activities."
                                className="w-full bg-slate-800 border-slate-700 rounded-lg p-3 h-24 text-sm focus:border-orange-500 outline-none resize-none"
                            />
                        </div>
                    )}

                    {method === 'image' && (
                        <div className="space-y-4">
                            <div>
                                <label className="text-sm font-bold text-slate-400 mb-2 block">Reference Image</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-bold file:bg-orange-600 file:text-white hover:file:bg-orange-500"
                                />
                                {imageStr && <div className="mt-4 text-xs text-emerald-400">✅ Image loaded successfully.</div>}
                            </div>
                            <div>
                                <label className="text-sm font-bold text-slate-400 mb-2 block">Additional Instructions (Optional)</label>
                                <textarea
                                    value={prompt}
                                    onChange={e => setPrompt(e.target.value)}
                                    placeholder="e.g., Change the background to a snowy mountain."
                                    className="w-full bg-slate-800 border-slate-700 rounded-lg p-3 h-20 text-sm focus:border-orange-500 outline-none resize-none"
                                />
                            </div>
                        </div>
                    )}

                    <div className="pt-4 border-t border-slate-800 flex justify-end gap-3">
                        <button onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-slate-300 hover:text-white">
                            Cancel
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={starting || (method === 'brainstorm' && !prompt.trim()) || (method === 'image' && !imageStr)}
                            className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-sm font-bold transition-all shadow-lg"
                        >
                            {starting ? 'Starting...' : 'Launch Scout Job'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ContentCard({ item, workflows, personas, onUpdate, isSelected, onToggleSelect }: {
    item: ContentItem;
    workflows: any[];
    personas: any[];
    onUpdate: () => void;
    isSelected: boolean;
    onToggleSelect: () => void;
}) {
    const [unblur, setUnblur] = useState(false)
    const [caption, setCaption] = useState(item.caption_final || item.caption_draft || '')
    const [approving, setApproving] = useState(false)
    const [showStudio, setShowStudio] = useState(false)

    // Draft Editor States (Phase 1.5)
    const [contentType, setContentType] = useState(item.content_type)
    const [selectedWorkflowId, setSelectedWorkflowId] = useState(item.selected_workflow_id || '')
    const [genSfw, setGenSfw] = useState(item.gen_sfw)
    const [genNsfw, setGenNsfw] = useState(item.gen_nsfw)
    const [postToIg, setPostToIg] = useState(item.post_to_ig)
    const [postToX, setPostToX] = useState(item.post_to_x)
    const [postToFanvue, setPostToFanvue] = useState(item.post_to_fanvue)

    const [batchSize, setBatchSize] = useState(item.batch_size || 4)
    const [imageWidth, setImageWidth] = useState(item.image_width || 896)
    const [imageHeight, setImageHeight] = useState(item.image_height || 1152)
    const [isRefilling, setIsRefilling] = useState(false)

    // Sync from props (Global Settings Retroactive Effect)
    useEffect(() => {
        setBatchSize(item.batch_size || 4)
        setImageWidth(item.image_width || 896)
        setImageHeight(item.image_height || 1152)
    }, [item.batch_size, item.image_width, item.image_height])

    const [sfwPrompt, setSfwPrompt] = useState(item.sfw_prompt || '')
    const [promptStructure, setPromptStructure] = useState<any>(item.prompt_structure || {
        mood_and_tone: '', vibe: '', lighting: '', outfit: '',
        camera_settings: ['', '', '', ''], poses: ['', '', '', ''], nsfw_prompts: ['', '', '', ''], vdo_prompts: ['', '', '', ''], vdo_prompts_nsfw: ['', '', '', '']
    })
    const [scheduledAt, setScheduledAt] = useState(item.scheduled_at ? new Date(item.scheduled_at).toISOString().slice(0, 16) : '')
    const [showPrompt, setShowPrompt] = useState(false)

    const updatePromptStructure = (key: string, value: any, idx?: number) => {
        const updated = { ...promptStructure }
        if (idx !== undefined) {
            if (!Array.isArray(updated[key])) updated[key] = ['', '', '', '']
            const arr = [...updated[key]]
            arr[idx] = value
            updated[key] = arr
        } else {
            updated[key] = value
        }
        setPromptStructure(updated)
        // debounce save (or direct save)
        handleUpdateDraft({ prompt_structure: updated })
    }

    useEffect(() => {
        if (genNsfw) {
            setPostToIg(false)
            handleUpdateDraft({ post_to_ig: false })
        }
    }, [genNsfw])

    const handleUpdateDraft = async (updates: Partial<ContentItem>) => {
        await fetch(`/api/content/${item.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        })
    }

    const sfwImages = item.generated_images?.filter(img => img.image_type === 'SFW') || []
    const nsfwImages = item.generated_images?.filter(img => img.image_type === 'NSFW') || []

    // Default to SFW, fallback to NSFW if SFW is not generated
    const displayImages = sfwImages.length > 0 ? sfwImages : nsfwImages

    // Default to the first image if not selected yet, or strictly the selected one once approved
    const [selectedImageId, setSelectedImageId] = useState<string | null>(item.selected_image_id || (displayImages.length > 0 ? displayImages[0].id : null))
    const displayImage = displayImages.find(img => img.id === selectedImageId) || displayImages[0]

    const getImageUrl = (path: string) => {
        if (!path) return ''
        if (path.startsWith('http')) return path
        return path.replace('/storage/', '/api/')
    }

    const statusColors = {
        Draft: 'bg-slate-700 text-slate-300',
        'In Production': 'bg-blue-900 text-blue-200 animate-pulse',
        'QC Pending': 'bg-amber-900 text-amber-200',
        'Awaiting Approval': 'bg-orange-900 text-orange-200 border border-orange-500/50',
        Scheduled: 'bg-emerald-900 text-emerald-200',
        Published: 'bg-purple-900 text-purple-200'
    }

    async function handleApprove() {
        setApproving(true)
        try {
            // 1. Update Final Caption
            await fetch(`/api/content/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ caption_final: caption })
            })

            // 2. Call Approval API
            const res = await fetch('/api/jobs/approve-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId: item.id,
                    caption_final: caption,
                    scheduledAt: new Date(scheduledAt || Date.now() + 3600000).toISOString(), // Schedule 1 hour from now as default
                    selectedImageId: selectedImageId
                })
            })

            if (res.ok) {
                onUpdate()
            }
        } catch (err) {
            console.error(err)
        } finally {
            setApproving(false)
        }
    }

    return (
        <div className={`bg-slate-800 rounded-2xl border overflow-hidden transition-all group shadow-lg \${isSelected ? 'border-orange-500 ring-1 ring-orange-500/50' : 'border-slate-700 hover:border-orange-500/50'}`}>
            {/* Image Preview / Draft Settings */}
            <div className="relative aspect-square bg-slate-900 border-b border-slate-700/50">
                {/* Selection Checkbox Overlay */}
                <div
                    onClick={onToggleSelect}
                    className={`absolute top-4 right-4 z-20 w-6 h-6 rounded-lg border-2 cursor-pointer flex items-center justify-center transition-all \${isSelected ? 'bg-orange-500 border-orange-400' : 'bg-black/50 border-white/20 hover:border-white'}`}
                >
                    {isSelected && <span className="text-white text-xs font-black">✓</span>}
                </div>
                {item.status === 'Draft' ? (
                    <div className="w-full h-full flex flex-col p-6 space-y-4 overflow-y-auto">
                        <div className="flex justify-between items-center mb-1">
                            <div className="text-xs text-orange-400 font-bold tracking-widest uppercase">Phase 1.5: Setup</div>
                            <button onClick={() => setShowPrompt(true)} className="text-[10px] font-bold bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition-colors border border-slate-600">
                                👁️ View Prompt
                            </button>
                        </div>

                        {showPrompt && (
                            <PromptEditorModal
                                item={item}
                                workflows={workflows}
                                personas={personas}
                                promptStructure={promptStructure}
                                updatePromptStructure={updatePromptStructure}
                                sfwPrompt={sfwPrompt}
                                setSfwPrompt={setSfwPrompt}
                                handleUpdateDraft={handleUpdateDraft}
                                onClose={() => setShowPrompt(false)}
                                genNsfw={genNsfw}
                            />
                        )}

                        <div>
                            <label className="text-[10px] font-bold text-orange-400 mb-1 block">WORKFLOW TEMPLATE OVERRIDE</label>
                            <select
                                value={selectedWorkflowId}
                                onChange={e => {
                                    setSelectedWorkflowId(e.target.value)
                                    handleUpdateDraft({ selected_workflow_id: e.target.value || null as any })
                                }}
                                className="w-full bg-slate-900 border border-orange-500/30 hover:border-orange-500/70 rounded p-2 text-xs text-slate-300 focus:outline-none transition-colors"
                            >
                                <option value="">Auto-select (Latest {item.persona || 'Shared'})</option>
                                {workflows.filter(wf => !wf.persona || wf.persona === item.persona).map(wf => (
                                    <option key={wf.id} value={wf.id}>{wf.name} ({wf.workflow_type})</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-bold text-slate-400 mb-1 block">EXPECTED POST DATE</label>
                            <input
                                type="datetime-local"
                                value={scheduledAt}
                                onChange={e => {
                                    setScheduledAt(e.target.value)
                                    handleUpdateDraft({ scheduled_at: new Date(e.target.value).toISOString() })
                                }}
                                className="w-full bg-slate-800 border-none rounded p-2 text-xs text-slate-300 focus:ring-1 ring-orange-500 outline-none"
                            />
                        </div>

                        <div className="grid grid-cols-4 gap-2">
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 mb-1 block">BATCH SIZE</label>
                                <div className="flex gap-2">
                                    <input
                                        type="number"
                                        min="1"
                                        max="8"
                                        value={batchSize}
                                        onChange={e => {
                                            const val = parseInt(e.target.value) || 1
                                            setBatchSize(val)
                                        }}
                                        onBlur={() => handleUpdateDraft({ batch_size: batchSize })}
                                        className="w-full bg-slate-800 border-none rounded p-2 text-xs text-slate-300 focus:ring-1 ring-orange-500 outline-none"
                                    />
                                    <div className="flex gap-2">
                                        {item.batch_size > (item.prompt_structure?.poses?.length || 0) && (
                                            <button
                                                onClick={async () => {
                                                    setIsRefilling(true)
                                                    const res = await fetch('/api/jobs/refill-prompts', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ contentId: item.id, targetBatchSize: item.batch_size })
                                                    })
                                                    if (res.ok) {
                                                        onUpdate()
                                                    }
                                                    setIsRefilling(false)
                                                }}
                                                disabled={isRefilling}
                                                className="px-3 py-1.5 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black rounded-lg shadow-lg shadow-orange-600/20 transition-all active:scale-95"
                                            >
                                                {isRefilling ? '...' : '✨ REFILL'}
                                            </button>
                                        )}
                                        {(item.status as string === 'QC Pending' || item.status as string === 'Awaiting Approval') && (item.generated_images?.length || 0) < (item.batch_size || 4) && (
                                            <button
                                                onClick={async () => {
                                                    setApproving(true)
                                                    const res = await fetch('/api/jobs/phase2-production', {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ contentIds: [item.id] })
                                                    })
                                                    if (res.ok) {
                                                        alert('🚀 Generating missing slots! Please wait...')
                                                        onUpdate()
                                                    }
                                                    setApproving(false)
                                                }}
                                                disabled={approving}
                                                className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black rounded-lg shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                                            >
                                                {approving ? '...' : '🚀 GEN MISSING'}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 mb-1 block">WIDTH</label>
                                <input
                                    type="number"
                                    step="64"
                                    value={imageWidth}
                                    onChange={e => {
                                        const val = parseInt(e.target.value) || 896
                                        setImageWidth(val)
                                    }}
                                    onBlur={() => handleUpdateDraft({ image_width: imageWidth })}
                                    className="w-full bg-slate-800 border-none rounded p-2 text-xs text-slate-300 focus:ring-1 ring-orange-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-slate-400 mb-1 block">HEIGHT</label>
                                <input
                                    type="number"
                                    step="64"
                                    value={imageHeight}
                                    onChange={e => {
                                        const val = parseInt(e.target.value) || 1152
                                        setImageHeight(val)
                                    }}
                                    onBlur={() => handleUpdateDraft({ image_height: imageHeight })}
                                    className="w-full bg-slate-800 border-none rounded p-2 text-xs text-slate-300 focus:ring-1 ring-orange-500 outline-none"
                                />
                            </div>
                        </div>

                        <div className="space-y-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                            <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
                                <input type="checkbox" checked={genSfw} onChange={(e) => { setGenSfw(e.target.checked); handleUpdateDraft({ gen_sfw: e.target.checked }) }} className="w-4 h-4 rounded accent-orange-500 bg-slate-700 border-slate-600" />
                                Generate SFW Image
                            </label>
                            <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
                                <input type="checkbox" checked={genNsfw} onChange={(e) => { setGenNsfw(e.target.checked); handleUpdateDraft({ gen_nsfw: e.target.checked }) }} className="w-4 h-4 rounded accent-orange-500 bg-slate-700 border-slate-600" />
                                <span className="text-pink-400">Generate NSFW Image</span>
                            </label>
                        </div>

                        <div className="text-xs text-emerald-400 font-bold tracking-widest uppercase mt-4 mb-2">Platform Routing</div>
                        <div className="space-y-3 p-3 bg-slate-800/50 rounded-xl border border-slate-700/50">
                            <label className={`flex items-center gap-3 text-sm transition-colors cursor-pointer \${genNsfw ? 'text-slate-600 cursor-not-allowed' : 'text-slate-300 hover:text-white'}`}>
                                <input type="checkbox" disabled={genNsfw} checked={postToIg} onChange={(e) => { setPostToIg(e.target.checked); handleUpdateDraft({ post_to_ig: e.target.checked }) }} className="w-4 h-4 rounded accent-emerald-500 bg-slate-700 border-slate-600 disabled:opacity-50" />
                                Post to Instagram <span className="text-[10px] text-slate-500 ml-1">(SFW Only)</span>
                            </label>
                            <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
                                <input type="checkbox" checked={postToX} onChange={(e) => { setPostToX(e.target.checked); handleUpdateDraft({ post_to_x: e.target.checked }) }} className="w-4 h-4 rounded accent-emerald-500 bg-slate-700 border-slate-600" />
                                Post to X / Twitter
                            </label>
                            <label className="flex items-center gap-3 text-sm text-slate-300 cursor-pointer hover:text-white transition-colors">
                                <input type="checkbox" checked={postToFanvue} onChange={(e) => { setPostToFanvue(e.target.checked); handleUpdateDraft({ post_to_fanvue: e.target.checked }) }} className="w-4 h-4 rounded accent-emerald-500 bg-slate-700 border-slate-600" />
                                Post to Fanvue
                            </label>
                        </div>
                    </div>
                ) : displayImages.length > 0 ? (
                    <div className="w-full h-full flex flex-col">
                        {/* Main Image Display (Selected or First) */}
                        <div className="relative flex-1 overflow-hidden group/img">
                            {displayImage.media_type === 'video' ? (
                                <video
                                    src={getImageUrl(displayImage.file_path)}
                                    className="w-full h-full object-cover"
                                    controls
                                    muted
                                />
                            ) : (
                                <img
                                    src={getImageUrl(displayImage.file_path)}
                                    alt={item.topic}
                                    className={`w-full h-full object-cover transition-all duration-500 ${item.nsfw_option && !unblur ? 'blur-3xl' : 'blur-0'}`}
                                />
                            )}
                            {item.nsfw_option && !unblur && (
                                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm z-10">
                                    <span className="text-4xl mb-4">🔞</span>
                                    <button
                                        onClick={() => setUnblur(true)}
                                        className="px-4 py-2 bg-white text-black rounded-full font-bold hover:bg-orange-400 transition-colors shadow-xl"
                                    >
                                        👁️ Unblur
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Grid Selection for Awaiting Approval (if multiple images exist) */}
                        {(item.status === 'Awaiting Approval' || item.status === 'QC Pending') && displayImages.length > 1 && (
                            <div className="h-24 bg-slate-900 border-t border-slate-700/50 p-2 overflow-x-auto flex gap-2 shrink-0 hide-scrollbar">
                                {displayImages.map((img, idx) => (
                                    <button
                                        key={img.id}
                                        onClick={() => setSelectedImageId(img.id)}
                                        className={`relative h-full aspect-[3/4] shrink-0 rounded-md overflow-hidden border-2 transition-all ${selectedImageId === img.id ? 'border-orange-500 scale-100 shadow-lg' : 'border-transparent scale-95 opacity-50 hover:opacity-100 hover:scale-100'}`}
                                    >
                                        {img.media_type === 'video' ? (
                                            <video src={getImageUrl(img.file_path)} className="w-full h-full object-cover" />
                                        ) : (
                                            <img src={getImageUrl(img.file_path)} className="w-full h-full object-cover" />
                                        )}
                                        {selectedImageId === img.id && (
                                            <div className="absolute inset-0 bg-orange-500/20 flex items-center justify-center">
                                                <div className="bg-orange-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow">✓</div>
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-600 italic text-sm p-8 text-center">
                        <span>Waiting for Phase 2 Production...</span>
                    </div>
                )}

                {/* Status Badge */}
                <div className={`absolute top-4 left-4 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${statusColors[item.status]}`}>
                    {item.status}
                </div>
            </div>

            {/* Content Info */}
            <div className="p-5 space-y-4">
                <div className="flex justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-[10px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter ${statusColors[item.status as keyof typeof statusColors]}`}>
                                {item.status}
                            </span>
                            <span className="text-[10px] text-slate-500 font-bold">#{item.sequence_number}</span>
                        </div>
                        <h3 className="font-bold text-white leading-tight truncate">{item.topic}</h3>
                    </div>
                    {/* Phase 3: Permanent Creative Studio Button - High Fidelity */}
                    <button
                        onClick={() => setShowStudio(true)}
                        className="shrink-0 flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white rounded-xl text-xs font-black shadow-xl shadow-orange-600/30 transition-all hover:scale-105 active:scale-95 border border-orange-400/50"
                    >
                        🎨 STUDIO MODE
                    </button>
                </div>

                {showStudio && (
                    <CreativeStudioModal
                        item={item}
                        onUpdate={onUpdate}
                        onClose={() => setShowStudio(false)}
                    />
                )}

                <div>
                    <label className="text-[10px] text-slate-500 uppercase font-bold mb-1 block">Caption</label>
                    <textarea
                        value={caption}
                        onChange={(e) => setCaption(e.target.value)}
                        disabled={item.status === 'Scheduled' || item.status === 'Published'}
                        className="w-full bg-slate-900 text-sm border border-slate-700 rounded-lg p-3 h-24 focus:border-orange-500 outline-none transition-colors resize-none disabled:opacity-50"
                    />
                </div>

                <div className="pt-2 flex gap-2">
                    {item.status === 'Awaiting Approval' ? (
                        <button
                            onClick={handleApprove}
                            disabled={approving || displayImages.length === 0 || !selectedImageId}
                            className="flex-1 py-2.5 bg-orange-600 hover:bg-orange-500 rounded-lg text-sm font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50"
                        >
                            {approving ? 'Scheduling...' : 'Approve & Schedule'}
                        </button>
                    ) : item.status === 'Scheduled' ? (
                        <div className="flex-1 py-2.5 bg-emerald-900/50 text-emerald-400 rounded-lg text-sm font-bold text-center border border-emerald-500/30">
                            📅 Scheduled {new Date(item.scheduled_at!).toLocaleDateString()}
                        </div>
                    ) : (
                        <button
                            disabled
                            className="flex-1 py-2.5 bg-slate-700 text-slate-500 rounded-lg text-sm font-bold"
                        >
                            {item.status}
                        </button>
                    )}
                    <button className="px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors border border-slate-600 active:scale-95">
                        ⚙️
                    </button>
                    {(item.status === 'In Production' || item.status === 'QC Pending' || item.status === 'Awaiting Approval') && (
                        <>
                            <button
                                onClick={() => setShowPrompt(true)}
                                title="View Prompts"
                                className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg transition-colors border border-slate-600 active:scale-95"
                            >
                                👁️
                            </button>
                            <button
                                onClick={async () => {
                                    if (!confirm('Reset this item to Draft? This will allow you to regenerate it.')) return;
                                    const res = await fetch(`/api/content/${item.id}`, {
                                        method: 'PATCH',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({ status: 'Draft' })
                                    });
                                    if (res.ok) onUpdate();
                                    else alert('Failed to reset');
                                }}
                                title="Reset to Draft"
                                className="px-3 py-2 bg-amber-950/30 hover:bg-amber-900/50 text-amber-500 rounded-lg transition-colors border border-amber-900/30 active:scale-95"
                            >
                                🔄
                            </button>
                        </>
                    )}
                    <button
                        onClick={async () => {
                            if (!confirm('Are you sure you want to delete this content and all related images?')) return
                            const res = await fetch(`/api/content/${item.id}`, { method: 'DELETE' })
                            if (res.ok) onUpdate()
                            else alert('Delete failed')
                        }}
                        className="px-3 py-2 bg-rose-950/30 hover:bg-rose-900/50 text-rose-500 rounded-lg transition-colors border border-rose-900/30 active:scale-95"
                    >
                        🗑️
                    </button>
                </div>

                {/* Always allow Prompt Editor to mount regardless of status if triggered from footer buttons */}
                {showPrompt && item.status !== 'Draft' && (
                    <PromptEditorModal
                        item={item}
                        workflows={workflows}
                        personas={personas}
                        promptStructure={promptStructure}
                        updatePromptStructure={updatePromptStructure}
                        sfwPrompt={sfwPrompt}
                        setSfwPrompt={setSfwPrompt}
                        handleUpdateDraft={handleUpdateDraft}
                        onClose={() => setShowPrompt(false)}
                        genNsfw={genNsfw}
                    />
                )}
            </div>
        </div>
    )
}

function PromptEditorModal({
    item,
    workflows,
    personas,
    promptStructure,
    updatePromptStructure,
    sfwPrompt,
    setSfwPrompt,
    handleUpdateDraft,
    onClose,
    genNsfw
}: any) {
    const buildFinalPrompt = (idx: number, type: 'SFW' | 'NSFW') => {
        let personaTrigger = ''
        let personaInstruction = ''
        if (item.persona) {
            const p = personas?.find((pd: any) => pd.name === item.persona)
            if (p) {
                personaTrigger = p.trigger_word || ''
                personaInstruction = p.instruction_rule || ''
            }
        }

        const pose = (promptStructure?.poses && promptStructure.poses.length > idx) ? promptStructure.poses[idx] : ''
        const camera = (promptStructure?.camera_settings && promptStructure.camera_settings.length > idx) ? promptStructure.camera_settings[idx] : ''
        const nsfwPrompt = (promptStructure?.nsfw_prompts && promptStructure.nsfw_prompts.length > idx) ? promptStructure.nsfw_prompts[idx] : ''
        const vdoPrompt = (promptStructure?.vdo_prompts && promptStructure.vdo_prompts.length > idx) ? promptStructure.vdo_prompts[idx] : ''
        const vdoPromptNsfw = (promptStructure?.vdo_prompts_nsfw && promptStructure.vdo_prompts_nsfw.length > idx) ? promptStructure.vdo_prompts_nsfw[idx] : ''

        const hasFixedElements = promptStructure?.mood_and_tone || promptStructure?.vibe || promptStructure?.lighting || promptStructure?.outfit

        let baseDescription = sfwPrompt
        if (hasFixedElements) {
            baseDescription = [
                promptStructure.mood_and_tone,
                promptStructure.vibe,
                promptStructure.lighting,
                promptStructure.outfit
            ].filter(p => p && String(p).trim() !== '').join(', ')
        }

        const parts = [
            personaTrigger,
            baseDescription,
            camera,
            pose
        ]
        if (type === 'NSFW' && nsfwPrompt) parts.push(nsfwPrompt)

        const dynamicPrompt = parts
            .map(p => String(p || '').trim())
            .filter(p => p !== '')
            .join(', ')

        // Find selected workflow base prompt
        let basePos = ''
        const wfId = item.selected_workflow_id
        if (wfId) {
            const selectedWf = workflows?.find((w: any) => w.id === wfId)
            if (selectedWf && selectedWf.base_positive_prompt) {
                basePos = `${selectedWf.base_positive_prompt}, `
            }
        }

        const legacyTag = (!basePos && type === 'NSFW' && !nsfwPrompt) ? ', nsfw, uncensored' : ''
        return `${basePos}${dynamicPrompt}${legacyTag}`
    }

    const [isRefilling, setIsRefilling] = React.useState(false)
    const handleRefillPrompts = async () => {
        setIsRefilling(true)
        try {
            const res = await fetch('/api/jobs/refill-prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contentId: item.id, targetBatchSize: item.batch_size })
            })
            const data = await res.json()
            if (data.success) {
                // We need to refresh the local state of promptStructure 
                // Since this modal usually takes it as props, we'll call item's update or similar
                // For simplicity, we assume updatePromptStructure handles parent sync
                Object.keys(data.data).forEach(key => {
                    updatePromptStructure(key, data.data[key])
                })
                alert('✨ Missing prompts refilled by AI!')
            }
        } catch (e) {
            alert('❌ Refill failed')
        } finally {
            setIsRefilling(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-2xl w-full max-w-5xl shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95">
                <div className="flex justify-between items-center mb-6 border-b border-slate-800 pb-4">
                    <h3 className="text-xl font-bold text-orange-400 flex items-center gap-2">
                        <span>👁️</span> Prompt Structure Editor
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-2 text-2xl leading-none">&times;</button>
                </div>

                <div className="space-y-6">
                    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 space-y-4">
                        <h4 className="text-sm font-bold text-slate-300 uppercase border-b border-slate-700 pb-2 flex justify-between">
                            <span>Fixed Prompt Elements</span>
                            <span className="text-[10px] text-slate-500 font-normal normal-case mt-1">Applied to all 4 images</span>
                        </h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Mood & Tone</label>
                                <input value={promptStructure.mood_and_tone || ''} onChange={e => updatePromptStructure('mood_and_tone', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded py-2 px-3 text-sm text-slate-200 focus:border-orange-500 outline-none transition-colors" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Vibe</label>
                                <input value={promptStructure.vibe || ''} onChange={e => updatePromptStructure('vibe', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded py-2 px-3 text-sm text-slate-200 focus:border-orange-500 outline-none transition-colors" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Lighting</label>
                                <input value={promptStructure.lighting || ''} onChange={e => updatePromptStructure('lighting', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded py-2 px-3 text-sm text-slate-200 focus:border-orange-500 outline-none transition-colors" />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-500 block mb-1">Outfit</label>
                                <input value={promptStructure.outfit || ''} onChange={e => updatePromptStructure('outfit', e.target.value)} className="w-full bg-slate-900 border border-slate-700 rounded py-2 px-3 text-sm text-slate-200 focus:border-orange-500 outline-none transition-colors" />
                            </div>
                        </div>
                    </div>

                    <div className="bg-slate-900/50 rounded-xl p-4 border border-orange-500/20 space-y-4 shadow-inner">
                        <h4 className="text-sm font-bold text-orange-400 uppercase border-b border-orange-500/30 pb-2 flex justify-between items-center">
                            <span>Variable Prompt Elements</span>
                            <div className="flex gap-2">
                                {(promptStructure?.poses?.length < item.batch_size) && (
                                    <button
                                        onClick={handleRefillPrompts}
                                        disabled={isRefilling}
                                        className="text-[10px] bg-orange-600 hover:bg-orange-500 text-white px-2 py-1 rounded font-black animate-pulse disabled:opacity-50"
                                    >
                                        {isRefilling ? 'REFILLING...' : '✨ AI FILL MISSING'}
                                    </button>
                                )}
                                <span className="text-[10px] text-orange-500/60 font-normal normal-case mt-1">1 unique set per image</span>
                            </div>
                        </h4>
                        <div className={`grid gap-4 ${item.batch_size > 4 ? 'grid-cols-5' : item.batch_size === 3 ? 'grid-cols-3' : 'grid-cols-4'}`}>
                            {Array.from({ length: item.batch_size || 4 }).map((_, idx) => (
                                <div key={idx} className="bg-slate-800 border border-slate-700/50 rounded-xl p-3 space-y-3">
                                    <div className="text-xs font-bold text-slate-400 text-center mb-2 bg-slate-900/80 rounded py-1 border border-slate-700/50">IMAGE {idx + 1}</div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">CAMERA</label>
                                        <textarea value={(promptStructure.camera_settings && promptStructure.camera_settings[idx]) || ''} onChange={e => updatePromptStructure('camera_settings', e.target.value, idx)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-300 focus:border-orange-500 outline-none resize-none h-16 transition-colors" />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">POSE</label>
                                        <textarea value={(promptStructure.poses && promptStructure.poses[idx]) || ''} onChange={e => updatePromptStructure('poses', e.target.value, idx)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-300 focus:border-orange-500 outline-none resize-none h-24 transition-colors" />
                                    </div>
                                    {genNsfw && (
                                        <div className="space-y-4 pt-4 border-t border-pink-900/20">
                                            <div>
                                                <label className="text-[10px] font-bold text-pink-500/70 block mb-1">NSFW MODIFIERS (SPICY)</label>
                                                <textarea value={(promptStructure.nsfw_prompts && promptStructure.nsfw_prompts[idx]) || ''} onChange={e => updatePromptStructure('nsfw_prompts', e.target.value, idx)} className="w-full bg-slate-900 border border-pink-900/50 rounded p-2 text-xs text-pink-200 focus:border-pink-500 outline-none resize-none h-20 transition-colors shadow-[0_0_10px_rgba(236,72,153,0.05)]" />
                                            </div>
                                            <div>
                                                <label className="text-[10px] font-bold text-rose-500 block mb-1">NSFW VIDEO PROMPT (15S)</label>
                                                <textarea value={(promptStructure.vdo_prompts_nsfw && promptStructure.vdo_prompts_nsfw[idx]) || ''} onChange={e => updatePromptStructure('vdo_prompts_nsfw', e.target.value, idx)} className="w-full bg-slate-900 border border-rose-900/50 rounded p-2 text-xs text-rose-200 focus:border-rose-500 outline-none resize-none h-20 transition-colors shadow-[0_0_10px_rgba(244,63,94,0.05)]" />
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <label className="text-[10px] font-bold text-indigo-400 block mb-1">VIDEO PROMPT (15S)</label>
                                        <textarea value={(promptStructure.vdo_prompts && promptStructure.vdo_prompts[idx]) || ''} onChange={e => updatePromptStructure('vdo_prompts', e.target.value, idx)} className="w-full bg-slate-900 border border-indigo-900/50 rounded p-2 text-xs text-indigo-200 focus:border-indigo-500 outline-none resize-none h-20 transition-colors shadow-[0_0_10px_rgba(99,102,241,0.05)]" />
                                    </div>
                                    <div className="pt-2 mt-2 border-t border-slate-700/50">
                                        <label className="text-[9px] font-bold text-emerald-500/80 block mb-1 uppercase">Final SFW Prompt Preview</label>
                                        <div className="text-[9px] text-slate-400 bg-slate-900/80 p-2 rounded-lg border border-slate-700/30 max-h-32 overflow-y-auto font-mono scrollbar-thin">
                                            {buildFinalPrompt(idx, 'SFW') || <span className="italic opacity-50">Fallback to SFW text...</span>}
                                        </div>
                                    </div>
                                    {genNsfw && (
                                        <div className="pt-2 mt-2 border-t border-slate-700/50">
                                            <label className="text-[9px] font-bold text-pink-500/80 block mb-1 uppercase">Final NSFW Prompt Preview</label>
                                            <div className="text-[9px] text-slate-400 bg-slate-900/80 p-2 rounded-lg border border-pink-900/30 max-h-32 overflow-y-auto font-mono scrollbar-thin">
                                                {buildFinalPrompt(idx, 'NSFW') || <span className="italic opacity-50">Fallback to SFW text...</span>}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
                        <label className="text-xs font-bold text-slate-500 mb-2 block">MANUAL FALLBACK (SFW PROMPT)</label>
                        <p className="text-[10px] text-slate-500 mb-2">Used only if the structured schema above is completely empty.</p>
                        <textarea
                            value={sfwPrompt}
                            onChange={e => setSfwPrompt(e.target.value)}
                            onBlur={() => handleUpdateDraft({ sfw_prompt: sfwPrompt })}
                            className="w-full bg-slate-900 border border-slate-700 rounded p-3 text-xs text-slate-400 h-16 focus:border-orange-500 outline-none resize-none transition-colors"
                        />
                    </div>
                </div>

                <div className="mt-8 pt-4 border-t border-slate-800 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-2.5 bg-orange-600 hover:bg-orange-500 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95">
                        Done Editing
                    </button>
                </div>
            </div>
        </div>
    )
}
