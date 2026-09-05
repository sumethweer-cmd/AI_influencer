-- Adds a time-of-day component to scheduling. scheduled_date (date) already
-- tracks which day an item is planned for; scheduled_time (time) tracks what
-- time of day it should be posted, so a recommended slot can be set in
-- advance instead of only picking a day.
alter table public.pipeline_content_items
    add column if not exists scheduled_time time;
