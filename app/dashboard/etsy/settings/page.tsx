'use client'

import React, { useState, useEffect } from 'react'

export default function EtsySettings() {
    const [configs, setConfigs] = useState<any[]>([])
    const [workflows, setWorkflows] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [savingKey, setSavingKey] = useState<string | null>(null)
    const [savingWf, setSavingWf] = useState<string | null>(null)

    // New Workflow Form
    const [newWfName, setNewWfName] = useState('')
    const [newWfJson, setNewWfJson] = useState('')

    useEffect(() => {
        Promise.all([fetchConfigs(), fetchWorkflows()]).finally(() => setLoading(false))
    }, [])

    const fetchConfigs = async () => {
        const res = await fetch('/api/etsy/configs').then(r => r.json())
        if (res.success) setConfigs(res.data)
    }

    const fetchWorkflows = async () => {
        const res = await fetch('/api/etsy/workflows').then(r => r.json())
        if (res.success) setWorkflows(res.data)
    }

    const handleConfigChange = (key: string, value: string) => {
        setConfigs(prev => prev.map(c => c.key_name === key ? { ...c, key_value: value } : c))
    }

    const saveConfig = async (config: any) => {
        setSavingKey(config.key_name)
        try {
            const res = await fetch('/api/etsy/configs', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: config.id, key_value: config.key_value })
            })
            if (res.ok) alert('Saved!')
        } catch (e: any) {
            alert('Error saving config: ' + e.message)
        }
        setSavingKey(null)
    }

    const handleFontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        const formData = new FormData()
        formData.append('file', file)
        formData.append('folder', 'fonts')

        setSavingKey('FONT_UPLOAD')
        try {
            const res = await fetch('/api/etsy/upload-asset', {
                method: 'POST',
                body: formData
            }).then(r => r.json())

            if (res.success) {
                // Find ETSY_FONT_URL config and update it
                const fontConfig = configs.find(c => c.key_name === 'ETSY_FONT_URL')
                if (fontConfig) {
                    handleConfigChange('ETSY_FONT_URL', res.url)
                    // Auto save
                    await fetch('/api/etsy/configs', {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ id: fontConfig.id, key_value: res.url })
                    })
                } else {
                    alert('Uploaded! Please manually update your font URL config if needed: ' + res.url)
                }
                alert('Font Uploaded: ' + res.url)
            } else {
                alert('Upload failed: ' + res.error)
            }
        } catch (err: any) {
            alert('Upload error: ' + err.message)
        }
        setSavingKey(null)
    }

    const createWorkflow = async () => {
        try {
            setSavingWf('NEW')
            const parsed = JSON.parse(newWfJson) // Validate JSON
            const res = await fetch('/api/etsy/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: newWfName,
                    workflow_json: parsed
                })
            }).then(r => r.json())

            if (res.success) {
                setNewWfName('')
                setNewWfJson('')
                fetchWorkflows()
                alert('Workflow added!')
            } else {
                alert('Error: ' + res.error)
            }
        } catch (e: any) {
            alert('Invalid JSON! ' + e.message)
        }
        setSavingWf(null)
    }

    const deleteWorkflow = async (id: string) => {
        if (!confirm('Delete this workflow?')) return
        try {
            await fetch(`/api/etsy/workflows/${id}`, { method: 'DELETE' })
            fetchWorkflows()
        } catch (e) {
            alert('Delete failed')
        }
    }

    if (loading) return <div className="p-8">Loading Etsy Settings...</div>

    return (
        <div className="flex flex-col gap-8 max-w-5xl mx-auto">
            <header>
                <h2 className="text-3xl font-bold">⚙️ Etsy Configuration</h2>
                <p className="text-slate-400 mt-1">Manage PDF Formats, Fonts, Ai Prompts, and ComfyUI Workflows independently.</p>
            </header>

            {/* Global Settings Grid */}
            <div className="grid md:grid-cols-2 gap-8">
                {/* PDF & ComfyUI Layout Settings */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                    <h3 className="text-xl font-bold text-slate-200">📏 Layout & Dimensions</h3>
                    <div className="space-y-4">
                        {configs.filter(c => c.key_name.includes('WIDTH') || c.key_name.includes('HEIGHT') || c.key_name === 'ETSY_FONT_SIZE').map(c => (
                            <div key={c.id}>
                                <label className="text-sm font-bold text-slate-400 mb-1 flex justify-between">
                                    {c.key_name}
                                    <span className="text-xs font-normal text-slate-500">{c.description}</span>
                                </label>
                                <div className="flex gap-2">
                                    <input
                                        type="text"
                                        value={c.key_value || ''}
                                        onChange={e => handleConfigChange(c.key_name, e.target.value)}
                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:border-purple-500 outline-none"
                                    />
                                    <button
                                        onClick={() => saveConfig(c)}
                                        disabled={savingKey === c.key_name}
                                        className="px-4 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold text-sm"
                                    >
                                        {savingKey === c.key_name ? '...' : 'Save'}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Fonts & Assets */}
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                    <h3 className="text-xl font-bold text-slate-200">🔤 Font Upload</h3>
                    <p className="text-sm text-slate-400">Upload a custom `.ttf` or `.otf` font for PDF Generation.</p>

                    <div className="border-2 border-dashed border-slate-700 rounded-xl p-8 text-center hover:border-purple-500 transition-colors">
                        <label className="cursor-pointer">
                            <span className="text-4xl mb-4 block">📤</span>
                            <span className="font-bold text-purple-400">Click to Upload Font</span>
                            <input type="file" accept=".ttf,.otf" className="hidden" onChange={handleFontUpload} />
                        </label>
                        {savingKey === 'FONT_UPLOAD' && <div className="mt-4 text-xs text-amber-500 animate-pulse">Uploading to bucket...</div>}
                    </div>

                    {configs.filter(c => c.key_name === 'ETSY_FONT_URL').map(c => (
                        <div key={c.id}>
                            <label className="text-xs font-bold text-slate-400 mb-1 block">Active Font URL</label>
                            <input
                                type="text"
                                value={c.key_value || ''}
                                onChange={e => handleConfigChange(c.key_name, e.target.value)}
                                onBlur={() => saveConfig(c)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs text-slate-500 focus:border-purple-500 outline-none"
                            />
                        </div>
                    ))}
                </div>
            </div>

            {/* AI Prompts Settings */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <h3 className="text-xl font-bold text-slate-200">🧠 AI Story Prompts (Gemini)</h3>
                <div className="space-y-6">
                    {configs.filter(c => c.key_name === 'ETSY_GEMINI_API_KEY').map(c => (
                        <div key={c.id} className="pb-6 border-b border-slate-800">
                            <label className="text-sm font-bold text-slate-400 mb-2 flex justify-between">
                                Custom Gemini API Key
                                <span className="text-xs font-normal text-slate-500">{c.description || 'Separate API Key for Etsy'}</span>
                            </label>
                            <input
                                type="password"
                                value={c.key_value || ''}
                                onChange={e => handleConfigChange(c.key_name, e.target.value)}
                                className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:border-purple-500 outline-none font-mono tracking-widest text-slate-300"
                                placeholder="AIzaSy..."
                            />
                            <div className="flex justify-end mt-2">
                                <button
                                    onClick={() => saveConfig(c)}
                                    disabled={savingKey === c.key_name}
                                    className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-lg font-bold text-sm shadow-lg shadow-emerald-500/20"
                                >
                                    {savingKey === c.key_name ? 'Saving...' : 'Save API Key'}
                                </button>
                            </div>
                        </div>
                    ))}

                    {configs.filter(c => c.key_name.includes('GEMINI_STORY_PROMPT')).map(c => (
                        <div key={c.id}>
                            <label className="text-sm font-bold text-slate-400 mb-2 flex justify-between">
                                Base Instructions
                                <span className="text-xs font-normal text-slate-500">{c.description}</span>
                            </label>
                            <textarea
                                value={c.key_value || ''}
                                onChange={e => handleConfigChange(c.key_name, e.target.value)}
                                className="w-full h-40 bg-slate-950 border border-slate-700 rounded-lg p-4 text-sm focus:border-purple-500 outline-none font-mono"
                            />
                            <div className="flex justify-end mt-2">
                                <button
                                    onClick={() => saveConfig(c)}
                                    disabled={savingKey === c.key_name}
                                    className="px-6 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-bold text-sm shadow-lg"
                                >
                                    {savingKey === c.key_name ? 'Saving...' : 'Save AI Instructions'}
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ComfyUI Workflows */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
                <div className="flex justify-between items-center">
                    <h3 className="text-xl font-bold text-slate-200">🧩 Coloring Book Workflows (ComfyUI)</h3>
                </div>

                {workflows.length === 0 ? (
                    <div className="text-slate-500 py-4">No line-art workflows configured yet.</div>
                ) : (
                    <div className="grid md:grid-cols-2 gap-4">
                        {workflows.map(wf => (
                            <div key={wf.id} className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col justify-between">
                                <div>
                                    <h4 className="font-bold text-lg">{wf.name}</h4>
                                    <span className="text-xs bg-purple-900/50 text-purple-300 px-2 py-1 rounded inline-block mt-2 font-mono">
                                        ID: {wf.id.split('-')[0]}...
                                    </span>
                                </div>
                                <div className="mt-4 flex justify-end">
                                    <button onClick={() => deleteWorkflow(wf.id)} className="text-rose-500 hover:text-rose-400 text-sm font-bold">
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-8 border-t border-slate-800 pt-6">
                    <h4 className="font-bold mb-4 text-slate-300">Upload New Valid JSON Workflow</h4>
                    <div className="space-y-4">
                        <input
                            type="text"
                            placeholder="Workflow Name (e.g. Coloring Book Lines v1)"
                            value={newWfName}
                            onChange={e => setNewWfName(e.target.value)}
                            className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:border-purple-500 outline-none"
                        />
                        <textarea
                            placeholder="Paste ComfyUI API JSON here..."
                            value={newWfJson}
                            onChange={e => setNewWfJson(e.target.value)}
                            className="w-full h-32 bg-slate-950 border border-slate-700 rounded-lg p-3 text-sm focus:border-purple-500 outline-none font-mono text-slate-500"
                        />
                        <button
                            onClick={createWorkflow}
                            disabled={!newWfName || !newWfJson || savingWf === 'NEW'}
                            className="px-6 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg font-bold text-sm shadow-lg w-full"
                        >
                            {savingWf === 'NEW' ? 'Creating...' : '+ Create Workflow Component'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
