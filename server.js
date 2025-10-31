// server.js
// 1. Configuração do Servidor
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000;

// 2. Servir os arquivos estáticos
app.use(express.static(__dirname));

// 3. Estrutura de Dados e Lógica do Jogo (Backend)
let players = {};
let projectiles = [];
let gameLoopInterval;

// --- Configurações do Jogo ---
const GRID_SIZE = 32;       
const PLAYER_SPEED = 3;     
const PROJECTILE_SPEED = 6; 

// --- NOVO: Configurações de Dimensões do Jogador (Baseado na Sprite) ---
// Define o tamanho do jogador com base na arte (16x24)
const PLAYER_SPRITE_WIDTH = 16;
const PLAYER_SPRITE_HEIGHT = 24;

// --- Configurações de Animação ---
const FRAME_DURATION_WALK = 100; // ms por frame
const FRAME_DURATION_IDLE = 200; // ms por frame

// Mapa (0 = caminho, 1 = parede) - Expandido para 50x36
const MAP_ROWS = 36;
const MAP_COLS = 50;
const gameMap = Array(MAP_ROWS).fill(0).map(() => Array(MAP_COLS).fill(0));

// Cria bordas e uma pequena estrutura interna para teste
for(let y = 0; y < MAP_ROWS; y++) {
    for(let x = 0; x < MAP_COLS; x++) {
        if (y === 0 || y === MAP_ROWS - 1 || x === 0 || x === MAP_COLS - 1) {
            gameMap[y][x] = 1; // Borda
        }
    }
}
for(let y = 4; y < 9; y++) {
    for(let x = 4; x < 9; x++) {
        gameMap[y][x] = 1;
    }
}
gameMap[5][5] = 0; 

const MAP_WIDTH_PIXELS = MAP_COLS * GRID_SIZE;
const MAP_HEIGHT_PIXELS = MAP_ROWS * GRID_SIZE;

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Encontra uma posição vazia
function findEmptyPosition() {
    let x, y, gridX, gridY;
    let found = false;
    let attempts = 0;
    const maxAttempts = MAP_ROWS * MAP_COLS;

    while (!found && attempts < maxAttempts) {
        gridX = Math.floor(Math.random() * MAP_COLS);
        gridY = Math.floor(Math.random() * MAP_ROWS);

        if (gameMap[gridY][gridX] === 0) {
            // Posição em pixels (Centro-Inferior do tile)
            x = gridX * GRID_SIZE + (GRID_SIZE / 2);
            y = gridY * GRID_SIZE + GRID_SIZE; // Alinha os pés à base do tile
            found = true;
        }
        attempts++;
    }
    return found ? { x, y } : { x: 48, y: 64 }; // Posição de fallback (tile 1,1)
}

// Inicializa o estado de um novo jogador
function createNewPlayer(id) {
  const { x, y } = findEmptyPosition();
  return {
    id: id,
    x: x, // Posição X (Centro-Inferior)
    y: y, // Posição Y (Centro-Inferior - os pés)
    color: getRandomColor(),
    health: 100,             
    speed: PLAYER_SPEED,
    input: {}, 
    aimAngle: 0,              
    isAttacking: false,       
    lastShotTime: 0,
    flashRedUntil: 0,
    state: 'idle',           
    direction: 'down',       
    frame: 0,                
    lastFrameTime: Date.now() 
  };
}

// Função para criar um projétil
function createProjectile(shooterId, angle) {
  const shooter = players[shooterId];
  if (!shooter) return;

  const dx = Math.cos(angle) * PROJECTILE_SPEED;
  const dy = Math.sin(angle) * PROJECTILE_SPEED;

  // O projétil se origina do CENTRO VISUAL do jogador, não dos pés
  const startX = shooter.x;
  const startY = shooter.y - (PLAYER_SPRITE_HEIGHT / 2); // Metade da altura acima dos pés

  projectiles.push({
    id: Date.now() + Math.random(),
    x: startX, 
    y: startY,
    dx: dx,
    dy: dy,
    shooterId: shooterId,
    size: 4
  });

  shooter.isAttacking = true;
  setTimeout(() => { shooter.isAttacking = false; }, 100);
}

// --- Lógica de Colisão (CORRIGIDA para Âncora nos Pés) ---
function isCollidingWithMap(x, y) {
    // (x, y) é o ponto dos pés (centro-inferior)
    const halfWidth = PLAYER_SPRITE_WIDTH / 2;
    const height = PLAYER_SPRITE_HEIGHT;

    // Pontos de verificação da hitbox (16x24)
    const checkPoints = [
        { x: x - halfWidth, y: y - height }, // Top-Left
        { x: x + halfWidth, y: y - height }, // Top-Right
        { x: x - halfWidth, y: y - 1 },      // Bottom-Left (y-1 para evitar colidir consigo mesmo)
        { x: x + halfWidth, y: y - 1 }       // Bottom-Right
    ];

    for (const point of checkPoints) {
        if (point.x < 0 || point.x >= MAP_WIDTH_PIXELS || point.y < 0 || point.y >= MAP_HEIGHT_PIXELS) {
            return true; // Colidiu com os limites externos
        }

        const gridX = Math.floor(point.x / GRID_SIZE);
        const gridY = Math.floor(point.y / GRID_SIZE);

        if (gameMap[gridY] && gameMap[gridY][gridX] === 1) {
            return true;
        }
    }
    return false;
}


