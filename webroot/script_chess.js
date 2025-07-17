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
  let chess = null;
  let chessboard = null;

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

  // Wait for libraries to load
  function waitForLibraries() {
    return new Promise((resolve) => {
      const checkLibraries = () => {
        if (typeof Chess !== 'undefined' && typeof React !== 'undefined' && typeof ReactDOM !== 'undefined' && window.ReactChessboard) {
          resolve();
        } else {
          setTimeout(checkLibraries, 100);
        }
      };
      checkLibraries();
    });
  }

  // Initialize chess game
  async function initializeChess() {
    try {
      await waitForLibraries();
      
      chess = new Chess();
      
      // Create chessboard using React
      const ChessboardComponent = React.createElement(window.ReactChessboard.Chessboard, {
        position: chess.fen(),
        onPieceDrop: handlePieceDrop,
        boardOrientation: getPlayerColor(currentUsername),
        arePiecesDraggable: gameState && gameState.status === 'active' && gameState.turn === currentUsername,
        customBoardStyle: {
          borderRadius: '4px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
        },
        customDarkSquareStyle: { backgroundColor: '#779952' },
        customLightSquareStyle: { backgroundColor: '#edeed1' },
      });

      ReactDOM.render(ChessboardComponent, boardElem);
    } catch (error) {
      console.error('Error initializing chess:', error);
      statusElem.textContent = '❌ Error loading chess game';
    }
  }

  // Handle piece drop
  function handlePieceDrop(sourceSquare, targetSquare) {
    if (!gameState || !gameActive || gameState.status !== 'active') return false;
    if (gameState.turn !== currentUsername) return false;
    if (!chess) return false;

    try {
      const move = chess.move({
        from: sourceSquare,
        to: targetSquare,
        promotion: 'q' // Always promote to queen for simplicity
      });

      if (move === null) return false; // Invalid move

      // Send move to server
      sendMessage({
        type: 'makeMove',
        data: {
          username: currentUsername,
          position: { fen: chess.fen(), move: move.san },
          gameType: 'chess'
        }
      });

      return true;
    } catch (error) {
      console.error('Invalid move:', error);
      return false;
    }
  }

  // Update chessboard
  async function updateChessboard() {
    if (!chess || !gameState) return;

    try {
      await waitForLibraries();

      if (gameState.chess && gameState.chess.fen) {
        chess.load(gameState.chess.fen);
      }

      const ChessboardComponent = React.createElement(window.ReactChessboard.Chessboard, {
        position: chess.fen(),
        onPieceDrop: handlePieceDrop,
        boardOrientation: getPlayerColor(currentUsername),
        arePiecesDraggable: gameState && gameState.status === 'active' && gameState.turn === currentUsername,
        customBoardStyle: {
          borderRadius: '4px',
          boxShadow: '0 2px 10px rgba(0, 0, 0, 0.5)',
        },
        customDarkSquareStyle: { backgroundColor: '#779952' },
        customLightSquareStyle: { backgroundColor: '#edeed1' },
      });

      ReactDOM.render(ChessboardComponent, boardElem);

      // Check for game end
      if (chess.isGameOver()) {
        let winner = null;
        let isDraw = false;

        if (chess.isCheckmate()) {
          // Current player is in checkmate, so the other player wins
          const currentPlayerColor = chess.turn();
          const winnerColor = currentPlayerColor === 'w' ? 'b' : 'w';
          const winnerIndex = winnerColor === 'w' ? 0 : 1;
          winner = gameState.players[winnerIndex];
        } else {
          isDraw = true;
        }

        setTimeout(() => {
          showGameEndModal(winner, isDraw);
        }, 500);
      }
    } catch (error) {
      console.error('Error updating chessboard:', error);
    }
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
        
        if (!chess) {
          initializeChess();
        } else {
          updateChessboard();
        }
        
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
          updateChessboard();
          updateStatus();
          updatePlayersInfo();
        }
        break;

      case 'gameStarted':
        console.log('Game started!', message.data);
        gameActive = true;
        if (message.data.gameState) {
          gameState = message.data.gameState;
          updateChessboard();
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
          updateChessboard();
          updateStatus();
          updatePlayersInfo();
        }
        break;

      case 'turnChanged':
        console.log(`Turn changed to: ${message.data.currentTurn}`);
        updateStatus();
        updateChessboard();
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
          updateChessboard();
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