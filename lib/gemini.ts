import { GoogleGenerativeAI } from '@google/generative-ai'
import { WeeklyPlanJSON, QCFeedback } from '@/types'
import { getConfig } from './config'
import { logSystem, supabaseAdmin } from './supabase'

async function getPersonaSystemPrompt(targetPersona: string): Promise<string> {
  const { data } = await supabaseAdmin
    .from('ai_personas')
    .select('system_prompt, instruction_rule, lora_triggers, role_prompt, persona_rules, sfw_critical, nsfw_critical')
    .eq('name', targetPersona)
    .single()

  // ---- Section 1: ROLE ----
  const role = data?.role_prompt || `You are the Creative Marketing Director of Nong Kung Agency, a boutique AI influencer management studio.
Your speciality is crafting ultra-viral, authentic-feeling social media content that blurs the line between real and AI.
You think like a Gen-Z audience — raw, candid, slightly imperfect content performs better than polished studio shots.`

  // ---- Section 2: PERSONA RULES ----
  const rules = data?.persona_rules || data?.system_prompt || `PERSONA: ${targetPersona}
CHARACTER DNA: A realistic, relatable AI influencer with a strong personal aesthetic.
CONTENT PERSONALITY: Candid, spontaneous, authentic.`

  // ---- Section 2b: LoRA Triggers (inject after rules if present) ----
  const loraTriggers = data?.lora_triggers ? `
LORA ACTION TRIGGER LIBRARY (CRITICAL — USE EXACT PHRASES):
Available trigger words installed for ${targetPersona}: [ ${data.lora_triggers} ]
HOW TO USE: Inject these EXACT phrases into 'poses' or 'vibe' ONLY IF the storyline naturally matches that action. Never force-fit them.` : ''

  // ---- Section 4: SFW Critical ----
  const sfwCritical = data?.sfw_critical || data?.instruction_rule || `SFW STANDARDS:
- Shot on iPhone quality — grainy, raw, no studio lighting
- Candid feel — natural expressions, slightly off-center composition
- Real backgrounds — lived-in spaces, not studio sets`

  // ---- Section 5: NSFW Critical ----
  const nsfwCritical = data?.nsfw_critical || `NSFW STANDARDS:
- LOCATION RULE: Public space = wardrobe malfunction / leaking feel (NOT intentionally nude)
- LOCATION RULE: Private space (bedroom/bathroom) = explicit allowed (undressing, topless, suggestive)
- Maximum explicit level: tasteful — no graphic acts, no masturbation`

  return `=== [1. ROLE] ===
${role}

=== [2. PERSONA DNA & RULES] ===
${rules}${loraTriggers}

=== [4a. CRITICAL — SFW IMAGE STANDARDS] ===
${sfwCritical}

=== [4b. CRITICAL — NSFW IMAGE STANDARDS] ===
${nsfwCritical}`
}

async function getBasePrompt(): Promise<string> {
  const basePrompt = await getConfig('PHASE1_BASE_PROMPT')
  return basePrompt || `TECHNICAL PROMPT GUIDE FOR COMFYUI:
- PHOTO QUALITY: Smartphone quality (iPhone) — grainy, raw photo, no studio lighting, natural or harsh direct flash
- ULTRA-DETAIL RULE: Every prompt must describe posture, facial expression, outfit texture, background clutter, and lighting quality in maximum detail
- LANGUAGE: ALL output text and captions MUST be in 100% ENGLISH
- AVOID: Symmetrical compositions, studio backdrops, perfect DSLR bokeh, over-edited aesthetics`
}

function getJsonOutputFormat(personaPrompt: string, basePrompt: string, targetPersona: string) {
  return `${personaPrompt}

=== [3. TECHNICAL GUIDE] ===
${basePrompt.replace('TARGET_PERSONA', targetPersona)}`
}


/**
 * Phase 1: Create Content Matrix based on trends
 */
