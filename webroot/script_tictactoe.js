(function() {
  const boardElem = document.getElementById('board');
  const statusElem = document.getElementById('status');
  const restartBtn = document.getElementById('restart');

  // Initialize the board and game variables.
  let board = Array(9).fill(null);
  let currentPlayer = 'X';
  let gameActive = true;

  // Renders the Tic Tac Toe board.
  function renderBoard() {
    boardElem.innerHTML = ''; // Clear existing board
    board.forEach((cell, index) => {
      const cellDiv = document.createElement('div');
      cellDiv.className = 'cell';
      cellDiv.dataset.index = index;
      cellDiv.textContent = cell || '';
      cellDiv.addEventListener('click', () => handleCellClick(index));
      boardElem.appendChild(cellDiv);
    });
  }

  // Handles a click on a board cell.
  function handleCellClick(index) {
    if (!gameActive || board[index]) return; // Ignore if game over or cell is occupied
    board[index] = currentPlayer;
    renderBoard();
    if (checkWin()) {
      statusElem.textContent = `Player ${currentPlayer} wins!`;
      gameActive = false;
      return;
    }
    if (board.every(cell => cell !== null)) {
      statusElem.textContent = "It's a draw!";
      gameActive = false;
      return;
    }
    // Switch player.
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    statusElem.textContent = `Current turn: ${currentPlayer}`;
  }

  // Checks if the current player has won.
  function checkWin() {
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
    return winPatterns.some(pattern => {
      const [a, b, c] = pattern;
      return board[a] && board[a] === board[b] && board[a] === board[c];
    });
  }

  // Restart the game.
  restartBtn.addEventListener('click', () => {
    board = Array(9).fill(null);
    currentPlayer = 'X';
    gameActive = true;
    statusElem.textContent = `Current turn: ${currentPlayer}`;
    renderBoard();
  });

  // Initialize board and status on load.
  statusElem.textContent = `Current turn: ${currentPlayer}`;
  renderBoard();
})();
