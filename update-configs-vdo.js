const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function updateConfigs() {
    console.log('🚀 Updating System Configs...');

    // 1. Update Phase 1 Schema
    const phase1Schema = {
        "sequence": "Number 1-21",
        "content_type": "Post, Carousel, or Story",
        "persona": "TARGET_PERSONA",
        "storyline": "Detailed storyline name",
        "topic": "Ultra-detailed topic description",
        "theme": "Specific aesthetic theme for this item",
        "sfw_prompt": "Master prompt combining all attributes into a high-quality descriptive paragraph",
        "vdo_prompt": "Ultra-detailed cinematic motion/video prompt (15s duration). Describe the lighting shifts, camera movement, and character actions that align with the vibe of the sfw_prompt.",
        "prompt_structure": {
            "mood_and_tone": "Ultra-detailed mood description",
            "vibe": "Ultra-detailed environment description",
            "lighting": "Ultra-detailed lighting description",
            "outfit": "Ultra-detailed clothing and accessory description",
            "camera_settings": ["Ultra-detailed Camera 1", "Ultra-detailed Camera 2", "Ultra-detailed Camera 3", "Ultra-detailed Camera 4"],
            "poses": ["Ultra-detailed Pose 1", "Ultra-detailed Pose 2", "Ultra-detailed Pose 3", "Ultra-detailed Pose 4"],
            "nsfw_prompts": ["NSFW modifier 1", "NSFW modifier 2", "NSFW modifier 3", "NSFW modifier 4"]
        },
        "nsfw_option": true,
        "caption_draft": "Engaging caption in English"
    };

    await supabase.from('system_configs')
        .update({ key_value: JSON.stringify(phase1Schema, null, 2) })
        .eq('key_name', 'PHASE1_JSON_SCHEMA');

    // 2. Update Phase 1 System Instruction
    const phase1Instruction = `CRITICAL PERFORMANCE DIRECTIVES (ULTRA-DETAIL MODE):
1. THEME & STORYLINE:
   - Define a single, high-impact "Campaign Theme".
   - Break it into 3-4 chronological "Storylines".
   - Sequence all 21 items to flow logically within these storylines.

2. ULTRA-DETAIL REQUIREMENT:
   - Topic & Theme: Write descriptive, punchy titles.
   - VDO Prompt: Generate motion descriptions that strictly align with the image vibe. Length must be exactly 15 seconds. Instruct the camera to move (pan, tilt, zoom) or characters to pose subtly.
   - Poses & Cameras: Descriptions MUST be "Ultra-Detailed". Do not say "sitting", say "Slightly leaned back on a velvet armchair, legs crossed elegantly, one hand resting on the chin with a teasing gaze."
   - Outfits: Describe fabrics, fit, colors, and specific items.

3. VARIATION RULE (BATCH OF 4):
   - Every content item MUST have 4 UNIQUE pose descriptions and 4 UNIQUE camera settings.

4. MANDATORY FIELDS:
   - You MUST fill every single field in the JSON schema. "null" or empty strings are FORBIDDEN.`;

    await supabase.from('system_configs')
        .update({ key_value: phase1Instruction })
        .eq('key_name', 'PHASE1_SYSTEM_INSTRUCTION');

    // 3. Insert Global Production Settings
    const globalConfigs = [
        { key_name: 'PRODUCTION_BATCH_SIZE', key_value: '4', description: '💡 จำนวนรูปที่จะเจนในแต่ละ Batch (ค่าเริ่มต้นคือ 4)' },
        { key_name: 'PRODUCTION_WIDTH', key_value: '1024', description: '📐 ความกว้างของรูปที่จะเจน (เช่น 1024 สำหรับสัดส่วน 1:1 หรือ 896 สำหรับ 4:5)' },
        { key_name: 'PRODUCTION_HEIGHT', key_value: '1024', description: '📐 ความสูงของรูปที่จะเจน (เช่น 1024 สำหรับสัดส่วน 1:1 หรือ 1152 สำหรับ 4:5)' }
    ];

    for (const conf of globalConfigs) {
        const { data: existing } = await supabase.from('system_configs').select('id').eq('key_name', conf.key_name).single();
        if (!existing) {
            await supabase.from('system_configs').insert(conf);
        }
    }

    console.log('✅ System Configs Updated Successfully!');
}

updateConfigs();
