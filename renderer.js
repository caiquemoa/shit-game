// renderer.js
import { 
    ctx, SPRITE_WIDTH, SPRITE_HEIGHT, GRID_SIZE, 
    CANVAS_WIDTH, CANVAS_HEIGHT 
} from './config.js';
import { SPRITE_FRAMES_DATA, spriteImages } from './spriteData.js';
import { localAimAngle } from './inputHandler.js';

// =========================================
// VARIÁVEIS DE CALIBRAÇÃO (agora mutáveis, DevMode-aware)
// =========================================
// --- CALIBRATION START ---
let CALIBRATION_DATA = {
    // PIERCE - Calibração de Sprites e Hitboxes
    'PIERCE_SIDE': {
        WIDTH: 64, // Largura do frame
        HEIGHT: 64, // Altura do frame
        OFFSET_X: -32, // Offset Horizontal (posição X do canto superior esquerdo do frame em relação ao pivô)
        OFFSET_Y: -64, // Offset Vertical (posição Y do canto superior esquerdo do frame em relação ao pivô)
        BLEED_CUT: 4, // Corte (em pixels) para vazamentos/ghosts no flip lateral
        FLIP_OVERRIDE: false, // Desativa o espelhamento automático se TRUE.
        LEFT_OFFSET_X: 0, // Offset X aplicado se FLIP_OVERRIDE for TRUE e estiver virado para a esquerda.
        CUT_ALIGNMENT: 'START', // Posição do corte (START: Esquerda/Cima, END: Direita/Baixo)
    },
    'PIERCE_UP': {
        WIDTH: 64,
        HEIGHT: 128,
        OFFSET_X: -32,
        OFFSET_Y: -128,
        BLEED_CUT: 0, // Corte (em pixels) para vazamentos/ghosts (geralmente 0 para UP)
        CUT_ALIGNMENT: 'START', // Posição do corte (START: Esquerda/Cima, END: Direita/Baixo)
    },
    'PIERCE_DOWN': {
        WIDTH: 64,
        HEIGHT: 128,
        OFFSET_X: -32,
        OFFSET_Y: -128,
        BLEED_CUT: 4, // Corte (em pixels) para vazamentos/ghosts no bottom (perna residual)
        CUT_ALIGNMENT: 'START', // Posição do corte (START: Esquerda/Cima, END: Direita/Baixo)
    },
    // SLICE - Calibração de Sprites e Hitboxes
    'SLICE_SIDE': {
        WIDTH: 64,
        HEIGHT: 64,
        OFFSET_X: -32,
        OFFSET_Y: -64,
        BLEED_CUT: 4,
        FLIP_OVERRIDE: false, // Desativa o espelhamento automático se TRUE.
        LEFT_OFFSET_X: 0, // Offset X aplicado se FLIP_OVERRIDE for TRUE e estiver virado para a esquerda.
        CUT_ALIGNMENT: 'START', // Posição do corte (START: Esquerda/Cima, END: Direita/Baixo)
    },
    'SLICE_UP': {
        WIDTH: 64,
        HEIGHT: 128,
        OFFSET_X: -32,
        OFFSET_Y: -128,
        BLEED_CUT: 0,
        CUT_ALIGNMENT: 'START', // Posição do corte (START: Esquerda/Cima, END: Direita/Baixo)
    },
    'SLICE_DOWN': {
        WIDTH: 64,
        HEIGHT: 128,
        OFFSET_X: -32,
        OFFSET_Y: -128,
        BLEED_CUT: 4,
        CUT_ALIGNMENT: 'START', // Posição do corte (START: Esquerda/Cima, END: Direita/Baixo)
    },
    // Configurações de FLIP/OFFSET para Walk/Idle Base Sprites
    'IDLE_SIDE': {
        FLIP_OVERRIDE: false,
        LEFT_OFFSET_X: 0,
    },
    'WALK_SIDE': {
        FLIP_OVERRIDE: false,
        LEFT_OFFSET_X: 0,
    },
    // GENERAL - Ajustes Globais e Câmera
    'GENERAL': {
        CAMERA_LERP_ATTACK: 0.25, // Velocidade lerp câmera em ataques (aumente para menos lag/pulinho)
        CAMERA_LERP_IDLE: 0.1, // Lerp em idle/walk
        BAR_WIDTH: 20, // Largura barra vida (fixa)
        BAR_Y_OFFSET: -37, // Posição Y barra (acima body: -SPRITE_HEIGHT - 5, usando 32)
        MIRA_Y_OFFSET: -16 // Posição Y mira (centro base: -SPRITE_HEIGHT / 2, usando 32)
    }
};
// --- CALIBRATION END ---

