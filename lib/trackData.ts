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
    return shiftTimestamps(prompt, -shiftSec)
}

/** Adds deltaSec (can be negative) to every MM:SS.mmm timestamp in a prompt (never below 0). */
export function shiftTimestamps(prompt: string, deltaSec: number): string {
    return prompt.replace(/\b(\d{2}):(\d{2})\.(\d{3})\b/g, (_m, mm, ss, ms) => {
        const total = Number(mm) * 60 + Number(ss) + Number(ms) / 1000
        const t = Math.max(0, total + deltaSec)
        const m2 = Math.floor(t / 60)
        const s2 = Math.floor(t % 60)
        const ms2 = Math.round((t - Math.floor(t)) * 1000)
        const pad = (n: number, w: number) => String(n).padStart(w, '0')
        return `${pad(m2, 2)}:${pad(s2, 2)}.${pad(ms2 === 1000 ? 999 : ms2, 3)}`
    })
}

export type Continuity = 'shot' | 'context'
export type SegInput = { prompt: string; frames: number; continuity?: Continuity; images?: string[] }

/**
 * Resolution of node 26. Two generations of the workflow exist:
 *  - legacy: a "resolution" list of sizes such as '720 x 1280 (9:16)'
 *  - megapixel mode (workflow row flag megapixel_mode): resolution = 'width x height (megapixels)' plus
 *    an aspect_ratio list and a megapixels number. The page stores that as '<aspect ratio>|<megapixels>'.
 */
export const RESOLUTION_PRESETS = ['720 x 1280 (9:16)', '480 x 832 (9:16)']
export const ASPECT_RATIOS = [
    '1:1 (Square)',
    '2:3 (Portrait Photo)',
    '3:2 (Photo)',
    '3:4 (Portrait Standard)',
    '4:3 (Standard)',
    '9:16 (Portrait Widescreen)',
    '16:9 (Widescreen)',
    '21:9 (Ultrawide)',
]
export const MEGAPIXEL_PRESETS = [0.5, 0.75, 1, 1.25, 1.5]
export const MEGAPIXEL_MODE_NAME = 'width x height (megapixels)'
export const DEFAULT_MEGAPIXEL_RESOLUTION = '9:16 (Portrait Widescreen)|1'
/** Used when a content has no saved resolution (legacy workflows). */
export const DEFAULT_RESOLUTION = '720 x 1280 (9:16)'
/** Saved value meaning "do not send a resolution, keep the one saved in the workflow". */
export const WORKFLOW_RESOLUTION = 'workflow'

/** '<aspect>|<megapixels>' -> parts, or null when the value is not in megapixel format. */
export function parseMegapixelValue(v: string | null | undefined): { aspect: string; megapixels: number } | null {
    const m = String(v || '').match(/^(.+)\|(\d+(?:\.\d+)?)$/)
    if (!m) return null
    const megapixels = Number(m[2])
    return megapixels > 0 && megapixels <= 4 ? { aspect: m[1].trim(), megapixels } : null
}

/** What to send to node 26 for the given saved value and workflow style. [] = send nothing (workflow keeps its own). */
export function resolutionFields(value: string | null, megapixelMode: boolean): { fieldName: string; fieldValue: string | number }[] {
    if (!value || value === WORKFLOW_RESOLUTION) return []
    if (megapixelMode) {
        // an old size such as '720 x 1280 (9:16)' maps to the default 9:16 at 1 MP
        const mp = parseMegapixelValue(value) || parseMegapixelValue(DEFAULT_MEGAPIXEL_RESOLUTION)!
        return [
            { fieldName: 'resolution', fieldValue: MEGAPIXEL_MODE_NAME },
            { fieldName: 'resolution.aspect_ratio', fieldValue: mp.aspect },
            { fieldName: 'resolution.megapixels', fieldValue: mp.megapixels },
        ]
    }
    if (parseMegapixelValue(value)) return [] // megapixel value on a legacy workflow: cannot be applied
    return [{ fieldName: 'resolution', fieldValue: value.trim() }]
}

