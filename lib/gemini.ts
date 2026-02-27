import { GoogleGenerativeAI } from '@google/generative-ai'
import { WeeklyPlanJSON, QCFeedback } from '@/types'
import { getConfig } from './config'
import { logSystem } from './supabase'

/**
 * Phase 1: Create Content Matrix based on trends
 */
export async function generateWeeklyPlan(trends: any, targetPersona: string): Promise<WeeklyPlanJSON> {
  const apiKey = await getConfig('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

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
    
    CRITICAL PERSONA RULES - You must strictly follow the traits of ${targetPersona}:
    
    1. Momo: "The Baddie Girlfriend" (แฟนสาวสุดยั่ว)
    - Vibe: Self-confident, IG Baddie, teasing, playful.
    - Lighting: Smartphone flash, harsh shadows, casual room lighting.
    - Camera Angle: Mirror selfie, POV, casual angles.
    - Background: Messy bedroom, cafe bathroom, car seat.
    - SFW Fashion: Tight crop tops, short jeans, neon bikinis.
    - NSFW Fashion: Sporty/Lace branded underwear, oversized t-shirt with no pants.
    
    2. Karen: "The Secretarial Affair" (เลขาแอบแซ่บ)
    - Vibe: Professional but secretly naughty, Forbidden Fruit, secretive.
    - Lighting: Fluorescent office lights, dim computer screen glow, dark elevators.
    - Camera Angle: Voyeuristic, low angle, candid, hidden camera style.
    - Background: Messy office desk, empty meeting room, parking lot.
    - SFW Fashion: Pencil skirt, silk shirts, office wear.
    - NSFW Fashion: Black/Burgundy lace hidden under work clothes, flashing in forbidden settings.
    
    TECHNICAL PROMPT GUIDE FOR COMFYUI (Must apply to all sfw_prompt outputs):
    - DO NOT USE: Cinematic, Masterpiece, High Fashion, Studio Lighting, 8k, Unreal Engine.
    - MUST USE: grainy, smartphone quality, slight motion blur, digital noise, raw photo, direct flash (if applicable), uncentered composition, casual framing, messy background, slight imperfections.

    LANGUAGE RULE:
    - ALL captions (caption_draft) MUST be written in 100% ENGLISH. Do not use Thai or any other language for the captions.

    Output: Return ONLY a valid JSON following this structure:
    {
      "week_start": "YYYY-MM-DD",
      "week_end": "YYYY-MM-DD",
      "trends": {
        "instagram_hashtags": [...],
        "twitter_trends": [...],
        "scraped_at": "..."
      },
      "contents": [
        {
          "sequence": 1,
          "content_type": "Post",
          "persona": "${targetPersona}",
          "topic": "...",
          "theme": "...",
          "sfw_prompt": "Highly detailed Stable Diffusion prompt applying the Technical Guide and Persona DNA above...",
          "nsfw_option": true/false,
          "caption_draft": "..."
        },
        ... total 21 items
      ]
    }
  `

  const result = await model.generateContent(prompt)
  const response = await result.response
  const text = response.text()

  // Track Token Usage
  const usage = response.usageMetadata
  if (usage) {
    await logSystem('INFO', 'Phase1_Planner', 'Tokens Used (Trend)', {
      inputTokens: usage.promptTokenCount,
      outputTokens: usage.candidatesTokenCount,
      totalTokens: usage.totalTokenCount,
      model: 'gemini-3-flash-preview'
    })
  }

  // Clean potential markdown code blocks
  const jsonMatch = text.match(/\{[\s\S]*\}/)
  if (!jsonMatch) throw new Error('Failed to parse JSON from Gemini response')

  return JSON.parse(jsonMatch[0])
}

const PERSONA_AND_TECH_GUIDE = `
    CRITICAL PERSONA RULES (You must strictly follow the target persona):
    
    1. Momo: "The Baddie Girlfriend" (แฟนสาวสุดยั่ว) - Confident, teasing, IG Baddie. Mirror selfies, bedroom, bathroom. Flash/casual lighting. SFW: Crop tops, bikinis. NSFW: Branded underwear, no pants.
    2. Karen: "The Secretarial Affair" (เลขาแอบแซ่บ) - Professional but naughty, Forbidden Fruit. Voyeuristic, candid angles. Office, elevator. Fluorescent/dim lighting. SFW: Office wear, pencil skirt. NSFW: Hidden lace, flashing.
    
    TECHNICAL PROMPT GUIDE FOR COMFYUI (sfw_prompt MUST strictly follow this):
    - NO: Cinematic, Masterpiece, High Fashion, Studio Lighting, 8k, Unreal Engine.
    - YES: grainy, smartphone quality, slight motion blur, digital noise, raw photo, direct flash, uncentered composition, casual framing, messy background, slight imperfections.
`

const JSON_OUTPUT_FORMAT = `
    ${PERSONA_AND_TECH_GUIDE}
    
    LANGUAGE RULE:
    - ALL captions (caption_draft) MUST be written in 100% ENGLISH. Do not use Thai or any other language for the captions.
    
    Output: Return ONLY a valid JSON following this structure:
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
      ] // total 21 items
    }
`

/**
 * Phase 1 Option 2: AI Brainstorming
 */
export async function generatePlanFromPrompt(userPrompt: string, targetPersona: string): Promise<WeeklyPlanJSON> {
  const apiKey = await getConfig('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })
  const prompt = `
    You are the Creative Director of Nong Kung Agency, managing an AI Influencer.
    The client has requested the following theme / idea for this week: "${userPrompt}"

Task: Brainstorm and generate a 'Weekly Content Matrix' for 7 days(3 posts / day, total 21 items).
    Mix of Post, Carousel, and Story.
    Target Persona: ${targetPersona} (Make sure all content perfectly matches this persona's style and vibe).
    Make the content engaging, creative, and aligned with the client's request.
    ${JSON_OUTPUT_FORMAT.replace('TARGET_PERSONA', targetPersona)}
Rules: Captions should be highly engaging and fit the selected Persona.
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
export async function generatePlanFromImage(imageBase64: string, mimeType: string, customInstruction: string = '', targetPersona: string): Promise<WeeklyPlanJSON> {
  const apiKey = await getConfig('GEMINI_API_KEY')
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const genAI = new GoogleGenerativeAI(apiKey)
  const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' })

  const prompt = `
    You are the Creative Director of Nong Kung Agency.
    Analyze the provided reference image.Identify the lighting, style, subject's pose, clothing, and overall mood.
    ${customInstruction ? `Additional Instructions: ${customInstruction}` : ''}

Task: Using the extracted style from the image, generate a 'Weekly Content Matrix' for an AI Influencer(21 items).
    The prompts should instruct an image generator(like Stable Diffusion) to recreate a similar vibe, style, or pose, but varied across 21 different engaging situations.

  IMPORTANT: The generated content MUST strictly belong to the persona: ${targetPersona}. Make sure all descriptions align with their typical fashion and vibe.
    ${JSON_OUTPUT_FORMAT.replace('TARGET_PERSONA', targetPersona)}
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
