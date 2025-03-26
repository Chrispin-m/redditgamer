document.addEventListener('DOMContentLoaded', () => {
    const CELL_SIZE = 40; // Each cell is 40x40 pixels
    const BOARD_SIZE = 15 * CELL_SIZE; // 15x15 grid
    const PLAYER_COLORS = ['red', 'green', 'yellow', 'blue'];
    const SAFE_ZONES = [0, 8, 13, 21, 26, 34, 39, 47];
    const START_POSITIONS = { red: 0, green: 13, yellow: 26, blue: 39 };
    const HOME_ENTRANCE = { red: 50, green: 53, yellow: 56, blue: 59 };
    const HOME_PATH_LENGTH = 6;

    // DOM Elements
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

    // Game State
    let gameState = {
        players: PLAYER_COLORS.map(color => ({
            color,
            tokens: Array(4).fill().map((_, i) => ({
                id: `${color}-${i}`,
                pathPosition: -1, // -1 = in home, -2 = finished
                homePath: 0,
                element: null
            })),
            finished: 0
        })),
        currentPlayer: 0,
        diceValue: 0,
        movesLeft: 0,
        selectedToken: null,
        gameActive: true
    };

    // Track Coordinates (pre-calculated positions)
    const trackCoordinates = Array(52).fill().map((_, i) => {
        // Complex board path calculation
        // Implementation of actual Ludo board path
        const row = Math.floor(i / 14);
        const col = i % 14;
        let x, y;
        
        if (i < 14) { // Top row
            x = CELL_SIZE * (13 - col);
            y = CELL_SIZE;
        } else if (i < 28) { // Right column
            x = CELL_SIZE * 13;
            y = CELL_SIZE * (col + 2);
        } else if (i < 42) { // Bottom row
            x = CELL_SIZE * (col + 1);
            y = CELL_SIZE * 13;
        } else { // Left column
            x = CELL_SIZE;
            y = CELL_SIZE * (15 - col);
        }
        
        return { x, y };
    });

    // Initialize Game
    function initGame() {
        drawBoard();
        drawDice(1);
        updateTurnDisplay();
        setupEventListeners();
    }

    function drawBoard() {
        ctx.clearRect(0, 0, BOARD_SIZE, BOARD_SIZE);
        
        // Draw main board
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, BOARD_SIZE, BOARD_SIZE);

        // Draw colored bases
        drawBase(1, 1, 'red');
        drawBase(10, 1, 'green');
        drawBase(1, 10, 'yellow');
        drawBase(10, 10, 'blue');

        // Draw track
        trackCoordinates.forEach((pos, i) => {
            ctx.fillStyle = SAFE_ZONES.includes(i) ? '#ffeb3b' : '#e0e0e0';
            ctx.fillRect(pos.x, pos.y, CELL_SIZE, CELL_SIZE);
            ctx.strokeStyle = '#000000';
            ctx.strokeRect(pos.x, pos.y, CELL_SIZE, CELL_SIZE);
        });

        // Draw tokens
        gameState.players.forEach(player => {
            player.tokens.forEach(token => {
                drawToken(token);
            });
        });
    }

    function drawBase(x, y, color) {
        const baseSize = CELL_SIZE * 3;
        ctx.fillStyle = color;
        ctx.fillRect(x * CELL_SIZE, y * CELL_SIZE, baseSize, baseSize);
    }

    function drawToken(token) {
        const player = gameState.players.find(p => p.tokens.includes(token));
        let { x, y } = getTokenPosition(token);
        
        ctx.beginPath();
        ctx.arc(x + CELL_SIZE/2, y + CELL_SIZE/2, CELL_SIZE/2 - 2, 0, Math.PI * 2);
        ctx.fillStyle = player.color;
        ctx.fill();
        ctx.strokeStyle = '#000000';
        ctx.stroke();
    }

    function getTokenPosition(token) {
        if (token.pathPosition === -1) { // In home
            const player = gameState.players.find(p => p.tokens.includes(token));
            const basePositions = {
                red: { x: 1, y: 1 },
                green: { x: 10, y: 1 },
                yellow: { x: 1, y: 10 },
                blue: { x: 10, y: 10 }
            };
            const index = player.tokens.indexOf(token);
            return {
                x: (basePositions[player.color].x + (index % 2)) * CELL_SIZE,
                y: (basePositions[player.color].y + Math.floor(index / 2)) * CELL_SIZE
            };
        }
        
        if (token.pathPosition >= 0) { // On main track
            return trackCoordinates[token.pathPosition];
        }
        
        // In home path
        const playerColor = gameState.players.find(p => p.tokens.includes(token)).color;
        const homePathStart = HOME_ENTRANCE[playerColor];
        const homePathDirection = playerColor === 'red' || playerColor === 'blue' ? 'vertical' : 'horizontal';
        
        if (homePathDirection === 'vertical') {
            return {
                x: trackCoordinates[homePathStart].x,
                y: trackCoordinates[homePathStart].y + (token.homePath + 1) * CELL_SIZE
            };
        }
        
        return {
            x: trackCoordinates[homePathStart].x + (token.homePath + 1) * CELL_SIZE,
            y: trackCoordinates[homePathStart].y
        };
    }

    // Dice Functions
    function drawDice(value) {
        diceCtx.clearRect(0, 0, 100, 100);
        diceCtx.fillStyle = '#ffffff';
        diceCtx.fillRect(0, 0, 100, 100);
        diceCtx.strokeStyle = '#000000';
        diceCtx.strokeRect(0, 0, 100, 100);
        
        diceCtx.fillStyle = '#000000';
        const positions = {
            1: [[50, 50]],
            2: [[30, 30], [70, 70]],
            3: [[30, 30], [50, 50], [70, 70]],
            4: [[30, 30], [70, 30], [30, 70], [70, 70]],
            5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]],
            6: [[30, 30], [70, 30], [30, 50], [70, 50], [30, 70], [70, 70]]
        };
        
        positions[value].forEach(pos => {
            diceCtx.beginPath();
            diceCtx.arc(pos[0], pos[1], 6, 0, Math.PI * 2);
            diceCtx.fill();
        });
    }

    async function rollDice() {
        if (!gameState.gameActive) return;
        
        rollDiceBtn.disabled = true;
        const rolls = Math.floor(Math.random() * 5) + 5;
        
        for (let i = 0; i < rolls; i++) {
            gameState.diceValue = Math.floor(Math.random() * 6) + 1;
            drawDice(gameState.diceValue);
            await new Promise(r => setTimeout(r, 100));
        }
        
        diceResultElem.textContent = `Dice: ${gameState.diceValue}`;
        processDiceResult();
    }

    function processDiceResult() {
        const currentPlayer = gameState.players[gameState.currentPlayer];
        const movableTokens = currentPlayer.tokens.filter(token => 
            canMoveToken(currentPlayer.color, token, gameState.diceValue)
        );

        if (movableTokens.length === 0) {
            endTurn();
            return;
        }

        gameState.movesLeft = gameState.diceValue === 6 ? 2 : 1;
        highlightMovableTokens(movableTokens);
    }

    function canMoveToken(color, token, dice) {
        if (token.pathPosition === -2) return false; // Already finished
        
        if (token.pathPosition === -1) { // In home
            return dice === 6 && canExitHome(color);
        }
        
        if (isInHomePath(token)) {
            return token.homePath + dice <= HOME_PATH_LENGTH;
        }
        
        const newPosition = token.pathPosition + dice;
        return newPosition <= HOME_ENTRANCE[color];
    }

    function canExitHome(color) {
        const startPos = START_POSITIONS[color];
        return !gameState.players.some(player => 
            player.tokens.some(t => t.pathPosition === startPos)
        );
    }

    function highlightMovableTokens(tokens) {
        tokens.forEach(token => {
            const pos = getTokenPosition(token);
            ctx.strokeStyle = '#00ff00';
            ctx.lineWidth = 3;
            ctx.strokeRect(pos.x, pos.y, CELL_SIZE, CELL_SIZE);
        });
    }

    // Token Movement
    function handleTokenClick(token) {
        if (!gameState.gameActive || !isTokenMovable(token)) return;
        
        moveToken(token);
        gameState.movesLeft--;
        
        if (gameState.movesLeft > 0 && gameState.diceValue === 6) {
            processDiceResult();
        } else {
            endTurn();
        }
    }

    function moveToken(token) {
        const playerColor = gameState.players[gameState.currentPlayer].color;
        
        if (token.pathPosition === -1) { // Exiting home
            token.pathPosition = START_POSITIONS[playerColor];
        } else if (isInHomePath(token)) {
            token.homePath += gameState.diceValue;
            if (token.homePath === HOME_PATH_LENGTH) {
                token.pathPosition = -2;
                gameState.players[gameState.currentPlayer].finished++;
            }
        } else {
            const newPosition = token.pathPosition + gameState.diceValue;
            if (newPosition > HOME_ENTRANCE[playerColor]) {
                enterHomePath(token, newPosition - HOME_ENTRANCE[playerColor]);
            } else {
                token.pathPosition = newPosition;
                checkCollision(token);
            }
        }
        
        checkWinCondition();
        drawBoard();
    }

    function enterHomePath(token, steps) {
        token.pathPosition = -3; // Special state for home path
        token.homePath = steps;
    }

    function checkCollision(movedToken) {
        const currentPlayer = gameState.players[gameState.currentPlayer];
        gameState.players.forEach(player => {
            if (player === currentPlayer) return;
            
            player.tokens.forEach(token => {
                if (token.pathPosition === movedToken.pathPosition && 
                    !SAFE_ZONES.includes(token.pathPosition)) {
                    // Send back to home
                    token.pathPosition = -1;
                }
            });
        });
    }

    function checkWinCondition() {
        const currentPlayer = gameState.players[gameState.currentPlayer];
        if (currentPlayer.finished === 4) {
            gameState.gameActive = false;
            showWinModal(`${currentPlayer.color.toUpperCase()} WINS!`);
        }
    }

    // Turn Management
    function endTurn() {
        gameState.currentPlayer = (gameState.currentPlayer + 1) % 4;
        gameState.diceValue = 0;
        rollDiceBtn.disabled = false;
        updateTurnDisplay();
        drawBoard();
    }

    function updateTurnDisplay() {
        turnInfoElem.textContent = `Current Turn: ${gameState.players[gameState.currentPlayer].color.toUpperCase()}`;
    }

    // Event Listeners
    function setupEventListeners() {
        rollDiceBtn.addEventListener('click', rollDice);
        restartGameBtn.addEventListener('click', resetGame);
        ludoCanvas.addEventListener('click', handleCanvasClick);
    }

    function handleCanvasClick(e) {
        const rect = ludoCanvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        gameState.players[gameState.currentPlayer].tokens.forEach(token => {
            const pos = getTokenPosition(token);
            if (x >= pos.x && x <= pos.x + CELL_SIZE &&
                y >= pos.y && y <= pos.y + CELL_SIZE) {
                handleTokenClick(token);
            }
        });
    }

    // Win Modal
    function showWinModal(message) {
        winMessageElem.textContent = message;
        winModal.style.display = 'flex';
    }

    function resetGame() {
        gameState = {
            players: PLAYER_COLORS.map(color => ({
                color,
                tokens: Array(4).fill().map((_, i) => ({
                    id: `${color}-${i}`,
                    pathPosition: -1,
                    homePath: 0,
                    element: null
                })),
                finished: 0
            })),
            currentPlayer: 0,
            diceValue: 0,
            movesLeft: 0,
            selectedToken: null,
            gameActive: true
        };
        
        winModal.style.display = 'none';
        initGame();
    }

    initGame();
});