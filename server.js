// 1. Configuração do Servidor
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;
const MAP_WIDTH = 800;
const MAP_HEIGHT = 600;
const PLAYER_SIZE = 20;
const PLAYER_SPEED = 3; // Velocidade base do jogador

// 2. Servir os arquivos estáticos
app.use(express.static(__dirname));

// 3. Estrutura de Dados e Lógica do Jogo (Backend)
let players = {};
let gameLoopInterval;

function getRandomColor() {
  const letters = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) {
    color += letters[Math.floor(Math.random() * 16)];
  }
  return color;
}

// Inicializa o estado de um novo jogador
function createNewPlayer(id) {
  return {
    id: id,
    x: Math.floor(Math.random() * (MAP_WIDTH - PLAYER_SIZE)),
    y: Math.floor(Math.random() * (MAP_HEIGHT - PLAYER_SIZE)),
    color: getRandomColor(),
    health: 100,             // Novo: Vida para combate
    speed: PLAYER_SPEED,     // Novo: Velocidade
    input: {},               // Novo: Estado dos inputs (teclas pressionadas)
    isAttacking: false,      // Novo: Estado de ataque
    lastUpdateTime: Date.now() // Para sincronização de tempo
  };
}

// 4. Game Loop do Servidor (Processamento de Lógica)
function serverGameLoop() {
  const currentTime = Date.now();
  
  for (const id in players) {
    const player = players[id];
    
    // Calcula o tempo decorrido para movimento independente da taxa de quadros
    const deltaTime = (currentTime - player.lastUpdateTime) / 1000; // Tempo em segundos
    player.lastUpdateTime = currentTime;
    
    // Processa o movimento
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

    // Aplica o movimento
    player.x += dx;
    player.y += dy;
    
    // Garante que o jogador permaneça dentro do mapa (Bounds checking)
    player.x = Math.max(0, Math.min(player.x, MAP_WIDTH - PLAYER_SIZE));
    player.y = Math.max(0, Math.min(player.y, MAP_HEIGHT - PLAYER_SIZE));
    
    // (Futuro: Lógica de Combate, Colisão, etc. viria aqui)
  }

  // Envia o estado atualizado do jogo para todos os clientes
  io.emit('gameStateUpdate', players);
}

// Inicia o Game Loop do Servidor (30 atualizações por segundo)
gameLoopInterval = setInterval(serverGameLoop, 1000 / 30);


// 5. Lógica de Conexão (Socket.IO)
io.on('connection', (socket) => {
  console.log(`Novo jogador conectado: ${socket.id}`);
  
  // Adiciona o novo jogador
  players[socket.id] = createNewPlayer(socket.id);

  // Envia a todos os jogadores o estado completo atual
  io.emit('gameStateUpdate', players); 
  
  // Ouve inputs do teclado
  socket.on('input', (inputData) => {
    // Atualiza o estado de input do jogador no servidor
    if (players[socket.id]) {
        players[socket.id].input = inputData.keys;
        players[socket.id].isAttacking = inputData.isAttacking;
    }
  });
  
  // Ouve quando um jogador desconecta
  socket.on('disconnect', () => {
    console.log(`Jogador desconectado: ${socket.id}`);
    delete players[socket.id];
    
    // Envia a todos o estado atualizado
    io.emit('gameStateUpdate', players);
  });
});

// 6. Inicia o servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
  console.log(`Acesse http://localhost:${PORT} no seu navegador`);
});