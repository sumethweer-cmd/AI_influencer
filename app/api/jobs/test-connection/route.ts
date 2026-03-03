import { NextResponse } from 'next/server'
import { getConfig, updateConfigStatus } from '@/lib/config'
import axios from 'axios'
import { GoogleGenerativeAI } from '@google/generative-ai'

/**
 * API route to test connection for various services
 */
export async function POST(request: Request) {
    const { keyName } = await request.json()
    const key = await getConfig(keyName)

    if (!key) return NextResponse.json({ success: false, error: 'Key not found' }, { status: 404 })

    try {
        let success = false
        let error = ''

        switch (keyName) {
            case 'GEMINI_API_KEY':
                let modelName = await getConfig('GEMINI_MODEL_NAME') || 'gemini-2.5-flash'
                if (modelName === 'gemini-1.5-flash') modelName = 'gemini-2.5-flash'
                const genAI = new GoogleGenerativeAI(key)
                const model = genAI.getGenerativeModel({ model: modelName })
                await model.generateContent('Hi')
                success = true
                break

            case 'APIFY_API_TOKEN':
                const apifyRes = await axios.get(`https://api.apify.com/v2/users/me?token=${key}`)
                success = apifyRes.status === 200
                break

            case 'RUNPOD_API_KEY':
                const runpodRes = await axios.post('https://api.runpod.io/graphql',
                    { query: '{ myself { id } }' },
                    { headers: { 'Authorization': `Bearer ${key}` } }
                )
                success = !!runpodRes.data.data?.myself
                break

            case 'TELEGRAM_BOT_TOKEN':
                const tgRes = await axios.get(`https://api.telegram.org/bot${key}/getMe`)
                success = tgRes.data.ok
                break

            default:
                // For simple text values like Chat ID, just mark as valid if not empty
                success = true
        }

        if (success) {
            await updateConfigStatus(keyName, true)
            return NextResponse.json({ success: true })
        } else {
            return NextResponse.json({ success: false, error: 'Invalid response from provider' })
        }

    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message })
    }
}
