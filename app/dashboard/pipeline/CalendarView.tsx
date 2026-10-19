'use client'

import React, { useMemo, useState } from 'react'

// Month calendar for the Content page (scheduled_date of each content). Styled by the page's scoped `.pl` CSS.
export type CalItem = { id: string; title: string; character: string; date: string | null; label: string; cls: string }

const WEEK = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส']
const pad = (n: number) => String(n).padStart(2, '0')
const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export default function CalendarView({
    items,
    busy,
    onOpen,
    onSetDate,
}: {
    items: CalItem[]
    busy: boolean
    onOpen: (id: string) => void
    onSetDate: (id: string, date: string | null) => void
}) {
    const today = new Date()
    const [cursor, setCursor] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
    const [selected, setSelected] = useState<string>(ymd(today))
    const [pick, setPick] = useState('')

    const byDate = useMemo(() => {
        const m: Record<string, CalItem[]> = {}
        for (const it of items) if (it.date) (m[it.date] = m[it.date] || []).push(it)
        return m
    }, [items])
    const unscheduled = items.filter((i) => !i.date)

    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1)
    const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate()
    const cells: (number | null)[] = [...Array(first.getDay()).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
    const monthLabel = cursor.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' })
    const todayStr = ymd(today)
    const dayItems = byDate[selected] || []

    return (
        <div className="cal">
            <div className="calhead">
                <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} aria-label="เดือนก่อน">←</button>
                <h2>{monthLabel}</h2>
                <button onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} aria-label="เดือนถัดไป">→</button>
                <button onClick={() => { setCursor(new Date(today.getFullYear(), today.getMonth(), 1)); setSelected(todayStr) }}>วันนี้</button>
                <span className="sub">ยังไม่ได้ลงวัน {unscheduled.length} เรื่อง</span>
            </div>

            <div className="calgrid" role="grid" aria-label={monthLabel}>
                {WEEK.map((w) => (
                    <div key={w} className="calwk">{w}</div>
                ))}
                {cells.map((d, i) => {
                    if (d === null) return <div key={`b${i}`} />
                    const ds = `${cursor.getFullYear()}-${pad(cursor.getMonth() + 1)}-${pad(d)}`
                    const list = byDate[ds] || []
                    return (
                        <div
                            key={ds}
                            className={`calday ${ds === selected ? 'sel' : ''} ${ds === todayStr ? 'today' : ''}`}
                            role="gridcell"
                            tabIndex={0}
                            onClick={() => setSelected(ds)}
                            onKeyDown={(e) => e.key === 'Enter' && setSelected(ds)}
                        >
                            <b>{d}</b>
                            {list.slice(0, 3).map((it) => (
                                <button
                                    key={it.id}
                                    className={`calchip t-${it.cls}`}
                                    title={`${it.title} (${it.label})`}
                                    onClick={(e) => { e.stopPropagation(); onOpen(it.id) }}
                                >
                                    {it.title}
                                </button>
                            ))}
                            {list.length > 3 && <small className="sub">+{list.length - 3} เรื่อง</small>}
                        </div>
                    )
                })}
            </div>

            <section className="calside" aria-label={`วันที่ ${selected}`}>
                <h3>
                    {new Date(selected + 'T00:00:00').toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long' })}
                </h3>
                {dayItems.length === 0 && <p className="sub">ยังไม่มีเรื่องที่ลงวันนี้</p>}
                {dayItems.map((it) => (
                    <div key={it.id} className="calitem">
                        <div>
                            <div className="title">{it.title}</div>
                            <div className="sub">{it.character} · <span className={`tag t-${it.cls}`}>{it.label}</span></div>
                        </div>
                        <div className="actions">
                            <button onClick={() => onOpen(it.id)}>เปิด</button>
                            <button disabled={busy} onClick={() => onSetDate(it.id, null)}>เอาออกจากวัน</button>
                        </div>
                    </div>
                ))}
                <div className="calpick">
                    <label>
                        <span className="sub">เพิ่มเรื่องที่ยังไม่ลงวันเข้าวันนี้</span>
                        <select value={pick} onChange={(e) => setPick(e.target.value)}>
                            <option value="">— เลือกเรื่อง —</option>
                            {unscheduled.map((it) => (
                                <option key={it.id} value={it.id}>{it.character} · {it.title}</option>
                            ))}
                        </select>
                    </label>
                    <button className="primary" disabled={!pick || busy} onClick={() => { onSetDate(pick, selected); setPick('') }}>ลงวันนี้</button>
                </div>
            </section>
        </div>
    )
}
