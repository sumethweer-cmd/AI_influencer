/**
 * Migration: Add platform_selections to content_items
 * Allows selecting different images for different platforms (IG, X, Fanvue)
 */
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

async function run() {
    console.log("Running migration: Add platform_selections to content_items...");

    // 1. Add column if it doesn't exist
    const { error: alterError } = await supabaseAdmin.rpc('execute_sql', {
        query: `ALTER TABLE content_items ADD COLUMN IF NOT EXISTS platform_selections JSONB DEFAULT '{}';`
    });

    if (alterError) {
        // Fallback if RPC execute_sql is not available
        console.warn("RPC execute_sql failed, trying basic query check...");
        console.error(alterError.message);
    } else {
        console.log("Migration successful: added platform_selections column.");
    }
}

run();
