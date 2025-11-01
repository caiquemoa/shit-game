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
let SIDE_WIDTH = 64; // Largura do frame side (ajuste se overdraw/ghost; default match sheet)
let SIDE_HEIGHT = 64; // Altura side (quadrado; aumente para mais protrusão braço)
let SIDE_OFFSET_Y = -64; // Offset Y side (centraliza no pivô; tweak se desalinhado)
let VERTICAL_WIDTH = 64; // Largura vertical (geralmente match side)
let VERTICAL_HEIGHT = 128; // Altura vertical (protrusão espada; diminua se overdraw legs)
let VERTICAL_BODY_OFFSET_X = 0; // **NOVA VAR** Offset X vertical (move body horizontalmente em ataques up/down; default 0)
let VERTICAL_BODY_OFFSET_Y = -64; // Offset Y vertical (alinha body à base/idle; ajuste para "entre barra/nome")
let BLEED_CUT_SIDE = 4; // Corte width no flip side (aumente para 6-8 se perninha persiste)
let BLEED_CUT_VERTICAL_DOWN = 4; // Corte height bottom em down (se legs duplicadas; 0 se clean)
let CAMERA_LERP_ATTACK = 0.25; // Velocidade lerp câmera em ataques (aumente para menos lag/pulinho)
let CAMERA_LERP_IDLE = 0.1; // Lerp em idle/walk
let BAR_WIDTH = 20; // Largura barra vida (fixa)
let BAR_Y_OFFSET = -34; // Posição Y barra (acima body)
let MIRA_Y_OFFSET = -32; // Posição Y mira (centro base; +5 se quiser mais up)
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
    window.GAME_CALIBRATION = {
        SIDE_WIDTH,
        SIDE_HEIGHT,
        SIDE_OFFSET_Y,
        VERTICAL_WIDTH,
        VERTICAL_HEIGHT,
        VERTICAL_BODY_OFFSET_X, // **NOVO**
        VERTICAL_BODY_OFFSET_Y,
        BLEED_CUT_SIDE,
        BLEED_CUT_VERTICAL_DOWN,
        CAMERA_LERP_ATTACK,
        CAMERA_LERP_IDLE,
        BAR_WIDTH,
        BAR_Y_OFFSET,
        MIRA_Y_OFFSET
    };
    // tambem expõe variaveis individuais para compatibilidade com código antigo
    for (const k in window.GAME_CALIBRATION) {
        window[k] = window.GAME_CALIBRATION[k];
    }
}
exposeCalibrationGlobals();

// escuta DevModeConfigChanged e aplica overrides em runtime
window.addEventListener("DevModeConfigChanged", (ev) => {
    try {
        const o = ev.detail || {};
        if (o.SIDE_WIDTH !== undefined) SIDE_WIDTH = Number(o.SIDE_WIDTH);
        if (o.SIDE_HEIGHT !== undefined) SIDE_HEIGHT = Number(o.SIDE_HEIGHT);
        if (o.SIDE_OFFSET_Y !== undefined) SIDE_OFFSET_Y = Number(o.SIDE_OFFSET_Y);
        if (o.VERTICAL_WIDTH !== undefined) VERTICAL_WIDTH = Number(o.VERTICAL_WIDTH);
        if (o.VERTICAL_HEIGHT !== undefined) VERTICAL_HEIGHT = Number(o.VERTICAL_HEIGHT);
        if (o.VERTICAL_BODY_OFFSET_X !== undefined) VERTICAL_BODY_OFFSET_X = Number(o.VERTICAL_BODY_OFFSET_X); // **APLICAÇÃO**
        if (o.VERTICAL_BODY_OFFSET_Y !== undefined) VERTICAL_BODY_OFFSET_Y = Number(o.VERTICAL_BODY_OFFSET_Y);
        if (o.BLEED_CUT_SIDE !== undefined) BLEED_CUT_SIDE = Number(o.BLEED_CUT_SIDE);
        if (o.BLEED_CUT_VERTICAL_DOWN !== undefined) BLEED_CUT_VERTICAL_DOWN = Number(o.BLEED_CUT_VERTICAL_DOWN);
        if (o.CAMERA_LERP_ATTACK !== undefined) CAMERA_LERP_ATTACK = Number(o.CAMERA_LERP_ATTACK);
        if (o.CAMERA_LERP_IDLE !== undefined) CAMERA_LERP_IDLE = Number(o.CAMERA_LERP_IDLE);
        if (o.BAR_WIDTH !== undefined) BAR_WIDTH = Number(o.BAR_WIDTH);
        if (o.BAR_Y_OFFSET !== undefined) BAR_Y_OFFSET = Number(o.BAR_Y_OFFSET);
        if (o.MIRA_Y_OFFSET !== undefined) MIRA_Y_OFFSET = Number(o.MIRA_Y_OFFSET);

        exposeCalibrationGlobals();
        // opcional: console log pra confirmar
        console.log('DevMode update', window.GAME_CALIBRATION);
    } catch (err) {
        console.warn('Error applying DevMode overrides', err);
    }
});

