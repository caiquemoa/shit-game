// spriteData.js

// **ATENÇÃO: SUBSTITUA ESTES VALORES PELOS SEUS VALORES FINAIS CALIBRADOS!**
export const SPRITE_FRAMES_DATA = {
    // 6 frames de caminhada
    'WALK_DOWN': [
        [24, 17], [88, 17], [152, 17], [216, 17], [280, 17], [344, 17]
    ],
    'WALK_UP': [
        [24, 17], [88, 17], [152, 17], [216, 17], [280, 17], [344, 17]
    ],
    'WALK_SIDE': [
        [24, 17], [88, 17], [152, 17], [216, 17], [280, 17], [344, 17]
    ],
    // 4 frames de idle
    'IDLE_UP': [
        [24, 17], [88, 17], [152, 17], [216, 17]
    ],
    'IDLE_DOWN': [
        [24, 17], [88, 17], [152, 17], [216, 17]
    ],
    'IDLE_SIDE': [
        [24, 17], [88, 17], [152, 17], [216, 17]
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
};

// Define os caminhos dos arquivos
spriteImages['Walk_Up'].src = 'Walk_Up-Sheet.png';
spriteImages['Walk_Down'].src = 'Walk_Down-Sheet.png';
spriteImages['Walk_Side'].src = 'Walk_Side-Sheet.png';
spriteImages['Idle_Up'].src = 'Idle_Up-Sheet.png';
spriteImages['Idle_Down'].src = 'Idle_Down-Sheet.png';
spriteImages['Idle_Side'].src = 'Idle_Side-Sheet.png';