import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { getConfig } from '@/lib/config'

function parseAgeRange(targetAge: string): { min: number, max: number } {
    const matches = (targetAge || '').match(/\d+/g)
    if (matches && matches.length >= 2) return { min: parseInt(matches[0]), max: parseInt(matches[1]) }
    if (matches && matches.length === 1) return { min: parseInt(matches[0]), max: parseInt(matches[0]) }
    return { min: 4, max: 8 }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { book_id } = body
        if (!book_id) return NextResponse.json({ success: false, error: 'book_id required' }, { status: 400 })

        const { data: book, error: bookErr } = await supabase.from('etsy_books').select('*, etsy_pages(*)').eq('id', book_id).single()
        if (bookErr || !book) throw new Error('Book not found')

        const pages = (book.etsy_pages || []).sort((a: any, b: any) => a.page_number - b.page_number)
        if (pages.length === 0) throw new Error('Generate the story first — no pages found for this book')

        const { min: ageMin, max: ageMax } = parseAgeRange(book.target_age)
        const occasions: string[] = (book.occasion && book.occasion.length) ? book.occasion : ['gifts for kids']
        const learningGoal = book.learning_goal || 'a simple everyday life skill, explained through a fun story'
        const storyText = pages.map((p: any) => p.story_text).join(' ')

        // Get Gemini API Key (Priority: ETSY_GEMINI_API_KEY -> Global GEMINI_API_KEY)
        const { data: apiKeyConfig } = await supabase.from('etsy_configs').select('key_value').eq('key_name', 'ETSY_GEMINI_API_KEY').single()
        let apiKey = apiKeyConfig?.key_value?.trim()
        if (!apiKey) apiKey = await getConfig('GEMINI_API_KEY')
        if (!apiKey) throw new Error('ETSY_GEMINI_API_KEY is not configured in Settings')

        let modelName = await getConfig('GEMINI_MODEL_NAME') || 'gemini-3.1-flash-lite'
        if (modelName === 'gemini-1.5-flash') modelName = 'gemini-3.1-flash-lite'
        const genAI = new GoogleGenerativeAI(apiKey)
        const model = genAI.getGenerativeModel({ model: modelName })

        const prompt = `
You are writing an Etsy product description for a printable kids story coloring book.

Book details:
- Title: ${book.title}
- Theme: ${book.theme || 'N/A'}
- Full story text (for context, do not copy verbatim): ${storyText}
- Learning goal: ${learningGoal}
- Age range: ${ageMin}–${ageMax} years
- Pages: ${book.total_pages}
- Occasions: ${occasions.join(', ')}

Write the description following this exact structure:
1. Opening Hook (2-3 sentences, max 160 chars, include the phrase "printable kids coloring book PDF" and the phrase "gift for kids" and the age range "ages ${ageMin}–${ageMax}")
2. 📖 In this story: (1 sentence summarizing the story above)
3. 🌟 Your child will learn: (1 sentence based on the learning goal)
4. ✅ What's included: (bullet list — must mention "${book.total_pages} printable story coloring pages", "PDF format — instant download", "US Letter size (8.5" x 11")", "Black & white, printer-friendly", "Print unlimited times!")
5. 🖨️ How to use: (numbered 1-3: purchase and download instantly / print at home or any print shop / color, read, and enjoy together!)
6. 🌿 Perfect For: (bullet list using the provided occasions plus "Quiet time activities", "Classroom rewards", and "Kids ages ${ageMin}–${ageMax}")
7. 💡 Why You'll Love It: (bullet list)
8. AI disclosure note at the end, exactly: "Note: Illustrations in this book were created with AI assistance."

Rules:
- English only
- Warm, friendly, parent-facing tone (not written for the child)
- Use bullet symbol • not dash -
- No markdown headers, no ** bold **, no ## headers
- Total 250-350 words
- Max 3000 characters
- Must contain the word "printable" at least twice
- Must contain "instant download"
- Must contain "PDF" at least once
- Return ONLY the description text, nothing else (no preamble, no explanation)`

        const result = await model.generateContent(prompt)
        const description = result.response.text().trim()

        await supabase.from('etsy_books').update({ etsy_description: description }).eq('id', book_id)

        return NextResponse.json({ success: true, description })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