// inicializa objetos de runtime
let players = {};
let gameMap = [];
let projectiles = [];
let myId = '';
let mapWidthPixels = 0;
let mapHeightPixels = 0;
let cameraX = 0;
let cameraY = 0;
let isDevModeActive = false; // **NOVA VAR: Controla a exibição do delineado**

export function initRenderer(p, gM, proj, id, mw, mh) {
    if (myId !== id && id !== '') {
        console.log('[RENDERER] ID atualizado:', id);
    }
    players = p;
    gameMap = gM;
    projectiles = proj;
    myId = id;
    mapWidthPixels = mw;
    mapHeightPixels = mh;
}

export function getCameraPosition() {
    return { x: cameraX, y: cameraY };
}

// atualiza window.GAME_CALIBRATION para leitura fácil por outros módulos / DevMode
function exposeCalibrationGlobals() {
    window.GAME_CALIBRATION = CALIBRATION_DATA;
    // Expor variáveis gerais para uso mais limpo no código (ex: BAR_WIDTH)
    const general = CALIBRATION_DATA['GENERAL'];
    if (general) {
        for (const k in general) {
            window[k] = general[k];
        }
    }
    // Expor o estado do Dev Mode
    isDevModeActive = !!(window.DEV_MODE_CONFIG && window.DEV_MODE_CONFIG.IS_ACTIVE);
}
exposeCalibrationGlobals();

// escuta DevModeConfigChanged e aplica overrides em runtime
window.addEventListener("DevModeConfigChanged", (ev) => {
    try {
        const o = ev.detail || {};
        if (o.CALIBRATION_DATA) {
             // Atualiza apenas as chaves que foram modificadas
            for (const group in o.CALIBRATION_DATA) {
                if (CALIBRATION_DATA[group]) {
                    Object.assign(CALIBRATION_DATA[group], o.CALIBRATION_DATA[group]);
                } else {
                    // Adiciona novos grupos se ainda não existirem (ex: IDLE_SIDE/WALK_SIDE)
                    CALIBRATION_DATA[group] = o.CALIBRATION_DATA[group];
                }
            }
        }
        if (o.IS_ACTIVE !== undefined) {
            isDevModeActive = o.IS_ACTIVE; // **APLICAÇÃO DO ESTADO DEV MODE**
        }

        exposeCalibrationGlobals();
        // opcional: console log pra confirmar
        // console.log('DevMode update', window.GAME_CALIBRATION);
    } catch (err) {
        console.warn('Error applying DevMode overrides', err);
    }
});