// Config dinâmica com dims reais dos frames (usa vars de calibração)
function getAnimationConfig(player, aimAngle = 0) {
    const state = player.state || 'idle';
    const direction = player.direction || 'down';
    let imgKey, frameKey, w, h, offsetX, offsetY, flip;

    if (state === 'pierce' || state === 'slice') {
        const attackType = state === 'pierce' ? 'Pierce' : 'Slice';
        const absCos = Math.abs(Math.cos(aimAngle));
        const absSin = Math.abs(Math.sin(aimAngle));
        if (absSin > absCos) {
            const vDir = Math.sin(aimAngle) > 0 ? 'Down' : 'Up';
            imgKey = `${attackType}_${vDir}`;
            frameKey = `${attackType.toUpperCase()}_${vDir.toUpperCase()}`;
            w = VERTICAL_WIDTH;
            h = VERTICAL_HEIGHT;
            offsetX = VERTICAL_BODY_OFFSET_X - w / 2; // **USO DO X OFFSET**
            offsetY = VERTICAL_BODY_OFFSET_Y; // Calibrado para body no slot
        } else {
            imgKey = `${attackType}_Side`;
            frameKey = `${attackType.toUpperCase()}_SIDE`;
            w = SIDE_WIDTH;
            h = SIDE_HEIGHT;
            flip = Math.cos(aimAngle) < 0;
            offsetX = -w / 2;
            offsetY = SIDE_OFFSET_Y;
        }
    } else {
        // Walk/idle: dims originais (não calibradas, mas pode adicionar se quiser)
        const animName = state === 'walk' ? 'Walk' : 'Idle';
        const dirName = direction === 'side_right' || direction === 'side_left' ? 'Side' : direction.charAt(0).toUpperCase() + direction.slice(1);
        imgKey = `${animName}_${dirName}`;
        frameKey = `${state.toUpperCase()}_${dirName.toUpperCase().replace('SIDE_', 'SIDE')}`;
        w = SPRITE_WIDTH; // 16 original (de config.js)
        h = SPRITE_HEIGHT; // 32 (de config.js)
        offsetX = -w / 2;
        offsetY = -h;
        flip = direction === 'side_left';
    }

    return { image: spriteImages[imgKey], frameKey, w, h, offsetX, offsetY, flip };
}

