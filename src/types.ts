export type GameType = 'tictactoe' | 'gomoku' | 'dots' | 'connect4';

export type GameAction = 
  | { 
      type: 'move';
      game: GameType;
      data: {
        playerId: string;
        position: number | [number, number] | string;
        timestamp: number;
      }
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

export type WebViewMessage = 
  | { type: 'gameAction'; data: GameAction }
  | { type: 'requestState'; sessionId: string }
  | { type: 'webViewReady' };

export type DevvitMessage = 
  | { 
      type: 'gameState';
      data: GameState;
      sessionId: string;
      timestamp: number;
    }
  | { 
      type: 'error';
      code: number;
      message: string;
      recoverable: boolean;
    };

export type GameState = {
  currentGame: GameType;
  players: string[];
  maxPlayers: number;
  turn: string;
  status: 'waiting' | 'active' | 'finished' | 'draw';
  winner?: string;
  tictactoe: (string | null)[];
  gomoku: (string | null)[];
  dots: {
    lines: string[];
    boxes: Record<string, string>;
    gridSize: number;
  };
  connect4: (string | null)[][];
};
