-- docs/spec.md "イベント > 項目 > URL": a web page about the event (http/https only), opened from
-- the event detail. NULL when not set.
ALTER TABLE events ADD COLUMN url TEXT;
