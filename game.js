// Conecta ao nosso servidor
const socket = io();

// Configuração do Canvas (nosso mapa)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Novas Configurações do Grid (DEVE ser as mesmas do servidor) ---
const GRID_SIZE = 32; // Tamanho de cada tile em pixels
const PLAYER_SIZE = GRID_SIZE; // Jogador ocupa um tile inteiro

// Armazenamento local
let myId = '';
let players = {};
let gameMap = []; // O cliente agora também mantém o mapa
let projectiles = []; // Projéteis recebidos do servidor
let inputState = { 
    ArrowUp: false, 
    ArrowDown: false, 
    ArrowLeft: false, 
    ArrowRight: false
    // Removido isAttacking: agora só visual no servidor
};

// Mapeamento de teclas para ações (sem espaço aqui)
const keyMap = {
    'w': 'ArrowUp', 'W': 'ArrowUp',
    's': 'ArrowDown', 'S': 'ArrowDown',
    'a': 'ArrowLeft', 'A': 'ArrowLeft',
    'd': 'ArrowRight', 'D': 'ArrowRight'
};

// 1. Recebe a atualização de estado do servidor (inclui mapa e projéteis)
socket.on('gameStateUpdate', (data) => {
    players = data.players;
    gameMap = data.map;
    projectiles = data.projectiles || [];
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

// 3. Lógica de Desenho (O "Game Loop" do Cliente)
function drawGame() {
    // Limpa o canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Desenha o MAPA ---
    if (gameMap.length > 0) {
        for (let y = 0; y < gameMap.length; y++) {
            for (let x = 0; x < gameMap[y].length; x++) {
                const tileType = gameMap[y][x];
                if (tileType === 0) { // Caminho
                    ctx.fillStyle = '#ADD8E6'; // Azul claro para o chão
                } else if (tileType === 1) { // Parede
                    ctx.fillStyle = '#8B4513'; // Marrom para paredes
                }
                ctx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
                
                // Opcional: Desenhar bordas do grid
                ctx.strokeStyle = '#CCCCCC';
                ctx.strokeRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
            }
        }
    }

    // --- Desenha os Projéteis ---
    for (const proj of projectiles) {
        ctx.fillStyle = '#FFD700'; // Amarelo para tiros
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Desenha os Jogadores ---
    for (const id in players) {
        const player = players[id];
        
        // Checa piscar vermelho
        const now = Date.now();
        let drawColor = player.color;
        if (player.flashRedUntil && now < player.flashRedUntil) {
            // Overlay vermelho semi-transparente
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.fillStyle = 'red';
            ctx.fillRect(player.x, player.y, PLAYER_SIZE, PLAYER_SIZE);
            ctx.restore();
        }

        // Desenha o quadrado do jogador
        ctx.fillStyle = drawColor;
        // Posições X e Y já vêm convertidas para pixels do servidor
        ctx.fillRect(player.x, player.y, PLAYER_SIZE, PLAYER_SIZE);

        // Desenha a barra de vida (Health Bar)
        const healthBarHeight = 3;
        const healthBarY = player.y - healthBarHeight - 2;
        
        // Fundo da barra
        ctx.fillStyle = 'red';
        ctx.fillRect(player.x, healthBarY, PLAYER_SIZE, healthBarHeight);

        // Nível de vida atual
        const currentHealthWidth = (player.health / 100) * PLAYER_SIZE;
        ctx.fillStyle = 'lime';
        ctx.fillRect(player.x, healthBarY, currentHealthWidth, healthBarHeight);
        
        // Destaque se estiver atacando (breve flash do servidor)
        if (player.isAttacking) {
            ctx.strokeStyle = 'yellow';
            ctx.lineWidth = 3;
            ctx.strokeRect(player.x - 1, player.y - 1, PLAYER_SIZE + 2, PLAYER_SIZE + 2);
        }

        // Desenha o texto "EU" ou o ID
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        const label = id === myId ? 'EU' : id.substring(0, 4);
        ctx.fillText(label, player.x + 4, player.y + 14);
    }

    // Continua o loop
    requestAnimationFrame(drawGame);
}

// Inicia o loop de desenho
requestAnimationFrame(drawGame);

// 4. Lógica de Input (Envio do Estado do Teclado)
function sendInput() {
    socket.emit('input', { 
        keys: {
            ArrowUp: inputState.ArrowUp,
            ArrowDown: inputState.ArrowDown,
            ArrowLeft: inputState.ArrowLeft,
            ArrowRight: inputState.ArrowRight
        }
    });
}

// 5. Tratamento de Eventos de Teclado
document.addEventListener('keydown', (event) => {
    let key = keyMap[event.key];
    if (key) {
        if (!inputState[key]) {
            inputState[key] = true;
            sendInput(); // Envia a mudança imediatamente
        }
    } else if (event.key === ' ') { // Espaço para atirar
        event.preventDefault(); // Evita scroll
        socket.emit('shoot');
    }
});

document.addEventListener('keyup', (event) => {
    let key = keyMap[event.key];
    if (key && inputState[key]) {
        inputState[key] = false;
        sendInput(); // Envia a mudança imediatamente
    }
});