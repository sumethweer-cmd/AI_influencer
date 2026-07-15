'use client'

import React, { useState, useEffect, useRef } from 'react'

const getImageUrl = (url: string, width?: number) => {
    if (!url) return '';
    if (url.includes('storage.googleapis.com')) {
        if (url.toLowerCase().endsWith('.webp') || url.toLowerCase().endsWith('.mp4')) return url;
        let targetUrl = url.replace(/\.(png|jpg|jpeg)$/i, '.webp');
        if (width) targetUrl += `?width=${width}`;
        return targetUrl;
    }
    return url;
};

const emptyForm = { name: '', species: '', appearance: '', personality: '', reference_image_url: '' }

export default function CharactersPage() {
    const [characters, setCharacters] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [form, setForm] = useState<any>(emptyForm)
    const [uploadingRef, setUploadingRef] = useState(false)
    const fileRef = useRef<HTMLInputElement>(null)

    useEffect(() => { fetchCharacters() }, [])

    const fetchCharacters = async () => {
        setLoading(true)
        try {
            const res = await fetch('/api/etsy/characters').then(r => r.json())
            if (res.success) setCharacters(res.data)
        } catch (e) {
            console.error(e)
        } finally {
            setLoading(false)
        }
    }

    const startEdit = (c: any) => {
        setEditingId(c.id)
        setForm({
            name: c.name || '',
            species: c.species || '',
            appearance: c.appearance || '',
            personality: c.personality || '',
            reference_image_url: c.reference_image_url || '',
        })
        window.scrollTo({ top: 0, behavior: 'smooth' })
    }

    const cancelEdit = () => {
        setEditingId(null)
        setForm(emptyForm)
    }

    const handleSave = async () => {
        if (!form.name.trim()) { alert('กรุณาใส่ชื่อตัวละคร'); return }
        setSaving(true)
        try {
            if (editingId) {
                const res = await fetch(`/api/etsy/characters/${editingId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form)
                }).then(r => r.json())
                if (!res.success) throw new Error(res.error)
            } else {
                const res = await fetch('/api/etsy/characters', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(form)
                }).then(r => r.json())
                if (!res.success) throw new Error(res.error)
            }
            cancelEdit()
            fetchCharacters()
        } catch (e: any) {
            alert('Error: ' + e.message)
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('ลบตัวละครนี้? หนังสือที่เคยใช้ตัวละครนี้จะไม่กระทบ แต่จะไม่ถูกอ้างอิงอีก')) return
        try {
            await fetch(`/api/etsy/characters/${id}`, { method: 'DELETE' })
            if (editingId === id) cancelEdit()
            fetchCharacters()
        } catch (e) {
            alert('Delete failed')
        }
    }

    const handleUploadRef = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setUploadingRef(true)
        try {
            const formData = new FormData()
            formData.append('file', file)
            formData.append('folder', 'characters')
            const res = await fetch('/api/etsy/upload-asset', { method: 'POST', body: formData }).then(r => r.json())
            if (!res.success) throw new Error(res.error)
            setForm((f: any) => ({ ...f, reference_image_url: res.url }))
        } catch (e: any) {
            alert('Upload Error: ' + e.message)
        } finally {
            setUploadingRef(false)
            if (fileRef.current) fileRef.current.value = ''
        }
    }

    if (loading) return <div className="p-8">Loading Characters...</div>

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto pb-20">
            <header>
                <h2 className="text-3xl font-bold">🧑‍🎨 Character Library</h2>
                <p className="text-slate-400 mt-1">
                    สร้างตัวละครพร้อมคำอธิบายรูปลักษณ์ไว้ล่วงหน้า แล้วเลือกใช้ตอนสร้างเรื่อง — AI จะได้ design ตัวละครให้เหมือนกันทุกหน้า
                </p>
            </header>

            {/* Form */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
                <h3 className="text-lg font-bold text-slate-200">{editingId ? '✏️ แก้ไขตัวละคร' : '➕ เพิ่มตัวละครใหม่'}</h3>

                <div className="grid md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                        <div
                            className="relative w-32 h-32 bg-slate-950 border-2 border-dashed border-slate-600 hover:border-purple-500 rounded-lg overflow-hidden group cursor-pointer shrink-0"
                            onClick={() => fileRef.current?.click()}
                        >
                            {form.reference_image_url ? (
                                <img src={getImageUrl(form.reference_image_url, 300)} alt="Reference" className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 p-2 text-center">
                                    <span className="text-3xl mb-1 opacity-50">🖼️</span>
                                    <span className="text-[10px] font-bold">Reference Image (optional)</span>
                                </div>
                            )}
                            <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="text-white text-xs font-bold">{uploadingRef ? 'Uploading...' : 'Change'}</span>
                            </div>
                            <input type="file" ref={fileRef} className="hidden" accept="image/*" onChange={handleUploadRef} />
                        </div>
                    </div>

                    <div className="md:col-span-1 flex flex-col gap-3">
                        <div>
                            <label className="text-xs font-bold text-slate-400 mb-1 block">ชื่อตัวละคร *</label>
                            <input
                                type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                                placeholder="e.g. Leo the Lion"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm focus:border-purple-500 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-slate-400 mb-1 block">Species / ประเภท</label>
                            <input
                                type="text" value={form.species} onChange={e => setForm({ ...form, species: e.target.value })}
                                placeholder="e.g. Lion cub"
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm focus:border-purple-500 outline-none"
                            />
                        </div>
                    </div>
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-400 mb-1 block">
                        Appearance (รูปลักษณ์) — ใช้ตรงนี้ในทุก image_prompt เพื่อให้หน้าตาเหมือนเดิมทุกหน้า
                    </label>
                    <textarea
                        value={form.appearance} onChange={e => setForm({ ...form, appearance: e.target.value })}
                        placeholder="e.g. a chubby baby lion cub with a fluffy golden mane, big round eyes, small backpack with a star patch"
                        className="w-full h-20 bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm focus:border-purple-500 outline-none"
                    />
                </div>

                <div>
                    <label className="text-xs font-bold text-slate-400 mb-1 block">Personality (นิสัย) — optional</label>
                    <textarea
                        value={form.personality} onChange={e => setForm({ ...form, personality: e.target.value })}
                        placeholder="e.g. curious, brave, a little clumsy but always tries his best"
                        className="w-full h-16 bg-slate-950 border border-slate-700 rounded-lg p-2.5 text-sm focus:border-purple-500 outline-none"
                    />
                </div>

                <div className="flex justify-end gap-2">
                    {editingId && (
                        <button onClick={cancelEdit} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold">
                            Cancel
                        </button>
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm font-bold shadow-lg"
                    >
                        {saving ? 'Saving...' : editingId ? 'บันทึกการแก้ไข' : '+ เพิ่มตัวละคร'}
                    </button>
                </div>
            </div>

            {/* List */}
            <div>
                <h3 className="text-lg font-bold text-slate-200 mb-4">ตัวละครทั้งหมด ({characters.length})</h3>
                {characters.length === 0 ? (
                    <div className="border border-dashed border-slate-700 rounded-2xl p-12 text-center">
                        <span className="text-4xl block mb-4 opacity-70">🧸</span>
                        <p className="text-slate-400">ยังไม่มีตัวละคร — เพิ่มตัวแรกด้านบนได้เลย</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {characters.map(c => (
                            <div key={c.id} className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden flex flex-col">
                                <div className="aspect-square bg-slate-950 flex items-center justify-center">
                                    {c.reference_image_url ? (
                                        <img src={getImageUrl(c.reference_image_url, 400)} alt={c.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-4xl opacity-40">🐾</span>
                                    )}
                                </div>
                                <div className="p-4 flex-1 flex flex-col gap-1">
                                    <h4 className="font-bold text-slate-100">{c.name}</h4>
                                    {c.species && <span className="text-xs text-purple-400 font-bold">{c.species}</span>}
                                    {c.appearance && <p className="text-xs text-slate-400 mt-1 line-clamp-3">{c.appearance}</p>}
                                    <div className="flex justify-end gap-3 mt-auto pt-3">
                                        <button onClick={() => startEdit(c)} className="text-xs font-bold text-purple-400 hover:text-white">Edit</button>
                                        <button onClick={() => handleDelete(c.id)} className="text-xs font-bold text-rose-500 hover:text-rose-400">Delete</button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