// 4. Game Loop do Servidor
function serverGameLoop() {
  const currentTime = Date.now();
  
  // Atualiza Jogadores
  for (const id in players) {
    const player = players[id];
    
    // Processa o movimento
    let dx = 0;
    let dy = 0;

    if (player.input.ArrowUp) dy -= player.speed;
    if (player.input.ArrowDown) dy += player.speed;
    if (player.input.ArrowLeft) dx -= player.speed;
    if (player.input.ArrowRight) dx += player.speed;

    // Normaliza o movimento diagonal
    if (dx !== 0 && dy !== 0) {
        const magnitude = Math.sqrt(dx * dx + dy * dy);
        dx = (dx / magnitude) * player.speed;
        dy = (dy / magnitude) * player.speed;
    }

    // --- Lógica de Estado e Animação ---
    let isMoving = dx !== 0 || dy !== 0;
    player.state = isMoving ? 'walk' : 'idle';
    
    if (dy > 0) { player.direction = 'down'; }
    else if (dy < 0) { player.direction = 'up'; }
    else if (dx > 0) { player.direction = 'side_right'; }
    else if (dx < 0) { player.direction = 'side_left'; }

    let frameDuration = (player.state === 'walk') ? FRAME_DURATION_WALK : FRAME_DURATION_IDLE;
    let maxFrames = (player.state === 'walk') ? 6 : 4; 
    if (currentTime > player.lastFrameTime + frameDuration) {
        player.frame = (player.frame + 1) % maxFrames;
        player.lastFrameTime = currentTime;
    }
    // --- FIM: Lógica de Estado e Animação ---

    // --- Colisão (Slide) ---
    // Movimenta X
    let newX = player.x + dx;
    if (!isCollidingWithMap(newX, player.y)) {
        player.x = newX;
    }
    // Movimenta Y
    let newY = player.y + dy;
    if (!isCollidingWithMap(player.x, newY)) {
        player.y = newY;
    }

    // Se health <=0, remove player
    if (player.health <= 0) {
        delete players[id];
        io.to(id).emit('gameOver'); 
    }
  }

  // Atualiza projéteis
  for (let i = projectiles.length - 1; i >= 0; i--) {
    const proj = projectiles[i];
    proj.x += proj.dx;
    proj.y += proj.dy;

    // Colisão com Paredes
    const gridX = Math.floor(proj.x / GRID_SIZE);
    const gridY = Math.floor(proj.y / GRID_SIZE);

    let collidedWithWall = false;
    if (gridX < 0 || gridX >= MAP_COLS || gridY < 0 || gridY >= MAP_ROWS) {
        collidedWithWall = true; 
    } else if (gameMap[gridY][gridX] === 1) {
        collidedWithWall = true; 
    }
    
    if (collidedWithWall) {
        projectiles.splice(i, 1);
        continue;
    }

    // Checa colisão com players
    for (const id in players) {
        const player = players[id];
        if (id === proj.shooterId) continue; 

        // Calcula a distância do projétil ao CENTRO VISUAL do jogador
        const playerCenterX = player.x;
        const playerCenterY = player.y - (PLAYER_SPRITE_HEIGHT / 2);
        
        const dist = Math.sqrt((proj.x - playerCenterX)**2 + (proj.y - playerCenterY)**2);
        
        // Colide se a distância for menor que o raio do projétil + raio do jogador
        const playerRadius = PLAYER_SPRITE_WIDTH / 2; // Usa 8 como raio
        if (dist < playerRadius + proj.size) { 
            player.health -= 20;
            player.flashRedUntil = currentTime + 500;
            projectiles.splice(i, 1);
            break; 
        }
    }
}

  // Envia o estado atualizado do jogo para todos os clientes
  io.emit('gameStateUpdate', { players: players, map: gameMap, projectiles: projectiles, mapWidth: MAP_WIDTH_PIXELS, mapHeight: MAP_HEIGHT_PIXELS });
}

// Inicia o Game Loop do Servidor
gameLoopInterval = setInterval(serverGameLoop, 1000 / 30);

// 5. Lógica de Conexão (Socket.IO)
io.on('connection', (socket) => {
  console.log(`Novo jogador conectado: ${socket.id}`);
  
  players[socket.id] = createNewPlayer(socket.id);
  io.emit('gameStateUpdate', { players: players, map: gameMap, projectiles: [], mapWidth: MAP_WIDTH_PIXELS, mapHeight: MAP_HEIGHT_PIXELS }); 
  
  socket.on('input', (inputData) => {
    if (players[socket.id]) {
        players[socket.id].input = inputData.keys;
    }
  });

  socket.on('aimUpdate', (data) => {
    if (players[socket.id]) {
        players[socket.id].aimAngle = data.angle;
    }
  });

  socket.on('shoot', () => {
    const currentTime = Date.now();
    const player = players[socket.id];
    if (player && currentTime - player.lastShotTime > 500) { 
        createProjectile(socket.id, player.aimAngle); 
        player.lastShotTime = currentTime;
    }
  });

  socket.on('disconnect', () => {
    console.log(`Jogador desconectado: ${socket.id}`);
    delete players[socket.id];
    io.emit('gameStateUpdate', { players: players, map: gameMap, projectiles: projectiles, mapWidth: MAP_WIDTH_PIXELS, mapHeight: MAP_HEIGHT_PIXELS });
  });
});

// 6. Inicia o servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse http://localhost:${PORT} no seu navegador`);
});