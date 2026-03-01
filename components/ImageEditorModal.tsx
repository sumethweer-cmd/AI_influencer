'use client'

import React, { useState, useRef, useEffect } from 'react'

interface TextLayer {
    id: string
    text: string
    x: number
    y: number
    fontSize: number
    color: string
    fontFamily: string
}

interface ImageEditorModalProps {
    imageUrl: string
    onSave: (blob: Blob) => void
    onClose: () => void
}

export default function ImageEditorModal({ imageUrl, onSave, onClose }: ImageEditorModalProps) {
    const [zoom, setZoom] = useState(1)
    const [position, setPosition] = useState({ x: 0, y: 0 })
    const [ratio, setRatio] = useState('4:5')
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const containerRef = useRef<HTMLDivElement>(null)

    // Designer Mode State
    const [textLayers, setTextLayers] = useState<TextLayer[]>([])
    const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
    const [isDraggingText, setIsDraggingText] = useState(false)

    const handleMouseDown = (e: React.MouseEvent) => {
        if (selectedTextId) {
            setIsDraggingText(true)
            setDragStart({ x: e.clientX, y: e.clientY })
            return
        }
        setIsDragging(true)
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDraggingText && selectedTextId) {
            const dx = e.clientX - dragStart.x
            const dy = e.clientY - dragStart.y
            setTextLayers(prev => prev.map(t =>
                t.id === selectedTextId ? { ...t, x: t.x + dx, y: t.y + dy } : t
            ))
            setDragStart({ x: e.clientX, y: e.clientY })
            return
        }
        if (!isDragging) return
        setPosition({
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        })
    }

    const handleMouseUp = () => {
        setIsDragging(false)
        setIsDraggingText(false)
    }

    const addText = () => {
        const newText: TextLayer = {
            id: Math.random().toString(36).substr(2, 9),
            text: 'New Caption',
            x: 0,
            y: 0,
            fontSize: 40,
            color: '#ffffff',
            fontFamily: 'Inter'
        }
        setTextLayers([...textLayers, newText])
        setSelectedTextId(newText.id)
    }

    const handleSave = async () => {
        const img = new Image()
        img.crossOrigin = "anonymous"
        img.src = imageUrl

        img.onload = () => {
            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d')
            if (!ctx) return

            const [rw, rh] = ratio.split(':').map(Number)
            const targetWidth = 1080
            const targetHeight = (targetWidth * rh) / rw

            canvas.width = targetWidth
            canvas.height = targetHeight

            ctx.fillStyle = '#000'
            ctx.fillRect(0, 0, canvas.width, canvas.height)

            const container = containerRef.current
            if (!container) return

            const containerRect = container.getBoundingClientRect()
            const containerWidth = containerRect.width
            const containerHeight = containerRect.height

            const imgAspect = img.naturalWidth / img.naturalHeight
            const containerAspect = containerWidth / containerHeight

            let drawWidth: number, drawHeight: number
            if (imgAspect > containerAspect) {
                drawHeight = containerHeight
                drawWidth = containerHeight * imgAspect
            } else {
                drawWidth = containerWidth
                drawHeight = containerWidth / imgAspect
            }

            const scaleX = targetWidth / containerWidth
            const scaleY = targetHeight / containerHeight

            ctx.save()
            ctx.translate(canvas.width / 2 + (position.x * scaleX), canvas.height / 2 + (position.y * scaleY))
            ctx.scale(zoom, zoom)
            ctx.drawImage(img, -drawWidth * scaleX / 2, -drawHeight * scaleY / 2, drawWidth * scaleX, drawHeight * scaleY)
            ctx.restore()

            // --- Designer Mode: Render Text Layers ---
            textLayers.forEach(layer => {
                ctx.save()
                ctx.font = `bold ${layer.fontSize * scaleX}px ${layer.fontFamily}, sans-serif`
                ctx.fillStyle = layer.color
                ctx.textAlign = 'center'
                ctx.textBaseline = 'middle'

                // Shadow for readability
                ctx.shadowColor = 'rgba(0,0,0,0.8)'
                ctx.shadowBlur = 10 * scaleX
                ctx.shadowOffsetX = 2 * scaleX
                ctx.shadowOffsetY = 2 * scaleX

                // Position on canvas
                const cx = canvas.width / 2 + (layer.x * scaleX)
                const cy = canvas.height / 2 + (layer.y * scaleY)
                ctx.fillText(layer.text, cx, cy)
                ctx.restore()
            })

            canvas.toBlob((blob) => {
                if (blob) onSave(blob)
            }, 'image/jpeg', 0.95)
        }
    }

    const ratioStyles: Record<string, string> = {
        '4:5': 'aspect-[4/5] w-[320px]',
        '9:16': 'aspect-[9/16] w-[225px]',
        '1:1': 'aspect-square w-[320px]',
        '16:9': 'aspect-[16/9] w-[400px]'
    }

    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/95 backdrop-blur-xl animate-in zoom-in duration-200">
            <div className="bg-slate-900 border border-white/10 rounded-[2.5rem] overflow-hidden flex flex-col max-w-5xl w-full h-[90vh] shadow-2xl glassmorphism">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-slate-900/50">
                    <div>
                        <h3 className="text-white font-black text-lg uppercase tracking-widest flex items-center gap-2">
                            <span className="bg-orange-600 p-1.5 rounded-lg text-sm">✂️</span>
                            Designer Studio
                        </h3>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-tighter mt-1">CROP • ZOOM • CAPTION • EMOJI</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-all text-slate-400 hover:text-white">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Left Toolbar */}
                    <div className="w-20 border-r border-white/5 bg-slate-950/50 flex flex-col items-center py-8 gap-6">
                        <button
                            onClick={addText}
                            className="w-12 h-12 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-600/20 transition-all active:scale-90"
                        >
                            <span className="text-xl font-black">T</span>
                        </button>
                        <div className="w-8 h-px bg-white/10" />
                        {Object.keys(ratioStyles).map(r => (
                            <button
                                key={r}
                                onClick={() => setRatio(r)}
                                className={`w-12 h-12 rounded-xl text-[10px] font-black transition-all flex items-center justify-center border ${ratio === r ? 'bg-orange-600 border-white/20 text-white' : 'bg-slate-800 border-white/5 text-slate-500 hover:text-white'}`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>

                    {/* Editor Main */}
                    <div className="flex-1 bg-black/50 relative flex items-center justify-center overflow-hidden p-12">
                        <div
                            ref={containerRef}
                            className={`relative overflow-hidden border-2 border-orange-500/30 shadow-[0_0_100px_rgba(249,115,22,0.1)] ${ratioStyles[ratio]}`}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                        >
                            <div
                                className="absolute inset-0 transition-transform duration-75"
                                style={{
                                    transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                                    touchAction: 'none'
                                }}
                            >
                                <img
                                    src={imageUrl}
                                    alt="Base"
                                    className="w-full h-full object-cover pointer-events-none select-none"
                                />
                            </div>

                            {/* Text Layers Rendering */}
                            {textLayers.map(layer => (
                                <div
                                    key={layer.id}
                                    onMouseDown={(e) => { e.stopPropagation(); setSelectedTextId(layer.id) }}
                                    className={`absolute cursor-move select-none whitespace-nowrap px-2 py-1 rounded-lg transition-shadow duration-200 group ${selectedTextId === layer.id ? 'ring-2 ring-indigo-500 bg-indigo-500/10' : 'hover:ring-1 hover:ring-white/20'}`}
                                    style={{
                                        left: '50%',
                                        top: '50%',
                                        transform: `translate(calc(-50% + ${layer.x}px), calc(-50% + ${layer.y}px))`,
                                        color: layer.color,
                                        fontSize: `${layer.fontSize}px`,
                                        fontFamily: layer.fontFamily,
                                        fontWeight: 'black',
                                        textShadow: '2px 2px 10px rgba(0,0,0,0.8)'
                                    }}
                                >
                                    {layer.text}
                                    {selectedTextId === layer.id && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setTextLayers(prev => prev.filter(t => t.id !== layer.id)); setSelectedTextId(null) }}
                                            className="absolute -top-3 -right-3 w-6 h-6 bg-rose-600 text-white rounded-full text-[10px] flex items-center justify-center shadow-lg border border-white/20"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>
                            ))}

                            {/* Overlay Grid */}
                            <div className="absolute inset-0 pointer-events-none border border-white/10 opacity-50">
                                <div className="absolute top-1/3 w-full h-px bg-white/20" />
                                <div className="absolute top-2/3 w-full h-px bg-white/20" />
                                <div className="absolute left-1/3 h-full w-px bg-white/20" />
                                <div className="absolute left-2/3 h-full w-px bg-white/20" />
                            </div>
                        </div>
                    </div>

                    {/* Right Properties Panel */}
                    <div className="w-80 border-l border-white/5 bg-slate-950/30 p-6 flex flex-col gap-8">
                        {selectedTextId ? (
                            <div className="space-y-6 animate-in slide-in-from-right duration-300">
                                <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Text Properties</h4>

                                <div className="space-y-2">
                                    <label className="text-[10px] text-slate-500 font-black uppercase">Content</label>
                                    <textarea
                                        value={textLayers.find(t => t.id === selectedTextId)?.text || ''}
                                        onChange={(e) => setTextLayers(prev => prev.map(t => t.id === selectedTextId ? { ...t, text: e.target.value } : t))}
                                        className="w-full bg-slate-900 border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none h-24 resize-none"
                                        placeholder="Type something... 🚀"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] text-slate-500 font-black uppercase">Size: {textLayers.find(t => t.id === selectedTextId)?.fontSize}px</label>
                                    <input
                                        type="range" min="10" max="200"
                                        value={textLayers.find(t => t.id === selectedTextId)?.fontSize || 40}
                                        onChange={(e) => setTextLayers(prev => prev.map(t => t.id === selectedTextId ? { ...t, fontSize: parseInt(e.target.value) } : t))}
                                        className="w-full accent-indigo-500 bg-slate-800 h-1 rounded-full appearance-none"
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-slate-500 font-black uppercase">Color</label>
                                        <input
                                            type="color"
                                            value={textLayers.find(t => t.id === selectedTextId)?.color || '#ffffff'}
                                            onChange={(e) => setTextLayers(prev => prev.map(t => t.id === selectedTextId ? { ...t, color: e.target.value } : t))}
                                            className="w-full h-10 bg-slate-900 border border-white/10 rounded-xl p-1 cursor-pointer"
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] text-slate-500 font-black uppercase">Font</label>
                                        <select
                                            value={textLayers.find(t => t.id === selectedTextId)?.fontFamily || 'Inter'}
                                            onChange={(e) => setTextLayers(prev => prev.map(t => t.id === selectedTextId ? { ...t, fontFamily: e.target.value } : t))}
                                            className="w-full bg-slate-900 border border-white/10 rounded-xl px-2 h-10 text-[10px] text-white font-black"
                                        >
                                            <option value="Inter">SANS</option>
                                            <option value="serif">SERIF</option>
                                            <option value="monospace">MONO</option>
                                            <option value="cursive">CURSIVE</option>
                                        </select>
                                    </div>
                                </div>

                                <button
                                    onClick={() => setSelectedTextId(null)}
                                    className="w-full py-3 bg-white/5 hover:bg-white/10 text-slate-400 text-[10px] font-black rounded-xl border border-white/5 transition-all"
                                >
                                    DESELECT TEXT
                                </button>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-center space-y-4">
                                <span className="text-4xl opacity-20">🎨</span>
                                <p className="text-[10px] text-slate-500 font-black uppercase max-w-[120px]">Select text or add new one to edit styles</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-8 border-t border-white/5 bg-slate-900/80 flex justify-between items-center">
                    <div className="flex flex-col gap-2 w-64">
                        <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest">
                            <span>Zoom Level</span>
                            <span className="text-orange-500">{Math.round(zoom * 100)}%</span>
                        </div>
                        <input
                            type="range" min="1" max="3" step="0.01"
                            value={zoom}
                            onChange={(e) => setZoom(parseFloat(e.target.value))}
                            className="w-full accent-orange-500 bg-slate-800 h-1.5 rounded-full appearance-none"
                        />
                    </div>

                    <div className="flex gap-4">
                        <button onClick={onClose} className="px-10 py-4 text-slate-400 hover:text-white text-xs font-black transition-all">
                            CANCEL
                        </button>
                        <button
                            onClick={handleSave}
                            className="px-14 py-4 bg-white text-black text-xs font-black rounded-2xl shadow-2xl hover:bg-orange-500 hover:text-white transition-all active:scale-95 border border-white/10"
                        >
                            SAVE & BAKE VARIANTS 🎨
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