// Desenha ANIMAÇÃO (ÚLTIMA, ACIMA – PIVOT CORRETO)
function drawAttackAnimation(player, aimAngle) {
    if (player.state !== 'pierce' && player.state !== 'slice') return;

    const config = getAnimationConfig(player, aimAngle);
    const { image, frameKey, w, h, offsetX, offsetY, flip } = config;

    if (!image || !image.complete) return;

    const frameCoords = SPRITE_FRAMES_DATA[frameKey];
    if (!frameCoords || frameCoords.length === 0) return;

    const [srcX, srcY] = frameCoords[player.frame % frameCoords.length];

    ctx.save();
    const isVerticalAttack = frameKey.includes('_UP') || frameKey.includes('_DOWN');
    const isSideAttack = frameKey.includes('_SIDE');

    // Centraliza o desenho para flips laterais, usando as dimensões calibradas
    if (flip && isSideAttack) {
        const sourceW = w - BLEED_CUT_SIDE;
        const sourceSrcX = srcX + BLEED_CUT_SIDE;
        // Ponto de pivô para o flip lateral é o centro horizontal da imagem calibrada, na altura do offsetY + metade da altura calibrada
        const centerX = 0; // Onde o corpo deveria estar horizontalmente
        const centerY = offsetY + h / 2; // Onde o centro da imagem calibrada está verticalmente

        ctx.translate(centerX, centerY);
        ctx.scale(-1, 1);
        ctx.drawImage(image, sourceSrcX, srcY, sourceW, h, -w / 2, -h / 2, w, h);
    } else if (frameKey.includes('_DOWN')) {
        // Corte calibrado para down
        const sourceH = h - BLEED_CUT_VERTICAL_DOWN;
        const sourceSrcY = srcY + BLEED_CUT_VERTICAL_DOWN;
        ctx.drawImage(image, srcX, sourceSrcY, w, sourceH, offsetX, offsetY, w, h);
    } else {
        // Up ou non-flip: full draw
        if (flip) { // Flip vertical (Up) não é usual, mas mantemos o código base
            const centerX = 0;
            const centerY = offsetY + h / 2;
            ctx.translate(centerX, centerY);
            ctx.scale(-1, 1);
            ctx.drawImage(image, srcX, srcY, w, h, -w / 2, -h / 2, w, h);
        } else {
            ctx.drawImage(image, srcX, srcY, w, h, offsetX, offsetY, w, h);
        }
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
    // Apenas para Idle/Walk, usamos os offsets de sprite fixos (config.js)
    // Se quiser aplicar VERTICAL_BODY_OFFSET_X ou Y para base, o lugar seria aqui
    // Por enquanto, mantenho o offsetX/Y padrão para idle/walk, que é -SPRITE_WIDTH/2 e -SPRITE_HEIGHT
    const centerX = 0;
    const centerY = offsetY + h / 2;

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
    for (const id in players) {
        const player = players[id];
        const aimAngle = player.aimAngle || localAimAngle || 0;
        const config = getAnimationConfig(player, aimAngle);

        ctx.save();
        ctx.translate(player.x, player.y);

        // BASE PRIMEIRO (idle/walk)
        drawBaseSprite(player);

        // ANIMAÇÃO DE ATAQUE ÚLTIMA (acima, sem corte)
        drawAttackAnimation(player, aimAngle);
        
        // --- VISUALIZAÇÃO DE BOUNDARIES CALIBRADAS (APENAS PARA DEV MODE) ---
        // Desenha linhas de calibração usando os offsets calibrados
        if (window.GAME_CALIBRATION) {
            const calib = window.GAME_CALIBRATION;
            let visualW, visualH, visualOffsetX, visualOffsetY;

            if (player.state === 'pierce' || player.state === 'slice') {
                const absCos = Math.abs(Math.cos(aimAngle));
                const absSin = Math.abs(Math.sin(aimAngle));
                if (absSin > absCos) { // Vertical Attack
                    visualW = calib.VERTICAL_WIDTH;
                    visualH = calib.VERTICAL_HEIGHT;
                    visualOffsetX = calib.VERTICAL_BODY_OFFSET_X - visualW / 2;
                    visualOffsetY = calib.VERTICAL_BODY_OFFSET_Y;
                } else { // Side Attack
                    visualW = calib.SIDE_WIDTH;
                    visualH = calib.SIDE_HEIGHT;
                    visualOffsetX = -visualW / 2;
                    visualOffsetY = calib.SIDE_OFFSET_Y;
                }
            } else { // Idle/Walk (Base)
                visualW = SPRITE_WIDTH;
                visualH = SPRITE_HEIGHT;
                visualOffsetX = -visualW / 2;
                visualOffsetY = -visualH;
            }

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