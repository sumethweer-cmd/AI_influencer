import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export async function GET() {
    try {
        // Find the most recent active or completed job
        // Active jobs shouldn't be cached, so we always query the latest
        const { data, error } = await supabaseAdmin
            .from('production_jobs')
            .select('*')
            .order('started_at', { ascending: false })
            .limit(1)
            .single()

        if (error) {
            if (error.code === 'PGRST116') {
                return NextResponse.json({ success: true, data: null }) // No jobs found
            }
            throw error
        }

        return NextResponse.json({ success: true, data })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
