(function() {
  const boardElem = document.getElementById('board');
  const statusElem = document.getElementById('status');
  const restartBtn = document.getElementById('restart');
  const winningLine = document.getElementById('winning-line');

  let board = Array(9).fill(null);
  let currentPlayer = 'X';
  let gameActive = true;

  // Renders the board with cells
  function renderBoard() {
    boardElem.innerHTML = '';
    board.forEach((cell, index) => {
      const cellDiv = document.createElement('div');
      cellDiv.className = 'cell';
      cellDiv.dataset.index = index;
      cellDiv.textContent = cell || '';
      cellDiv.addEventListener('click', () => handleCellClick(index));
      boardElem.appendChild(cellDiv);
    });
  }

  // Handles cell click
  function handleCellClick(index) {
    if (!gameActive || board[index]) return;
    
    board[index] = currentPlayer;
    renderBoard();

    const winPattern = checkWin();
    if (winPattern) {
      statusElem.textContent = `Player ${currentPlayer} wins!`;
      drawWinningLine(winPattern);
      gameActive = false;
      return;
    }

    if (board.every(cell => cell !== null)) {
      statusElem.textContent = "It's a draw!";
      gameActive = false;
      return;
    }

    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    statusElem.textContent = `Current turn: ${currentPlayer}`;
  }

  // Checks winning condition
  function checkWin() {
    const winPatterns = [
      [0, 1, 2], [3, 4, 5], [6, 7, 8], // Rows
      [0, 3, 6], [1, 4, 7], [2, 5, 8], // Columns
      [0, 4, 8], [2, 4, 6]             // Diagonals
    ];

    for (let pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return pattern; // Return winning pattern
      }
    }
    return null;
  }

  // Draws a winning line through the victory pattern
  function drawWinningLine(pattern) {
    const cells = document.querySelectorAll('.cell');
    const [start, , end] = pattern;
    
    const startRect = cells[start].getBoundingClientRect();
    const endRect = cells[end].getBoundingClientRect();
    
    const boardRect = boardElem.getBoundingClientRect();
    
    winningLine.style.display = 'block';
    winningLine.style.width = `${Math.sqrt(
      Math.pow(endRect.x - startRect.x, 2) + Math.pow(endRect.y - startRect.y, 2)
    )}px`;

    winningLine.style.transform = `rotate(${getRotationAngle(pattern)}deg)`;
    winningLine.style.left = `${(startRect.left + endRect.left) / 2 - boardRect.left}px`;
    winningLine.style.top = `${(startRect.top + endRect.top) / 2 - boardRect.top}px`;
  }

  // Determines the angle for the winning line
  function getRotationAngle(pattern) {
    if (pattern[0] === 0 && pattern[2] === 2) return 0;   // Top row
    if (pattern[0] === 3 && pattern[2] === 5) return 0;   // Middle row
    if (pattern[0] === 6 && pattern[2] === 8) return 0;   // Bottom row
    if (pattern[0] === 0 && pattern[2] === 6) return 90;  // Left column
    if (pattern[0] === 1 && pattern[2] === 7) return 90;  // Middle column
    if (pattern[0] === 2 && pattern[2] === 8) return 90;  // Right column
    if (pattern[0] === 0 && pattern[2] === 8) return 45;  // Left diagonal
    if (pattern[0] === 2 && pattern[2] === 6) return -45; // Right diagonal
    return 0;
  }

  // Restart game
  restartBtn.addEventListener('click', () => {
    board = Array(9).fill(null);
    currentPlayer = 'X';
    gameActive = true;
    statusElem.textContent = `Current turn: ${currentPlayer}`;
    winningLine.style.display = 'none';
    renderBoard();
  });

  // Initialize game
  statusElem.textContent = `Current turn: ${currentPlayer}`;
  renderBoard();
})();
