'use client'

import React, { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface ConfigItem {
    id: string
    key_name: string
    key_value: string
    description: string
    is_secret: boolean
    is_valid: boolean
}

export default function SettingsPage() {
    const [configs, setConfigs] = useState<ConfigItem[]>([])
    const [loading, setLoading] = useState(true)
    const [saving, setSaving] = useState<string | null>(null)

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

    return (
        <div className="space-y-8">
            <header>
                <h2 className="text-3xl font-bold">API Configuration</h2>
                <p className="text-slate-400 mt-1">Manage your keys and system connections.</p>
            </header>

            <div className="grid grid-cols-1 gap-6">
                {loading ? (
                    <div className="space-y-4">
                        {[1, 2, 3].map(i => (
                            <div key={i} className="h-32 bg-slate-800 animate-pulse rounded-xl border border-slate-700" />
                        ))}
                    </div>
                ) : (
                    configs.map(config => (
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

                            {/* Guide Link Placeholder */}
                            <div className="pt-2">
                                <a href="#" className="text-xs text-orange-500/70 hover:text-orange-400 underline decoration-slate-600">
                                    Manual: How to get this key?
                                </a>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
