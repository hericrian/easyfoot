-- Avaliações públicas do EasyFoot
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT NOT NULL DEFAULT '',
  created_at INTEGER NOT NULL,
  -- hash do IP (com sal) só para limitar envios; o IP em si nunca é guardado
  ip_hash TEXT NOT NULL,
  -- moderação: UPDATE reviews SET hidden = 1 WHERE id = ?;
  hidden INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_reviews_visible ON reviews (hidden, id DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_ip ON reviews (ip_hash, created_at);
