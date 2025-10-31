// game.js

// Conecta ao nosso servidor
const socket = io();

// Configuração do Canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const CANVAS_WIDTH = canvas.width;
const CANVAS_HEIGHT = canvas.height;

// --- Configurações do Jogo ---
const GRID_SIZE = 32;   

// --- Configurações de Sprite (ATUALIZADO PARA 16x34) ---
const SPRITE_WIDTH = 16;
const SPRITE_HEIGHT = 34; // <--- ATUALIZADO

// CORREÇÃO DE POSICIONAMENTO:
// (0, 0) no contexto transladado (player.x, player.y) é os PÉS.
const SPRITE_OFFSET_X = -SPRITE_WIDTH / 2; // -8 pixels (Centralizado Horizontalmente)
const SPRITE_OFFSET_Y = -SPRITE_HEIGHT; // -34 pixels (Desenha para cima, a partir dos pés)

// Armazenamento local
let myId = '';
let players = {};
let gameMap = [];
let projectiles = [];
let localAimAngle = 0; 
let mapWidthPixels = 0;
let mapHeightPixels = 0;

// Câmera
let cameraX = 0; 
let cameraY = 0; 

let inputState = { 
    ArrowUp: false, 
    ArrowDown: false, 
    ArrowLeft: false, 
    ArrowRight: false
};

const keyMap = {
    'w': 'ArrowUp', 'W': 'ArrowUp',
    's': 'ArrowDown', 'S': 'ArrowDown',
    'a': 'ArrowLeft', 'A': 'ArrowLeft',
    'd': 'ArrowRight', 'D': 'ArrowRight'
};

// --- Dicionário de Frames Calibrados ---
// **ATENÇÃO: SUBSTITUA ESTES VALORES PELOS SEUS VALORES FINAIS CALIBRADOS!**
const SPRITE_FRAMES_DATA = {
    // 6 frames de caminhada
    'WALK_DOWN': [
        [24, 17], [88, 17], [152, 17], [216, 17], [280, 17], [344, 17] // WALK_DOWN (Valores sugeridos)
    ],
    'WALK_UP': [
        [24, 17], [88, 17], [152, 17], [216, 17], [280, 17], [344, 17] // WALK_UP (Placeholder)
    ],
    'WALK_SIDE': [
        [24, 17], [88, 17], [152, 17], [216, 17], [280, 17], [344, 17] // WALK_SIDE (Placeholder)
    ],
    // 4 frames de idle
    'IDLE_UP': [
        [24, 17], [88, 17], [152, 17], [216, 17] // IDLE_UP (Placeholder)
    ],
    'IDLE_DOWN': [
        [24, 17], [88, 17], [152, 17], [216, 17] // IDLE_DOWN (Placeholder)
    ],
    'IDLE_SIDE': [
        [24, 17], [88, 17], [152, 17], [216, 17] // IDLE_SIDE (Placeholder)
    ],
};


// --- Carregamento das Sprites (NOVAS SPRITES DE IDLE) ---
const spriteImages = {
    'Walk_Up': new Image(),
    'Walk_Down': new Image(),
    'Walk_Side': new Image(),
    'Idle_Up': new Image(), // <--- NOVO
    'Idle_Down': new Image(), // <--- NOVO
    'Idle_Side': new Image(), // <--- NOVO
};

// Define os caminhos dos arquivos
spriteImages['Walk_Up'].src = 'Walk_Up-Sheet.png';
spriteImages['Walk_Down'].src = 'Walk_Down-Sheet.png';
spriteImages['Walk_Side'].src = 'Walk_Side-Sheet.png';
spriteImages['Idle_Up'].src = 'Idle_Up-Sheet.png'; // <--- NOVO
spriteImages['Idle_Down'].src = 'Idle_Down-Sheet.png'; // <--- NOVO
spriteImages['Idle_Side'].src = 'Idle_Side-Sheet.png'; // <--- NOVO

// 1. Recebe a atualização de estado do servidor
socket.on('gameStateUpdate', (data) => {
    players = data.players;
    gameMap = data.map;
    projectiles = data.projectiles || [];
    mapWidthPixels = data.mapWidth;
    mapHeightPixels = data.mapHeight;
});

// 2. Recebe o ID na conexão inicial
socket.on('connect', () => {
    myId = socket.id;
    console.log(`Conectado com ID: ${myId}`);
});

