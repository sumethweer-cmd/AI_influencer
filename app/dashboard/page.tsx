'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { ContentItem } from '@/types'

export default function DashboardPage() {
    const [items, setItems] = useState<ContentItem[]>([])
    const [workflows, setWorkflows] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [showScoutModal, setShowScoutModal] = useState(false)
    const [activePersona, setActivePersona] = useState<string>('All')

    useEffect(() => {
        fetchItems()
        fetchWorkflows()
    }, [])

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

    const displayedItems = activePersona === 'All'
        ? items
        : items.filter(item => item.persona === activePersona)

    const draftItems = displayedItems.filter(item => item.status === 'Draft')
    const hasDrafts = draftItems.length > 0

    const handleConfirmPlan = async () => {
        if (!confirm(`Are you sure you want to confirm these ${draftItems.length} items and start Phase 2 Image Generation?`)) return

        try {
            const res = await fetch('/api/jobs/confirm-plan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemIds: draftItems.map(i => i.id) })
            })
            if (res.ok) {
                alert('Plan Confirmed! Items have moved to Production Queue.')
                fetchItems()

                // Fire and forget trigger to start Phase 2 immediately
                fetch('/api/jobs/phase2-production', { method: 'POST' }).catch(() => { })
            } else {
                alert('❌ Failed to confirm plan. Check settings and logs.')
            }
        } catch (e) {
            alert('Error confirming plan.')
            console.error(e)
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
                        <button
                            onClick={() => setActivePersona('Momo')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${activePersona === 'Momo' ? 'bg-pink-600/20 text-pink-400 border border-pink-500/30' : 'hover:bg-slate-800 text-slate-300 border border-transparent'
                                }`}
                        >
                            <span>👱‍♀️</span> Momo (Baddie)
                        </button>
                        <button
                            onClick={() => setActivePersona('Karen')}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-semibold ${activePersona === 'Karen' ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30' : 'hover:bg-slate-800 text-slate-300 border border-transparent'
                                }`}
                        >
                            <span>👩‍💼</span> Karen (Secretarial)
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main Content Area */}
            <div className="flex-1 space-y-8">
                <header className="flex flex-wrap items-center justify-between gap-4">
                    <div>
                        <h2 className="text-3xl font-bold">Weekly Approval</h2>
                        <p className="text-slate-400 mt-1">Review and schedule generated ({activePersona}) content.</p>
                    </div>
                    <div className="flex gap-3">
                        {hasDrafts && (
                            <button
                                onClick={handleConfirmPlan}
                                className="px-4 py-2 bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-orange-500/20 animate-pulse border border-orange-400"
                            >
                                <span>✅</span> Confirm Plan & Start Gen
                            </button>
                        )}
                        <button
                            onClick={() => setShowScoutModal(true)}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold flex items-center gap-2 transition-all shadow-lg active:scale-95 border border-slate-700"
                        >
                            <span>🚀</span> Start Phase 1
                        </button>
                        <button
                            onClick={fetchItems}
                            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm transition-colors border border-slate-700"
                        >
                            Refresh
                        </button>
                    </div>
                </header>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 animate-pulse">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="h-64 bg-slate-800 rounded-2xl border border-slate-700" />
                        ))}
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {displayedItems.length > 0 ? (
                            displayedItems.map(item => (
                                <ContentCard key={item.id} item={item} workflows={workflows} onUpdate={fetchItems} />
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
                )}
            </div>

            {showScoutModal && (
                <ScoutModal onClose={() => setShowScoutModal(false)} onStarted={fetchItems} />
            )}
        </div>
    )
}

