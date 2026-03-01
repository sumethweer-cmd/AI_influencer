/**
 * Migration: Update Karen Persona Instruction Rule
 * Fixes the "Always showing iPhone" issue by making it conditional.
 */
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function run() {
    const newInstruction = `Aesthetic Goal: The description must capture the essence of a raw, candid, "shot on iPhone" Instagram post. Emphasize the specific characteristics of smartphone photography.

Analysis Checklist (Ultra-Detail Requirement):
- Exact Posture & Angle: Body language, head tilt, and camera angle.
- The Phone (CONDITIONAL): ONLY if the pose is a "Mirror Selfie" or if a phone is explicitly visible in the shot, you MUST describe it as a "Black Titanium iPhone 16 Pro Max". If no mirror or phone is involved, do NOT mention the phone model.
- Facial Expression: Micro-expressions and eye contact.
- Outfit & Details: Fabric textures, fit, accessories.
- Her mood is a bit mature but sexy, allure and seductive.
- Environment: Realistic and "lived-in" backgrounds (e.g., messy room, luxury closet, urban street).
- Lighting: Flash glare, direct smartphone flash, or night mode grain.`;

    const { error } = await supabaseAdmin
        .from('ai_personas')
        .update({ instruction_rule: newInstruction })
        .eq('name', 'Karen');

    if (error) {
        console.error("Error updating persona:", error.message);
    } else {
        console.log("Successfully updated Karen's instruction_rule to be conditional.");
    }
}

run();
