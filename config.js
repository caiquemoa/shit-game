// config.js

// [LOG]
console.log('[CONFIG] Carregando constantes...'); 

// Configuração do Canvas
const canvas = document.getElementById('gameCanvas');
export const ctx = canvas.getContext('2d');
export const CANVAS_WIDTH = canvas.width;
export const CANVAS_HEIGHT = canvas.height;

// --- Configurações do Jogo ---
export const GRID_SIZE = 32;  

// --- Configurações de Sprite (ATUALIZADO PARA 16x34) ---
export const SPRITE_WIDTH = 16;
export const SPRITE_HEIGHT = 32;

// CORREÇÃO DE POSICIONAMENTO:
// (0, 0) no contexto transladado (player.x, player.y) é os PÉS.
export const SPRITE_OFFSET_X = -SPRITE_WIDTH / 2; // -8 pixels (Centralizado Horizontalmente)
export const SPRITE_OFFSET_Y = -SPRITE_HEIGHT; // -34 pixels (Desenha para cima, a partir dos pés)

// Mapeamento de Teclas
export const keyMap = {
    'w': 'ArrowUp', 'W': 'ArrowUp',
    's': 'ArrowDown', 'S': 'ArrowDown',
    'a': 'ArrowLeft', 'A': 'ArrowLeft',
    'd': 'ArrowRight', 'D': 'ArrowRight'
};