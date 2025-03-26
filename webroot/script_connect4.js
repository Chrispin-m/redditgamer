document.addEventListener('DOMContentLoaded', () => {
  const rows = 6, cols = 7;
  const boardElem = document.getElementById("connect4Board");
  const statusElem = document.getElementById("connect4Status");
  const restartBtn = document.getElementById("restartConnect4");

  // Create a 2D board array (rows x cols) filled with null.
  const board = Array.from({ length: rows }, () => Array(cols).fill(null));
  let currentPlayer = 'red';
  let gameActive = true;

  function renderBoard() {
    boardElem.innerHTML = '';
    // Create each column element
    for (let c = 0; c < cols; c++) {
      const colDiv = document.createElement('div');
      colDiv.classList.add('column');
      colDiv.dataset.col = c;
      // Attach event listener for column click.
      colDiv.addEventListener('click', () => handleColumnClick(c));

      // Create cells in column (from bottom to top)
      for (let r = 0; r < rows; r++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        if (board[r][c]) {
          cell.classList.add(board[r][c]);
        }
        colDiv.appendChild(cell);
      }
      boardElem.appendChild(colDiv);
    }
  }

  function handleColumnClick(col) {
    if (!gameActive) return;
    // Find the lowest empty cell in the selected column.
    for (let r = 0; r < rows; r++) {
      if (!board[r][col]) {
        board[r][col] = currentPlayer;
        renderBoard();
        if (checkWin(r, col)) {
          statusElem.textContent = `Player ${currentPlayer.toUpperCase()} wins!`;
          gameActive = false;
          return;
        }
        // Check for draw.
        if (board.every(row => row.every(cell => cell !== null))) {
          statusElem.textContent = "It's a draw!";
          gameActive = false;
          return;
        }
        // Switch player.
        currentPlayer = currentPlayer === 'red' ? 'yellow' : 'red';
        statusElem.textContent = `Player ${currentPlayer.toUpperCase()}'s Turn`;
        return;
      }
    }
  }

  function checkWin(row, col) {
    function countDirection(rStep, cStep) {
      let count = 0, r = row, c = col;
      while (r >= 0 && r < rows && c >= 0 && c < cols && board[r][c] === currentPlayer) {
        count++;
        r += rStep;
        c += cStep;
      }
      return count - 1;
    }
    // Check vertical, horizontal, and two diagonal directions.
    const vertical = countDirection(1, 0) + countDirection(-1, 0);
    const horizontal = countDirection(0, 1) + countDirection(0, -1);
    const diag1 = countDirection(1, 1) + countDirection(-1, -1);
    const diag2 = countDirection(1, -1) + countDirection(-1, 1);
    return vertical >= 3 || horizontal >= 3 || diag1 >= 3 || diag2 >= 3;
  }

  restartBtn.addEventListener('click', () => {
    for (let r = 0; r < rows; r++) {
      board[r].fill(null);
    }
    gameActive = true;
    currentPlayer = 'red';
    statusElem.textContent = "Player Red's Turn";
    renderBoard();
  });

  renderBoard();
});
