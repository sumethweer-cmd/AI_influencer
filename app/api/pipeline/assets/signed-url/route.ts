import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

const BUCKET = 'pipeline-assets'

// Returns a short-lived signed upload token the browser can use to PUT a
// file straight to Supabase Storage, so large files (video clips) never
// pass through this Next.js server and never hit the platform's serverless
// request-body size limit (HTTP 413). createSignedUploadUrl requires the
// service-role key, which is why this has to happen server-side; the token
// it returns is safe to hand to the browser — it only authorizes this one
// upload, to this one path.
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { filename, character, itemId } = body

        if (!filename) {
            return NextResponse.json({ success: false, error: 'filename is required' }, { status: 400 })
        }

        const cleanName = String(filename).replace(/[^a-zA-Z0-9.-]/g, '_')
        const folder = itemId ? `items/${itemId}` : (character || 'shared')
        const path = `${folder}/${Date.now()}-${cleanName}`

        const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path)
        if (error) throw error

        const { data: publicUrlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path)

        return NextResponse.json({
            success: true,
            path: data.path,
            token: data.token,
            publicUrl: publicUrlData.publicUrl,
        })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
