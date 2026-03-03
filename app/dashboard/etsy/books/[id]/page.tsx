'use client'

import React, { useState, useEffect, use, useRef } from 'react'
import Link from 'next/link'

export default function BookEditor({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = use(params)
    const id = unwrappedParams.id

    const [book, setBook] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [generatingStory, setGeneratingStory] = useState(false)
    const [saving, setSaving] = useState(false)
    const [uploadingCover, setUploadingCover] = useState(false)
    const coverFileRef = useRef<HTMLInputElement>(null)

    // For price/sales update
    const [isEditingMetrics, setIsEditingMetrics] = useState(false)
    const [editPrice, setEditPrice] = useState('0')
    const [editSales, setEditSales] = useState('0')

    useEffect(() => {
        fetchBook()
    }, [id])

    const fetchBook = async () => {
        try {
            const res = await fetch(`/api/etsy/books/${id}`).then(r => r.json())
            if (res.success) {
                setBook(res.data)
                setEditPrice(res.data.price || '0')
                setEditSales(res.data.total_sales || '0')
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const handleGenerateStory = async () => {
        if (!confirm('Generating a new story will overwrite current pages. Continue?')) return
        setGeneratingStory(true)
        try {
            const res = await fetch('/api/etsy/generate-story', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ book_id: id })
            }).then(r => r.json())

            if (res.success) {
                alert('Story generated successfully!')
                fetchBook() // Reload pages
            } else {
                alert('Error: ' + res.error)
            }
        } catch (e: any) {
            alert('Error: ' + e.message)
        }
        setGeneratingStory(false)
    }

    const saveMetrics = async () => {
        setSaving(true)
        try {
            const res = await fetch(`/api/etsy/books/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ price: parseFloat(editPrice), total_sales: parseInt(editSales) })
            }).then(r => r.json())

            if (res.success) {
                setBook(res.data)
                setIsEditingMetrics(false)
            }
        } catch (e: any) {
            alert('Error saving metrics: ' + e.message)
        }
        setSaving(false)
    }

    const savePageText = async (pageId: string, text: string, prompt: string) => {
        try {
            await fetch(`/api/etsy/pages/${pageId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ story_text: text, image_prompt: prompt })
            })
            // no alert to be seamless
        } catch (e) {
            console.error(e)
        }
    }

    const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadingCover(true)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', 'covers')

        try {
            const res = await fetch('/api/etsy/upload-asset', {
                method: 'POST',
                body: formData
            }).then(r => r.json())

            if (res.success) {
                await fetch(`/api/etsy/books/${id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cover_image_url: res.url })
                })
                fetchBook()
            } else {
                alert('Upload failed: ' + res.error)
            }
        } catch (e: any) {
            alert('Error: ' + e.message)
        } finally {
            setUploadingCover(false)
            if (coverFileRef.current) coverFileRef.current.value = ''
        }
    }

    if (loading) return <div className="p-8">Loading Book Workspace...</div>
    if (!book) return <div className="p-8">Book not found!</div>

    return (
        <div className="flex flex-col gap-8 max-w-7xl mx-auto pb-20">
            {/* Header section */}
            <header className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-col md:flex-row gap-6 justify-between items-start md:items-center">
                {/* Cover Image Area */}
                <div
                    className="relative w-24 h-32 shrink-0 bg-slate-950 border border-slate-700 rounded-lg overflow-hidden group cursor-pointer shadow-lg"
                    onClick={() => coverFileRef.current?.click()}
                >
                    {book.cover_image_url ? (
                        <img src={book.cover_image_url} alt="Cover" className="w-full h-full object-cover" />
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-2">
                            <span className="text-3xl mb-1 opacity-50">📘</span>
                            <span className="text-[10px] font-bold text-center leading-tight">Click to Add Cover</span>
                        </div>
                    )}

                    <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                        <span className="text-white text-xs font-bold leading-tight">
                            {uploadingCover ? 'Uploading...' : 'Upload Cover'}
                        </span>
                    </div>
                    <input type="file" ref={coverFileRef} className="hidden" accept="image/*" onChange={handleUploadCover} />
                </div>

                <div className="flex-1">
                    <Link href="/dashboard/etsy" className="text-sm text-purple-400 hover:text-purple-300 mb-2 inline-block">← Back to Books</Link>
                    <h2 className="text-3xl font-bold flex items-center gap-3">
                        📖 {book.title}
                        <span className={`text-xs px-2 py-1 rounded font-bold ${book.status === 'Draft' ? 'bg-slate-800 text-slate-300' :
                            book.status === 'Generating' ? 'bg-amber-900/50 text-amber-400' :
                                book.status === 'Completed' ? 'bg-emerald-900/50 text-emerald-400' :
                                    'bg-purple-900/50 text-purple-400'
                            }`}>
                            {book.status}
                        </span>
                    </h2>
                    <div className="text-slate-400 text-sm mt-2 flex gap-4">
                        <span><strong>Theme:</strong> {book.theme || 'N/A'}</span>
                        <span><strong>Age:</strong> {book.target_age}</span>
                        <span><strong>Pages:</strong> {book.total_pages}</span>
                    </div>
                </div>

                <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 min-w-[250px]">
                    <div className="flex justify-between items-center mb-2">
                        <h4 className="font-bold text-sm text-slate-300">Sales Dashboard</h4>
                        <button onClick={() => setIsEditingMetrics(!isEditingMetrics)} className="text-xs text-purple-400 hover:text-white">Edit</button>
                    </div>
                    {isEditingMetrics ? (
                        <div className="flex flex-col gap-2">
                            <input
                                type="number" step="0.01" value={editPrice} onChange={e => setEditPrice(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-md p-1.5 text-sm" placeholder="Price ($)"
                            />
                            <input
                                type="number" value={editSales} onChange={e => setEditSales(e.target.value)}
                                className="w-full bg-slate-900 border border-slate-700 rounded-md p-1.5 text-sm" placeholder="Total Sales"
                            />
                            <button onClick={saveMetrics} disabled={saving} className="bg-purple-600 hover:bg-purple-500 rounded p-1.5 text-xs font-bold w-full mt-1">
                                {saving ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <span className="block text-xs text-slate-500">Price</span>
                                <span className="font-bold text-amber-400">${book.price || '0.00'}</span>
                            </div>
                            <div>
                                <span className="block text-xs text-slate-500">Sales</span>
                                <span className="font-bold text-emerald-400">{book.total_sales || 0}</span>
                            </div>
                        </div>
                    )}
                </div>
            </header>

            {/* AI Generator Action */}
            <div className="bg-gradient-to-r from-purple-900/40 to-indigo-900/40 border border-purple-500/30 rounded-2xl p-6 flex flex-col md:flex-row items-center justify-between gap-6">
                <div>
                    <h3 className="text-lg font-bold text-slate-200">🤖 Step 1: AI Story Generation</h3>
                    <p className="text-sm text-slate-400 mt-1">Use Gemini to automatically write {book.total_pages} pages of story and image prompts for ComfyUI.</p>
                </div>
                <button
                    onClick={handleGenerateStory}
                    disabled={generatingStory}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-black text-sm shadow-lg shadow-purple-500/30 shrink-0"
                >
                    {generatingStory ? '✨ Gemini is writing...' : '✨ Generate Story & Prompts'}
                </button>
            </div>

            {/* Pages Grid */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold flex items-center gap-2">🖍️ Workspace <span className="text-sm font-normal text-slate-400">({book.etsy_pages?.length || 0} pages)</span></h3>

                    {book.etsy_pages?.length > 0 && (
                        <div className="flex gap-2">
                            <button className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold border border-slate-700">🎨 Bulk Generate Images</button>
                            <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-sm font-bold shadow-lg shadow-emerald-500/20">📄 Export Final PDF</button>
                        </div>
                    )}
                </div>

                {(!book.etsy_pages || book.etsy_pages.length === 0) ? (
                    <div className="border border-dashed border-slate-700 rounded-2xl p-12 text-center">
                        <span className="text-4xl block mb-4 opacity-70">👻</span>
                        <p className="text-slate-400">No pages yet. Click "Generate Story & Prompts" to start.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {book.etsy_pages.map((page: any, idx: number) => {
                            // Update local state per text area
                            return (
                                <PageCard
                                    key={page.id}
                                    page={page}
                                    onSave={(txt, pmt) => savePageText(page.id, txt, pmt)}
                                    onImageUploaded={fetchBook}
                                />
                            )
                        })}
                    </div>
                )}
            </div>
        </div>
    )
}

function PageCard({ page, onSave, onImageUploaded }: { page: any, onSave: (txt: string, pmt: string) => void, onImageUploaded: () => void }) {
    const [text, setText] = useState(page.story_text)
    const [prompt, setPrompt] = useState(page.image_prompt)
    const [isEdited, setIsEdited] = useState(false)
    const [uploading, setUploading] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    const handleSave = () => {
        onSave(text, prompt)
        setIsEdited(false)
    }

    const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploading(true)
        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', 'custom_images')

        try {
            const res = await fetch('/api/etsy/upload-asset', {
                method: 'POST',
                body: formData
            }).then(r => r.json())

            if (res.success) {
                await fetch(`/api/etsy/pages/${page.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ image_url: res.url, status: 'Completed' })
                })
                onImageUploaded()
            } else {
                alert('Upload failed: ' + res.error)
            }
        } catch (e: any) {
            alert('Error: ' + e.message)
        } finally {
            setUploading(false)
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    return (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl flex flex-col overflow-hidden shadow-2xl">
            <div className="p-3 bg-slate-950 border-b border-slate-800 flex justify-between items-center">
                <span className="font-black text-slate-300">Page {page.page_number}</span>
                <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${page.status === 'Completed' ? 'bg-emerald-500/20 text-emerald-400' :
                    page.status === 'Queued' ? 'bg-amber-500/20 text-amber-400' :
                        'bg-slate-800 text-slate-400'
                    }`}>
                    {page.status}
                </span>
            </div>

            <div className="p-4 flex-grow flex flex-col gap-4">
                {/* Image Placeholder / Viewer */}
                <div className="aspect-square bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center relative group overflow-hidden">
                    {page.image_url ? (
                        <img src={page.image_url} alt={`Page ${page.page_number}`} className="w-full h-full object-contain" />
                    ) : (
                        <div className="text-center p-4">
                            <span className="text-3xl opacity-50 block mb-2">🖼️</span>
                            <span className="text-xs text-slate-500 font-medium">No Image Generated</span>
                        </div>
                    )}

                    {/* Hover Action */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                        <button className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-bold shadow-lg w-40">
                            {page.image_url ? 'Regenerate' : 'Generate'}
                        </button>
                        <button
                            onClick={() => fileRef.current?.click()}
                            disabled={uploading}
                            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-sm font-bold shadow-lg w-40"
                        >
                            {uploading ? 'Uploading...' : 'Upload Custom'}
                        </button>
                    </div>
                    <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleUpload} />
                </div>

                {/* Text Editor */}
                <div className="space-y-3">
                    <div>
                        <label className="text-xs font-bold text-slate-400 block mb-1">Story Text (PDF Top)</label>
                        <textarea
                            value={text}
                            onChange={e => { setText(e.target.value); setIsEdited(true) }}
                            onBlur={handleSave}
                            className="w-full h-20 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs focus:border-purple-500 outline-none leading-relaxed"
                        />
                    </div>
                    <div>
                        <label className="text-xs font-bold text-slate-400 block mb-1">ComfyUI Image Prompt</label>
                        <textarea
                            value={prompt}
                            onChange={e => { setPrompt(e.target.value); setIsEdited(true) }}
                            onBlur={handleSave}
                            className="w-full h-20 bg-slate-950 border border-slate-700 rounded-lg p-2 text-xs focus:border-purple-500 outline-none font-mono text-amber-200/80"
                        />
                    </div>
                </div>
            </div>
        </div>
    )
}
