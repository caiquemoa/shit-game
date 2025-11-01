// renderer.js
import { 
    ctx, SPRITE_WIDTH, SPRITE_HEIGHT, GRID_SIZE, 
    CANVAS_WIDTH, CANVAS_HEIGHT 
} from './config.js';
import { SPRITE_FRAMES_DATA, spriteImages } from './spriteData.js';
import { localAimAngle } from './inputHandler.js';

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

// Config dinâmica com dims reais dos frames (sem resize global)
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
            w = 64; // Dims reais vertical (de coords ~64 larg)
            h = 128; // Altura maior
        } else {
            imgKey = `${attackType}_Side`;
            frameKey = `${attackType.toUpperCase()}_SIDE`;
            w = 64; // Corrigido: Match frame sheet size (64px para evitar overdraw/duplicata)
            h = 64; // Quadrado para side; flip cuida da direção
            flip = Math.cos(aimAngle) < 0;
        }
        offsetX = -w / 2; // Centralizado sempre; pivô cuida do flip sem deslocamento
        offsetY = -h;
    } else {
        // Walk/idle: dims originais
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

    if (flip) {
        // PIVOT NO CENTRO REAL (sem distortion); sem corte bleed (não necessário com dims corretas)
        ctx.translate(centerX, centerY);
        ctx.scale(-1, 1);
        ctx.drawImage(image, srcX, srcY, w, h, -w / 2, -h / 2, w, h);
    } else {
        ctx.drawImage(image, srcX, srcY, w, h, offsetX, offsetY, w, h);
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

        // FLASH SOBRE ANIMAÇÃO (usa config attack para cobrir área maior se vertical)
        if (player.flashRedUntil && Date.now() < player.flashRedUntil) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.fillRect(config.offsetX, config.offsetY, config.w, config.h);
        }

        // BARRA ACIMA DA ANIMAÇÃO (fixa em base para evitar distorção/dobro de tamanho)
        const barW = 20; // Fixo, independente de w attack
        const barY = -SPRITE_HEIGHT - 5; // Posição base (acima da idle)
        ctx.fillStyle = 'red';
        ctx.fillRect(-barW / 2, barY, barW, 3);
        ctx.fillStyle = 'lime';
        ctx.fillRect(-barW / 2, barY, (player.health / 100) * barW, 3);

        // NOME ABAIXO
        ctx.fillStyle = id === myId ? '#FFFF00' : '#FFFFFF';
        ctx.font = '10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(player.name || '...', 0, 10);

        ctx.restore();

        // MIRA ACIMA
        if (id === myId) {
            ctx.save();
            ctx.translate(player.x, player.y + config.offsetY + config.h / 2);
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
        const baseCenterOffsetY = -SPRITE_HEIGHT / 2; // Sempre segue centro da base (evita pulo)
        let targetX = myPlayer.x - CANVAS_WIDTH / 2;
        let targetY = myPlayer.y + baseCenterOffsetY - CANVAS_HEIGHT / 2;

        targetX = Math.max(0, Math.min(targetX, mapWidthPixels - CANVAS_WIDTH));
        targetY = Math.max(0, Math.min(targetY, mapHeightPixels - CANVAS_HEIGHT));

        // Lerp dinâmico: mais rápido em ataques
        const lerpSpeed = (myPlayer.state === 'pierce' || myPlayer.state === 'slice') ? 0.25 : 0.1;
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