// Config dinâmica com dims reais dos frames (usa vars de calibração)
function getAnimationConfig(player, aimAngle = 0) {
    const state = player.state || 'idle';
    const direction = player.direction || 'down';
    let imgKey, frameKey, w, h, offsetX, offsetY, flip, bleedCut;
    let cutAlignment = 'START'; // Default

    if (state === 'pierce' || state === 'slice') {
        const attackType = state === 'pierce' ? 'PIERCE' : 'SLICE';
        const absCos = Math.abs(Math.cos(aimAngle));
        const absSin = Math.abs(Math.sin(aimAngle));
        
        let configKey;
        if (absSin > absCos) { // Vertical Attack
            const vDir = Math.sin(aimAngle) > 0 ? 'DOWN' : 'UP';
            configKey = `${attackType}_${vDir}`;
            imgKey = `${attackType.charAt(0).toUpperCase() + attackType.slice(1).toLowerCase()}_${vDir.charAt(0).toUpperCase() + vDir.slice(1).toLowerCase()}`;
        } else { // Side Attack
            configKey = `${attackType}_SIDE`;
            imgKey = `${attackType.charAt(0).toUpperCase() + attackType.slice(1).toLowerCase()}_Side`;
        }

        const config = CALIBRATION_DATA[configKey] || {};

        frameKey = configKey;
        w = config.WIDTH || 64;
        h = config.HEIGHT || 64;
        bleedCut = config.BLEED_CUT || 0;
        cutAlignment = config.CUT_ALIGNMENT || 'START';

        // Lógica de FLIP e OFFSET X
        const flipOverride = config.FLIP_OVERRIDE === true;
        const leftOffsetX = config.LEFT_OFFSET_X || 0;
        const facingLeft = Math.cos(aimAngle) < 0;

        if (configKey.includes('_SIDE')) {
            if (flipOverride) {
                // Desativa espelhamento automático, usa offset para left
                flip = false;
                if (facingLeft) {
                    offsetX = (config.OFFSET_X || -w / 2) + leftOffsetX;
                } else {
                    offsetX = config.OFFSET_X || -w / 2;
                }
            } else {
                // Usa espelhamento automático (o que o usuário diz que não funciona, mas é o padrão)
                flip = facingLeft;
                offsetX = config.OFFSET_X || -w / 2;
            }
        } else {
            // UP/DOWN attacks: no flip
            flip = false;
            offsetX = config.OFFSET_X || -w / 2;
        }
        
        offsetY = config.OFFSET_Y || -h;

    } else {
        // Walk/idle: dims originais
        const animName = state === 'walk' ? 'Walk' : 'Idle';
        const dirName = direction === 'side_right' || direction === 'side_left' ? 'Side' : direction.charAt(0).toUpperCase() + direction.slice(1);
        imgKey = `${animName}_${dirName}`;
        frameKey = `${state.toUpperCase()}_${dirName.toUpperCase().replace('SIDE_', 'SIDE')}`;
        w = SPRITE_WIDTH;
        h = SPRITE_HEIGHT;
        offsetY = -h;
        bleedCut = 0; // Não usado em base
        cutAlignment = 'START'; // Default para base sprites

        // Lógica de FLIP e OFFSET X para base
        const isSide = direction === 'side_right' || direction === 'side_left';
        const sideConfig = CALIBRATION_DATA[frameKey] || {}; // Usa o config (se existir)
        
        const flipOverride = sideConfig.FLIP_OVERRIDE === true;
        const leftOffsetX = sideConfig.LEFT_OFFSET_X || 0;
        
        flip = direction === 'side_left'; // flip automático
        offsetX = -w / 2; // offsetX padrão

        if (isSide && flipOverride) {
            // Desativa espelhamento automático, usa offset para left
            flip = false;
            if (direction === 'side_left') {
                offsetX += leftOffsetX;
            }
        }
        // else: usa o flip automático padrão
    }

    return { image: spriteImages[imgKey], frameKey, w, h, offsetX, offsetY, flip, bleedCut, cutAlignment };
}

