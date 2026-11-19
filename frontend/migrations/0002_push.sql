-- Notificações Web Push: aparelhos inscritos e avisos agendados
CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  uid TEXT NOT NULL,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_push_subs_uid ON push_subscriptions (uid);

CREATE TABLE IF NOT EXISTS push_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  uid TEXT NOT NULL,
  grp TEXT NOT NULL,          -- ex.: "live:<id>", "match:<id>" (substituído em bloco)
  send_at INTEGER NOT NULL,   -- epoch ms
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '/',
  tag TEXT NOT NULL DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_push_schedule_due ON push_schedule (send_at);
CREATE INDEX IF NOT EXISTS idx_push_schedule_grp ON push_schedule (uid, grp);

-- Avaliações passam a ser ligadas à conta Google (uma por pessoa, editável)
ALTER TABLE reviews ADD COLUMN uid TEXT;
ALTER TABLE reviews ADD COLUMN photo TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS idx_reviews_uid ON reviews (uid) WHERE uid IS NOT NULL;
