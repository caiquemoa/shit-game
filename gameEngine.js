// gameEngine.js
const { 
    GRID_SIZE, PLAYER_SPEED, PROJECTILE_SPEED, SHOT_COOLDOWN, 
    PLAYER_SPRITE_WIDTH, PLAYER_SPRITE_HEIGHT, PLAYER_RADIUS, 
    MAP_COLS, MAP_ROWS, MAP_WIDTH_PIXELS, MAP_HEIGHT_PIXELS, 
    FRAME_DURATION_WALK, FRAME_DURATION_IDLE, MAX_FRAMES_WALK, 
    MAX_FRAMES_IDLE, getRandomColor, isCollidingWithMap, gameMap, 
    PLAYER_START_HEALTH, DAMAGE_PER_HIT
} = require('./constants');


// --- Estrutura de Dados do Jogo (Fonte da Verdade) ---
let players = {};
let projectiles = [];

// --- Funções de Criação e Utilidade ---

// Encontra uma posição vazia
function findEmptyPosition() {
    let x, y, gridX, gridY;
    let found = false;
    let attempts = 0;
    const maxAttempts = MAP_ROWS * MAP_COLS;

    while (!found && attempts < maxAttempts) {
        gridX = Math.floor(Math.random() * MAP_COLS);
        gridY = Math.floor(Math.random() * MAP_ROWS);

        if (gameMap[gridY][gridX] === 0) {
            x = gridX * GRID_SIZE + (GRID_SIZE / 2);
            y = gridY * GRID_SIZE + PLAYER_SPRITE_HEIGHT / 2; // Centraliza X, Y nos pés
            found = true;
        }
        attempts++;
    }
    return found ? { x, y } : { x: 48, y: 64 }; // Fallback
}

// Cria um novo jogador
exports.createNewPlayer = function(id) {
    const { x, y } = findEmptyPosition();
    return {
        id: id,
        x: x, 
        y: y, 
        color: getRandomColor(),
        health: PLAYER_START_HEALTH,             
        speed: PLAYER_SPEED,
        input: {}, 
        aimAngle: 0,              
        isAttacking: false,       
        lastShotTime: 0,
        flashRedUntil: 0,
        state: 'idle',           
        direction: 'down',       
        frame: 0,                
        lastFrameTime: Date.now() 
    };
};

// Cria um projétil
exports.createProjectile = function(shooterId) {
    const shooter = players[shooterId];
    if (!shooter) return;

    // Checagem de Cooldown
    const currentTime = Date.now();
    if (currentTime - shooter.lastShotTime < SHOT_COOLDOWN) return;

    const dx = Math.cos(shooter.aimAngle) * PROJECTILE_SPEED;
    const dy = Math.sin(shooter.aimAngle) * PROJECTILE_SPEED;

    // O projétil se origina do CENTRO VISUAL do jogador
    const startX = shooter.x;
    const startY = shooter.y - (PLAYER_SPRITE_HEIGHT / 2); 

    projectiles.push({
        id: Date.now() + Math.random(),
        x: startX, 
        y: startY,
        dx: dx,
        dy: dy,
        shooterId: shooterId,
        size: 4
    });

    shooter.lastShotTime = currentTime;
    shooter.isAttacking = true;
    setTimeout(() => { shooter.isAttacking = false; }, 100);
};

// --- Funções de Getters e Setters ---
exports.getGameState = function() {
    return { 
        players: players, 
        projectiles: projectiles, 
        map: gameMap, 
        mapWidth: MAP_WIDTH_PIXELS, 
        mapHeight: MAP_HEIGHT_PIXELS 
    };
};

exports.addPlayer = function(id) {
    players[id] = exports.createNewPlayer(id);
};

exports.removePlayer = function(id) {
    delete players[id];
};

exports.getPlayer = function(id) {
    return players[id];
};


// --- Game Loop Principal ---

exports.serverGameLoop = function(io) {
    const currentTime = Date.now();
    
    // Atualiza Jogadores
    for (const id in players) {
        const player = players[id];
        
        // 1. Processa o movimento
        let dx = 0;
        let dy = 0;

        if (player.input.ArrowUp) dy -= player.speed;
        if (player.input.ArrowDown) dy += player.speed;
        if (player.input.ArrowLeft) dx -= player.speed;
        if (player.input.ArrowRight) dx += player.speed;

        // Normaliza o movimento diagonal
        if (dx !== 0 && dy !== 0) {
            const magnitude = Math.sqrt(dx * dx + dy * dy);
            dx = (dx / magnitude) * player.speed;
            dy = (dy / magnitude) * player.speed;
        }

        // 2. Lógica de Estado e Animação
        let isMoving = dx !== 0 || dy !== 0;
        player.state = isMoving ? 'walk' : 'idle';
        
        if (dy > 0) { player.direction = 'down'; }
        else if (dy < 0) { player.direction = 'up'; }
        else if (dx > 0) { player.direction = 'side_right'; }
        else if (dx < 0) { player.direction = 'side_left'; }

        let frameDuration = (player.state === 'walk') ? FRAME_DURATION_WALK : FRAME_DURATION_IDLE;
        let maxFrames = (player.state === 'walk') ? MAX_FRAMES_WALK : MAX_FRAMES_IDLE; 
        if (currentTime > player.lastFrameTime + frameDuration) {
            player.frame = (player.frame + 1) % maxFrames;
            player.lastFrameTime = currentTime;
        }
        
        // 3. Colisão (Slide)
        let newX = player.x + dx;
        if (!isCollidingWithMap(newX, player.y)) {
            player.x = newX;
        }
        let newY = player.y + dy;
        if (!isCollidingWithMap(player.x, newY)) {
            player.y = newY;
        }

        // 4. Checagem de Morte
        if (player.health <= 0) {
            exports.removePlayer(id);
            io.to(id).emit('gameOver'); 
        }
    }

    // Atualiza projéteis
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        proj.x += proj.dx;
        proj.y += proj.dy;

        // 1. Colisão com Paredes
        const gridX = Math.floor(proj.x / GRID_SIZE);
        const gridY = Math.floor(proj.y / GRID_SIZE);

        let collidedWithWall = false;
        if (gridX < 0 || gridX >= MAP_COLS || gridY < 0 || gridY >= MAP_ROWS) {
            collidedWithWall = true; 
        } else if (gameMap[gridY] && gameMap[gridY][gridX] === 1) {
            collidedWithWall = true; 
        }
        
        if (collidedWithWall) {
            projectiles.splice(i, 1);
            continue;
        }

        // 2. Checa colisão com players
        for (const id in players) {
            const player = players[id];
            if (id === proj.shooterId) continue; 

            // Calcula a distância do projétil ao CENTRO VISUAL do jogador
            const playerCenterX = player.x;
            const playerCenterY = player.y - (PLAYER_SPRITE_HEIGHT / 2);
            
            const dist = Math.sqrt((proj.x - playerCenterX)**2 + (proj.y - playerCenterY)**2);
            
            if (dist < PLAYER_RADIUS + proj.size) { 
                player.health -= DAMAGE_PER_HIT;
                player.flashRedUntil = currentTime + 500;
                projectiles.splice(i, 1);
                break; 
            }
        }
    }

    // Envia o estado atualizado do jogo para todos os clientes
    io.emit('gameStateUpdate', exports.getGameState());
};