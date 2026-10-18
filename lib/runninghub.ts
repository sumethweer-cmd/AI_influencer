// Minimal RunningHub OpenAPI client (server-side only; the key never reaches the browser).
// Endpoints/shape verified end-to-end with the CLI scripts on 2026-10-13:
//   POST /task/openapi/status  {apiKey, taskId} -> data = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED'
//   POST /task/openapi/outputs {apiKey, taskId} -> data[] = {fileUrl, fileType, taskCostTime, consumeCoins}

const BASE = 'https://www.runninghub.ai'

export type RhStatus = 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED' | 'CANCELLED'
const KNOWN = new Set<string>(['QUEUED', 'RUNNING', 'SUCCESS', 'FAILED', 'CANCELLED'])

export type RhOutputs = {
    fileUrl: string | null
    runSeconds: number | null
    coins: number | null
}

function apiKey(): string {
    const k = process.env.RUNNINGHUB_API_KEY
    if (!k) throw new Error('RUNNINGHUB_API_KEY is not set on the server')
    return k
}

async function rhPost(path: string, body: Record<string, unknown>) {
    const key = apiKey()
    const res = await fetch(BASE + path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ apiKey: key, ...body }),
        cache: 'no-store',
    })
    const text = await res.text()
    try {
        return JSON.parse(text)
    } catch {
        throw new Error(`RunningHub returned a non-JSON response (HTTP ${res.status})`)
    }
}

export async function rhStatus(taskId: string): Promise<RhStatus | null> {
    const json = await rhPost('/task/openapi/status', { taskId })
    const st = typeof json.data === 'string' ? json.data : null
    return st && KNOWN.has(st) ? (st as RhStatus) : null
}

export function pickOutputs(json: unknown): RhOutputs {
    const data = (json as { data?: unknown } | null)?.data
    const items = (Array.isArray(data) ? data : []) as Array<Record<string, unknown>>
    const withUrl = items.filter((i) => typeof i.fileUrl === 'string' && i.fileUrl)
    const video = withUrl.find((i) => String(i.fileType || '').toLowerCase() === 'mp4') || withUrl[0]
    let runSeconds: number | null = null
    let coins: number | null = null
    for (const i of items) {
        if (i.taskCostTime) runSeconds = Number(i.taskCostTime)
        if (i.consumeCoins) coins = Number(i.consumeCoins)
    }
    return { fileUrl: video ? String(video.fileUrl) : null, runSeconds, coins }
}

const scrub = (text: string) => text.split(process.env.RUNNINGHUB_API_KEY || '\u0000').join('***').slice(0, 300)

/** Fetches an image from a public URL and uploads it to RunningHub; returns the name RH gives it (used in track_data). */
export async function rhUploadImage(url: string, filename: string): Promise<string> {
    const key = apiKey()
    const img = await fetch(url, { cache: 'no-store' })
    if (!img.ok) throw new Error(`โหลดรูปไม่ได้ (HTTP ${img.status}): ${filename}`)
    const buf = await img.arrayBuffer()
    const fd = new FormData()
    fd.append('apiKey', key)
    fd.append('fileType', 'input')
    fd.append('file', new Blob([buf], { type: img.headers.get('content-type') || 'image/png' }), filename)
    const res = await fetch(BASE + '/task/openapi/upload', { method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd })
    const json = await res.json().catch(() => ({}))
    if (json.code !== 0 || !json.data?.fileName) throw new Error(`อัปโหลดรูปเข้า RunningHub ไม่สำเร็จ: ${scrub(JSON.stringify(json))}`)
    return String(json.data.fileName)
}

export type NodeInfo = { nodeId: string; fieldName: string; fieldValue: string | number }

/** Creates a task from a saved RunningHub workflow. This is the call that costs coins once it runs. */
export async function rhCreate(workflowId: string, nodeInfoList: NodeInfo[]): Promise<{ taskId: string; status: string }> {
    const json = await rhPost('/task/openapi/create', { workflowId, nodeInfoList })
    if (json.code !== 0 || !json.data?.taskId) throw new Error(`สร้างงานใน RunningHub ไม่สำเร็จ: ${scrub(JSON.stringify(json))}`)
    return { taskId: String(json.data.taskId), status: String(json.data.taskStatus || 'QUEUED') }
}

export async function rhOutputs(taskId: string): Promise<RhOutputs> {
    return pickOutputs(await rhPost('/task/openapi/outputs', { taskId }))
}
