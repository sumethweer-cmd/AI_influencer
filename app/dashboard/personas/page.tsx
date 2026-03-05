'use client'

import React, { useEffect, useState } from 'react'

interface Persona {
    id: string
    name: string
    display_name: string
    trigger_word: string
    lora_triggers: string
    role_prompt: string
    persona_rules: string
    sfw_critical: string
    nsfw_critical: string
    system_prompt: string
    instruction_rule: string
    default_workflow_id?: string | null
}

export interface ComfyUIWorkflow {
    id: string
    name: string
}

const SECTION_META = [
    {
        key: 'role_prompt' as keyof Persona,
        label: '① ROLE',
        emoji: '🎭',
        color: 'border-indigo-500/50 focus:border-indigo-400',
        badge: 'bg-indigo-900/40 text-indigo-300',
        desc: 'บทบาทของ AI — Creative Director, Marketing Director ฯลฯ จะกำหนด "มุมคิด" ของ output',
        rows: 5,
    },
    {
        key: 'persona_rules' as keyof Persona,
        label: '② PERSONA DNA & RULES',
        emoji: '🧬',
        color: 'border-orange-500/50 focus:border-orange-400',
        badge: 'bg-orange-900/40 text-orange-300',
        desc: 'ลักษณะตัวตน, ไลฟ์สไตล์, แนวแต่งตัว, character DNA ทั้งหมด',
        rows: 10,
    },
    {
        key: 'sfw_critical' as keyof Persona,
        label: '③ CRITICAL — SFW Standards',
        emoji: '😇',
        color: 'border-emerald-500/50 focus:border-emerald-400',
        badge: 'bg-emerald-900/40 text-emerald-300',
        desc: 'คุณภาพรูป, สไตล์กล้อง, ข้อกำหนด SFW (iPhone quality, no studio lighting ฯลฯ)',
        rows: 8,
    },
    {
        key: 'nsfw_critical' as keyof Persona,
        label: '④ CRITICAL — NSFW Standards',
        emoji: '🔞',
        color: 'border-rose-500/50 focus:border-rose-400',
        badge: 'bg-rose-900/40 text-rose-300',
        desc: 'ระดับความ explicit, กฎสถานที่ (public vs private), ข้อห้าม',
        rows: 8,
    },
    {
        key: 'lora_triggers' as keyof Persona,
        label: '⑤ LoRA Trigger Library',
        emoji: '🎯',
        color: 'border-yellow-500/50 focus:border-yellow-400',
        badge: 'bg-yellow-900/40 text-yellow-300',
        desc: 'คำ trigger พิเศษของ LoRA model — คั่นด้วย comma (e.g. "taking a mirror selfie, lying on bed")',
        rows: 3,
    },
]

