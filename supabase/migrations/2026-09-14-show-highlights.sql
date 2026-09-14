-- Show highlights: editors choose which projects the VR tour visits, and in what order.
-- Safe to run more than once.
ALTER TABLE "Projects"
  ADD COLUMN IF NOT EXISTS "IsShowHighlight" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "ShowOrder" INT;

CREATE INDEX IF NOT EXISTS "IX_Projects_ShowHighlight"
  ON "Projects" ("IsShowHighlight", "ShowOrder");
