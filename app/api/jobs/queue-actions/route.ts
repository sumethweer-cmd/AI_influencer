import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(req: Request) {
    try {
        const { action, jobId, value } = await req.json()

        switch (action) {
            case 'pause':
                if (jobId) {
                    const { error } = await supabaseAdmin.from('production_jobs').update({ status: 'Paused' }).eq('id', jobId).eq('status', 'Pending');
                    if (error) throw error;
                }
                break;
            case 'resume':
                if (jobId) {
                    const { error } = await supabaseAdmin.from('production_jobs').update({ status: 'Pending' }).eq('id', jobId).eq('status', 'Paused');
                    if (error) throw error;
                }
                break;
            case 'cancel':
                if (jobId) {
                    const { error } = await supabaseAdmin.from('production_jobs').delete().eq('id', jobId).in('status', ['Pending', 'Paused', 'Queued']);
                    if (error) throw error;
                }
                break;
            case 'pause_all':
                {
                    const { error } = await supabaseAdmin.from('production_jobs').update({ status: 'Paused' }).eq('status', 'Pending');
                    if (error) throw error;
                }
                break;
            case 'resume_all':
                {
                    const { error } = await supabaseAdmin.from('production_jobs').update({ status: 'Pending' }).eq('status', 'Paused');
                    if (error) throw error;
                }
                break;
            case 'cancel_all':
                {
                    const { error } = await supabaseAdmin.from('production_jobs').delete().in('status', ['Pending', 'Paused', 'Queued']);
                    if (error) throw error;
                }
                break;
            case 'toggle_runpod':
                {
                    const { error } = await supabaseAdmin.from('system_configs').upsert({ key_name: 'AUTO_TERMINATE_RUNPOD', key_value: value ? 'true' : 'false' });
                    if (error) throw error;
                }
                break;
            default:
                return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
        }

        return NextResponse.json({ success: true })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}

export async function GET() {
    try {
        const { data: jobs, error } = await supabaseAdmin
            .from('production_jobs')
            .select(`
                id, status, image_type, slot_index, created_at,
                content_items (id, topic, persona)
            `)
            .in('status', ['Pending', 'Queued', 'Processing', 'Paused'])
            .order('created_at', { ascending: true })

        if (error) throw error

        const { data: config } = await supabaseAdmin
            .from('system_configs')
            .select('key_value')
            .eq('key_name', 'AUTO_TERMINATE_RUNPOD')
            .maybeSingle()

        return NextResponse.json({ 
            success: true, 
            jobs: jobs || [],
            autoTerminate: config?.key_value === 'true'
        })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
