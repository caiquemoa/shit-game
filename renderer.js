// renderer.js
import { 
    ctx, SPRITE_WIDTH, SPRITE_HEIGHT, GRID_SIZE, 
    CANVAS_WIDTH, CANVAS_HEIGHT 
} from './config.js';
import { SPRITE_FRAMES_DATA, spriteImages } from './spriteData.js';
import { localAimAngle } from './inputHandler.js';

// =========================================
// VARIÁVEIS DE CALIBRAÇÃO (altere aqui para tunar visualmente)
// =========================================
// Side (ataques laterais)
const SIDE_WIDTH = 64; // Largura do frame side (ajuste se overdraw/ghost; default match sheet)
const SIDE_HEIGHT = 64; // Altura side (quadrado; aumente para mais protrusão braço)
const SIDE_OFFSET_Y = -SIDE_HEIGHT; // Offset Y side (centraliza no pivô; tweak se desalinhado)

// Vertical (up/down)
const VERTICAL_WIDTH = 64; // Largura vertical (geralmente match side)
const VERTICAL_HEIGHT = 128; // Altura vertical (protrusão espada; diminua se overdraw legs)
const VERTICAL_BODY_OFFSET_Y = -SPRITE_HEIGHT; // Offset Y vertical (alinha body à base/idle; ajuste para "entre barra/nome")

// Cortes para vazamentos/ghosts (perninha residual)
const BLEED_CUT_SIDE = 4; // Corte width no flip side (aumente para 6-8 se perninha persiste)
const BLEED_CUT_VERTICAL_DOWN = 4; // Corte height bottom em down (se legs duplicadas; 0 se clean)

// Geral
const CAMERA_LERP_ATTACK = 0.25; // Velocidade lerp câmera em ataques (aumente para menos lag/pulinho)
const CAMERA_LERP_IDLE = 0.1; // Lerp em idle/walk
const BAR_WIDTH = 20; // Largura barra vida (fixa)
const BAR_Y_OFFSET = -SPRITE_HEIGHT - 5; // Posição Y barra (acima body)
const MIRA_Y_OFFSET = -SPRITE_HEIGHT / 2; // Posição Y mira (centro base; +5 se quiser mais up)

// =========================================

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
            offsetY = VERTICAL_BODY_OFFSET_Y; // Calibrado para body no slot
        } else {
            imgKey = `${attackType}_Side`;
            frameKey = `${attackType.toUpperCase()}_SIDE`;
            w = SIDE_WIDTH;
            h = SIDE_HEIGHT;
            flip = Math.cos(aimAngle) < 0;
            offsetY = SIDE_OFFSET_Y;
        }
        offsetX = -w / 2;
    } else {
        // Walk/idle: dims originais (não calibradas, mas pode adicionar se quiser)
        const animName = state === 'walk' ? 'Walk' : 'Idle';
        const dirName = direction === 'side_right' || direction === 'side_left' ? 'Side' : direction.charAt(0).toUpperCase() + direction.slice(1);
        imgKey = `${animName}_${dirName}`;
        frameKey = `${state.toUpperCase()}_${dirName.toUpperCase().replace('SIDE_', 'SIDE')}`;
        w = SPRITE_WIDTH; // 36 original
        h = SPRITE_HEIGHT; // 34
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
    const centerX = 0;
    const centerY = offsetY + h / 2;

    if (flip && config.frameKey.includes('_SIDE')) {
        // Corte calibrado para side flip
        const sourceW = w - BLEED_CUT_SIDE;
        const sourceSrcX = srcX + BLEED_CUT_SIDE;
        ctx.translate(centerX, centerY);
        ctx.scale(-1, 1);
        ctx.drawImage(image, sourceSrcX, srcY, sourceW, h, -w / 2, -h / 2, w, h);
    } else if (config.frameKey.includes('_DOWN')) {
        // Corte calibrado para down
        const sourceH = h - BLEED_CUT_VERTICAL_DOWN;
        const sourceSrcY = srcY + BLEED_CUT_VERTICAL_DOWN;
        ctx.drawImage(image, srcX, sourceSrcY, w, sourceH, offsetX, offsetY, w, h);
    } else {
        // Up ou non-flip: full draw
        if (flip) {
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

    const config = getAnimationConfig(player, 0);
    const { image, frameKey, w, h, offsetX, offsetY, flip } = config;

    if (!image || !image.complete) return;

    const frameCoords = SPRITE_FRAMES_DATA[frameKey];
    if (!frameCoords || frameCoords.length === 0) return;

    const [srcX, srcY] = frameCoords[player.frame % frameCoords.length];

    ctx.save();
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