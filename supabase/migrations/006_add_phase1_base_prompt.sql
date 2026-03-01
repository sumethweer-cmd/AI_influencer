-- ============================================================
-- Migration: Add Phase 1 Global Base Prompt
-- ============================================================

INSERT INTO system_configs (key_name, key_value, description, is_secret) VALUES
('PHASE1_BASE_PROMPT', 'TECHNICAL PROMPT GUIDE FOR COMFYUI:
- DO NOT USE: Cinematic, Masterpiece, High Fashion, Studio Lighting, 8k, Unreal Engine.
- MUST USE: grainy, smartphone quality, slight motion blur, digital noise, raw photo, direct flash (if applicable), uncentered composition, casual framing, messy background, slight imperfections.

LANGUAGE RULE:
- ALL captions (caption_draft) MUST be written in 100% ENGLISH. Do not use Thai or any other language for the captions.

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
}', '📜 Global instructions for Phase 1 (Instructions, Technical Guide, JSON Structure)', false)
ON CONFLICT (key_name) DO NOTHING;
