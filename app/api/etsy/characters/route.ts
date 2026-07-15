import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
    try {
        const { data, error } = await supabase.from('etsy_characters').select('*').order('name')
        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { name, species, appearance, personality, reference_image_url } = body

        if (!name) {
            return NextResponse.json({ success: false, error: 'name is required' }, { status: 400 })
        }

        const { data, error } = await supabase.from('etsy_characters').insert([{
            name, species, appearance, personality, reference_image_url
        }]).select()

        if (error) throw error
        return NextResponse.json({ success: true, data: data[0] })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
