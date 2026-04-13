import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'
import { getGCSFileBuffer } from '@/lib/storage'

/**
 * API route to serve images from local storage or GCS proxy
 * Usage: /api/images/path/to/image.png
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path: imagePathList } = await params
    
    // Use forward slashes for GCS but local path.join for FS check
    const gcsPath = imagePathList.join('/')
    const localRelativePath = path.join(...imagePathList)
    const localFullPath = path.join(process.cwd(), 'storage', 'images', localRelativePath)

    let fileBuffer: Buffer | null = null
    let contentType = 'image/png'

    // 1. Try Local Storage first
    if (fs.existsSync(localFullPath)) {
        fileBuffer = fs.readFileSync(localFullPath)
        const ext = path.extname(localFullPath).toLowerCase()
        contentType = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg')
    } 
    // 2. Fallback to GCS Proxy
    else {
        let gcsData = await getGCSFileBuffer(gcsPath)
        
        // 3. Extension Fallback (.webp -> .png)
        if (!gcsData && gcsPath.endsWith('.webp')) {
            const pngPath = gcsPath.replace('.webp', '.png')
            console.log(`[Proxy] WebP not found, trying PNG fallback: ${pngPath}`)
            gcsData = await getGCSFileBuffer(pngPath)
        }

        if (gcsData) {
            fileBuffer = gcsData.buffer
            contentType = gcsData.contentType
        }
    }

    if (!fileBuffer) {
        return new NextResponse('Image not found', { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const width = searchParams.get('w')

    // Resize if width is provided (and it's an image)
    if (width && contentType.startsWith('image/')) {
        const w = parseInt(width)
        if (!isNaN(w) && w > 0) {
            try {
                const resized = await sharp(fileBuffer as any)
                    .resize({ width: w, withoutEnlargement: true })
                    .toBuffer()
                fileBuffer = Buffer.from(resized)
            } catch (err) {
                console.warn('[Proxy] Sharp resize failed:', err)
            }
        }
    }

    return new NextResponse(fileBuffer, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
            'X-Proxy-Source': fs.existsSync(localFullPath) ? 'local' : 'gcs'
        }
    })
}
