document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const ludoCanvas = document.getElementById('ludoCanvas');
  const ctx = ludoCanvas.getContext('2d');
  const diceCanvas = document.getElementById('diceCanvas');
  const diceCtx = diceCanvas.getContext('2d');
  const rollDiceBtn = document.getElementById('rollDice');
  const endTurnBtn = document.getElementById('endTurn');
  const diceResultElem = document.getElementById('diceResult');
  const turnInfoElem = document.getElementById('turnInfo');
  const winModal = document.getElementById('winModal');
  const winMessageElem = document.getElementById('winMessage');
  const restartGameBtn = document.getElementById('restartGame');

  // --- Game Constants ---
  const boardSize = 600;
  const cellSize = boardSize / 15; // 15x15 grid
  const trackPositions = 52;
  const homeColumnLength = 6;

  // --- Player Definitions ---
  const players = [
    {
      id: 'red',
      color: 'red',
      home: { x: cellSize * 2, y: cellSize * 2 },
      startPos: 0,
      homeEntry: 50,
      homeColumnStart: 52,
      safeZones: [0, 8, 13, 21, 26, 34, 39, 47, 50]
    },
    {
      id: 'green',
      color: 'green',
      home: { x: boardSize - cellSize * 6, y: cellSize * 2 },
      startPos: 13,
      homeEntry: 11,
      homeColumnStart: 58,
      safeZones: [13, 8, 21, 26, 34, 39, 47, 50, 11]
    },
    {
      id: 'yellow',
      color: 'yellow',
      home: { x: cellSize * 2, y: boardSize - cellSize * 6 },
      startPos: 26,
      homeEntry: 24,
      homeColumnStart: 64,
      safeZones: [26, 8, 13, 21, 34, 39, 47, 50, 24]
    },
    {
      id: 'blue',
      color: 'blue',
      home: { x: boardSize - cellSize * 6, y: boardSize - cellSize * 6 },
      startPos: 39,
      homeEntry: 37,
      homeColumnStart: 70,
      safeZones: [39, 8, 13, 21, 26, 34, 47, 50, 37]
    }
  ];

  // --- Track and Home Columns ---
  const track = [];
  const centerX = boardSize / 2;
  const centerY = boardSize / 2;
  const radius = 250;
  for (let i = 0; i < trackPositions; i++) {
    const angle = (2 * Math.PI * i) / trackPositions - Math.PI / 2;
    const x = centerX + radius * Math.cos(angle) - cellSize / 2;
    const y = centerY + radius * Math.sin(angle) - cellSize / 2;
    track.push({ x, y });
  }

  const homeColumns = {};
  players.forEach(player => {
    homeColumns[player.id] = [];
    const startX = player.id === 'red' || player.id === 'green' ? centerX - cellSize * 3 : centerX + cellSize * 2;
    const startY = player.id === 'red' || player.id === 'yellow' ? centerY - cellSize * 3 : centerY + cellSize * 2;
    for (let i = 0; i < homeColumnLength; i++) {
      const x = player.id === 'red' || player.id === 'green' ? startX + i * cellSize : startX - i * cellSize;
      const y = player.id === 'red' || player.id === 'yellow' ? startY + i * cellSize : startY - i * cellSize;
      homeColumns[player.id].push({ x, y });
    }
  });

  // --- Game State ---
  let gameState = {};
  let diceValue = 0;
  let diceRolling = false;
  let extraTurn = false;

  // --- Initialization ---
  function initGame() {
    gameState = {
      currentPlayerIndex: 0,
      tokens: {},
      finished: {},
      track,
      status: 'active'
    };
    players.forEach(player => {
      gameState.tokens[player.id] = Array(4).fill(null).map((_, i) => ({
        pos: -1, // -1 = home, 0-51 = track, 52+ = home column
        id: `${player.id}${i + 1}`
      }));
      gameState.finished[player.id] = 0;
    });
    turnInfoElem.textContent = `Current Turn: ${players[0].id.toUpperCase()}`;
    diceResultElem.textContent = `Dice: -`;
    drawBoard();
  }

  // --- Drawing Functions ---
  function drawBoard() {
    ctx.clearRect(0, 0, boardSize, boardSize);
    ctx.fillStyle = '#f0f4f8';
    ctx.fillRect(0, 0, boardSize, boardSize);

    // Draw track
    track.forEach((pos, index) => {
      ctx.beginPath();
      ctx.arc(pos.x + cellSize / 2, pos.y + cellSize / 2, cellSize / 2 - 2, 0, 2 * Math.PI);
      ctx.fillStyle = players.some(p => p.safeZones.includes(index)) ? '#ddd' : '#fff';
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.stroke();
    });

    // Draw home columns
    players.forEach(player => {
      homeColumns[player.id].forEach((pos, index) => {
        ctx.beginPath();
        ctx.rect(pos.x, pos.y, cellSize, cellSize);
        ctx.fillStyle = index === homeColumnLength - 1 ? '#ffd700' : player.color + '33';
        ctx.fill();
        ctx.strokeStyle = '#333';
        ctx.stroke();
      });
    });

    // Draw tokens
    players.forEach(player => {
      gameState.tokens[player.id].forEach(token => {
        if (token.pos === -1) {
          const homeX = player.home.x + Math.random() * (cellSize * 3);
          const homeY = player.home.y + Math.random() * (cellSize * 3);
          drawToken(homeX, homeY, cellSize * 0.8, player.color, token.id);
        } else if (token.pos >= 0 && token.pos < trackPositions) {
          const pos = track[token.pos];
          drawToken(pos.x, pos.y, cellSize, player.color, token.id);
        } else if (token.pos >= player.homeColumnStart && token.pos < player.homeColumnStart + homeColumnLength) {
          const homePos = token.pos - player.homeColumnStart;
          const pos = homeColumns[player.id][homePos];
          drawToken(pos.x, pos.y, cellSize, player.color, token.id);
        }
      });
    });
  }

  function drawToken(x, y, size, color, label) {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2 - 2, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = `${size / 3}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + size / 2, y + size / 2);
  }

  // --- Dice Functions ---
  function drawDice(value) {
    diceCtx.clearRect(0, 0, diceCanvas.width, diceCanvas.height);
    diceCtx.fillStyle = '#fff';
    diceCtx.fillRect(0, 0, diceCanvas.width, diceCanvas.height);
    diceCtx.strokeStyle = '#333';
    diceCtx.lineWidth = 2;
    diceCtx.strokeRect(0, 0, diceCanvas.width, diceCanvas.height);
    diceCtx.fillStyle = '#333';
    const pip = (x, y) => {
      diceCtx.beginPath();
      diceCtx.arc(x, y, 5, 0, 2 * Math.PI);
      diceCtx.fill();
    };
    switch (value) {
      case 1: pip(50, 50); break;
      case 2: pip(30, 30); pip(70, 70); break;
      case 3: pip(30, 30); pip(50, 50); pip(70, 70); break;
      case 4: pip(30, 30); pip(70, 30); pip(30, 70); pip(70, 70); break;
      case 5: pip(30, 30); pip(70, 30); pip(50, 50); pip(30, 70); pip(70, 70); break;
      case 6: pip(30, 30); pip(70, 30); pip(30, 50); pip(70, 50); pip(30, 70); pip(70, 70); break;
    }
  }

  function animateDiceRoll() {
    diceRolling = true;
    const start = performance.now();
    function roll() {
      const now = performance.now();
      if (now - start < 1000) {
        diceValue = Math.floor(Math.random() * 6) + 1;
        drawDice(diceValue);
        requestAnimationFrame(roll);
      } else {
        diceRolling = false;
        drawDice(diceValue);
        diceResultElem.textContent = `Dice: ${diceValue}`;
        extraTurn = diceValue === 6;
        endTurnBtn.disabled = false;
      }
    }
    roll();
  }

  rollDiceBtn.addEventListener('click', () => {
    if (!diceRolling && gameState.status === 'active') {
      rollDiceBtn.disabled = true;
      endTurnBtn.disabled = true;
      animateDiceRoll();
    }
  });

  // --- Token Movement ---
  function moveToken() {
    const player = players[gameState.currentPlayerIndex];
    const tokensArr = gameState.tokens[player.id];
    let moved = false;

    // Bring token out on 6
    if (diceValue === 6) {
      const homeToken = tokensArr.find(t => t.pos === -1);
      if (homeToken) {
        homeToken.pos = player.startPos;
        captureOpponent(player, homeToken.pos);
        moved = true;
      }
    }

    // Move token on track or in home column
    if (!moved) {
      const movableTokens = tokensArr.filter(t => t.pos >= 0 && t.pos !== -1);
      if (movableTokens.length > 0) {
        const token = movableTokens[0]; // Simplified: move first movable token
        const currentPos = token.pos;
        let newPos;

        if (currentPos < trackPositions) {
          const stepsToHome = (player.homeEntry - currentPos + trackPositions) % trackPositions;
          if (currentPos <= player.homeEntry && currentPos + diceValue > player.homeEntry) {
            newPos = player.homeColumnStart + (currentPos + diceValue - player.homeEntry - 1);
          } else {
            newPos = (currentPos + diceValue) % trackPositions;
          }
        } else {
          newPos = currentPos + diceValue;
        }

        if (newPos < player.homeColumnStart + homeColumnLength) {
          token.pos = newPos;
          if (newPos < trackPositions) {
            captureOpponent(player, newPos);
          }
          moved = true;
        }

        // Check if token finished
        if (newPos === player.homeColumnStart + homeColumnLength - 1) {
          gameState.finished[player.id]++;
          token.pos = -2; // Finished
          if (gameState.finished[player.id] === tokensArr.length) {
            gameState.status = 'finished';
            showWinModal(`${player.id.toUpperCase()} wins!`);
          }
        }
      }
    }

    return moved;
  }

  function captureOpponent(player, position) {
    if (player.safeZones.includes(position)) return;
    players.forEach(other => {
      if (other.id !== player.id) {
        const opponentTokens = gameState.tokens[other.id];
        opponentTokens.forEach(token => {
          if (token.pos === position) {
            token.pos = -1;
          }
        });
      }
    });
  }

  function endTurn() {
    const moved = moveToken();
    drawBoard();
    if (!extraTurn || !moved) {
      gameState.currentPlayerIndex = (gameState.currentPlayerIndex + 1) % players.length;
    }
    extraTurn = false;
    turnInfoElem.textContent = `Current Turn: ${players[gameState.currentPlayerIndex].id.toUpperCase()}`;
    diceResultElem.textContent = `Dice: -`;
    rollDiceBtn.disabled = false;
    endTurnBtn.disabled = true;
  }

  endTurnBtn.addEventListener('click', () => {
    if (!diceRolling) {
      endTurn();
    }
  });

  // --- Win Modal ---
  function showWinModal(message) {
    winMessageElem.textContent = message;
    winModal.style.display = 'flex';
  }

  restartGameBtn.addEventListener('click', () => {
    initGame();
    winModal.style.display = 'none';
  });

  // --- Start Game ---
  initGame();
});