'use client'

import React, { useState, useEffect, use, useRef } from 'react'
import Link from 'next/link'

const PLACEHOLDER = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23f1f5f9"/%3E%3C/svg%3E'

const BG_PRESETS = [
    { hex: '#F3F7E9', label: 'Sage Green' },
    { hex: '#FFFDF3', label: 'Cream' },
    { hex: '#FEECEF', label: 'Pink' },
    { hex: '#EEF4FF', label: 'Blue' },
]

export default function MockupGeneratorPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params)

    const [book, setBook] = useState<any>(null)
    const [loading, setLoading] = useState(true)
    const [downloading, setDownloading] = useState(false)

    const [template, setTemplate] = useState<1 | 2>(1)
    const [bg, setBg] = useState('#F3F7E9')
    const [wmOpacity, setWmOpacity] = useState(15)

    const [brand, setBrand] = useState('Buay&Guay')
    const [title, setTitle] = useState('')
    const [sub, setSub] = useState('')
    const [badge, setBadge] = useState('')
    const [coverTitle, setCoverTitle] = useState('')
    const [midText, setMidText] = useState('PDF DOWNLOAD')
    const [rightText, setRightText] = useState('')

    // Image slot selections — store the actual image URL chosen for each slot
    const [coverSrc, setCoverSrc] = useState('')
    const [backLeftSrc, setBackLeftSrc] = useState('')
    const [backRightSrc, setBackRightSrc] = useState('')
    const [b1, setB1] = useState('')
    const [b2, setB2] = useState('')
    const [b3, setB3] = useState('')
    const [b4, setB4] = useState('')
    const [g1, setG1] = useState('')
    const [g2, setG2] = useState('')
    const [g3, setG3] = useState('')
    const [g4, setG4] = useState('')

    const captureRef = useRef<HTMLDivElement>(null)

    useEffect(() => { fetchBook() }, [id])

    const fetchBook = async () => {
        try {
            const res = await fetch(`/api/etsy/books/${id}`).then(r => r.json())
            if (res.success) {
                const b = res.data
                setBook(b)
                const pages = (b.etsy_pages || []).sort((a: any, c: any) => a.page_number - c.page_number)
                const pageImgs = pages.map((p: any) => p.image_url).filter(Boolean)
                const cover = b.cover_image_url || pageImgs[0] || ''

                setTitle(b.title?.toUpperCase() || '')
                setSub(`${b.total_pages} PRINTABLE COLORING PAGES`)
                setBadge(`${b.total_pages} Pages`)
                setCoverTitle(b.title?.toUpperCase() || '')
                setRightText(b.title?.toUpperCase() || '')

                setCoverSrc(cover)
                setBackLeftSrc(pageImgs[0] || cover)
                setBackRightSrc(pageImgs[1] || cover)
                setB1(pageImgs[0] || '')
                setB2(pageImgs[1] || '')
                setB3(pageImgs[2] || '')
                setB4(pageImgs[3] || '')
                setG1(pageImgs[0] || cover)
                setG2(pageImgs[1] || '')
                setG3(pageImgs[2] || '')
                setG4(pageImgs[3] || '')
            }
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const imageOptions: { label: string, url: string }[] = book ? [
        ...(book.cover_image_url ? [{ label: 'Cover', url: book.cover_image_url }] : []),
        ...((book.etsy_pages || []).sort((a: any, b: any) => a.page_number - b.page_number).map((p: any) => ({ label: `Page ${p.page_number}`, url: p.image_url })).filter((o: any) => o.url))
    ] : []

    const doDownload = async () => {
        if (!captureRef.current) return
        setDownloading(true)
        try {
            const html2canvas = (await import('html2canvas')).default
            const canvas = await html2canvas(captureRef.current, {
                scale: 3,
                useCORS: true,
                allowTaint: true,
                backgroundColor: null,
                logging: false,
            })
            const brandSlug = brand.toLowerCase().replace(/[^a-z0-9]/g, '_')
            const tmplSlug = template === 1 ? 'hero' : 'grid'
            const a = document.createElement('a')
            a.href = canvas.toDataURL('image/png')
            a.download = `buay_guay_etsy_${brandSlug}_${tmplSlug}.png`
            a.click()
        } catch (e: any) {
            alert('เกิดข้อผิดพลาดตอนสร้างรูป: ' + e.message + ' (อาจเกิดจากรูปภาพติด CORS — ลองดาวน์โหลดรูปมาอัปโหลดใหม่แทน)')
        } finally {
            setDownloading(false)
        }
    }

    if (loading) return <div className="p-8">Loading Mockup Generator...</div>
    if (!book) return <div className="p-8">Book not found!</div>

    const Slot = ({ value, onChange, label }: { value: string, onChange: (v: string) => void, label: string }) => (
        <label className="block">
            <span className="text-xs text-slate-400">{label}</span>
            <select value={value} onChange={e => onChange(e.target.value)} className="mt-1 w-full text-xs bg-slate-950 border border-slate-700 rounded-lg px-2 py-1.5 text-slate-300">
                <option value="">(none)</option>
                {imageOptions.map(o => <option key={o.url} value={o.url}>{o.label}</option>)}
            </select>
        </label>
    )

    return (
        <div className="flex flex-col gap-6 max-w-7xl mx-auto pb-20">
            <link href="https://fonts.googleapis.com/css2?family=Fredoka:wght@400;600;700&family=Quicksand:wght@500;600;700&display=swap" rel="stylesheet" />

            <div>
                <Link href={`/dashboard/etsy/books/${id}`} className="text-sm text-purple-400 hover:text-purple-300 mb-2 inline-block">← Back to Book</Link>
                <h2 className="text-3xl font-bold">🎨 Mockup Generator</h2>
                <p className="text-slate-400 mt-1">สร้างภาพโปรโมทสำหรับ Etsy listing — ดึงรูปจากหนังสือเล่มนี้อัตโนมัติ ปรับข้อความ/รูปได้ตามต้องการ</p>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Controls */}
                <aside className="w-full lg:w-[380px] shrink-0 bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-5 max-h-[calc(100vh-140px)] overflow-y-auto">
                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">1. เลือกเลย์เอาต์</p>
                        <div className="grid grid-cols-2 gap-2">
                            <button onClick={() => setTemplate(1)} className={`border-2 rounded-xl p-3 text-sm font-bold flex flex-col items-center gap-1 ${template === 1 ? 'border-pink-500 bg-pink-500/10 text-pink-400' : 'border-slate-700 text-slate-400'}`}>
                                <span className="text-xl">📚</span> Hero Cover
                            </button>
                            <button onClick={() => setTemplate(2)} className={`border-2 rounded-xl p-3 text-sm font-bold flex flex-col items-center gap-1 ${template === 2 ? 'border-pink-500 bg-pink-500/10 text-pink-400' : 'border-slate-700 text-slate-400'}`}>
                                <span className="text-xl">🎴</span> 4-Grid
                            </button>
                        </div>
                    </div>

                    <hr className="border-slate-800" />

                    <div>
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">2. สีพื้นหลัง</p>
                        <div className="flex items-center gap-2">
                            <input type="color" value={bg} onChange={e => setBg(e.target.value)} className="w-9 h-9 rounded cursor-pointer border border-slate-700" />
                            {BG_PRESETS.map(p => (
                                <button key={p.hex} onClick={() => setBg(p.hex)} title={p.label} className="w-7 h-7 rounded-lg border-2 border-slate-700 hover:border-slate-400" style={{ background: p.hex }} />
                            ))}
                        </div>
                        <div className="mt-3">
                            <label className="text-xs text-slate-400 block mb-1">ความเข้ม Watermark</label>
                            <input type="range" min="0" max="50" value={wmOpacity} onChange={e => setWmOpacity(parseInt(e.target.value))} className="w-full accent-pink-500" />
                        </div>
                    </div>

                    <hr className="border-slate-800" />

                    <div className="space-y-3">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">3. ข้อความ</p>
                        <label className="block">
                            <span className="text-xs text-slate-400">ชื่อแบรนด์</span>
                            <input type="text" value={brand} onChange={e => setBrand(e.target.value)} className="mt-1 w-full text-sm bg-slate-950 border border-slate-700 rounded-lg px-3 py-2" />
                        </label>

                        {template === 1 ? (
                            <>
                                <label className="block">
                                    <span className="text-xs text-slate-400">หัวข้อหลัก</span>
                                    <input type="text" value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full text-sm bg-slate-950 border border-slate-700 rounded-lg px-3 py-2" />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-slate-400">หัวข้อย่อย</span>
                                    <input type="text" value={sub} onChange={e => setSub(e.target.value)} className="mt-1 w-full text-sm bg-slate-950 border border-slate-700 rounded-lg px-3 py-2" />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-slate-400">ข้อความ Badge</span>
                                    <input type="text" value={badge} onChange={e => setBadge(e.target.value)} className="mt-1 w-full text-sm bg-slate-950 border border-slate-700 rounded-lg px-3 py-2" />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-slate-400">ชื่อหนังสือบนปก</span>
                                    <input type="text" value={coverTitle} onChange={e => setCoverTitle(e.target.value)} className="mt-1 w-full text-sm bg-slate-950 border border-slate-700 rounded-lg px-3 py-2" />
                                </label>
                            </>
                        ) : (
                            <>
                                <label className="block">
                                    <span className="text-xs text-slate-400">แบนเนอร์กลาง</span>
                                    <input type="text" value={midText} onChange={e => setMidText(e.target.value)} className="mt-1 w-full text-sm bg-slate-950 border border-slate-700 rounded-lg px-3 py-2" />
                                </label>
                                <label className="block">
                                    <span className="text-xs text-slate-400">แบนเนอร์ขวา</span>
                                    <input type="text" value={rightText} onChange={e => setRightText(e.target.value)} className="mt-1 w-full text-sm bg-slate-950 border border-slate-700 rounded-lg px-3 py-2" />
                                </label>
                            </>
                        )}
                    </div>

                    <hr className="border-slate-800" />

                    <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">4. รูปภาพ (ดึงจากเล่มนี้อัตโนมัติ — เปลี่ยนได้)</p>
                        {template === 1 ? (
                            <>
                                <Slot label="ภาพปกหลัก (Cover Art)" value={coverSrc} onChange={setCoverSrc} />
                                <Slot label="ภาพด้านหลังซ้าย" value={backLeftSrc} onChange={setBackLeftSrc} />
                                <Slot label="ภาพด้านหลังขวา" value={backRightSrc} onChange={setBackRightSrc} />
                                <Slot label="แถวล่าง ช่อง 1" value={b1} onChange={setB1} />
                                <Slot label="แถวล่าง ช่อง 2" value={b2} onChange={setB2} />
                                <Slot label="แถวล่าง ช่อง 3" value={b3} onChange={setB3} />
                                <Slot label="แถวล่าง ช่อง 4" value={b4} onChange={setB4} />
                            </>
                        ) : (
                            <>
                                <Slot label="บนซ้าย" value={g1} onChange={setG1} />
                                <Slot label="บนขวา" value={g2} onChange={setG2} />
                                <Slot label="ล่างซ้าย" value={g3} onChange={setG3} />
                                <Slot label="ล่างขวา" value={g4} onChange={setG4} />
                            </>
                        )}
                    </div>

                    <hr className="border-slate-800" />

                    <button
                        onClick={doDownload}
                        disabled={downloading}
                        className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 disabled:opacity-50 text-white font-bold py-3 rounded-xl shadow-md"
                    >
                        {downloading ? '🌀 กำลังสร้างรูป...' : '⬇️ ดาวน์โหลด PNG สำหรับ Etsy'}
                    </button>
                    <p className="text-[10px] text-center text-slate-500">ผลลัพธ์: 1680×1680px (3× scale)</p>
                </aside>

                {/* Preview */}
                <section className="flex-1 flex flex-col items-center gap-3">
                    <div className="flex items-center justify-between w-full max-w-[560px]">
                        <h3 className="font-bold text-slate-300 text-sm">Live Preview</h3>
                        <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">1:1 Square</span>
                    </div>

                    <div className="relative w-full max-w-[560px] aspect-square overflow-hidden rounded-2xl shadow-2xl">
                        <div ref={captureRef} className="mockup-canvas absolute inset-0" style={{ backgroundColor: bg }}>
                            {template === 1 ? (
                                <div className="mockup-tmpl1">
                                    <div className="t1-top">
                                        <h2 className="t1-title">{title}</h2>
                                        <p className="t1-sub">{sub}</p>
                                    </div>
                                    <div className="t1-mid">
                                        <div className="t1-img-frame t1-back-left">
                                            <img src={backLeftSrc || PLACEHOLDER} crossOrigin="anonymous" />
                                            <div className="wm-overlay" style={{ opacity: wmOpacity / 100 }}><WmTiles text={brand.toUpperCase()} /></div>
                                        </div>
                                        <div className="t1-img-frame t1-back-right">
                                            <img src={backRightSrc || PLACEHOLDER} crossOrigin="anonymous" />
                                            <div className="wm-overlay" style={{ opacity: wmOpacity / 100 }}><WmTiles text={brand.toUpperCase()} /></div>
                                        </div>
                                        <div className="t1-cover-book">
                                            <div className="t1-cover-header">
                                                <p className="t1-cover-brand">{brand}</p>
                                                <h3 className="t1-cover-title">{coverTitle}</h3>
                                                <p className="t1-cover-sub">{sub}</p>
                                            </div>
                                            <div className="t1-cover-img-wrap">
                                                <img src={coverSrc || PLACEHOLDER} crossOrigin="anonymous" />
                                            </div>
                                            <div className="t1-cover-footer">© {new Date().getFullYear()} {brand}. All rights reserved.</div>
                                        </div>
                                        <div className="t1-badge">
                                            <span>{badge}</span>
                                        </div>
                                    </div>
                                    <div className="t1-bottom-strip">
                                        {[b1, b2, b3, b4].map((src, i) => (
                                            <div key={i} className={`t1-img-frame t1-strip-${i + 1}`}>
                                                <img src={src || PLACEHOLDER} crossOrigin="anonymous" />
                                                <div className="wm-overlay" style={{ opacity: wmOpacity / 100 }}><WmTiles text={brand.toUpperCase()} /></div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="t1-footer">🌸 {brand}</div>
                                </div>
                            ) : (
                                <div className="mockup-tmpl2">
                                    <div className="t2-banner">
                                        <span>🌸</span>
                                        <span className="t2-brand">{brand}</span>
                                        <span className="t2-slash">/</span>
                                        <span className="t2-mid">{midText}</span>
                                        <span>💖</span>
                                        <span className="t2-right">{rightText}</span>
                                    </div>
                                    <div className="t2-grid">
                                        {[g1, g2, g3, g4].map((src, i) => (
                                            <div key={i} className="t1-img-frame t2-cell">
                                                <img src={src || PLACEHOLDER} crossOrigin="anonymous" />
                                                <div className="wm-overlay" style={{ opacity: wmOpacity / 100 }}><WmTiles text={brand.toUpperCase()} /></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>
            </div>

            <style jsx global>{`
                .mockup-canvas, .mockup-canvas * { box-sizing: border-box; font-family: 'Quicksand', sans-serif; }
                .mockup-canvas {
                    background-image: radial-gradient(rgba(255,255,255,0.55) 18%, transparent 18%);
                    background-size: 22px 22px;
                    display: flex;
                    flex-direction: column;
                    padding: 20px;
                }
                .mockup-canvas h2, .mockup-canvas h3, .mockup-canvas .font-cute { font-family: 'Fredoka', sans-serif; }
                .t1-title {
                    font-family: 'Fredoka', sans-serif;
                    font-size: 1.5rem; font-weight: 800; color: #E95B83; text-transform: uppercase;
                    text-align: center; letter-spacing: .02em; line-height: 1.2;
                    text-shadow: -2px -2px 0 #fff, 2px -2px 0 #fff, -2px 2px 0 #fff, 2px 2px 0 #fff, -3px 0 0 #fff, 3px 0 0 #fff, 0 -3px 0 #fff, 0 3px 0 #fff;
                }
                .t1-sub { font-family: 'Fredoka', sans-serif; font-size: 0.7rem; font-weight: 700; color: #5D3F9B; letter-spacing: .15em; text-transform: uppercase; text-align: center; margin-top: 4px; }
                .t1-top { flex-shrink: 0; }
                .t1-mid { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; margin: 8px 0; }
                .t1-img-frame { position: relative; overflow: hidden; background: #fafafa; border: 3px solid #503A2E; border-radius: 12px; box-shadow: 2px 3px 8px rgba(0,0,0,.12); }
                .t1-img-frame img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; object-position: center; display: block; }
                .t1-back-left { position: absolute; width: 42%; aspect-ratio: 1; transform: rotate(-13deg) translate(-52%, -8%); z-index: 1; }
                .t1-back-right { position: absolute; width: 36%; aspect-ratio: 1; transform: rotate(13deg) translate(76%, -14%); z-index: 1; }
                .t1-cover-book {
                    position: relative; width: 52%; aspect-ratio: 1; transform: rotate(-4deg) translateX(-8%); z-index: 2;
                    display: flex; flex-direction: column; background: white; border: 4px solid #503A2E; border-radius: 14px;
                    box-shadow: 4px 6px 16px rgba(0,0,0,.2); overflow: hidden; padding: 8px;
                }
                .t1-cover-header { text-align: center; flex-shrink: 0; }
                .t1-cover-brand { font-family: 'Fredoka', sans-serif; font-size: 9px; font-weight: 700; color: #503A2E; letter-spacing: .15em; text-transform: uppercase; }
                .t1-cover-title { font-family: 'Fredoka', sans-serif; font-size: 0.85rem; font-weight: 800; color: #503A2E; line-height: 1.2; }
                .t1-cover-sub { font-size: 8px; font-weight: 700; color: #5D3F9B; }
                .t1-cover-img-wrap { flex: 1; position: relative; border: 1px dashed #ccc; border-radius: 8px; overflow: hidden; background: #f0f9ff; margin: 4px 0; }
                .t1-cover-img-wrap img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
                .t1-cover-footer { text-align: center; flex-shrink: 0; font-size: 7px; color: #cbd5e1; }
                .t1-badge {
                    position: absolute; width: 88px; height: 88px; border-radius: 50%; background: #E95B83; border: 4px solid white;
                    box-shadow: 0 4px 12px rgba(0,0,0,.2); display: flex; align-items: center; justify-content: center;
                    transform: rotate(8deg) translate(60%, 18%); z-index: 10;
                }
                .t1-badge span { font-family: 'Fredoka', sans-serif; font-weight: 800; color: white; text-align: center; line-height: 1.1; font-size: .95rem; padding: 0 4px; }
                .t1-bottom-strip { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; flex-shrink: 0; }
                .t1-bottom-strip .t1-img-frame { aspect-ratio: 1; }
                .t1-strip-1 { transform: rotate(3deg); }
                .t1-strip-2 { transform: rotate(-5deg) translateY(-3px); }
                .t1-strip-3 { transform: rotate(5deg) translateY(-2px); }
                .t1-strip-4 { transform: rotate(-3deg); }
                .t1-footer { flex-shrink: 0; text-align: center; padding-top: 6px; font-family: 'Fredoka', sans-serif; font-size: .85rem; font-weight: 700; color: #503A2E; }

                .mockup-tmpl2 { display: flex; flex-direction: column; height: 100%; }
                .t2-banner { display: flex; align-items: center; justify-content: center; gap: 10px; padding-bottom: 10px; border-bottom: 2px dashed rgba(80,58,46,.2); flex-shrink: 0; }
                .t2-brand { font-family: 'Fredoka', sans-serif; font-size: 1.1rem; font-weight: 700; color: #503A2E; }
                .t2-slash { color: #E95B83; font-weight: 700; font-size: 1.1rem; }
                .t2-mid, .t2-right { font-family: 'Fredoka', sans-serif; font-size: 1rem; font-weight: 800; color: #E95B83; letter-spacing: .02em; }
                .t2-grid { flex: 1; display: grid; grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr; gap: 12px; margin-top: 12px; }
                .t2-cell { height: 100%; }

                .wm-overlay { position: absolute; inset: 0; display: flex; flex-wrap: wrap; align-items: center; justify-content: center; transform: rotate(15deg); pointer-events: none; overflow: hidden; }
                .wm-overlay span { font-size: 9px; font-weight: 700; color: #333; letter-spacing: .1em; text-transform: uppercase; margin: 4px; }
            `}</style>
        </div>
    )
}

function WmTiles({ text }: { text: string }) {
    return (
        <>
            {Array.from({ length: 12 }).map((_, i) => <span key={i}>{text}</span>)}
        </>
    )
}
