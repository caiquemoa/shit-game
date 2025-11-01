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
        [18, 17, 18, 31, 0, 0],
        [82, 18, 19, 32, 0, 0],
        [146, 18, 19, 32, 0, 0],
        [218, 22, 15, 42, 0, 0],
        [282, 22, 15, 41, 0, 0],
        [344, 21, 17, 36, 0, 0],
        [404, 19, 19, 32, 0, 0],
        [468, 19, 18, 30, 0, 0]
    ],
    'PIERCE_SIDE': [
        [18, 17, 22, 31, 0, 0],
        [79, 16, 25, 34, 0, 0],
        [143, 16, 25, 34, 0, 0],
        [215, 22, 41, 27, 0, 0],
        [279, 22, 36, 27, 0, 0],
        [344, 21, 31, 27, 0, 0],
        [408, 19, 24, 30, 0, 0],
        [468, 19, 20, 30, 0, 0]
    ],
    'PIERCE_SIDE_LEFT': [
        [18, 17, 22, 31, -6, 0],
        [79, 16, 25, 34, 0, 0],
        [143, 16, 25, 34, 0, 0],
        [215, 22, 41, 27, 0, 0],
        [279, 22, 36, 27, 0, 0],
        [344, 21, 31, 27, 0, 0],
        [408, 19, 24, 30, 0, 0],
        [468, 19, 20, 30, 0, 0]
    ],
    'PIERCE_UP': [
        [24, 19, 17, 30, 0, 0],
        [89, 20, 16, 29, 0, 0],
        [153, 20, 16, 29, 0, 0],
        [212, 9, 16, 40, 0, 0],
        [276, 9, 16, 40, 0, 0],
        [341, 11, 16, 38, 0, 0],
        [406, 14, 18, 35, 0, 0],
        [471, 18, 17, 30, 0, 0]
    ],
    // Frames para slice (8 frames cada, com offsets exatos fornecidos)
    'SLICE_DOWN': [
        [19, 1, 17, 47, 0, 0],
        [83, 0, 17, 49, 0, 0],
        [149, 0, 17, 49, 0, 0],
        [198, 6, 37, 59, 0, 0],
        [276, 23, 24, 40, 0, 0],
        [344, 22, 21, 37, 0, 0],
        [405, 21, 21, 31, 0, 0],
        [468, 9, 18, 39, 0, 0]
    ],
    'SLICE_SIDE': [
        [9, 12, 33, 37, 0, 0],
        [72, 12, 33, 37, 0, 0],
        [135, 11, 33, 37, 0, 0],
        [193, 19, 63, 40, 0, 0],
        [279, 22, 41, 28, 0, 0],
        [344, 22, 36, 28, 0, 0],
        [408, 16, 25, 33, 0, 0],
        [470, 18, 24, 30, 0, 0]
    ],
    'SLICE_SIDE_LEFT': [
        [9, 12, 33, 37, 0, 0],
        [72, 12, 33, 37, 0, 0],
        [135, 11, 33, 37, 0, 0],
        [193, 19, 63, 40, 0, 0],
        [279, 22, 41, 28, 0, 0],
        [344, 22, 36, 28, 0, 0],
        [408, 16, 25, 33, 0, 0],
        [470, 18, 24, 30, 0, 0]
    ],
    'SLICE_UP': [
        [24, 20, 17, 38, 0, 0],
        [88, 19, 16, 41, 0, 0],
        [153, 19, 15, 41, 0, 0],
        [202, 3, 40, 62, 0, 0],
        [276, 4, 21, 45, 0, 0],
        [341, 10, 18, 39, 0, 0],
        [406, 16, 24, 33, 0, 0],
        [471, 19, 24, 30, 0, 0]
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