// Desenha ANIMAÇÃO (ÚLTIMA, ACIMA – PIVOT CORRETO)
function drawAttackAnimation(player, aimAngle) {
    if (player.state !== 'pierce' && player.state !== 'slice') return;

    const config = getAnimationConfig(player, aimAngle);
    const { image, frameKey, w, h, offsetX, offsetY, flip, bleedCut, cutAlignment } = config;

    if (!image || !image.complete) return;

    const frameCoords = SPRITE_FRAMES_DATA[frameKey];
    if (!frameCoords || frameCoords.length === 0) return;

    const [srcX, srcY] = frameCoords[player.frame % frameCoords.length];

    ctx.save();
    
    // Centraliza o desenho para flips laterais, usando as dimensões calibradas
    if (flip && frameKey.includes('_SIDE')) {
        // Assume que só ataques laterais (SIDE) usam flip com BLEED_CUT
        const sourceW = w - bleedCut;
        let sourceSrcX = srcX;

        // Implementa CUT_ALIGNMENT para o flip lateral (horizontal)
        if (cutAlignment === 'START') { // Corta do lado 'START' (Esquerda do source)
            sourceSrcX = srcX + bleedCut;
        } 
        // Se 'END', sourceSrcX permanece srcX (corta da Direita)
        
        // Ponto de pivô para o flip é o centro horizontal da imagem
        const centerX = offsetX + w / 2;
        const centerY = offsetY + h / 2;

        ctx.translate(centerX, centerY);
        ctx.scale(-1, 1);
        // Desenha a partir do centro do contexto traduzido
        ctx.drawImage(image, sourceSrcX, srcY, sourceW, h, -w / 2, -h / 2, w, h);
        
    } else if (bleedCut > 0 && (frameKey.includes('_DOWN') || frameKey.includes('_UP') || frameKey.includes('_SIDE'))) {
        // Corte calibrado para vertical (up/down) ou lateral sem flip

        let sourceW = w;
        let sourceH = h;
        let sourceSrcX = srcX;
        let sourceSrcY = srcY;
        
        if (frameKey.includes('_SIDE')) {
            // Horizontal cut without flip
            sourceW = w - bleedCut;
            if (cutAlignment === 'START') { // Corta da esquerda
                sourceSrcX = srcX + bleedCut;
            } // Se 'END', corta da direita (sourceSrcX = srcX)
            
        } else { // Vertical cut (UP/DOWN)
            sourceH = h - bleedCut;
            if (cutAlignment === 'START') { // Corta de 'START' (Top)
                sourceSrcY = srcY + bleedCut;
            } // Se 'END', corta de 'END' (Bottom) (sourceSrcY = srcY)
        }

        ctx.drawImage(image, sourceSrcX, sourceSrcY, sourceW, sourceH, offsetX, offsetY, w, h);

    } else {
        // Full draw (ou padrão sem corte/flip)
        ctx.drawImage(image, srcX, srcY, w, h, offsetX, offsetY, w, h);
    }
    ctx.restore();
}

// Desenha BASE (PRIMEIRO, SEM INTERFERIR)
function drawBaseSprite(player) {
    if (player.state === 'pierce' || player.state === 'slice') return; // Skip base durante ataque

    const config = getAnimationConfig(player, 0); // Config de base não usa aimAngle
    const { image, frameKey, w, h, offsetX, offsetY, flip } = config;

    if (!image || !image.complete) return;

    const frameCoords = SPRITE_FRAMES_DATA[frameKey];
    if (!frameCoords || frameCoords.length === 0) return;

    const [srcX, srcY] = frameCoords[player.frame % frameCoords.length];

    ctx.save();
    const centerX = offsetX + w / 2; // Centralizado horizontalmente
    const centerY = offsetY + h / 2; // Centro da altura da base

    if (flip) {
        ctx.translate(centerX, centerY);
        ctx.scale(-1, 1);
        ctx.drawImage(image, srcX, srcY, w, h, -w / 2, -h / 2, w, h);
    } else {
        ctx.drawImage(image, srcX, srcY, w, h, offsetX, offsetY, w, h);
    }
    ctx.restore();
}

function drawMap() {
    if (gameMap.length > 0) {
        for (let y = 0; y < gameMap.length; y++) {
            for (let x = 0; x < gameMap[y].length; x++) {
                const tileType = gameMap[y][x];
                ctx.fillStyle = tileType === 0 ? '#ADD8E6' : '#8B4513';
                ctx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
            }
        }
    }
}

