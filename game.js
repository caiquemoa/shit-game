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
let inputState = { 
    ArrowUp: false, 
    ArrowDown: false, 
    ArrowLeft: false, 
    ArrowRight: false,
    isAttacking: false 
};

// Mapeamento de teclas para ações
const keyMap = {
    'w': 'ArrowUp', 'W': 'ArrowUp',
    's': 'ArrowDown', 'S': 'ArrowDown',
    'a': 'ArrowLeft', 'A': 'ArrowLeft',
    'd': 'ArrowRight', 'D': 'ArrowRight',
    ' ': 'isAttacking' 
};

// 1. Recebe a atualização de estado do servidor (inclui mapa)
socket.on('gameStateUpdate', (data) => {
    players = data.players;
    gameMap = data.map;
});

// 2. Recebe o ID na conexão inicial
socket.on('connect', () => {
    myId = socket.id;
    console.log(`Conectado com ID: ${myId}`);
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


    // --- Desenha os Jogadores ---
    for (const id in players) {
        const player = players[id];
        
        // Desenha o quadrado do jogador
        ctx.fillStyle = player.color;
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
        
        // Destaque se estiver atacando
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
        },
        isAttacking: inputState.isAttacking
    });
}

// 5. Tratamento de Eventos de Teclado
document.addEventListener('keydown', (event) => {
    const key = keyMap[event.key] || event.key;
    if (inputState[key] !== undefined && !inputState[key]) {
        inputState[key] = true;
        sendInput(); // Envia a mudança imediatamente
    }
});

document.addEventListener('keyup', (event) => {
    const key = keyMap[event.key] || event.key;
    if (inputState[key] !== undefined) {
        inputState[key] = false;
        sendInput(); // Envia a mudança imediatamente
    }
});