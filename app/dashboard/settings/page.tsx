'use client'

import React, { useEffect, useState } from 'react'

interface ConfigItem {
    id: string
    key_name: string
    key_value: string
    description: string
    is_secret: boolean
    is_valid: boolean
}

const PROMPT_KEYS = [
    'PHASE1_BASE_PROMPT',
    'PHASE1_SYSTEM_INSTRUCTION',
    'VDO_PROMPT_STYLE_SFW',
    'VDO_PROMPT_STYLE_NSFW'
]

const S3_KEYS = [
    'RUNPOD_S3_ENDPOINT',
    'RUNPOD_S3_BUCKET',
    'RUNPOD_S3_ACCESS_KEY',
    'RUNPOD_S3_SECRET_KEY'
]

export default function SettingsPage() {
    const [configs, setConfigs] = useState<ConfigItem[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)
    const [activeTab, setActiveTab] = useState<'api' | 'prompts' | 's3'>('api')

    useEffect(() => {
        fetchConfigs()
    }, [])

    async function fetchConfigs() {
        setLoading(true)
        try {
            const res = await fetch('/api/configs')
            const json = await res.json()
            if (json.success && json.data) {
                setConfigs(json.data)
            } else {
                console.error('Failed to fetch configs:', json.error)
            }
        } catch (err) {
            console.error(err)
        }
        setLoading(false)
    }

    async function handleUpdate(config: ConfigItem, newValue: string) {
        setSaving(config.id)
        try {
            const res = await fetch('/api/configs', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: config.id, key_value: newValue })
            })
            const json = await res.json()
            if (json.success) {
                setConfigs(prev => prev.map(c => c.id === config.id ? { ...c, key_value: newValue, is_valid: false } : c))
            }
        } catch (err) {
            console.error(err)
        }
        setSaving(null)
    }

    async function handlePromptSave(config: ConfigItem, newValue: string) {
        setSaving(config.id)
        try {
            const res = await fetch('/api/configs', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: config.id, key_value: newValue })
            })
            const json = await res.json()
            if (json.success) {
                setConfigs(prev => prev.map(c => c.id === config.id ? { ...c, key_value: newValue } : c))
                alert('✅ Saved!')
            }
        } catch (err) {
            console.error(err)
        }
        setSaving(null)
    }

    async function testConnection(config: ConfigItem) {
        setSaving(config.id + '-test')
        try {
            const res = await fetch('/api/jobs/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ keyName: config.key_name })
            })
            const data = await res.json()
            if (data.success) {
                setConfigs(prev => prev.map(c => c.id === config.id ? { ...c, is_valid: true } : c))
            } else {
                alert(`Verification failed: ${data.error}`)
            }
        } catch (err) {
            alert('Network error during verification')
        } finally {
            setSaving(null)
        }
    }

    const apiConfigs = configs.filter(c => !PROMPT_KEYS.includes(c.key_name) && !S3_KEYS.includes(c.key_name))
    const promptConfigs = configs.filter(c => PROMPT_KEYS.includes(c.key_name))
    const s3Configs = configs.filter(c => S3_KEYS.includes(c.key_name))

    // State for prompt textarea editing
    const [promptValues, setPromptValues] = useState<Record<string, string>>({})
    useEffect(() => {
        const vals: Record<string, string> = {}
        promptConfigs.forEach(c => { vals[c.id] = c.key_value })
        setPromptValues(vals)
    }, [configs])

    return (
        <div className="space-y-8">
            <header>
                <h2 className="text-3xl font-bold">System Configuration</h2>
                <p className="text-slate-400 mt-1">Manage API keys, AI prompt instructions, and system connections.</p>
            </header>

            {/* Tabs */}
            <div className="flex gap-2 border-b border-slate-800">
                <button
                    onClick={() => setActiveTab('api')}
                    className={`pb-3 px-4 text-sm font-bold transition-colors border-b-2 -mb-px ${activeTab === 'api' ? 'text-orange-400 border-orange-500' : 'text-slate-500 border-transparent hover:text-white'}`}
                >
                    ⚙️ API Keys & Config
                </button>
                <button
                    onClick={() => setActiveTab('s3')}
                    className={`pb-3 px-4 text-sm font-bold transition-colors border-b-2 -mb-px ${activeTab === 's3' ? 'text-purple-400 border-purple-500' : 'text-slate-500 border-transparent hover:text-white'}`}
                >
                    🗄️ RunPod Network Volume (S3)
                </button>
                <button
                    onClick={() => setActiveTab('prompts')}
                    className={`pb-3 px-4 text-sm font-bold transition-colors border-b-2 -mb-px ${activeTab === 'prompts' ? 'text-orange-400 border-orange-500' : 'text-slate-500 border-transparent hover:text-white'}`}
                >
                    ✍️ System Prompts
                </button>
            </div>

            {/* API Config Tab */}
            {activeTab === 'api' && (
                <div className="grid grid-cols-1 gap-6">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-32 bg-slate-800 animate-pulse rounded-xl border border-slate-700" />
                            ))}
                        </div>
                    ) : (
                        apiConfigs.map(config => (
                            <div key={config.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4 shadow-lg group hover:border-slate-500 transition-all">
                                <div className="flex items-start justify-between">
                                    <div className="space-y-1">
                                        <h3 className="font-mono text-orange-400 font-bold">{config.key_name}</h3>
                                        <p className="text-sm text-slate-400">{config.description}</p>
                                    </div>
                                    <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tighter ${config.is_valid ? 'bg-emerald-900 text-emerald-300' : 'bg-rose-900 text-rose-300'}`}>
                                        {config.is_valid ? 'Verified' : 'Unverified'}
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row gap-3">
                                    {config.key_name.trim().toUpperCase() === 'GEMINI_MODEL_NAME' ? (
                                        <select
                                            value={config.key_value}
                                            onChange={(e) => handleUpdate(config, e.target.value)}
                                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm font-mono focus:border-orange-500 outline-none transition-colors"
                                        >
                                            <option value="gemini-2.5-flash">Gemini 2.5 Flash</option>
                                            <option value="gemini-3-flash-preview">Gemini 3 Flash Preview</option>
                                        </select>
                                    ) : (
                                        <input
                                            type={config.is_secret ? "password" : "text"}
                                            defaultValue={config.key_value}
                                            onBlur={(e) => {
                                                if (e.target.value !== config.key_value) handleUpdate(config, e.target.value)
                                            }}
                                            placeholder={`Enter ${config.key_name}...`}
                                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm font-mono focus:border-orange-500 outline-none transition-colors"
                                        />
                                    )}
                                    <button
                                        onClick={() => testConnection(config)}
                                        disabled={saving === config.id || saving === config.id + '-test' || !config.key_value}
                                        className="px-6 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-sm font-bold rounded-lg transition-colors border border-slate-600"
                                    >
                                        {saving === config.id + '-test' ? 'Testing...' : 'Test Connection'}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* System Prompts Tab */}
            {activeTab === 'prompts' && (
                <div className="space-y-6">
                    <div className="bg-slate-900/70 border border-indigo-500/30 rounded-xl p-4 text-sm text-indigo-300">
                        <span className="font-bold text-indigo-400">✍️ System Prompts</span> — These are the instructions sent to Gemini AI that control how it generates content and video motion prompts. Edit carefully.
                    </div>

                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2].map(i => (
                                <div key={i} className="h-48 bg-slate-800 animate-pulse rounded-xl border border-slate-700" />
                            ))}
                        </div>
                    ) : promptConfigs.length === 0 ? (
                        <div className="bg-slate-800/50 rounded-xl p-8 text-center border border-dashed border-slate-700">
                            <p className="text-slate-400 text-sm">No system prompt configs found in database yet.</p>
                            <p className="text-slate-500 text-xs mt-2">These are auto-created on first AI job run, or you can add them via Supabase → configs table.</p>
                        </div>
                    ) : (
                        promptConfigs.map(config => (
                            <div key={config.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 space-y-4 shadow-lg">
                                <div>
                                    <h3 className="font-mono text-orange-400 font-bold text-sm">{config.key_name}</h3>
                                    <p className="text-xs text-slate-500 mt-1">
                                        {config.key_name === 'PHASE1_BASE_PROMPT' && 'Technical instructions for ComfyUI photo quality, realism, and style rules.'}
                                        {config.key_name === 'PHASE1_SYSTEM_INSTRUCTION' && 'High-level instruction added to every Phase 1 content planning prompt.'}
                                        {config.key_name === 'VDO_PROMPT_STYLE_SFW' && '✨ AI instruction for splitting SFW base video prompt into 3 × 5s cinematic parts.'}
                                        {config.key_name === 'VDO_PROMPT_STYLE_NSFW' && '🔞 AI instruction for splitting NSFW base video prompt into 3 × 5s explicit cinematic parts.'}
                                    </p>
                                </div>
                                <textarea
                                    className="w-full bg-black/40 border border-slate-700 rounded-lg p-3 text-sm text-slate-300 focus:border-orange-500 outline-none resize-y min-h-[120px] font-mono"
                                    value={promptValues[config.id] ?? config.key_value}
                                    onChange={(e) => setPromptValues(prev => ({ ...prev, [config.id]: e.target.value }))}
                                    placeholder={`Enter ${config.key_name}...`}
                                />
                                <div className="flex justify-end">
                                    <button
                                        onClick={() => handlePromptSave(config, promptValues[config.id] ?? config.key_value)}
                                        disabled={saving === config.id}
                                        className="px-6 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-sm font-bold rounded-lg transition-colors"
                                    >
                                        {saving === config.id ? 'Saving...' : '💾 Save Prompt'}
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
            {/* RunPod S3 Tab */}
            {activeTab === 's3' && (
                <div className="space-y-6">
                    <div className="bg-purple-950/30 border border-purple-500/30 rounded-xl p-4 text-sm text-purple-300">
                        <span className="font-bold text-purple-400">🗄️ RunPod Network Volume (S3 API)</span> — ใส่ credentials เพื่อให้ระบบดึงต้นฉบับ PNG จาก Network Volume โดยตรงโดยไม่ต้อง start Pod
                        <br /><span className="text-purple-400/60 text-xs mt-1 block">พบ credentials ได้ที่ RunPod Dashboard → Storage → Network Volumes → Manage → S3 API Access</span>
                    </div>

                    {loading ? (
                        <div className="space-y-4">{[1, 2, 3, 4].map(i => <div key={i} className="h-20 bg-slate-800 animate-pulse rounded-xl border border-slate-700" />)}</div>
                    ) : (
                        <div className="grid md:grid-cols-2 gap-4">
                            {[
                                { key: 'RUNPOD_S3_ENDPOINT', label: 'Endpoint URL', hint: 'เช่น https://s3api-eu-ro-1.runpod.io', secret: false },
                                { key: 'RUNPOD_S3_BUCKET', label: 'Bucket Name (Volume ID)', hint: 'เช่น gyufs9gfkl', secret: false },
                                { key: 'RUNPOD_S3_ACCESS_KEY', label: 'Access Key ID', hint: 'จาก RunPod → API Keys', secret: true },
                                { key: 'RUNPOD_S3_SECRET_KEY', label: 'Secret Access Key', hint: 'จาก RunPod → API Keys', secret: true },
                            ].map(({ key, label, hint, secret }) => {
                                const cfg = s3Configs.find(c => c.key_name === key)
                                return (
                                    <div key={key} className="bg-slate-800 p-5 rounded-xl border border-slate-700 space-y-3">
                                        <div>
                                            <h3 className="font-mono text-purple-400 font-bold text-sm">{label}</h3>
                                            <p className="text-xs text-slate-500 mt-0.5">{hint}</p>
                                        </div>
                                        {cfg ? (
                                            <input
                                                type={secret ? 'password' : 'text'}
                                                defaultValue={cfg.key_value}
                                                onBlur={(e) => { if (e.target.value !== cfg.key_value) handleUpdate(cfg, e.target.value) }}
                                                placeholder={`Enter ${label}...`}
                                                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-4 py-2 text-sm font-mono focus:border-purple-500 outline-none transition-colors"
                                            />
                                        ) : (
                                            <p className="text-xs text-amber-400 bg-amber-950/30 border border-amber-800/30 rounded-lg px-3 py-2">
                                                ⚠️ Config key <span className="font-mono">{key}</span> ยังไม่มีใน DB — รัน SQL ด้านล่างก่อน
                                            </p>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    )}

                    <div className="bg-slate-900 border border-slate-700 rounded-xl p-5 space-y-2">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">SQL to create these config entries (run once in Supabase)</h4>
                        <pre className="text-xs text-emerald-400 bg-black/40 rounded-lg p-4 overflow-x-auto font-mono leading-relaxed">{`INSERT INTO configs (key_name, key_value, description, is_secret) VALUES
('RUNPOD_S3_ENDPOINT', '', 'RunPod Network Volume S3 Endpoint URL', true),
('RUNPOD_S3_BUCKET',   '', 'RunPod Network Volume Bucket/Volume ID', false),
('RUNPOD_S3_ACCESS_KEY', '', 'RunPod S3 Access Key ID', true),
('RUNPOD_S3_SECRET_KEY', '', 'RunPod S3 Secret Access Key', true)
ON CONFLICT (key_name) DO NOTHING;`}</pre>
                    </div>
                </div>
            )}

        </div>
    )
}