function drawProjectiles() {
    for (const proj of projectiles) {
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function drawPlayers() {
    // Busca os valores gerais para evitar erro de referência
    const general = CALIBRATION_DATA['GENERAL'] || {};
    const BAR_WIDTH = general.BAR_WIDTH || 20;
    const BAR_Y_OFFSET = general.BAR_Y_OFFSET || -37;
    const MIRA_Y_OFFSET = general.MIRA_Y_OFFSET || -16;
    
    for (const id in players) {
        const player = players[id];
        const aimAngle = player.aimAngle || localAimAngle || 0;
        const config = getAnimationConfig(player, aimAngle);
        const { w: visualW, h: visualH, offsetX: visualOffsetX, offsetY: visualOffsetY } = config; // Usa os offsets calculados (que podem ter LEFT_OFFSET_X)

        ctx.save();
        ctx.translate(player.x, player.y);

        // BASE PRIMEIRO (idle/walk)
        drawBaseSprite(player);

        // ANIMAÇÃO DE ATAQUE ÚLTIMA (acima, sem corte)
        drawAttackAnimation(player, aimAngle);
        
        // --- VISUALIZAÇÃO DE BOUNDARIES CALIBRADAS (APENAS PARA DEV MODE) ---
        if (isDevModeActive) { 
            // Linhas de calibração em tempo real
            ctx.strokeStyle = '#f0f'; // Cor para visualização (magenta)
            ctx.lineWidth = 1;
            ctx.strokeRect(visualOffsetX, visualOffsetY, visualW, visualH);
        }
        // --- FIM VISUALIZAÇÃO DE BOUNDARIES ---

        // FLASH SOBRE ANIMAÇÃO (fixo em base para evitar pulo)
        if (player.flashRedUntil && Date.now() < player.flashRedUntil) {
            const baseOffsetX = -SPRITE_WIDTH / 2;
            const baseOffsetY = -SPRITE_HEIGHT;
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fillRect(baseOffsetX, baseOffsetY, SPRITE_WIDTH, SPRITE_HEIGHT);
        }

        // BARRA ACIMA DA ANIMAÇÃO (calibrada)
        ctx.fillStyle = 'red';
        ctx.fillRect(-BAR_WIDTH / 2, BAR_Y_OFFSET, BAR_WIDTH, 3);
        ctx.fillStyle = 'lime';
        ctx.fillRect(-BAR_WIDTH / 2, BAR_Y_OFFSET, (player.health / 100) * BAR_WIDTH, 3);

        // NOME ABAIXO
        ctx.fillStyle = id === myId ? '#FFFF00' : '#FFFFFF';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.name || '...', 0, 10);

        ctx.restore();

        // MIRA ACIMA (calibrada em base)
        if (id === myId) {
            ctx.save();
            ctx.translate(player.x, player.y + MIRA_Y_OFFSET);
            ctx.rotate(aimAngle);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(20, 0);
            ctx.stroke();
            ctx.restore();
        }
    }
}

export function renderGame() {
    const myPlayer = players[myId];
    if (myPlayer) {
        const general = CALIBRATION_DATA['GENERAL'] || {};
        const CAMERA_LERP_ATTACK = general.CAMERA_LERP_ATTACK || 0.25;
        const CAMERA_LERP_IDLE = general.CAMERA_LERP_IDLE || 0.1;

        const baseCenterOffsetY = -SPRITE_HEIGHT / 2; // Fixo base
        let targetX = myPlayer.x - CANVAS_WIDTH / 2;
        let targetY = myPlayer.y + baseCenterOffsetY - CANVAS_HEIGHT / 2;

        targetX = Math.max(0, Math.min(targetX, mapWidthPixels - CANVAS_WIDTH));
        targetY = Math.max(0, Math.min(targetY, mapHeightPixels - CANVAS_HEIGHT));

        // Lerp calibrado
        const lerpSpeed = (myPlayer.state === 'pierce' || myPlayer.state === 'slice') ? CAMERA_LERP_ATTACK : CAMERA_LERP_IDLE;
        cameraX += (targetX - cameraX) * lerpSpeed;
        cameraY += (targetY - cameraY) * lerpSpeed;
    }

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    drawMap();
    drawProjectiles();
    drawPlayers();

    ctx.restore();
}