export async function generateWeeklyPlan(trends: any, targetPersona: string, batchSize: number = 4): Promise<WeeklyPlanJSON> {
  const apiKey = await getConfig('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const systemInstruction = await getConfig('PHASE1_SYSTEM_INSTRUCTION') || 'Generate 21 content items following storylines.'

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

  const prompt = `
    You are the Technical Director of Nong Kung Agency.
    Analyze the following trends from Instagram and X:
    Trends: ${JSON.stringify(trends)}

    Task: Generate a 'Weekly Content Matrix' for an AI Influencer.
    Quantity: 21 content items.
    Mix: Mix of Post, Carousel, and Story.
    Target Persona: ${targetPersona}

    ${systemInstruction}
    
    CRITICAL: For 'camera_settings', 'poses', 'nsfw_prompts', 'vdo_prompts', and 'vdo_prompts_nsfw' in 'prompt_structure', you MUST provide EXACTLY ${batchSize} strings for each. 
    Each string must be a 15-second cinematic motion prompt.
    
    CRITICAL NSFW RULE: When 'nsfw_option' is true, the 'nsfw_prompts' and 'vdo_prompts_nsfw' MUST be highly explicit, provocative, and detailed. 
    
    CRITICAL PERSONA DNA & RULES:
    ${getJsonOutputFormat(await getPersonaSystemPrompt(targetPersona), await getBasePrompt(), targetPersona)}
    
    Generate the response EXACTLY in this JSON structure:
    {
      "week_start": "YYYY-MM-DD",
      "week_end": "YYYY-MM-DD",
      "campaign_theme": "...",
      "trends": {
        "instagram_hashtags": [...],
        "twitter_trends": [...],
        "scraped_at": "..."
      },
      "contents": [
        {
          "sequence": 1,
          "content_type": "Post / Carousel / Story",
          "persona": "${targetPersona}",
          "storyline": "...",
          "topic": "...",
          "theme": "...",
          "sfw_prompt": "...",
          "prompt_structure": {
            "mood_and_tone": "...",
            "vibe": "...",
            "lighting": "...",
            "outfit": "...",
            "camera_settings": ["", "", "", ""],
            "poses": ["", "", "", ""],
            "nsfw_prompts": ["", "", "", ""],
            "vdo_prompts": ["Video 1", "Video 2", "Video 3", "Video 4"],
            "vdo_prompts_nsfw": ["Provocative 1", "Provocative 2", "Provocative 3", "Provocative 4"]
          },
          "nsfw_option": true,
          "caption_draft": "..."
        }
      ]
    }
  `

  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text()
  const usage = response.usageMetadata
  if (usage) {
    await logSystem('INFO', 'Phase1_Planner', 'Tokens Used (Trend)', {
      inputTokens: usage.promptTokenCount,
      outputTokens: usage.candidatesTokenCount,
      totalTokens: usage.totalTokenCount,
      model: 'gemini-3-flash-preview'
    })
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse JSON')
  return JSON.parse(jsonMatch[0])
}

/**
 * Phase 1 Option 2: AI Brainstorming
 */
export async function generatePlanFromPrompt(userPrompt: string, targetPersona: string, batchSize: number = 4): Promise<WeeklyPlanJSON> {
  const apiKey = await getConfig('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const systemInstruction = await getConfig('PHASE1_SYSTEM_INSTRUCTION') || 'Generate 21 content items following storylines.'

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })
  const prompt = `
    You are the Creative Director of Nong Kung Agency, managing an AI Influencer.
    The client has requested the following theme / idea for this week: "${userPrompt}"

    Task: Brainstorm and generate a 'Weekly Content Matrix' for 7 days (3 posts / day, total 21 items).
    Mix of Post, Carousel, and Story.
    Target Persona: ${targetPersona} (Make sure all content perfectly matches this persona's style and vibe).
    
    ${systemInstruction}
    
    CRITICAL: For 'camera_settings', 'poses', 'nsfw_prompts', 'vdo_prompts', and 'vdo_prompts_nsfw' in 'prompt_structure', you MUST provide EXACTLY ${batchSize} strings for each. 
    Each string must be a 15-second cinematic motion prompt.
    
    CRITICAL NSFW RULE: When 'nsfw_option' is true, 'nsfw_prompts' and 'vdo_prompts_nsfw' must be extremely provocative, spicy, and explicit.

    CRITICAL PERSONA DNA & RULES:
    ${getJsonOutputFormat(await getPersonaSystemPrompt(targetPersona), await getBasePrompt(), targetPersona)}
    
    Rules: Captions should be highly engaging and fit the selected Persona.
    Format your response EXACTLY like this JSON structure:
    {
      "week_start": "YYYY-MM-DD",
      "week_end": "YYYY-MM-DD",
      "campaign_theme": "${userPrompt}",
      "trends": {},
      "contents": [
        {
          "sequence": 1,
          "content_type": "Post / Carousel / Story",
          "persona": "${targetPersona}",
          "storyline": "...",
          "topic": "...",
          "theme": "...",
          "sfw_prompt": "...",
          "prompt_structure": {
            "mood_and_tone": "...",
            "vibe": "...",
            "lighting": "...",
            "outfit": "...",
            "camera_settings": ["", "", "", ""],
            "poses": ["", "", "", ""],
            "nsfw_prompts": ["", "", "", ""],
            "vdo_prompts": ["Video 1", "Video 2", "Video 3", "Video 4"],
            "vdo_prompts_nsfw": ["Provocative 1", "Provocative 2", "Provocative 3", "Provocative 4"]
          },
          "nsfw_option": true,
          "caption_draft": "..."
        }
      ]
    }
  `

  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text()
  const usage = response.usageMetadata
  if (usage) {
    await logSystem('INFO', 'Phase1_Planner', 'Tokens Used (Brainstorm)', {
      inputTokens: usage.promptTokenCount,
      outputTokens: usage.candidatesTokenCount,
      totalTokens: usage.totalTokenCount,
      model: 'gemini-3-flash-preview'
    })
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse JSON')
  return JSON.parse(jsonMatch[0])
}

/**
 * Phase 1 Option 3: Reference Image
 */
export async function generatePlanFromImage(imageBase64: string, mimeType: string, customInstruction: string = '', targetPersona: string, batchSize: number = 4): Promise<WeeklyPlanJSON> {
  const apiKey = await getConfig('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const systemInstruction = await getConfig('PHASE1_SYSTEM_INSTRUCTION') || 'Generate 21 content items following storylines.'
  const jsonSchema = await getConfig('PHASE1_JSON_SCHEMA') || '{}'

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })
  const prompt = `
    You are the Creative Director of Nong Kung Agency.
    Analyze the provided reference image. Identify the lighting, style, subject's pose, clothing, and overall mood.
    ${customInstruction ? `Additional Instructions: ${customInstruction}` : ''}

    Task: Using the extracted style from the image, generate a 'Weekly Content Matrix' for an AI Influencer (21 items).
    The prompts should instruct an image generator (like Stable Diffusion) to recreate a similar vibe, style, or pose, but varied across 21 different engaging situations.

    ${systemInstruction}

    CRITICAL: For 'camera_settings', 'poses', 'nsfw_prompts', 'vdo_prompts', and 'vdo_prompts_nsfw' in 'prompt_structure', you MUST provide EXACTLY ${batchSize} strings for each. 
    
    CRITICAL NSFW RULE: If allowed, generate highly explicit and spicy motion prompts.

    IMPORTANT: The generated content MUST strictly belong to the persona: ${targetPersona}. 
    CRITICAL PERSONA DNA & RULES:
    ${getJsonOutputFormat(await getPersonaSystemPrompt(targetPersona), await getBasePrompt(), targetPersona)}

    Format your response EXACTLY like this JSON structure:
    {
      "week_start": "YYYY-MM-DD",
      "week_end": "YYYY-MM-DD",
      "campaign_theme": "...",
      "trends": {},
      "contents": [
        {
          "sequence": 1,
          "content_type": "Post / Carousel / Story",
          "persona": "${targetPersona}",
          "storyline": "...",
          "topic": "...",
          "theme": "...",
          "sfw_prompt": "...",
          "prompt_structure": {
            "mood_and_tone": "...",
            "vibe": "...",
            "lighting": "...",
            "outfit": "...",
            "camera_settings": ["", "", "", ""],
            "poses": ["", "", "", ""],
            "nsfw_prompts": ["", "", "", ""],
            "vdo_prompts": ["Video 1", "Video 2", "Video 3", "Video 4"],
            "vdo_prompts_nsfw": ["Explicit 1", "Explicit 2", "Explicit 3", "Explicit 4"]
          },
          "nsfw_option": true,
          "caption_draft": "..."
        }
      ]
    }
  `

  const imagePart = {
    inlineData: {
      data: imageBase64,
      mimeType
    }
  }

  const result = await model.generateContent([prompt, imagePart])
  const response = await result.response
  const text = response.text()
  const usage = response.usageMetadata
  if (usage) {
    await logSystem('INFO', 'Phase1_Planner', 'Tokens Used (Image)', {
      inputTokens: usage.promptTokenCount,
      outputTokens: usage.candidatesTokenCount,
      totalTokens: usage.totalTokenCount,
      model: 'gemini-3-flash-preview'
    })
  }

  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse JSON')
  return JSON.parse(jsonMatch[0])
}

/**
 * Phase 3: Quality Control check for generated images

 */
export async function performImageQC(imagePath: string, prompt: string): Promise<QCFeedback> {
  const apiKey = await getConfig('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const genAI = new GoogleGenerativeAI(apiKey)
  const visionModel = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

  // Note: Implementation will require fetching local image and converting to base64
  // This is a placeholder for the logic structure
  const visionPrompt = `
    Analyze this AI - generated image for quality and realism.
    Original Prompt: ${prompt}

    Check for:
  - Artifacts(mangled fingers, weird proportions)
    - Face proportions and symmetry
      - Realism and lighting consistency

    Return ONLY a JSON:
{
  "artifacts_detected": ["list of issues"],
    "face_proportion_score": 0 - 100,
      "realism_score": 0 - 100,
        "overall_score": 0 - 100,
          "issues": ["what went wrong"],
            "recommendation": "pass" or "regenerate"
}
`

  console.log('QC check starting for:', imagePath)
  // Logic to send image + prompt to Gemini Vision will be implemented in the Job runner
  return {
    overall_score: 90,
    recommendation: 'pass',
    artifacts_detected: [],
    face_proportion_score: 95,
    realism_score: 85,
    issues: []
  }
}

/**
 * Phase 1.9: Refill missing prompts for expansion
 */
export async function refillPromptStructure(item: any, targetBatchSize: number): Promise<any> {
  const apiKey = await getConfig('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

  const currentCount = item.prompt_structure?.poses?.length || 0
  if (currentCount >= targetBatchSize) return item.prompt_structure

  const prompt = `
    You are the Creative Director. We are expanding a content series.
    Existing Context:
    Topic: "${item.topic}"
    Theme: "${item.theme}"
    Persona: "${item.persona}"
    Current Poses: ${JSON.stringify(item.prompt_structure?.poses || [])}

    Task: We are expanding this content from ${currentCount} images to ${targetBatchSize} images.
    Generate EXACTLY ${targetBatchSize - currentCount} NEW SETS of 'camera_settings', 'poses', 'nsfw_prompts', 'vdo_prompts', and 'vdo_prompts_nsfw'.
    The new items must follow the same style and theme but provide DIFFERENT angles, poses, and actions to avoid repetition.
    
    CRITICAL: For 'vdo_prompts' and 'vdo_prompts_nsfw', provide 15-second cinematic motion descriptions.

    Return ONLY the new elements as a JSON object:
    {
      "new_camera_settings": ["..."],
      "new_poses": ["..."],
      "new_nsfw_prompts": ["..."],
      "new_vdo_prompts": ["..."],
      "new_vdo_prompts_nsfw": ["..."]
    }
  `

  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse refill JSON')
  const newItems = JSON.parse(jsonMatch[0])

  const ps = { ...item.prompt_structure }
  ps.camera_settings = [...(ps.camera_settings || []), ...(newItems.new_camera_settings || [])]
  ps.poses = [...(ps.poses || []), ...(newItems.new_poses || [])]
  ps.nsfw_prompts = [...(ps.nsfw_prompts || []), ...(newItems.new_nsfw_prompts || [])]
  ps.vdo_prompts = [...(ps.vdo_prompts || []), ...(newItems.new_vdo_prompts || [])]
  ps.vdo_prompts_nsfw = [...(ps.vdo_prompts_nsfw || []), ...(newItems.new_vdo_prompts_nsfw || [])]

  return ps
}

/**
 * Phase 1.9: Regenerate a single specific prompt index
 */
export async function refillSinglePrompt(item: any, index: number, type: 'SFW' | 'NSFW' | 'VDO'): Promise<any> {
  const apiKey = await getConfig('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

  const prompt = `
      You are the Creative Director. We need to REGENERATE specific elements for image index ${index} of this content:
      Topic: "${item.topic}"
      Persona: "${item.persona}"
      Current Poses: ${JSON.stringify(item.prompt_structure.poses)}

      Task: Provide a FRESH and BETTER version of the camera setting, pose, and motion prompts for this specific index.
      
      Return ONLY a JSON:
      {
        "camera_setting": "...",
        "pose": "...",
        "nsfw_prompt": "...",
        "vdo_prompt": "...",
        "vdo_prompts_nsfw": "..."
      }
    `

  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text()
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse single refill JSON')
  const fresh = JSON.parse(jsonMatch[0])

  const ps = { ...item.prompt_structure }
  if (ps.camera_settings) ps.camera_settings[index] = fresh.camera_setting
  if (ps.poses) ps.poses[index] = fresh.pose
  if (ps.nsfw_prompts) ps.nsfw_prompts[index] = fresh.nsfw_prompt
  if (ps.vdo_prompts) ps.vdo_prompts[index] = fresh.vdo_prompt
  if (ps.vdo_prompts_nsfw) ps.vdo_prompts_nsfw[index] = fresh.vdo_prompts_nsfw

  return ps
}
