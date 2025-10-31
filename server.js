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
let gameLoopInterval;

// --- Configurações do Grid ---
const GRID_SIZE = 32; // Cada "quadrado" no mapa terá 32x32 pixels
const MAP_WIDTH_TILES = 25; // Mapa terá 25 tiles de largura (25 * 32 = 800 pixels)
const MAP_HEIGHT_TILES = 18; // Mapa terá 18 tiles de altura (18 * 32 = 576 pixels, ajustado para caber)

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
    gridX: x,                 // Novo: Posição X no grid
    gridY: y,                 // Novo: Posição Y no grid
    x: x * GRID_SIZE,         // Novo: Posição X em pixels (para o cliente desenhar)
    y: y * GRID_SIZE,         // Novo: Posição Y em pixels (para o cliente desenhar)
    color: getRandomColor(),
    health: 100,             
    speed: PLAYER_SPEED,     
    input: {},               
    isMoving: false,         // Novo: Para controlar animação de movimento
    direction: 'down',       // Novo: Direção para sprites futuros
    isAttacking: false,      
    lastMoveTime: 0,         // Novo: Controla o tempo entre os movimentos no grid
    moveDelay: 200           // Novo: 200ms entre cada movimento no grid
  };
}

// 4. Game Loop do Servidor (Processamento de Lógica)
function serverGameLoop() {
  const currentTime = Date.now();
  
  for (const id in players) {
    const player = players[id];
    
    // Processa o movimento baseado em grid
    if (currentTime - player.lastMoveTime > player.moveDelay) {
        let newGridX = player.gridX;
        let newGridY = player.gridY;
        let moved = false;

        // Prioridade de movimento (se mais de uma tecla pressionada)
        if (player.input.ArrowUp) { newGridY--; player.direction = 'up'; moved = true; }
        else if (player.input.ArrowDown) { newGridY++; player.direction = 'down'; moved = true; }
        else if (player.input.ArrowLeft) { newGridX--; player.direction = 'left'; moved = true; }
        else if (player.input.ArrowRight) { newGridX++; player.direction = 'right'; moved = true; }
        
        if (moved) {
            // Verifica limites do mapa e colisão com paredes
            if (newGridX >= 0 && newGridX < MAP_WIDTH_TILES &&
                newGridY >= 0 && newGridY < MAP_HEIGHT_TILES &&
                gameMap[newGridY][newGridX] === 0) // Verifica se o próximo tile é um caminho (0)
            {
                player.gridX = newGridX;
                player.gridY = newGridY;
                player.x = newGridX * GRID_SIZE; // Atualiza posição em pixels
                player.y = newGridY * GRID_SIZE; // Atualiza posição em pixels
                player.lastMoveTime = currentTime;
                player.isMoving = true; // Sinaliza que está em movimento
            } else {
                player.isMoving = false; // Não se moveu porque bateu em algo
            }
        } else {
            player.isMoving = false; // Nenhuma tecla de movimento pressionada
        }
    }
    
    // (Futuro: Lógica de Combate, Colisão com outros players, etc. viria aqui)
  }

  // Envia o estado atualizado do jogo para todos os clientes
  io.emit('gameStateUpdate', { players: players, map: gameMap });
}

// Inicia o Game Loop do Servidor (30 atualizações por segundo)
gameLoopInterval = setInterval(serverGameLoop, 1000 / 30);


// 5. Lógica de Conexão (Socket.IO)
io.on('connection', (socket) => {
  console.log(`Novo jogador conectado: ${socket.id}`);
  
  // Adiciona o novo jogador
  players[socket.id] = createNewPlayer(socket.id);

  // Envia a todos os jogadores o estado completo atual (incluindo mapa)
  io.emit('gameStateUpdate', { players: players, map: gameMap }); 
  
  // Ouve inputs do teclado
  socket.on('input', (inputData) => {
    // Atualiza o estado de input do jogador no servidor
    if (players[socket.id]) {
        // Apenas teclas de movimento importam para o grid
        players[socket.id].input.ArrowUp = inputData.keys.ArrowUp;
        players[socket.id].input.ArrowDown = inputData.keys.ArrowDown;
        players[socket.id].input.ArrowLeft = inputData.keys.ArrowLeft;
        players[socket.id].input.ArrowRight = inputData.keys.ArrowRight;

        players[socket.id].isAttacking = inputData.isAttacking;
    }
  });
  
  // Ouve quando um jogador desconecta
  socket.on('disconnect', () => {
    console.log(`Jogador desconectado: ${socket.id}`);
    delete players[socket.id];
    
    // Envia a todos o estado atualizado (incluindo mapa)
    io.emit('gameStateUpdate', { players: players, map: gameMap });
  });
});

// 6. Inicia o servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse http://localhost:${PORT} no seu navegador`);
});