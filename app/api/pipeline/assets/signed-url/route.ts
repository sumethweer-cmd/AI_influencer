import { NextResponse } from 'next/server'
import { getSignedUploadUrl, gcsBucketName } from '@/lib/storage'

// Returns a short-lived signed URL the browser can PUT a file to directly,
// so large files (video clips) never pass through this Next.js server and
// never hit the platform's serverless request-body size limit (HTTP 413).
export async function POST(req: Request) {
    try {
        const body = await req.json()
        const { filename, contentType, character, itemId } = body

        if (!filename || !contentType) {
            return NextResponse.json({ success: false, error: 'filename and contentType are required' }, { status: 400 })
        }

        const cleanName = String(filename).replace(/[^a-zA-Z0-9.-]/g, '_')
        const folder = itemId ? `items/${itemId}` : (character || 'shared')
        const objectPath = `${folder}/${Date.now()}-${cleanName}`

        const uploadUrl = await getSignedUploadUrl('pipeline-assets', objectPath, contentType)
        const publicUrl = `https://storage.googleapis.com/${gcsBucketName}/pipeline-assets/${objectPath}`

        return NextResponse.json({
            success: true,
            uploadUrl,
            publicUrl,
            storagePath: `pipeline-assets/${objectPath}`,
        })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
