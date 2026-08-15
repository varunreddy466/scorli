-- Match local SQLite scores.points which is REAL (IEEE 754 double).
alter table public.scores
  alter column points type double precision;
