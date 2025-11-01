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

// --- Variável de estado para controlar se o jogo está ativo ---
let gameActive = false; 

// A função init agora só recebe referências, mas NÃO adiciona listeners
export function initInputHandler(s, p, c) {
    console.log('[INPUT] Inicializando handler. Socket fornecido.');
    
    socket = s;
    players = p;
    camera = c;
    gameActive = true; // Jogo ativo após o login
}

// Função para desativar o input (chamada no Game Over)
export function disableInput() {
    gameActive = false;
    inputState = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
    if (socket) {
        socket.emit('input', { keys: inputState });
    }
}

function sendInput() {
    if (socket && gameActive) {
        socket.emit('input', { keys: inputState });
    }
}

export function handleKeyDown(event) {
    if (!gameActive) return;
    
    const key = event.key.toLowerCase();
    
    // Ataques melee
    if (key === 'q') {
        socket.emit('pierce');
        event.preventDefault();
        return;
    }
    if (key === 'e') {
        socket.emit('slice');
        event.preventDefault();
        return;
    }
    
    let arrowKey = keyMap[event.key];
    if (arrowKey && !inputState[arrowKey]) {
        inputState[arrowKey] = true;
        sendInput(); 
    }
}

export function handleKeyUp(event) {
    if (!gameActive) return;
    
    let key = keyMap[event.key];
    if (key && inputState[key]) {
        inputState[key] = false;
        sendInput(); 
    }
}

export function handleMouseMove(event) {
    if (!socket || !socket.id || !gameActive) return;
    
    const myId = socket.id;
    if (!players[myId] || !event.target) return; 

    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    
    const mouseX = event.clientX - rect.left + camera.x;
    const mouseY = event.clientY - rect.top + camera.y;

    const myPlayer = players[myId];
    
    // Centro dinâmico baseado na animação atual (superior à hitbox)
    let playerH = SPRITE_HEIGHT;
    if (myPlayer.state === 'pierce' || myPlayer.state === 'slice') {
        const absCos = Math.abs(Math.cos(localAimAngle || 0));
        const absSin = Math.abs(Math.sin(localAimAngle || 0));
        playerH = absSin > absCos ? SPRITE_HEIGHT * 2 : SPRITE_HEIGHT; // Vertical maior
    }
    const centerY = myPlayer.y - (playerH / 2);
    
    localAimAngle = Math.atan2(mouseY - centerY, mouseX - myPlayer.x);

    socket.emit('aimUpdate', { angle: localAimAngle });
}

export function handleMouseDown(event) {
    if (event.button === 0 && socket && gameActive) {
        event.preventDefault();
        socket.emit('shoot'); 
    }
}

export function preventContextMenu(event) {
    event.preventDefault();
}

// Os Listeners agora devem ser adicionados APENAS uma vez no 'game.js'
export function setupInputListeners() {
    // Não usado para adicionar listeners; game.js cuida disso.
}