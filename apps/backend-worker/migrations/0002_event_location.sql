-- docs/spec.md "イベント > 項目 > 場所": where the event takes place (place name, address or
-- coordinates), shown on a map in the event detail. NULL when not set.
ALTER TABLE events ADD COLUMN location TEXT;
