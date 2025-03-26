(function() {
  // Element references.
  const boardElem = document.getElementById("reactionBoard");
  const startBtn = document.getElementById("startGame");
  const scoreElem = document.getElementById("reactionScore");
  const leaderboardElem = document.getElementById("leaderboard");

  // Default username (to be updated via initialData from parent).
  let username = "Guest";
  let gameActive = false;
  let score = 0;
  let clickTimes = [];
  let gameTimer = null;

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
    highlightRandom();
    // End the game after 20 seconds.
    gameTimer = setTimeout(endGame, 20000);
  }

  // End the game, compute average (rounded to 2 decimals) and median reaction times,
  // update final score, and append results to the leaderboard.
  function endGame() {
    gameActive = false;
    startBtn.disabled = false;
    // Compute average reaction time.
    const avgTime = clickTimes.length ? (clickTimes.reduce((a, b) => a + b, 0) / clickTimes.length) : 0;
    // Compute median reaction time.
    const sortedTimes = [...clickTimes].sort((a, b) => a - b);
    const medianTime = sortedTimes.length ? sortedTimes[Math.floor(sortedTimes.length / 2)] : 0;
    const avgRounded = Number(avgTime.toFixed(2));

    scoreElem.textContent = `Final Score: ${score}`;

    // Append new row to the leaderboard.
    const newRow = document.createElement('tr');
    newRow.innerHTML = `<td>${username}</td><td>${score}</td><td>${avgRounded} ms</td><td>${Math.round(medianTime)} ms</td>`;
    leaderboardElem.appendChild(newRow);
  }

  // Listen for messages from the parent Devvit app to update the username.
  window.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'initialData') {
      if (event.data.data && event.data.data.username) {
        username = event.data.data.username;
      }
    }
  });

  startBtn.addEventListener('click', startGame);

  // Initial render.
  renderBoard();
})();
