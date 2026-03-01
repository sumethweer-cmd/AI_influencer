/**
 * Migration: Update Momo Persona Instruction Rule
 * Applies the Ultra-Detail checklist and makes iPhone conditional for Momo.
 */
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function run() {
    const momoInstruction = `Aesthetic Goal: The final description must capture the essence of a raw, candid, "shot on iPhone" Instagram post. Emphasize imperfections like direct flash glare, digital noise/grain, slightly awkward framing, and unpolished lighting.

Analysis Checklist (Ultra-Detail Requirement):
- Exact Posture & Angle: Candid and unpolished body language, head tilt, and awkward camera angles.
- The Phone (CONDITIONAL): ONLY if the pose is a "Mirror Selfie" or if a phone is explicitly visible in the shot, you MUST describe it as a "Space Black iPhone 16 Pro". If no mirror or phone is involved, do NOT mention the phone model.
- Facial Expression: Candid, unpolished, and spontaneous micro-expressions.
- Outfit & Details: Fabric textures, fit, and accessories described with unpolished realism.
- Her mood is spontaneous, energetic, and raw.
- Environment: Unpolished and spontaneous backgrounds (e.g., messy bedroom, candid street scene, unedited interiors).
- Lighting: Direct flash glare, harsh shadows, and smartphone night-mode grain.`;

    const { error } = await supabaseAdmin
        .from('ai_personas')
        .update({ instruction_rule: momoInstruction })
        .eq('name', 'Momo');

    if (error) {
        console.error("Error updating Momo:", error.message);
    } else {
        console.log("Successfully updated Momo's instruction_rule to be conditional and ultra-detailed.");
    }
}

run();
