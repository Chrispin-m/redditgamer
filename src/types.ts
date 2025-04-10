export type GameType = 'tictactoe' | 'gomoku' | 'dots' | 'connect4' | 'reaction';

export type GameAction =
  | {
      type: 'move';
      game: GameType;
      data: {
        playerId: string;
        position: number | [number, number] | string;
        timestamp: number;
      };
    }
  | {
      type: 'changeGame';
      game: GameType;
      sessionId: string;
    }
  | {
      type: 'joinGame';
      playerId: string;
    };

export type GameState = {
  currentGame: GameType;
  // A list of players (their usernames)
  players: string[];
  maxPlayers: number;
  // The current turn's playerId
  turn: string;
  status: 'waiting' | 'active' | 'finished' | 'draw';
  winner?: string;
  // Optional global username (if needed, e.g. for Reaction game or display purposes)
  username?: string;
  // Boards for specific games
  tictactoe: (string | null)[];
  gomoku: (string | null)[];
  dots: {
    lines: string[];
    boxes: Record<string, string>;
    gridSize: number;
  };
  connect4: (string | null)[][];
  reaction?: {
    // Array of score entries (one per player) for Reaction game
    scores: Array<{ player: string; score: number; avgTime: number; medianTime: number }>;
  };
};
