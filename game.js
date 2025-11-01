// game.js (Módulo Principal Corrigido)

import { initRenderer, renderGame, getCameraPosition } from './renderer.js';
// Importamos as funções específicas de handler e a nova função disableInput
import { 
    initInputHandler, 
    handleKeyDown, 
    handleKeyUp, 
    handleMouseMove, 
    handleMouseDown, 
    preventContextMenu,
    disableInput // NOVO: Para parar o input no Game Over
} from './inputHandler.js';


// --- Variáveis de Estado Global ---
let myId = '';
let players = {};
let gameMap = [];
let projectiles = [];
let mapWidthPixels = 0;
let mapHeightPixels = 0;
let camera = { x: 0, y: 0 }; 

let socket = null; // Mova o socket para o escopo do módulo

// Elementos da DOM
const startScreen = document.getElementById('start-screen');
const playButton = document.getElementById('playButton');
const playerNameInput = document.getElementById('playerNameInput');
const gameCanvas = document.getElementById('gameCanvas');
const header = document.getElementById('header');

// --- ADIÇÃO DE LISTENERS GLOBAIS (Apenas UMA VEZ) ---
// Adicionar listeners de teclado e mouse UMA ÚNICA VEZ ao carregar o script.
// Eles só farão efeito se 'gameActive' for true no inputHandler.
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);

if (gameCanvas) {
    gameCanvas.addEventListener('mousemove', handleMouseMove);
    gameCanvas.addEventListener('mousedown', handleMouseDown);
    gameCanvas.addEventListener('contextmenu', preventContextMenu); // Para evitar menu de contexto no botão direito
}
// ----------------------------------------------------

// Listener do botão de "Entrar"
playButton.addEventListener('click', () => {
    const name = playerNameInput.value.trim();
    
    if (name.length > 0 && name.length <= 15) {
        
        // Impede cliques múltiplos acidentais
        playButton.disabled = true; 
        playerNameInput.disabled = true; 

        // 1. Esconde a HUD
        startScreen.classList.add('hidden');
        
        // 2. Mostra o Canvas e o Header
        gameCanvas.classList.add('visible');
        header.classList.add('visible');
        
        // 3. Inicia a conexão e o jogo
        initGame(name); 
    } else {
        alert('Por favor, digite um nome (1-15 caracteres).');
        playerNameInput.focus();
    }
});


// --- FUNÇÃO PRINCIPAL DO JOGO (Chamada após login) ---
function initGame(playerName) {
    
    // 1. INICIALIZAÇÃO DA CONEXÃO
    // NOTA: 'io' é uma função global injetada pelo script do Socket.io no HTML.
    socket = io(); 
    console.log('[GAME.JS] Socket.io conectando...');

    // Inicializa a lógica de input e renderização, passando o socket e as referências de dados
    initInputHandler(socket, players, camera);
    initRenderer(players, gameMap, projectiles, myId, mapWidthPixels, mapHeightPixels);

    // 1. Recebe a atualização de estado do servidor
    socket.on('gameStateUpdate', (data) => {
        // ... (resto da função gameStateUpdate, sem alterações)
        if (Object.keys(players).length === 0 && Object.keys(data.players).length > 0) {
            console.log('[GAME.JS] Recebido primeiro gameStateUpdate. Jogadores carregados.');
        }
        
        // ATUALIZAÇÃO DOS OBJETOS
        Object.assign(players, data.players);
        gameMap = data.map;
        projectiles = data.projectiles || [];
        mapWidthPixels = data.mapWidth;
        mapHeightPixels = data.mapHeight;
        
        // Força uma atualização de referência no renderer
        initRenderer(players, gameMap, projectiles, myId, mapWidthPixels, mapHeightPixels);
    });

    // 2. Recebe o ID na conexão inicial
    socket.on('connect', () => {
        myId = socket.id;
        console.log(`[GAME.JS] Conectado com SUCESSO! Meu ID: ${myId}.`);
        
        // Envia o nome escolhido ao servidor
        socket.emit('joinGame', { name: playerName });
        
        initRenderer(players, gameMap, projectiles, myId, mapWidthPixels, mapHeightPixels);
    });

    // Game Over
    socket.on('gameOver', () => {
        console.log('[GAME.JS] Game Over recebido. Desconectando...');
        alert(`Fim de Jogo para ${playerName}! Você morreu. A página será recarregada.`);
        
        // *** NOVO: DESATIVAÇÃO E DESCONEXÃO ***
        disableInput(); // Impede que mais input seja enviado
        if(socket) {
            socket.disconnect(); // Finaliza a conexão do socket
        }
        // ***************************************

        // Recarregar a página é a forma mais limpa de resetar o estado do cliente
        window.location.reload(); 
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
}

// NOTA: O jogo agora SÓ COMEÇA quando 'initGame()' é chamado pelo listener da HUD.