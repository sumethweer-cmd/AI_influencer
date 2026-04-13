'use client'

import React, { useEffect, useState } from 'react'
import Image from 'next/image'
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
    const [globalUnblur, setGlobalUnblur] = useState(false)
    const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc')
    const [contentFilter, setContentFilter] = useState<'All' | 'SFW' | 'NSFW'>('All')
    const [isDownloadingZip, setIsDownloadingZip] = useState(false)

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1)
    const [totalPages, setTotalPages] = useState(1)
    const [totalCount, setTotalCount] = useState(0)
    const limit = 20

    useEffect(() => {
        Promise.all([fetchWorkflows(), fetchPersonas()])
    }, [])

    useEffect(() => {
        fetchItems()
    }, [activePersona, statusFilter, contentFilter, sortOrder, currentPage])

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

    async function fetchItems(silent = false) {
        if (!silent) setLoading(true)
        try {
            const params = new URLSearchParams({
                page: currentPage.toString(),
                limit: limit.toString(),
                persona: activePersona,
                status: statusFilter,
                contentFilter: contentFilter,
                sortOrder: sortOrder
            })

            const res = await fetch(`/api/content?${params.toString()}`)
            const json = await res.json()
            if (json.success) {
                setItems(json.data)
                setTotalPages(json.pagination.totalPages)
                setTotalCount(json.pagination.totalCount)
            }
        } catch (e) {
            console.error('Failed to fetch items:', e)
        }
        if (!silent) setLoading(false)
    }

    async function fetchJobStats() {
        try {
            const res = await fetch('/api/jobs/queue-stats')
            const json = await res.json()
            if (json.success) setJobStats(json.stats)
            return json.stats
        } catch (e) {
            console.error('Failed to fetch job stats:', e)
            return null
        }
    }

    // Polling removed per user feedback (Legacy behavior)
    useEffect(() => {
        fetchJobStats()
    }, []) // Run once on mount

    const draftItems = items.filter(item => item.status === 'Draft')
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

    const handleBulkEnableNsfw = async () => {
        if (!confirm(`Are you sure you want to enable NSFW generation for ${selectedIds.length} items?`)) return
        try {
            const res = await fetch('/api/content/bulk-update', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ids: selectedIds, updates: { gen_nsfw: true } })
            })
            if (res.ok) {
                fetchItems()
                alert('Successfully enabled NSFW for selected items.')
            } else {
                alert('Bulk update failed')
            }
        } catch (e) {
            alert('Bulk update error')
        }
    }

    const handleBulkDownloadZip = async () => {
        setIsDownloadingZip(true)
        try {
            const JSZip = (await import('jszip')).default
            const { saveAs } = await import('file-saver')

            const zip = new JSZip()
            let count = 0

            const selectedItems = items.filter(i => selectedIds.includes(i.id))

            for (const item of selectedItems) {
                if (item.generated_images && item.generated_images.length > 0) {
                    const safeName = item.topic ? item.topic.substring(0, 30).replace(/[^a-z0-9]/gi, '_') : 'Untitled'
                    const folder = zip.folder(`${item.persona || 'Unknown'}_${safeName.trim()}`)

                    for (const img of item.generated_images) {
                        try {
                            // Use proxy API to avoid CORS issues with GCS
                            const url = `/api/media/download-original?imageId=${img.id}`
                            const res = await fetch(url)
                            if (res.ok) {
                                const blob = await res.blob()
                                const contentType = res.headers.get('content-type') || ''
                                const extension = img.media_type === 'video' ? 'mp4' : (contentType.includes('png') ? 'png' : 'webp')
                                const filename = `${img.image_type || 'image'}_${img.id.substring(0, 8)}.${extension}`
                                folder?.file(filename, blob)
                                count++
                            }
                        } catch (e) {
                            console.error('Failed to download image', img.file_path)
                        }
                    }
                }
            }

            if (count > 0) {
                const content = await zip.generateAsync({ type: 'blob' })
                saveAs(content, `Influencer_Content_${new Date().toISOString().slice(0, 10)}.zip`)
            } else {
                alert('No images found in selected content.')
            }
        } catch (error) {
            console.error(error)
            alert('Failed to generate ZIP file')
        }
        setIsDownloadingZip(false)
    }

    const toggleSelectAll = () => {
        if (selectedIds.length === items.length) {
            setSelectedIds([])
        } else {
            setSelectedIds(items.map(i => i.id))
        }
    }

    return (
        <div className="flex flex-col lg:flex-row gap-4 lg:gap-8 p-4 lg:p-0">
            {/* Left Sidebar Persona Tab */}
            <aside className="w-full lg:w-64 shrink-0 space-y-4">
                <div className="bg-slate-900 border border-slate-700/50 rounded-2xl p-4 lg:sticky lg:top-8 overflow-x-auto lg:overflow-x-visible hide-scrollbar">
                    <h3 className="text-[10px] lg:text-sm font-bold text-slate-400 mb-2 lg:mb-4 px-2 tracking-wider whitespace-nowrap">PERSONA VIEW</h3>
                    <div className="flex flex-row lg:flex-col gap-2 min-w-max lg:min-w-0">
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

                <div className="hidden lg:block lg:sticky lg:top-[340px]">
                    <h3 className="text-[10px] lg:text-sm font-bold text-slate-400 mb-2 px-2 tracking-wider">WORKSPACE TOOLS</h3>
                    <div className="space-y-2">
                        <a href="/dashboard/personas" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-slate-300 transition-colors font-bold border border-transparent">
                            <span>🎭</span> Manage Personas
                        </a>
                        <a href="/dashboard/prompts" className="flex items-center gap-3 px-4 py-3 rounded-xl hover:bg-slate-800 text-slate-300 transition-colors font-bold border border-transparent">
                            <span>📝</span> Prompt Gallery
                        </a>
                    </div>
                </div>

                <div className="hidden lg:block lg:sticky lg:top-[460px]">
                    <RunpodManager />
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 space-y-8">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div className="flex items-center gap-4 lg:gap-6">
                        <div className="min-w-0">
                            <h2 className="text-2xl lg:text-3xl font-bold truncate">Weekly Approval</h2>
                            <p className="text-slate-400 mt-1 text-xs lg:text-sm truncate">Review & schedule ({activePersona}) content.</p>
                        </div>
                        <div className="hidden sm:flex flex-col items-center px-4 py-1.5 bg-orange-600/10 border border-orange-500/20 rounded-2xl shrink-0">
                            <span className="text-[9px] font-black text-orange-400 uppercase tracking-widest">STOCK</span>
                            <span className="text-base lg:text-xl font-black text-orange-500">
                                {items.filter(i => (i.generated_images?.length || 0) > 0).length}
                            </span>
                        </div>
                    </div>
                    <div className="flex flex-wrap gap-2 lg:gap-3 items-center w-full lg:w-auto">
                        {/* Global Blur Toggle */}
                        <button
                            onClick={() => setGlobalUnblur(v => !v)}
                            className={`flex-1 lg:flex-none px-3 lg:px-4 py-2 lg:py-2.5 rounded-xl text-[10px] lg:text-sm font-black flex items-center justify-center gap-2 transition-all border ${globalUnblur
                                ? 'bg-rose-600/20 border-rose-500 text-rose-400'
                                : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                }`}
                        >
                            {globalUnblur ? '🔓 UNBLUR' : '🔞 BLUR'}
                        </button>
                        {hasDrafts && (
                            <button
                                onClick={handleConfirmPlan}
                                className="flex-1 lg:flex-none px-3 lg:px-5 py-2 lg:py-2.5 bg-gradient-to-r from-orange-500 to-rose-500 rounded-xl text-[10px] lg:text-sm font-black flex items-center justify-center gap-2 transition-all border border-orange-400"
                            >
                                <span>🚀</span> CONFIRM
                            </button>
                        )}
                        <a
                            href="/dashboard/personas"
                            className="flex-none p-2 lg:px-4 lg:py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs lg:text-sm font-bold flex items-center gap-2 border border-slate-700 transition-colors"
                        >
                            <span>👱‍♀️</span> <span className="hidden lg:inline">Personas</span>
                        </a>
                        <button
                            onClick={() => setShowSettingsModal(true)}
                            className="flex-none p-2 lg:px-5 lg:py-2.5 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs lg:text-sm font-bold flex items-center gap-2 border border-slate-700"
                        >
                            <span>⚙️</span> <span className="hidden lg:inline">Settings</span>
                        </button>
                        <button
                            onClick={() => setShowScoutModal(true)}
                            className="flex-1 lg:flex-none px-4 lg:px-5 py-2 lg:py-2.5 bg-indigo-600 hover:bg-indigo-500 rounded-xl text-[10px] lg:text-sm font-black flex items-center justify-center gap-2 border border-indigo-400 shadow-lg shadow-indigo-500/20"
                        >
                            <span>➕</span> NEW CONTENT
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
                        <div className="pb-4 flex flex-wrap items-center gap-4">
                            <select
                                value={activePersona}
                                onChange={e => setActivePersona(e.target.value)}
                                className="block lg:hidden bg-slate-900 border border-indigo-500/50 rounded-lg px-3 py-1.5 text-xs font-black text-indigo-400 focus:border-indigo-500 outline-none cursor-pointer shadow-sm"
                            >
                                <option value="All">🌟 All Personas</option>
                                {personas.map(p => (
                                    <option key={p.id} value={p.name}>{p.name}</option>
                                ))}
                            </select>

                            <select
                                value={sortOrder}
                                onChange={e => setSortOrder(e.target.value as any)}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-300 focus:border-orange-500 outline-none cursor-pointer"
                            >
                                <option value="desc">Newest First</option>
                                <option value="asc">Oldest First</option>
                            </select>

                            <select
                                value={contentFilter}
                                onChange={e => setContentFilter(e.target.value as any)}
                                className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs font-bold text-slate-300 focus:border-orange-500 outline-none cursor-pointer"
                            >
                                <option value="All">All Content</option>
                                <option value="SFW">SFW Only</option>
                                <option value="NSFW">Includes NSFW</option>
                            </select>

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
                                {selectedIds.length === items.length ? 'Deselect All' : 'Select All'}
                            </button>

                            {selectedIds.length > 0 && (
                                <div className="flex gap-2">
                                    <button
                                        onClick={handleBulkEnableNsfw}
                                        className="px-3 py-1 bg-pink-950/50 text-pink-500 rounded-lg text-[10px] font-black border border-pink-900/30 hover:bg-pink-900/60 transition-all animate-in fade-in slide-in-from-right-2"
                                    >
                                        🔞 ENABLE NSFW ({selectedIds.length})
                                    </button>
                                    <button
                                        onClick={handleBulkDelete}
                                        className="px-3 py-1 bg-rose-950/50 text-rose-500 rounded-lg text-[10px] font-black border border-rose-900/30 hover:bg-rose-900/60 transition-all animate-in fade-in slide-in-from-right-2"
                                    >
                                        🗑️ DELETE {selectedIds.length} SELECTED
                                    </button>
                                    <button
                                        onClick={handleBulkDownloadZip}
                                        disabled={isDownloadingZip}
                                        className="px-3 py-1 bg-blue-950/50 text-blue-400 rounded-lg text-[10px] font-black border border-blue-900/30 hover:bg-blue-900/60 transition-all animate-in fade-in slide-in-from-right-2"
                                    >
                                        {isDownloadingZip ? '📦 PACKING ZIP...' : '📦 DOWNLOAD ZIP'}
                                    </button>
                                </div>
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
                        {items.length > 0 ? (
                            items.map(item => (
                                <ContentCard
                                    key={item.id}
                                    item={item}
                                    workflows={workflows}
                                    personas={personas}
                                    onUpdate={fetchItems}
                                    isSelected={selectedIds.includes(item.id)}
                                    globalUnblur={globalUnblur}
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
                ) : null}

                {/* Pagination Controls */}
                {activeTab === 'workspace' && items.length > 0 && totalPages > 1 && (
                    <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl p-4 mt-8">
                        <div className="text-xs text-slate-400 font-medium">
                            Showing <span className="text-white font-bold">{items.length}</span> of <span className="text-white font-bold">{totalCount}</span> items
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-slate-300 rounded-lg transition-colors border border-slate-700"
                            >
                                ← PREV
                            </button>
                            <div className="flex items-center px-4 bg-slate-950 border border-slate-800 rounded-lg text-xs font-bold text-orange-400">
                                Page {currentPage} of {totalPages}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold text-slate-300 rounded-lg transition-colors border border-slate-700"
                            >
                                NEXT →
                            </button>
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

function ContentCard({ item, workflows, personas, onUpdate, isSelected, onToggleSelect, globalUnblur }: {
    item: ContentItem;
    workflows: any[];
    personas: any[];
    onUpdate: () => void;
    isSelected: boolean;
    onToggleSelect: () => void;
    globalUnblur?: boolean;
}) {
    const [unblur, setUnblur] = useState(false)
    const isUnblurred = globalUnblur || unblur
    const [caption, setCaption] = useState(item.caption_final || item.caption_draft || '')
    const [approving, setApproving] = useState(false)
    const [showStudio, setShowStudio] = useState(false)
    const [showPrompt, setShowPrompt] = useState(false)
    const [scheduledAt, setScheduledAt] = useState(item.scheduled_at ? new Date(item.scheduled_at).toISOString().slice(0, 16) : '')

    const getImageUrl = (path: string, width?: number) => {
        if (!path) return ''
        let finalPath = path
        // Auto-convert to webp for GCS originals if needed
        if (path.includes('storage.googleapis.com') && !path.endsWith('.webp') && !path.endsWith('.mp4')) {
            const lastDot = path.lastIndexOf('.')
            if (lastDot !== -1) finalPath = path.substring(0, lastDot) + '.webp'
        }

        // 1. If absolute URL, check if it's GCS and proxy it
        if (finalPath.startsWith('http')) {
            if (finalPath.includes('storage.googleapis.com')) {
                try {
                    const url = new URL(finalPath)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    // In GCS URL https://storage.googleapis.com/bucket/path, the first part of pathname is bucket
                    pathParts.shift() 
                    const cleanRelative = pathParts.join('/')
                    const proxyPath = `/api/images/${cleanRelative}`
                    return width ? `${proxyPath}?w=${width}` : proxyPath
                } catch (e) {
                    console.error('URL parse failed', e)
                }
            }
            return finalPath
        }
        
        // 2. If relative path, prepend /api/images/
        const base = `/api/images/${finalPath.startsWith('/') ? finalPath.slice(1) : finalPath}`
        return width ? `${base}?w=${width}` : base
    }

    const handleApprove = async () => {
        setApproving(true)
        try {
            await fetch(`/api/content/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ caption_final: caption })
            })

            const res = await fetch('/api/jobs/approve-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId: item.id,
                    caption_final: caption,
                    scheduledAt: new Date(scheduledAt || Date.now() + 3600000).toISOString(),
                    selectedImageId: item.selected_image_id || (item.generated_images?.[0]?.id)
                })
            })

            if (res.ok) onUpdate()
            else alert('Approval failed')
        } catch (e) {
            console.error(e)
        } finally {
            setApproving(false)
        }
    }

    const handleUpdateDraft = async (updates: Partial<ContentItem>) => {
        await fetch(`/api/content/${item.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updates)
        })
    }

    // New logic for Task 2's specific states if needed by child modals
    const [sfwPrompt, setSfwPrompt] = useState(item.sfw_prompt || '')
    const [promptStructure, setPromptStructure] = useState<any>(item.prompt_structure || {
        location: '', time: '', mood_and_tone: '', vibe: '', lighting: '', outfit: '',
        camera_settings: ['', '', '', ''], poses: ['', '', '', ''], face_expressions: ['', '', '', ''], nsfw_prompts: ['', '', '', ''], vdo_prompts: ['', '', '', ''], vdo_prompts_nsfw: ['', '', '', '']
    })

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
        handleUpdateDraft({ prompt_structure: updated })
    }

    const genNsfw = item.gen_nsfw

    // Find the primary image to show (selected or first available)
    const displayImage = item.generated_images?.find(img => img.id === item.selected_image_id) || item.generated_images?.[0]

    return (
        <div className={`relative flex flex-col bg-slate-900 border transition-all duration-300 rounded-[32px] overflow-hidden group shadow-2xl ${isSelected ? 'border-orange-500 ring-1 ring-orange-500/50' : 'border-slate-800 hover:border-slate-700 shadow-black/40'}`}>
            <div className="flex-1 overflow-hidden relative">
                {/* Main Visual */}
                <div className="relative aspect-[4/5] bg-black overflow-hidden flex items-center justify-center">
                    {displayImage ? (
                        <img
                            src={getImageUrl(displayImage.file_path, 400)}
                            className={`w-full h-full object-cover transition-all duration-700 ${displayImage.image_type === 'NSFW' && !isUnblurred ? 'blur-2xl opacity-50 scale-110' : 'blur-0 scale-100'}`}
                            alt={item.topic || 'thumbnail'}
                        />
                    ) : (
                        <div className="flex flex-col items-center gap-3 opacity-20 text-slate-500">
                            <span className="text-4xl">⌛</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">Wait for AI</span>
                        </div>
                    )}

                    {displayImage?.image_type === 'NSFW' && !isUnblurred && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm z-10">
                            <button
                                onClick={(e) => { e.stopPropagation(); setUnblur(true) }}
                                className="px-5 py-2.5 bg-white/10 hover:bg-white text-white hover:text-black rounded-full text-xs font-black transition-all border border-white/20 hover:scale-105 active:scale-95 shadow-2xl"
                            >
                                🔓 UNBLUR
                            </button>
                        </div>
                    )}

                    {/* Badge Overlay */}
                    <div className="absolute top-4 left-4 flex gap-2 z-20">
                        <span className={`px-2.5 py-1 backdrop-blur-md text-[10px] font-black rounded-lg shadow-lg uppercase ${item.status === 'Draft' ? 'bg-yellow-500 text-black' : 'bg-indigo-600 text-white'}`}>
                            {item.status}
                        </span>
                    </div>

                    {/* Selection Checkbox Overlay */}
                    <div
                        onClick={onToggleSelect}
                        className={`absolute top-4 right-4 z-30 w-7 h-7 rounded-xl border-2 cursor-pointer flex items-center justify-center transition-all ${isSelected ? 'bg-orange-500 border-orange-400 shadow-lg' : 'bg-black/60 border-white/20 hover:border-white'}`}
                    >
                        {isSelected && <span className="text-white text-sm font-black">✓</span>}
                    </div>

                    {/* Metadata Overlay - Bottom */}
                    <div className="absolute inset-x-0 bottom-0 p-6 bg-gradient-to-t from-black via-black/80 to-transparent flex flex-col justify-end gap-1 z-20">
                        <div className="flex justify-between items-start gap-4">
                            <div className="min-w-0">
                                <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">#{item.id?.slice(0, 4)}</span>
                                <h3 className="text-lg font-black text-white leading-tight truncate drop-shadow-md">{item.topic || 'Untitled Story'}</h3>
                                <p className="text-[10px] text-white/60 font-medium uppercase tracking-widest flex items-center gap-2 mt-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500" />
                                    {item.persona || 'Default'}
                                </p>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); setShowStudio(true) }}
                                className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-[10px] font-black rounded-xl shadow-xl shadow-orange-600/30 transition-all hover:scale-110 active:scale-95 shrink-0 flex items-center gap-2 border border-orange-400/30"
                            >
                                🎨 STUDIO MODE
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sub Content */}
                <div className="p-6 bg-slate-900 space-y-5 border-t border-white/5">
                    <div className="space-y-2">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex justify-between">
                            <span>Story Caption</span>
                            <span className="text-slate-600 italic">#{item.sequence_number}</span>
                        </p>
                        <div className="bg-black/30 border border-slate-800 rounded-2xl p-4 text-[13px] text-slate-300 leading-relaxed max-h-[140px] overflow-y-auto custom-scrollbar font-medium">
                            {item.caption_draft || 'No caption drafted for this post.'}
                        </div>
                    </div>

                    <div className="pt-2 flex gap-2">
                        {item.status === 'Awaiting Approval' ? (
                            <button
                                onClick={handleApprove}
                                disabled={approving || !displayImage}
                                className="flex-1 py-3 bg-orange-600 hover:bg-orange-500 text-white rounded-2xl text-xs font-black transition-all shadow-xl shadow-orange-600/20 active:scale-95 disabled:opacity-50"
                            >
                                {approving ? '...' : '🚀 APPROVE & SCHEDULE'}
                            </button>
                        ) : (
                            <div className="flex-1 py-3 bg-slate-800/50 text-slate-500 rounded-2xl text-[10px] font-black text-center border border-slate-700/50 uppercase tracking-widest">
                                {item.status} - {new Date(item.scheduled_at || item.created_at).toLocaleDateString()}
                            </div>
                        )}
                        <button
                            onClick={() => setShowPrompt(true)}
                            className="px-4 py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-2xl border border-slate-700 transition-all active:scale-95"
                            title="View Prompt Details"
                        >
                            👁️
                        </button>
                        <button
                            onClick={async (e) => {
                                e.stopPropagation();
                                if (!confirm('Delete this content?')) return
                                await fetch(`/api/content/${item.id}`, { method: 'DELETE' })
                                onUpdate()
                            }}
                            className="px-4 py-3 bg-red-950/20 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl border border-red-500/20 transition-all active:scale-95"
                        >
                            🗑️
                        </button>
                    </div>
                </div>
            </div>

            {showStudio && (
                <CreativeStudioModal
                    item={item}
                    onUpdate={onUpdate}
                    onClose={() => setShowStudio(false)}
                    onOpenPromptEditor={() => setShowPrompt(true)}
                />
            )}

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
        const faceExpression = (promptStructure?.face_expressions && promptStructure.face_expressions.length > idx) ? promptStructure.face_expressions[idx] : ''
        const nsfwPrompt = (promptStructure?.nsfw_prompts && promptStructure.nsfw_prompts.length > idx) ? promptStructure.nsfw_prompts[idx] : ''
        const vdoPromptRaw = (promptStructure?.vdo_prompts && promptStructure.vdo_prompts.length > idx) ? promptStructure.vdo_prompts[idx] : ''
        const vdoPromptNsfwRaw = (promptStructure?.vdo_prompts_nsfw && promptStructure.vdo_prompts_nsfw.length > idx) ? promptStructure.vdo_prompts_nsfw[idx] : ''

        // Handle possible object structure { clip_1, clip_2, clip_3 }
        const formatVdo = (v: any) => {
            if (!v) return ''
            if (typeof v === 'string') return v
            return [v.clip_1, v.clip_2, v.clip_3].filter(c => c && c.trim() !== '').join(', ')
        }

        const vdoPrompt = formatVdo(vdoPromptRaw)
        const vdoPromptNsfw = formatVdo(vdoPromptNsfwRaw)

        const hasFixedElements = promptStructure?.location || promptStructure?.time || promptStructure?.mood_and_tone || promptStructure?.vibe || promptStructure?.lighting || promptStructure?.outfit

        let baseDescription = sfwPrompt
        if (hasFixedElements) {
            baseDescription = [
                promptStructure.location,
                promptStructure.time,
                promptStructure.mood_and_tone,
                promptStructure.vibe,
                promptStructure.lighting,
                promptStructure.outfit
            ].filter(p => p && String(p).trim() !== '').join(', ')
        }

        const cameraSetting = camera ? `Camera setting is "${camera}"` : ''

        // For NSFW, we REPLACE the pose with the nsfw_prompt
        const actionPart = type === 'NSFW' ? nsfwPrompt : pose

        const parts = [
            personaTrigger,
            baseDescription,
            cameraSetting,
            faceExpression,
            actionPart
        ]

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

    const [isRegenerating, setIsRegenerating] = React.useState(false)
    const handleRegenerate = async (mode: 'SFW' | 'NSFW' | 'ALL') => {
        setIsRegenerating(true)
        try {
            const res = await fetch('/api/jobs/regenerate-prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contentId: item.id, mode })
            })
            const data = await res.json()
            if (data.success) {
                Object.keys(data.data).forEach(key => {
                    updatePromptStructure(key, data.data[key])
                })
                alert(`✨ ${mode} prompts regenerated by AI!`)
            } else {
                alert(`❌ Failed: ${data.error}`)
            }
        } catch (e) {
            alert('❌ Regeneration failed')
        } finally {
            setIsRegenerating(false)
        }
    }

    const [isGeneratingImg, setIsGeneratingImg] = React.useState(false)
    const handleGenBatch = async (mode: 'SFW' | 'NSFW' | 'ALL') => {
        setIsGeneratingImg(true)
        try {
            const res = await fetch('/api/jobs/generate-batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ contentId: item.id, mode })
            })
            const data = await res.json()
            if (data.success) {
                alert(`🚀 Successfully queued ${data.queuedCount} ${mode} images for generation. They will process in the background.`)
            } else {
                alert(`❌ Failed: ${data.error}`)
            }
        } catch (e) {
            alert('❌ Queuing failed')
        } finally {
            setIsGeneratingImg(false)
        }
    }

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100] p-0 md:p-4">
            <div className="bg-slate-900 border-0 md:border md:border-slate-700 p-4 md:p-6 rounded-none md:rounded-2xl w-full max-w-5xl shadow-2xl h-full md:h-auto max-h-[100vh] md:max-h-[90vh] overflow-y-auto animate-in zoom-in-95 flex flex-col">
                <div className="flex justify-between items-center mb-4 md:mb-6 border-b border-slate-800 pb-4 shrink-0">
                    <div className="min-w-0">
                        <h3 className="text-lg md:text-xl font-bold text-orange-400 flex items-center gap-2 truncate">
                            <span>✍️</span> <span className="truncate">Editor: {item.topic}</span>
                        </h3>
                        <p className="hidden md:block text-[10px] text-slate-400 mt-1">✨ Changes are automatically saved as you type.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white p-2 text-2xl leading-none shrink-0">&times;</button>
                </div>

                <div className="space-y-6">
                    <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700/50 space-y-4">
                        <h4 className="text-sm font-bold text-slate-300 uppercase border-b border-slate-700 pb-2 flex justify-between">
                            <span>Fixed Prompt Elements</span>
                            <span className="text-[10px] text-slate-500 font-normal normal-case mt-1">Applied to all 4 images</span>
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                            {[
                                { label: 'Location', key: 'location' },
                                { label: 'Time', key: 'time' },
                                { label: 'Mood & Tone', key: 'mood_and_tone' },
                                { label: 'Vibe', key: 'vibe' },
                                { label: 'Lighting', key: 'lighting' },
                                { label: 'Outfit', key: 'outfit' }
                            ].map(field => (
                                <div key={field.key}>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-[10px] md:text-xs font-bold text-slate-500 uppercase">{field.label}</label>
                                        <button
                                            onClick={() => {
                                                navigator.clipboard.writeText((promptStructure as any)[field.key] || '');
                                                alert(`Copied ${field.label}!`);
                                            }}
                                            className="text-[9px] text-orange-400 hover:text-orange-300 font-bold"
                                        >
                                            📋 COPY
                                        </button>
                                    </div>
                                    <input
                                        value={(promptStructure as any)[field.key] || ''}
                                        onChange={e => updatePromptStructure(field.key, e.target.value)}
                                        className="w-full bg-slate-900 border border-slate-700 rounded py-2 px-3 text-xs md:text-sm text-slate-200 focus:border-orange-500 outline-none transition-colors"
                                    />
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-slate-900/50 rounded-xl p-4 border border-orange-500/20 space-y-4 shadow-inner">
                        <h4 className="text-sm font-bold text-orange-400 uppercase border-b border-orange-500/30 pb-2 flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
                            <span>Variable Prompt Elements</span>
                            <div className="flex flex-wrap gap-2 text-[8px] sm:text-[10px]">
                                <button
                                    onClick={() => handleRegenerate('SFW')}
                                    disabled={isRegenerating}
                                    className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-500 text-white px-2 py-1.5 rounded font-black disabled:opacity-50"
                                >
                                    REGEN SFW
                                </button>
                                <button
                                    onClick={() => handleRegenerate('NSFW')}
                                    disabled={isRegenerating}
                                    className="flex-1 sm:flex-none bg-pink-600 hover:bg-pink-500 text-white px-2 py-1.5 rounded font-black disabled:opacity-50"
                                >
                                    REGEN NSFW
                                </button>
                                <button
                                    onClick={() => handleRegenerate('ALL')}
                                    disabled={isRegenerating}
                                    className="flex-1 sm:flex-none bg-orange-600 hover:bg-orange-500 text-white px-2 py-1.5 rounded font-black disabled:opacity-50"
                                >
                                    {isRegenerating ? '...' : 'REGEN ALL'}
                                </button>
                            </div>
                        </h4>
                        <div className={`grid gap-4 grid-cols-1 ${item.batch_size > 4 ? 'lg:grid-cols-5' : item.batch_size === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2 lg:grid-cols-4'}`}>
                            {Array.from({ length: item.batch_size || 4 }).map((_, idx) => (
                                <div key={idx} className="bg-slate-800 border border-slate-700/50 rounded-xl p-3 space-y-3">
                                    <div className="text-xs font-bold text-slate-400 text-center mb-2 bg-slate-900/80 rounded py-1 border border-slate-700/50">IMAGE {idx + 1}</div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">CAMERA</label>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText((promptStructure.camera_settings && promptStructure.camera_settings[idx]) || '');
                                                    alert('Copied Camera settings!');
                                                }}
                                                className="text-[9px] text-orange-400 hover:text-orange-300 font-bold"
                                            >
                                                📋 COPY
                                            </button>
                                        </div>
                                        <textarea value={(promptStructure.camera_settings && promptStructure.camera_settings[idx]) || ''} onChange={e => updatePromptStructure('camera_settings', e.target.value, idx)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-300 focus:border-orange-500 outline-none resize-none h-16 transition-colors" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">FACE EXPRESSION</label>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText((promptStructure.face_expressions && promptStructure.face_expressions[idx]) || '');
                                                    alert('Copied Face Expression description!');
                                                }}
                                                className="text-[9px] text-orange-400 hover:text-orange-300 font-bold"
                                            >
                                                📋 COPY
                                            </button>
                                        </div>
                                        <textarea value={(promptStructure.face_expressions && promptStructure.face_expressions[idx]) || ''} onChange={e => updatePromptStructure('face_expressions', e.target.value, idx)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-300 focus:border-orange-500 outline-none resize-none h-16 transition-colors" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">POSE</label>
                                            <button
                                                onClick={() => {
                                                    navigator.clipboard.writeText((promptStructure.poses && promptStructure.poses[idx]) || '');
                                                    alert('Copied Pose description!');
                                                }}
                                                className="text-[9px] text-orange-400 hover:text-orange-300 font-bold"
                                            >
                                                📋 COPY
                                            </button>
                                        </div>
                                        <textarea value={(promptStructure.poses && promptStructure.poses[idx]) || ''} onChange={e => updatePromptStructure('poses', e.target.value, idx)} className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-300 focus:border-orange-500 outline-none resize-none h-24 transition-colors" />
                                    </div>
                                    <div>
                                        <div className="flex justify-between items-center mb-1">
                                            <label className="text-[10px] font-bold text-teal-400 uppercase">✅ SFW VIDEO PROMPT (15S)</label>
                                            <button
                                                onClick={() => {
                                                    const v = promptStructure.vdo_prompts && promptStructure.vdo_prompts[idx];
                                                    const text = typeof v === 'string' ? v : `${v?.clip_1 || ''}\n${v?.clip_2 || ''}\n${v?.clip_3 || ''}`;
                                                    navigator.clipboard.writeText(text);
                                                    alert('Copied SFW Video prompt!');
                                                }}
                                                className="text-[9px] text-teal-400 hover:text-teal-300 font-bold"
                                            >
                                                📋 COPY
                                            </button>
                                        </div>
                                        {typeof (promptStructure.vdo_prompts && promptStructure.vdo_prompts[idx]) === 'string' ? (
                                            <textarea
                                                value={(promptStructure.vdo_prompts && promptStructure.vdo_prompts[idx]) || ''}
                                                onChange={e => updatePromptStructure('vdo_prompts', e.target.value, idx)}
                                                className="w-full bg-slate-900 border border-teal-900/50 rounded p-2 text-xs text-teal-200 focus:border-teal-500 outline-none resize-none h-20 transition-colors shadow-[0_0_10px_rgba(20,184,166,0.05)]"
                                            />
                                        ) : (
                                            <div className="space-y-1.5">
                                                <textarea
                                                    value={(promptStructure.vdo_prompts && promptStructure.vdo_prompts[idx]?.clip_1) || ''}
                                                    onChange={e => updatePromptStructure('vdo_prompts', { ...promptStructure.vdo_prompts[idx], clip_1: e.target.value }, idx)}
                                                    placeholder="Clip 1 (0-5s)"
                                                    className="w-full bg-slate-900 border border-teal-900/30 rounded p-2 text-[10px] text-teal-200 focus:border-teal-500 outline-none resize-none h-12"
                                                />
                                                <textarea
                                                    value={(promptStructure.vdo_prompts && promptStructure.vdo_prompts[idx]?.clip_2) || ''}
                                                    onChange={e => updatePromptStructure('vdo_prompts', { ...promptStructure.vdo_prompts[idx], clip_2: e.target.value }, idx)}
                                                    placeholder="Clip 2 (5-10s)"
                                                    className="w-full bg-slate-900 border border-teal-900/30 rounded p-2 text-[10px] text-teal-200 focus:border-teal-500 outline-none resize-none h-12"
                                                />
                                                <textarea
                                                    value={(promptStructure.vdo_prompts && promptStructure.vdo_prompts[idx]?.clip_3) || ''}
                                                    onChange={e => updatePromptStructure('vdo_prompts', { ...promptStructure.vdo_prompts[idx], clip_3: e.target.value }, idx)}
                                                    placeholder="Clip 3 (10-15s)"
                                                    className="w-full bg-slate-900 border border-teal-900/30 rounded p-2 text-[10px] text-teal-200 focus:border-teal-500 outline-none resize-none h-12"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-4 pt-4 border-t border-pink-900/20">
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-[10px] font-bold text-pink-500/70 uppercase">NSFW MODIFIERS (SPICY)</label>
                                                <button
                                                    onClick={() => {
                                                        navigator.clipboard.writeText((promptStructure.nsfw_prompts && promptStructure.nsfw_prompts[idx]) || '');
                                                        alert('Copied NSFW modifiers!');
                                                    }}
                                                    className="text-[9px] text-pink-400 hover:text-pink-300 font-bold"
                                                >
                                                    📋 COPY
                                                </button>
                                            </div>
                                            <textarea value={(promptStructure.nsfw_prompts && promptStructure.nsfw_prompts[idx]) || ''} onChange={e => updatePromptStructure('nsfw_prompts', e.target.value, idx)} className="w-full bg-slate-900 border border-pink-900/50 rounded p-2 text-xs text-pink-200 focus:border-pink-500 outline-none resize-none h-20 transition-colors shadow-[0_0_10px_rgba(236,72,153,0.05)]" />
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-[10px] font-bold text-rose-500 uppercase">🔞 NSFW VIDEO PROMPT (15S)</label>
                                                <button
                                                    onClick={() => {
                                                        const v = promptStructure.vdo_prompts_nsfw && promptStructure.vdo_prompts_nsfw[idx];
                                                        const text = typeof v === 'string' ? v : `${v?.clip_1 || ''}\n${v?.clip_2 || ''}\n${v?.clip_3 || ''}`;
                                                        navigator.clipboard.writeText(text);
                                                        alert('Copied NSFW Video prompt!');
                                                    }}
                                                    className="text-[9px] text-rose-400 hover:text-rose-300 font-bold"
                                                >
                                                    📋 COPY
                                                </button>
                                            </div>
                                            {typeof (promptStructure.vdo_prompts_nsfw && promptStructure.vdo_prompts_nsfw[idx]) === 'string' ? (
                                                <textarea
                                                    value={(promptStructure.vdo_prompts_nsfw && promptStructure.vdo_prompts_nsfw[idx]) || ''}
                                                    onChange={e => updatePromptStructure('vdo_prompts_nsfw', e.target.value, idx)}
                                                    className="w-full bg-slate-900 border border-rose-900/50 rounded p-2 text-xs text-rose-200 focus:border-rose-500 outline-none resize-none h-20 transition-colors shadow-[0_0_10px_rgba(244,63,94,0.05)]"
                                                />
                                            ) : (
                                                <div className="space-y-1.5">
                                                    <textarea
                                                        value={(promptStructure.vdo_prompts_nsfw && promptStructure.vdo_prompts_nsfw[idx]?.clip_1) || ''}
                                                        onChange={e => updatePromptStructure('vdo_prompts_nsfw', { ...promptStructure.vdo_prompts_nsfw[idx], clip_1: e.target.value }, idx)}
                                                        placeholder="Clip 1 (0-5s)"
                                                        className="w-full bg-slate-900 border border-rose-900/30 rounded p-2 text-[10px] text-rose-200 focus:border-rose-500 outline-none resize-none h-12"
                                                    />
                                                    <textarea
                                                        value={(promptStructure.vdo_prompts_nsfw && promptStructure.vdo_prompts_nsfw[idx]?.clip_2) || ''}
                                                        onChange={e => updatePromptStructure('vdo_prompts_nsfw', { ...promptStructure.vdo_prompts_nsfw[idx], clip_2: e.target.value }, idx)}
                                                        placeholder="Clip 2 (5-10s)"
                                                        className="w-full bg-slate-900 border border-rose-900/30 rounded p-2 text-[10px] text-rose-200 focus:border-rose-500 outline-none resize-none h-12"
                                                    />
                                                    <textarea
                                                        value={(promptStructure.vdo_prompts_nsfw && promptStructure.vdo_prompts_nsfw[idx]?.clip_3) || ''}
                                                        onChange={e => updatePromptStructure('vdo_prompts_nsfw', { ...promptStructure.vdo_prompts_nsfw[idx], clip_3: e.target.value }, idx)}
                                                        placeholder="Clip 3 (10-15s)"
                                                        className="w-full bg-slate-900 border border-rose-900/30 rounded p-2 text-[10px] text-rose-200 focus:border-rose-500 outline-none resize-none h-12"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="pt-2 mt-2 border-t border-slate-700/50">
                                        <label className="text-[9px] font-bold text-emerald-500/80 block mb-1 uppercase">Final SFW Prompt Preview</label>
                                        <div className="text-[9px] text-slate-400 bg-slate-900/80 p-2 rounded-lg border border-slate-700/30 max-h-32 overflow-y-auto font-mono scrollbar-thin">
                                            {buildFinalPrompt(idx, 'SFW') || <span className="italic opacity-50">Fallback to SFW text...</span>}
                                        </div>
                                    </div>
                                    <div className="pt-2 mt-2 border-t border-slate-700/50">
                                        <label className="text-[9px] font-bold text-pink-500/80 block mb-1 uppercase">Final NSFW Prompt Preview</label>
                                        <div className="text-[9px] text-slate-400 bg-slate-900/80 p-2 rounded-lg border border-pink-900/30 max-h-32 overflow-y-auto font-mono scrollbar-thin">
                                            {buildFinalPrompt(idx, 'NSFW') || <span className="italic opacity-50">Fallback to NSFW text...</span>}
                                        </div>
                                    </div>
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

                <div className="mt-auto pt-4 border-t border-slate-800 flex flex-col md:flex-row gap-4 md:justify-between md:items-center shrink-0">
                    <div className="flex flex-wrap gap-2 order-2 md:order-1">
                        <span className="hidden lg:flex text-sm font-bold text-slate-400 mr-2 items-center">🎨 Queues:</span>
                        <button onClick={() => handleGenBatch('SFW')} disabled={isGeneratingImg} className="flex-1 md:flex-none px-3 py-2 bg-slate-800 border border-emerald-500/50 text-emerald-400 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50">
                            GEN SFW
                        </button>
                        <button onClick={() => handleGenBatch('NSFW')} disabled={isGeneratingImg} className="flex-1 md:flex-none px-3 py-2 bg-slate-800 border border-pink-500/50 text-pink-400 rounded-lg text-[10px] font-bold transition-all disabled:opacity-50">
                            GEN NSFW
                        </button>
                        <button onClick={() => handleGenBatch('ALL')} disabled={isGeneratingImg} className="w-full md:w-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold transition-all shadow-lg disabled:opacity-50">
                            {isGeneratingImg ? '...' : 'GEN ALL'}
                        </button>
                    </div>
                    <button onClick={onClose} className="w-full md:w-auto order-1 md:order-2 px-6 py-2.5 bg-orange-600 hover:bg-orange-500 rounded-xl text-sm font-bold transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2">
                        <span>💾</span> Save & Close
                    </button>
                </div>
            </div>
        </div>
    )
}
