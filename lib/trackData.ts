// Pure helpers (no server-only imports) shared by the send route and the page.

export const FPS = 24
export const DEFAULT_SEG_FRAMES = 192 // 8 s per segment
// Context segments are written with timestamps +0.917 s (the node trims the
// 22 pinned frames of the previous segment, so written T lands at T - 0.917).
export const CONTEXT_SHIFT_SEC = 0.917

const PROMPT_START = 'subject_definitions:'

/** Cut anything before the first section header (e.g. a file header). */
export function cleanPrompt(raw: string): string {
    const text = raw.replace(/\r\n/g, '\n')
    const i = text.indexOf(PROMPT_START)
    return (i >= 0 ? text.slice(i) : text).trim() + '\n'
}

/**
 * Prompt of a segment that was written as a "context" segment (timestamps
 * shifted by +0.917 s) but will be rendered ALONE as a first "shot" segment:
 * subtract the shift from every MM:SS.mmm timestamp (never below 0).
 */
export function unshiftTimestamps(prompt: string, shiftSec = CONTEXT_SHIFT_SEC): string {
    return prompt.replace(/\b(\d{2}):(\d{2})\.(\d{3})\b/g, (_m, mm, ss, ms) => {
        const total = Number(mm) * 60 + Number(ss) + Number(ms) / 1000
        const t = Math.max(0, total - shiftSec)
        const m2 = Math.floor(t / 60)
        const s2 = Math.floor(t % 60)
        const ms2 = Math.round((t - Math.floor(t)) * 1000)
        const pad = (n: number, w: number) => String(n).padStart(w, '0')
        return `${pad(m2, 2)}:${pad(s2, 2)}.${pad(ms2 === 1000 ? 999 : ms2, 3)}`
    })
}

export type SegInput = { prompt: string; frames: number }

/** Easy-Media "easy multiTrackEditor" track_data JSON (schema verified 2026-10-13). */
export function buildTrackData(segs: SegInput[], imageNames: string[]): string {
    const uid = () => crypto.randomUUID()
    let start = 0
    const segments = segs.map((s, i) => {
        const seg = {
            id: uid(),
            start_frame: start,
            end_frame: start + s.frames,
            color: 'var(--multitrack-task-bg)',
            content: {
                media_type: 'none',
                task_mode: 'ref',
                continuity_mode: i === 0 ? 'shot' : 'context',
                ref_image_size: 'max',
                images: imageNames.map((n) => ({ id: uid(), source_type: 'input', file_path: n, file_name: n })),
                muted: false,
                volume_db: 0,
                user_prompt: cleanPrompt(s.prompt),
            },
        }
        start += s.frames
        return seg
    })
    return JSON.stringify({
        muted: false,
        volume_db: 0,
        task_markers: [],
        task_overview: false,
        tracks: [
            { id: uid(), name: 'Task 0', type: 'task', task_mode: 'default', color: 'var(--multitrack-task-bg)', muted: false, solo: false, volume_db: 0, locked: false, segments },
            { id: uid(), name: 'Video 0', type: 'video', color: 'var(--primary)', muted: false, solo: false, volume_db: 0, locked: false, segments: [], audio_locked: false },
        ],
        total_length: start,
        frame_rate: FPS,
    })
}

/** Rough estimate from our own measurements (≈33 s render per video second, ≈6.6 coins per video second). */
export function estimate(totalFrames: number) {
    const sec = totalFrames / FPS
    return { videoSec: sec, minutes: Math.round((sec * 33) / 60), coins: Math.round(sec * 6.6) }
}
