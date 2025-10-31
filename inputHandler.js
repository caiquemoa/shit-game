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

// A função 'sendInput' e 'sendAim' será fornecida pelo game.js
let socket = null;
let players = {};
let camera = { x: 0, y: 0 }; 

export function initInputHandler(s, p, c) {
    socket = s;
    players = p;
    camera = c;
    
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('keyup', handleKeyUp);
    
    const canvas = document.getElementById('gameCanvas');
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('contextmenu', (event) => event.preventDefault()); // Previne menu de contexto
}

function sendInput() {
    socket.emit('input', { 
        keys: inputState
    });
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
    const myId = socket.id;
    if (!players[myId]) return; 

    const rect = event.target.getBoundingClientRect();
    // Usa a camera e a posição do mouse na tela para calcular a posição no mapa
    const mouseX = event.clientX - rect.left + camera.x;
    const mouseY = event.clientY - rect.top + camera.y;

    const myPlayer = players[myId];
    
    // O ângulo é calculado do CENTRO VISUAL do jogador
    const angle = Math.atan2(mouseY - (myPlayer.y - SPRITE_HEIGHT / 2), mouseX - myPlayer.x);
    
    localAimAngle = angle; 
    
    socket.emit('aimUpdate', { angle: angle });
}

function handleMouseDown(event) {
    if (event.button === 0) { // Botão esquerdo
        socket.emit('shoot');
    }
}