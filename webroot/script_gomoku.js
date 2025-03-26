(function() {
  const boardElem = document.getElementById('gomokuBoard');
  const statusElem = document.getElementById('gomokuStatus');
  const restartBtn = document.getElementById('gomokuRestart');
  const winnerModal = document.getElementById('winnerModal');
  const winnerMessage = document.getElementById('winnerMessage');
  const closeModal = document.getElementById('closeModal');

  const boardSize = 15;
  let board = Array(boardSize * boardSize).fill(null);
  let currentPlayer = 'X';
  let gameActive = true;
  let moveCount = 0;

  function renderBoard() {
    boardElem.innerHTML = '';
    for (let i = 0; i < boardSize * boardSize; i++) {
      const cell = document.createElement('div');
      cell.className = 'gomoku-cell';
      cell.dataset.index = i;
      if (board[i]) {
        const stone = document.createElement('div');
        stone.className = 'gomoku-stone ' + (board[i].player === 'X' ? 'black-stone' : 'white-stone');
        stone.textContent = board[i].move;
        cell.appendChild(stone);
      }
      cell.addEventListener('click', () => handleCellClick(i));
      boardElem.appendChild(cell);
    }
  }

  function handleCellClick(index) {
    if (!gameActive || board[index]) return;
    moveCount++;
    board[index] = { player: currentPlayer, move: moveCount };
    renderBoard();
    if (checkWin(index)) {
      showWinner(currentPlayer === 'X' ? 'Black' : 'White');
      gameActive = false;
      return;
    }
    if (board.every(cell => cell !== null)) {
      showWinner("It's a draw!");
      gameActive = false;
      return;
    }
    currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
    statusElem.textContent = `Current turn: ${currentPlayer === 'X' ? 'Black' : 'White'}`;
  }

  function countDirection(row, col, deltaRow, deltaCol, player) {
    let count = 0;
    let r = row, c = col;
    while (r >= 0 && r < boardSize && c >= 0 && c < boardSize) {
      const idx = r * boardSize + c;
      if (board[idx] && board[idx].player === player) {
        count++;
        r += deltaRow;
        c += deltaCol;
      } else {
        break;
      }
    }
    return count;
  }

  function checkWin(index) {
    const row = Math.floor(index / boardSize);
    const col = index % boardSize;
    const player = board[index].player;

    return (
      countDirection(row, col, 0, -1, player) + countDirection(row, col + 1, 0, 1, player) >= 5 ||
      countDirection(row, col, -1, 0, player) + countDirection(row + 1, col, 1, 0, player) >= 5 ||
      countDirection(row, col, -1, -1, player) + countDirection(row + 1, col + 1, 1, 1, player) >= 5 ||
      countDirection(row, col, -1, 1, player) + countDirection(row + 1, col - 1, 1, -1, player) >= 5
    );
  }

  function showWinner(winner) {
    winnerMessage.textContent = `${winner} wins!`;
    winnerModal.style.display = "flex";
  }

  closeModal.addEventListener("click", () => {
    winnerModal.style.display = "none";
  });

  restartBtn.addEventListener('click', () => {
    board = Array(boardSize * boardSize).fill(null);
    currentPlayer = 'X';
    gameActive = true;
    moveCount = 0;
    statusElem.textContent = `Current turn: Black`;
    renderBoard();
  });

  statusElem.textContent = `Current turn: Black`;
  renderBoard();
})();