// Game Over
socket.on('gameOver', () => {
    alert('Você morreu! Recarregue a página para jogar novamente.');
});

// Função para desenhar o sprite correto (LÓGICA DE CALIBRAÇÃO IMPLEMENTADA)
function drawPlayerSprite(player) {
    let animationName = '';
    let spriteImage = null;
    let frameDataKey = '';
    let flip = false;
    
    // 1. Determina o nome base da animação
    if (player.state === 'walk') { 
        animationName = 'Walk'; 
    } else { 
        // Assumindo que 'idle' é o estado padrão não-walk
        animationName = 'Idle'; 
    }
    
    // 2. Determina a direção, a imagem e a chave do dicionário
    if (player.direction === 'up') {
        spriteImage = spriteImages[`${animationName}_Up`];
        frameDataKey = `${animationName.toUpperCase()}_UP`;
    } else if (player.direction === 'down') {
        spriteImage = spriteImages[`${animationName}_Down`];
        frameDataKey = `${animationName.toUpperCase()}_DOWN`;
    } else if (player.direction === 'side_right' || player.direction === 'side_left') {
        spriteImage = spriteImages[`${animationName}_Side`];
        frameDataKey = `${animationName.toUpperCase()}_SIDE`;
        flip = (player.direction === 'side_left'); // Inverte para o lado esquerdo
    } else {
        // Fallback: Idle Down
        spriteImage = spriteImages['Idle_Down'];
        frameDataKey = 'IDLE_DOWN';
    }
    
    // 3. Fallback: Desenha um círculo se o sprite não carregar
    if (!spriteImage || !spriteImage.complete || spriteImage.naturalWidth === 0) {
        ctx.fillStyle = player.color;
        ctx.beginPath();
        ctx.arc(0, -12, 12, 0, Math.PI * 2); 
        ctx.fill();
        return;
    }
    
    // 4. Obtém o frame calibrado do dicionário
    const frameCoords = SPRITE_FRAMES_DATA[frameDataKey];
    
    if (!frameCoords || player.frame >= frameCoords.length) {
        // Se a chave não existir ou o frame for inválido, use 0
        const srcX = 0; 
        const srcY = 0;
    } else {
        var [srcX, srcY] = frameCoords[player.frame]; // <--- PEGANDO COORDENADAS CALIBRADAS
    }

    // 5. Calcula as posições de destino no canvas
    const destX = SPRITE_OFFSET_X; 
    const destY = SPRITE_OFFSET_Y; 
    
    ctx.save();
    
    // 6. Lógica de inversão (Espelhamento Horizontal)
    if (flip) {
        // Move a origem para a posição correta (destX) e espelha.
        // O ponto de destino deve ser ajustado para -SPRITE_WIDTH.
        ctx.translate(destX + SPRITE_WIDTH, destY);
        ctx.scale(-1, 1);

        // Desenha a partir da nova origem (0, 0) que agora está no canto direito
        ctx.drawImage(
            spriteImage,
            srcX, srcY,
            SPRITE_WIDTH, SPRITE_HEIGHT,
            0, 0, // Início do desenho é (0,0) no contexto transformado
            SPRITE_WIDTH, SPRITE_HEIGHT
        );
        
    } else {
        // Desenho normal (sem inversão)
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

// 3. Lógica de Desenho (O "Game Loop" do Cliente)
function drawGame() {
    
    // --- Lógica da Câmera (Foco no Jogador Local) ---
    const myPlayer = players[myId];
    
    if (myPlayer) {
        // 1. Calcula a posição desejada da câmera
        // O centro do canvas foca no CENTRO VISUAL do jogador (Pés - Metade da Altura)
        let targetX = myPlayer.x - CANVAS_WIDTH / 2;
        let targetY = (myPlayer.y - SPRITE_HEIGHT / 2) - CANVAS_HEIGHT / 2; // <--- ATUALIZADO

        // 2. Limita a câmera
        targetX = Math.max(0, Math.min(targetX, mapWidthPixels - CANVAS_WIDTH));
        targetY = Math.max(0, Math.min(targetY, mapHeightPixels - CANVAS_HEIGHT));
        
        // 3. Suaviza o movimento da câmera 
        if (cameraX === 0 && cameraY === 0) {
            cameraX = targetX;
            cameraY = targetY;
        } else {
            cameraX += (targetX - cameraX) * 0.1;
            cameraY += (targetY - cameraY) * 0.1;
        }
    }

    // Limpa o canvas
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

    // Salva o contexto antes de aplicar a transformação da câmera
    ctx.save();
    
    // Aplica a câmera
    ctx.translate(-cameraX, -cameraY);

    // --- Desenha o MAPA ---
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

    // --- Desenha os Projéteis ---
    for (const proj of projectiles) {
        ctx.fillStyle = '#FFD700'; 
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Desenha os Jogadores ---
    for (const id in players) {
        const player = players[id];
        
        ctx.save();
        
        // Move o contexto para a posição dos PÉS do jogador
        ctx.translate(player.x, player.y);

        // Efeito de Dano (Flash Vermelho)
        const now = Date.now();
        if (player.flashRedUntil && now < player.flashRedUntil) {
            ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
            ctx.beginPath();
            // Desenha o flash no centro visual
            ctx.arc(0, -SPRITE_HEIGHT / 2, SPRITE_WIDTH, 0, Math.PI * 2); // <--- ATUALIZADO
            ctx.fill();
        }
        
        // Desenha o Sprite do Jogador (corrigido para alinhamento)
        drawPlayerSprite(player);

        // --- Desenha UI (Barra de Vida e Nome) - CORRIGIDO ---
        const healthBarWidth = 20;
        const healthBarYOffset = -SPRITE_HEIGHT - 5; // 5px acima da cabeça

        // Fundo da barra de vida
        ctx.fillStyle = 'red';
        ctx.fillRect(-healthBarWidth / 2, healthBarYOffset, healthBarWidth, 3);
        
        // Nível de vida atual
        const currentHealthWidth = (player.health / 100) * healthBarWidth;
        ctx.fillStyle = 'lime';
        ctx.fillRect(-healthBarWidth / 2, healthBarYOffset, currentHealthWidth, 3);
        
        // Nome do Jogador (Abaixo dos pés)
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        const label = id === myId ? 'EU' : id.substring(0, 4);
        ctx.textAlign = 'center';
        ctx.fillText(label, 0, 10); // 10px abaixo dos pés (Y=0)
        
        ctx.restore();


        // --- Desenha a Mira (Apenas para o jogador local) ---
        if (id === myId) {
            ctx.save();
            // A mira gira em torno do CENTRO VISUAL, não dos pés
            ctx.translate(player.x, player.y - SPRITE_HEIGHT / 2); // <--- ATUALIZADO
            ctx.rotate(localAimAngle);

            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(0, 0); // Começa no centro visual
            ctx.lineTo(20, 0); 
            ctx.stroke();

            ctx.restore();
        }
    }

    // Restaura a transformação da câmera
    ctx.restore();

    // Continua o loop
    requestAnimationFrame(drawGame);
}

// Inicia o loop de desenho
requestAnimationFrame(drawGame);


// 4. Lógica de Input (Envio do Estado do Teclado)
function sendInput() {
    socket.emit('input', { 
        keys: inputState
    });
}

// 5. Tratamento de Eventos de Teclado (Movimento)
document.addEventListener('keydown', (event) => {
    let key = keyMap[event.key];
    if (key && !inputState[key]) {
        inputState[key] = true;
        sendInput(); 
    }
});

document.addEventListener('keyup', (event) => {
    let key = keyMap[event.key];
    if (key && inputState[key]) {
        inputState[key] = false;
        sendInput(); 
    }
});

// 6. Novos Eventos de Mouse (Mira e Tiro)
canvas.addEventListener('mousemove', (event) => {
    if (!players[myId]) return; 

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left + cameraX;
    const mouseY = event.clientY - rect.top + cameraY;

    const myPlayer = players[myId];
    
    // O ângulo é calculado do CENTRO VISUAL do jogador
    const angle = Math.atan2(mouseY - (myPlayer.y - SPRITE_HEIGHT / 2), mouseX - myPlayer.x);
    
    localAimAngle = angle; 
    
    socket.emit('aimUpdate', { angle: angle });
});

// Tiro (mousedown)
canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
        socket.emit('shoot');
    }
});

// Prevenir menu de contexto (clique direito) no canvas
canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});