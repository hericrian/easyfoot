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

export type GamePlayer = { id: string; name: string; goals: number };

export type GameSide = {
  teamId: string;
  name: string;
  color: string;
  players: GamePlayer[];
  /** Gols contra / sem autor. */
  extra: number;
};

export type Game = {
  id: string;
  createdAt: number;
  a: GameSide;
  b: GameSide;
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
};

export type DB = { version: 1; matches: Match[] };
