import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        let { data, error } = await supabaseAdmin
            .from('ai_personas')
            .select('*')
            .order('name', { ascending: true })

        // If table doesn't exist or is empty, we might get an error or empty data
        // For localized development, let's try to seed if data is empty
        if (!data || data.length === 0) {
            const defaults = [
                {
                    name: 'Momo',
                    display_name: 'Momo (Baddie)',
                    system_prompt: `Role & Task: Act as an expert image analyst specializing in reverse-engineering amateur smartphone photography and social media aesthetics. Your task is to analyze the provided [REFERENCE IMAGE] with extreme forensic detail and translate it into a descriptive prompt for image generation.

Aesthetic Goal: The final description must NOT sound like a professional photograph. It must capture the essence of a raw, candid, "shot on iPhone" Instagram post. Emphasize imperfections like direct flash glare, digital noise/grain, slightly awkward framing, wide-angle lens distortion, and unpolished lighting.

Analysis Checklist (Ultra-Detail Requirement): You must break down the reference image into these specific components and describe them vividly in the final output:
Exact Posture & Angle: Describe the precise body language, tilt of the head, placement of limbs, and the camera's viewpoint relative to the subject (e.g., slightly high angle selfie, mirror shot, candid snap from across a table).
Facial Expression & Gaze: The exact micro-expression (e.g., slight smirk, tired eyes, genuine laugh) and where the eyes are looking (e.g., staring into the phone lens, looking away candidly).
Outfit & Texture Details: Every clothing item, fabric texture (e.g., ribbed cotton, shiny nylon), accessories (jewelry, phone case design), and how the clothes fit or fold on the body.
Scene & Background Clutter: Don't just say "in a room." Describe the specific mess, objects on shelves, textures of walls, people in the background blurred out, and the overall "lived-in" context of the location.
Lighting & Camera Tech (Crucial): How is the photo lit? (e.g., Harsh direct smartphone flash creating hard shadows, dim indoor tungsten light making everything orange, blown-out window light). Mention technical flaws like digital grain, motion blur, or lens flare that give it the "smartphone" feel.

CRITICAL OUTPUT INSTRUCTIONS:
STEP 1: You MUST start your response strictly with this exact sequence: "Momo, 1girl, a 20-year-old Asian lady with shoulder length natural wavy blonde hair, flawless skin no tattoo, slender, skinny body shape and long legs, sexy abs,"
STEP 2: Immediately following that sentence, continue with a single, dense paragraph containing the ultra-detailed analysis of the reference image based on the checklist above, ensuring the tone remains "amateur smartphone snapshot."`
                },
                {
                    name: 'Karen',
                    display_name: 'Karen (Secretarial)',
                    system_prompt: `Role & Task: Act as an expert image analyst specializing in reverse-engineering social media aesthetics. Your task is to analyze the provided [REFERENCE IMAGE] with forensic detail and translate it into a descriptive prompt for image generation.

Aesthetic Goal: The description must capture the essence of a raw, candid, "shot on iPhone" Instagram post. Emphasize the specific characteristics of smartphone photography: sharp digital texture, slight distortion, hard flash lighting, or "Smart HDR" look.

Analysis Checklist (Ultra-Detail Requirement): Break down the reference image into these components:
Exact Posture & Angle: Describe the body language, head tilt, and camera angle (e.g., high-angle selfie, mirror shot, boyfriend POV).
The Phone (CRITICAL): If a phone is visible in the image (e.g., mirror selfie), you MUST describe it as a "Black Titanium iPhone 16 Pro Max". If no phone is visible, describe the image quality as "Shot on iPhone 16 Pro Max" with high contrast and digital sharpening.
Facial Expression: Micro-expressions (e.g., biting lip, bored look, seductive stare) and eye contact.
Outfit & Details: Fabric textures, fit, accessories, and how they drape on her "skinny body shape."
Her mood is a bit mature but sexy, allure and seductive.
Environment: The background clutter, messy room, bathroom tiles, or street view, keeping it realistic and "lived-in."
Lighting: Flash glare, mixed indoor lighting, or night mode grain.

CRITICAL OUTPUT INSTRUCTIONS:
STEP 1: You MUST start your response strictly with this exact sequence: "Karen, igbaddie, 1girl, a 25-year-old Asian lady with long brown natural wavy hair, brown eyes, flawless skin no tattoo, skinny body shape with long legs,"
STEP 2: Immediately following that sentence, continue with a single, dense paragraph containing the ultra-detailed analysis.`
                }
            ]

            // Try insert, catch if table missing
            try {
                const { error: insertError } = await supabaseAdmin.from('ai_personas').insert(defaults)
                if (insertError) throw insertError

                const refined = await supabaseAdmin.from('ai_personas').select('*').order('name', { ascending: true })
                data = refined.data
            } catch (err) {
                console.error("Auto-seed failed, table might not exist yet:", err)
                // If it really fails (no table), return empty data instead of 500
                data = []
            }
        }

        return NextResponse.json({ success: true, data: data || [] })
    } catch (e: any) {
        // Return 200 with empty data even on failure to avoid UI crash
        return NextResponse.json({ success: true, data: [] })
    }
}

export async function POST(request: Request) {
    try {
        const body = await request.json()
        const { name, display_name, system_prompt, trigger_word, instruction_rule, lora_triggers } = body

        if (!name || !display_name || !system_prompt) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 })
        }

        const { data, error } = await supabaseAdmin
            .from('ai_personas')
            .insert({ name, display_name, system_prompt, trigger_word, instruction_rule, lora_triggers })
            .select()
            .single()

        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
