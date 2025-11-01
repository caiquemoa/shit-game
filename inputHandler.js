// inputHandler.js
import { keyMap, SPRITE_HEIGHT } from './config.js';

// Variáveis que serão atualizadas no game.js
export let inputState = { 
    ArrowUp: false, 
    ArrowDown: false, 
    ArrowLeft: false, 
    ArrowRight: false
};
export let localAimAngle = 0; 

// As referências serão preenchidas por initInputHandler
let socket = null;
let players = {};
let camera = { x: 0, y: 0 }; 

// --- NOVO: Variável de estado para controlar se o jogo está ativo ---
let gameActive = false; 

// A função init agora só recebe referências, mas NÃO adiciona listeners
export function initInputHandler(s, p, c) {
    // [LOG]
    console.log('[INPUT] Inicializando handler. Socket fornecido.');
    
    socket = s;
    players = p;
    camera = c;
    gameActive = true; // Jogo ativo após o login
}

// NOVO: Função para desativar o input (chamada no Game Over)
export function disableInput() {
    gameActive = false;
    // Reseta o inputState para parar o movimento no servidor
    inputState = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
    if (socket) {
        socket.emit('input', { keys: inputState });
    }
}


function sendInput() {
    if (socket && gameActive) { // Checa se o jogo está ativo
        socket.emit('input', { 
            keys: inputState
        });
    }
}

export function handleKeyDown(event) {
    if (!gameActive) return; // Se o jogo não estiver ativo, ignora
    
    let key = keyMap[event.key];
    if (key && !inputState[key]) {
        inputState[key] = true;
        sendInput(); 
    }
}

export function handleKeyUp(event) {
    if (!gameActive) return; // Se o jogo não estiver ativo, ignora
    
    let key = keyMap[event.key];
    if (key && inputState[key]) {
        inputState[key] = false;
        sendInput(); 
    }
}

export function handleMouseMove(event) {
    if (!socket || !socket.id || !gameActive) return; // Se não estiver ativo, ignora
    
    const myId = socket.id;
    if (!players[myId] || !event.target) return; 

    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    
    // Usa a câmera e a posição do mouse na tela para calcular a posição no mapa
    const mouseX = event.clientX - rect.left + camera.x;
    const mouseY = event.clientY - rect.top + camera.y;

    const myPlayer = players[myId];
    
    // O ângulo é calculado do CENTRO VISUAL do jogador
    // O centro visual é player.y - (SPRITE_HEIGHT / 2)
    localAimAngle = Math.atan2(
        mouseY - (myPlayer.y - SPRITE_HEIGHT / 2),
        mouseX - myPlayer.x
    );

    socket.emit('aimUpdate', { angle: localAimAngle });
}

export function handleMouseDown(event) {
    // Apenas atira se o jogo estiver ativo
    if (event.button === 0 && socket && gameActive) { // Botão esquerdo do mouse
        event.preventDefault(); // Evita seleção de texto
        socket.emit('shoot'); 
    }
}

export function preventContextMenu(event) {
    event.preventDefault(); // Evita menu de contexto no botão direito
}

// Os Listeners agora devem ser adicionados APENAS uma vez no 'game.js'
// e só terão efeito se 'gameActive' for true.
// Esta função é mantida vazia para compatibilidade, mas a lógica de adição foi movida.
export function setupInputListeners() {
    // NOTA: Esta função não é mais usada para adicionar listeners de teclado/mouse
    // O game.js agora adiciona-os ao document/canvas diretamente.
}