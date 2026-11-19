export type Entry = {
  id: string;
  name: string;
  gk: boolean;
  /** Reserva / lista de espera: não entra no sorteio. */
  reserve: boolean;
};

export type Team = {
  id: string;
  name: string;
  color: string;
  playerIds: string[];
};

export type GamePlayer = { id: string; name: string; goals: number; assists?: number };

export type GameSide = {
  teamId: string;
  name: string;
  color: string;
  players: GamePlayer[];
  /** Gols contra / sem autor. */
  extra: number;
};

/** Gol registrado durante o jogo ao vivo. `at` = ms de bola rolando. */
export type GoalEvent = {
  id: string;
  side: "a" | "b";
  at: number;
  scorerId?: string;
  assistId?: string;
};

export type Game = {
  id: string;
  createdAt: number;
  a: GameSide;
  b: GameSide;
  /** Preenchidos quando o jogo foi disputado no modo ao vivo. */
  durationMs?: number;
  events?: GoalEvent[];
};

/**
 * Jogo em andamento. O cronômetro é derivado do relógio do aparelho
 * (`runningSince` + `elapsedMs`), nunca de um contador de ticks — assim não atrasa
 * com a tela bloqueada, aba em segundo plano ou recarregamento.
 */
export type LiveGame = {
  id: string;
  createdAt: number;
  a: GameSide;
  b: GameSide;
  /** Duração regulamentar em segundos (0 = sem limite). */
  durationSec: number;
  /** Encerra ao atingir esse número de gols de um time (0 = sem limite). */
  goalLimit: number;
  elapsedMs: number;
  runningSince: number | null;
  events: GoalEvent[];
};

export type Match = {
  id: string;
  title: string;
  location: string;
  date: string; // yyyy-mm-dd
  time: string; // HH:mm
  createdAt: number;
  entries: Entry[];
  teams: Team[];
  games: Game[];
  live?: LiveGame | null;
};

export type DB = { version: 1; matches: Match[] };
