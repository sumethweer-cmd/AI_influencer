'use client'

import React, { useMemo, useRef, useState } from 'react'

// Reference-picture library for the Content page: browse, filter, upload, rename, delete (only when unused).
export type AssetItem = { id: string; character: string | null; label: string; url: string; uses: number }

export default function AssetsView({
    assets,
    busy,
    onUpload,
    onRename,
    onDelete,
}: {
    assets: AssetItem[]
    busy: boolean
    onUpload: (files: File[], character: string) => void
    onRename: (a: AssetItem, label: string) => void
    onDelete: (a: AssetItem) => void
}) {
    const chars = useMemo(() => Array.from(new Set(assets.map((a) => a.character || 'อื่นๆ'))).sort(), [assets])
    const [filter, setFilter] = useState('ทั้งหมด')
    const [q, setQ] = useState('')
    const [uploadChar, setUploadChar] = useState('momo')
    const [custom, setCustom] = useState('')
    const [editing, setEditing] = useState<string | null>(null)
    const [draft, setDraft] = useState('')
    const fileRef = useRef<HTMLInputElement>(null)

    const list = assets
        .filter((a) => filter === 'ทั้งหมด' || (a.character || 'อื่นๆ') === filter)
        .filter((a) => a.label.toLowerCase().includes(q.toLowerCase()))
    const target = (uploadChar === '__other' ? custom.trim().toLowerCase() : uploadChar) || 'shared'
    const send = (files: FileList | null) => {
        const f = Array.from(files || []).filter((x) => x.type.startsWith('image/'))
        if (f.length) onUpload(f, target)
        if (fileRef.current) fileRef.current.value = ''
    }

    return (
        <div className="assets">
            <div
                className="dropzone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); send(e.dataTransfer.files) }}
            >
                <div className="actions">
                    <label>
                        <span className="sub">เก็บเข้าตัวละคร</span>
                        <select value={uploadChar} onChange={(e) => setUploadChar(e.target.value)}>
                            {Array.from(new Set(['momo', 'anong', ...chars.filter((c) => c !== 'อื่นๆ')])).map((c) => <option key={c} value={c}>{c}</option>)}
                            <option value="__other">อื่นๆ (พิมพ์ชื่อ)</option>
                        </select>
                    </label>
                    {uploadChar === '__other' && <input className="search" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="ชื่อตัวละคร/หมวด" aria-label="ชื่อหมวด" />}
                    <button className="primary" disabled={busy} onClick={() => fileRef.current?.click()}>
                        {busy ? 'กำลังอัปโหลด…' : 'เลือกรูปอัปโหลด'}
                    </button>
                    <span className="sub">หรือลากไฟล์มาวางตรงนี้ (หลายไฟล์ได้)</span>
                    <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => send(e.target.files)} />
                </div>
            </div>

            <div className="toolbar">
                <div className="chips" role="group" aria-label="กรองตามตัวละคร">
                    {['ทั้งหมด', ...chars].map((c) => (
                        <button key={c} className="chip" aria-pressed={filter === c} onClick={() => setFilter(c)}>
                            {c}
                            <small>{c === 'ทั้งหมด' ? assets.length : assets.filter((a) => (a.character || 'อื่นๆ') === c).length}</small>
                        </button>
                    ))}
                </div>
                <input className="search" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="ค้นหาชื่อรูป" aria-label="ค้นหารูป" />
            </div>

            {list.length === 0 ? (
                <div className="empty">ยังไม่มีรูปในหมวดนี้</div>
            ) : (
                <div className="assetgrid">
                    {list.map((a) => (
                        <figure key={a.id} className="asset">
                            <a href={a.url} target="_blank" rel="noreferrer" title="เปิดรูปเต็ม">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={a.url} alt={a.label} loading="lazy" />
                            </a>
                            <figcaption>
                                {editing === a.id ? (
                                    <div className="actions">
                                        <input className="search" value={draft} onChange={(e) => setDraft(e.target.value)} aria-label="ชื่อรูป" />
                                        <button className="primary" disabled={!draft.trim() || busy} onClick={() => { onRename(a, draft.trim()); setEditing(null) }}>บันทึก</button>
                                        <button onClick={() => setEditing(null)}>ยกเลิก</button>
                                    </div>
                                ) : (
                                    <>
                                        <div className="title">{a.label}</div>
                                        <div className="sub">
                                            {a.character || 'อื่นๆ'} · {a.uses ? `ใช้อยู่ใน ${a.uses} เรื่อง` : 'ยังไม่ได้ใช้'}
                                        </div>
                                        <div className="actions">
                                            <button className="link" onClick={() => { setEditing(a.id); setDraft(a.label) }}>เปลี่ยนชื่อ</button>
                                            <button className="link" disabled={busy || a.uses > 0} title={a.uses > 0 ? 'ลบไม่ได้ ยังมีเรื่องที่ใช้รูปนี้อยู่' : 'ลบรูปนี้ออกจากคลัง'} onClick={() => onDelete(a)}>ลบ</button>
                                        </div>
                                    </>
                                )}
                            </figcaption>
                        </figure>
                    ))}
                </div>
            )}
        </div>
    )
}
