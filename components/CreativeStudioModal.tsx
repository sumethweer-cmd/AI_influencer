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
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null)
    const [gcsFiles, setGcsFiles] = useState<string[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Sync from GCS on mount
    React.useEffect(() => {
        const fetchGcs = async () => {
            try {
                const res = await fetch(`/api/media/list?id=${item.id}`)
                const data = await res.json()
                if (data.success) setGcsFiles(data.files)
            } catch (err) {
                console.error('Failed to sync GCS files:', err)
            }
        }
        fetchGcs()
    }, [item.id])

    const getImageUrl = (path: string, width?: number) => {
        if (!path) return ''
        let finalPath = path
        if (path.includes('storage.googleapis.com') && !path.endsWith('.webp') && !path.endsWith('.mp4')) {
            const lastDot = path.lastIndexOf('.')
            if (lastDot !== -1) finalPath = path.substring(0, lastDot) + '.webp'
        }
        if (finalPath.startsWith('http')) {
            if (finalPath.includes('storage.googleapis.com')) {
                try {
                    const url = new URL(finalPath)
                    const pathParts = url.pathname.split('/').filter(Boolean)
                    // Remove bucket name
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
        const base = `/api/images/${finalPath.startsWith('/') ? finalPath.slice(1) : finalPath}`
        return width ? `${base}?w=${width}` : base
    }

    const getOptimizedUrl = getImageUrl
    const getOriginalUrl = (path: string) => getImageUrl(path)

    // Merge GCS files with localImages (DB records)
    const mergedImages = [...localImages]
    gcsFiles.forEach(gcsPath => {
        const isSfw = gcsPath.includes('/SFW/') || !gcsPath.includes('/NSFW/')
        const imageType = !isSfw ? 'NSFW' : 'SFW'
        
        // Check if this file is already in the DB images
        const isInDb = localImages.some(img => 
            img.file_path.includes(gcsPath) || 
            (img.original_path && img.original_path.includes(gcsPath))
        )
        
        if (!isInDb) {
            // Synthesize a GeneratedImage for the UI so it shows in the grid
            mergedImages.push({
                id: `gcs-${gcsPath.split('/').pop()}`, 
                content_item_id: item.id,
                file_path: gcsPath, // Use relative path, getImageUrl will handle it
                image_type: imageType,
                media_type: gcsPath.endsWith('.mp4') || gcsPath.endsWith('.mov') ? 'video' : 'image',
                slot_index: (mergedImages.filter(img => img.image_type === imageType).length + 1)
            } as any)
        }
    })

    const sfwImages = mergedImages.filter(img => img.image_type === 'SFW')
    const nsfwImages = mergedImages.filter(img => img.image_type === 'NSFW')
    const currentImages = activeTab === 'SFW' ? sfwImages : nsfwImages

    async function handleDownload(img: GeneratedImage) {
        try {
            // Use proxy API to avoid CORS issues with GCS, and support RunPod originals
            const downloadUrl = `/api/media/download-original?imageId=${img.id}`
            const response = await fetch(downloadUrl)

            if (!response.ok) throw new Error(`Download failed: ${response.statusText}`)

            const source = response.headers.get('X-Source')
            if (source === 'supabase-media-fallback-proxy') {
                console.info('Original unavailable — downloaded fallback from Supabase')
            }

            const blob = await response.blob()
            const contentType = response.headers.get('content-type') || ''
            const ext = img.media_type === 'video' ? 'mp4' : (contentType.includes('png') ? 'png' : 'webp')
            const filename = `${item.persona || 'media'}_${img.image_type}_${img.slot_index ?? ''}.${ext}`

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
                    // Use proxy API to avoid CORS issues with GCS
                    const url = `/api/media/download-original?imageId=${img.id}`
                    const response = await fetch(url)
                    if (response.ok) {
                        const blob = await response.blob()
                        const contentType = response.headers.get('content-type') || ''
                        const ext = img.media_type === 'video' ? 'mp4' : (contentType.includes('png') ? 'png' : 'webp')
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
            const deleteUrl = new URL(`/api/media/${imageId}`, window.location.origin)
            // If it's a gcs-only file, find its file_path and pass it
            const targetImg = mergedImages.find(i => i.id === imageId)
            if (targetImg && imageId.startsWith('gcs-')) {
                deleteUrl.searchParams.set('filePath', targetImg.file_path)
            }

            const res = await fetch(deleteUrl, { method: 'DELETE' })
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
                {/* Main Content: Explorer Grid + Sidebar */}
                <div className="flex-1 overflow-hidden flex bg-slate-950/20">
                    {/* Left: Explorer Grid */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar">
                        {currentImages.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4">
                                <span className="text-6xl opacity-20">🖼️</span>
                                <p className="font-bold">No images generated for this version yet.</p>
                            </div>
                        ) : (
                            <div className={`grid gap-4 md:gap-6 ${selectedImageId ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5' : 'grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 2xl:grid-cols-8'}`}>
                                {currentImages.map((img) => {
                                    const isSelectedInGallery = selectedImageId === img.id;
                                    return (
                                        <div
                                            key={img.id}
                                            onClick={() => setSelectedImageId(isSelectedInGallery ? null : img.id)}
                                            className={`group relative bg-slate-900 border transition-all cursor-pointer rounded-xl overflow-hidden aspect-[4/5] ${isSelectedInGallery ? 'ring-2 ring-indigo-500 ring-offset-2 ring-offset-slate-900 border-indigo-400 shadow-2xl scale-[1.02]' : 'border-slate-800 hover:border-slate-600 hover:scale-[1.02]'}`}
                                        >
                                            <div className="absolute inset-0 bg-black">
                                                <img
                                                    src={getOptimizedUrl(img.file_path, 300)}
                                                    className={`w-full h-full object-cover transition-all duration-500 ${img.image_type === 'NSFW' && !unblurList[img.id] ? 'blur-2xl opacity-50' : 'blur-0'}`}
                                                    alt={`Variant ${img.slot_index}`}
                                                />
                                            </div>

                                            {/* Status Indicators */}
                                            <div className="absolute top-2 left-2 flex gap-1">
                                                <div className="px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[8px] font-black text-white border border-white/10 uppercase">
                                                    V-{img.slot_index + 1}
                                                </div>
                                                {Object.keys(selections).some(p => Array.isArray(selections[p]) ? selections[p].includes(img.id) : selections[p] === img.id) && (
                                                    <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                                                )}
                                            </div>

                                            {/* Hover Toolbar */}
                                            <div className="absolute inset-x-0 bottom-0 p-2 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-center">
                                                <div className="flex gap-1">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); handleDownload(img) }}
                                                        className="w-7 h-7 bg-white/10 hover:bg-white text-white hover:text-black rounded-lg text-[10px] flex items-center justify-center transition-all"
                                                    >
                                                        ⬇️
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteImage(img.id) }}
                                                    className="w-7 h-7 bg-red-500/20 hover:bg-red-500 text-red-500 hover:text-white rounded-lg text-[10px] flex items-center justify-center transition-all"
                                                >
                                                    🗑️
                                                </button>
                                            </div>

                                            {/* NSFW Lock */}
                                            {img.image_type === 'NSFW' && !unblurList[img.id] && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm group-hover:bg-black/20 transition-all">
                                                    <span className="text-xl">🔞</span>
                                                </div>
                                            )}
                                        </div>
                                    )
                                })}

                                {/* Add Empty Slots Indicator */}
                                {currentImages.length < (item.batch_size || 4) && Array.from({ length: (item.batch_size || 4) - currentImages.length }).map((_, idx) => (
                                    <div key={`empty-${idx}`} className="bg-slate-900/40 border-2 border-dashed border-slate-800 rounded-xl aspect-[4/5] flex flex-col items-center justify-center text-slate-600 gap-2 opacity-50">
                                        <span className="text-2xl">⌛</span>
                                        <p className="text-[8px] font-black uppercase tracking-tighter">Wait for AI</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Right: Asset Detail Sidebar */}
                    {/* Right: Asset Detail Sidebar */}
                    <div className="w-80 md:w-96 border-l border-slate-800 bg-slate-900/60 backdrop-blur-2xl flex flex-col shrink-0">
                        {/* Sidebar Header */}
                        <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-900/80">
                            <h3 className="text-xs font-black text-white tracking-widest uppercase flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${selectedImageId ? 'bg-indigo-500' : 'bg-orange-500'}`} />
                                {selectedImageId ? 'Asset Details' : 'Content Overview'}
                            </h3>
                            {selectedImageId && (
                                <button
                                    onClick={() => setSelectedImageId(null)}
                                    className="text-slate-500 hover:text-white transition-colors"
                                >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            )}
                        </div>

                        {/* Sidebar Content */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
                            {/* 1. Global Content Info */}
                            <div className="space-y-6">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-orange-500 uppercase tracking-widest">Topic</p>
                                    <h4 className="text-sm font-bold text-white leading-tight">{item.topic}</h4>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-1.5">
                                        <div className="flex justify-between items-center">
                                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Final Caption</p>
                                            <button 
                                                onClick={onOpenPromptEditor}
                                                className="text-[9px] font-black text-indigo-400 hover:text-indigo-300 transition-colors uppercase"
                                            >
                                                Edit Prompt ✍️
                                            </button>
                                        </div>
                                        <div className="bg-black/30 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed max-h-[140px] overflow-y-auto font-medium scrollbar-hide">
                                            {item.caption_draft || 'No caption available.'}
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Storyline / Script</p>
                                        <div className="bg-black/30 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 leading-relaxed max-h-[140px] overflow-y-auto font-medium italic scrollbar-hide">
                                            {item.storyline_draft || 'No storyline draft available.'}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="h-[1px] bg-white/5" />

                            {/* 2. Selected Asset Details */}
                            {selectedImageId ? (
                                (() => {
                                    const selectedImg = localImages.find(i => i.id === selectedImageId)
                                    if (!selectedImg) return null

                                    return (
                                        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                                            {/* Mini Preview */}
                                            <div className="space-y-3">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Asset Preview</p>
                                                <div className="relative aspect-video rounded-xl overflow-hidden border border-white/5 shadow-2xl bg-black group">
                                                    <img
                                                        src={getOptimizedUrl(selectedImg.file_path, 400)}
                                                        className={`w-full h-full object-cover ${selectedImg.image_type === 'NSFW' && !unblurList[selectedImg.id] ? 'blur-xl' : ''}`}
                                                        alt="Preview"
                                                    />
                                                    <div
                                                        className="absolute inset-0 bg-black/20 hover:bg-black/0 cursor-zoom-in transition-all flex items-center justify-center group"
                                                        onClick={() => setFullscreenImage(getOriginalUrl(selectedImg.file_path))}
                                                    >
                                                        <span className="opacity-0 group-hover:opacity-100 bg-black/60 text-white px-3 py-1.5 rounded-full text-[10px] font-bold border border-white/20">🔍 ZOOM</span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Platform Selection */}
                                            <div className="space-y-3">
                                                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Post Exposure</p>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {['instagram', 'twitter', 'fanvue'].map(platform => {
                                                        const sel = selections[platform]
                                                        const isSelected = Array.isArray(sel) ? sel.includes(selectedImg.id) : sel === selectedImg.id
                                                        return (
                                                            <button
                                                                key={platform}
                                                                onClick={() => handleTogglePlatform(platform, selectedImg.id)}
                                                                className={`w-full py-3 px-4 rounded-xl text-[10px] font-black transition-all border flex justify-between items-center ${isSelected
                                                                    ? 'bg-indigo-500/10 border-indigo-500 text-indigo-400 shadow-[0_0_20px_rgba(99,102,241,0.1)]'
                                                                    : 'bg-slate-800/40 border-slate-700 text-slate-500 hover:border-slate-500'
                                                                    }`}
                                                            >
                                                                <span className="tracking-widest">{platform.toUpperCase()}</span>
                                                                {isSelected ? (
                                                                    <span className="w-5 h-5 bg-indigo-500 text-white rounded-full flex items-center justify-center text-[8px] shadow-lg">✓</span>
                                                                ) : (
                                                                    <div className="w-5 h-5 rounded-full border border-slate-700" />
                                                                )}
                                                            </button>
                                                        )
                                                    })}
                                                </div>
                                            </div>

                                            {/* Quick Actions */}
                                            <div className="grid grid-cols-2 gap-3">
                                                <button
                                                    onClick={() => handleDownload(selectedImg)}
                                                    className="py-3 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black rounded-xl border border-slate-700 transition-all flex items-center justify-center gap-2"
                                                >
                                                    ⬇️ DOWNLOAD
                                                </button>
                                                <button
                                                    onClick={() => setVideoCoverId(selectedImg.id)}
                                                    className={`py-3 text-[10px] font-black rounded-xl border transition-all flex items-center justify-center gap-2 ${videoCoverId === selectedImg.id ? 'bg-orange-500/20 border-orange-500 text-orange-400' : 'bg-slate-800/40 border-slate-700 text-slate-500'}`}
                                                >
                                                    📸 COVER
                                                </button>
                                            </div>

                                            {/* Advanced Settings */}
                                            <details className="group bg-black/20 rounded-2xl border border-slate-800/50 overflow-hidden">
                                                <summary className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-widest cursor-pointer list-none flex justify-between items-center outline-none hover:bg-white/5 transition-colors">
                                                    Advanced Settings
                                                    <span className="group-open:rotate-180 transition-transform">▼</span>
                                                </summary>

                                                <div className="p-4 pt-0 space-y-4 border-t border-slate-800/50">
                                                    <div className="pt-4 space-y-2">
                                                        <div className="flex justify-between items-center">
                                                            <span className="text-[9px] font-black text-slate-500 uppercase">Video Motion Prompts</span>
                                                            <button 
                                                                onClick={() => handleAutoSplitVDO(selectedImg)}
                                                                className="px-2 py-1 bg-indigo-500 text-white text-[8px] font-black rounded"
                                                                disabled={isSplittingVDO[selectedImg.id]}
                                                            >
                                                                {isSplittingVDO[selectedImg.id] ? '...' : 'AUTO-SPLIT'}
                                                            </button>
                                                        </div>
                                                        <div className="space-y-2">
                                                            {[1, 2, 3].map(n => (
                                                                <textarea
                                                                    key={n}
                                                                    className="w-full bg-slate-900 border border-slate-800 rounded p-2 text-[9px] text-slate-400 h-12 focus:border-orange-500 outline-none resize-none"
                                                                    placeholder={`Part ${n} Motion...`}
                                                                    value={(selectedImg as any)[`vdo_prompt_${n}`] || ''}
                                                                    onChange={(e) => {
                                                                        const newImages = [...localImages]
                                                                        const found = newImages.find(ni => ni.id === selectedImg.id)
                                                                        if (found) (found as any)[`vdo_prompt_${n}`] = e.target.value
                                                                        setLocalImages(newImages)
                                                                    }}
                                                                />
                                                            ))}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleGenerateVideo(selectedImg.id)}
                                                        disabled={selectedImg.vdo_status === 'pending'}
                                                        className="w-full py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-black rounded-xl shadow-lg transition-all"
                                                    >
                                                        {selectedImg.vdo_status === 'pending' ? '🔃 QUEUED...' : '🎬 GENERATE VIDEO'}
                                                    </button>
                                                </div>
                                            </details>

                                            <button
                                                onClick={() => handleDeleteImage(selectedImg.id)}
                                                className="w-full py-3 bg-red-950/20 hover:bg-red-500 text-red-500 hover:text-white text-[10px] font-black rounded-xl border border-red-500/20 transition-all flex items-center justify-center gap-2"
                                            >
                                                🗑️ DELETE ASSET
                                            </button>
                                        </div>
                                    )
                                })()
                            ) : (
                                <div className="py-20 flex flex-col items-center justify-center text-center gap-4 animate-pulse opacity-50">
                                    <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center text-2xl border border-white/5 shadow-2xl">
                                        👈
                                    </div>
                                    <div className="space-y-1">
                                        <p className="text-xs font-black text-slate-500 uppercase tracking-widest">Select an Asset</p>
                                        <p className="text-[10px] text-slate-600 font-medium">Pick an image from the gallery<br />to edit settings</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
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
