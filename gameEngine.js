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
exports.createNewPlayer = function(id, name) {
    const { x, y } = findEmptyPosition();
    return {
        id: id,
        name: name,
        x: x, 
        y: y, 
        color: getRandomColor(),
        health: PLAYER_START_HEALTH, 
        speed: PLAYER_SPEED,
        input: {}, 
        aimAngle: 0, 
        isAttacking: false, 
        lastShotTime: 0,
        lastAttackTime: 0,
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

    const currentTime = Date.now();
    if (currentTime - shooter.lastShotTime < SHOT_COOLDOWN) return;

    const dx = Math.cos(shooter.aimAngle) * PROJECTILE_SPEED;
    const dy = Math.sin(shooter.aimAngle) * PROJECTILE_SPEED;

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

// Funções para ataques melee (usa aimAngle apenas para direção do ataque, não afeta walk/idle)
exports.performPierce = function(id) {
    const player = players[id];
    if (!player) return;

    const currentTime = Date.now();
    if (currentTime - (player.lastAttackTime || 0) < 1000) return;

    // Direção baseada em aimAngle (mouse) apenas para o ataque
    const angle = player.aimAngle || 0;
    const absCos = Math.abs(Math.cos(angle));
    const absSin = Math.abs(Math.sin(angle));
    if (absSin > absCos) {
        player.direction = Math.sin(angle) > 0 ? 'down' : 'up';
    } else {
        player.direction = Math.cos(angle) >= 0 ? 'side_right' : 'side_left';
    }
    player.state = 'pierce';
    player.isAttacking = true;
    player.frame = 0;
    player.lastFrameTime = currentTime;
    player.lastAttackTime = currentTime;
};

exports.performSlice = function(id) {
    const player = players[id];
    if (!player) return;

    const currentTime = Date.now();
    if (currentTime - (player.lastAttackTime || 0) < 1000) return;

    // Para slice, usa direção atual do player se side; senão aimAngle
    let useDir = player.direction;
    if (useDir !== 'side_right' && useDir !== 'side_left') {
        const angle = player.aimAngle || 0;
        const absCos = Math.abs(Math.cos(angle));
        const absSin = Math.abs(Math.sin(angle));
        if (absSin > absCos) {
            useDir = Math.sin(angle) > 0 ? 'down' : 'up';
        } else {
            useDir = Math.cos(angle) >= 0 ? 'side_right' : 'side_left';
        }
    }
    player.direction = useDir;
    player.state = 'slice';
    player.isAttacking = true;
    player.frame = 0;
    player.lastFrameTime = currentTime;
    player.lastAttackTime = currentTime;
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

exports.addPlayer = function(id, name) {
    players[id] = exports.createNewPlayer(id, name);
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
        if (!player) continue;
        
        const previousState = player.state; // Para detectar mudança e resetar frame
        
        // 1. Processa o movimento
        let dx = 0;
        let dy = 0;
        const input = player.input || {}; // Fallback para input undefined

        if (input.ArrowUp) dy -= player.speed;
        if (input.ArrowDown) dy += player.speed;
        if (input.ArrowLeft) dx -= player.speed;
        if (input.ArrowRight) dx += player.speed;

        // Normaliza diagonal
        if (dx !== 0 && dy !== 0) {
            const magnitude = Math.sqrt(dx * dx + dy * dy);
            dx = (dx / magnitude) * player.speed;
            dy = (dy / magnitude) * player.speed;
        }

        let isMoving = dx !== 0 || dy !== 0;
        let targetState = isMoving ? 'walk' : 'idle';
        
        // 2. Reset de ataque se duração acabou (aplica targetState imediatamente)
        const attackDuration = 500;
        if ((player.state === 'pierce' || player.state === 'slice') && currentTime - player.lastAttackTime > attackDuration) {
            player.state = targetState;
            player.isAttacking = false;
        }
        
        // Durante ataque, NÃO muda estado ou direção (isola aimAngle)
        if (player.state !== 'pierce' && player.state !== 'slice') {
            player.state = targetState; // Força update para walk/idle se moving
            // Direção baseada apenas em input (não aimAngle)
            if (dy > 0) { player.direction = 'down'; }
            else if (dy < 0) { player.direction = 'up'; }
            else if (dx > 0) { player.direction = 'side_right'; }
            else if (dx < 0) { player.direction = 'side_left'; }
        }

        // Detecta mudança de estado e reseta frame/tempo (corrige travamento idle/walk)
        if (player.state !== previousState) {
            player.frame = 0;
            player.lastFrameTime = currentTime;
        }

        // Animação de frames
        let frameDuration = FRAME_DURATION_WALK;
        let maxFrames = MAX_FRAMES_WALK;
        if (player.state === 'idle') {
            frameDuration = FRAME_DURATION_IDLE;
            maxFrames = MAX_FRAMES_IDLE;
        } else if (player.state === 'pierce' || player.state === 'slice') {
            frameDuration = 125;
            maxFrames = 8; // 8 frames para ataques
        }
        
        if (currentTime > player.lastFrameTime + frameDuration) {
            player.frame = (player.frame + 1) % maxFrames;
            player.lastFrameTime = currentTime;
        }
        
        // 3. Aplica movimento
        let newX = player.x + dx;
        if (!isCollidingWithMap(newX, player.y)) {
            player.x = newX;
        }
        let newY = player.y + dy;
        if (!isCollidingWithMap(player.x, newY)) {
            player.y = newY;
        }

        // 4. Dano de ataque (mantido simples)
        if (player.isAttacking && player.frame === 1 && (player.state === 'pierce' || player.state === 'slice')) {
            const attackRange = 80;
            for (const otherId in players) {
                if (otherId === id) continue;
                const other = players[otherId];
                const distX = other.x - player.x;
                const distY = (other.y - PLAYER_SPRITE_HEIGHT / 2) - (player.y - PLAYER_SPRITE_HEIGHT / 2);
                const dist = Math.sqrt(distX * distX + distY * distY);
                if (dist < attackRange) {
                    other.health -= DAMAGE_PER_HIT * 2;
                    other.flashRedUntil = currentTime + 500;
                }
            }
        }

        // 5. Checagem de Morte
        if (player.health <= 0) {
            exports.removePlayer(id);
            io.to(id).emit('gameOver'); 
        }
    }

    // Atualiza projéteis (mantido igual)
    for (let i = projectiles.length - 1; i >= 0; i--) {
        const proj = projectiles[i];
        proj.x += proj.dx;
        proj.y += proj.dy;

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

        for (const id in players) {
            const player = players[id];
            if (id === proj.shooterId) continue; 

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