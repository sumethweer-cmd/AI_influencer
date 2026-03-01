const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function run() {
    const newConfigs = [
        {
            key_name: 'PHASE1_SYSTEM_INSTRUCTION',
            key_value: `CRITICAL PERFORMANCE DIRECTIVES (ULTRA-DETAIL MODE):
1. THEME & STORYLINE:
   - Define a single, high-impact "Campaign Theme".
   - Break it into 3-4 chronological "Storylines".
   - Sequence all 21 items to flow logically within these storylines.

2. ULTRA-DETAIL REQUIREMENT:
   - Topic & Theme: Write descriptive, punchy titles.
   - Poses & Cameras: Descriptions MUST be "Ultra-Detailed". Do not say "sitting", say "Slightly leaned back on a velvet armchair, legs crossed elegantly, one hand resting on the chin with a teasing gaze."
   - Outfits: Describe fabrics, fit, colors, and specific items (e.g., "Sheer black lace bodysuit under a tailored white silk blazer").
   - Vibe & Lighting: Be cinematic and atmospheric.

3. VARIATION RULE (BATCH OF 4):
   - Every content item MUST have 4 UNIQUE pose descriptions and 4 UNIQUE camera settings.
   - DO NOT REPEAT THE SAME POSE. Variances must be distinct (e.g., Close-up, Wide shot, Profile, Low angle).
   - ALL 4 SLOTS IN THE ARRAYS MUST BE FILLED.

4. MANDATORY FIELDS:
   - You MUST fill every single field in the JSON schema. "null" or empty strings are FORBIDDEN.`,
            description: '🧠 AI Directives for Phase 1 (Ultra-Detail & 21 items)',
            is_secret: false
        },
        {
            key_name: 'PHASE1_JSON_SCHEMA',
            key_value: `{
  "sequence": "Number 1-21",
  "content_type": "Post, Carousel, or Story",
  "persona": "TARGET_PERSONA",
  "storyline": "Detailed storyline name",
  "topic": "Ultra-detailed topic description",
  "theme": "Specific aesthetic theme for this item",
  "sfw_prompt": "Master prompt combining all attributes into a high-quality descriptive paragraph",
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
}`,
            description: '🧩 JSON Blueprint for Phase 1 Items (Defines attributes like outfit, lighting)',
            is_secret: false
        }
    ];

    for (const conf of newConfigs) {
        const { data, error } = await supabaseAdmin
            .from('system_configs')
            .upsert(conf, { onConflict: 'key_name' });

        if (error) {
            console.error("Error inserting", conf.key_name, error.message);
        } else {
            console.log("Successfully inserted/updated:", conf.key_name);
        }
    }
}

run();
