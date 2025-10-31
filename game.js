// game.js (Módulo Principal Completo)

// 1. INICIALIZAÇÃO DA CONEXÃO
// NOTA: 'io' é uma função global injetada pelo script do Socket.io no HTML.
const socket = io(); 
console.log('[GAME.JS] Socket.io conectado globalmente. Tentando obter ID...');

import { initRenderer, renderGame, getCameraPosition } from './renderer.js';
import { initInputHandler } from './inputHandler.js';
import { CANVAS_WIDTH, CANVAS_HEIGHT } from './config.js'; // Apenas para garantia

// --- Variáveis de Estado Global ---
// Estas variáveis servem como a "fonte de verdade" e são passadas por referência.
let myId = '';
let players = {};
let gameMap = [];
let projectiles = [];
let mapWidthPixels = 0;
let mapHeightPixels = 0;

let camera = { x: 0, y: 0 }; 

// Inicializa a lógica de input e renderização, passando o socket e as referências de dados
initInputHandler(socket, players, camera);
initRenderer(players, gameMap, projectiles, myId, mapWidthPixels, mapHeightPixels);


// 1. Recebe a atualização de estado do servidor
socket.on('gameStateUpdate', (data) => {
    if (Object.keys(players).length === 0 && Object.keys(data.players).length > 0) {
        console.log('[GAME.JS] Recebido primeiro gameStateUpdate. Jogadores carregados.');
    }
    
    // ATUALIZAÇÃO DOS OBJETOS
    // Copia o conteúdo para a variável 'players' que foi passada por referência.
    Object.assign(players, data.players);
    gameMap = data.map;
    projectiles = data.projectiles || [];
    mapWidthPixels = data.mapWidth;
    mapHeightPixels = data.mapHeight;
    
    // Força uma atualização de referência no renderer (importante no primeiro frame)
    initRenderer(players, gameMap, projectiles, myId, mapWidthPixels, mapHeightPixels);
});

// 2. Recebe o ID na conexão inicial
socket.on('connect', () => {
    myId = socket.id;
    console.log(`[GAME.JS] Conectado com SUCESSO! Meu ID: ${myId}.`);
    
    // Garante que o renderer tenha o ID correto
    initRenderer(players, gameMap, projectiles, myId, mapWidthPixels, mapHeightPixels);
});

// Game Over
socket.on('gameOver', () => {
    console.log('[GAME.JS] Game Over recebido.');
    alert('Você morreu! Recarregue a página para jogar novamente.');
});


// O Game Loop do Cliente (Loop de Animação)
function gameLoop() {
    // 1. Renderiza o frame atual
    renderGame();
    
    // 2. Atualiza a referência da câmera (para o inputHandler)
    Object.assign(camera, getCameraPosition());

    // 3. Solicita o próximo frame
    requestAnimationFrame(gameLoop);
}

// Inicia o loop de desenho
requestAnimationFrame(gameLoop);