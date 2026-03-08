import { NextResponse } from 'next/server'
import sharp from 'sharp'

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url)
    const url = searchParams.get('url')

    if (!url) {
        return NextResponse.json({ success: false, error: 'url parameter required' }, { status: 400 })
    }

    try {
        const response = await fetch(url)
        if (!response.ok) throw new Error(`Failed to fetch image: ${response.statusText}`)

        const arrayBuffer = await response.arrayBuffer()
        const buffer = Buffer.from(arrayBuffer)

        // Convert to PNG to ensure compatibility with pdf-lib and handle WebP
        const pngBuffer = await sharp(buffer)
            .png()
            .toBuffer()

        return new Response(new Uint8Array(pngBuffer), {
            headers: {
                'Content-Type': 'image/png',
                'Cache-Control': 'public, max-age=3600',
            }
        })
    } catch (e: any) {
        console.error('[Proxy-Image] Error:', e)
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
