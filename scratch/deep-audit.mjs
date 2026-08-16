import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

async function deepAudit() {
    console.log("🕵️ Deep Audit: Checking all schemas for size...")
    
    const query = `
        SELECT 
            schemaname as schema, 
            relname as name, 
            pg_size_pretty(pg_total_relation_size(relid)) as total_size,
            pg_total_relation_size(relid) as size_bytes
        FROM pg_catalog.pg_stat_user_tables
        UNION ALL
        SELECT 
            schemaname as schema, 
            relname as name, 
            pg_size_pretty(pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname))) as total_size,
            pg_total_relation_size(quote_ident(schemaname) || '.' || quote_ident(relname)) as size_bytes
        FROM pg_catalog.pg_tables 
        WHERE schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY size_bytes DESC
        LIMIT 20;
    `
    
    // Since I can't run raw SQL easily via MCP if it's restricted, 
    // I'll try to use a RPC if one exists, or check common internal tables specifically.
    
    console.log("Checking common internal tables...")
    
    // We'll try to check storage bucket sizes too
    const { data: buckets, error: bError } = await supabase.storage.listBuckets()
    if (buckets) {
        console.log("📦 Storage Buckets:")
        buckets.forEach(b => console.log(`   - ${b.name}`))
    }
    
    console.log("\n⚠️ Manual Check Required: Please run the following in Supabase SQL Editor to see the true culprit:")
    console.log(`
SELECT
    schema_name,
    relname,
    pg_size_pretty(table_size) AS size,
    table_size
FROM (
    SELECT
        pg_catalog.pg_namespace.nspname AS schema_name,
        relname,
        pg_relation_size(pg_catalog.pg_class.oid) AS table_size
    FROM pg_catalog.pg_class
    JOIN pg_catalog.pg_namespace ON relnamespace = pg_catalog.pg_namespace.oid
) t
WHERE schema_name NOT IN ('pg_catalog', 'information_schema')
ORDER BY table_size DESC
LIMIT 20;
    `);
}

deepAudit()
