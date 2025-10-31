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
const GRID_SIZE = 32;       // Tamanho de cada tile do *mapa* (paredes)
const PLAYER_SIZE = 24;     // Tamanho do *jogador* (menor que o grid)
const PLAYER_SPEED = 3;     // Velocidade do jogador (pixels por frame/tick)
const PROJECTILE_SPEED = 6; // Velocidade do projétil

// Mapa (0 = caminho, 1 = parede)
const gameMap = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1.0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // Pequeno erro de digitação corrigido (1.0 -> 1,0)
    [1,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1.0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1], // Corrigido
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];
const MAP_WIDTH_PIXELS = gameMap[0].length * GRID_SIZE;
const MAP_HEIGHT_PIXELS = gameMap.length * GRID_SIZE;

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
    const maxAttempts = gameMap.length * gameMap[0].length;

    while (!found && attempts < maxAttempts) {
        // Encontra um tile de chão (0)
        gridX = Math.floor(Math.random() * gameMap[0].length);
        gridY = Math.floor(Math.random() * gameMap.length);

        if (gameMap[gridY][gridX] === 0) {
            // Posição em pixels (centro do tile)
            x = gridX * GRID_SIZE + (GRID_SIZE / 2);
            y = gridY * GRID_SIZE + (GRID_SIZE / 2);
            found = true;
        }
        attempts++;
    }
    return found ? { x, y } : { x: 48, y: 48 }; // Posição de fallback (tile 1,1)
}

// Inicializa o estado de um novo jogador
function createNewPlayer(id) {
  const { x, y } = findEmptyPosition();
  return {
    id: id,
    x: x,                     // Posição X em pixels
    y: y,                     // Posição Y em pixels
    color: getRandomColor(),
    health: 100,             
    speed: PLAYER_SPEED,
    input: {},                // Teclas pressionadas
    aimAngle: 0,              // Novo: Ângulo da mira (em radianos)
    isAttacking: false,       // Flash visual
    lastShotTime: 0,
    flashRedUntil: 0
  };
}

// Função para criar um projétil (agora usa ângulo)
function createProjectile(shooterId, angle) {
  const shooter = players[shooterId];
  if (!shooter) return;

  const dx = Math.cos(angle) * PROJECTILE_SPEED;
  const dy = Math.sin(angle) * PROJECTILE_SPEED;

  projectiles.push({
    id: Date.now() + Math.random(),
    x: shooter.x, // Centro do jogador (ajustado no cliente)
    y: shooter.y,
    dx: dx,
    dy: dy,
    shooterId: shooterId,
    size: 4
  });

  // Flash visual breve de ataque
  shooter.isAttacking = true;
  setTimeout(() => { shooter.isAttacking = false; }, 100);
}

// --- Nova Lógica de Colisão (Pixel-based) ---
function isCollidingWithMap(x, y) {
    // Verifica os 4 cantos do jogador contra o grid do mapa
    const halfPlayer = PLAYER_SIZE / 2;
    const checkPoints = [
        { x: x - halfPlayer, y: y - halfPlayer }, // Top-Left
        { x: x + halfPlayer, y: y - halfPlayer }, // Top-Right
        { x: x - halfPlayer, y: y + halfPlayer }, // Bottom-Left
        { x: x + halfPlayer, y: y + halfPlayer }  // Bottom-Right
    ];

    for (const point of checkPoints) {
        // Garante que o ponto está dentro dos limites do mapa
        if (point.x < 0 || point.x >= MAP_WIDTH_PIXELS || point.y < 0 || point.y >= MAP_HEIGHT_PIXELS) {
            return true; // Colidiu com os limites externos
        }

        const gridX = Math.floor(point.x / GRID_SIZE);
        const gridY = Math.floor(point.y / GRID_SIZE);

        // Checa se o tile do mapa é uma parede (1)
        if (gameMap[gridY] && gameMap[gridY][gridX] === 1) {
            return true;
        }
    }
    return false;
}


// 4. Game Loop do Servidor (Processamento de Lógica)
function serverGameLoop() {
  const currentTime = Date.now();
  
  // Atualiza Jogadores
  for (const id in players) {
    const player = players[id];
    
    // Processa o movimento (fluido)
    let dx = 0;
    let dy = 0;

    if (player.input.ArrowUp) dy -= player.speed;
    if (player.input.ArrowDown) dy += player.speed;
    if (player.input.ArrowLeft) dx -= player.speed;
    if (player.input.ArrowRight) dx += player.speed;

    // Normaliza o movimento diagonal (para não ser mais rápido)
    if (dx !== 0 && dy !== 0) {
        const magnitude = Math.sqrt(dx * dx + dy * dy);
        dx = (dx / magnitude) * player.speed;
        dy = (dy / magnitude) * player.speed;
    }

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

    // (Limites do mapa já são tratados pelo isCollidingWithMap)

    // Se health <=0, remove player
    if (player.health <= 0) {
        delete players[id];
        io.to(id).emit('gameOver'); // Notifica cliente
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
      if (gridX < 0 || gridX >= gameMap[0].length || gridY < 0 || gridY >= gameMap.length) {
          collidedWithWall = true; // Fora do mapa
      } else if (gameMap[gridY][gridX] === 1) {
          collidedWithWall = true; // Bateu na parede
      }
      
      if (collidedWithWall) {
          projectiles.splice(i, 1);
          continue;
      }

      // Checa colisão com players
      for (const id in players) {
          const player = players[id];
          if (id === proj.shooterId) continue; // Não acerta o atirador

          const dist = Math.sqrt((proj.x - player.x)**2 + (proj.y - player.y)**2);
          
          // (PLAYER_SIZE / 2) é o raio do jogador
          if (dist < (PLAYER_SIZE / 2) + proj.size) { 
              player.health -= 20;
              player.flashRedUntil = currentTime + 500;
              projectiles.splice(i, 1);
              break; // Projétil some e para de checar
          }
      }
  }

  // Envia o estado atualizado do jogo para todos os clientes
  io.emit('gameStateUpdate', { players: players, map: gameMap, projectiles: projectiles });
}

// Inicia o Game Loop do Servidor (30 atualizações por segundo)
gameLoopInterval = setInterval(serverGameLoop, 1000 / 30);

// 5. Lógica de Conexão (Socket.IO)
io.on('connection', (socket) => {
  console.log(`Novo jogador conectado: ${socket.id}`);
  
  players[socket.id] = createNewPlayer(socket.id);
  io.emit('gameStateUpdate', { players: players, map: gameMap, projectiles: [] }); 
  
  // Ouve inputs do teclado
  socket.on('input', (inputData) => {
    if (players[socket.id]) {
        players[socket.id].input = inputData.keys;
    }
  });

  // Novo: Ouve a atualização da mira
  socket.on('aimUpdate', (data) => {
    if (players[socket.id]) {
        players[socket.id].aimAngle = data.angle;
    }
  });

  // Ouve tiro (agora via clique)
  socket.on('shoot', () => {
    const currentTime = Date.now();
    const player = players[socket.id];
    if (player && currentTime - player.lastShotTime > 500) { // Cooldown 0.5s
        createProjectile(socket.id, player.aimAngle); // Usa o ângulo armazenado
        player.lastShotTime = currentTime;
    }
  });

  // Ouve quando um jogador desconecta
  socket.on('disconnect', () => {
    console.log(`Jogador desconectado: ${socket.id}`);
    delete players[socket.id];
    io.emit('gameStateUpdate', { players: players, map: gameMap, projectiles: projectiles });
  });
});

// 6. Inicia o servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse http://localhost:${PORT} no seu navegador`);
});