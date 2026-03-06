'use client'

import React, { useState, useRef } from 'react'
import Image from 'next/image'
import { ContentItem, GeneratedImage } from '@/types'
import ImageEditorModal from './ImageEditorModal'

interface CreativeStudioModalProps {
    item: ContentItem
    onUpdate: () => void
    onClose: () => void
    onOpenPromptEditor?: () => void
}

export default function CreativeStudioModal({ item, onUpdate, onClose, onOpenPromptEditor }: CreativeStudioModalProps) {
    const [selections, setSelections] = useState<Record<string, any>>(item.platform_selections || {})
    const [videoCoverId, setVideoCoverId] = useState<string | undefined>(item.video_cover_id)
    const [saving, setSaving] = useState(false)
    const [activeTab, setActiveTab] = useState<'SFW' | 'NSFW'>('SFW')
    const [unblurList, setUnblurList] = useState<Record<string, boolean>>({})
    const [localImages, setLocalImages] = useState<GeneratedImage[]>(item.generated_images || [])
    const [localContentType, setLocalContentType] = useState(item.content_type || 'Post')
    const [localScheduledAt, setLocalScheduledAt] = useState(item.scheduled_at ? new Date(item.scheduled_at).toISOString().slice(0, 16) : '')
    const [editingImage, setEditingImage] = useState<GeneratedImage | null>(null)
    const [fullscreenImage, setFullscreenImage] = useState<string | null>(null)
    const [isDownloadingZip, setIsDownloadingZip] = useState(false)
    const [isSplittingVDO, setIsSplittingVDO] = useState<{ [key: string]: boolean }>({})
    const fileInputRef = useRef<HTMLInputElement>(null)

    const getOptimizedUrl = (path: string, width?: number) => {
        if (!path) return ''
        if (path.startsWith('http')) return path
        const base = path.replace('/storage/', '/api/')
        return width ? `${base}?w=${width}` : base
    }

    const getOriginalUrl = (path: string) => {
        if (!path) return ''
        return path.startsWith('http') ? path : path.replace('/storage/', '/api/')
    }

    const sfwImages = localImages.filter(img => img.image_type === 'SFW')
    const nsfwImages = localImages.filter(img => img.image_type === 'NSFW')
    const currentImages = activeTab === 'SFW' ? sfwImages : nsfwImages

    async function handleDownload(img: GeneratedImage) {
        try {
            let downloadUrl: string
            let filename: string

            if (img.media_type === 'video') {
                // Videos: download directly from Supabase file_path
                downloadUrl = img.file_path.startsWith('http') ? img.file_path : img.file_path.replace('/storage/', '/api/')
                filename = `${item.persona || 'video'}_${img.image_type}_${img.slot_index ?? ''}.mp4`
            } else {
                // Images: try RunPod original PNG first, fallback to Supabase WebP
                downloadUrl = `/api/media/download-original?imageId=${img.id}`
                const ext = img.original_path ? 'png' : (img.file_path?.split('.').pop() || 'webp')
                filename = `${item.persona || 'image'}_${img.image_type}_${img.slot_index ?? ''}.${ext}`
            }

            const response = await fetch(downloadUrl)
            const source = response.headers.get('X-Source')
            if (source === 'supabase-webp-fallback') {
                console.info('Pod offline — downloaded WebP from Supabase instead of original PNG')
            }
            const blob = await response.blob()
            const objectUrl = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = objectUrl
            a.download = filename
            document.body.appendChild(a)
            a.click()
            document.body.removeChild(a)
            URL.revokeObjectURL(objectUrl)
        } catch (e) {
            alert('❌ Download failed')
        }
    }


    async function handleDownloadAllZip() {
        setIsDownloadingZip(true)
        try {
            const JSZip = (await import('jszip')).default
            const { saveAs } = await import('file-saver')

            const zip = new JSZip()
            let count = 0

            const safeName = item.topic ? item.topic.substring(0, 30).replace(/[^a-z0-9]/gi, '_') : 'Untitled'
            const folder = zip.folder(`${item.persona || 'Unknown'}_${safeName.trim()}`)

            for (const img of currentImages) {
                try {
                    const url = getOriginalUrl(img.file_path)
                    const response = await fetch(url)
                    if (response.ok) {
                        const blob = await response.blob()
                        const ext = img.media_type === 'video' ? 'mp4' : 'png'
                        const filename = `${item.persona || 'image'}_${img.image_type}_${img.slot_index ?? ''}.${ext}`
                        folder?.file(filename, blob)
                        count++
                    }
                } catch (e) {
                    console.error('Failed to download image for ZIP', img.file_path)
                }
            }

            if (count > 0) {
                const content = await zip.generateAsync({ type: 'blob' })
                saveAs(content, `Studio_${activeTab}_${safeName}.zip`)
            } else {
                alert('No images available to download.')
            }
        } catch (error) {
            console.error(error)
            alert('❌ Failed to generate ZIP file')
        }
        setIsDownloadingZip(false)
    }

    async function handleAutoSplitVDO(img: GeneratedImage) {
        setIsSplittingVDO(prev => ({ ...prev, [img.id]: true }))
        try {
            const res = await fetch('/api/jobs/generate-video-prompts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    imageId: img.id,
                    basePrompt: img.vdo_prompt || item.storyline || item.caption_draft || item.topic || 'A beautiful scene',
                    imageType: img.image_type
                })
            })
            const data = await res.json()
            if (data.success && data.prompts) {
                const newImages = [...localImages]
                const found = newImages.find(ni => ni.id === img.id)
                if (found) {
                    found.vdo_prompt_1 = data.prompts[0] || ''
                    found.vdo_prompt_2 = data.prompts[1] || ''
                    found.vdo_prompt_3 = data.prompts[2] || ''
                }
                setLocalImages(newImages)
            } else {
                alert('✨ AI Split Failed: ' + data.error)
            }
        } catch (e) {
            alert('Error splitting video prompt via AI.')
        }
        setIsSplittingVDO(prev => ({ ...prev, [img.id]: false }))
    }

    async function handleTogglePlatform(platform: string, imageId: string | null) {
        if (!imageId) return

        const newSelections = { ...selections } as Record<string, any>
        const currentBatch = Array.isArray(newSelections[platform]) ? newSelections[platform] : (newSelections[platform] ? [newSelections[platform]] : [])

        if (currentBatch.includes(imageId)) {
            newSelections[platform] = currentBatch.filter((id: string) => id !== imageId)
            if (newSelections[platform].length === 0) delete newSelections[platform]
        } else {
            // If the content type is not Carousel, typically we might want to limit to 1
            // but for simplicity and future-proofing, let's allow multi for all if Carousel is selected
            if (localContentType === 'Carousel' || platform === 'twitter' || platform === 'fanvue') {
                newSelections[platform] = [...currentBatch, imageId]
            } else {
                newSelections[platform] = [imageId]
            }
        }
        setSelections(newSelections)
    }

    async function handleSaveChanges() {
        setSaving(true)
        try {
            await fetch(`/api/content/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform_selections: selections,
                    video_cover_id: videoCoverId,
                    content_type: localContentType,
                    scheduled_at: localScheduledAt ? new Date(localScheduledAt).toISOString() : null,
                    generated_images: localImages
                })
            })
            onUpdate()
            alert('✅ Changes saved successfully!')
        } catch (err) {
            console.error(err)
            alert('❌ Failed to save changes.')
        } finally {
            setSaving(false)
        }
    }

    async function handleApproveAndSchedule() {
        if (!confirm('🚀 This will Approve and SCHEDULE this content for posting. Proceed?')) return
        setSaving(true)
        try {
            // First save current state
            await fetch(`/api/content/${item.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    platform_selections: selections,
                    video_cover_id: videoCoverId,
                    content_type: localContentType,
                    scheduled_at: localScheduledAt ? new Date(localScheduledAt).toISOString() : null,
                    generated_images: localImages
                })
            })

            // Then call approve API
            const res = await fetch('/api/jobs/approve-content', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId: item.id,
                    scheduledAt: localScheduledAt ? new Date(localScheduledAt).toISOString() : new Date().toISOString()
                })
            })

            if (res.ok) {
                alert('✨ Content APPROVED & SCHEDULED!')
                onUpdate()
                onClose()
            } else {
                throw new Error('Approval failed')
            }
        } catch (err) {
            console.error(err)
            alert('❌ Failed to approve content.')
        } finally {
            setSaving(false)
        }
    }

    async function handleTestConnection() {
        setSaving(true)
        try {
            const res = await fetch('/api/jobs/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyName: 'GEMINI_API_KEY' }) // Example test, could be more specific
            })
            const data = await res.json()
            if (data.success) {
                alert('✅ Connection Test: SUCCESS! (API/Runpod reachable)')
            } else {
                alert(`❌ Connection Test: FAILED - ${data.error}`)
            }
        } catch (err) {
            alert('❌ Network error during connection test.')
        } finally {
            setSaving(false)
        }
    }

    const moveImage = (index: number, direction: 'left' | 'right') => {
        const currentBatch = activeTab === 'SFW' ? [...sfwImages] : [...nsfwImages]
        const otherBatch = activeTab === 'SFW' ? [...nsfwImages] : [...sfwImages]

        const newIndex = direction === 'left' ? index - 1 : index + 1
        if (newIndex < 0 || newIndex >= currentBatch.length) return

        const temp = currentBatch[index]
        currentBatch[index] = currentBatch[newIndex]
        currentBatch[newIndex] = temp

        setLocalImages([...currentBatch, ...otherBatch])
    }

    const handleEditSave = async (blob: Blob) => {
        setSaving(true)
        try {
            const file = new File([blob], `cropped-${Date.now()}.jpg`, { type: 'image/jpeg' })
            const formData = new FormData()
            formData.append('file', file)
            formData.append('contentItemId', item.id)
            formData.append('imageType', activeTab)

            const res = await fetch('/api/media/upload', {
                method: 'POST',
                body: formData
            })

            if (res.ok) {
                const result = await res.json()
                // Update local images with the new cropped version
                setLocalImages(prev => [...prev, result.data])
                alert('🎨 Image baked and saved successfully!')
                setEditingImage(null)
            } else {
                throw new Error('Upload failed')
            }
        } catch (err) {
            console.error('Baking failed:', err)
            alert('❌ Failed to bake image.')
        } finally {
            setSaving(false)
        }
    }


    const downloadImage = async (url: string, filename: string) => {
        const res = await fetch(url)
        const blob = await res.blob()
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = filename
        link.click()
    }

    const handleDeleteImage = async (imageId: string) => {
        if (!confirm('🗑️ Are you sure you want to delete this variant?')) return

        try {
            const res = await fetch(`/api/media/${imageId}`, { method: 'DELETE' })
            if (res.ok) {
                // Optimistic UI update
                setLocalImages(prev => prev.filter(img => img.id !== imageId))

                // Clear selections if deleted image was selected
                const newSelections = { ...selections }
                Object.keys(newSelections).forEach(p => {
                    if (newSelections[p] === imageId) delete newSelections[p]
                })
                setSelections(newSelections)
            } else {
                alert('❌ Failed to delete image from server.')
            }
        } catch (err) {
            console.error('Delete failed:', err)
            alert('❌ Network error during deletion.')
        }
    }

    const handleGenerateVideo = async (imageId: string) => {
        const img = localImages.find(i => i.id === imageId)
        if (!img) return

        try {
            // Optimistic update
            setLocalImages(prev => prev.map(i => i.id === imageId ? { ...i, vdo_status: 'pending' } : i))

            const res = await fetch('/api/jobs/generate-video', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ imageId, vdo_prompt: img.vdo_prompt })
            })

            if (!res.ok) throw new Error('Failed to queue job')

            const result = await res.json()
            setLocalImages(prev => prev.map(i => i.id === imageId ? { ...i, vdo_status: 'pending', vdo_job_id: result.jobId } : i))
        } catch (err) {
            console.error('Job error:', err)
            alert('❌ Failed to queue video generation.')
            setLocalImages(prev => prev.map(i => i.id === imageId ? { ...i, vdo_status: 'failed' } : i))
        }
    }

    const [isRegenerating, setIsRegenerating] = useState<Record<number, boolean>>({})
    const handleRegenerate = async (index: number, regenPrompt: boolean = false) => {
        setIsRegenerating(prev => ({ ...prev, [index]: true }))
        try {
            const res = await fetch('/api/jobs/generate-single', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contentId: item.id,
                    index,
                    type: activeTab,
                    regenPrompt
                })
            })
            const json = await res.json()
            if (res.ok && json.success) {
                alert('🚀 Regeneration job added to queue!')
                onUpdate()
            } else {
                console.error('Regen API error:', json)
                alert(`❌ Regeneration failed: ${json.error || 'Unknown error'}`)
            }
        } catch (e) {
            console.error('Regen request failed:', e)
            alert('❌ Regeneration failed: Network error')
        } finally {
            setIsRegenerating(prev => ({ ...prev, [index]: false }))
        }
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const formData = new FormData()
        formData.append('file', file)
        formData.append('contentItemId', item.id)
        formData.append('imageType', activeTab)

        try {
            setSaving(true)
            const res = await fetch('/api/media/upload', {
                method: 'POST',
                body: formData
            })
            if (res.ok) {
                onUpdate() // Refresh data
            }
        } catch (err) {
            console.error('Upload failed:', err)
        } finally {
            setSaving(false)
        }
    }

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-2 md:p-4 bg-black/90 backdrop-blur-3xl animate-in fade-in duration-500">
            <div className="relative w-full md:max-w-[95vw] h-full md:h-[95vh] bg-slate-900/40 border-0 md:border md:border-slate-700/50 rounded-none md:rounded-[40px] overflow-hidden flex flex-col shadow-[0_0_100px_rgba(0,0,0,0.8)] glassmorphism border-t-white/10">
                {/* Header - Compact */}
                <div className="px-4 md:px-6 py-3 border-b border-slate-800 flex justify-between items-center bg-slate-900 shrink-0">
                    <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <span className="text-lg shrink-0">💎</span>
                        <h2 className="text-sm md:text-lg font-black text-white truncate">
                            Studio: <span className="text-indigo-400">{item.topic}</span>
                        </h2>
                    </div>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-800 rounded-full transition-colors text-slate-400 hover:text-white">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                {/* Tabs & Filters - Very Compact */}
                <div className="px-4 md:px-6 py-2 flex flex-col md:flex-row items-start md:items-center gap-3 md:gap-4 bg-slate-900/50 border-b border-slate-800/50 shrink-0">
                    <div className="flex bg-slate-800 p-0.5 md:p-1 rounded-full border border-slate-700 w-full md:w-auto">
                        <button
                            onClick={() => setActiveTab('SFW')}
                            className={`flex-1 md:flex-none px-4 py-1.5 md:py-1 rounded-full font-bold text-[10px] transition-all ${activeTab === 'SFW' ? 'bg-orange-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            😇 SFW
                        </button>
                        <button
                            onClick={() => setActiveTab('NSFW')}
                            className={`flex-1 md:flex-none px-4 py-1.5 md:py-1 rounded-full font-bold text-[10px] transition-all ${activeTab === 'NSFW' ? 'bg-pink-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                        >
                            🔞 NSFW
                        </button>
                    </div>

                    <div className="flex items-center gap-2 md:ml-auto w-full md:w-auto overflow-x-auto hide-scrollbar pb-1 md:pb-0">
                        <div className="flex bg-slate-800 p-0.5 rounded-lg border border-slate-700 shrink-0">
                            {['Post', 'Carousel', 'Story'].map(t => (
                                <button
                                    key={t}
                                    onClick={() => setLocalContentType(t as any)}
                                    className={`px-3 py-1 text-[9px] font-black rounded-md transition-all ${localContentType === t ? 'bg-indigo-600 text-white shadow-lg' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    {t.toUpperCase()}
                                </button>
                            ))}
                        </div>
                        <input
                            type="datetime-local"
                            value={localScheduledAt}
                            onChange={e => setLocalScheduledAt(e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-[10px] text-white focus:border-orange-500 outline-none shrink-0"
                        />
                    </div>
                </div>
                {/* Main Content: Expanded Grid */}
                <div className="flex-1 overflow-y-auto p-4 md:p-10 bg-slate-950/40 custom-scrollbar">
                    {currentImages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                            <span className="text-6xl opacity-20">🖼️</span>
                            <p className="font-bold">No images generated for this version yet.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6 md:gap-12">
                            {Array.from({ length: item.batch_size || 4 }).map((_, idx) => {
                                const imagesForSlot = currentImages.filter(i => i.slot_index === idx)
                                if (imagesForSlot.length === 0) {
                                    return (
                                        <div key={`empty-${idx}`} className="group relative bg-slate-900/30 border-2 border-dashed border-slate-800 rounded-2xl aspect-[4/5] flex flex-col items-center justify-center text-slate-600 gap-3">
                                            <span className="text-4xl opacity-20">⌛</span>
                                            <p className="text-[10px] font-black uppercase tracking-widest text-center px-4">Slot {idx + 1}: Waiting for AI Generation</p>
                                            <button
                                                onClick={() => handleRegenerate(idx, true)}
                                                disabled={isRegenerating[idx]}
                                                className="mt-2 py-1.5 px-3 bg-orange-600 hover:bg-orange-500 text-white rounded-lg text-[9px] font-bold shadow-lg transition-all active:scale-95"
                                            >
                                                {isRegenerating[idx] ? 'STARTING...' : '🚀 GENERATE THIS SLOT'}
                                            </button>
                                        </div>
                                    )
                                }
                                return imagesForSlot.map((img, subIdx) => (
                                    <div key={img.id} className="group relative bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden hover:border-orange-500/50 transition-all shadow-xl hover:shadow-orange-500/10 active:scale-[0.98]">
                                        {/* Image Container */}
                                        <div className="relative aspect-[4/5] bg-black overflow-hidden flex items-center justify-center">
                                            {img.media_type === 'video' ? (
                                                <video
                                                    src={getOriginalUrl(img.file_path)}
                                                    className="w-full h-full object-cover"
                                                    controls
                                                    muted
                                                />
                                            ) : (
                                                <img
                                                    src={getOptimizedUrl(img.file_path)}
                                                    className={`w-full h-full object-cover transition-all duration-700 cursor-pointer ${img.image_type === 'NSFW' && !unblurList[img.id] ? 'blur-3xl' : 'blur-0'}`}
                                                    alt={`Variant ${idx + 1}.${subIdx + 1}`}
                                                    onClick={() => {
                                                        if (img.image_type !== 'NSFW' || unblurList[img.id]) {
                                                            setFullscreenImage(getOriginalUrl(img.file_path))
                                                        }
                                                    }}
                                                />
                                            )}
                                            {img.image_type === 'NSFW' && !unblurList[img.id] && img.media_type !== 'video' && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                                                    <button
                                                        onClick={() => setUnblurList({ ...unblurList, [img.id]: true })}
                                                        className="px-4 py-2 bg-white text-black text-xs font-black rounded-full hover:bg-orange-500 hover:text-white transition-all shadow-2xl"
                                                    >
                                                        👁️ UNBLUR
                                                    </button>
                                                </div>
                                            )}

                                            <div className="absolute top-3 left-3 flex gap-2">
                                                <div className="px-2 py-1 bg-black/60 backdrop-blur-md rounded-lg text-[10px] font-black text-white border border-white/10">
                                                    V-{idx + 1}{imagesForSlot.length > 1 ? `.${subIdx + 1}` : ''}
                                                </div>
                                                {videoCoverId === img.id && (
                                                    <div className="px-2 py-1 bg-orange-600 text-white text-[10px] font-black rounded-lg shadow-lg animate-pulse">
                                                        📸 COVER
                                                    </div>
                                                )}
                                                {img.media_type === 'video' && (
                                                    <div className="px-2 py-1 bg-indigo-600 text-white text-[10px] font-black rounded-lg shadow-lg">
                                                        🎬 VIDEO
                                                    </div>
                                                )}
                                            </div>

                                            {/* Selection Indicator */}
                                            <div className="absolute top-3 right-3 flex flex-col gap-1 items-end">
                                                {['instagram', 'twitter', 'fanvue'].map(platform => {
                                                    const sel = selections[platform]
                                                    const isSelected = Array.isArray(sel) ? sel.includes(img.id) : sel === img.id
                                                    const index = Array.isArray(sel) ? sel.indexOf(img.id) + 1 : (sel === img.id ? 1 : 0)

                                                    if (!isSelected) return null

                                                    return (
                                                        <div
                                                            key={platform}
                                                            className="px-2 py-1 bg-emerald-500 text-white text-[8px] font-black rounded border border-emerald-400 shadow-lg uppercase flex items-center gap-1"
                                                        >
                                                            {platform.slice(0, 2)}
                                                            {localContentType === 'Carousel' && <span className="opacity-60">{index}</span>}
                                                        </div>
                                                    )
                                                })}

                                                {/* Delete + Download Buttons */}
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDownload(img) }}
                                                    className="mt-2 w-8 h-8 bg-black/60 backdrop-blur-md rounded-full text-sky-400 hover:bg-sky-600 hover:text-white transition-all flex items-center justify-center border border-sky-500/30 opacity-0 group-hover:opacity-100"
                                                    title="Download image"
                                                >
                                                    ⬇️
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteImage(img.id) }}
                                                    className="mt-1 w-8 h-8 bg-black/60 backdrop-blur-md rounded-full text-rose-500 hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center border border-rose-500/30 opacity-0 group-hover:opacity-100"
                                                >
                                                    🗑️
                                                </button>
                                            </div>

                                            {/* Reordering Controls */}
                                            <div className="absolute bottom-3 left-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); moveImage(idx, 'left') }}
                                                    className="w-8 h-8 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-orange-600 transition-colors flex items-center justify-center font-bold"
                                                >
                                                    ←
                                                </button>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); moveImage(idx, 'right') }}
                                                    className="w-8 h-8 bg-black/60 backdrop-blur-md rounded-full text-white hover:bg-orange-600 transition-colors flex items-center justify-center font-bold"
                                                >
                                                    →
                                                </button>
                                            </div>
                                        </div>


                                        {/* Platform Selectors & VDO Prompt */}
                                        <div className="p-6 bg-slate-900/95 backdrop-blur-3xl border-t border-white/5 space-y-6">
                                            <div className="flex flex-col gap-3">
                                                <div className="flex gap-1 overflow-x-auto hide-scrollbar">
                                                    {['instagram', 'twitter', 'fanvue'].map(platform => {
                                                        const sel = selections[platform]
                                                        const isSelected = Array.isArray(sel) ? sel.includes(img.id) : sel === img.id
                                                        return (
                                                            <button
                                                                key={platform}
                                                                onClick={(e) => { e.stopPropagation(); handleTogglePlatform(platform, img.id) }}
                                                                className={`flex-1 min-w-[60px] py-1.5 rounded-lg text-[9px] font-black transition-all border ${isSelected
                                                                    ? 'bg-emerald-500/10 border-emerald-500 text-emerald-400'
                                                                    : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                                                                    }`}
                                                            >
                                                                {platform.slice(0, 3).toUpperCase()}
                                                            </button>
                                                        )
                                                    })}
                                                </div>

                                                {/* Video Controls Area */}
                                                <div className="space-y-2 border-t border-slate-800 pt-3">
                                                    <div className="flex justify-between items-center text-[9px] font-black text-slate-500 uppercase tracking-widest">
                                                        <span>Video Motion Prompts (15s Total)</span>
                                                        <div className="flex gap-2 items-center">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleAutoSplitVDO(img) }}
                                                                disabled={isSplittingVDO[img.id]}
                                                                className="px-2 py-0.5 bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded hover:opacity-80 transition-opacity disabled:opacity-50"
                                                                title="Use AI to auto-split your storyline into 3 cinematic parts based on SFW/NSFW style configs."
                                                            >
                                                                {isSplittingVDO[img.id] ? '✨ THINKING...' : '✨ AUTO-SPLIT'}
                                                            </button>
                                                            <span className={`px-1.5 py-0.5 rounded ${img.vdo_status === 'completed' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-slate-800 text-slate-400'}`}>
                                                                {img.vdo_status ? img.vdo_status.toUpperCase() : 'NONE'}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <textarea
                                                            className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-[10px] text-slate-300 focus:border-indigo-500 outline-none resize-none h-12"
                                                            placeholder="Part 1 (0-5s): Describe initial motion..."
                                                            value={img.vdo_prompt_1 || ''}
                                                            onChange={(e) => {
                                                                const newImages = [...localImages]
                                                                const found = newImages.find(ni => ni.id === img.id)
                                                                if (found) {
                                                                    found.vdo_prompt_1 = e.target.value
                                                                    // Ensure we have a base prompt for legacy compatibility
                                                                    if (!found.vdo_prompt) found.vdo_prompt = e.target.value
                                                                }
                                                                setLocalImages(newImages)
                                                            }}
                                                            onFocus={(e) => {
                                                                // If empty, try to pull from Phase 1 metadata
                                                                if (!e.target.value) {
                                                                    const struct = item.prompt_structure as any
                                                                    const planned = activeTab === 'NSFW' ? struct?.vdo_prompts_nsfw : struct?.vdo_prompts
                                                                    if (planned && planned[idx] && planned[idx].clip_1) {
                                                                        const newImages = [...localImages]
                                                                        const found = newImages.find(ni => ni.id === img.id)
                                                                        if (found) {
                                                                            found.vdo_prompt_1 = planned[idx].clip_1
                                                                            found.vdo_prompt_2 = planned[idx].clip_2
                                                                            found.vdo_prompt_3 = planned[idx].clip_3
                                                                        }
                                                                        setLocalImages(newImages)
                                                                    }
                                                                }
                                                            }}
                                                        />
                                                        <textarea
                                                            className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-[10px] text-slate-300 focus:border-indigo-500 outline-none resize-none h-12"
                                                            placeholder="Part 2 (5-10s): Describe continuation..."
                                                            value={img.vdo_prompt_2 || ''}
                                                            onChange={(e) => {
                                                                const newImages = [...localImages]
                                                                const found = newImages.find(ni => ni.id === img.id)
                                                                if (found) found.vdo_prompt_2 = e.target.value
                                                                setLocalImages(newImages)
                                                            }}
                                                        />
                                                        <textarea
                                                            className="w-full bg-black/40 border border-slate-800 rounded-lg p-2 text-[10px] text-slate-300 focus:border-indigo-500 outline-none resize-none h-12"
                                                            placeholder="Part 3 (10-15s): Describe conclusion..."
                                                            value={img.vdo_prompt_3 || ''}
                                                            onChange={(e) => {
                                                                const newImages = [...localImages]
                                                                const found = newImages.find(ni => ni.id === img.id)
                                                                if (found) found.vdo_prompt_3 = e.target.value
                                                                setLocalImages(newImages)
                                                            }}
                                                        />
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setVideoCoverId(img.id) }}
                                                        className={`py-1.5 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 border transition-all ${videoCoverId === img.id
                                                            ? 'bg-orange-500/20 border-orange-500 text-orange-400'
                                                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                                                            }`}
                                                    >
                                                        📸 COVER
                                                    </button>
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleRegenerate(idx, true) }}
                                                        disabled={isRegenerating[idx]}
                                                        className="py-1.5 bg-rose-950/20 hover:bg-rose-900/40 text-rose-500 rounded-lg text-[9px] font-bold flex items-center justify-center gap-1 border border-rose-900/30 transition-all shadow-lg active:scale-95"
                                                        title="✨ REGEN PROMPT & IMAGE"
                                                    >
                                                        {isRegenerating[idx] ? '🔃...' : '✨ REGEN'}
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); onOpenPromptEditor?.() }}
                                                    className="w-full py-1.5 bg-slate-800 hover:bg-slate-700 text-orange-400 text-[9px] font-bold rounded-lg flex items-center justify-center gap-1 border border-slate-700 transition-all shadow-lg active:scale-95"
                                                    title="✍️ EDIT SCRIPT BEFORE REGEN"
                                                >
                                                    ✍️ EDIT PROMPT
                                                </button>

                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleGenerateVideo(img.id) }}
                                                    disabled={img.vdo_status === 'pending' || img.vdo_status === 'processing' || !img.vdo_prompt}
                                                    className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[10px] font-black rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20 transition-all active:scale-95"
                                                >
                                                    {img.vdo_status === 'pending' || img.vdo_status === 'processing' ? '🔃 QUEUED...' : '🎬 GENERATE VIDEO'}
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))
                            })}
                        </div>
                    )}
                </div>

                {/* Footer Actions - Ultra Thin */}
                <div className="px-4 md:px-6 py-3 bg-slate-900 border-t border-slate-800 flex flex-col md:flex-row gap-4 md:justify-between md:items-center bg-gradient-to-t from-slate-950 to-slate-900 shrink-0">
                    <div className="flex items-center justify-between md:justify-start gap-4 lg:gap-6">
                        <p className="hidden sm:block text-[9px] text-slate-500 italic max-w-[120px] md:max-w-xs truncate">⚠️ Auto-save on save button click.</p>
                        <button
                            onClick={() => fileInputRef.current?.click()}
                            className="flex-1 md:flex-none py-2 px-4 bg-slate-800/50 hover:bg-slate-800 text-slate-400 hover:text-white text-[10px] font-black rounded-lg flex items-center justify-center gap-2 border border-slate-700/50 transition-all"
                        >
                            ☁️ UPLOAD
                        </button>
                        <button
                            onClick={handleDownloadAllZip}
                            disabled={isDownloadingZip || currentImages.length === 0}
                            className="flex-[2] md:flex-none py-2 px-4 bg-blue-900/50 hover:bg-blue-800 text-blue-400 hover:text-white text-[10px] font-black rounded-lg flex items-center justify-center gap-2 border border-blue-700/50 transition-all active:scale-95 disabled:opacity-50"
                        >
                            📦 {isDownloadingZip ? 'PACKING...' : 'DOWNLOAD ALL ZIP'}
                        </button>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3 w-full md:w-auto mt-4 md:mt-0">
                        <button onClick={onClose} className="flex-1 md:flex-none px-4 py-2.5 text-slate-400 hover:text-white text-[10px] font-black transition-all">
                            CANCEL
                        </button>
                        <button
                            onClick={handleSaveChanges}
                            disabled={saving}
                            className="flex-1 md:flex-none px-4 lg:px-6 py-2.5 bg-slate-800 text-slate-300 text-[10px] font-black rounded-xl border border-white/5 hover:bg-slate-700 transition-all"
                        >
                            {saving ? '...' : '💾 DRAFT'}
                        </button>
                        <button
                            onClick={handleApproveAndSchedule}
                            disabled={saving}
                            className="flex-[2] md:flex-none px-6 lg:px-8 py-2.5 bg-gradient-to-r from-indigo-600 to-indigo-500 text-white text-[10px] md:text-[11px] font-black rounded-xl shadow-xl hover:shadow-indigo-500/20 transition-all active:scale-95"
                        >
                            {saving ? 'WAIT...' : '✅ APPROVE'}
                        </button>
                    </div>
                </div>

                {editingImage && (
                    <ImageEditorModal
                        imageUrl={getOriginalUrl(editingImage.file_path)}
                        onClose={() => setEditingImage(null)}
                        onSave={handleEditSave}
                    />
                )}
            </div>

            {/* Fullscreen Image Zoom Modal */}
            {fullscreenImage && (
                <div
                    className="fixed inset-0 z-[200] flex items-center justify-center bg-black/95 backdrop-blur-sm cursor-zoom-out animate-in fade-in duration-300"
                    onClick={() => setFullscreenImage(null)}
                >
                    <div className="relative w-full h-full p-4 md:p-12 flex items-center justify-center">
                        <Image
                            src={fullscreenImage}
                            alt="Fullscreen Asset"
                            fill
                            className="object-contain drop-shadow-2xl rounded-sm"
                            unoptimized={true}
                        />
                        <button
                            className="absolute top-6 right-6 p-3 bg-black/50 hover:bg-black/80 text-white rounded-full transition-colors font-bold"
                            onClick={(e) => { e.stopPropagation(); setFullscreenImage(null); }}
                        >
                            ✕
                        </button>
                    </div>
                </div>
            )}

            <style jsx>{`
                .glassmorphism {
                    background: rgba(15, 23, 42, 0.4);
                    backdrop-filter: blur(40px);
                }
                .hide-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .hide-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .custom-scrollbar::-webkit-scrollbar {
                    width: 6px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: rgba(255,255,255,0.1);
                    border-radius: 10px;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                    background: rgba(255,255,255,0.2);
                }
            `}</style>
        </div>
    )
}
