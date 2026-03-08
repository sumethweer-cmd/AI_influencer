'use client'

import React, { useState, useEffect, use, useRef } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'

const getImageUrl = (url: string, width?: number) => {
    if (!url) return '';
    if (url.includes('storage.googleapis.com')) {
        // If it's already webp or a video, don't touch
        if (url.toLowerCase().endsWith('.webp') || url.toLowerCase().endsWith('.mp4')) return url;

        let targetUrl = url.replace(/\.(png|jpg|jpeg)$/i, '.webp');
        if (width) {
            targetUrl += `?width=${width}`;
        }
        return targetUrl;
    }
    return url;
};
import { PDFDocument, rgb } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import Papa from 'papaparse'

export default function BookEditor({ params }: { params: Promise<{ id: string }> }) {
    const unwrappedParams = use(params)
    const id = unwrappedParams.id

    const [book, setBook] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [generatingStory, setGeneratingStory] = useState(false)
    const [saving, setSaving] = useState(false)
    const [uploadingCover, setUploadingCover] = useState(false)
    const [exportingPDF, setExportingPDF] = useState(false)
    const [importingCSV, setImportingCSV] = useState(false)
    const [pdfLayout, setPdfLayout] = useState<'split' | 'image_only' | 'image_with_text'>('split')
    const coverFileRef = useRef<HTMLInputElement>(null)
    const csvFileRef = useRef<HTMLInputElement>(null)

    // For price/sales update
    const [isEditingMetrics, setIsEditingMetrics] = useState(false)
    const [editPrice, setEditPrice] = useState('0')
    const [editSales, setEditSales] = useState('0')
    const [pdfConfig, setPdfConfig] = useState<any>({
        opacity: 85,
        position: 'center-left', // center-left, center-right, bottom-center, top-center
    })
    const [isSavingConfig, setIsSavingConfig] = useState(false)

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
                if (res.data.pdf_config) {
                    setPdfConfig(res.data.pdf_config)
                }
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

    const savePdfConfig = async (newConfig: any) => {
        setIsSavingConfig(true)
        try {
            const res = await fetch(`/api/etsy/books/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pdf_config: newConfig })
            }).then(r => r.json())

            if (res.success) {
                setPdfConfig(res.data.pdf_config)
            }
        } catch (e: any) {
            console.error('Error saving PDF config:', e)
        } finally {
            setIsSavingConfig(false)
        }
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

    const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        if (!confirm('Importing CSV will attempt to overwrite existing story text and prompts based on the rows. Continue?')) {
            if (csvFileRef.current) csvFileRef.current.value = ''
            return
        }

        setImportingCSV(true)
        Papa.parse(file, {
            header: true, // expects columns like "page", "story_text", "image_prompt"
            skipEmptyLines: true,
            complete: async (results) => {
                const rows = results.data as any[]

                // If there are no existing pages, we need to create them first.
                // For simplicity, we assume pages are already generated by "Generate Story" or we update what exists.
                // Let's match by row index or a 'page' column if it exists.
                let successCount = 0;

                for (let i = 0; i < rows.length; i++) {
                    const row = rows[i]
                    // Try to find matching page by "page" column, or just fall back to index matching
                    const pageNum = parseInt(row.page || row.page_number) || (i + 1)
                    const existingPage = book.etsy_pages?.find((p: any) => p.page_number === pageNum)

                    if (existingPage) {
                        try {
                            const storyText = row.story_text || row.text || row.story || ''
                            const imagePrompt = row.image_prompt || row.prompt || ''

                            if (storyText || imagePrompt) {
                                await fetch(`/api/etsy/pages/${existingPage.id}`, {
                                    method: 'PUT',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                        story_text: storyText || existingPage.story_text,
                                        image_prompt: imagePrompt || existingPage.image_prompt
                                    })
                                })
                                successCount++
                            }
                        } catch (err) {
                            console.error(`Failed to update page ${pageNum}:`, err)
                        }
                    }
                }

                alert(`CSV Import Complete! Updated ${successCount} pages.`)
                setImportingCSV(false)
                if (csvFileRef.current) csvFileRef.current.value = ''
                fetchBook() // refresh to show new data
            },
            error: (err) => {
                alert('Error parsing CSV: ' + err.message)
                setImportingCSV(false)
                if (csvFileRef.current) csvFileRef.current.value = ''
            }
        })
    }

    const handleExportPdf = async () => {
        if (!book.etsy_pages || book.etsy_pages.length === 0) return alert('No pages to export!')
        setExportingPDF(true)
        try {
            const configsReq = await fetch('/api/etsy/configs').then(r => r.json())
            const configs = configsReq.data || []
            const widthConfig = configs.find((c: any) => c.key_name === 'ETSY_PDF_WIDTH')?.key_value || '2550'
            const heightConfig = configs.find((c: any) => c.key_name === 'ETSY_PDF_HEIGHT')?.key_value || '3300'
            const fontUrl = configs.find((c: any) => c.key_name === 'ETSY_FONT_URL')?.key_value
            const fontSizeConfig = configs.find((c: any) => c.key_name === 'ETSY_FONT_SIZE')?.key_value || '36'
            const fontSize = parseInt(fontSizeConfig, 10) || 36

            // Convert 300 DPI pixels to PDF points (1/72 inch)
            let pdfWidth = (parseFloat(widthConfig) / 300) * 72
            let pdfHeight = (parseFloat(heightConfig) / 300) * 72

            // If Option B or C is selected, force Landscape orientation
            if ((pdfLayout === 'image_only' || pdfLayout === 'image_with_text') && pdfHeight > pdfWidth) {
                const temp = pdfWidth
                pdfWidth = pdfHeight
                pdfHeight = temp
            }

            const pdfDoc = await PDFDocument.create()
            pdfDoc.registerFontkit(fontkit)

            let customFont: any = null
            if (fontUrl) {
                try {
                    const fontRes = await fetch(fontUrl)
                    const fontBytes = await fontRes.arrayBuffer()
                    pdfDoc.registerFontkit(fontkit)
                    customFont = await pdfDoc.embedFont(fontBytes)
                } catch (e) {
                    console.error('Failed to load custom font, using built-in.', e)
                }
            }

            // Standard fonts if custom fails
            const fallbackFont = await pdfDoc.embedFont('Helvetica-Bold')
            const textFont = customFont || fallbackFont

            const pagesToExport = [...book.etsy_pages].sort((a, b) => a.page_number - b.page_number)

            // Layout Zones
            const leftZoneWidth = pdfWidth * 0.65
            const rightZoneWidth = pdfWidth * 0.35

            // Make Cover Page as the First Page if Cover Image Exists
            if (book.cover_image_url) {
                const coverPage = pdfDoc.addPage([pdfWidth, pdfHeight])

                // Left Half for Cover Image
                try {
                    const proxyUrl = `/api/etsy/proxy-image?url=${encodeURIComponent(book.cover_image_url)}`
                    const imgBytes = await fetch(proxyUrl).then(res => {
                        if (!res.ok) throw new Error(`Proxy error: ${res.statusText}`)
                        return res.arrayBuffer()
                    })
                    const embeddedImage = await pdfDoc.embedPng(imgBytes)

                    const isFullImage = pdfLayout === 'image_only' || pdfLayout === 'image_with_text'
                    const maxImgWidth = isFullImage ? pdfWidth - 40 : leftZoneWidth - 60
                    const maxImgHeight = pdfHeight - (isFullImage ? 40 : 100)
                    const imgDims = embeddedImage.scaleToFit(maxImgWidth, maxImgHeight)

                    const imgX = isFullImage ? (pdfWidth / 2) - (imgDims.width / 2) : 30 + (maxImgWidth / 2) - (imgDims.width / 2)
                    const imgY = isFullImage ? (pdfHeight / 2) - (imgDims.height / 2) : 50 + (maxImgHeight / 2) - (imgDims.height / 2)

                    coverPage.drawImage(embeddedImage, {
                        x: imgX,
                        y: imgY,
                        width: imgDims.width,
                        height: imgDims.height,
                    })
                } catch (e) {
                    console.error('Failed to embed cover image', e)
                }

                // Right Half for Book Title (Only in Split Layout)
                if (pdfLayout === 'split') {
                    const titleText = book.title || 'Coloring Book'
                    const titleSize = fontSize * 1.5 // Make title 1.5x larger than body
                    const titleWidth = textFont.widthOfTextAtSize(titleText, titleSize)
                    const titleX = leftZoneWidth + (rightZoneWidth / 2) - (titleWidth / 2)

                    coverPage.drawText(titleText, {
                        x: titleX,
                        y: (pdfHeight / 2), // Centered vertically
                        size: titleSize,
                        font: textFont,
                        color: rgb(0, 0, 0),
                    })
                }
            }

            for (const p of pagesToExport) {
                const page = pdfDoc.addPage([pdfWidth, pdfHeight])

                // Image on the Left Half (65%)
                if (p.image_url) {
                    try {
                        const proxyUrl = `/api/etsy/proxy-image?url=${encodeURIComponent(p.image_url)}`
                        const imgBytes = await fetch(proxyUrl).then(res => {
                            if (!res.ok) throw new Error(`Proxy error: ${res.statusText}`)
                            return res.arrayBuffer()
                        })
                        const embeddedImage = await pdfDoc.embedPng(imgBytes)

                        const isFullImage = pdfLayout === 'image_only' || pdfLayout === 'image_with_text'
                        const maxImgWidth = isFullImage ? pdfWidth - 40 : leftZoneWidth - 60
                        const maxImgHeight = pdfHeight - (isFullImage ? 40 : 100)
                        const imgDims = embeddedImage.scaleToFit(maxImgWidth, maxImgHeight)

                        const imgX = isFullImage ? (pdfWidth / 2) - (imgDims.width / 2) : 30 + (maxImgWidth / 2) - (imgDims.width / 2)
                        const imgY = isFullImage ? (pdfHeight / 2) - (imgDims.height / 2) : 50 + (maxImgHeight / 2) - (imgDims.height / 2)

                        page.drawImage(embeddedImage, {
                            x: imgX,
                            y: imgY,
                            width: imgDims.width,
                            height: imgDims.height,
                        })
                    } catch (e) {
                        console.error('Failed to embed image for page', p.page_number, e)
                    }
                }

                // Text Layout (Split or Overlay)
                if ((pdfLayout === 'split' || pdfLayout === 'image_with_text') && p.story_text) {
                    const isOverlay = pdfLayout === 'image_with_text';
                    // Dynamic bounds based on user config
                    const overlayOpacity = (pdfConfig.opacity || 85) / 100;
                    const position = pdfConfig.position || 'center-left';
                    const [vPos, hPos] = position.split('-');

                    const boxWidth = isOverlay ? (pdfWidth * 0.45) : (rightZoneWidth - 60);

                    const words = p.story_text.split(/\s+/);
                    const lines: string[] = [];
                    let currentLine = words[0] || '';

                    for (let i = 1; i < words.length; i++) {
                        const word = words[i];
                        const width = textFont.widthOfTextAtSize(currentLine + " " + word, fontSize);
                        if (width < boxWidth) {
                            currentLine += " " + word;
                        } else {
                            lines.push(currentLine);
                            currentLine = word;
                        }
                    }
                    if (currentLine) lines.push(currentLine);

                    const lineHeight = fontSize * 1.5;
                    const totalTextHeight = lines.length * lineHeight;
                    const paddingY = 30;
                    const paddingX = 40;

                    const maxLineWidth = lines.reduce((max, line) => {
                        const width = textFont.widthOfTextAtSize(line, fontSize);
                        return width > max ? width : max;
                    }, 0);

                    const bgWidth = maxLineWidth + (paddingX * 2);
                    const bgHeight = totalTextHeight + (paddingY * 2);

                    // Final Position Mapping
                    let bgX = (pdfWidth / 2) - (bgWidth / 2); // Default to horizontal center
                    let bgY = (pdfHeight / 2) - (bgHeight / 2); // Default to vertical center

                    if (isOverlay) {
                        // Horizontal
                        if (hPos === 'left') {
                            bgX = pdfWidth * 0.05;
                        } else if (hPos === 'right') {
                            bgX = pdfWidth - bgWidth - (pdfWidth * 0.05);
                        } else {
                            bgX = (pdfWidth / 2) - (bgWidth / 2);
                        }

                        // Vertical
                        if (vPos === 'top') {
                            bgY = pdfHeight - bgHeight - (pdfHeight * 0.05);
                        } else if (vPos === 'bottom') {
                            bgY = (pdfHeight * 0.05);
                        } else {
                            bgY = (pdfHeight / 2) - (bgHeight / 2);
                        }
                    } else {
                        // Split Layout behavior
                        bgX = (leftZoneWidth + 30) - paddingX;
                        bgY = (pdfHeight / 2) - (bgHeight / 2);
                    }

                    let currentY = bgY + bgHeight - paddingY - fontSize;

                    if (isOverlay) {
                        const cornerRadius = 15;
                        const boxOpacity = overlayOpacity;

                        // Draw Rounded Rectangle (White)
                        // Main body (vertical)
                        page.drawRectangle({
                            x: bgX + cornerRadius,
                            y: bgY,
                            width: bgWidth - 2 * cornerRadius,
                            height: bgHeight,
                            color: rgb(1, 1, 1),
                            opacity: boxOpacity,
                        })
                        // Main body (horizontal)
                        page.drawRectangle({
                            x: bgX,
                            y: bgY + cornerRadius,
                            width: bgWidth,
                            height: bgHeight - 2 * cornerRadius,
                            color: rgb(1, 1, 1),
                            opacity: boxOpacity,
                        })
                        // 4 Corners
                        const corners = [
                            { x: bgX + cornerRadius, y: bgY + cornerRadius },
                            { x: bgX + bgWidth - cornerRadius, y: bgY + cornerRadius },
                            { x: bgX + cornerRadius, y: bgY + bgHeight - cornerRadius },
                            { x: bgX + bgWidth - cornerRadius, y: bgY + bgHeight - cornerRadius }
                        ]
                        corners.forEach(c => {
                            page.drawCircle({
                                x: c.x,
                                y: c.y,
                                size: cornerRadius,
                                color: rgb(1, 1, 1),
                                opacity: boxOpacity,
                            })
                        })
                    }

                    for (const line of lines) {
                        const lineWidth = textFont.widthOfTextAtSize(line, fontSize);
                        page.drawText(line, {
                            x: bgX + paddingX + (maxLineWidth - lineWidth) / 2,
                            y: currentY,
                            size: fontSize,
                            font: textFont,
                            color: rgb(0, 0, 0),
                        })
                        currentY -= lineHeight;
                    }
                }
            }

            const pdfBytes = await pdfDoc.save()
            const blob = new Blob([pdfBytes as any], { type: 'application/pdf' })
            const url = URL.createObjectURL(blob)
            const link = document.createElement('a')
            link.href = url
            link.download = `${book.title}_ColoringBook.pdf`
            link.click()
            URL.revokeObjectURL(url)

        } catch (e: any) {
            alert('Export PDF error: ' + e.message)
        } finally {
            setExportingPDF(false)
        }
    }

    const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        setUploadingCover(true)

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('folder', 'covers')

            const res = await fetch('/api/etsy/upload-asset', {
                method: 'POST',
                body: formData
            }).then(r => r.json())

            if (!res.success) throw new Error(res.error)

            const publicUrl = res.url

            await fetch(`/api/etsy/books/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cover_image_url: publicUrl })
            })
            fetchBook()
        } catch (e: any) {
            alert('Upload Error: ' + e.message)
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
                <div className="flex flex-col items-center gap-2 shrink-0">
                    <div
                        className="relative w-32 h-44 bg-slate-950 border-2 border-dashed border-slate-600 hover:border-purple-500 rounded-lg overflow-hidden group cursor-pointer shadow-lg transition-colors"
                        onClick={() => coverFileRef.current?.click()}
                    >
                        {book.cover_image_url ? (
                            <img
                                src={getImageUrl(book.cover_image_url, 300)}
                                alt="Cover"
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    if (target.src.includes('.webp')) {
                                        target.src = book.cover_image_url;
                                    }
                                }}
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-2">
                                <span className="text-4xl mb-2 opacity-50">📘</span>
                                <span className="text-xs font-bold text-center leading-tight">Click to<br />Upload Cover</span>
                            </div>
                        )}

                        <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center p-2 text-center">
                            <span className="text-white text-xs font-bold leading-tight">
                                {uploadingCover ? 'Uploading...' : 'Change Cover'}
                            </span>
                        </div>
                        <input type="file" ref={coverFileRef} className="hidden" accept="image/*" onChange={handleUploadCover} />
                    </div>
                    <div className="text-center">
                        <span className="text-xs font-bold text-slate-300 block">Cover Image</span>
                        <span className="text-[10px] text-slate-500 block">Rec: 1:1 or 4:3</span>
                        <span className="text-[10px] text-slate-500 block">(e.g. 1024x1024)</span>
                    </div>
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
                        <div className="flex bg-slate-900 border border-slate-700 rounded-lg p-1 overflow-hidden ml-2">
                            <select
                                value={pdfLayout}
                                onChange={e => setPdfLayout(e.target.value as any)}
                                className="bg-transparent text-sm font-bold text-slate-300 outline-none px-2 py-1 mr-2 border-r border-slate-700"
                            >
                                <option value="split">Option A: Split (Image + Text)</option>
                                <option value="image_only">Option B: Full Image Only</option>
                                <option value="image_with_text">Option C: Full Image + Text Overlay</option>
                            </select>
                            <button
                                onClick={handleExportPdf}
                                disabled={exportingPDF}
                                className="px-4 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-wait rounded text-sm font-bold shadow-lg flex items-center gap-2"
                            >
                                {exportingPDF ? '📄 Generating...' : '📄 Export'}
                            </button>
                        </div>
                    )}
                </div>

                {/* PDF Configuration Panel */}
                {book.etsy_pages?.length > 0 && pdfLayout === 'image_with_text' && (
                    <div className="mb-6 bg-slate-900/50 border border-slate-800 rounded-xl p-4 flex flex-col md:flex-row gap-8 items-start md:items-center">
                        <div className="flex-1">
                            <h4 className="text-sm font-bold text-purple-400 mb-1 flex items-center gap-2">
                                ⚙️ PDF Overlay Settings
                                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded uppercase tracking-wider">Customizable</span>
                            </h4>
                            <p className="text-xs text-slate-500">ปรับแต่งตำแหน่งและความโปร่งใสของกล่องข้อความบนหน้ากระดาษ</p>
                        </div>

                        <div className="flex flex-col gap-1 w-full md:w-48">
                            <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                                <span>Opacity (ความใส)</span>
                                <span className="text-purple-400">{pdfConfig.opacity}%</span>
                            </div>
                            <input
                                type="range" min="0" max="100" value={pdfConfig.opacity}
                                onChange={e => {
                                    const val = parseInt(e.target.value);
                                    setPdfConfig({ ...pdfConfig, opacity: val });
                                }}
                                onMouseUp={() => savePdfConfig(pdfConfig)}
                                className="w-full accent-purple-500 h-1.5 bg-slate-800 rounded-lg cursor-pointer"
                            />
                        </div>

                        <div className="flex flex-col gap-1 w-full md:w-56">
                            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter mb-1">
                                Position (ตำแหน่งกล่องข้อความ)
                            </div>
                            <div className="grid grid-cols-3 gap-1 grid-rows-3 aspect-square w-24">
                                {[
                                    { id: 'top-left', icon: '↖️' },
                                    { id: 'top-center', icon: '⬆️' },
                                    { id: 'top-right', icon: '↗️' },
                                    { id: 'center-left', icon: '⬅️' },
                                    { id: 'center-center', icon: '⏺️' },
                                    { id: 'center-right', icon: '➡️' },
                                    { id: 'bottom-left', icon: '↙️' },
                                    { id: 'bottom-center', icon: '⬇️' },
                                    { id: 'bottom-right', icon: '↘️' },
                                ].map(pos => (
                                    <button
                                        key={pos.id}
                                        onClick={() => {
                                            const newConfig = { ...pdfConfig, position: pos.id };
                                            setPdfConfig(newConfig);
                                            savePdfConfig(newConfig);
                                        }}
                                        title={pos.id}
                                        className={`flex items-center justify-center p-1 rounded border transition-all ${pdfConfig.position === pos.id
                                            ? 'bg-purple-600 border-purple-500 text-white'
                                            : 'bg-slate-950 border-slate-700 text-slate-500 hover:border-slate-500'
                                            }`}
                                    >
                                        <span className="text-xs">{pos.icon}</span>
                                    </button>
                                ))}
                            </div>
                        </div>

                        {isSavingConfig && (
                            <div className="text-[10px] text-slate-500 animate-pulse font-bold uppercase tracking-widest">Saving...</div>
                        )}
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

        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('folder', 'custom_images')

            const res = await fetch('/api/etsy/upload-asset', {
                method: 'POST',
                body: formData
            }).then(r => r.json())

            if (!res.success) throw new Error(res.error)

            const publicUrl = res.url

            await fetch(`/api/etsy/pages/${page.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image_url: publicUrl, status: 'Completed' })
            })
            onImageUploaded()
        } catch (e: any) {
            alert('Upload Error: ' + e.message)
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
                <div>
                    <div className="aspect-square bg-slate-950 rounded-xl border border-slate-800 flex items-center justify-center relative group overflow-hidden mb-2">
                        {page.image_url ? (
                            <img
                                src={getImageUrl(page.image_url, 400)}
                                alt={`Page ${page.page_number}`}
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    if (target.src.includes('.webp')) {
                                        target.src = page.image_url;
                                    }
                                }}
                            />
                        ) : (
                            <div className="text-center p-4">
                                <span className="text-3xl opacity-50 block mb-2">🖼️</span>
                                <span className="text-xs text-slate-500 font-medium pb-2 block border-b border-slate-800">No Image Generated</span>
                                <span className="text-[10px] text-slate-600 font-medium block mt-2">Recommended: 1:1 or 4:3<br />(e.g. 1024x1024)</span>
                            </div>
                        )}

                        {/* Hover Action */}
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-3">
                            <button className="px-4 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-bold shadow-lg w-40">
                                {page.image_url ? 'Regenerate' : 'Generate AI'}
                            </button>
                            <button
                                onClick={() => fileRef.current?.click()}
                                disabled={uploading}
                                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 rounded-lg text-sm font-bold shadow-lg w-40 border border-slate-500"
                            >
                                {uploading ? 'Uploading...' : 'Upload Custom'}
                            </button>
                        </div>
                        <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleUpload} />
                    </div>
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
