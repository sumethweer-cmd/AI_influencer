import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
    try {
        const { data: jobs, error } = await supabaseAdmin
            .from('production_jobs')
            .select('status')
            .neq('status', 'Completed')
            .neq('status', 'Failed')
        
        const { data: counts, error: countError } = await supabaseAdmin
            .rpc('get_job_stats') // I might need to implement this as SQL or just do counts here

        // Simple aggregation here if RPC doesn't exist
        const { count: total } = await supabaseAdmin.from('production_jobs').select('*', { count: 'exact', head: true })
        const { count: completed } = await supabaseAdmin.from('production_jobs').select('*', { count: 'exact', head: true }).eq('status', 'Completed')
        const { count: processing } = await supabaseAdmin.from('production_jobs').select('*', { count: 'exact', head: true }).eq('status', 'Processing')
        const { count: failed } = await supabaseAdmin.from('production_jobs').select('*', { count: 'exact', head: true }).eq('status', 'Failed')

        return NextResponse.json({
            success: true,
            stats: {
                total: total || 0,
                completed: completed || 0,
                processing: processing || 0,
                failed: failed || 0,
                pending: (total || 0) - (completed || 0) - (processing || 0) - (failed || 0)
            }
        })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
