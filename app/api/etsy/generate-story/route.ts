import { NextResponse } from 'next/server'
import { supabase, supabaseAdmin } from '@/lib/supabase'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getConfig } from '@/lib/config'

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { book_id } = body
        
        if (!book_id) return NextResponse.json({ success: false, error: 'book_id required' }, { status: 400 })

        // Get book details
        const { data: book, error: bookErr } = await supabase.from('etsy_books').select('*').eq('id', book_id).single()
        if (bookErr || !book) throw new Error('Book not found')

        // Get Gemini API Key (Priority: ETSY_GEMINI_API_KEY -> Global GEMINI_API_KEY)
        const { data: apiKeyConfig } = await supabase.from('etsy_configs').select('key_value').eq('key_name', 'ETSY_GEMINI_API_KEY').single()
        let apiKey = apiKeyConfig?.key_value?.trim()

        if (!apiKey) {
            apiKey = await getConfig('GEMINI_API_KEY')
        }

        if (!apiKey) throw new Error('ETSY_GEMINI_API_KEY is not configured in Settings')

        // Get Etsy Story Prompt Config
        const { data: promptConfig } = await supabase.from('etsy_configs').select('key_value').eq('key_name', 'ETSY_GEMINI_STORY_PROMPT').single()
        const systemPrompt = promptConfig?.key_value || 'You are an expert children story book author.'

        // Call Gemini
        const modelName = await getConfig('GEMINI_MODEL_NAME') || 'gemini-1.5-flash'
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: modelName })

        const prompt = `
${systemPrompt}

You need to create a complete story for a children's coloring book with the following details:
- Title: ${book.title}
- Theme: ${book.theme || 'General'}
- Target Age: ${book.target_age}
- Total Pages: ${book.total_pages}

TASK:
Write the story divided into exactly ${book.total_pages} pages.
For each page, provide:
1. story_text: 3-5 lines of engaging, age-appropriate story text.
2. image_prompt: A highly detailed diffusion prompt for generating a clean, bold line-art coloring page image that matches the story_text. Make sure to specify "black and white, line art, coloring book style, bold lines, white background, no shading, no greyscale".

OUTPUT FORMAT:
Return ONLY a valid JSON array of objects. Example:
[
  {
    "page_number": 1,
    "story_text": "Once upon a time...",
    "image_prompt": "black and white, line art, coloring book style, a cute little bear walking in the forest, bold lines, white background"
  }
]`

        const result = await model.generateContent(prompt)
        const responseText = result.response.text()
        
        // Extract JSON from response
        const jsonMatch = responseText.match(/\[[\s\S]*\]/)
        if (!jsonMatch) throw new Error('Failed to parse JSON from Gemini response')
        
        const pagesData = JSON.parse(jsonMatch[0])
        
        if (!Array.isArray(pagesData) || pagesData.length === 0) {
            throw new Error('Invalid pages data returned from AI')
        }

        // Insert into etsy_pages
        const inserts = pagesData.map((page: any, index: number) => ({
            book_id: book.id,
            page_number: index + 1,
            story_text: page.story_text,
            image_prompt: page.image_prompt,
            status: 'Draft'
        }))

        // Delete existing pages if re-generating
        await supabaseAdmin.from('etsy_pages').delete().eq('book_id', book.id)
        
        const { error: insertErr } = await supabaseAdmin.from('etsy_pages').insert(inserts)
        if (insertErr) throw insertErr

        return NextResponse.json({ success: true, message: 'Story generated successfully', pageCount: inserts.length })

    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
