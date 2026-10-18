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

export async function rhOutputs(taskId: string): Promise<RhOutputs> {
    return pickOutputs(await rhPost('/task/openapi/outputs', { taskId }))
}
