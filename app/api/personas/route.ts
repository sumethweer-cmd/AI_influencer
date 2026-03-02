import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        const { data, error } = await supabaseAdmin
            .from('ai_personas')
            .select('id, name, display_name, trigger_word, lora_triggers, role_prompt, persona_rules, sfw_critical, nsfw_critical, system_prompt, instruction_rule')
            .order('name', { ascending: true })

        if (error) throw error
        return NextResponse.json({ success: true, data: data || [] })
    } catch (e: any) {
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

export async function PUT(request: Request) {
    try {
        const body = await request.json()
        const { id, role_prompt, persona_rules, sfw_critical, nsfw_critical, lora_triggers, system_prompt, instruction_rule } = body

        if (!id) return NextResponse.json({ success: false, error: 'Missing id' }, { status: 400 })

        const { error } = await supabaseAdmin
            .from('ai_personas')
            .update({ role_prompt, persona_rules, sfw_critical, nsfw_critical, lora_triggers, system_prompt, instruction_rule })
            .eq('id', id)

        if (error) throw error
        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
