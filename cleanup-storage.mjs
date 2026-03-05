import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, '.env.local') })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing Supabase credentials in .env.local')
    process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseServiceKey)

async function cleanupStorage() {
    console.log('🔄 Starting Storage Cleanup for "content" bucket...')

    try {
        // 1. Fetch ALL files from the 'content' bucket using pagination
        console.log('-> Fetching file list from Storage...')
        let allFiles = []
        let offset = 0
        const limit = 1000

        while (true) {
            const { data: files, error: listError } = await supabase.storage.from('content').list('', {
                limit: limit,
                offset: offset,
            })
            if (listError) throw listError
            if (!files || files.length === 0) break;

            allFiles = allFiles.concat(files)
            offset += limit
        }

        if (allFiles.length === 0) {
            console.log('✅ Bucket is empty. Nothing to clean.')
            return
        }

        // Filter out folders (e.g. '.emptyFolderPlaceholder')
        const actualFiles = allFiles.filter(f => f.id)
        console.log(`-> Found ${actualFiles.length} files in 'content' bucket.`)

        // 2. Fetch all generated_images from the database
        console.log('-> Fetching all database records for generated_images...')
        const { data: dbImages, error: dbError } = await supabase
            .from('generated_images')
            .select('file_path')

        if (dbError) throw dbError

        const referencedFilenames = new Set(
            dbImages
                .map(img => {
                    if (!img.file_path) return null
                    const parts = img.file_path.split('/')
                    return parts[parts.length - 1]
                })
                .filter(Boolean)
        )

        console.log(`-> Found ${referencedFilenames.size} unique filenames referenced in database.`)

        // 3. Find orphaned files
        const orphanedFiles = actualFiles
            .map(f => f.name)
            .filter(filename => !referencedFilenames.has(filename))

        console.log(`-> 🗑️ Found ${orphanedFiles.length} orphaned files to delete.`)

        if (orphanedFiles.length > 0) {
            console.log('-> Deleting orphaned files (in batches of 100)...')

            const batchSize = 100
            let totalDeleted = 0

            for (let i = 0; i < orphanedFiles.length; i += batchSize) {
                const batch = orphanedFiles.slice(i, i + batchSize)
                const { error: removeError } = await supabase.storage.from('content').remove(batch)

                if (removeError) {
                    console.error(`❌ Error deleting batch ${i / batchSize + 1}:`, removeError)
                } else {
                    totalDeleted += batch.length
                    console.log(`   Deleted ${totalDeleted}/${orphanedFiles.length} files...`)
                }
            }

            console.log(`✅ Successfully deleted ${totalDeleted} orphaned files! Storage should be much lighter now.`)
        } else {
            console.log('✅ No orphaned files found! Storage is clean.')
        }

    } catch (error) {
        console.error('❌ Cleanup failed:', error)
    }
}

cleanupStorage()
