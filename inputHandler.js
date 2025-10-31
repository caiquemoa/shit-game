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

export function initInputHandler(s, p, c) {
    // [LOG]
    console.log('[INPUT] Inicializando handler. Socket fornecido.');
    
    socket = s;
    players = p;
    camera = c;
    
    // Remove listeners antigos antes de adicionar novos para evitar duplicação
    document.removeEventListener('keydown', handleKeyDown);
    document.removeEventListener('keyup', handleKeyUp);
    const canvas = document.getElementById('gameCanvas');
    if (canvas) {
        canvas.removeEventListener('mousemove', handleMouseMove);
        canvas.removeEventListener('mousedown', handleMouseDown);
        canvas.removeEventListener('contextmenu', preventContextMenu); 
    }

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    if (canvas) {
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('contextmenu', preventContextMenu); // Previne menu de contexto
    }
}

function preventContextMenu(event) {
    event.preventDefault();
}

function sendInput() {
    if (socket) {
        socket.emit('input', { 
            keys: inputState
        });
    } else {
        console.warn('[INPUT] Tentativa de enviar input sem socket.');
    }
}

function handleKeyDown(event) {
    let key = keyMap[event.key];
    if (key && !inputState[key]) {
        inputState[key] = true;
        sendInput(); 
    }
}

function handleKeyUp(event) {
    let key = keyMap[event.key];
    if (key && inputState[key]) {
        inputState[key] = false;
        sendInput(); 
    }
}

function handleMouseMove(event) {
    if (!socket || !socket.id) return;
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
    const angle = Math.atan2(mouseY - (myPlayer.y - SPRITE_HEIGHT / 2), mouseX - myPlayer.x);
    
    localAimAngle = angle; 
    
    socket.emit('aimUpdate', { angle: angle });
}

function handleMouseDown(event) {
    if (!socket || !socket.id) return;
    if (event.button === 0) { // Botão esquerdo
        socket.emit('shoot');
    }
}