'use client'

import React, { useEffect, useState } from 'react'

interface ConfigItem {
    id: string
    key_name: string
    key_value: string
    description: string
}

export default function GlobalSettingsModal({ onClose, onUpdate }: { onClose: () => void, onUpdate?: () => void }) {
    const [configs, setConfigs] = useState<ConfigItem[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState(false)
    const [testing, setTesting] = useState(false)

    const targetKeys = [
        'PRODUCTION_BATCH_SIZE',
        'PRODUCTION_WIDTH',
        'PRODUCTION_HEIGHT',
        'RUNPOD_API_KEY',
        'PHASE1_SYSTEM_INSTRUCTION',
        'PHASE1_BASE_PROMPT',
        'PRODUCTION_OUTPUT_NODE_ID'
    ]

    useEffect(() => {
        fetchConfigs()
    }, [])

    async function fetchConfigs() {
        setLoading(true)
        try {
            const res = await fetch('/api/configs')
            const json = await res.json()
            if (json.success) {
                const filtered = json.data.filter((c: ConfigItem) => targetKeys.includes(c.key_name))
                setConfigs(filtered)
            }
        } catch (e) {
            console.error('Failed to fetch global settings', e)
        }
        setLoading(false)
    }

    async function handleSave() {
        setSaving(true)
        try {
            for (const config of configs) {
                await fetch('/api/configs', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ id: config.id, key_value: config.key_value })
                })
            }
            alert('Settings saved successfully!')
            if (onUpdate) onUpdate()
            onClose()
        } catch (e) {
            alert('Failed to save settings')
        }
        setSaving(false)
    }

    async function handleTestConn() {
        setTesting(true)
        try {
            const runpodKey = configs.find(c => c.key_name === 'RUNPOD_API_KEY')
            if (!runpodKey) throw new Error('Runpod Key not found')

            const res = await fetch('/api/jobs/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyName: 'RUNPOD_API_KEY' })
            })
            const data = await res.json()
            if (data.success) {
                alert('✅ Connection Successful! Runpod is reachable.')
            } else {
                alert('❌ Connection Failed: ' + data.error)
            }
        } catch (e: any) {
            alert('Error: ' + e.message)
        }
        setTesting(false)
    }

    const updateValue = (key: string, val: string) => {
        setConfigs(prev => prev.map(c => c.key_name === key ? { ...c, key_value: val } : c))
    }

    return (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-md flex items-center justify-center z-[100] p-4">
            <div className="bg-slate-900 border border-slate-700 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95">
                <div className="p-6 border-b border-slate-800 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2">
                            <span className="text-orange-500 text-2xl">⚙️</span> Global Production Settings
                        </h2>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Centralized Controls & Verification</p>
                    </div>
                    <button onClick={onClose} className="p-2 text-slate-400 hover:text-white transition-colors text-2xl leading-none">&times;</button>
                </div>

                <div className="p-6 space-y-6">
                    {loading ? (
                        <div className="space-y-4 py-10">
                            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-slate-800 animate-pulse rounded-xl" />)}
                        </div>
                    ) : (
                        <>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Post Batch Size</label>
                                    <input
                                        type="number"
                                        value={configs.find(c => c.key_name === 'PRODUCTION_BATCH_SIZE')?.key_value || '4'}
                                        onChange={e => updateValue('PRODUCTION_BATCH_SIZE', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-lg font-black text-orange-500 focus:border-orange-500 outline-none transition-all"
                                    />
                                    <p className="text-[10px] text-slate-600 font-medium">Images generated per content item.</p>
                                </div>
                                <div className="space-y-1.5 opacity-50">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Active System</label>
                                    <div className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-400">
                                        COMFYUI + RUNPOD
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-2">
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Output Width</label>
                                    <input
                                        type="number"
                                        value={configs.find(c => c.key_name === 'PRODUCTION_WIDTH')?.key_value || '896'}
                                        onChange={e => updateValue('PRODUCTION_WIDTH', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-200 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Output Height</label>
                                    <input
                                        type="number"
                                        value={configs.find(c => c.key_name === 'PRODUCTION_HEIGHT')?.key_value || '1152'}
                                        onChange={e => updateValue('PRODUCTION_HEIGHT', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-slate-200 focus:border-indigo-500 outline-none transition-all"
                                    />
                                </div>
                            </div>

                            <div className="space-y-4 pt-4 border-t border-slate-800">
                                <label className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
                                    Advanced AI Strategy (NSFW & Logic)
                                </label>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">System Instruction (กฎการคิดเนื้อหา)</label>
                                    <textarea
                                        value={configs.find(c => c.key_name === 'PHASE1_SYSTEM_INSTRUCTION')?.key_value || ''}
                                        onChange={e => updateValue('PHASE1_SYSTEM_INSTRUCTION', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs font-medium text-slate-300 h-24 focus:border-rose-500 outline-none transition-all scrollbar-hide"
                                        placeholder="Add NSFW boosting instructions here..."
                                    />
                                    <p className="text-[10px] text-slate-600 font-medium italic">ควบคุมความ "ถึงใจ" ของ NSFW ได้ที่นี่ครับ</p>
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Base Technical Prompt (กฎพื้นฐานการ Gen รูป)</label>
                                    <textarea
                                        value={configs.find(c => c.key_name === 'PHASE1_BASE_PROMPT')?.key_value || ''}
                                        onChange={e => updateValue('PHASE1_BASE_PROMPT', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-xs font-medium text-slate-300 h-24 focus:border-rose-500 outline-none transition-all scrollbar-hide"
                                    />
                                </div>

                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Output Node ID Mapping (Optional)</label>
                                    <input
                                        type="text"
                                        value={configs.find(c => c.key_name === 'PRODUCTION_OUTPUT_NODE_ID')?.key_value || ''}
                                        onChange={e => updateValue('PRODUCTION_OUTPUT_NODE_ID', e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-sm font-bold text-orange-500 focus:border-orange-500 outline-none transition-all"
                                        placeholder="e.g., 9 (ID of the SaveImage node)"
                                    />
                                    <p className="text-[10px] text-slate-600 font-medium">ระบุ Node ID ของรูปที่ต้องการดึง (ถ้าว่างระบบจะหาอัตโนมัติ)</p>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-800">
                                <label className="text-xs font-black text-slate-400 uppercase tracking-widest mb-2 block">Connection Logic</label>
                                <button
                                    onClick={handleTestConn}
                                    disabled={testing}
                                    className="w-full py-4 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 rounded-2xl font-black text-sm flex items-center justify-center gap-3 transition-all active:scale-[0.98]"
                                >
                                    {testing ? (
                                        <>⌛ VERIFYING API...</>
                                    ) : (
                                        <>🔍 TEST CONNECTION (RUNPOD)</>
                                    )}
                                </button>
                                <p className="text-[10px] text-slate-600 mt-2 text-center uppercase font-bold tracking-tighter italic">Recommended: Test connection before starting Phase 2 generation.</p>
                            </div>
                        </>
                    )}
                </div>

                <div className="p-6 bg-slate-950/50 border-t border-slate-800 flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 py-4 text-slate-400 font-black text-sm hover:text-white transition-colors"
                    >
                        DISCARD
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="flex-[2] py-4 bg-gradient-to-r from-orange-600 to-rose-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-orange-600/20 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50"
                    >
                        {saving ? 'SAVING...' : 'SAVE & APPLY GLOBALLY'}
                    </button>
                </div>
            </div>
        </div>
    )
}
