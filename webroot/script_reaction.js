(function() {
  // Element references.
  const boardElem = document.getElementById("reactionBoard");
  const startBtn = document.getElementById("startGame");
  const scoreElem = document.getElementById("reactionScore");
  const leaderboardElem = document.getElementById("leaderboard");
  const playersElem = document.getElementById("players-info");
  const paginationElem = document.getElementById("pagination");

  // Default username (to be updated via initialData from parent).
  let currentUsername = "Guest";
  let gameActive = false;
  let score = 0;
  let clickTimes = [];
  let gameTimer = null;
  let refreshInterval = null;
  let allScores = [];
  let currentPage = 0;
  const scoresPerPage = 5;

  // Function to send messages to the parent Devvit app
  function sendMessage(message) {
    console.log('Sending message:', message);
    window.parent.postMessage(message, '*');
  }

  // Auto-refresh leaderboard every 5 seconds
  function startAutoRefresh() {
    if (refreshInterval) clearInterval(refreshInterval);
    refreshInterval = setInterval(() => {
      // Request updated scores
      sendMessage({ type: 'getReactionScores' });
    }, 5000);
  }

  // Show game end modal
  function showGameEndModal(finalScore, avgTime) {
    const modal = document.createElement('div');
    modal.className = 'modal';
    
    let modalClass = 'win-modal celebration';
    let title = '🎉 Game Complete! 🎉';
    let message = `Final Score: ${finalScore} clicks<br>Average Time: ${avgTime}ms<br>Great reflexes!`;
    
    if (avgTime < 300) {
      message += '<br>🏎️ F1 Driver level reflexes!';
    } else if (avgTime < 500) {
      message += '<br>⚡ Lightning fast!';
    } else if (avgTime < 700) {
      message += '<br>👍 Good reflexes!';
    }
    
    modal.innerHTML = `
      <div class="modal-content ${modalClass}">
        <h2>🏆 ${title} 🏆</h2>
        <p>${message}</p>
        <button onclick="this.closest('.modal').remove();">
          Continue
        </button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // Auto-remove after 8 seconds
    setTimeout(() => {
      if (modal.parentNode) {
        modal.remove();
      }
    }, 8000);
  }

  // Render a 5x5 grid.
  function renderBoard() {
    boardElem.innerHTML = '';
    for (let i = 0; i < 25; i++) {
      const cell = document.createElement('div');
      cell.classList.add('reaction-cell');
      cell.dataset.index = i;
      boardElem.appendChild(cell);
    }
  }

  // Highlight exactly one random cell and attach a click handler only to it.
  function highlightRandom() {
    // Remove the "active" class and click handler from all cells.
    const cells = document.querySelectorAll('.reaction-cell');
    cells.forEach(c => {
      c.classList.remove('active');
      c.onclick = null;
    });
    // Pick one random cell.
    const randomIndex = Math.floor(Math.random() * cells.length);
    const activeCell = cells[randomIndex];
    activeCell.classList.add('active');
    // Record the time when this cell is highlighted.
    const highlightTime = performance.now();
    activeCell.onclick = function() {
      if (!gameActive) return;
      // Only the active cell responds.
      const reactionTime = performance.now() - highlightTime;
      clickTimes.push(reactionTime);
      score++;
      scoreElem.textContent = `Score: ${score} | Avg: ${Math.round(clickTimes.reduce((a, b) => a + b, 0) / clickTimes.length)}ms`;
      // Immediately highlight a new random cell.
      highlightRandom();
    };
  }

  // Start the Reaction Speed game.
  function startGame() {
    score = 0;
    clickTimes = [];
    gameActive = true;
    startBtn.disabled = true;
    startBtn.textContent = 'Game in Progress...';
    scoreElem.textContent = `Score: ${score}`;
    highlightRandom();
    // End the game after 20 seconds.
    gameTimer = setTimeout(endGame, 20000);
  }

  // End the game, compute average (rounded to 2 decimals) and median reaction times,
  // update final score, and send results to server.
  function endGame() {
    gameActive = false;
    startBtn.disabled = false;
    startBtn.textContent = 'Start Game';
    
    // Remove active highlighting
    const cells = document.querySelectorAll('.reaction-cell');
    cells.forEach(c => {
      c.classList.remove('active');
      c.onclick = null;
    });
    
    // Compute average reaction time.
    const avgTime = clickTimes.length ? (clickTimes.reduce((a, b) => a + b, 0) / clickTimes.length) : 0;
    // Compute median reaction time.
    const sortedTimes = [...clickTimes].sort((a, b) => a - b);
    const medianTime = sortedTimes.length ? sortedTimes[Math.floor(sortedTimes.length / 2)] : 0;
    const avgRounded = Number(avgTime.toFixed(2));

    scoreElem.textContent = `Final Score: ${score} | Avg: ${avgRounded}ms`;

    // Show completion modal
    setTimeout(() => {
      showGameEndModal(score, avgRounded);
    }, 500);

    // Send score to server
    sendMessage({
      type: 'updateScore',
      data: {
        username: currentUsername,
        score: score,
        avgTime: avgRounded,
        medianTime: Math.round(medianTime)
      }
    });
  }

  // Update leaderboard display with pagination
  function updateLeaderboard(scores) {
    allScores = scores;
    
    // Sort scores by score (descending), then by average time (ascending)
    const sortedScores = [...allScores].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.avgTime - b.avgTime;
    });

    // Clear existing rows except header
    const rows = leaderboardElem.querySelectorAll('tr:not(:first-child)');
    rows.forEach(row => row.remove());

    // Calculate pagination
    const totalPages = Math.ceil(sortedScores.length / scoresPerPage);
    const maxPages = Math.min(totalPages, 5); // Limit to 5 pages max
    
    // Find current user's position
    const userPosition = sortedScores.findIndex(s => s.username === currentUsername);
    
    // Determine which page to show
    let startIndex, endIndex;
    if (userPosition !== -1 && userPosition >= scoresPerPage * maxPages) {
      // Show page with current user if they're beyond the first 5 pages
      const userPage = Math.floor(userPosition / scoresPerPage);
      currentPage = Math.min(userPage, maxPages - 1);
    }
    
    startIndex = currentPage * scoresPerPage;
    endIndex = Math.min(startIndex + scoresPerPage, sortedScores.length);
    
    // Add rows for current page
    const pageScores = sortedScores.slice(startIndex, endIndex);
    pageScores.forEach((scoreData, index) => {
      const globalRank = startIndex + index + 1;
      const newRow = document.createElement('tr');
      const isCurrentUser = scoreData.username === currentUsername;
      
      if (isCurrentUser) {
        newRow.style.backgroundColor = '#ffffcc';
        newRow.style.fontWeight = 'bold';
      }
      
      // Add rank emoji
      let rankEmoji = '';
      if (globalRank === 1) rankEmoji = '🥇';
      else if (globalRank === 2) rankEmoji = '🥈';
      else if (globalRank === 3) rankEmoji = '🥉';
      
      newRow.innerHTML = `
        <td>${rankEmoji} ${globalRank}</td>
        <td>${scoreData.username}${isCurrentUser ? ' (You)' : ''}</td>
        <td>${scoreData.score}</td>
        <td>${scoreData.avgTime} ms</td>
        <td>${scoreData.medianTime} ms</td>
      `;
      leaderboardElem.appendChild(newRow);
    });

    // Update pagination
    updatePagination(totalPages, maxPages);
  }

  // Update pagination controls
  function updatePagination(totalPages, maxPages) {
    if (!paginationElem) return;
    
    paginationElem.innerHTML = '';
    
    if (totalPages <= 1) return;
    
    // Previous button
    if (currentPage > 0) {
      const prevBtn = document.createElement('button');
      prevBtn.textContent = '← Prev';
      prevBtn.onclick = () => {
        currentPage--;
        updateLeaderboard(allScores);
      };
      paginationElem.appendChild(prevBtn);
    }
    
    // Page info
    const pageInfo = document.createElement('span');
    pageInfo.textContent = `Page ${currentPage + 1} of ${Math.min(totalPages, maxPages)}`;
    pageInfo.style.margin = '0 10px';
    paginationElem.appendChild(pageInfo);
    
    // Next button
    if (currentPage < maxPages - 1 && currentPage < totalPages - 1) {
      const nextBtn = document.createElement('button');
      nextBtn.textContent = 'Next →';
      nextBtn.onclick = () => {
        currentPage++;
        updateLeaderboard(allScores);
      };
      paginationElem.appendChild(nextBtn);
    }
  }

  // Handle messages from parent
  function handleMessage(event) {
    // Handle both direct messages and Devvit wrapped messages
    let message = event.data;
    if (message.type === 'devvit-message' && message.data && message.data.message) {
      message = message.data.message;
    }
    
    console.log('Received message from parent:', message);
    
    switch (message.type) {
      case 'initialData':
        currentUsername = message.data.username;
        console.log('Set username:', currentUsername);
        if (playersElem) {
          playersElem.textContent = `👥 Player: ${currentUsername}`;
          playersElem.className = 'status-display';
        }
        
        // Start auto-refresh for leaderboard
        startAutoRefresh();
        
        setTimeout(() => {
          console.log('Initializing game...');
          sendMessage({ type: 'initializeGame' });
          // Get initial scores
          sendMessage({ type: 'getReactionScores' });
        }, 100);
        break;

      case 'gameState':
        console.log('Received game state:', message.data);
        // For reaction game, we don't need complex game state management
        // but we should still start auto-refresh for leaderboard updates
        if (!refreshInterval) {
          startAutoRefresh();
        }
        
        // Auto-join if not already in game
        if (message.data && message.data.players && !message.data.players.includes(currentUsername)) {
          setTimeout(() => {
            console.log('Auto-joining game...');
            sendMessage({
              type: 'joinGame',
              data: { username: currentUsername }
            });
          }, 200);
        }
        break;

      case 'scoreUpdate':
        console.log('Score update received:', message.data);
        if (message.data.scores) {
          updateLeaderboard(message.data.scores);
        }
        break;

      case 'error':
        console.error('Game error:', message.message);
        break;
    }
  }

  // Add event listener
  window.addEventListener('message', handleMessage);

  startBtn.addEventListener('click', startGame);

  // Initial render.
  renderBoard();
  
  // Notify parent that web view is ready
  sendMessage({ type: 'webViewReady' });

  // Make sendMessage available globally for modal buttons
  window.sendMessage = sendMessage;
})();