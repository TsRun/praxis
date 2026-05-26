-- Let opening studies start from a custom prefix (e.g. "1.e4 e5 2.Nf3 Nc6")
-- instead of always the standard starting position.
--
-- root_pgn is the SAN move list that the client replayed from the standard
-- start to produce opening_study.root_fen. NULL means "standard start" and is
-- the existing behavior. The FEN itself is the source of truth — root_pgn is
-- kept only so the editor can render the prefix in the breadcrumb.
ALTER TABLE opening_study
  ADD COLUMN IF NOT EXISTS root_pgn TEXT;
