#!/usr/bin/env node
// Pushes one compiled content item into Supabase's pipeline_content_items
// table. Called by the content-request skill after prompt-validator runs —
// see .claude/skills/content-request/SKILL.md Step 3.
//
// Usage: node scripts/push-content-item.mjs path/to/item.json
// item.json shape: { character, title, content_category, core_mechanic,
//   delivery_format, visual_format, platform, model, character_take,
//   compiled_prompt, validation_report, status }
// title is a short human-readable name (e.g. "GPS") shown in the dashboard
// queue/calendar and used for downloaded filenames — always include one.
// compiled_prompt is the raw text (H3's six sections, or Krea's prose) —
// srt_content is derived automatically for H3-shaped prompts, left null otherwise.

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import 'dotenv/config'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env.')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

// Parses an H3 detailed_description block into an .srt file, using each
// shot's timestamp as a rough anchor and splitting the shot's duration
// evenly across the dialogue lines inside it. This is a best-effort
// subtitle track, not a frame-exact one — H3 doesn't give per-word timing.
function generateSrtFromH3(compiledPrompt) {
    const descMatch = compiledPrompt.match(/detailed_description:\n([\s\S]*?)(?:\n\n(?:overall_soundscape|non_diegetic_music):|$)/)
    if (!descMatch) return null

    const desc = descMatch[1]
    const shotRegex = /\[Shot (\d+)\](?:\s*(?:Begin exactly from[^.]*\.)?\s*At\s*(\d{2}):(\d{2})\.(\d{3}),)?/g
    const shots = []
    let match
    while ((match = shotRegex.exec(desc)) !== null) {
        const [full, num, mm, ss, ms] = match
        const startSec = mm ? parseInt(mm) * 60 + parseInt(ss) + parseInt(ms) / 1000 : 0
        shots.push({ num: parseInt(num), startSec, index: match.index, matchLen: full.length })
    }
    if (shots.length === 0) return null

    for (let i = 0; i < shots.length; i++) {
        const contentStart = shots[i].index + shots[i].matchLen
        const contentEnd = i + 1 < shots.length ? shots[i + 1].index : desc.length
        shots[i].text = desc.slice(contentStart, contentEnd)
        shots[i].endSec = i + 1 < shots.length ? shots[i + 1].startSec : shots[i].startSec + 5
    }

    const entries = []
    let counter = 1
    for (const shot of shots) {
        const dialogueRegex = /<d>\[(\w+)\]\s*([^<]*?)<\/d>/g
        const lines = []
        let dMatch
        while ((dMatch = dialogueRegex.exec(shot.text)) !== null) {
            lines.push(dMatch[2].trim())
        }
        if (lines.length === 0) continue

        const shotDuration = Math.max(shot.endSec - shot.startSec, 1)
        const perLine = shotDuration / lines.length
        lines.forEach((line, i) => {
            const start = shot.startSec + i * perLine
            const end = start + perLine
            entries.push({ index: counter++, start, end, text: line })
        })
    }

    if (entries.length === 0) return null

    const fmt = (sec) => {
        const totalMs = Math.round(sec * 1000)
        const ms = String(totalMs % 1000).padStart(3, '0')
        const totalSec = Math.floor(totalMs / 1000)
        const h = String(Math.floor(totalSec / 3600)).padStart(2, '0')
        const m = String(Math.floor((totalSec % 3600) / 60)).padStart(2, '0')
        const s = String(totalSec % 60).padStart(2, '0')
        return `${h}:${m}:${s},${ms}`
    }

    return entries.map(e => `${e.index}\n${fmt(e.start)} --> ${fmt(e.end)}\n${e.text}\n`).join('\n')
}

async function main() {
    const jsonPath = process.argv[2]
    if (!jsonPath) {
        console.error('Usage: node scripts/push-content-item.mjs path/to/item.json')
        process.exit(1)
    }

    const item = JSON.parse(readFileSync(jsonPath, 'utf-8'))
    if (!item.character || !item.compiled_prompt) {
        console.error('item.json must include at least character and compiled_prompt')
        process.exit(1)
    }

    const isH3 = /detailed_description:/.test(item.compiled_prompt)
    const srt_content = isH3 ? generateSrtFromH3(item.compiled_prompt) : null

    const { data, error } = await supabase.from('pipeline_content_items').insert([{
        character: item.character,
        title: item.title ?? null,
        content_category: item.content_category ?? null,
        core_mechanic: item.core_mechanic ?? null,
        delivery_format: item.delivery_format ?? null,
        visual_format: item.visual_format ?? null,
        platform: item.platform ?? null,
        model: item.model ?? null,
        character_take: item.character_take ?? null,
        compiled_prompt: item.compiled_prompt,
        srt_content,
        validation_report: item.validation_report ?? null,
        status: item.status ?? (item.validation_report?.pass === false ? 'qc_fail' : 'pending'),
    }]).select()

    if (error) {
        console.error('Insert failed:', error.message)
        process.exit(1)
    }

    console.log(`Inserted pipeline_content_items row: ${data[0].id}`)
}

main()
