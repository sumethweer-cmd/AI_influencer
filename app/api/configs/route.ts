import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        let { data, error } = await supabaseAdmin
            .from('system_configs')
            .select('*')
            .order('created_at', { ascending: true })

        if (error) throw error

        // Auto-seed defaults if table is empty
        if (!data || data.length === 0) {
            const defaults = [
                { key_name: 'GEMINI_API_KEY', key_value: '', description: '🔑 ไปที่ Google AI Studio (aistudio.google.com) > Create API Key > Copy มาวางที่นี่ (ใช้สำหรับวิเคราะห์เทรนด์และ QC)', is_secret: true },
                { key_name: 'GEMINI_MODEL_NAME', key_value: 'gemini-2.0-flash', description: '🤖 รุ่นของ Gemini ที่ต้องการใช้งาน (แนะนำ: gemini-2.0-flash หรือ gemini-1.5-flash)', is_secret: false },
                { key_name: 'APIFY_API_TOKEN', key_value: '', description: '🌐 ไปที่ Apify Console > Settings > Integrations > Copy API Token (ใช้สำหรับขูดข้อมูลเทรนด์)', is_secret: true },
                { key_name: 'RUNPOD_API_KEY', key_value: '', description: '☁️ ไปที่ Runpod Console > Settings > API Keys > Create New Key (ใช้สำหรับเปิดเครื่อง GPU เจนรูป)', is_secret: true },
                { key_name: 'RUNPOD_TEMPLATE_ID', key_value: '', description: '📋 ใส่ Template ID ของ ComfyUI (ถ้าไม่มีจะใช้ค่าเริ่มต้นให้)', is_secret: false },
                { key_name: 'TELEGRAM_BOT_TOKEN', key_value: '', description: '🤖 ทัก @BotFather ใน Telegram > /newbot > Copy HTTP API Token ที่ได้มาวางที่นี่', is_secret: true },
                { key_name: 'TELEGRAM_CHAT_ID', key_value: '', description: '👤 ทัก @userinfobot ใน Telegram เพื่อดู Chat ID ของคุณและนำมาวางที่นี่ (เพื่อให้ Bot ส่งงานหาคุณได้)', is_secret: false },
                { key_name: 'TWITTER_API_V2_KEYS', key_value: '', description: '𝕏 ไปที่ developer.x.com > Projects & Apps > Keys and Tokens > Gen Consumer Keys & Access Tokens (ใช้สำหรับโพสต์งานอัตโนมัติ)', is_secret: true },
                {
                    key_name: 'PHASE1_BASE_PROMPT',
                    key_value: `TECHNICAL PROMPT GUIDE FOR COMFYUI:
- MUST USE: grainy, smartphone quality, slight motion blur, digital noise, raw photo, direct flash (if applicable).
- DO NOT USE: Cinematic, Masterpiece, High Fashion.

LANGUAGE RULE:
- ALL captions (caption_draft) MUST be written in 100% ENGLISH.

OUTPUT FORMAT:
Generate 21 content items. Return ONLY a valid JSON following this structure:
{
  "week_start": "YYYY-MM-DD",
  "week_end": "YYYY-MM-DD",
  "trends": { "source": "...", "details": "..." },
  "contents": [
    {
      "sequence": 1,
      "content_type": "Post",
      "persona": "TARGET_PERSONA",
      "topic": "...",
      "theme": "...",
      "sfw_prompt": "Prompt MUST apply the Technical Guide and Persona DNA...",
      "nsfw_option": true/false,
      "caption_draft": "..."
    }
  ]
}`,
                    description: '📜 Global instructions for Phase 1 (Technical Guide, JSON Structure)',
                    is_secret: false
                },
                {
                    key_name: 'PHASE1_SYSTEM_INSTRUCTION',
                    key_value: `CRITICAL STORYLINE INSTRUCTION:
1. First, define a single overarching "Campaign Theme" for the week that fits the vibe of the request or trends.
2. Then, break this theme down into 3-4 distinct "Storylines" that flow chronologically (e.g., "1. Morning Routine", "2. Afternoon Excursion", "3. Evening Event").
3. The 21 content items MUST logically follow these storylines in consecutive sequence. Do NOT generate 21 random, disconnected ideas.
4. For Carousels/Stories within the same storyline, keep the setting and outfit consistent.`,
                    description: '🧠 AI Directives for Phase 1 (e.g., 21 items, storylines)',
                    is_secret: false
                },
                {
                    key_name: 'PHASE1_JSON_SCHEMA',
                    key_value: `{
  "sequence": 1,
  "content_type": "Post / Carousel / Story",
  "persona": "TARGET_PERSONA",
  "storyline": "Name of the current storyline",
  "topic": "...",
  "theme": "...",
  "sfw_prompt": "Prompt MUST apply the Technical Guide and Persona DNA",
  "prompt_structure": {
    "mood_and_tone": "Overall mood (e.g. moody, bright, romantic)",
    "vibe": "Environment and background details (e.g. messy bedroom, neon street)",
    "lighting": "Lighting details (e.g. morning sun, hard flash)",
    "outfit": "Detailed clothing description",
    "camera_settings": ["Camera for pose 1", "Camera for pose 2", "Camera for pose 3", "Camera for pose 4"],
    "poses": ["Pose 1 description", "Pose 2 description", "Pose 3 description", "Pose 4 description"],
    "nsfw_prompts": ["NSFW modifier for pose 1", "NSFW modifier for pose 2", "NSFW modifier for pose 3", "NSFW modifier for pose 4"],
    "vdo_prompts": ["Video motion prompt for pose 1 (15s duration)", "Video motion prompt for pose 2 (15s duration)", "Video motion prompt for pose 3 (15s duration)", "Video motion prompt for pose 4 (15s duration)"]
  },
  "nsfw_option": true,
  "caption_draft": "..."
}`,
                    description: '🧩 JSON Blueprint for Phase 1 Items (Defines attributes like outfit, lighting)',
                    is_secret: false
                }
            ]

            await supabaseAdmin.from('system_configs').insert(defaults)

            // Fetch again after insert
            const newData = await supabaseAdmin.from('system_configs').select('*').order('created_at', { ascending: true })
            data = newData.data
        }

        return NextResponse.json({ success: true, data })
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    try {
        const { id, key_value } = await request.json()

        // 1. Get the key_name first
        const { data: config, error: fetchErr } = await supabaseAdmin
            .from('system_configs')
            .select('key_name')
            .eq('id', id)
            .single()

        if (fetchErr) throw fetchErr

        // 2. Update the config value
        const { error } = await supabaseAdmin
            .from('system_configs')
            .update({ key_value, is_valid: false })
            .eq('id', id)

        if (error) throw error

        // 3. Retroactive Effect: If it's a production setting, update all Drafts
        if (config.key_name === 'PRODUCTION_BATCH_SIZE' ||
            config.key_name === 'PRODUCTION_WIDTH' ||
            config.key_name === 'PRODUCTION_HEIGHT') {

            const fieldMap: Record<string, string> = {
                'PRODUCTION_BATCH_SIZE': 'batch_size',
                'PRODUCTION_WIDTH': 'image_width',
                'PRODUCTION_HEIGHT': 'image_height'
            }

            const field = fieldMap[config.key_name]
            const numericValue = parseInt(key_value)

            if (!isNaN(numericValue)) {
                await supabaseAdmin
                    .from('content_items')
                    .update({ [field]: numericValue })
                    .eq('status', 'Draft')
            }
        }

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
