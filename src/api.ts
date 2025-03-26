import type { RedisClient } from '@devvit/public-api';
import type { GameState, GameAction, GameType } from './types';

export class GameAPI {
  static async getGameState(redis: RedisClient, postId: string): Promise<GameState> {
    const state = await redis.get(`gameState:${postId}`);
    return state ? JSON.parse(state) : this.createInitialState();
  }

  static async saveGameState(redis: RedisClient, postId: string, state: GameState): Promise<void> {
    try {
      await redis.set(`gameState:${postId}`, JSON.stringify(state));
    } catch (error) {
      throw new Error(`Failed to save game state: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  static async initializeGame(
    redis: RedisClient,
    postId: string,
    gameType: GameType,
    maxPlayers: number
  ): Promise<void> {
    const initialState: GameState = {
      currentGame: gameType,
      players: [],
      maxPlayers,
      turn: '',
      // For standard games:
      tictactoe: Array(9).fill(null),
      gomoku: Array(225).fill(null),
      dots: { lines: [], boxes: {}, gridSize: 5 },
      connect4: Array.from({ length: 7 }, () => Array(6).fill(null)),
      // For Reaction Speed, you may store additional data if desired.
      reactionSpeed: gameType === 'reactionSpeed' ? { scores: [] } : undefined,
      status: 'waiting',
      winner: null,
    };

    await this.saveGameState(redis, postId, initialState);
  }

  private static createInitialState(): GameState {
    return {
      currentGame: 'tictactoe',
      players: [],
      maxPlayers: 2,
      turn: '',
      tictactoe: Array(9).fill(null),
      gomoku: Array(225).fill(null),
      dots: { lines: [], boxes: {}, gridSize: 5 },
      connect4: Array.from({ length: 7 }, () => Array(6).fill(null)),
      reactionSpeed: undefined,
      status: 'waiting',
      winner: null,
    };
  }

  static processMove(state: GameState, action: GameAction): GameState {
    if (state.status === 'finished') {
      throw new Error('Game has already ended');
    }
    if (!state.players.includes(action.data.playerId)) {
      throw new Error('Player not registered in this game');
    }
    if (state.turn !== action.data.playerId) {
      throw new Error('Not your turn');
    }

    // Create a shallow copy of the state.
    const newState = { ...state };

    // For reactionSpeed, moves are handled by the web view directly.
    if (state.currentGame === 'reactionSpeed') {
      // No board move processing needed for Reaction Speed.
      return newState;
    }

    switch (state.currentGame) {
      case 'tictactoe':
        return this.processTicTacToeMove(newState, action);
      case 'gomoku':
        return this.processGomokuMove(newState, action);
      case 'dots':
        return this.processDotsMove(newState, action);
      case 'connect4':
        return this.processConnect4Move(newState, action);
      default:
        throw new Error(`Unsupported game type: ${state.currentGame}`);
    }
  }

  private static processTicTacToeMove(state: GameState, action: GameAction): GameState {
    const position = action.data.position as number;
    if (position < 0 || position > 8 || state.tictactoe[position]) {
      throw new Error('Invalid move');
    }
    state.tictactoe[position] = action.data.playerId;
    state.turn = state.players.find(p => p !== action.data.playerId) || '';
    const winPatterns = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6]
    ];
    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (
        state.tictactoe[a] &&
        state.tictactoe[a] === state.tictactoe[b] &&
        state.tictactoe[a] === state.tictactoe[c]
      ) {
        state.winner = action.data.playerId;
        state.status = 'finished';
        break;
      }
    }
    if (!state.winner && state.tictactoe.every(cell => cell !== null)) {
      state.status = 'draw';
    }
    return state;
  }

  private static processConnect4Move(state: GameState, action: GameAction): GameState {
    const column = action.data.position as number;
    if (column < 0 || column >= 7) throw new Error('Invalid column');
    const colArray = state.connect4[column];
    const row = colArray.lastIndexOf(null);
    if (row === -1) throw new Error('Column full');
    state.connect4[column][row] = action.data.playerId;
    state.turn = state.players.find(p => p !== action.data.playerId) || '';
    const directions = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1]
    ];
    for (const [dx, dy] of directions) {
      let count = 1;
      for (let i = 1; i < 4; i++) {
        const x = column + dx * i;
        const y = row + dy * i;
        if (x < 0 || x >= 7 || y < 0 || y >= 6) break;
        if (state.connect4[x][y] === action.data.playerId) count++;
        else break;
      }
      for (let i = 1; i < 4; i++) {
        const x = column - dx * i;
        const y = row - dy * i;
        if (x < 0 || x >= 7 || y < 0 || y >= 6) break;
        if (state.connect4[x][y] === action.data.playerId) count++;
        else break;
      }
      if (count >= 4) {
        state.winner = action.data.playerId;
        state.status = 'finished';
        break;
      }
    }
    return state;
  }

  private static processDotsMove(state: GameState, action: GameAction): GameState {
    const lineKey = action.data.position as string;
    if (state.dots.lines.includes(lineKey)) {
      throw new Error('Line already exists');
    }
    state.dots.lines.push(lineKey);
    let boxesCompleted = 0;
    const gridSize = state.dots.gridSize;
    for (let x = 0; x < gridSize - 1; x++) {
      for (let y = 0; y < gridSize - 1; y++) {
        const top = `${x},${y},${x + 1},${y}`;
        const bottom = `${x},${y + 1},${x + 1},${y + 1}`;
        const left = `${x},${y},${x},${y + 1}`;
        const right = `${x + 1},${y},${x + 1},${y + 1}`;
        if ([top, bottom, left, right].every(l => state.dots.lines.includes(l))) {
          const boxKey = `${x},${y}`;
          if (!state.dots.boxes[boxKey]) {
            state.dots.boxes[boxKey] = action.data.playerId;
            boxesCompleted++;
          }
        }
      }
    }
    state.turn = boxesCompleted > 0 
      ? action.data.playerId 
      : state.players.find(p => p !== action.data.playerId) || '';
    if (Object.keys(state.dots.boxes).length === Math.pow(gridSize - 1, 2)) {
      const scores: Record<string, number> = {};
      for (const player of Object.values(state.dots.boxes)) {
        scores[player] = (scores[player] || 0) + 1;
      }
      state.winner = Object.entries(scores).sort((a, b) => b[1] - a[1])[0][0];
      state.status = 'finished';
    }
    return state;
  }

  private static processGomokuMove(state: GameState, action: GameAction): GameState {
    const [x, y] = action.data.position as [number, number];
    const index = y * 15 + x;
    if (x < 0 || x >= 15 || y < 0 || y >= 15 || state.gomoku[index]) {
      throw new Error('Invalid position');
    }
    state.gomoku[index] = action.data.playerId;
    state.turn = state.players.find(p => p !== action.data.playerId) || '';
    const directions = [
      [1, 0],
      [0, 1],
      [1, 1],
      [1, -1]
    ];
    for (const [dx, dy] of directions) {
      let count = 1;
      for (let i = 1; i < 5; i++) {
        const nx = x + dx * i;
        const ny = y + dy * i;
        if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15) break;
        if (state.gomoku[ny * 15 + nx] === action.data.playerId) count++;
        else break;
      }
      for (let i = 1; i < 5; i++) {
        const nx = x - dx * i;
        const ny = y - dy * i;
        if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15) break;
        if (state.gomoku[ny * 15 + nx] === action.data.playerId) count++;
        else break;
      }
      if (count >= 5) {
        state.winner = action.data.playerId;
        state.status = 'finished';
        break;
      }
    }
    return state;
  }
}
