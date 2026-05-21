-- Drop tables and columns that were defined but never written to in code.
--   opening_annotation: never INSERT/UPDATE/DELETE'd; only COUNT(*)'d as a
--     progress denominator that always evaluated to 0. Superseded by
--     opening_chapter (node-keyed, title-only) and node_quiz_state.
--   opening_visit:      never INSERT/UPDATE/DELETE'd; only COUNT(*)'d as the
--     numerator of the same dead progress query.
--   player.{sex, rapid_rating, blitz_rating, birth_year}: populated by
--     scripts/load-fide.ts but never read by any route or query.

DROP TABLE IF EXISTS opening_annotation;
DROP TABLE IF EXISTS opening_visit;

ALTER TABLE player
  DROP COLUMN IF EXISTS sex,
  DROP COLUMN IF EXISTS rapid_rating,
  DROP COLUMN IF EXISTS blitz_rating,
  DROP COLUMN IF EXISTS birth_year;
