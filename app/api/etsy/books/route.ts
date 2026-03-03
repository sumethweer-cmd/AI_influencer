import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET() {
    try {
        const { data, error } = await supabase.from('etsy_books').select('*, etsy_pages(count)').order('created_at', { ascending: false })
        if (error) throw error
        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { title, theme, target_age, total_pages } = body
        
        if (!title || !target_age) {
            return NextResponse.json({ success: false, error: 'Title and target_age are required' }, { status: 400 })
        }

        const { data, error } = await supabase.from('etsy_books').insert([{
            title, theme, target_age, total_pages: parseInt(total_pages) || 8
        }]).select()
        
        if (error) throw error
        return NextResponse.json({ success: true, data: data[0] })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
