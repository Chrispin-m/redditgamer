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
    // Deep copy of initial board for chess
    const initialChessBoard = [
      ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
      ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
      ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];

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
      chess: gameType === 'chess' ? { 
        board: JSON.parse(JSON.stringify(initialChessBoard)), 
        history: [],
        turn: 'white'
      } : undefined,
      // For Reaction Speed, you may store additional data if desired.
      reaction: gameType === 'reaction' ? { scores: [] } : undefined,
      status: 'waiting',
      winner: undefined,
      firstMoveMade: false,
    };

    await this.saveGameState(redis, postId, initialState);
  }

  private static createInitialState(): GameState {
    const initialChessBoard = [
      ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
      ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      [null, null, null, null, null, null, null, null],
      ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
      ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
    ];

    return {
      currentGame: 'tictactoe',
      players: [],
      maxPlayers: 2,
      turn: '',
      tictactoe: Array(9).fill(null),
      gomoku: Array(225).fill(null),
      dots: { lines: [], boxes: {}, gridSize: 5 },
      connect4: Array.from({ length: 7 }, () => Array(6).fill(null)),
      chess: { 
        board: JSON.parse(JSON.stringify(initialChessBoard)), 
        history: [],
        turn: 'white'
      },
      reaction: undefined,
      status: 'waiting',
      winner: undefined,
      firstMoveMade: false,
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

    // Create a deep copy of the state to avoid mutations
    const newState = JSON.parse(JSON.stringify(state));

    // For reaction, moves are handled by the web view directly.
    if (state.currentGame === 'reaction') {
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
      case 'chess':
        return this.processChessMove(newState, action);
      default:
        throw new Error(`Unsupported game type: ${state.currentGame}`);
    }
  }

  private static getNextPlayer(state: GameState, currentPlayer: string): string {
    const currentIndex = state.players.indexOf(currentPlayer);
    const nextIndex = (currentIndex + 1) % state.players.length;
    return state.players[nextIndex];
  }

  private static processTicTacToeMove(state: GameState, action: GameAction): GameState {
    const position = action.data.position as number;
    if (position < 0 || position > 8 || state.tictactoe[position]) {
      throw new Error('Invalid move');
    }
    
    // Use the player's username as the symbol
    state.tictactoe[position] = action.data.playerId;
    
    // Check for win
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
      [0, 4, 8], [2, 4, 6] // diagonals
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
        return state;
      }
    }
    
    // Check for draw
    if (state.tictactoe.every(cell => cell !== null)) {
      state.status = 'draw';
      return state;
    }
    
    // Switch to next player
    state.turn = this.getNextPlayer(state, action.data.playerId);
    return state;
  }

  private static processConnect4Move(state: GameState, action: GameAction): GameState {
    const column = action.data.position as number;
    if (column < 0 || column >= 7) throw new Error('Invalid column');
    
    // Find the lowest empty row in the column (bottom-up)
    const colArray = state.connect4[column];
    let row = -1;
    for (let r = 5; r >= 0; r--) { // Start from bottom (row 5) and go up
      if (colArray[r] === null) {
        row = r;
        break;
      }
    }
    
    if (row === -1) throw new Error('Column full');
    
    // Place the disc at the lowest available position
    state.connect4[column][row] = action.data.playerId;
    
    // Check for win (4 in a row)
    const directions = [[0, 1], [1, 0], [1, 1], [1, -1]]; // horizontal, vertical, diagonal
    for (const [dx, dy] of directions) {
      let count = 1;
      
      // Check positive direction
      for (let i = 1; i < 4; i++) {
        const x = column + dx * i;
        const y = row + dy * i;
        if (x < 0 || x >= 7 || y < 0 || y >= 6) break;
        if (state.connect4[x][y] === action.data.playerId) count++;
        else break;
      }
      
      // Check negative direction
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
        return state;
      }
    }
    
    // Check for draw (board full)
    if (state.connect4.every(col => col.every(cell => cell !== null))) {
      state.status = 'draw';
      return state;
    }
    
    // Switch to next player
    state.turn = this.getNextPlayer(state, action.data.playerId);
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
    
    // Check for completed boxes
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
    
    // If player completed boxes, they get another turn
    state.turn = boxesCompleted > 0 
      ? action.data.playerId 
      : this.getNextPlayer(state, action.data.playerId);
    
    // Check if game is finished
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
    
    // Check for win (5 in a row)
    const directions = [[1, 0], [0, 1], [1, 1], [1, -1]];
    for (const [dx, dy] of directions) {
      let count = 1;
      
      // Check positive direction
      for (let i = 1; i < 5; i++) {
        const nx = x + dx * i;
        const ny = y + dy * i;
        if (nx < 0 || nx >= 15 || ny < 0 || ny >= 15) break;
        if (state.gomoku[ny * 15 + nx] === action.data.playerId) count++;
        else break;
      }
      
      // Check negative direction
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
        return state;
      }
    }
    
    // Check for draw (board full)
    if (state.gomoku.every(cell => cell !== null)) {
      state.status = 'draw';
      return state;
    }
    
    // Switch to next player
    state.turn = this.getNextPlayer(state, action.data.playerId);
    return state;
  }

  private static processChessMove(state: GameState, action: GameAction): GameState {
    // Chess move contains from, to, and updated board
    const moveData = action.data.position as { from: string; to: string; board: any[][] };
    
    if (!state.chess) {
      const initialChessBoard = [
        ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
        ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        [null, null, null, null, null, null, null, null],
        ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
        ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
      ];
      state.chess = { 
        board: JSON.parse(JSON.stringify(initialChessBoard)), 
        history: [],
        turn: 'white'
      };
    }
    
    // Update the chess state
    state.chess.board = moveData.board;
    state.chess.history.push(`${moveData.from}-${moveData.to}`);
    state.chess.turn = state.chess.turn === 'white' ? 'black' : 'white';
    
    // Basic checkmate detection could be added here
    // For now, just switch turns
    state.turn = this.getNextPlayer(state, action.data.playerId);
    
    return state;
  }
}