// Cleanup script: delete generated_images and storage files that have no parent content_item
// Run with: node cleanup_orphaned_images.mjs or node cleanup_orphaned_images.mjs --dry-run

import { createClient } from '@supabase/supabase-js'
import * as dotenv from 'dotenv'
import { readFileSync } from 'fs'

// Load env from .env.local
try {
    const envFile = readFileSync('.env.local', 'utf8')
    envFile.split('\n').forEach(line => {
        const [key, ...vals] = line.split('=')
        if (key && vals.length) process.env[key.trim()] = vals.join('=').trim()
    })
} catch (e) {
    // Ignore
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const BUCKET = 'content'
const DRY_RUN = process.argv.includes('--dry-run')

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
    process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

function extractBucketPath(url) {
    if (!url) return null
    const match = url.match(/\/public\/content\/(.+)$/)
    if (match && match[1]) return match[1]
    const parts = url.split('/')
    return parts[parts.length - 1]
}

async function main() {
    console.log(`\n🧹 Orphaned Image Cleanup${DRY_RUN ? ' [DRY RUN — nothing will be deleted]' : ' [LIVE MODE]'}\n`)
    console.log(`Supabase: ${SUPABASE_URL}\n`)

    // Step 1: Get all valid content_item IDs
    console.log('Fetching all content_items...')
    const { data: validItems, error: ciErr } = await supabase
        .from('content_items')
        .select('id')
    if (ciErr) { console.error('Failed to fetch content_items:', ciErr.message); process.exit(1) }
    const validIds = new Set((validItems || []).map(r => r.id))
    console.log(`  → ${validIds.size} content items found`)

    // Step 2: Get all generated_images
    console.log('Fetching all generated_images...')
    const { data: allImages, error: imgErr } = await supabase
        .from('generated_images')
        .select('id, file_path, file_name, content_item_id, created_at')
    if (imgErr) { console.error('Failed to fetch generated_images:', imgErr.message); process.exit(1) }
    console.log(`  → ${allImages.length} image records found`)

    // Step 3: Filter orphaned
    const orphaned = (allImages || []).filter(img => !validIds.has(img.content_item_id))

    if (orphaned.length === 0) {
        console.log('\n✅ No orphaned images found! Bucket is already clean.\n')
        return
    }

    console.log(`\n⚠️  Found ${orphaned.length} orphaned image records:\n`)
    orphaned.forEach(img => {
        const path = img.file_path || img.file_name || '(no path)'
        console.log(`  [${img.id}] content_item_id: ${img.content_item_id}\n    path: ${path}\n`)
    })

    if (DRY_RUN) {
        console.log('⚠️  DRY RUN — no changes made. Run without --dry-run to delete.\n')
        return
    }

    // Step 4: Delete from Supabase Storage
    const storagePaths = orphaned.map(img => extractBucketPath(img.file_path)).filter(Boolean)
    if (storagePaths.length > 0) {
        console.log(`\n🗑️  Deleting ${storagePaths.length} files from storage bucket '${BUCKET}'...`)
        const chunkSize = 100
        for (let i = 0; i < storagePaths.length; i += chunkSize) {
            const chunk = storagePaths.slice(i, i + chunkSize)
            const { error: storageErr } = await supabase.storage.from(BUCKET).remove(chunk)
            if (storageErr) {
                console.warn(`  ⚠️  Storage warning: ${storageErr.message}`)
            } else {
                console.log(`  ✓ Deleted chunk ${Math.floor(i / chunkSize) + 1}`)
            }
        }
    }

    // Step 5: Delete orphaned DB records
    const orphanedIds = orphaned.map(img => img.id)
    console.log(`\n🗑️  Deleting ${orphanedIds.length} orphaned records from DB...`)
    const chunkSize = 200
    for (let i = 0; i < orphanedIds.length; i += chunkSize) {
        const chunk = orphanedIds.slice(i, i + chunkSize)
        const { error: dbErr } = await supabase.from('generated_images').delete().in('id', chunk)
        if (dbErr) {
            console.error('  ❌ DB delete error:', dbErr.message)
        } else {
            console.log(`  ✓ Deleted DB chunk ${Math.floor(i / chunkSize) + 1}`)
        }
    }

    console.log(`\n✅ Done! Removed ${orphaned.length} orphaned image records and their storage files.\n`)
}

main().catch(err => { console.error('Fatal error:', err); process.exit(1) })
