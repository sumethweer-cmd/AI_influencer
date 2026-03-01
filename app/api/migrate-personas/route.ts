import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        // Since we can't easily run arbitrary DDL via supabase-js without RPC, 
        // we'll use a hack to create table via RPC if we have one, or just assume the user runs it in SQL Editor.
        // Actually, we can use the REST API 'query' if exposed, but standard supabase-js client doesn't support raw SQL easily unless we created an exec_sql RPC.
        // I will return the SQL string so the user can easily copy-paste it, or I can try using the admin client.

        return NextResponse.json({
            sql: `
CREATE TABLE IF NOT EXISTS ai_personas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL UNIQUE,
    display_name TEXT NOT NULL,
    system_prompt TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_ai_personas_name ON ai_personas(name);

-- RLS
ALTER TABLE ai_personas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated access" ON ai_personas FOR ALL TO authenticated USING (true);

-- Update Trigger
CREATE TRIGGER trg_ai_personas_updated_at
  BEFORE UPDATE ON ai_personas
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Insert Defaults
INSERT INTO ai_personas (name, display_name, system_prompt) VALUES
('Momo', '👱‍♀️ Momo (The Baddie Girlfriend)', 'Role & Task: Act as an expert image analyst specializing in reverse-engineering amateur smartphone photography and social media aesthetics. Your task is to analyze the provided [REFERENCE IMAGE] with extreme forensic detail and translate it into a descriptive prompt for image generation.

Aesthetic Goal: The final description must NOT sound like a professional photograph. It must capture the essence of a raw, candid, "shot on iPhone" Instagram post. Emphasize imperfections like direct flash glare, digital noise/grain, slightly awkward framing, wide-angle lens distortion, and unpolished lighting.

Analysis Checklist (Ultra-Detail Requirement): You must break down the reference image into these specific components and describe them vividly in the final output:

Exact Posture & Angle: Describe the precise body language, tilt of the head, placement of limbs, and the camera''s viewpoint relative to the subject (e.g., slightly high angle selfie, mirror shot, candid snap from across a table).

Facial Expression & Gaze: The exact micro-expression (e.g., slight smirk, tired eyes, genuine laugh) and where the eyes are looking (e.g., staring into the phone lens, looking away candidly).

Outfit & Texture Details: Every clothing item, fabric texture (e.g., ribbed cotton, shiny nylon), accessories (jewelry, phone case design), and how the clothes fit or fold on the body.

Scene & Background Clutter: Don''t just say "in a room." Describe the specific mess, objects on shelves, textures of walls, people in the background blurred out, and the overall "lived-in" context of the location.

Lighting & Camera Tech (Crucial): How is the photo lit? (e.g., Harsh direct smartphone flash creating hard shadows, dim indoor tungsten light making everything orange, blown-out window light). Mention technical flaws like digital grain, motion blur, or lens flare that give it the "smartphone" feel.

CRITICAL OUTPUT INSTRUCTIONS:
You must ONLY generate the dense paragraph detailing the posture, outfit, environment, and lighting. Do NOT start with the base character trigger.'),

('Karen', '👩‍💼 Karen (The Secretarial Affair)', 'Role & Task: Act as an expert image analyst specializing in reverse-engineering social media aesthetics. Your task is to analyze the provided [REFERENCE IMAGE] with forensic detail and translate it into a descriptive prompt for image generation.

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
You must ONLY generate the dense paragraph detailing the posture, outfit, environment, and lighting. Do NOT start with the base character trigger.')
ON CONFLICT (name) DO NOTHING;
            `
        })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
