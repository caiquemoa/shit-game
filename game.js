// Conecta ao nosso servidor
const socket = io();

// Configuração do Canvas (nosso mapa)
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const PLAYER_SIZE = 20; // Deve ser igual ao do servidor

// Armazenamento local
let myId = '';
let players = {};
let inputState = { 
    ArrowUp: false, 
    ArrowDown: false, 
    ArrowLeft: false, 
    ArrowRight: false,
    isAttacking: false // Novo: para ataques
};

// Mapeamento de teclas para ações futuras
const keyMap = {
    'w': 'ArrowUp', 'W': 'ArrowUp',
    's': 'ArrowDown', 'S': 'ArrowDown',
    'a': 'ArrowLeft', 'A': 'ArrowLeft',
    'd': 'ArrowRight', 'D': 'ArrowRight',
    ' ': 'isAttacking' // Espaço para atacar
};

// 1. Recebe a atualização de estado do servidor
socket.on('gameStateUpdate', (currentPlayers) => {
    players = currentPlayers;
});

// 2. Recebe o ID na conexão inicial
socket.on('connect', () => {
    myId = socket.id;
    console.log(`Conectado com ID: ${myId}`);
});


// 3. Lógica de Desenho (O "Game Loop" do Cliente)
function drawGame() {
    // Limpa o mapa (canvas)
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Desenha cada jogador na tela
    for (const id in players) {
        const player = players[id];
        
        // Desenha o quadrado do jogador
        ctx.fillStyle = player.color;
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
    // Envia o estado atual do teclado e ataque para o servidor
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