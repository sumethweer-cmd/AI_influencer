import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getActivePods, waitForComfyUI } from '@/lib/runpod'
import axios from 'axios'

/**
 * GET /api/media/download-original?imageId=xxx
 * 
 * Tries to fetch the original PNG from RunPod Network Volume via ComfyUI.
 * Falls back to the Supabase WebP URL if Pod is offline or original_path is missing.
 */
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get('imageId')

    if (!imageId) {
        return NextResponse.json({ error: 'imageId is required' }, { status: 400 })
    }

    // 1. Fetch image record - need original_path, file_path, file_name, media_type
    const { data: img, error: imgErr } = await supabaseAdmin
        .from('generated_images')
        .select('id, original_path, file_path, file_name, image_type, slot_index, media_type')
        .eq('id', imageId)
        .single()

    if (imgErr || !img) {
        return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // 2. Try to load original PNG from RunPod if original_path exists
    if (img.original_path) {
        try {
            // Get active RunPod instance
            const activePods = await getActivePods()
            const runningPod = activePods.find((p: any) => p.desiredStatus === 'RUNNING')

            if (runningPod) {
                const comfyUrl = await waitForComfyUI(runningPod.id)
                
                // Extract filename from path: /workspace/ComfyUI/output/filename.png
                const filename = img.original_path.split('/').pop()
                const downloadUrl = `${comfyUrl}/view?filename=${encodeURIComponent(filename)}&subfolder=&type=output`

                const response = await axios.get(downloadUrl, {
                    responseType: 'arraybuffer',
                    timeout: 15000
                })

                const buffer = Buffer.from(response.data)
                const contentType = response.headers['content-type'] || 'image/png'
                const ext = contentType.includes('png') ? 'png' : 'webp'
                const downloadFilename = `${img.image_type || 'image'}_original_${img.slot_index ?? ''}.${ext}`

                return new NextResponse(buffer, {
                    headers: {
                        'Content-Type': contentType,
                        'Content-Disposition': `attachment; filename="${downloadFilename}"`,
                        'X-Source': 'runpod-network-volume'
                    }
                })
            }
        } catch (runpodErr: any) {
            console.warn(`RunPod original unavailable for ${imageId}, falling back to Supabase:`, runpodErr.message)
        }
    }

    // 3. Fallback: Proxy from Supabase file URL (WebP) instead of Redirecting (CORS issues)
    const fallbackUrl = img.file_path
    if (!fallbackUrl) {
        return NextResponse.json({ error: 'No file available' }, { status: 404 })
    }

    try {
        const response = await fetch(fallbackUrl)
        if (!response.ok) throw new Error(`Failed to fetch fallback: ${response.statusText}`)

        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)
        const contentType = response.headers.get('content-type') || (img.media_type === 'video' ? 'video/mp4' : 'image/webp')
        const ext = img.media_type === 'video' ? 'mp4' : (contentType.includes('png') ? 'png' : 'webp')
        const downloadFilename = `${img.image_type || 'media'}_${img.slot_index ?? ''}.${ext}`

        return new NextResponse(buffer, {
            headers: {
                'Content-Type': contentType,
                'Content-Disposition': `attachment; filename="${downloadFilename}"`,
                'X-Source': 'supabase-media-fallback-proxy'
            }
        })
    } catch (err: any) {
        console.error(`Fallback proxy failed for ${imageId}:`, err.message)
        // Last resort: redirect anyway, though it might fail CORS in fetch
        return NextResponse.redirect(fallbackUrl, {
            headers: { 'X-Source': 'supabase-media-fallback-redirect' }
        })
    }
}

