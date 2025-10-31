// 1. Configuração do Servidor
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = process.env.PORT || 3000; // Usa a porta do ambiente ou 3000 localmente

// 2. Servir os arquivos estáticos
app.use(express.static(__dirname));

// 3. Estrutura de Dados e Lógica do Jogo (Backend)
let players = {};
let projectiles = []; // Array de projéteis
let gameLoopInterval;

// --- Configurações do Grid ---
const GRID_SIZE = 32; // Cada "quadrado" no mapa terá 32x32 pixels
const MAP_WIDTH_TILES = 25; // Mapa terá 25 tiles de largura (25 * 32 = 800 pixels)
const MAP_HEIGHT_TILES = 18; // Mapa terá 18 tiles de altura (18 * 32 = 576 pixels, ajustado para caber)
const PLAYER_SPEED = 5; // Velocidade do jogador (usado para projéteis)

// Mapa de exemplo (0 = caminho, 1 = parede)
const gameMap = [
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,1,1,1,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
    [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Encontra uma posição vazia no grid para o novo jogador
function findEmptyGridPosition() {
    let x, y;
    let found = false;
    let attempts = 0;
    const maxAttempts = MAP_WIDTH_TILES * MAP_HEIGHT_TILES; // Evita loop infinito em mapas cheios

    while (!found && attempts < maxAttempts) {
        x = Math.floor(Math.random() * MAP_WIDTH_TILES);
        y = Math.floor(Math.random() * MAP_HEIGHT_TILES);

        // Verifica se a posição é um caminho (0) e se não tem outro jogador
        if (gameMap[y][x] === 0) {
            let occupied = false;
            for (const id in players) {
                if (players[id].gridX === x && players[id].gridY === y) {
                    occupied = true;
                    break;
                }
            }
            if (!occupied) {
                found = true;
            }
        }
        attempts++;
    }
    return found ? { x, y } : { x: 1, y: 1 }; // Retorna 1,1 se não encontrar (pode ser parede)
}

// Inicializa o estado de um novo jogador
function createNewPlayer(id) {
  const { x, y } = findEmptyGridPosition();
  return {
    id: id,
    gridX: x,                 // Posição X no grid
    gridY: y,                 // Posição Y no grid
    x: x * GRID_SIZE,         // Posição X em pixels (para o cliente desenhar)
    y: y * GRID_SIZE,         // Posição Y em pixels (para o cliente desenhar)
    color: getRandomColor(),
    health: 100,             
    speed: PLAYER_SPEED,     
    input: {},               
    isMoving: false,         // Para controlar animação de movimento
    direction: 'down',       // Direção para mira e sprites futuros
    isAttacking: false,      
    lastMoveTime: 0,         // Controla o tempo entre os movimentos no grid
    moveDelay: 200,          // 200ms entre cada movimento no grid (300ms para diagonal)
    lastShotTime: 0,         // Cooldown para tiros (1s)
    flashRedUntil: 0         // Timestamp para piscar vermelho (cliente usa, mas servidor envia)
  };
}

// Função para criar um projétil
function createProjectile(shooterId, direction) {
  const shooter = players[shooterId];
  if (!shooter) return;

  const directions = {
    up: { dx: 0, dy: -PLAYER_SPEED },
    down: { dx: 0, dy: PLAYER_SPEED },
    left: { dx: -PLAYER_SPEED, dy: 0 },
    right: { dx: PLAYER_SPEED, dy: 0 },
    upleft: { dx: -PLAYER_SPEED / 1.414, dy: -PLAYER_SPEED / 1.414 }, // Diagonal normalizado
    upright: { dx: PLAYER_SPEED / 1.414, dy: -PLAYER_SPEED / 1.414 },
    downleft: { dx: -PLAYER_SPEED / 1.414, dy: PLAYER_SPEED / 1.414 },
    downright: { dx: PLAYER_SPEED / 1.414, dy: PLAYER_SPEED / 1.414 }
  };

  const dir = directions[direction] || directions.down; // Default down

  projectiles.push({
    id: Date.now() + Math.random(), // ID único
    x: shooter.x + GRID_SIZE / 2,   // Centro do jogador
    y: shooter.y + GRID_SIZE / 2,
    dx: dir.dx,
    dy: dir.dy,
    shooterId: shooterId,
    size: 4 // Tamanho pequeno
  });

  // Flash visual breve de ataque
  shooter.isAttacking = true;
  setTimeout(() => { shooter.isAttacking = false; }, 100);
}

// 4. Game Loop do Servidor (Processamento de Lógica)
function serverGameLoop() {
  const currentTime = Date.now();
  
  for (const id in players) {
    const player = players[id];
    
    // Processa o movimento baseado em grid (agora permite diagonal com teclas simultâneas)
    if (currentTime - player.lastMoveTime > player.moveDelay) {
        let dx = 0;
        let dy = 0;
        let moved = false;

        // Calcula delta baseado em inputs simultâneos
        if (player.input.ArrowLeft) dx = -1;
        if (player.input.ArrowRight) dx = 1;
        if (player.input.ArrowUp) dy = -1;
        if (player.input.ArrowDown) dy = 1;

        // Cancela se opostos
        if (dx !== 0 && dx !== -1 && dx !== 1) dx = 0; // Não precisa, pois ifs sequenciais: left/right cancelam para 0
        // Mesma para dy

        const newGridX = player.gridX + dx;
        const newGridY = player.gridY + dy;

        // Define direção baseada em dx/dy
        if (dx === 0 && dy === 0) {
            // Nenhuma direção
        } else if (dx === -1 && dy === -1) player.direction = 'upleft';
        else if (dx === 1 && dy === -1) player.direction = 'upright';
        else if (dx === -1 && dy === 1) player.direction = 'downleft';
        else if (dx === 1 && dy === 1) player.direction = 'downright';
        else if (dx === -1) player.direction = 'left';
        else if (dx === 1) player.direction = 'right';
        else if (dy === -1) player.direction = 'up';
        else if (dy === 1) player.direction = 'down';

        const isDiagonal = Math.abs(dx) + Math.abs(dy) === 2;
        if (isDiagonal) {
            player.moveDelay = 300; // Mais lento em diagonal
        } else {
            player.moveDelay = 200;
        }

        if (dx !== 0 || dy !== 0) { // moved = true se há input
            // Verifica limites, parede e ocupação
            if (newGridX >= 0 && newGridX < MAP_WIDTH_TILES &&
                newGridY >= 0 && newGridY < MAP_HEIGHT_TILES &&
                gameMap[newGridY][newGridX] === 0) {
                
                // Checa colisão com outros players
                let occupied = false;
                for (const otherId in players) {
                    if (otherId !== id && players[otherId].gridX === newGridX && players[otherId].gridY === newGridY) {
                        occupied = true;
                        break;
                    }
                }
                if (!occupied) {
                    player.gridX = newGridX;
                    player.gridY = newGridY;
                    player.x = newGridX * GRID_SIZE;
                    player.y = newGridY * GRID_SIZE;
                    player.lastMoveTime = currentTime;
                    player.isMoving = true;
                    moved = true;
                } else {
                    player.isMoving = false;
                }
            } else {
                player.isMoving = false;
            }
        } else {
            player.isMoving = false;
        }

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

        // Remove se fora do mapa
        if (proj.x < 0 || proj.x > MAP_WIDTH_TILES * GRID_SIZE || proj.y < 0 || proj.y > MAP_HEIGHT_TILES * GRID_SIZE) {
            projectiles.splice(i, 1);
            continue;
        }

        // Checa colisão com players (raio simples)
        for (const id in players) {
            const player = players[id];
            if (id === proj.shooterId) continue; // Não acerta o atirador

            const dist = Math.sqrt((proj.x - (player.x + GRID_SIZE/2))**2 + (proj.y - (player.y + GRID_SIZE/2))**2);
            if (dist < 16) { // Raio de hit
                player.health -= 20;
                player.flashRedUntil = currentTime + 500; // Trigger piscar
                projectiles.splice(i, 1);
                break;
            }
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
  
  // Adiciona o novo jogador
  players[socket.id] = createNewPlayer(socket.id);

  // Envia a todos os jogadores o estado completo atual (incluindo mapa)
  io.emit('gameStateUpdate', { players: players, map: gameMap, projectiles: [] }); 
  
  // Ouve inputs do teclado
  socket.on('input', (inputData) => {
    // Atualiza o estado de input do jogador no servidor
    if (players[socket.id]) {
        players[socket.id].input.ArrowUp = inputData.keys.ArrowUp;
        players[socket.id].input.ArrowDown = inputData.keys.ArrowDown;
        players[socket.id].input.ArrowLeft = inputData.keys.ArrowLeft;
        players[socket.id].input.ArrowRight = inputData.keys.ArrowRight;
    }
  });

  // Ouve tiro (agora via espaço no cliente)
  socket.on('shoot', () => {
    const currentTime = Date.now(); // Corrigido: Define localmente
    const player = players[socket.id];
    if (player && currentTime - player.lastShotTime > 1000) { // Cooldown 1s
        createProjectile(socket.id, player.direction);
        player.lastShotTime = currentTime;
    }
  });

  // Ouve quando um jogador desconecta
  socket.on('disconnect', () => {
    console.log(`Jogador desconectado: ${socket.id}`);
    delete players[socket.id];
    
    // Envia a todos o estado atualizado (incluindo mapa)
    io.emit('gameStateUpdate', { players: players, map: gameMap, projectiles: projectiles });
  });
});

// 6. Inicia o servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse http://localhost:${PORT} no seu navegador`);
});