/** Per-content render settings, stored in the main row's note JSON. */
export type RenderSettings = {
    continuity: Record<string, Continuity>
    /** how each segment's text was WRITTEN (default: segment 1 = shot, others = context with timestamps +0.917 s) */
    authored: Record<string, Continuity>
    /** which Picture slots each segment uses (default: all). The order here is the <Picture N> order inside that segment. */
    segImages: Record<string, number[]>
    resolution: string | null
}
export function parseRenderSettings(note: string | null | undefined): RenderSettings {
    try {
        const j = JSON.parse(note || '{}')
        const continuity: Record<string, Continuity> = {}
        for (const [k, v] of Object.entries(j.continuity || {})) if (v === 'shot' || v === 'context') continuity[k] = v
        const authored: Record<string, Continuity> = {}
        for (const [k, v] of Object.entries(j.authored || {})) if (v === 'shot' || v === 'context') authored[k] = v
        const segImages: Record<string, number[]> = {}
        for (const [k, v] of Object.entries(j.segImages || {})) {
            if (Array.isArray(v)) segImages[k] = v.map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= 3)
        }
        return { continuity, authored, segImages, resolution: typeof j.resolution === 'string' && j.resolution ? j.resolution : null }
    } catch {
        return { continuity: {}, authored: {}, segImages: {}, resolution: null }
    }
}

/**
 * Chooses the continuity of each chosen segment and fixes timestamps to match.
 * - the first chosen segment is always a "shot"; the others use the saved setting (default "context")
 * - a segment written as context (segment_number > 1, timestamps +0.917 s) that is rendered as a shot
 *   gets its timestamps shifted back, unless adjust is false
 * Segments switched to "shot" keep their text, which may still open with "the shot continues…":
 * the caller should warn about that.
 */
export function planSegments(
    segs: { segNo: number; prompt: string; frames: number }[],
    continuity: Record<string, Continuity> | undefined,
    adjust = true,
    authored: Record<string, Continuity> = {}
): { inputs: SegInput[]; adjusted: number[] } {
    const adjusted: number[] = []
    const inputs = segs.map((s, i) => {
        const wanted: Continuity = i === 0 ? 'shot' : continuity?.[String(s.segNo)] ?? 'context'
        let prompt = s.prompt
        const wrote: Continuity = authored[String(s.segNo)] ?? (s.segNo > 1 ? 'context' : 'shot')
        if (adjust && wrote === 'context' && wanted === 'shot') {
            prompt = shiftTimestamps(cleanPrompt(prompt), -CONTEXT_SHIFT_SEC)
            adjusted.push(s.segNo)
        }
        return { prompt, frames: s.frames, continuity: wanted }
    })
    return { inputs, adjusted }
}

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
                continuity_mode: s.continuity ?? (i === 0 ? 'shot' : 'context'),
                ref_image_size: 'max',
                images: (s.images ?? imageNames).map((n) => ({ id: uid(), source_type: 'input', file_path: n, file_name: n })),
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
/** Measured on finished RunningHub tasks: ~27 s of run time per second of video (the clip length tracks the generation time). */
export const RUN_SEC_PER_VIDEO_SEC = 27

export const CHECK_AT = 0.85 // first status check when 85% of the estimated run time has passed
export const MIN_FIRST_CHECK_SEC = 120
/** When a render task is expected to be finished (used to time the status checks). */
export const taskEtaMs = (t: { submitted_at: string; seg_count: number | null }) =>
    new Date(t.submitted_at).getTime() + Math.max(MIN_FIRST_CHECK_SEC, Math.round((t.seg_count || 5) * 8 * RUN_SEC_PER_VIDEO_SEC * CHECK_AT)) * 1000

export function estimate(totalFrames: number) {
    const sec = totalFrames / FPS
    return { videoSec: sec, minutes: Math.round((sec * RUN_SEC_PER_VIDEO_SEC) / 60), coins: Math.round(sec * 5.5) }
}
