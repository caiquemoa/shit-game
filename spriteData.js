// spriteData.js

// [LOG]
console.log('[SPRITEDATA] Carregando dados de frames...'); 

// **ATENÇÃO: Mantenha seus valores calibrados de SPRITE_FRAMES_DATA aqui!**
export const SPRITE_FRAMES_DATA = {
    // 6 frames de caminhada
    'WALK_DOWN': [
        [24, 17], [88, 17], [152, 17], [216, 17], [280, 17], [344, 17]
    ],
    // ... (restante dos frames de Walk)
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

// Define os caminhos dos arquivos - CORRIGIDO PARA O CAMINHO 'assets/player/' E NOME LIMPO
// Caminhos de Walk
spriteImages['Walk_Up'].src = 'assets/player/Walk_Up-Sheet.png';
spriteImages['Walk_Down'].src = 'assets/player/Walk_Down-Sheet.png';
spriteImages['Walk_Side'].src = 'assets/player/Walk_Side-Sheet.png'; 

// Caminhos de Idle (FINALMENTE CORRIGIDO PARA O NOME LIMPO)
spriteImages['Idle_Up'].src = 'assets/player/Idle_Up-Sheet.png';     // <-- NOME LIMPO
spriteImages['Idle_Down'].src = 'assets/player/Idle_Down-Sheet.png'; // <-- NOME LIMPO
spriteImages['Idle_Side'].src = 'assets/player/Idle_Side-Sheet.png'; // <-- NOME LIMPO