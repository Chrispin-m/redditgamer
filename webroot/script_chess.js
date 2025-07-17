(function() {
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

  // Chess piece Unicode symbols
  const chessPieces = {
    'K': '♔', 'Q': '♕', 'R': '♖', 'B': '♗', 'N': '♘', 'P': '♙', // White pieces
    'k': '♚', 'q': '♛', 'r': '♜', 'b': '♝', 'n': '♞', 'p': '♟'  // Black pieces
  };

  // Initial chess board position (FEN: rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR)
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

  // Function to send messages to the parent Devvit app
  function sendMessage(message) {
    console.log('Sending message:', message);
    window.parent.postMessage(message, '*');
  }

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
      message = "Great game! Well played by both sides.";
      emoji = '🤝';
    } else if (winner === currentUsername) {
      modalClass = 'win-modal celebration';
      title = "🎉 Congratulations! 🎉";
      message = `Checkmate! You are the chess master!`;
      emoji = '♛';
    } else {
      modalClass = 'lose-modal';
      title = "Game Over 😔";
      message = reason === 'timeout' 
        ? `Time's up! ${winner} wins by timeout.`
        : `Checkmate! ${winner} wins! Better luck next time.`;
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
  function isPieceOwnedByPlayer(piece, playerColor) {
    if (!piece) return false;
    if (playerColor === 'white') {
      return piece === piece.toUpperCase(); // White pieces are uppercase
    } else {
      return piece === piece.toLowerCase(); // Black pieces are lowercase
    }
  }

  // Basic move validation (simplified)
  function isValidMove(fromRow, fromCol, toRow, toCol, piece) {
    // Basic bounds checking
    if (toRow < 0 || toRow > 7 || toCol < 0 || toCol > 7) return false;
    
    // Can't capture own piece
    const targetPiece = chessBoard[toRow][toCol];
    if (targetPiece && isPieceOwnedByPlayer(piece, getPlayerColor(currentUsername)) === isPieceOwnedByPlayer(targetPiece, getPlayerColor(currentUsername))) {
      return false;
    }

    const rowDiff = Math.abs(toRow - fromRow);
    const colDiff = Math.abs(toCol - fromCol);
    const piece_lower = piece.toLowerCase();

    // Basic piece movement rules (simplified)
    switch (piece_lower) {
      case 'p': // Pawn
        const direction = piece === piece.toUpperCase() ? -1 : 1; // White moves up (-1), Black moves down (+1)
        const startRow = piece === piece.toUpperCase() ? 6 : 1;
        
        // Forward move
        if (fromCol === toCol && !targetPiece) {
          if (toRow === fromRow + direction) return true;
          if (fromRow === startRow && toRow === fromRow + 2 * direction) return true;
        }
        // Diagonal capture
        if (colDiff === 1 && toRow === fromRow + direction && targetPiece) return true;
        return false;

      case 'r': // Rook
        return (rowDiff === 0 || colDiff === 0) && isPathClear(fromRow, fromCol, toRow, toCol);

      case 'n': // Knight
        return (rowDiff === 2 && colDiff === 1) || (rowDiff === 1 && colDiff === 2);

      case 'b': // Bishop
        return rowDiff === colDiff && isPathClear(fromRow, fromCol, toRow, toCol);

      case 'q': // Queen
        return ((rowDiff === 0 || colDiff === 0) || (rowDiff === colDiff)) && isPathClear(fromRow, fromCol, toRow, toCol);

      case 'k': // King
        return rowDiff <= 1 && colDiff <= 1;

      default:
        return false;
    }
  }

  // Check if path is clear for sliding pieces
  function isPathClear(fromRow, fromCol, toRow, toCol) {
    const rowStep = toRow > fromRow ? 1 : toRow < fromRow ? -1 : 0;
    const colStep = toCol > fromCol ? 1 : toCol < fromCol ? -1 : 0;
    
    let currentRow = fromRow + rowStep;
    let currentCol = fromCol + colStep;
    
    while (currentRow !== toRow || currentCol !== toCol) {
      if (chessBoard[currentRow][currentCol] !== null) return false;
      currentRow += rowStep;
      currentCol += colStep;
    }
    
    return true;
  }

  // Initialize chess board
  function initializeChessBoard() {
    chessBoard = gameState && gameState.chess && gameState.chess.board 
      ? gameState.chess.board 
      : JSON.parse(JSON.stringify(initialBoard));
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
      sq.classList.remove('selected', 'possible-move');
    });

    if (selectedSquare) {
      const [fromRow, fromCol] = selectedSquare;
      const piece = chessBoard[fromRow][fromCol];
      
      // If clicking the same square, deselect
      if (fromRow === row && fromCol === col) {
        selectedSquare = null;
        return;
      }
      
      // Try to make a move
      if (piece && isValidMove(fromRow, fromCol, row, col, piece)) {
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
      
      // Highlight possible moves (basic implementation)
      highlightPossibleMoves(row, col, clickedPiece);
    } else {
      selectedSquare = null;
    }
  }

  // Highlight possible moves (simplified)
  function highlightPossibleMoves(fromRow, fromCol, piece) {
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        if (isValidMove(fromRow, fromCol, row, col, piece)) {
          const square = boardElem.children[row * 8 + col];
          square.classList.add('possible-move');
        }
      }
    }
  }

  // Make a move
  function makeMove(fromRow, fromCol, toRow, toCol) {
    const piece = chessBoard[fromRow][fromCol];
    const from = positionToNotation(fromRow, fromCol);
    const to = positionToNotation(toRow, toCol);
    
    // Update local board for immediate feedback
    chessBoard[toRow][toCol] = piece;
    chessBoard[fromRow][fromCol] = null;
    renderBoard();

    // Send move to server
    sendMessage({
      type: 'makeMove',
      data: {
        username: currentUsername,
        position: { from, to, board: chessBoard },
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
      statusElem.textContent = isMyTurn 
        ? `🎯 Your turn - Make your move! (${colorEmoji})` 
        : `⏳ ${gameState.turn}'s turn (${colorEmoji})`;
      
      if (isMyTurn) {
        statusElem.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
        statusElem.style.color = 'white';
      } else {
        statusElem.style.background = 'rgba(255, 255, 255, 0.95)';
        statusElem.style.color = '#333';
      }
    } else if (gameState.status === 'finished') {
      const winnerColor = getPlayerColor(gameState.winner);
      const colorEmoji = winnerColor === 'white' ? '⚪' : '⚫';
      statusElem.textContent = gameState.winner === currentUsername 
        ? `♛ You won! (${colorEmoji})` 
        : `😔 ${gameState.winner} won! (${colorEmoji})`;
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
    
    console.log('Received message from parent:', message);
    
    switch (message.type) {
      case 'initialData':
        currentUsername = message.data.username;
        console.log('Set username:', currentUsername);
        
        setTimeout(() => {
          console.log('Initializing game...');
          sendMessage({ type: 'initializeGame' });
        }, 100);
        break;

      case 'gameState':
        console.log('Received game state:', message.data);
        gameState = message.data;
        gameActive = gameState.status === 'active';
        
        initializeChessBoard();
        updateStatus();
        updatePlayersInfo();
        
        if (gameActive) {
          startAutoRefresh();
          startTurnTimer();
        }
        
        if (!gameState.players.includes(currentUsername)) {
          setTimeout(() => {
            console.log('Auto-joining game...');
            sendMessage({
              type: 'joinGame',
              data: { username: currentUsername }
            });
          }, 200);
        }
        break;

      case 'playerJoined':
        console.log(`Player joined: ${message.data.username}`);
        if (message.data.gameState) {
          gameState = message.data.gameState;
          initializeChessBoard();
          updateStatus();
          updatePlayersInfo();
        }
        break;

      case 'gameStarted':
        console.log('Game started!', message.data);
        gameActive = true;
        if (message.data.gameState) {
          gameState = message.data.gameState;
          initializeChessBoard();
          updateStatus();
          updatePlayersInfo();
          startAutoRefresh();
          startTurnTimer();
        }
        break;

      case 'gameUpdate':
      case 'moveMade':
        console.log('Game updated:', message.data);
        if (message.data.gameState || message.data) {
          gameState = message.data.gameState || message.data;
          gameActive = gameState.status === 'active';
          initializeChessBoard();
          updateStatus();
          updatePlayersInfo();
        }
        break;

      case 'turnChanged':
        console.log(`Turn changed to: ${message.data.currentTurn}`);
        updateStatus();
        break;

      case 'timerUpdate':
        updateTimer(message.data.timeRemaining, message.data.currentTurn);
        break;

      case 'gameEnded':
        console.log('Game ended:', message.data);
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
        console.error('Game error:', message.message);
        statusElem.textContent = `❌ Error: ${message.message}`;
        statusElem.className = 'status-display';
        statusElem.style.background = 'linear-gradient(135deg, #dc3545 0%, #c82333 100%)';
        statusElem.style.color = 'white';
        break;
    }
  }

  // Add event listener
  window.addEventListener('message', handleMessage);

  restartBtn.addEventListener('click', () => {
    sendMessage({ type: 'restartGame' });
  });

  // Initialize
  statusElem.textContent = '🔄 Connecting...';
  statusElem.className = 'status-display';
  
  // Notify parent that web view is ready
  sendMessage({ type: 'webViewReady' });

  // Make sendMessage available globally for modal buttons
  window.sendMessage = sendMessage;
})();