// server.js (Novo e Limpo)

// 1. Configuração de Dependências
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

// Importa os módulos modularizados
const { PORT, GAME_TICK_RATE } = require('./constants');
const gameEngine = require('./gameEngine');

// 2. Inicialização do Servidor
const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Servir os arquivos estáticos
app.use(express.static(__dirname));

// 3. Inicialização e Loop do Jogo
let gameLoopInterval = setInterval(() => {
    gameEngine.serverGameLoop(io);
}, GAME_TICK_RATE);


// 4. Lógica de Conexão (Socket.IO)
io.on('connection', (socket) => {
    console.log(`Novo jogador conectado: ${socket.id}`);
    
    // Adiciona o jogador ao GameEngine
    gameEngine.addPlayer(socket.id);
    
    // Envia o estado inicial para o novo cliente
    socket.emit('gameStateUpdate', gameEngine.getGameState());
    
    // --- Handlers de Eventos ---
    
    socket.on('input', (inputData) => {
        const player = gameEngine.getPlayer(socket.id);
        if (player) {
            player.input = inputData.keys;
        }
    });

    socket.on('aimUpdate', (data) => {
        const player = gameEngine.getPlayer(socket.id);
        if (player) {
            player.aimAngle = data.angle;
        }
    });

    socket.on('shoot', () => {
        gameEngine.createProjectile(socket.id); 
    });

    socket.on('disconnect', () => {
        console.log(`Jogador desconectado: ${socket.id}`);
        gameEngine.removePlayer(socket.id);
    });
});

// 5. Inicia o Servidor
server.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse http://localhost:${PORT} no seu navegador`);
});