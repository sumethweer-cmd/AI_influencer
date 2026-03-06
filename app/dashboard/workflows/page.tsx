'use client'

import React, { useEffect, useState, useRef } from 'react'
import { ComfyUIWorkflow } from '@/types'

export default function WorkflowsPage() {
    const [workflows, setWorkflows] = useState<ComfyUIWorkflow[]>([])
    const [loading, setLoading] = useState(true)

    // Form states
    const [name, setName] = useState('')
    const [persona, setPersona] = useState('All')
    const [workflowType, setWorkflowType] = useState('SFW')

    // File/JSON states
    const [parsedJson, setParsedJson] = useState<any>(null)
    const [availableNodes, setAvailableNodes] = useState<{ id: string; type: string; title: string }[]>([])
    const fileInputRef = useRef<HTMLInputElement>(null)

    // Mapping states
    const [promptNodeId, setPromptNodeId] = useState('')
    const [widthNodeId, setWidthNodeId] = useState('')
    const [heightNodeId, setHeightNodeId] = useState('')
    const [batchSizeNodeId, setBatchSizeNodeId] = useState('')
    const [outputNodeId, setOutputNodeId] = useState('')
    const [videoImageNodeId, setVideoImageNodeId] = useState('')
    const [videoPromptNodeId, setVideoPromptNodeId] = useState('')
    const [videoPrompt2NodeId, setVideoPrompt2NodeId] = useState('')
    const [videoPrompt3NodeId, setVideoPrompt3NodeId] = useState('')

    useEffect(() => {
        fetchWorkflows()
    }, [])

    async function fetchWorkflows() {
        setLoading(true)
        try {
            const res = await fetch('/api/workflows')
            const json = await res.json()
            if (json.success) setWorkflows(json.data)
        } catch (e) {
            console.error('Failed to fetch workflows', e)
        }
        setLoading(false)
    }

    function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0]
        if (!file) return

        const reader = new FileReader()
        reader.onload = (event) => {
            try {
                const text = event.target?.result as string
                const json = JSON.parse(text)

                // ComfyUI API format is usually a dictionary of nodes where keys are IDs
                if (typeof json !== 'object' || json === null) throw new Error("Invalid JSON structure")

                setParsedJson(json)

                // Extract nodes
                const nodes: { id: string; type: string; title: string }[] = []
                Object.keys(json).forEach(key => {
                    const node = json[key]
                    if (node && node.class_type) {
                        nodes.push({
                            id: key,
                            type: node.class_type,
                            title: node._meta?.title || node.class_type
                        })
                    }
                })

                setAvailableNodes(nodes)

                // Try to auto-guess some nodes to save time
                const textNodes = nodes.filter(n => n.type.includes('TextEncode') || n.type.toLowerCase().includes('prompt'))
                if (textNodes.length > 0) setPromptNodeId(textNodes[0].id)

                const emptyLatentNodes = nodes.filter(n => n.type === 'EmptyLatentImage')
                if (emptyLatentNodes.length > 0) {
                    setWidthNodeId(emptyLatentNodes[0].id)
                    setHeightNodeId(emptyLatentNodes[0].id)
                    setBatchSizeNodeId(emptyLatentNodes[0].id)
                }

                const saveImageNodes = nodes.filter(n => n.type.includes('SaveImage') || n.title.includes('Save'))
                if (saveImageNodes.length > 0) {
                    setOutputNodeId(saveImageNodes[0].id)
                }

                // Default name based on filename
                if (!name) setName(file.name.replace('.json', ''))

            } catch (err) {
                alert('Invalid JSON File! Please make sure you saved it as "API Format" from ComfyUI.')
                resetFile()
            }
        }
        reader.readAsText(file)
    }

    function resetFile() {
        setParsedJson(null)
        setAvailableNodes([])
        setPromptNodeId('')
        setWidthNodeId('')
        setHeightNodeId('')
        setBatchSizeNodeId('')
        setOutputNodeId('')
        setVideoImageNodeId('')
        setVideoPromptNodeId('')
        setVideoPrompt2NodeId('')
        setVideoPrompt3NodeId('')
        if (fileInputRef.current) fileInputRef.current.value = ''
    }

    async function handleUpload(e: React.FormEvent) {
        e.preventDefault()
        if (!parsedJson) return alert('Please upload a JSON file first.')
        if (!promptNodeId) return alert('You must select a Prompt Node ID.')

        try {
            const res = await fetch('/api/workflows', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    persona: persona === 'All' ? null : persona,
                    workflow_type: workflowType,
                    workflow_json: parsedJson,
                    prompt_node_id: promptNodeId,
                    width_node_id: widthNodeId || null,
                    height_node_id: heightNodeId || null,
                    batch_size_node_id: batchSizeNodeId || null,
                    output_node_id: outputNodeId || null,
                    video_image_node_id: videoImageNodeId || null,
                    video_prompt_node_id: videoPromptNodeId || null,
                    video_prompt_2_node_id: videoPrompt2NodeId || null,
                    video_prompt_3_node_id: videoPrompt3NodeId || null
                })
            })

            const data = await res.json()
            if (data.success) {
                alert('Workflow uploaded successfully!')
                setName('')
                resetFile()
                fetchWorkflows()
            } else {
                alert('Error: ' + data.error)
            }
        } catch (err: any) {
            alert('Upload failed.')
        }
    }

    async function handleDelete(id: string) {
        if (!confirm('Are you sure you want to delete this workflow?')) return
        try {
            const res = await fetch(`/api/workflows/\${id}`, { method: 'DELETE' })
            if (res.ok) fetchWorkflows()
        } catch (e) {
            alert('Delete failed')
        }
    }

    return (
        <div className="space-y-8 pb-32">
            <header>
                <h2 className="text-3xl font-bold">ComfyUI Workflows</h2>
                <p className="text-slate-400 mt-1">Manage your JSON templates. Upload your <span className="text-orange-400 font-mono">Save (API Format)</span> workflows here.</p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Upload Form */}
                <div className="lg:col-span-1 bg-slate-800 p-6 rounded-xl border border-slate-700 h-fit">
                    <h3 className="text-xl font-bold text-orange-400 mb-6 border-b border-slate-700 pb-4">
                        1. Upload & Setup
                    </h3>

                    <form onSubmit={handleUpload} className="space-y-6">
                        {/* 1. File Upload */}
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-slate-400">Workflow JSON File</label>
                            <input
                                type="file"
                                accept=".json"
                                onChange={handleFileUpload}
                                ref={fileInputRef}
                                className="block w-full text-sm text-slate-400
                                    file:mr-4 file:py-2.5 file:px-4
                                    file:rounded-lg file:border-0
                                    file:text-sm file:font-bold
                                    file:bg-slate-700 file:text-slate-200
                                    hover:file:bg-slate-600 file:transition-colors file:cursor-pointer bg-slate-900 border border-slate-700 rounded-lg outline-none"
                            />
                        </div>

                        {parsedJson && (
                            <div className="bg-emerald-900/20 border border-emerald-900 rounded-lg p-4 space-y-4 animate-in fade-in slide-in-from-top-4">
                                <p className="text-xs text-emerald-400 font-medium">✓ File parsed successfully ({availableNodes.length} nodes found)</p>

                                <div className="space-y-3">
                                    <div>
                                        <label className="block text-xs font-bold text-slate-300 mb-1">Workflow Name</label>
                                        <input
                                            type="text" required
                                            value={name} onChange={e => setName(e.target.value)}
                                            placeholder="e.g. Momo SFW v1"
                                            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 mb-1">Persona</label>
                                            <select
                                                value={persona} onChange={e => setPersona(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none hover:cursor-pointer"
                                            >
                                                <option value="All">All / Shared</option>
                                                <option value="Momo">Momo</option>
                                                <option value="Karen">Karen</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-bold text-slate-300 mb-1">Type</label>
                                            <select
                                                value={workflowType} onChange={e => setWorkflowType(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none hover:cursor-pointer"
                                            >
                                                <option value="SFW">SFW</option>
                                                <option value="NSFW">NSFW</option>
                                                <option value="Video">Video</option>
                                            </select>
                                        </div>
                                    </div>

                                    <hr className="border-slate-700 my-4" />

                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-xs font-bold text-orange-400 mb-1">Main Prompt Node (Required) *</label>
                                            <select
                                                value={promptNodeId} onChange={e => setPromptNodeId(e.target.value)} required
                                                className="w-full bg-slate-950 border border-orange-500/50 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none hover:cursor-pointer font-mono"
                                            >
                                                <option value="" disabled>Select the node for text prompts</option>
                                                {availableNodes.map(n => (
                                                    <option key={n.id} value={n.id}>[{n.id}] {n.title} ({n.type})</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-1">Width Node (Optional)</label>
                                            <select
                                                value={widthNodeId} onChange={e => setWidthNodeId(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none hover:cursor-pointer font-mono text-slate-400"
                                            >
                                                <option value="">Leave empty (Use workflow default)</option>
                                                {availableNodes.map(n => (
                                                    <option key={n.id} value={n.id}>[{n.id}] {n.title} ({n.type})</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-1">Height Node (Optional)</label>
                                            <select
                                                value={heightNodeId} onChange={e => setHeightNodeId(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none hover:cursor-pointer font-mono text-slate-400"
                                            >
                                                <option value="">Leave empty (Use workflow default)</option>
                                                {availableNodes.map(n => (
                                                    <option key={n.id} value={n.id}>[{n.id}] {n.title} ({n.type})</option>
                                                ))}
                                            </select>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-slate-400 mb-1">Batch Size Node (Optional)</label>
                                            <select
                                                value={batchSizeNodeId} onChange={e => setBatchSizeNodeId(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none hover:cursor-pointer font-mono text-slate-400"
                                            >
                                                <option value="">Leave empty (Use workflow default)</option>
                                                {availableNodes.map(n => (
                                                    <option key={n.id} value={n.id}>[{n.id}] {n.title} ({n.type})</option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-slate-500 mt-1">Select the node (usually EmptyLatentImage) if you want the system to dynamically control how many images are generated per post.</p>
                                        </div>

                                        <div>
                                            <label className="block text-xs font-bold text-orange-400 mb-1">Output Node (Highly Recommended)</label>
                                            <select
                                                value={outputNodeId} onChange={e => setOutputNodeId(e.target.value)}
                                                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-orange-500 outline-none hover:cursor-pointer font-mono text-slate-300"
                                            >
                                                <option value="">Leave empty (system will fallback to scan all nodes)</option>
                                                {availableNodes.map(n => (
                                                    <option key={n.id} value={n.id}>[{n.id}] {n.title} ({n.type})</option>
                                                ))}
                                            </select>
                                            <p className="text-[10px] text-slate-500 mt-1">Select the SaveImage node to ensure 100% reliable image fetching.</p>
                                        </div>

                                        {workflowType === 'Video' && (
                                            <div className="space-y-4 pt-4 border-t border-slate-700">
                                                <h4 className="text-xs font-black text-indigo-400 uppercase">Video Specific Mappings</h4>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 mb-1">Source Image Node</label>
                                                    <select
                                                        value={videoImageNodeId} onChange={e => setVideoImageNodeId(e.target.value)}
                                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none hover:cursor-pointer font-mono"
                                                    >
                                                        <option value="">Select Load Image node</option>
                                                        {availableNodes.map(n => (
                                                            <option key={n.id} value={n.id}>[{n.id}] {n.title} ({n.type})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 mb-1">Video Motion Prompt 1 Node (0-5s)</label>
                                                    <select
                                                        value={videoPromptNodeId} onChange={e => setVideoPromptNodeId(e.target.value)}
                                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none hover:cursor-pointer font-mono"
                                                    >
                                                        <option value="">Select the Text Encode node</option>
                                                        {availableNodes.map(n => (
                                                            <option key={n.id} value={n.id}>[{n.id}] {n.title} ({n.type})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 mb-1">Video Motion Prompt 2 Node (5-10s)</label>
                                                    <select
                                                        value={videoPrompt2NodeId} onChange={e => setVideoPrompt2NodeId(e.target.value)}
                                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none hover:cursor-pointer font-mono"
                                                    >
                                                        <option value="">Select the Text Encode node</option>
                                                        {availableNodes.map(n => (
                                                            <option key={n.id} value={n.id}>[{n.id}] {n.title} ({n.type})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-xs font-bold text-slate-400 mb-1">Video Motion Prompt 3 Node (10-15s)</label>
                                                    <select
                                                        value={videoPrompt3NodeId} onChange={e => setVideoPrompt3NodeId(e.target.value)}
                                                        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:border-indigo-500 outline-none hover:cursor-pointer font-mono"
                                                    >
                                                        <option value="">Select the Text Encode node</option>
                                                        {availableNodes.map(n => (
                                                            <option key={n.id} value={n.id}>[{n.id}] {n.title} ({n.type})</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    className="w-full mt-4 bg-orange-600 hover:bg-orange-500 text-white font-bold py-3 rounded-lg transition-all shadow-[0_0_15px_rgba(234,88,12,0.3)] hover:shadow-[0_0_25px_rgba(234,88,12,0.5)]"
                                >
                                    Save Mapping & Upload
                                </button>
                                <button
                                    type="button"
                                    onClick={resetFile}
                                    className="w-full text-xs text-slate-400 hover:text-white mt-2 transition-colors"
                                >
                                    Cancel / Clear
                                </button>
                            </div>
                        )}
                    </form>
                </div>

                {/* Workflow List */}
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-xl font-bold text-slate-100 mb-6 border-b border-slate-800 pb-4">
                        2. Saved Workflows
                    </h3>

                    {loading ? (
                        <div className="h-40 bg-slate-800 animate-pulse rounded-xl border border-slate-700" />
                    ) : workflows.length === 0 ? (
                        <div className="bg-slate-800/50 p-8 rounded-xl border border-dashed border-slate-700 text-center">
                            <p className="text-slate-400 font-medium">No workflows found.</p>
                            <p className="text-sm text-slate-500 mt-1">Upload a JSON file to get started.</p>
                        </div>
                    ) : (
                        workflows.map(wf => (
                            <div key={wf.id} className="bg-slate-800 p-6 rounded-xl border border-slate-700 flex flex-col items-start group relative overflow-hidden">
                                <div className={`absolute top-0 left-0 w-1 h-full bg-slate-700 transition-colors ${wf.workflow_type === 'Video' ? 'group-hover:bg-indigo-500' : 'group-hover:bg-orange-500'}`} />

                                <div className="w-full flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <h3 className="text-lg font-bold text-slate-100">{wf.name}</h3>
                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full \${wf.persona === 'Momo' ? 'bg-pink-900 text-pink-300' : wf.persona === 'Karen' ? 'bg-purple-900 text-purple-300' : 'bg-slate-700 text-slate-300'}`}>
                                            {wf.persona || 'Shared'}
                                        </span>
                                        <span className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full ${wf.workflow_type === 'SFW' ? 'bg-emerald-900 text-emerald-300' : wf.workflow_type === 'Video' ? 'bg-indigo-900 text-indigo-300' : 'bg-rose-900 text-rose-300'}`}>
                                            {wf.workflow_type === 'Video' ? '🎬 Video' : wf.workflow_type}
                                        </span>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(wf.id)}
                                        className="text-rose-400 hover:text-rose-300 text-xs font-bold transition-colors underline opacity-50 hover:opacity-100"
                                    >
                                        Delete
                                    </button>
                                </div>

                                <div className="w-full bg-slate-900 rounded-lg p-3 text-sm grid grid-cols-2 md:grid-cols-4 gap-4 align-top border border-slate-800">
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block">Prompt Node</span>
                                        <span className="text-orange-400 font-mono font-medium block">[{wf.prompt_node_id}]</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block">Width Node</span>
                                        <span className="text-slate-300 font-mono block">{wf.width_node_id ? `[\${wf.width_node_id}]` : '-'}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block">Height Node</span>
                                        <span className="text-slate-300 font-mono block">{wf.height_node_id ? `[${wf.height_node_id}]` : '-'}</span>
                                    </div>
                                    <div className="space-y-1">
                                        <span className="text-[10px] text-slate-500 uppercase font-bold tracking-widest block">Output Node</span>
                                        <span className="text-emerald-400 font-mono block">{wf.output_node_id ? `[${wf.output_node_id}]` : '-'}</span>
                                    </div>
                                    <div className="space-y-1 text-slate-500">
                                        <span className="text-[10px] uppercase font-bold tracking-widest block">Video Mapping</span>
                                        <span className="text-[10px] font-mono block truncate">Img: {wf.video_image_node_id || '-'}</span>
                                        <span className="text-[10px] font-mono block truncate">P1: {wf.video_prompt_node_id || '-'} | P2: {wf.video_prompt_2_node_id || '-'} | P3: {wf.video_prompt_3_node_id || '-'}</span>
                                    </div>
                                </div>
                                <div className="w-full mt-3 text-xs text-slate-500 flex justify-end">
                                    Uploaded: {new Date(wf.created_at).toLocaleString()}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    )
}
