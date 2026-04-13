import { NextResponse } from 'next/server'
import { listGCSFiles } from '@/lib/storage'

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url)
        const id = searchParams.get('id')

        if (!id) {
            return NextResponse.json({ success: false, error: 'Content Item ID is required' }, { status: 400 })
        }

        // List files in the images/[id] folder
        // This will include subfolders like SFW/ and NSFW/
        const folderPath = `images/${id}`
        const files = await listGCSFiles(folderPath)

        // Filter out junk or webp duplicates if needed, but let the frontend handle it
        // High-level filter: only keep files that look like images or videos
        const filteredFiles = files.filter(f => 
            f.endsWith('.png') || 
            f.endsWith('.jpg') || 
            f.endsWith('.jpeg') || 
            f.endsWith('.webp') || 
            f.endsWith('.mp4') || 
            f.endsWith('.mov')
        )

        return NextResponse.json({
            success: true,
            files: filteredFiles
        })
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 })
    }
}