export default function PersonasPage() {
    const [personas, setPersonas] = useState<Persona[]>([])
    const [selected, setSelected] = useState<Persona | null>(null)
    const [form, setForm] = useState<Partial<Persona>>({})
    const [saving, setSaving] = useState(false)
    const [saved, setSaved] = useState(false)
    const [loading, setLoading] = useState(true)
    const [workflows, setWorkflows] = useState<ComfyUIWorkflow[]>([])

    useEffect(() => {
        fetchPersonas()
        fetchWorkflows()
    }, [])

    async function fetchWorkflows() {
        try {
            const res = await fetch('/api/workflows')
            const json = await res.json()
            if (json.success) {
                setWorkflows(json.data)
            }
        } catch (e) {
            console.error('Failed to fetch workflows', e)
        }
    }

    async function fetchPersonas() {
        setLoading(true)
        try {
            const res = await fetch('/api/personas')
            const json = await res.json()
            if (json.success) {
                setPersonas(json.data)
                if (json.data.length > 0) selectPersona(json.data[0])
            }
        } catch (e) {
            console.error(e)
        }
        setLoading(false)
    }

    function selectPersona(p: Persona) {
        setSelected(p)
        setForm({ ...p })
        setSaved(false)
    }

    function handleChange(key: keyof Persona, value: string) {
        setForm(prev => ({ ...prev, [key]: value }))
        setSaved(false)
    }

    async function handleSave() {
        if (!selected) return
        setSaving(true)
        try {
            const res = await fetch('/api/personas', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: selected.id, ...form })
            })
            const json = await res.json()
            if (json.success) {
                setSaved(true)
                setPersonas(prev => prev.map(p => p.id === selected.id ? { ...p, ...form } as Persona : p))
                setSelected(prev => prev ? { ...prev, ...form } as Persona : null)
            } else {
                alert(`❌ Save failed: ${json.error}`)
            }
        } catch (e) {
            alert('❌ Network error')
        }
        setSaving(false)
    }

    function resetToDefault() {
        if (!selected) return
        setForm(prev => ({ ...prev, ...selected }))
        setSaved(false)
    }

    return (
        <div className="flex h-full min-h-screen bg-slate-950 text-white">
            {/* Sidebar — Persona selector */}
            <div className="w-56 shrink-0 border-r border-slate-800 p-4 space-y-2 bg-slate-900/50">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-4">Personas</h3>
                {loading ? (
                    <div className="space-y-2">
                        {[1, 2].map(i => <div key={i} className="h-16 bg-slate-800 animate-pulse rounded-xl" />)}
                    </div>
                ) : (
                    personas.map(p => (
                        <button
                            key={p.id}
                            onClick={() => selectPersona(p)}
                            className={`w-full text-left p-3 rounded-xl border transition-all ${selected?.id === p.id
                                ? 'bg-indigo-600/20 border-indigo-500 text-white'
                                : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'
                                }`}
                        >
                            <div className="font-bold text-sm">{p.display_name || p.name}</div>
                            <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{p.trigger_word || p.name}</div>
                        </button>
                    ))
                )}
            </div>

            {/* Main editor */}
            <div className="flex-1 overflow-y-auto">
                {!selected ? (
                    <div className="flex items-center justify-center h-full text-slate-600">
                        <span>Select a persona ←</span>
                    </div>
                ) : (
                    <div className="p-8 space-y-6 max-w-4xl mx-auto">
                        {/* Header */}
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-black">{selected.display_name || selected.name}</h1>
                                <p className="text-slate-400 text-sm mt-1">
                                    Prompt ที่แก้ที่นี่จะถูกส่งให้ Gemini ตอน Phase 1 Planning ทันที — ComfyUI final prompt ไม่เปลี่ยน
                                </p>
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={resetToDefault}
                                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-sm font-bold border border-slate-700 transition-all"
                                >
                                    ↩ Reset
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className={`px-6 py-2 font-bold rounded-lg text-sm transition-all shadow-lg ${saved
                                        ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                                        : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                                        } disabled:opacity-50`}
                                >
                                    {saving ? '⏳ Saving...' : saved ? '✅ Saved!' : '💾 Save Changes'}
                                </button>
                            </div>
                        </div>

                        {/* How it works */}
                        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 text-[11px] text-slate-400 space-y-1">
                            <p className="font-bold text-slate-300 text-xs mb-2">📐 Full Prompt ที่ส่งให้ Gemini = </p>
                            <p><span className="text-indigo-400 font-mono">[① ROLE]</span> + <span className="text-orange-400 font-mono">[② PERSONA DNA]</span> + <span className="text-yellow-400 font-mono">[LoRA Triggers]</span> + <span className="text-slate-400 font-mono">[Technical Guide from system_configs]</span> + <span className="text-emerald-400 font-mono">[③ SFW Critical]</span> + <span className="text-rose-400 font-mono">[④ NSFW Critical]</span></p>
                            <p className="pt-1 text-slate-500">→ Gemini สร้าง <code className="text-white bg-slate-800 px-1 rounded">prompt_structure JSON</code> ออกมา → ส่งต่อให้ ComfyUI ตาม pipeline เดิม</p>
                        </div>

                        {/* Prompt sections */}
                        {SECTION_META.map(section => (
                            <div key={section.key} className={`bg-slate-900 border ${selected?.id === selected?.id ? section.color.split(' ')[0] : 'border-slate-800'} rounded-xl overflow-hidden`}>
                                <div className="px-4 py-3 bg-slate-800/50 border-b border-slate-700/50 flex items-center gap-3">
                                    <span className="text-lg">{section.emoji}</span>
                                    <div className="flex-1">
                                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${section.badge}`}>{section.label}</span>
                                        <p className="text-[11px] text-slate-500 mt-0.5">{section.desc}</p>
                                    </div>
                                    {(form[section.key] as string) !== (selected[section.key] as string) && (
                                        <span className="text-[9px] font-bold text-amber-400 bg-amber-900/20 px-2 py-0.5 rounded-full border border-amber-700/30">UNSAVED</span>
                                    )}
                                </div>
                                <textarea
                                    className={`w-full bg-transparent p-4 text-sm text-slate-200 font-mono resize-y outline-none ${section.color} focus:bg-slate-800/30 transition-colors`}
                                    rows={section.rows}
                                    value={(form[section.key] as string) || ''}
                                    onChange={e => handleChange(section.key, e.target.value)}
                                    placeholder={`Enter ${section.label}...`}
                                />
                            </div>
                        ))}

                        {/* Legacy fields (collapsed) */}
                        <details className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden">
                            <summary className="px-4 py-3 cursor-pointer text-sm text-slate-500 hover:text-slate-300 font-bold select-none">
                                🗃️ Legacy Fields (system_prompt & instruction_rule) — ใช้เป็น fallback ถ้า sections ด้านบนว่าง
                            </summary>
                            <div className="p-4 space-y-4 border-t border-slate-800">
                                <div>
                                    <label className="text-xs text-slate-500 font-bold uppercase tracking-widest block mb-2">system_prompt (Legacy)</label>
                                    <textarea
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 font-mono resize-y outline-none focus:border-slate-500"
                                        rows={6}
                                        value={(form.system_prompt as string) || ''}
                                        onChange={e => handleChange('system_prompt', e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 font-bold uppercase tracking-widest block mb-2">instruction_rule (Legacy)</label>
                                    <textarea
                                        className="w-full bg-slate-800 border border-slate-700 rounded-lg p-3 text-xs text-slate-300 font-mono resize-y outline-none focus:border-slate-500"
                                        rows={4}
                                        value={(form.instruction_rule as string) || ''}
                                        onChange={e => handleChange('instruction_rule', e.target.value)}
                                    />
                                </div>
                            </div>
                        </details>

                        {/* Default Workflow Config */}
                        <div className="bg-slate-900 border border-indigo-500/30 rounded-xl p-6">
                            <label className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2 mb-4">
                                ⚙️ Default ComfyUI Workflow
                            </label>
                            <p className="text-xs text-slate-500 mb-4 block">
                                เลือก Workflow เบื้องต้นที่จะนำไปใช้เสมอ เมื่อสั่งสุ่มจาก Persona นี้ หากผู้ใช้ไม่ได้คลิกเลือกอันไหนเป็นพิเศษในหน้าคิวสร้างภาพ
                            </p>
                            <div className="relative">
                                <select
                                    value={form.default_workflow_id || ''}
                                    onChange={(e) => handleChange('default_workflow_id', e.target.value)}
                                    className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 pr-10 text-sm font-bold text-slate-200 focus:border-indigo-500 outline-none appearance-none cursor-pointer"
                                >
                                    <option value="" className="text-slate-500">⚡ (Automatic) เลือก Workflow ล่าสุดในระบบอัตโนมัติ</option>
                                    {workflows.map(wf => (
                                        <option key={wf.id} value={wf.id}>
                                            {wf.name}
                                        </option>
                                    ))}
                                </select>
                                <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-slate-500">
                                    ▼
                                </div>
                            </div>
                        </div>

                        {/* Bottom save */}
                        <div className="flex justify-end pb-8">
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className={`px-8 py-3 font-black rounded-xl text-sm transition-all shadow-xl ${saved
                                    ? 'bg-emerald-600 text-white shadow-emerald-600/30'
                                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-600/30'
                                    } disabled:opacity-50`}
                            >
                                {saving ? '⏳ Saving...' : saved ? '✅ All Changes Saved!' : '💾 Save All Changes'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}
