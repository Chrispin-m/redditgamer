(function() {
  // Element references
  const gameMenu = document.getElementById('gameMenu');
  const gameContainer = document.getElementById('gameContainer');

  // Local state variable
  let state = null;

  // Function to send messages to the parent Devvit app
  function sendMessage(message) {
    window.parent.postMessage(message, '*');
  }

  // Render the game based on the current state
  function renderGame() {
    gameContainer.innerHTML = ''; // Clear previous content
    if (!state) {
      gameContainer.innerHTML = '<p>Waiting for game state...</p>';
      return;
    }
    if (!state.currentGame) {
      gameContainer.innerHTML = '<p>Please select a game to play.</p>';
      return;
    }
    switch (state.currentGame) {
      case 'tictactoe':
        renderTicTacToe();
        break;
      case 'gomoku':
        gameContainer.innerHTML = '<p>Gomoku rendering not implemented yet.</p>';
        break;
      case 'dots':
        gameContainer.innerHTML = '<p>Dots & Boxes rendering not implemented yet.</p>';
        break;
      case 'connect4':
        gameContainer.innerHTML = '<p>Connect Four rendering not implemented yet.</p>';
        break;
      default:
        gameContainer.innerHTML = '<p>Unknown game type.</p>';
    }
  }

  // Render a Tic Tac Toe grid
  function renderTicTacToe() {
    if (!Array.isArray(state.tictactoe)) {
      gameContainer.innerHTML = '<p>Tic Tac Toe state is not initialized.</p>';
      return;
    }
    const grid = document.createElement('div');
    grid.className = 'grid grid-3x3';
    grid.style.gridTemplateColumns = 'repeat(3, 1fr)';
    state.tictactoe.forEach((cell, index) => {
      const cellEl = document.createElement('div');
      cellEl.className = 'cell';
      cellEl.textContent = cell || '';
      cellEl.addEventListener('click', () => handleMove(index));
      grid.appendChild(cellEl);
    });
    gameContainer.appendChild(grid);
  }

  // Handle an incoming game state message from the parent
  function handleGameState(newState) {
    state = newState;
    renderGame();
  }

  // Handle a move on the current game (for Tic Tac Toe in this example)
  function handleMove(position) {
    if (!state || !state.currentGame) return;
    sendMessage({
      type: 'gameAction',
      data: {
        type: 'move',
        game: state.currentGame,
        position: position
      }
    });
  }

  // Called when a game is selected via the buttons in the HTML
  function selectGame(gameType) {
    if (!gameType) return;
    sendMessage({
      type: 'gameAction',
      data: { type: 'changeGame', game: gameType }
    });
    gameMenu.classList.add('hidden');
    gameContainer.classList.remove('hidden');
    renderGame(); // Render immediately with current state
  }

  // Listen for messages from the parent Devvit app
  window.addEventListener('message', (event) => {
    console.log('Received message:', event.data);
    if (event.data && event.data.type === 'gameState') {
      handleGameState(event.data.data);
    }
  });

  // Request the initial state once the page has fully loaded
  window.addEventListener('load', () => {
    sendMessage({ type: 'requestState' });
  });

  // Expose the selectGame function globally for HTML button onclick handlers
  window.selectGame = selectGame;
})();