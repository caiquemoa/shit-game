// server.js (com endpoint seguro para Developer Mode)
//
// Este arquivo espera que existam:
// - ./constants (exportando PORT, GAME_TICK_RATE)
// - ./gameEngine (API: addPlayer, getPlayer, createProjectile, performPierce, performSlice, removePlayer, getGameState, serverGameLoop)
// Se seu projeto usa outro layout, integre apenas a rota abaixo no seu server existente.
//

const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const fs = require('fs');
const path = require('path');

// Ajuste de acordo com seu projeto:
const { PORT = 3000, GAME_TICK_RATE = 1000 / 30 } = require('./constants') || {};
const gameEngine = require('./gameEngine');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Servir estáticos (raiz e assets)
app.use(express.static(__dirname));
app.use('/assets', express.static(path.join(__dirname, 'assets')));
app.use('/public', express.static(path.join(__dirname, 'public')));

// JSON body parser (necessário para receber o dev-save)
app.use(express.json({ limit: '2mb' }));

// Favicon quick response to avoid 404 logging
app.get('/favicon.ico', (req, res) => res.status(204).end());

// -----------------------------------------------------------------------------
// ROTA: __dev_save_file
// Finalidade: permite que o Developer Mode (no navegador) salve arquivos
// REGRAS DE SEGURANÇA:
//  - Só grava dentro da pasta developerMode/
//  - Bloqueia caminhos com '..'
//  - Cria o diretório se não existir
//  - Espera { filename: "developerMode/<nome>", content: "string" }
// -----------------------------------------------------------------------------
app.post('/__dev_save_file', (req, res) => {
  try {
    const { filename, content } = req.body;
    if (!filename || typeof content !== 'string') return res.status(400).json({ ok: false, error: 'missing filename or content' });

    if (filename.includes("..")) return res.status(400).json({ ok: false, error: 'invalid filename' });

    // Normalize and require files to be inside developerMode/
    const normalized = path.posix.normalize(filename.replace(/\\/g, '/'));
    if (!normalized.startsWith('developerMode/')) return res.status(400).json({ ok: false, error: 'write permitted only to developerMode/' });

    const devDir = path.join(__dirname, 'developerMode');
    if (!fs.existsSync(devDir)) fs.mkdirSync(devDir, { recursive: true });

    const target = path.join(__dirname, normalized);
    fs.writeFileSync(target, content, 'utf8');

    return res.json({ ok: true, path: normalized });
  } catch (err) {
    console.error("dev save error", err);
    return res.status(500).json({ ok: false, error: 'server error' });
  }
});

// --------------------
// LOOP DO JOGO (server-side)
// --------------------
setInterval(() => {
  try {
    if (gameEngine && typeof gameEngine.serverGameLoop === 'function') {
      gameEngine.serverGameLoop(io);
    }
  } catch (e) {
    console.error("game loop error", e);
  }
}, GAME_TICK_RATE);

// --------------------
// SOCKET.IO HANDLERS
// --------------------
io.on('connection', (socket) => {
  console.log(`Novo jogador conectado: ${socket.id}`);

  socket.on('joinGame', (data) => {
    const playerName = (data.name || 'Aventureiro').substring(0, 15);
    console.log(`Jogador ${socket.id} entrou como: ${playerName}`);
    try { gameEngine.addPlayer(socket.id, playerName); } catch (e) { console.warn(e); }
    try { socket.emit('gameStateUpdate', gameEngine.getGameState()); } catch (e) {}
  });

  socket.on('pierce', () => { try { gameEngine.performPierce(socket.id); } catch (e) {} });
  socket.on('slice', () => { try { gameEngine.performSlice(socket.id); } catch (e) {} });
  socket.on('input', (inputData) => {
    try {
      const player = gameEngine.getPlayer(socket.id);
      if (player) player.input = inputData.keys;
    } catch (e) {}
  });
  socket.on('aimUpdate', (data) => {
    try {
      const player = gameEngine.getPlayer(socket.id);
      if (player) player.aimAngle = data.angle;
    } catch (e) {}
  });
  socket.on('shoot', () => { try { gameEngine.createProjectile(socket.id); } catch (e) {} });

  socket.on('disconnect', () => {
    console.log(`Desconectou: ${socket.id}`);
    try { gameEngine.removePlayer(socket.id); } catch (e) {}
  });
});

// Iniciar servidor
server.listen(PORT, () => {
  console.log(`Servidor rodando em http://localhost:${PORT} (porta ${PORT})`);
});
