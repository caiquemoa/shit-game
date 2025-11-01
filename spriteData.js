// spriteData.js

// [LOG]
console.log('[SPRITEDATA] Carregando dados de frames...'); 

// **ATENÇÃO: Mantenha seus valores calibrados de SPRITE_FRAMES_DATA aqui!**
export const SPRITE_FRAMES_DATA = {
    // 6 frames de caminhada (mantidos originais)
    'WALK_DOWN': [
        [24, 17], [88, 17], [152, 17], [216, 17], [280, 17], [344, 17]
    ],
    'WALK_UP': [
        [24, 17], [88, 17], [152, 17], [216, 17], [280, 17], [344, 17]
    ],
    'WALK_SIDE': [
        [24, 17], [88, 17], [152, 17], [216, 17], [280, 17], [344, 17]
    ],
    // 4 frames de idle (mantidos originais)
    'IDLE_UP': [
        [24, 17], [88, 17], [152, 17], [216, 17]
    ],
    'IDLE_DOWN': [
        [24, 17], [88, 17], [152, 17], [216, 17]
    ],
    'IDLE_SIDE': [
        [24, 17], [88, 17], [152, 17], [216, 17]
    ],
    // Frames para pierce (8 frames cada, com offsets exatos fornecidos)
    'PIERCE_DOWN': [
        [15, 13], [79, 10], [143, 10], [211, 20],
        [275, 19], [338, 14], [401, 10], [465, 12]
    ],
    'PIERCE_SIDE': [
        [9, 10], [71, 9], [135, 10], [214, 13],
        [276, 12], [336, 14], [398, 10], [460, 12]
    ],
    'PIERCE_UP': [
        [12, 10], [75, 9], [140, 10], [204, 7],
        [266, 8], [330, 8], [393, 9], [459, 11]
    ],
    // Frames para slice (8 frames cada, com offsets exatos fornecidos)
    'SLICE_DOWN': [
        [9, -1], [71, -2], [134, -1], [193, 3],
        [266, 8], [330, 8], [393, 9], [455, 2]
    ],
    'SLICE_SIDE': [
        [-1, -1], [60, -2], [123, -1], [192, 2],
        [266, 3], [330, 3], [387, 3], [448, 2]
    ],
    'SLICE_UP': [
        [2, 2], [64, 0], [127, 2], [190, 0],
        [253, -7], [319, -5], [385, -5], [448, -2]
    ],
};

// --- Carregamento das Sprites ---
export const spriteImages = {
    'Walk_Up': new Image(),
    'Walk_Down': new Image(),
    'Walk_Side': new Image(),
    'Idle_Up': new Image(),
    'Idle_Down': new Image(),
    'Idle_Side': new Image(),
    // Sprites para pierce
    'Pierce_Up': new Image(),
    'Pierce_Down': new Image(),
    'Pierce_Side': new Image(),
    // Sprites para slice
    'Slice_Up': new Image(),
    'Slice_Down': new Image(),
    'Slice_Side': new Image(),
};

// Define os caminhos dos arquivos
// Caminhos de Walk
spriteImages.Walk_Up.src = 'assets/player/Walk_Up-Sheet.png';
spriteImages.Walk_Down.src = 'assets/player/Walk_Down-Sheet.png';
spriteImages.Walk_Side.src = 'assets/player/Walk_Side-Sheet.png'; 

// Caminhos de Idle
spriteImages.Idle_Up.src = 'assets/player/Idle_Up-Sheet.png';
spriteImages.Idle_Down.src = 'assets/player/Idle_Down-Sheet.png';
spriteImages.Idle_Side.src = 'assets/player/Idle_Side-Sheet.png';

// Caminhos de Ataque (exatos como solicitado)
spriteImages.Pierce_Up.src = 'assets/player/Pierce_Up-Sheet.png';
spriteImages.Pierce_Down.src = 'assets/player/Pierce_Down-Sheet.png';
spriteImages.Pierce_Side.src = 'assets/player/Pierce_Side-Sheet.png';
spriteImages.Slice_Up.src = 'assets/player/Slice_Up-Sheet.png';
spriteImages.Slice_Down.src = 'assets/player/Slice_Down-Sheet.png';
spriteImages.Slice_Side.src = 'assets/player/Slice_Side-Sheet.png';