function ScoutModal({ onClose, onStarted }: { onClose: () => void, onStarted: () => void }) {
    const [method, setMethod] = useState<'apify' | 'brainstorm' | 'image'>('apify')
    const [persona, setPersona] = useState('Momo')
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
                            <option value="Momo">👱‍♀️ Momo (The Baddie Girlfriend)</option>
                            <option value="Karen">👩‍💼 Karen (The Secretarial Affair)</option>
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

function ContentCard({ item, workflows, onUpdate }: { item: ContentItem; workflows: any[]; onUpdate: () => void }) {
    const [unblur, setUnblur] = useState(false)
    const [caption, setCaption] = useState(item.caption_final || item.caption_draft || '')
    const [approving, setApproving] = useState(false)

    // Draft Editor States (Phase 1.5)
    const [contentType, setContentType] = useState(item.content_type)
    const [selectedWorkflowId, setSelectedWorkflowId] = useState(item.selected_workflow_id || '')
    const [genSfw, setGenSfw] = useState(item.gen_sfw)
    const [genNsfw, setGenNsfw] = useState(item.gen_nsfw)
    const [postToIg, setPostToIg] = useState(item.post_to_ig)
    const [postToX, setPostToX] = useState(item.post_to_x)
    const [postToFanvue, setPostToFanvue] = useState(item.post_to_fanvue)

    const [sfwPrompt, setSfwPrompt] = useState(item.sfw_prompt || '')
    const [scheduledAt, setScheduledAt] = useState(item.scheduled_at ? new Date(item.scheduled_at).toISOString().slice(0, 16) : '')
    const [showPrompt, setShowPrompt] = useState(false)

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

    const sfwImage = item.generated_images?.find(img => img.image_type === 'SFW')
    const nsfwImage = item.generated_images?.find(img => img.image_type === 'NSFW')

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
                    scheduledAt: new Date(Date.now() + 3600000).toISOString(), // Schedule 1 hour from now as default
                    selectedImageId: sfwImage?.id
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
        <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden hover:border-orange-500/50 transition-all group shadow-lg">
            {/* Image Preview / Draft Settings */}
            <div className="relative aspect-square bg-slate-900 border-b border-slate-700/50">
                {item.status === 'Draft' ? (
                    <div className="w-full h-full flex flex-col p-6 space-y-4 overflow-y-auto">
                        <div className="flex justify-between items-center mb-1">
                            <div className="text-xs text-orange-400 font-bold tracking-widest uppercase">Phase 1.5: Setup</div>
                            <button onClick={() => setShowPrompt(!showPrompt)} className="text-[10px] font-bold bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded transition-colors">
                                {showPrompt ? 'Hide Prompt' : '👁️ View Prompt'}
                            </button>
                        </div>

                        {showPrompt && (
                            <div className="animate-in fade-in slide-in-from-top-2">
                                <label className="text-[10px] font-bold text-slate-400 mb-1 block">EDIT IMAGE PROMPT</label>
                                <textarea
                                    value={sfwPrompt}
                                    onChange={e => setSfwPrompt(e.target.value)}
                                    onBlur={() => handleUpdateDraft({ sfw_prompt: sfwPrompt })}
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs text-slate-300 h-24 focus:border-orange-500 outline-none resize-none"
                                />
                            </div>
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
                ) : sfwImage ? (
                    <>
                        <img
                            src={sfwImage.file_path.replace('/storage/', '/api/')}
                            alt={item.topic}
                            className={`w-full h-full object-cover transition-all duration-500 ${item.nsfw_option && !unblur ? 'blur-3xl' : 'blur-0'}`}
                        />
                        {item.nsfw_option && !unblur && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
                                <span className="text-4xl mb-4">🔞</span>
                                <button
                                    onClick={() => setUnblur(true)}
                                    className="px-4 py-2 bg-white text-black rounded-full font-bold hover:bg-orange-400 transition-colors shadow-xl"
                                >
                                    👁️ Unblur NSFW
                                </button>
                            </div>
                        )}
                    </>
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
                <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-lg leading-tight group-hover:text-orange-400 transition-colors">
                        #{item.sequence_number}: {item.topic}
                    </h3>
                    {item.status === 'Draft' ? (
                        <select
                            value={contentType}
                            onChange={(e) => { setContentType(e.target.value as any); handleUpdateDraft({ content_type: e.target.value as any }) }}
                            className="shrink-0 text-[10px] text-slate-300 bg-slate-800 px-2 py-1 rounded border border-slate-600 outline-none font-bold tracking-wider"
                        >
                            <option value="Post">POST</option>
                            <option value="Carousel">CAROUSEL</option>
                            <option value="Story">STORY</option>
                        </select>
                    ) : (
                        <span className="shrink-0 text-[10px] text-slate-500 bg-slate-900 px-2 py-1 rounded border border-slate-700 uppercase font-bold tracking-wider">
                            {item.content_type}
                        </span>
                    )}
                </div>

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
                            disabled={approving || !sfwImage}
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
                </div>
            </div>
        </div>
    )
}
