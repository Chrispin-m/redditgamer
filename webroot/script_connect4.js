(function() {
  const boardElem = document.getElementById("connect4Board");
  const statusElem = document.getElementById("connect4Status");
  const restartBtn = document.getElementById("restartConnect4");
  const playersElem = document.getElementById("players-info");
  const timerElem = document.getElementById("timer");

  let gameState = null;
  let currentUsername = null;
  let gameActive = false;
  let refreshInterval = null;
  let timerInterval = null;

  // Function to send messages to the parent Devvit app
  function sendMessage(message) {
    // console.log('Sending message:', message);
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
      message = "Great game! The board is full with no winner.";
      emoji = '🤝';
    } else if (winner === currentUsername) {
      modalClass = 'win-modal celebration';
      title = "🎉 Congratulations! 🎉";
      message = `You got four in a row! Excellent strategy!`;
      emoji = '🏆';
    } else {
      modalClass = 'lose-modal';
      title = "Game Over 😔";
      message = reason === 'timeout' 
        ? `Time's up! ${winner} wins by timeout.`
        : `${winner} got four in a row! Better luck next time.`;
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

  // Get player color (red for first player, yellow for second)
  function getPlayerColor(username) {
    if (!gameState || !gameState.players) return 'red';
    const playerIndex = gameState.players.indexOf(username);
    return playerIndex === 0 ? 'red' : 'yellow';
  }

  function renderBoard() {
    if (!gameState) return;
    
    boardElem.innerHTML = '';
    
    // Create each column element
    for (let c = 0; c < 7; c++) {
      const colDiv = document.createElement('div');
      colDiv.classList.add('column');
      colDiv.dataset.col = c;
      // Attach event listener for column click
      colDiv.addEventListener('click', () => handleColumnClick(c));

      // Create cells in column (from top to bottom for display)
      for (let r = 0; r < 6; r++) {
        const cell = document.createElement('div');
        cell.classList.add('connect4-cell');
        cell.dataset.row = r;
        cell.dataset.col = c;
        
        // Check if there's a disc at this position
        if (gameState.connect4[c][r]) {
          const playerColor = getPlayerColor(gameState.connect4[c][r]);
          cell.classList.add(playerColor);
        }
        
        colDiv.appendChild(cell);
      }
      boardElem.appendChild(colDiv);
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
      const colorEmoji = turnColor === 'red' ? '🔴' : '🟡';
      statusElem.textContent = isMyTurn 
        ? `🎯 Your turn - Drop your disc! (${colorEmoji})` 
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
      const colorEmoji = winnerColor === 'red' ? '🔴' : '🟡';
      statusElem.textContent = gameState.winner === currentUsername 
        ? `🏆 You won! (${colorEmoji})` 
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
        const color = index === 0 ? 'Red' : 'Yellow';
        const emoji = index === 0 ? '🔴' : '🟡';
        const isCurrent = player === currentUsername;
        return `${player} (${emoji} ${color})${isCurrent ? ' - You' : ''}`;
      }).join(', ');
      playersElem.textContent = `👥 Players: ${playersList}`;
    }
  }

  function handleColumnClick(col) {
    if (!gameState || !gameActive || gameState.status !== 'active') return;
    if (gameState.turn !== currentUsername) return;
    
    // Check if column is full (check top row)
    if (gameState.connect4[col][0]) return; // Top cell is occupied
    
    // Show drop animation before sending move
    animateDiscDrop(col);

    // Send move to server
    sendMessage({
      type: 'makeMove',
      data: {
        username: currentUsername,
        position: col,
        gameType: 'connect4'
      }
    });
  }

  // Animate disc dropping
  function animateDiscDrop(col) {
    const column = boardElem.children[col];
    if (!column) return;

    // Find the lowest empty cell in this column
    let targetRow = -1;
    for (let r = 5; r >= 0; r--) {
      if (!gameState.connect4[col][r]) {
        targetRow = r;
        break;
      }
    }

    if (targetRow === -1) return; // Column is full

    // Create a temporary disc for animation
    const animDisc = document.createElement('div');
    animDisc.className = 'connect4-cell dropping';
    animDisc.classList.add(getPlayerColor(currentUsername));
    
    // Position it at the top of the column
    const targetCell = column.children[targetRow];
    targetCell.appendChild(animDisc);
    
    // Remove animation class after animation completes
    setTimeout(() => {
      animDisc.classList.remove('dropping');
    }, 500);
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
        
        setTimeout(() => {
          // console.log('Initializing game...');
          sendMessage({ type: 'initializeGame' });
        }, 100);
        break;

      case 'gameState':
        // console.log('Received game state:', message.data);
        gameState = message.data;
        gameActive = gameState.status === 'active';
        renderBoard();
        updateStatus();
        updatePlayersInfo();
        
        // Auto-join if not already in the game
        if (!gameState.players.includes(currentUsername)) {
          setTimeout(() => {
            // console.log('Auto-joining game...');
            sendMessage({
              type: 'joinGame',
              data: { username: currentUsername }
            });
          }, 300);
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
          renderBoard();
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
          renderBoard();
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
          renderBoard();
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
          renderBoard();
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