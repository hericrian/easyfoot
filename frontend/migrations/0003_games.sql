-- Jogos publicados para o ranking compartilhado (todos veem, só quem enviou edita)
CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,          -- id do jogo gerado no app
  uid TEXT NOT NULL,            -- conta Google de quem registrou
  grp TEXT NOT NULL,            -- horário fixo + local (ex.: "2-20:00-21:00|arena x")
  grp_label TEXT NOT NULL,      -- "Terça · 20h às 21h · Arena X"
  played_at INTEGER NOT NULL,
  data TEXT NOT NULL,           -- JSON { a, b } com jogadores, gols e assistências
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_games_grp ON games (grp, played_at DESC);
CREATE INDEX IF NOT EXISTS idx_games_played ON games (played_at DESC);
