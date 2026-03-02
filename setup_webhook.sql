-- Create the Webhook Trigger using pg_net extension (Standard Supabase approach)
CREATE OR REPLACE FUNCTION trigger_phase2_edge_function()
RETURNS trigger AS $$
BEGIN
  IF NEW.status = 'In Production' AND OLD.status = 'Queued for Production' THEN
    PERFORM net.http_post(
        url := 'https://mpuoaljjopccqhiafgkq.supabase.co/functions/v1/process-phase2-batch',
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || current_setting('request.jwt.env', true)::jsonb->>'anon_key'
        ),
        body := jsonb_build_object(
            'type', 'UPDATE',
            'table', 'content_items',
            'record', row_to_json(NEW),
            'old_record', row_to_json(OLD)
        )
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Map to trigger
DROP TRIGGER IF EXISTS trg_phase2_edge_function ON content_items;
CREATE TRIGGER trg_phase2_edge_function
AFTER UPDATE ON content_items
FOR EACH ROW
EXECUTE FUNCTION trigger_phase2_edge_function();
