// renderer.js
import { 
    ctx, SPRITE_WIDTH, SPRITE_HEIGHT, SPRITE_OFFSET_X, SPRITE_OFFSET_Y, GRID_SIZE, 
    CANVAS_WIDTH, CANVAS_HEIGHT 
} from './config.js';
import { SPRITE_FRAMES_DATA, spriteImages } from './spriteData.js';
import { localAimAngle } from './inputHandler.js'; // Importa a referência da mira

let players = {};
let gameMap = [];
let projectiles = [];
let myId = '';
let mapWidthPixels = 0;
let mapHeightPixels = 0;
let cameraX = 0;
let cameraY = 0;

// Função de inicialização para receber as referências de dados
export function initRenderer(p, gM, proj, id, mw, mh) {
    // [LOG]
    if (myId !== id && id !== '') { // Só loga se o ID for novo e não vazio
        console.log('[RENDERER] Inicializando/Atualizando meu ID para:', id);
    }
    
    players = p;
    gameMap = gM;
    projectiles = proj;
    myId = id;
    mapWidthPixels = mw;
    mapHeightPixels = mh;
}

// Retorna a posição atual da câmera (necessário para o inputHandler)
export function getCameraPosition() {
    return { x: cameraX, y: cameraY };
}

// Função auxiliar para desenhar o sprite de um jogador
function drawPlayerSprite(player) {
    let animationName = '';
    let spriteImage = null;
    let frameDataKey = '';
    let flip = false;
    
    animationName = player.state === 'walk' ? 'Walk' : 'Idle';
    
    // *** Lembrete de Preferência do Usuário ***
    // (Usando os nomes de arquivo corretos para Idle)
    if (player.direction === 'up') {
        spriteImage = player.state === 'walk' ? spriteImages['Walk_Up'] : spriteImages['Idle_Up'];
        frameDataKey = player.state === 'walk' ? 'WALK_UP' : 'IDLE_UP';
    } else if (player.direction === 'down') {
        spriteImage = player.state === 'walk' ? spriteImages['Walk_Down'] : spriteImages['Idle_Down'];
        frameDataKey = player.state === 'walk' ? 'WALK_DOWN' : 'IDLE_DOWN';
    } else if (player.direction === 'side_right' || player.direction === 'side_left') {
        spriteImage = player.state === 'walk' ? spriteImages['Walk_Side'] : spriteImages['Idle_Side'];
        frameDataKey = player.state === 'walk' ? 'WALK_SIDE' : 'IDLE_SIDE';
        flip = (player.direction === 'side_left');
    } else {
        spriteImage = spriteImages['Idle_Down'];
        frameDataKey = 'IDLE_DOWN';
    }
    
    if (!spriteImage || !spriteImage.complete || spriteImage.naturalWidth === 0) {
        // Fallback (bola colorida)
        ctx.fillStyle = player.color; 
        ctx.beginPath();
        ctx.arc(0, -12, 12, 0, Math.PI * 2); 
        ctx.fill();
        return;
    }
    
    const frameCoords = SPRITE_FRAMES_DATA[frameDataKey];
    let srcX = 0;
    let srcY = 0;
    
    if (frameCoords && player.frame < frameCoords.length) {
        [srcX, srcY] = frameCoords[player.frame]; 
    }
    
    const destX = SPRITE_OFFSET_X; 
    const destY = SPRITE_OFFSET_Y; 
    
    ctx.save();
    
    if (flip) {
        ctx.translate(destX + SPRITE_WIDTH, destY);
        ctx.scale(-1, 1);

        ctx.drawImage(
            spriteImage,
            srcX, srcY,
            SPRITE_WIDTH, SPRITE_HEIGHT,
            0, 0, 
            SPRITE_WIDTH, SPRITE_HEIGHT
        );
        
    } else {
        ctx.drawImage(
            spriteImage,
            srcX, srcY,
            SPRITE_WIDTH, SPRITE_HEIGHT,
            destX, destY,
            SPRITE_WIDTH, SPRITE_HEIGHT
        );
    }

    ctx.restore();
}

function drawMap() {
    if (gameMap.length > 0) {
        for (let y = 0; y < gameMap.length; y++) {
            for (let x = 0; x < gameMap[y].length; x++) {
                const tileType = gameMap[y][x];
                
                if (tileType === 0) { ctx.fillStyle = '#ADD8E6'; } 
                else if (tileType === 1) { ctx.fillStyle = '#8B4513'; } 
                
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
        
        ctx.save();
        
        ctx.translate(player.x, player.y);

        const now = Date.now();
        if (player.flashRedUntil && now < player.flashRedUntil) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.beginPath();
            ctx.arc(0, -SPRITE_HEIGHT / 2, SPRITE_WIDTH, 0, Math.PI * 2); 
            ctx.fill();
        }
        
        drawPlayerSprite(player);

        // --- Desenha UI (Barra de Vida e Nome) ---
        const healthBarWidth = 20;
        const healthBarYOffset = -SPRITE_HEIGHT - 5; 

        ctx.fillStyle = 'red';
        ctx.fillRect(-healthBarWidth / 2, healthBarYOffset, healthBarWidth, 3);
        
        const currentHealthWidth = (player.health / 100) * healthBarWidth;
        ctx.fillStyle = 'lime';
        ctx.fillRect(-healthBarWidth / 2, healthBarYOffset, currentHealthWidth, 3);
        
        // --- MODIFICADO: Desenha o NOME ---
        // Define a cor do nome (amarelo para o jogador local, branco para outros)
        ctx.fillStyle = (id === myId) ? '#FFFF00' : '#FFFFFF';
        ctx.font = '10px Arial';
        const label = player.name || '...'; // Usa o nome do jogador
        ctx.textAlign = 'center';
        ctx.fillText(label, 0, 10); // Posição abaixo dos pés
        
        ctx.restore();


        // --- Desenha a Mira (Apenas para o jogador local) ---
        if (id === myId) {
            ctx.save();
            ctx.translate(player.x, player.y - SPRITE_HEIGHT / 2);
            ctx.rotate(localAimAngle);

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


// O Game Loop de Renderização
export function renderGame() {
    // --- Lógica da Câmera (Foco no Jogador Local) ---
    const myPlayer = players[myId];
    
    if (myPlayer) {
        let targetX = myPlayer.x - CANVAS_WIDTH / 2;
        let targetY = (myPlayer.y - SPRITE_HEIGHT / 2) - CANVAS_HEIGHT / 2;
        
        targetX = Math.max(0, Math.min(targetX, mapWidthPixels - CANVAS_WIDTH));
        targetY = Math.max(0, Math.min(targetY, mapHeightPixels - CANVAS_HEIGHT));
        
        if (cameraX === 0 && cameraY === 0) {
            cameraX = targetX;
            cameraY = targetY;
        } else {
            // Suavização da câmera (lerp)
            cameraX += (targetX - cameraX) * 0.1;
            cameraY += (targetY - cameraY) * 0.1;
        }
    }

    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    ctx.save();
    ctx.translate(-cameraX, -cameraY);

    // Chamadas de Desenho Modularizadas
    drawMap();
    drawProjectiles();
    drawPlayers();

    ctx.restore();
}