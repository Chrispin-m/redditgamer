(function() {
  // Send webViewReady immediately when script loads
  function sendMessage(message) {
    // console.log('Sending message:', message);
    window.parent.postMessage(message, '*');
  }
  
  // Notify parent immediately that web view is ready
  sendMessage({ type: 'webViewReady' });

  const boardElem = document.getElementById('chessBoard');
  const statusElem = document.getElementById('chessStatus');
  const restartBtn = document.getElementById('restartChess');
  const playersElem = document.getElementById('players-info');
  const timerElem = document.getElementById('timer');

  let gameState = null;
  let currentUsername = null;
  let gameActive = false;
  let refreshInterval = null;
  let timerInterval = null;
  let selectedSquare = null;
  let chessBoard = null;
  let gameHistory = [];
  let currentTurn = 'white';
  
  // Connection resilience variables
  let connectionStatus = 'disconnected';
  let wsRetryCount = 0;
  let maxWsRetries = 5;
  let wsRetryDelay = 1000;
  let maxRetryDelay = 30000;
  let wsRetryTimeout = null;
  let wsConnectionTimeout = null;
  let pollingInterval = null;
  let wsReconnectInterval = null;
  let gameServerUrl = 'wss://your-game-server.com';
  let postId = null;
  let socket = null;

  // Chess piece Unicode symbols
  const chessPieces = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙', // White pieces
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'  // Black pieces
  };

  // Initial chess board position
  const initialBoard = [
    ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'],
    ['p', 'p', 'p', 'p', 'p', 'p', 'p', 'p'],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    [null, null, null, null, null, null, null, null],
    ['P', 'P', 'P', 'P', 'P', 'P', 'P', 'P'],
    ['R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R']
  ];

  // Chess engine state
  let castlingRights = {
    whiteKingSide: true,
    whiteQueenSide: true,
    blackKingSide: true,
    blackQueenSide: true
  };
  let enPassantTarget = null;
  let halfMoveClock = 0;
  let fullMoveNumber = 1;

  // Auto-refresh game state every 3 seconds
  function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
      if (gameActive && gameState && gameState.status === 'active') {
        sendMessage({ type: 'requestGameState' });
        sendMessage({ type: 'checkTurnTimer' });
      }
    }, 3000);
  }

  // Start turn timer
  function startTurnTimer() {
    if (timerInterval) clearInterval(timerInterval);
    timerInterval = setInterval(() => {
      sendMessage({ type: 'checkTurnTimer' });
    }, 1000);
  }

  // Show win/loss modal
  function showGameEndModal(winner, isDraw, reason) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    let modalClass = '';
    let title = '';
    let message = '';
    let emoji = '';
    
    if (isDraw) {
      modalClass = 'draw-modal';
      title = "It's a Draw! 🤝";
      if (reason === 'stalemate') {
        message = "Stalemate! No legal moves available.";
      } else if (reason === 'insufficient') {
        message = "Draw by insufficient material.";
      } else if (reason === 'repetition') {
        message = "Draw by threefold repetition.";
      } else if (reason === 'fifty-move') {
        message = "Draw by fifty-move rule.";
      } else {
        message = "Great game! Well played by both sides.";
      }
      emoji = '🤝';
    } else if (winner === currentUsername) {
      modalClass = 'win-modal celebration';
      title = "🎉 Congratulations! 🎉";
      if (reason === 'checkmate') {
        message = `Checkmate! You are the chess master!`;
      } else if (reason === 'timeout') {
        message = `You win by timeout! Well played!`;
      } else {
        message = `Victory! Excellent chess skills!`;
      }
      emoji = '♛';
    } else {
      modalClass = 'lose-modal';
      title = "Game Over 😔";
      if (reason === 'timeout') {
        message = `Time's up! ${winner} wins by timeout.`;
      } else if (reason === 'checkmate') {
        message = `Checkmate! ${winner} wins! Better luck next time.`;
      } else {
        message = `${winner} wins! Keep practicing your chess skills.`;
      }
      emoji = '😔';
    }
    
    modal.innerHTML = `
      <div class="modal-content ${modalClass}">
        <h2>${emoji} ${title} ${emoji}</h2>
        <p>${message}</p>
        <button onclick="this.closest('.modal').remove(); sendMessage({type: 'restartGame'});">
          Play Again
        </button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
      }
    }, 5000);
  }

  // Get player color (white for first player, black for second)
  function getPlayerColor(username) {
    if (!gameState || !gameState.players) return 'white';
    const playerIndex = gameState.players.indexOf(username);
    return playerIndex === 0 ? 'white' : 'black';
  }

  // Convert board position to chess notation
  function positionToNotation(row, col) {
    const files = 'abcdefgh';
    const ranks = '87654321';
    return files[col] + ranks[row];
  }

  // Convert chess notation to board position
  function notationToPosition(notation) {
    const files = 'abcdefgh';
    const ranks = '87654321';
    const col = files.indexOf(notation[0]);
    const row = ranks.indexOf(notation[1]);
    return [row, col];
  }

  // Check if piece belongs to current player
  function isPieceOwnedByPlayer(piece, color) {
    if (!piece) return false;
    if (color === 'white') {
      return piece === piece.toUpperCase(); // White pieces are uppercase
    } else {
      return piece === piece.toLowerCase(); // Black pieces are lowercase
    }
  }

  // Get piece color
  function getPieceColor(piece) {
    if (!piece) return null;
    return piece === piece.toUpperCase() ? 'white' : 'black';
  }

  // Find king position
  function findKing(board, color) {
    const king = color === 'white' ? 'K' : 'k';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (board[row][col] === king) {
          return [row, col];
        }
      }
    }
    return null;
  }

  // Check if a square is under attack by the opponent
  function isSquareUnderAttack(board, row, col, byColor) {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        const piece = board[r][c];
        if (piece && getPieceColor(piece) === byColor) {
          if (canPieceAttackSquare(board, r, c, row, col)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  // Check if a piece can attack a specific square (without considering check)
  function canPieceAttackSquare(board, fromRow, fromCol, toRow, toCol) {
    const piece = board[fromRow][fromCol];
    if (!piece) return false;

    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);
    const piece_lower = piece.toLowerCase();

    switch (piece_lower) {
      case 'p': // Pawn attacks
        const direction = piece === piece.toUpperCase() ? -1 : 1;
        return rowDiff === direction && absColDiff === 1;

      case 'r': // Rook
        return (rowDiff === 0 || colDiff === 0) && isPathClear(board, fromRow, fromCol, toRow, toCol);

      case 'n': // Knight
        return (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);

      case 'b': // Bishop
        return absRowDiff === absColDiff && isPathClear(board, fromRow, fromCol, toRow, toCol);

      case 'q': // Queen
        return ((rowDiff === 0 || colDiff === 0) || (absRowDiff === absColDiff)) && 
               isPathClear(board, fromRow, fromCol, toRow, toCol);

      case 'k': // King
        return absRowDiff <= 1 && absColDiff <= 1;

      default:
        return false;
    }
  }

  // Check if king is in check
  function isInCheck(board, color) {
    const kingPos = findKing(board, color);
    if (!kingPos) return false;
    
    const opponentColor = color === 'white' ? 'black' : 'white';
    return isSquareUnderAttack(board, kingPos[0], kingPos[1], opponentColor);
  }

  // Make a temporary move and check if it leaves king in check
  function wouldLeaveKingInCheck(board, fromRow, fromCol, toRow, toCol, color) {
    // Create a copy of the board
    const tempBoard = board.map(row => [...row]);
    
    // Make the move
    tempBoard[toRow][toCol] = tempBoard[fromRow][fromCol];
    tempBoard[fromRow][fromCol] = null;
    
    // Check if king is in check after this move
    return isInCheck(tempBoard, color);
  }

  // Check if path is clear for sliding pieces
  function isPathClear(board, fromRow, fromCol, toRow, toCol) {
    const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
    const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
    
    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;
    
    while (currentRow !== toRow || currentCol !== toCol) {
      if (board[currentRow][currentCol] !== null) return false;
      currentRow += rowStep;
      currentCol += colStep;
    }
    
    return true;
  }

  // Comprehensive move validation
  function isValidMove(board, fromRow, fromCol, toRow, toCol, color) {
    // Basic bounds checking
    if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
    
    const piece = board[fromRow][fromCol];
    if (!piece) return false;
    
    // Check if piece belongs to current player
    if (!isPieceOwnedByPlayer(piece, color)) return false;
    
    // Can't capture own piece
    const targetPiece = board[toRow][toCol];
    if (targetPiece && getPieceColor(targetPiece) === color) return false;

    const rowDiff = toRow - fromRow;
    const colDiff = toCol - fromCol;
    const absRowDiff = Math.abs(rowDiff);
    const absColDiff = Math.abs(colDiff);
    const piece_lower = piece.toLowerCase();

    // Basic piece movement rules
    let isBasicMoveValid = false;
    
    switch (piece_lower) {
      case 'p': // Pawn
        const direction = piece === piece.toUpperCase() ? -1 : 1;
        const startRow = piece === piece.toUpperCase() ? 6 : 1;
        
        // Forward move
        if (fromCol === toCol && !targetPiece) {
          if (toRow === fromRow + direction) {
            isBasicMoveValid = true;
          } else if (fromRow === startRow && toRow === fromRow + 2 * direction) {
            isBasicMoveValid = true;
          }
        }
        // Diagonal capture
        else if (absColDiff === 1 && toRow === fromRow + direction && targetPiece) {
          isBasicMoveValid = true;
        }
        // En passant
        else if (absColDiff === 1 && toRow === fromRow + direction && !targetPiece && enPassantTarget) {
          const [epRow, epCol] = notationToPosition(enPassantTarget);
          if (toRow === epRow && toCol === epCol) {
            isBasicMoveValid = true;
          }
        }
        break;

      case 'r': // Rook
        isBasicMoveValid = (rowDiff === 0 || colDiff === 0) && isPathClear(board, fromRow, fromCol, toRow, toCol);
        break;

      case 'n': // Knight
        isBasicMoveValid = (absRowDiff === 2 && absColDiff === 1) || (absRowDiff === 1 && absColDiff === 2);
        break;

      case 'b': // Bishop
        isBasicMoveValid = absRowDiff === absColDiff && isPathClear(board, fromRow, fromCol, toRow, toCol);
        break;

      case 'q': // Queen
        isBasicMoveValid = ((rowDiff === 0 || colDiff === 0) || (absRowDiff === absColDiff)) && 
                          isPathClear(board, fromRow, fromCol, toRow, toCol);
        break;

      case 'k': // King
        if (absRowDiff <= 1 && absColDiff <= 1) {
          isBasicMoveValid = true;
        }
        // Castling
        else if (absRowDiff === 0 && absColDiff === 2) {
          isBasicMoveValid = canCastle(board, color, colDiff > 0);
        }
        break;
    }

    if (!isBasicMoveValid) return false;

    // Check if move would leave king in check
    return !wouldLeaveKingInCheck(board, fromRow, fromCol, toRow, toCol, color);
  }

  // Check if castling is possible
  function canCastle(board, color, kingSide) {
    const row = color === 'white' ? 7 : 0;
    const king = color === 'white' ? 'K' : 'k';
    const rook = color === 'white' ? 'R' : 'r';
    
    // Check castling rights
    if (color === 'white') {
      if (kingSide && !castlingRights.whiteKingSide) return false;
      if (!kingSide && !castlingRights.whiteQueenSide) return false;
    } else {
      if (kingSide && !castlingRights.blackKingSide) return false;
      if (!kingSide && !castlingRights.blackQueenSide) return false;
    }
    
    // Check if king and rook are in correct positions
    if (board[row][4] !== king) return false;
    if (kingSide && board[row][7] !== rook) return false;
    if (!kingSide && board[row][0] !== rook) return false;
    
    // Check if squares between king and rook are empty
    const startCol = kingSide ? 5 : 1;
    const endCol = kingSide ? 6 : 3;
    for (let col = startCol; col <= endCol; col++) {
      if (board[row][col] !== null) return false;
    }
    
    // Check if king is in check or would pass through check
    const opponentColor = color === 'white' ? 'black' : 'white';
    if (isSquareUnderAttack(board, row, 4, opponentColor)) return false;
    if (isSquareUnderAttack(board, row, kingSide ? 5 : 3, opponentColor)) return false;
    if (isSquareUnderAttack(board, row, kingSide ? 6 : 2, opponentColor)) return false;
    
    return true;
  }

  // Get all legal moves for a color
  function getAllLegalMoves(board, color) {
    const moves = [];
    
    for (let fromRow = 0; fromRow < 8; fromRow++) {
      for (let fromCol = 0; fromCol < 8; fromCol++) {
        const piece = board[fromRow][fromCol];
        if (piece && getPieceColor(piece) === color) {
          for (let toRow = 0; toRow < 8; toRow++) {
            for (let toCol = 0; toCol < 8; toCol++) {
              if (isValidMove(board, fromRow, fromCol, toRow, toCol, color)) {
                moves.push({ from: [fromRow, fromCol], to: [toRow, toCol] });
              }
            }
          }
        }
      }
    }
    
    return moves;
  }

  // Check for checkmate
  function isCheckmate(board, color) {
    if (!isInCheck(board, color)) return false;
    return getAllLegalMoves(board, color).length === 0;
  }

  // Check for stalemate
  function isStalemate(board, color) {
    if (isInCheck(board, color)) return false;
    return getAllLegalMoves(board, color).length === 0;
  }

  // Check for insufficient material
  function isInsufficientMaterial(board) {
    const pieces = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece && piece.toLowerCase() !== 'k') {
          pieces.push(piece.toLowerCase());
        }
      }
    }
    
    // King vs King
    if (pieces.length === 0) return true;
    
    // King and Bishop vs King or King and Knight vs King
    if (pieces.length === 1 && (pieces[0] === 'b' || pieces[0] === 'n')) return true;
    
    // King and Bishop vs King and Bishop (same color squares)
    if (pieces.length === 2 && pieces.every(p => p === 'b')) {
      // This is a simplification - would need to check if bishops are on same color squares
      return true;
    }
    
    return false;
  }

  // Check for threefold repetition (simplified)
  function isThreefoldRepetition() {
    if (gameHistory.length < 8) return false;
    
    const currentPosition = boardToFEN(chessBoard);
    let count = 0;
    
    for (const position of gameHistory) {
      if (position === currentPosition) {
        count++;
        if (count >= 3) return true;
      }
    }
    
    return false;
  }

  // Convert board to FEN (simplified)
  function boardToFEN(board) {
    let fen = '';
    for (let row = 0; row < 8; row++) {
      let emptyCount = 0;
      for (let col = 0; col < 8; col++) {
        const piece = board[row][col];
        if (piece) {
          if (emptyCount > 0) {
            fen += emptyCount;
            emptyCount = 0;
          }
          fen += piece;
        } else {
          emptyCount++;
        }
      }
      if (emptyCount > 0) fen += emptyCount;
      if (row < 7) fen += '/';
    }
    return fen;
  }

  // Initialize chess board
  function initializeChessBoard() {
    chessBoard = gameState && gameState.chess && gameState.chess.board 
      ? gameState.chess.board 
      : JSON.parse(JSON.stringify(initialBoard));
    
    if (gameState && gameState.chess) {
      currentTurn = gameState.chess.turn || 'white';
      gameHistory = gameState.chess.history || [];
    } else {
      currentTurn = 'white';
      gameHistory = [];
    }
    
    renderBoard();
  }

  // Render the chess board
  function renderBoard() {
    if (!boardElem) return;
    
    boardElem.innerHTML = '';
    
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const square = document.createElement('div');
        square.className = 'chess-square';
        square.classList.add((row + col) % 2 === 0 ? 'light' : 'dark');
        square.dataset.row = row;
        square.dataset.col = col;
        
        // Add piece if present
        const piece = chessBoard[row][col];
        if (piece) {
          const pieceSpan = document.createElement('span');
          pieceSpan.className = 'chess-piece';
          pieceSpan.classList.add(piece === piece.toUpperCase() ? 'white-piece' : 'black-piece');
          pieceSpan.textContent = chessPieces[piece] || piece;
          square.appendChild(pieceSpan);
        }
        
        // Add notation for edge squares
        if (row === 7) {
          const fileNotation = document.createElement('div');
          fileNotation.className = 'chess-notation file-notation';
          fileNotation.textContent = 'abcdefgh'[col];
          square.appendChild(fileNotation);
        }
        if (col === 0) {
          const rankNotation = document.createElement('div');
          rankNotation.className = 'chess-notation rank-notation';
          rankNotation.textContent = 8 - row;
          square.appendChild(rankNotation);
        }
        
        square.addEventListener('click', () => handleSquareClick(row, col));
        boardElem.appendChild(square);
      }
    }
  }

  // Handle square click
  function handleSquareClick(row, col) {
    if (!gameState || !gameActive || gameState.status !== 'active') return;
    if (gameState.turn !== currentUsername) return;

    const clickedPiece = chessBoard[row][col];
    const playerColor = getPlayerColor(currentUsername);

    // Clear previous selections
    document.querySelectorAll('.chess-square').forEach(sq => {
      sq.classList.remove('selected', 'possible-move', 'in-check');
    });

    // Highlight king if in check
    if (isInCheck(chessBoard, playerColor)) {
      const kingPos = findKing(chessBoard, playerColor);
      if (kingPos) {
        const kingSquare = boardElem.children[kingPos[0] * 8 + kingPos[1]];
        kingSquare.classList.add('in-check');
      }
    }

    if (selectedSquare) {
      const [fromRow, fromCol] = selectedSquare;
      const piece = chessBoard[fromRow][fromCol];
      
      // If clicking the same square, deselect
      if (fromRow === row && fromCol === col) {
        selectedSquare = null;
        return;
      }
      
      // Try to make a move
      if (piece && isValidMove(chessBoard, fromRow, fromCol, row, col, playerColor)) {
        makeMove(fromRow, fromCol, row, col);
        selectedSquare = null;
        return;
      }
    }

    // Select a piece if it belongs to current player
    if (clickedPiece && isPieceOwnedByPlayer(clickedPiece, playerColor)) {
      selectedSquare = [row, col];
      const square = boardElem.children[row * 8 + col];
      square.classList.add('selected');
      
      // Highlight possible moves
      highlightPossibleMoves(row, col, clickedPiece, playerColor);
    } else {
      selectedSquare = null;
    }
  }

  // Highlight possible moves
  function highlightPossibleMoves(fromRow, fromCol, piece, color) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (isValidMove(chessBoard, fromRow, fromCol, row, col, color)) {
          const square = boardElem.children[row * 8 + col];
          square.classList.add('possible-move');
        }
      }
    }
  }

  // Make a move
  function makeMove(fromRow, fromCol, toRow, toCol) {
    const piece = chessBoard[fromRow][fromCol];
    const capturedPiece = chessBoard[toRow][toCol];
    const from = positionToNotation(fromRow, fromCol);
    const to = positionToNotation(toRow, toCol);
    
    // Handle special moves
    let specialMove = null;
    
    // Castling
    if (piece.toLowerCase() === 'k' && Math.abs(toCol - fromCol) === 2) {
      specialMove = 'castle';
      const kingSide = toCol > fromCol;
      const rookFromCol = kingSide ? 7 : 0;
      const rookToCol = kingSide ? 5 : 3;
      const row = fromRow;
      
      // Move rook
      chessBoard[row][rookToCol] = chessBoard[row][rookFromCol];
      chessBoard[row][rookFromCol] = null;
    }
    
    // En passant
    if (piece.toLowerCase() === 'p' && !capturedPiece && fromCol !== toCol) {
      specialMove = 'enpassant';
      const capturedRow = fromRow;
      chessBoard[capturedRow][toCol] = null;
    }
    
    // Pawn promotion (simplified - always promote to queen)
    if (piece.toLowerCase() === 'p' && (toRow === 0 || toRow === 7)) {
      specialMove = 'promotion';
      const promotedPiece = piece === 'P' ? 'Q' : 'q';
      chessBoard[toRow][toCol] = promotedPiece;
      chessBoard[fromRow][fromCol] = null;
    } else {
      // Normal move
      chessBoard[toRow][toCol] = piece;
      chessBoard[fromRow][fromCol] = null;
    }
    
    // Update castling rights
    if (piece.toLowerCase() === 'k') {
      if (piece === 'K') {
        castlingRights.whiteKingSide = false;
        castlingRights.whiteQueenSide = false;
      } else {
        castlingRights.blackKingSide = false;
        castlingRights.blackQueenSide = false;
      }
    }
    if (piece.toLowerCase() === 'r') {
      if (fromRow === 7 && fromCol === 0) castlingRights.whiteQueenSide = false;
      if (fromRow === 7 && fromCol === 7) castlingRights.whiteKingSide = false;
      if (fromRow === 0 && fromCol === 0) castlingRights.blackQueenSide = false;
      if (fromRow === 0 && fromCol === 7) castlingRights.blackKingSide = false;
    }
    
    // Update en passant target
    enPassantTarget = null;
    if (piece.toLowerCase() === 'p' && Math.abs(toRow - fromRow) === 2) {
      const epRow = (fromRow + toRow) / 2;
      enPassantTarget = positionToNotation(epRow, toCol);
    }
    
    // Update move counters
    if (piece.toLowerCase() === 'p' || capturedPiece) {
      halfMoveClock = 0;
    } else {
      halfMoveClock++;
    }
    
    if (currentTurn === 'black') {
      fullMoveNumber++;
    }
    
    // Switch turn
    currentTurn = currentTurn === 'white' ? 'black' : 'white';
    
    // Add position to history
    gameHistory.push(boardToFEN(chessBoard));
    
    // Check for game end conditions
    let gameEndReason = null;
    let winner = null;
    let isDraw = false;
    
    if (isCheckmate(chessBoard, currentTurn)) {
      gameEndReason = 'checkmate';
      winner = currentTurn === 'white' ? gameState.players[1] : gameState.players[0];
    } else if (isStalemate(chessBoard, currentTurn)) {
      gameEndReason = 'stalemate';
      isDraw = true;
    } else if (isInsufficientMaterial(chessBoard)) {
      gameEndReason = 'insufficient';
      isDraw = true;
    } else if (isThreefoldRepetition()) {
      gameEndReason = 'repetition';
      isDraw = true;
    } else if (halfMoveClock >= 100) { // 50-move rule
      gameEndReason = 'fifty-move';
      isDraw = true;
    }
    
    renderBoard();

    // Send move to server
    sendMessage({
      type: 'makeMove',
      data: {
        username: currentUsername,
        position: { 
          from, 
          to, 
          board: chessBoard,
          turn: currentTurn,
          history: gameHistory,
          castlingRights,
          enPassantTarget,
          halfMoveClock,
          fullMoveNumber,
          gameEndReason,
          winner,
          isDraw
        },
        gameType: 'chess'
      }
    });
  }

  // Update game status display
  function updateStatus() {
    if (!gameState) {
      statusElem.textContent = 'Loading...';
      statusElem.className = 'status-display';
      return;
    }

    statusElem.className = 'status-display';

    if (gameState.status === 'waiting') {
      statusElem.textContent = `⏳ Waiting for players... (${gameState.players.length}/${gameState.maxPlayers})`;
    } else if (gameState.status === 'active') {
      const isMyTurn = gameState.turn === currentUsername;
      const turnColor = getPlayerColor(gameState.turn);
      const colorEmoji = turnColor === 'white' ? '⚪' : '⚫';
      
      let statusText = '';
      if (isInCheck(chessBoard, turnColor)) {
        statusText = isMyTurn 
          ? `🚨 You are in CHECK! (${colorEmoji})` 
          : `🚨 ${gameState.turn} is in CHECK! (${colorEmoji})`;
      } else {
        statusText = isMyTurn 
          ? `🎯 Your turn - Make your move! (${colorEmoji})` 
          : `⏳ ${gameState.turn}'s turn (${colorEmoji})`;
      }
      
      statusElem.textContent = statusText;
      
      if (isMyTurn) {
        statusElem.style.background = isInCheck(chessBoard, turnColor) 
          ? 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)'
          : 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
        statusElem.style.color = 'white';
      } else {
        statusElem.style.background = 'rgba(255, 255, 255, 0.95)';
        statusElem.style.color = '#333';
      }
    } else if (gameState.status === 'finished') {
      const winnerColor = getPlayerColor(gameState.winner);
      const colorEmoji = winnerColor === 'white' ? '⚪' : '⚫';
      statusElem.textContent = gameState.winner === currentUsername 
        ? `♛ Checkmate! You won! (${colorEmoji})` 
        : `😔 Checkmate! ${gameState.winner} won! (${colorEmoji})`;
      statusElem.style.background = gameState.winner === currentUsername 
        ? 'linear-gradient(135deg, #28a745 0%, #20c997 100%)'
        : 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
      statusElem.style.color = 'white';
    } else if (gameState.status === 'draw') {
      statusElem.textContent = "🤝 It's a draw!";
      statusElem.style.background = 'linear-gradient(135deg, #ffc107 0%, #e0a800 100%)';
      statusElem.style.color = '#333';
    }
  }

  // Update timer display
  function updateTimer(timeRemaining, currentTurn) {
    if (!timerElem) return;
    
    if (gameState && gameState.status === 'active' && gameState.players.length >= 2 && gameState.firstMoveMade) {
      timerElem.style.display = 'block';
      timerElem.className = 'timer-display';
      timerElem.textContent = `⏰ ${timeRemaining}s - ${currentTurn}'s turn`;
      
      if (timeRemaining <= 10) {
        timerElem.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
      } else {
        timerElem.style.background = 'linear-gradient(135deg, #ff6b6b 0%, #ee5a24 100%)';
      }
    } else {
      timerElem.style.display = 'none';
    }
  }

  // Update players info
  function updatePlayersInfo() {
    if (!gameState || !playersElem) return;
    
    playersElem.className = 'status-display';
    
    if (gameState.players.length === 0) {
      playersElem.textContent = '👥 No players yet';
    } else {
      const playersList = gameState.players.map((player, index) => {
        const color = index === 0 ? 'White' : 'Black';
        const emoji = index === 0 ? '⚪' : '⚫';
        const isCurrent = player === currentUsername;
        return `${player} (${emoji} ${color})${isCurrent ? ' - You' : ''}`;
      }).join(', ');
      playersElem.textContent = `👥 Players: ${playersList}`;
    }
  }

  // Handle messages from parent
  function handleMessage(event) {
    let message = event.data;
    if (message.type === 'devvit-message' && message.data && message.data.message) {
      message = message.data.message;
    }
    
    // console.log('Received message from parent:', message);
    
    switch (message.type) {
      case 'initialData':
        currentUsername = message.data.username;
        // console.log('Set username:', currentUsername);
        
        // console.log('Initializing game...');
        sendMessage({ type: 'initializeGame' });
        sendMessage({ type: 'requestGameState' });
        break;

      case 'gameState':
        // console.log('Received game state:', message.data);
        gameState = message.data;
        gameActive = gameState.status === 'active';
        
        initializeChessBoard();
        updateStatus();
        updatePlayersInfo();
        
        // Auto-join if not already in the game
        if (!gameState.players.includes(currentUsername)) {
          // console.log('Auto-joining game...');
          sendMessage({
            type: 'joinGame',
            data: { username: currentUsername }
          });
          sendMessage({ type: 'requestGameState' });
        } else if (gameActive) {
          // Only start timers if we're already in the game and it's active
          startAutoRefresh();
          startTurnTimer();
        }
        break;

      case 'playerJoined':
        // console.log(`Player joined: ${message.data.username}`);
        if (message.data.gameState) {
          gameState = message.data.gameState;
          gameActive = gameState.status === 'active';
          initializeChessBoard();
          updateStatus();
          updatePlayersInfo();
          
          // Start timers if game is active and we're in it
          if (gameActive && gameState.players.includes(currentUsername)) {
            startAutoRefresh();
            startTurnTimer();
          }
        }
        break;

      case 'gameStarted':
        // console.log('Game started!', message.data);
        gameActive = true;
        if (message.data.gameState) {
          gameState = message.data.gameState;
          initializeChessBoard();
          updateStatus();
          updatePlayersInfo();
        }
        
        // Always start timers when game starts
        if (gameActive && gameState && gameState.players.includes(currentUsername)) {
          startAutoRefresh();
          startTurnTimer();
        }
        break;

      case 'gameUpdate':
      case 'moveMade':
        // console.log('Game updated:', message.data);
        if (message.data.gameState || message.data) {
          gameState = message.data.gameState || message.data;
          gameActive = gameState.status === 'active';
          initializeChessBoard();
          updateStatus();
          updatePlayersInfo();
        }
        break;

      case 'turnChanged':
        // console.log(`Turn changed to: ${message.data.currentTurn}`);
        updateStatus();
        break;

      case 'timerUpdate':
        updateTimer(message.data.timeRemaining, message.data.currentTurn);
        break;

      case 'gameEnded':
        // console.log('Game ended:', message.data);
        gameActive = false;
        if (refreshInterval) clearInterval(refreshInterval);
        if (timerInterval) clearInterval(timerInterval);
        
        if (message.data.finalState) {
          gameState = message.data.finalState;
          initializeChessBoard();
          updateStatus();
          updatePlayersInfo();
        }
        
        // Show win/loss modal
        setTimeout(() => {
          showGameEndModal(message.data.winner, message.data.isDraw, message.data.reason);
        }, 500);
        break;

      case 'error':
        // console.error('Game error:', message.message);
        statusElem.textContent = `❌ Error: ${message.message}`;
        statusElem.className = 'status-display';
        statusElem.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
        statusElem.style.color = 'white';
        break;
    }
  }

  // Add event listener
  window.addEventListener('message', handleMessage);

  // Also listen for DOMContentLoaded to ensure early initialization
  document.addEventListener('DOMContentLoaded', () => {
    sendMessage({ type: 'webViewReady' });
  });

  restartBtn.addEventListener('click', () => {
    sendMessage({ type: 'restartGame' });
  });

  // Initialize
  statusElem.textContent = '🔄 Connecting...';
  statusElem.className = 'status-display';

  // Make sendMessage available globally for modal buttons
  window.sendMessage = sendMessage;
})();