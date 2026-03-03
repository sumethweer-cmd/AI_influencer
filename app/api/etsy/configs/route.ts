import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
    try {
        const { data, error } = await supabase.from('etsy_configs').select('*').order('key_name')
        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function PUT(req: Request) {
    try {
        const body = await req.json()
        const { id, key_value } = body

        if (!id || typeof key_value === 'undefined') {
            return NextResponse.json({ success: false, error: 'Missing parameters' }, { status: 400 })
        }

        const { data, error } = await supabase
            .from('etsy_configs')
            .update({ key_value })
            .eq('id', id)
            .select()

        if (error) throw error
        return NextResponse.json({ success: true, data: data[0] })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
