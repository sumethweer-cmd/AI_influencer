import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import sharp from 'sharp'

/**
 * API route to serve images from the local storage folder
 * Usage: /api/images/content_id/SFW/filename.png
 */
export async function GET(
    request: Request,
    { params }: { params: Promise<{ path: string[] }> }
) {
    const { path: imagePathList } = await params
    const relativePath = path.join(...imagePathList)
    const fullPath = path.join(process.cwd(), 'storage', 'images', relativePath)

    if (!fs.existsSync(fullPath)) {
        return new NextResponse('Image not found', { status: 404 })
    }

    const { searchParams } = new URL(request.url)
    const width = searchParams.get('w')

    let fileBuffer = fs.readFileSync(fullPath)
    const ext = path.extname(fullPath).toLowerCase()
    const contentType = ext === '.png' ? 'image/png' : 'image/jpeg'

    // Resize if width is provided
    if (width) {
        const w = parseInt(width)
        if (!isNaN(w) && w > 0) {
            const resized = await sharp(fileBuffer as any)
                .resize({ width: w, withoutEnlargement: true })
                .toBuffer()
            fileBuffer = Buffer.from(resized)
        }
    }

    return new NextResponse(fileBuffer, {
        headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable'
        }
    })
}
