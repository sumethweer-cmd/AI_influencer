-- Add 'Queued for Production' to content_status enum
-- We use a DO block to safely add it if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM pg_enum 
        JOIN pg_type ON pg_enum.enum_typid = pg_type.oid 
        WHERE pg_type.typname = 'content_status' 
        AND pg_enum.enumlabel = 'Queued for Production'
    ) THEN
        ALTER TYPE content_status ADD VALUE 'Queued for Production';
    END IF;
END
$$;
