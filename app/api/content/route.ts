import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const page = parseInt(searchParams.get('page') || '1')
        const limit = parseInt(searchParams.get('limit') || '20')
        const persona = searchParams.get('persona') || 'All'
        const status = searchParams.get('status') || 'All'
        const contentFilter = searchParams.get('contentFilter') || 'All'
        const sortOrder = searchParams.get('sortOrder') || 'desc'

        const offset = (page - 1) * limit

        // 1. Build Base Query for Counting Total Items
        let countQuery = supabaseAdmin
            .from('content_items')
            .select('*', { count: 'exact', head: true })

        if (persona !== 'All') countQuery = countQuery.eq('persona', persona)
        if (status !== 'All') countQuery = countQuery.eq('status', status)
        if (contentFilter === 'SFW') countQuery = countQuery.eq('gen_sfw', true).eq('gen_nsfw', false)
        if (contentFilter === 'NSFW') countQuery = countQuery.eq('gen_nsfw', true)

        const { count, error: countError } = await countQuery
        if (countError) throw countError

        // 2. Build Query for Fetching Data
        let query = supabaseAdmin
            .from('content_items')
            .select(`
                *,
                storyline,
                weekly_plans(campaign_theme),
                generated_images:generated_images!generated_images_content_item_id_fkey(*)
            `)

        if (persona !== 'All') query = query.eq('persona', persona)
        if (status !== 'All') query = query.eq('status', status)
        if (contentFilter === 'SFW') query = query.eq('gen_sfw', true).eq('gen_nsfw', false)
        if (contentFilter === 'NSFW') query = query.eq('gen_nsfw', true)

        // 3. Apply Sorting and Pagination
        query = query.order('created_at', { ascending: sortOrder === 'asc' })
        query = query.range(offset, offset + limit - 1)

        const { data, error } = await query

        if (error) throw error

        return NextResponse.json({
            success: true,
            data,
            pagination: {
                totalCount: count || 0,
                currentPage: page,
                limit,
                totalPages: Math.ceil((count || 0) / limit)
            }
        })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
