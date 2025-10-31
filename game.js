// Conecta ao nosso servidor
const socket = io();

// Configuração do Canvas
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// --- Configurações do Jogo (DEVE ser as mesmas do servidor) ---
const GRID_SIZE = 32;   // Tamanho de cada tile do *mapa*
const PLAYER_SIZE = 24; // Tamanho do *jogador*

// Armazenamento local
let myId = '';
let players = {};
let gameMap = [];
let projectiles = [];
let localAimAngle = 0; // Armazena o ângulo local para mira responsiva
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

// 1. Recebe a atualização de estado do servidor
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
    // Idealmente, desabilitaríamos os inputs aqui
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
                if (tileType === 0) { ctx.fillStyle = '#ADD8E6'; } // Caminho
                else if (tileType === 1) { ctx.fillStyle = '#8B4513'; } // Parede
                
                ctx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);
            }
        }
    }

    // --- Desenha os Projéteis ---
    for (const proj of projectiles) {
        ctx.fillStyle = '#FFD700'; // Amarelo
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, proj.size, 0, Math.PI * 2);
        ctx.fill();
    }

    // --- Desenha os Jogadores ---
    for (const id in players) {
        const player = players[id];
        
        // O jogador agora é desenhado como um círculo (melhor para colisão)
        // O servidor ainda usa Bounding Box (quadrado) para colisão de mapa,
        // mas a colisão de projétil é baseada em raio (dist).

        // Salva o estado do canvas
        ctx.save();
        // Move o canvas para o centro do jogador
        ctx.translate(player.x, player.y);

        // Define a cor do jogador
        let drawColor = player.color;
        
        // Efeito de Dano (Flash Vermelho)
        const now = Date.now();
        if (player.flashRedUntil && now < player.flashRedUntil) {
            drawColor = 'red';
        }
        
        // Desenha o corpo do jogador (círculo)
        ctx.fillStyle = drawColor;
        ctx.beginPath();
        ctx.arc(0, 0, PLAYER_SIZE / 2, 0, Math.PI * 2); // Raio = 12
        ctx.fill();

        // --- Desenha a "Arma" e a "Mira" ---
        // Determina o ângulo a ser desenhado
        let angleToDraw = player.aimAngle;
        // Se for o NOSSO jogador, usa o ângulo local (mais responsivo)
        if (id === myId) {
            angleToDraw = localAimAngle;
        }

        // Gira o contexto para o ângulo da mira
        ctx.rotate(angleToDraw);

        // Desenha a "arma" (um retângulo apontando para a direita)
        ctx.fillStyle = '#666'; // Cinza escuro
        ctx.fillRect(PLAYER_SIZE / 2 - 4, -3, 16, 6); // Posição e tamanho da arma

        // Restaura o canvas (remove a rotação e translação)
        ctx.restore();


        // --- Desenha UI (Barra de Vida e Nome) ---
        // Fundo da barra de vida
        ctx.fillStyle = 'red';
        ctx.fillRect(player.x - PLAYER_SIZE/2, player.y - 20, PLAYER_SIZE, 3);
        // Nível de vida atual
        const currentHealthWidth = (player.health / 100) * PLAYER_SIZE;
        ctx.fillStyle = 'lime';
        ctx.fillRect(player.x - PLAYER_SIZE/2, player.y - 20, currentHealthWidth, 3);
        
        // Desenha o texto "EU" ou o ID
        ctx.fillStyle = '#000';
        ctx.font = '10px Arial';
        const label = id === myId ? 'EU' : id.substring(0, 4);
        ctx.textAlign = 'center';
        ctx.fillText(label, player.x, player.y + 20);
    }

    // Continua o loop
    requestAnimationFrame(drawGame);
}

// Inicia o loop de desenho
requestAnimationFrame(drawGame);


// 4. Lógica de Input (Envio do Estado do Teclado)
// 4. Lógica de Input (Envio do Estado do Teclado)
function sendInput() {
    socket.emit('input', { 
        keys: {
            ArrowUp: inputState.ArrowUp,
            ArrowDown: inputState.ArrowDown, // CORRIGIDO: Era inputPstate
            ArrowLeft: inputState.ArrowLeft,
            ArrowRight: inputState.ArrowRight
        }
    });
}

// 5. Tratamento de Eventos de Teclado (Movimento)
document.addEventListener('keydown', (event) => {
    let key = keyMap[event.key];
    if (key && !inputState[key]) {
        inputState[key] = true;
        sendInput(); // Envia a mudança imediatamente
    }
});

document.addEventListener('keyup', (event) => {
    let key = keyMap[event.key];
    if (key && inputState[key]) {
        inputState[key] = false;
        sendInput(); // Envia a mudança imediatamente
    }
});

// 6. Novos Eventos de Mouse (Mira e Tiro)

// Mira (mousemove)
canvas.addEventListener('mousemove', (event) => {
    if (!players[myId]) return; // Se ainda não nos conectamos

    const rect = canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;

    const myPlayer = players[myId];
    
    // Calcula o ângulo do jogador (centro) para o mouse
    const angle = Math.atan2(mouseY - myPlayer.y, mouseX - myPlayer.x);
    
    localAimAngle = angle; // Atualiza o ângulo local para desenho
    
    // Envia o ângulo para o servidor (para o tiro e para outros jogadores)
    socket.emit('aimUpdate', { angle: angle });
});

// Tiro (mousedown)
canvas.addEventListener('mousedown', (event) => {
    // Botão esquerdo do mouse
    if (event.button === 0) {
        socket.emit('shoot');
    }
});

// Prevenir menu de contexto (clique direito) no canvas
canvas.addEventListener('contextmenu', (event) => {
    event.preventDefault();
});