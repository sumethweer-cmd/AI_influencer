import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        let { data, error } = await supabaseAdmin
            .from('system_configs')
            .select('*')
            .order('created_at', { ascending: true })

        if (error) throw error

        // Auto-seed defaults if table is empty
        if (!data || data.length === 0) {
            const defaults = [
                { key_name: 'GEMINI_API_KEY', key_value: '', description: '🔑 ไปที่ Google AI Studio (aistudio.google.com) > Create API Key > Copy มาวางที่นี่ (ใช้สำหรับวิเคราะห์เทรนด์และ QC)', is_secret: true },
                { key_name: 'APIFY_API_TOKEN', key_value: '', description: '🌐 ไปที่ Apify Console > Settings > Integrations > Copy API Token (ใช้สำหรับขูดข้อมูลเทรนด์)', is_secret: true },
                { key_name: 'RUNPOD_API_KEY', key_value: '', description: '☁️ ไปที่ Runpod Console > Settings > API Keys > Create New Key (ใช้สำหรับเปิดเครื่อง GPU เจนรูป)', is_secret: true },
                { key_name: 'RUNPOD_TEMPLATE_ID', key_value: '', description: '📋 ใส่ Template ID ของ ComfyUI (ถ้าไม่มีจะใช้ค่าเริ่มต้นให้)', is_secret: false },
                { key_name: 'TELEGRAM_BOT_TOKEN', key_value: '', description: '🤖 ทัก @BotFather ใน Telegram > /newbot > Copy HTTP API Token ที่ได้มาวางที่นี่', is_secret: true },
                { key_name: 'TELEGRAM_CHAT_ID', key_value: '', description: '👤 ทัก @userinfobot ใน Telegram เพื่อดู Chat ID ของคุณและนำมาวางที่นี่ (เพื่อให้ Bot ส่งงานหาคุณได้)', is_secret: false },
                { key_name: 'TWITTER_API_V2_KEYS', key_value: '', description: '𝕏 ไปที่ developer.x.com > Projects & Apps > Keys and Tokens > Gen Consumer Keys & Access Tokens (ใช้สำหรับโพสต์งานอัตโนมัติ)', is_secret: true }
            ]

            await supabaseAdmin.from('system_configs').insert(defaults)

            // Fetch again after insert
            const newData = await supabaseAdmin.from('system_configs').select('*').order('created_at', { ascending: true })
            data = newData.data
        }

        return NextResponse.json({ success: true, data })
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}

export async function PUT(request: Request) {
    try {
        const { id, key_value } = await request.json()

        const { error } = await supabaseAdmin
            .from('system_configs')
            .update({ key_value, is_valid: false })
            .eq('id', id)

        if (error) throw error

        return NextResponse.json({ success: true })
    } catch (err: any) {
        return NextResponse.json({ success: false, error: err.message }, { status: 500 })
    }
}
