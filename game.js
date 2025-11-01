// game.js (corrigido e compatível com modo Dev)
import { initRenderer, renderGame, getCameraPosition } from './renderer.js';
import {
  initInputHandler,
  handleKeyDown,
  handleKeyUp,
  handleMouseMove,
  handleMouseDown,
  preventContextMenu,
  disableInput
} from './inputHandler.js';

let myId = '';
let players = {};
let gameMap = [];
let projectiles = [];
let mapWidthPixels = 0;
let mapHeightPixels = 0;
let camera = { x: 0, y: 0 };
let socket = null;

// DOM
const startScreen = document.getElementById('start-screen');
const playButton = document.getElementById('playButton');
const playerNameInput = document.getElementById('playerNameInput');
const gameCanvas = document.getElementById('gameCanvas');
const header = document.getElementById('header');

// LISTENERS
document.addEventListener('keydown', handleKeyDown);
document.addEventListener('keyup', handleKeyUp);
if (gameCanvas) {
  gameCanvas.addEventListener('mousemove', handleMouseMove);
  gameCanvas.addEventListener('mousedown', handleMouseDown);
  gameCanvas.addEventListener('contextmenu', preventContextMenu);
}

// BOTÃO ENTRAR
playButton.addEventListener('click', () => {
  const name = playerNameInput.value.trim();
  if (name.length > 0 && name.length <= 15) {
    playButton.disabled = true;
    playerNameInput.disabled = true;
    startScreen.classList.add('hidden');
    gameCanvas.classList.add('visible');
    header.classList.add('visible');
    initGame(name);
  } else {
    alert('Digite um nome válido (1–15 caracteres).');
    playerNameInput.focus();
  }
});

// --- JOGO PRINCIPAL ---
function initGame(playerName) {
  socket = io();
  console.log('[GAME] Conectando...');

  initInputHandler(socket, players, camera);
  initRenderer(players, gameMap, projectiles, myId, mapWidthPixels, mapHeightPixels);

  socket.on('gameStateUpdate', (data) => {
    Object.assign(players, data.players);
    gameMap = data.map;
    projectiles = data.projectiles || [];
    mapWidthPixels = data.mapWidth;
    mapHeightPixels = data.mapHeight;
    initRenderer(players, gameMap, projectiles, myId, mapWidthPixels, mapHeightPixels);
  });

  socket.on('connect', () => {
    myId = socket.id;
    socket.emit('joinGame', { name: playerName });
    initRenderer(players, gameMap, projectiles, myId, mapWidthPixels, mapHeightPixels);
  });

  socket.on('gameOver', () => {
    disableInput();
    socket?.disconnect();
    alert(`Fim de jogo, ${playerName}!`);
    window.location.reload();
  });

  function gameLoop() {
    renderGame();
    Object.assign(camera, getCameraPosition());
    requestAnimationFrame(gameLoop);
  }
  requestAnimationFrame(gameLoop);
}

// ============================================================
// --- VARIÁVEIS DE CALIBRAÇÃO (compatível com DevMode) ---
// ============================================================

(function initializeCalibration() {
  const SPRITE_HEIGHT = window.SPRITE_HEIGHT || 64; // fallback

  let _SIDE_WIDTH = 64;
  let _SIDE_HEIGHT = 64;
  let _SIDE_OFFSET_Y = -_SIDE_HEIGHT;
  let _VERTICAL_WIDTH = 64;
  let _VERTICAL_HEIGHT = 128;
  let _VERTICAL_BODY_OFFSET_Y = -SPRITE_HEIGHT;
  let _BLEED_CUT_SIDE = 4;
  let _BLEED_CUT_VERTICAL_DOWN = 4;
  let _CAMERA_LERP_ATTACK = 0.25;
  let _CAMERA_LERP_IDLE = 0.1;
  let _BAR_WIDTH = 20;
  let _BAR_Y_OFFSET = -SPRITE_HEIGHT - 5;
  let _MIRA_Y_OFFSET = -SPRITE_HEIGHT / 2;

  function applyOverrides(obj) {
    if (!obj) return;
    Object.keys(obj).forEach(k => {
      if (obj[k] !== undefined) eval(`_${k} = obj[k];`);
    });
  }

  try {
    if (window.DEV_MODE_CONFIG) applyOverrides(window.DEV_MODE_CONFIG);
  } catch (e) {
    console.warn("calibration init err", e);
  }

  window.GAME_CALIBRATION = {
    SIDE_WIDTH: _SIDE_WIDTH,
    SIDE_HEIGHT: _SIDE_HEIGHT,
    SIDE_OFFSET_Y: _SIDE_OFFSET_Y,
    VERTICAL_WIDTH: _VERTICAL_WIDTH,
    VERTICAL_HEIGHT: _VERTICAL_HEIGHT,
    VERTICAL_BODY_OFFSET_Y: _VERTICAL_BODY_OFFSET_Y,
    BLEED_CUT_SIDE: _BLEED_CUT_SIDE,
    BLEED_CUT_VERTICAL_DOWN: _BLEED_CUT_VERTICAL_DOWN,
    CAMERA_LERP_ATTACK: _CAMERA_LERP_ATTACK,
    CAMERA_LERP_IDLE: _CAMERA_LERP_IDLE,
    BAR_WIDTH: _BAR_WIDTH,
    BAR_Y_OFFSET: _BAR_Y_OFFSET,
    MIRA_Y_OFFSET: _MIRA_Y_OFFSET
  };

  for (const k in window.GAME_CALIBRATION) window[k] = window.GAME_CALIBRATION[k];

  window.addEventListener("DevModeConfigChanged", ev => {
    applyOverrides(ev.detail);
    for (const k in window.GAME_CALIBRATION) window[k] = window.GAME_CALIBRATION[k];
    console.log("DevMode update", window.GAME_CALIBRATION);
  });
})();
