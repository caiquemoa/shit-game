// constants.js

// --- Dimensões e Configurações de Rede ---
exports.PORT = process.env.PORT || 3000;
exports.GAME_TICK_RATE = 1000 / 30; // 30 FPS no servidor

// --- Configurações de Sprite (IMPORTANTE: Alinhar com o Frontend) ---
exports.GRID_SIZE = 32;
exports.PLAYER_SPRITE_WIDTH = 16;
exports.PLAYER_SPRITE_HEIGHT = 34; // Ajustado para 34, como no frontend
exports.PLAYER_RADIUS = exports.PLAYER_SPRITE_WIDTH / 2;

// --- Configurações de Jogo ---
exports.PLAYER_SPEED = 3;     
exports.PROJECTILE_SPEED = 6; 
exports.SHOT_COOLDOWN = 500; // ms
exports.PLAYER_START_HEALTH = 100;
exports.DAMAGE_PER_HIT = 20;

// --- Configurações de Animação ---
exports.FRAME_DURATION_WALK = 100; // ms por frame
exports.FRAME_DURATION_IDLE = 200; // ms por frame
exports.MAX_FRAMES_WALK = 6;
exports.MAX_FRAMES_IDLE = 4;

// --- Configurações do Mapa ---
exports.MAP_ROWS = 36;
exports.MAP_COLS = 50;

exports.MAP_WIDTH_PIXELS = exports.MAP_COLS * exports.GRID_SIZE;
exports.MAP_HEIGHT_PIXELS = exports.MAP_ROWS * exports.GRID_SIZE;

// --- Mapa Inicial ---
function generateMap() {
    const map = Array(exports.MAP_ROWS).fill(0).map(() => Array(exports.MAP_COLS).fill(0));

    // Cria bordas
    for(let y = 0; y < exports.MAP_ROWS; y++) {
        for(let x = 0; x < exports.MAP_COLS; x++) {
            if (y === 0 || y === exports.MAP_ROWS - 1 || x === 0 || x === exports.MAP_COLS - 1) {
                map[y][x] = 1; // Borda
            }
        }
    }
    // Estrutura interna para teste
    for(let y = 4; y < 9; y++) {
        for(let x = 4; x < 9; x++) {
            map[y][x] = 1;
        }
    }
    map[5][5] = 0; 
    return map;
}
exports.gameMap = generateMap();

// --- Funções de Utilidade (Uteis para o GameEngine) ---
exports.getRandomColor = function() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
};

// Lógica de Colisão (Adaptada para usar as constantes exportadas)
exports.isCollidingWithMap = function(x, y) {
    const halfWidth = exports.PLAYER_SPRITE_WIDTH / 2;
    const height = exports.PLAYER_SPRITE_HEIGHT;

    // Pontos de verificação da hitbox (ancorada nos pés)
    const checkPoints = [
        { x: x - halfWidth, y: y - height }, // Top-Left
        { x: x + halfWidth, y: y - height }, // Top-Right
        { x: x - halfWidth, y: y - 1 },      // Bottom-Left
        { x: x + halfWidth, y: y - 1 }       // Bottom-Right
    ];

    for (const point of checkPoints) {
        if (point.x < 0 || point.x >= exports.MAP_WIDTH_PIXELS || point.y < 0 || point.y >= exports.MAP_HEIGHT_PIXELS) {
            return true; // Colidiu com os limites externos
        }

        const gridX = Math.floor(point.x / exports.GRID_SIZE);
        const gridY = Math.floor(point.y / exports.GRID_SIZE);

        if (exports.gameMap[gridY] && exports.gameMap[gridY][gridX] === 1) {
            return true;
        }
    }
    return false;
};