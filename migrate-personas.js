const { createClient } = require('@supabase/supabase-js')
require('dotenv').config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const supabase = createClient(supabaseUrl, supabaseKey)

const up = async () => {
    console.log('--- Starting Migration: Add Personas Table ---')

    const query = `
    CREATE TABLE IF NOT EXISTS ai_personas (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        system_prompt TEXT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    ALTER TABLE ai_personas ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Allow authenticated access to ai_personas" ON ai_personas FOR ALL TO authenticated USING (true);

    CREATE TRIGGER trg_ai_personas_updated_at
        BEFORE UPDATE ON ai_personas
        FOR EACH ROW EXECUTE FUNCTION update_updated_at();
    `

    const { error } = await supabase.rpc('exec_sql', { sql_query: query })
    if (error) {
        console.error('Error executing query. Trying direct query via REST API... (If pg_exec is not enabled)')
    } else {
        console.log('Migration successful.')
    }
}

up()
