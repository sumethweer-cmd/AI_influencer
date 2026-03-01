'use client'

import { useState, useEffect } from 'react'
import axios from 'axios'

export default function PromptManager() {
    const [workflows, setWorkflows] = useState<any[]>([])
    const [personas, setPersonas] = useState<any[]>([])
    const [configs, setConfigs] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const [savingId, setSavingId] = useState<string | null>(null)
    const [savingPersonaId, setSavingPersonaId] = useState<string | null>(null)
    const [savingConfigKey, setSavingConfigKey] = useState<string | null>(null)
    const [error, setError] = useState('')

    useEffect(() => {
        Promise.all([fetchWorkflows(), fetchPersonas(), fetchConfigs()]).finally(() => setLoading(false))
    }, [])

    const fetchConfigs = async () => {
        try {
            const res = await axios.get('/api/configs')
            if (res.data.success) {
                setConfigs(res.data.data)
            }
        } catch (e: any) {
            setError(e.message)
        }
    }

    const fetchWorkflows = async () => {
        try {
            const res = await axios.get('/api/workflows')
            if (res.data.success) {
                setWorkflows(res.data.data)
            }
        } catch (e: any) {
            setError(e.message)
        }
    }

    const fetchPersonas = async () => {
        try {
            const res = await axios.get('/api/personas')
            if (res.data.success) {
                setPersonas(res.data.data)
            }
        } catch (e: any) {
            setError(e.message)
        }
    }

    const handleSave = async (id: string) => {
        setSavingId(id)
        const wf = workflows.find(w => w.id === id)
        if (!wf) return

        try {
            await axios.put(`/api/workflows/${id}`, {
                base_positive_prompt: wf.base_positive_prompt,
                base_negative_prompt: wf.base_negative_prompt,
                negative_prompt_node_id: wf.negative_prompt_node_id
            })
            alert('บันทึกสำเร็จ (Saved Successfully)')
        } catch (e: any) {
            alert('Error saving: ' + e.message)
        } finally {
            setSavingId(null)
        }
    }

    const handleSavePersona = async (id: string) => {
        setSavingPersonaId(id)
        const p = personas.find(x => x.id === id)
        if (!p) return

        try {
            await axios.put(`/api/personas/${id}`, {
                name: p.name,
                display_name: p.display_name,
                system_prompt: p.system_prompt,
                trigger_word: p.trigger_word,
                instruction_rule: p.instruction_rule,
                lora_triggers: p.lora_triggers
            })
            alert('บันทึก System Prompt สำเร็จ (Saved Successfully)')
        } catch (e: any) {
            alert('Error saving persona: ' + e.message)
        } finally {
            setSavingPersonaId(null)
        }
    }

    const handleSaveConfig = async (key: string) => {
        setSavingConfigKey(key)
        const cfg = configs.find(c => c.key_name === key)
        if (!cfg) return

        try {
            await axios.put('/api/configs', {
                id: cfg.id,
                key_value: cfg.key_value
            })
            alert('บันทึก Base Prompt สำเร็จ (Saved Successfully)')
        } catch (e: any) {
            alert('Error saving config: ' + e.message)
        } finally {
            setSavingConfigKey(null)
        }
    }

    const handleChange = (id: string, field: string, value: string) => {
        setWorkflows(workflows.map(wf => wf.id === id ? { ...wf, [field]: value } : wf))
    }

    const handlePersonaChange = (id: string, field: string, value: string) => {
        setPersonas(personas.map(p => p.id === id ? { ...p, [field]: value } : p))
    }

    const handleConfigChange = (key: string, value: string) => {
        setConfigs(configs.map(c => c.key_name === key ? { ...c, key_value: value } : c))
    }

    const basePromptConfig = configs.find(c => c.key_name === 'PHASE1_BASE_PROMPT')
    const sysInstructionConfig = configs.find(c => c.key_name === 'PHASE1_SYSTEM_INSTRUCTION')
    const jsonSchemaConfig = configs.find(c => c.key_name === 'PHASE1_JSON_SCHEMA')

    const handleSaveCriticalConfig = (key: string, label: string) => {
        const confirmed = window.confirm(`⚠️ WARNING: You are about to save changes to [${label}].\n\nEditing this structure may break the automated generation pipeline if the instructions or JSON keys are invalid.\n\nAre you sure you want to save?`)
        if (confirmed) {
            handleSaveConfig(key)
        }
    }

    return (
        <div className="p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">🎨 Template Studio (Prompt Manager)</h1>
            </div>

            <p className="text-slate-400">Manage the base prompts attached to every image generation and edit the AI System Prompts used in Phase 1.</p>

            {error && <div className="text-red-500 bg-red-950/50 p-4 rounded-md">{error}</div>}

            {loading ? (
                <div>Loading...</div>
            ) : (
                <div className="space-y-12">

                    {/* BASE PROMPT SECTION */}
                    {basePromptConfig && (
                        <div className="space-y-6">
                            <div className="border-b border-slate-800 pb-2 flex items-center gap-3">
                                <span className="text-3xl">📜</span>
                                <div>
                                    <h2 className="text-2xl font-bold text-slate-200">Phase 1: Base Instruction (คำสั่งหลัก)</h2>
                                    <p className="text-slate-400 text-sm mt-1">
                                        นี่คือ "พิมพ์เขียว" และ "คำสั่งพื้นฐาน" ที่ AI ทุกตัวจะใช้ร่วมกัน (เช่น รูปแบบ JSON, กฎภาษาอังกฤษ, เทคนิค ComfyUI)
                                    </p>
                                </div>
                            </div>
                            <div className="bg-slate-900/50 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
                                <div className="p-8 space-y-4">
                                    <div className="space-y-2">
                                        <label className="text-sm font-bold text-indigo-400 uppercase tracking-wider font-mono">Global Instructions (Technical Guide & JSON structure)</label>
                                        <textarea
                                            value={basePromptConfig.key_value || ''}
                                            onChange={(e) => handleConfigChange('PHASE1_BASE_PROMPT', e.target.value)}
                                            className="w-full h-[500px] p-6 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all leading-relaxed"
                                        />
                                        <p className="text-xs text-slate-500 italic">คำสั่งส่วนนี้จะถูกนำไปต่อท้าย Persona Prompt ของ influencer แต่ละคนอัตโนมัติ</p>
                                    </div>
                                    <div className="flex justify-end">
                                        <button
                                            onClick={() => handleSaveConfig('PHASE1_BASE_PROMPT')}
                                            disabled={savingConfigKey === 'PHASE1_BASE_PROMPT'}
                                            className={`px-10 py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95
                                                ${savingConfigKey === 'PHASE1_BASE_PROMPT'
                                                    ? 'bg-indigo-500/50 cursor-not-allowed'
                                                    : 'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-500/20'}`}
                                        >
                                            {savingConfigKey === 'PHASE1_BASE_PROMPT' ? '⌛ กำลังบันทึก...' : '💾 บันทึก Base Prompt'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* PHASE 1 GENERATION RULES SECTION */}
                    <div className="space-y-6">
                        <div className="border-b border-slate-800 pb-2 flex items-center gap-3">
                            <span className="text-3xl">🧠</span>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-200">Phase 1: Generation Directives (กฎการควบคุม AI & JSON)</h2>
                                <p className="text-slate-400 text-sm mt-1">
                                    ควบคุมพฤติกรรมการคิดเนื้อหาของ AI เช่น บังคับสร้าง 21 คอนเทนต์ หรือปรับโครงสร้าง Output (Outfit, Camera, Poses)
                                </p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            {/* SYSTEM INSTRUCTION */}
                            {sysInstructionConfig && (
                                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
                                    <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                                        <h3 className="text-lg font-bold text-rose-400 font-mono">PHASE1_SYSTEM_INSTRUCTION</h3>
                                        <p className="text-xs text-slate-400 mt-1">กฎเหล็กเนื้อหาหลัก (เช่น ทำกี่คอนเทนต์, Storyline Flow)</p>
                                    </div>
                                    <div className="p-6 flex-grow flex flex-col gap-4">
                                        <textarea
                                            value={sysInstructionConfig.key_value || ''}
                                            onChange={(e) => handleConfigChange('PHASE1_SYSTEM_INSTRUCTION', e.target.value)}
                                            className="w-full flex-grow min-h-[300px] p-4 rounded-xl bg-slate-950 border border-slate-800 text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-rose-500/50 transition-all leading-relaxed"
                                        />
                                        <button
                                            onClick={() => handleSaveCriticalConfig('PHASE1_SYSTEM_INSTRUCTION', 'AI Directives')}
                                            disabled={savingConfigKey === 'PHASE1_SYSTEM_INSTRUCTION'}
                                            className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95
                                                ${savingConfigKey === 'PHASE1_SYSTEM_INSTRUCTION'
                                                    ? 'bg-rose-500/50 cursor-not-allowed'
                                                    : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20'}`}
                                        >
                                            {savingConfigKey === 'PHASE1_SYSTEM_INSTRUCTION' ? '⌛ กำลังบันทึก...' : '⚠️ เซฟการเปลี่ยนแปลง (อันตราย)'}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* JSON SCHEMA */}
                            {jsonSchemaConfig && (
                                <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex flex-col">
                                    <div className="px-6 py-4 border-b border-slate-800 bg-slate-900/50">
                                        <h3 className="text-lg font-bold text-amber-400 font-mono">PHASE1_JSON_SCHEMA</h3>
                                        <p className="text-xs text-slate-400 mt-1">โครงสร้างของแต่ละคอนเทนต์ (เช่น outfit, camera, vibe)</p>
                                    </div>
                                    <div className="p-6 flex-grow flex flex-col gap-4">
                                        <textarea
                                            value={jsonSchemaConfig.key_value || ''}
                                            onChange={(e) => handleConfigChange('PHASE1_JSON_SCHEMA', e.target.value)}
                                            className="w-full flex-grow min-h-[300px] p-4 rounded-xl bg-slate-950 border border-slate-800 text-amber-100/80 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all leading-relaxed"
                                        />
                                        <button
                                            onClick={() => handleSaveCriticalConfig('PHASE1_JSON_SCHEMA', 'JSON Structure Blueprint')}
                                            disabled={savingConfigKey === 'PHASE1_JSON_SCHEMA'}
                                            className={`w-full py-3 rounded-xl font-bold text-white shadow-lg transition-all active:scale-95
                                                ${savingConfigKey === 'PHASE1_JSON_SCHEMA'
                                                    ? 'bg-amber-500/50 cursor-not-allowed'
                                                    : 'bg-amber-600 hover:bg-amber-500 shadow-amber-500/20'}`}
                                        >
                                            {savingConfigKey === 'PHASE1_JSON_SCHEMA' ? '⌛ กำลังบันทึก...' : '⚠️ เซฟโครงสร้าง JSON (อันตราย)'}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* PERSONAS SECTION */}
                    <div className="space-y-6">
                        <div className="border-b border-slate-800 pb-2 flex items-center gap-3">
                            <span className="text-3xl">🎭</span>
                            <div>
                                <h2 className="text-2xl font-bold text-slate-200">Persona Prompts (คำสั่งเฉพาะตัวละคร)</h2>
                                <p className="text-slate-400 text-sm mt-1">
                                    กำหนด "ตัวตน" และ "นิสัย" ของ Influencer แต่ละคน (Momo, Karen ฯลฯ)
                                </p>
                            </div>
                        </div>

                        {personas.length === 0 ? (
                            <div className="text-slate-500">No personas found. Please run the SQL migration or wait for defaults.</div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-6">
                                {personas.map((p) => (
                                    <div key={p.id} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
                                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                                            <h3 className="text-xl font-semibold text-slate-100">{p.name || 'Unknown'}</h3>
                                            <span className="text-xs px-2 py-1 bg-purple-900/50 text-purple-300 rounded-full border border-purple-800">
                                                System Prompt
                                            </span>
                                        </div>
                                        <div className="p-6 space-y-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-300">Display Name</label>
                                                <input
                                                    type="text"
                                                    value={p.display_name || ''}
                                                    onChange={(e) => handlePersonaChange(p.id, 'display_name', e.target.value)}
                                                    className="w-full p-2 rounded-md bg-slate-950 border border-slate-800 text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-300">Trigger Word (บังคับขึ้นต้น Prompt เสมอ)</label>
                                                <textarea
                                                    value={p.trigger_word || ''}
                                                    onChange={(e) => handlePersonaChange(p.id, 'trigger_word', e.target.value)}
                                                    placeholder="e.g. Momo, igbaddie, 1girl, an Asian lady with short hair..."
                                                    className="w-full h-24 p-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-300">Instruction Rule (กฎการแต่งภาพเพิ่มเติม)</label>
                                                <textarea
                                                    value={p.instruction_rule || ''}
                                                    onChange={(e) => handlePersonaChange(p.id, 'instruction_rule', e.target.value)}
                                                    placeholder="e.g. Shot on Samsung S23, amateur photo shoot, grainy..."
                                                    className="w-full h-24 p-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <div className="flex items-center gap-2">
                                                    <label className="text-sm font-bold text-amber-400">LoRA Action Trigger Library (คลัง Trigger พิเศษ)</label>
                                                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] rounded-full uppercase font-black font-mono">New ✨</span>
                                                </div>
                                                <textarea
                                                    value={p.lora_triggers || ''}
                                                    onChange={(e) => handlePersonaChange(p.id, 'lora_triggers', e.target.value)}
                                                    placeholder="e.g. taking a mirror selfie, eating a burger, holding a coffee cup..."
                                                    className="w-full h-32 p-3 rounded-md bg-slate-950 border border-slate-800 text-amber-100/80 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 transition-all leading-relaxed"
                                                />
                                                <p className="text-xs text-slate-500 italic mt-1">AI จะเลือกหยิบคำจากคลังนี้ไปใส่ตามบริบทเนื้อหา (เช่น ถ้าโพสต์เกี่ยวกับหน้ากระจก ถึงจะหยิบ taking a mirror selfie ไปใช้)</p>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-300">System Instructions (Aesthetic Goals, Rules for Gemini)</label>
                                                <textarea
                                                    value={p.system_prompt || ''}
                                                    onChange={(e) => handlePersonaChange(p.id, 'system_prompt', e.target.value)}
                                                    className="w-full h-80 p-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                                />
                                                <p className="text-xs text-slate-500">This replaces the hardcoded personality instructions for Gemini.</p>
                                            </div>

                                            <button
                                                onClick={() => handleSavePersona(p.id)}
                                                disabled={savingPersonaId === p.id}
                                                className={`w-full py-3 px-4 rounded-xl font-bold text-white transition-all shadow-lg active:scale-95
                                                    ${savingPersonaId === p.id
                                                        ? 'bg-rose-500/50 cursor-not-allowed'
                                                        : 'bg-rose-600 hover:bg-rose-500 shadow-rose-500/20'}`}
                                            >
                                                {savingPersonaId === p.id ? '⌛ กำลังบันทึก...' : '💾 บันทึก Persona Prompt'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* WORKFLOWS SECTION */}
                    <div className="space-y-6">
                        <div className="border-b border-slate-800 pb-2">
                            <h2 className="text-2xl font-bold text-slate-200">🖼️ Image Trigger Words (Phase 2)</h2>
                            <p className="text-slate-400 text-sm mt-1">
                                These base words are directly injected into ComfyUI for generation.
                            </p>
                        </div>

                        {workflows.length === 0 ? (
                            <div className="text-slate-400">No workflows found. Please upload a workflow first.</div>
                        ) : (
                            <div className="grid md:grid-cols-2 gap-6">
                                {workflows.map((wf) => (
                                    <div key={wf.id} className="bg-slate-900 border border-slate-800 rounded-lg overflow-hidden shadow-sm">
                                        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between">
                                            <h3 className="text-xl font-semibold text-slate-100">{wf.name}</h3>
                                            <span className="text-xs px-2 py-1 bg-blue-900/50 text-blue-300 rounded-full border border-blue-800">
                                                {wf.persona || 'Shared'} ({wf.workflow_type})
                                            </span>
                                        </div>
                                        <div className="p-6 space-y-4">

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-300">Base Positive Prompt</label>
                                                <textarea
                                                    value={wf.base_positive_prompt || ''}
                                                    onChange={(e) => handleChange(wf.id, 'base_positive_prompt', e.target.value)}
                                                    placeholder="e.g. 85mm lens, 4k, hyper-realistic, masterpiece"
                                                    className="w-full h-24 p-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                                />
                                                <p className="text-xs text-slate-500">Will be appended to every AI-generated caption.</p>
                                            </div>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-slate-300">Base Negative Prompt</label>
                                                <textarea
                                                    value={wf.base_negative_prompt || ''}
                                                    onChange={(e) => handleChange(wf.id, 'base_negative_prompt', e.target.value)}
                                                    placeholder="e.g. bad anatomy, missing fingers, low quality"
                                                    className="w-full h-24 p-3 rounded-md bg-slate-950 border border-slate-800 text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                                />
                                            </div>

                                            <div className="space-y-2 pb-2">
                                                <label className="text-sm font-medium text-slate-300">Negative Prompt Node ID</label>
                                                <input
                                                    type="text"
                                                    value={wf.negative_prompt_node_id || ''}
                                                    onChange={(e) => handleChange(wf.id, 'negative_prompt_node_id', e.target.value)}
                                                    placeholder="e.g. 15"
                                                    className="w-full p-2 rounded-md bg-slate-950 border border-slate-800 text-slate-100 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50"
                                                />
                                            </div>

                                            <button
                                                onClick={() => handleSave(wf.id)}
                                                disabled={savingId === wf.id}
                                                className={`w-full py-2 px-4 rounded-md font-medium text-white transition-colors
                                        ${savingId === wf.id
                                                        ? 'bg-orange-500/50 cursor-not-allowed'
                                                        : 'bg-orange-500 hover:bg-orange-600'}`}
                                            >
                                                {savingId === wf.id ? 'Saving...' : '💾 Save Settings'}
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
