(function() {
  // Send webViewReady immediately when script loads
  function sendMessage(message) {
    // console.log('Sending message:', message);
    window.parent.postMessage(message, '*');
  }
  
  // Notify parent immediately that web view is ready
  sendMessage({ type: 'webViewReady' });

  const boardElem = document.getElementById('gomokuBoard');
  const statusElem = document.getElementById('gomokuStatus');
  const restartBtn = document.getElementById('gomokuRestart');
  const playersElem = document.getElementById('players-info');
  const timerElem = document.getElementById('timer');

  let gameState = null;
  let currentUsername = null;
  let gameActive = false;
  let moveCount = 0;
  let refreshInterval = null;
  let timerInterval = null;
  
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

  // Auto-refresh game state every 3 seconds
  function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
      if (gameActive && gameState && gameState.status === 'active') {
        if (connectionStatus === 'connected_ws') {
          sendMessage({ type: 'requestGameState' });
        }
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

  // Connection resilience functions (same as tictactoe)
  function updateConnectionStatus(status) {
    connectionStatus = status;
    updateConnectionUI();
  }

  function updateConnectionUI() {
    let connectionText = '';
    let connectionClass = 'status-display';
    
    switch (connectionStatus) {
      case 'disconnected':
        connectionText = '🔴 Disconnected - Please refresh';
        connectionClass += ' connection-error';
        break;
      case 'connecting_ws':
        connectionText = '🟡 Connecting via WebSocket...';
        connectionClass += ' connection-connecting';
        break;
      case 'connected_ws':
        connectionText = '🟢 Connected (Real-time)';
        connectionClass += ' connection-success';
        break;
      case 'connecting_polling':
        connectionText = '🟡 Connecting via HTTP...';
        connectionClass += ' connection-connecting';
        break;
      case 'connected_polling':
        connectionText = '🟠 Connected (Polling - limited real-time)';
        connectionClass += ' connection-polling';
        break;
    }
    
    if (playersElem) {
      playersElem.textContent = connectionText;
      playersElem.className = connectionClass;
    }
  }

  function connectWebSocket() {
    if (wsRetryTimeout) {
      clearTimeout(wsRetryTimeout);
      wsRetryTimeout = null;
    }
    
    if (wsConnectionTimeout) {
      clearTimeout(wsConnectionTimeout);
      wsConnectionTimeout = null;
    }
    
    updateConnectionStatus('connecting_ws');
    
    try {
      socket = new WebSocket(`${gameServerUrl}/game`);
      
      wsConnectionTimeout = setTimeout(() => {
        if (socket && socket.readyState === WebSocket.CONNECTING) {
          socket.close();
          handleWebSocketError(new Error('Connection timeout'));
        }
      }, 10000);
      
      socket.onopen = function(event) {
        console.log('WebSocket Connected:', event);
        if (wsConnectionTimeout) {
          clearTimeout(wsConnectionTimeout);
          wsConnectionTimeout = null;
        }
        
        updateConnectionStatus('connected_ws');
        wsRetryCount = 0;
        wsRetryDelay = 1000;
        
        stopPolling();
        
        sendMessage({ type: 'initializeGame' });
        sendMessage({ type: 'requestGameState' });
      };
      
      socket.onerror = function(error) {
        console.error('WebSocket Error:', error);
        handleWebSocketError(error);
      };
      
      socket.onclose = function(event) {
        console.log('WebSocket Closed:', event);
        if (wsConnectionTimeout) {
          clearTimeout(wsConnectionTimeout);
          wsConnectionTimeout = null;
        }
        
        if (connectionStatus === 'connected_ws') {
          handleWebSocketError(new Error(`Connection lost: ${event.reason || 'Unknown reason'}`));
        }
      };
      
      socket.onmessage = function(event) {
        try {
          const data = JSON.parse(event.data);
          handleMessage({ data: data });
        } catch (e) {
          console.error('Failed to parse WebSocket message:', e);
        }
      };
      
    } catch (error) {
      handleWebSocketError(error);
    }
  }

  function handleWebSocketError(error) {
    console.error('WebSocket connection failed:', error);
    
    if (wsConnectionTimeout) {
      clearTimeout(wsConnectionTimeout);
      wsConnectionTimeout = null;
    }
    
    wsRetryCount++;
    
    if (wsRetryCount <= maxWsRetries) {
      updateConnectionStatus('disconnected');
      
      wsRetryTimeout = setTimeout(() => {
        connectWebSocket();
      }, wsRetryDelay);
      
      wsRetryDelay = Math.min(wsRetryDelay * 2, maxRetryDelay);
      
      console.log(`WebSocket retry ${wsRetryCount}/${maxWsRetries} in ${wsRetryDelay/1000}s`);
    } else {
      console.log('WebSocket retries exhausted, switching to HTTP polling');
      startPolling();
    }
  }

  function startPolling() {
    if (!postId) {
      console.error('Cannot start polling: postId not available');
      updateConnectionStatus('disconnected');
      return;
    }
    
    updateConnectionStatus('connecting_polling');
    
    pollGameState().then(success => {
      if (success) {
        updateConnectionStatus('connected_polling');
        
        pollingInterval = setInterval(() => {
          pollGameState().then(success => {
            if (!success) {
              stopPolling();
              updateConnectionStatus('disconnected');
              
              wsRetryCount = 0;
              wsRetryDelay = 1000;
              wsRetryTimeout = setTimeout(() => {
                connectWebSocket();
              }, 5000);
            }
          });
        }, 2000);
        
        wsReconnectInterval = setInterval(() => {
          if (connectionStatus === 'connected_polling') {
            console.log('Attempting to upgrade from polling to WebSocket...');
            wsRetryCount = 0;
            wsRetryDelay = 1000;
            connectWebSocket();
          }
        }, 60000);
        
      } else {
        updateConnectionStatus('disconnected');
      }
    });
  }

  function stopPolling() {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    
    if (wsReconnectInterval) {
      clearInterval(wsReconnectInterval);
      wsReconnectInterval = null;
    }
  }

  async function pollGameState() {
    try {
      const response = await fetch(`${gameServerUrl.replace('wss://', 'https://')}/api/gamestate/${postId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const gameStateData = await response.json();
      
      handleMessage({
        data: {
          type: 'gameState',
          data: gameStateData
        }
      });
      
      return true;
    } catch (error) {
      console.error('Polling failed:', error);
      return false;
    }
  }

  function sendGameAction(action) {
    if (connectionStatus === 'connected_ws' && socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(action));
    } else if (connectionStatus === 'connected_polling') {
      sendActionViaHTTP(action);
    } else {
      console.error('Cannot send action: not connected');
      statusElem.textContent = '❌ Cannot make move: not connected';
    }
  }

  async function sendActionViaHTTP(action) {
    try {
      const response = await fetch(`${gameServerUrl.replace('wss://', 'https://')}/api/action`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          postId: postId,
          action: action
        }),
        credentials: 'omit'
      });
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      setTimeout(() => {
        pollGameState();
      }, 100);
      
    } catch (error) {
      console.error('Failed to send action via HTTP:', error);
      statusElem.textContent = `❌ Action failed: ${error.message}`;
    }
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
      message = `You got five in a row! Master strategist!`;
      emoji = '🏆';
    } else {
      modalClass = 'lose-modal';
      title = "Game Over 😔";
      message = reason === 'timeout' 
        ? `Time's up! ${winner} wins by timeout.`
        : `${winner} got five in a row! Better luck next time.`;
      emoji = '😔';
    }
    
    modal.innerHTML = `
      <div class="modal-content ${modalClass}">
        <h2>${emoji} ${title} ${emoji}</h2>
        <p>${message}</p>
        <button onclick="this.closest('.modal').remove(); sendMessage({type: 'requestGameState'});">
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

  // Get player stone type (black for first player, white for second)
  function getPlayerStone(username) {
    if (!gameState || !gameState.players) return 'black-stone';
    const playerIndex = gameState.players.indexOf(username);
    return playerIndex === 0 ? 'black-stone' : 'white-stone';
  }

  function renderBoard() {
    if (!gameState) return;
    
    boardElem.innerHTML = '';
    moveCount = 0;
    
    for (let i = 0; i < 225; i++) { // 15x15 = 225
      const cell = document.createElement('div');
      cell.className = 'gomoku-cell';
      cell.dataset.index = i;
      
      if (gameState.gomoku[i]) {
        const stone = document.createElement('div');
        const stoneClass = getPlayerStone(gameState.gomoku[i]);
        stone.className = `gomoku-stone ${stoneClass}`;
        moveCount++;
        stone.textContent = moveCount;
        cell.appendChild(stone);
      }
      
      cell.addEventListener('click', () => handleCellClick(i));
      boardElem.appendChild(cell);
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
      const stoneType = getPlayerStone(gameState.turn).includes('black') ? 'Black ⚫' : 'White ⚪';
      statusElem.textContent = isMyTurn 
        ? `🎯 Your turn (${stoneType})` 
        : `⏳ ${gameState.turn}'s turn (${stoneType})`;
      
      if (isMyTurn) {
        statusElem.style.background = 'linear-gradient(135deg, #28a745 0%, #20c997 100%)';
        statusElem.style.color = 'white';
      } else {
        statusElem.style.background = 'rgba(255, 255, 255, 0.95)';
        statusElem.style.color = '#333';
      }
    } else if (gameState.status === 'finished') {
      const winnerStone = getPlayerStone(gameState.winner).includes('black') ? 'Black ⚫' : 'White ⚪';
      statusElem.textContent = gameState.winner === currentUsername 
        ? `🏆 You won! (${winnerStone})` 
        : `😔 ${gameState.winner} won! (${winnerStone})`;
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
    
    if (gameState && gameState.status === 'active' && gameState.players.length >= 2) {
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
        const stone = index === 0 ? 'Black ⚫' : 'White ⚪';
        const isCurrent = player === currentUsername;
        return `${player} (${stone})${isCurrent ? ' - You' : ''}`;
      }).join(', ');
      playersElem.textContent = `👥 Players: ${playersList}`;
    }
  }

  function handleCellClick(index) {
    if (!gameState || !gameActive || gameState.status !== 'active') return;
    if (gameState.turn !== currentUsername) return;
    if (gameState.gomoku[index]) return; // Cell already occupied

    // Convert index to x, y coordinates
    const x = index % 15;
    const y = Math.floor(index / 15);

    // Send move to server
    sendMessage({
      type: 'makeMove',
      data: {
        username: currentUsername,
        position: [x, y],
        gameType: 'gomoku'
      }
    });
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
        renderBoard();
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

  // Also listen for DOMContentLoaded to ensure early initialization
  document.addEventListener('DOMContentLoaded', () => {
    sendMessage({ type: 'webViewReady' });
  });

  restartBtn.addEventListener('click', () => {
    sendMessage({ type: 'requestGameState' });
  });

  // Initialize
  statusElem.textContent = '🔄 Connecting...';
  statusElem.className = 'status-display';

  // Make sendMessage available globally for modal buttons
  window.sendMessage = sendMessage;
})();