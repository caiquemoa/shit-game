// developmentMode.js
// Developer Mode HUD que edita e salva uma cópia atualizada de renderer.js em /developerMode/renderer.js
// Instruções: coloque <script src="/developmentMode.js"></script> em index.html **após** carregar renderer.js.

(function () {
  const ACTIVATION_CODE = "110194";
  const SAVE_DIR = "developerMode";
  const TARGET_FILENAME = "renderer.js"; // arquivo alvo original
  const SAVE_TARGET = `${SAVE_DIR}/${TARGET_FILENAME}`; // onde será salvo no servidor
  const CALIB_START = "// --- CALIBRATION START ---";
  const CALIB_END = "// --- CALIBRATION END ---";
  const KEYS = [
    "SIDE_WIDTH","SIDE_HEIGHT","SIDE_OFFSET_Y",
    "VERTICAL_WIDTH","VERTICAL_HEIGHT","VERTICAL_BODY_OFFSET_Y",
    "BLEED_CUT_SIDE","BLEED_CUT_VERTICAL_DOWN",
    "CAMERA_LERP_ATTACK","CAMERA_LERP_IDLE",
    "BAR_WIDTH","BAR_Y_OFFSET","MIRA_Y_OFFSET"
  ];

  let buffer = "";
  let hud = null;

  // Inicial read existing calibration from window.GAME_CALIBRATION
  const initial = window.GAME_CALIBRATION || {};

  // Activation keystrokes
  window.addEventListener("keydown", (e) => {
    if (/^[0-9]$/.test(e.key)) {
      buffer += e.key;
      if (buffer.length > ACTIVATION_CODE.length) buffer = buffer.slice(-ACTIVATION_CODE.length);
      if (buffer === ACTIVATION_CODE) {
        buffer = "";
        toggleHud();
      }
    }
  }, true);

  function toggleHud() {
    if (hud) { hud.remove(); hud = null; return; }
    createHud();
  }

  function createHud() {
    if (hud) return;
    hud = document.createElement("div");
    hud.id = "devHud";
    Object.assign(hud.style, {
      position: "fixed",
      right: "12px",
      top: "12px",
      width: "380px",
      maxHeight: "80vh",
      overflowY: "auto",
      background: "rgba(6,6,6,0.95)",
      color: "#dfffe0",
      fontFamily: "monospace",
      fontSize: "13px",
      padding: "12px",
      borderRadius: "8px",
      zIndex: 2147483647,
      border: "1px solid rgba(120,255,140,0.08)"
    });

    const title = document.createElement("div");
    title.innerHTML = "<b style='color:#9ef08c'>DEVELOPER MODE</b> — EDIT renderer.js IN-GAME";
    title.style.marginBottom = "8px";
    hud.appendChild(title);

    const desc = document.createElement("div");
    desc.style.fontSize = "11px";
    desc.style.opacity = "0.9";
    desc.style.marginBottom = "8px";
    desc.innerText = "Altere os valores e clique Salvar → developerMode/renderer.js (cópia). Aplicar faz update em runtime.";
    hud.appendChild(desc);

    const rows = document.createElement("div");
    rows.id = "dev-rows";
    hud.appendChild(rows);

    const calib = window.GAME_CALIBRATION || {};
    KEYS.forEach(k => {
      const row = document.createElement("div");
      row.style.display = "flex";
      row.style.alignItems = "center";
      row.style.gap = "8px";
      row.style.marginBottom = "6px";

      const lbl = document.createElement("div");
      lbl.textContent = k;
      lbl.style.width = "150px";
      lbl.style.fontSize = "12px";
      row.appendChild(lbl);

      const minus = document.createElement("button"); minus.textContent = "-"; styleSmallButton(minus);
      row.appendChild(minus);

      const inp = document.createElement("input");
      inp.type = "number";
      inp.step = /LERP|CAMERA|MIRA/i.test(k) ? "0.01" : "1";
      inp.value = calib[k] !== undefined ? calib[k] : defaultForKey(k);
      inp.dataset.key = k;
      inp.style.width = "90px";
      inp.style.background = "#070707"; inp.style.color = "#dfffe0"; inp.style.border = "1px solid rgba(120,255,140,0.06)";
      row.appendChild(inp);

      const plus = document.createElement("button"); plus.textContent = "+"; styleSmallButton(plus);
      row.appendChild(plus);

      minus.addEventListener("click", () => { changeInput(inp, -Number(inp.step)); });
      plus.addEventListener("click", () => { changeInput(inp, Number(inp.step)); });
      inp.addEventListener("change", () => { applyFromHud(); });

      rows.appendChild(row);
    });

    // Buttons
    const btnRow = document.createElement("div"); btnRow.style.display = "flex"; btnRow.style.gap = "8px"; btnRow.style.marginTop = "8px";
    const applyBtn = document.createElement("button"); applyBtn.textContent = "Aplicar (runtime)"; styleActionButton(applyBtn);
    const saveBtn = document.createElement("button"); saveBtn.textContent = `Salvar → ${SAVE_TARGET}`; styleActionButton(saveBtn);
    const dlBtn = document.createElement("button"); dlBtn.textContent = "Download (bloco)"; styleActionButton(dlBtn);
    const closeBtn = document.createElement("button"); closeBtn.textContent = "Fechar"; styleActionButton(closeBtn);

    applyBtn.onclick = () => { applyFromHud(true); notify("Aplicado em runtime"); };
    saveBtn.onclick = async () => { await saveRendererCopy(); };
    dlBtn.onclick = () => { const block = buildConstantsBlock(window.GAME_CALIBRATION); downloadText(block, "renderer-calibration-block.txt"); notify("Baixado"); };
    closeBtn.onclick = () => { hud.remove(); hud = null; };

    btnRow.appendChild(applyBtn); btnRow.appendChild(saveBtn); btnRow.appendChild(dlBtn); btnRow.appendChild(closeBtn);
    hud.appendChild(btnRow);

    document.body.appendChild(hud);
  }

  function styleSmallButton(b) {
    b.style.width = "26px"; b.style.height = "22px"; b.style.border = "1px solid rgba(120,255,140,0.06)";
    b.style.background = "#111"; b.style.color = "#dfffe0"; b.style.cursor = "pointer"; b.style.borderRadius = "4px";
  }
  function styleActionButton(b) {
    b.style.padding = "6px 8px"; b.style.border = "1px solid rgba(120,255,140,0.12)";
    b.style.background = "linear-gradient(#0f0f0f,#0b0b0b)"; b.style.color = "#c8ffd3"; b.style.cursor = "pointer"; b.style.borderRadius = "6px";
  }
  function changeInput(inp, delta) {
    const v = parseFloat(inp.value || 0) + delta;
    inp.value = Number.isInteger(Number(inp.step)) ? Math.round(v) : Number(v.toFixed(2));
    applyFromHud();
  }

  function defaultForKey(k) { if (/WIDTH|HEIGHT|BAR_WIDTH|BLEED|OFFSET/i.test(k)) return 64; if (/LERP|CAMERA|MIRA/i.test(k)) return 0.25; return 0; }

  function applyFromHud(applyToGlobal = false) {
    if (!hud) return;
    const inputs = hud.querySelectorAll("input[data-key]");
    const obj = {};
    inputs.forEach(inp => {
      const k = inp.dataset.key;
      obj[k] = Number(inp.value);
    });
    // aplica via evento
    window.DEV_MODE_CONFIG = Object.assign(window.DEV_MODE_CONFIG || {}, obj);
    window.dispatchEvent(new CustomEvent("DevModeConfigChanged", { detail: window.DEV_MODE_CONFIG }));
    window.GAME_CALIBRATION = Object.assign(window.GAME_CALIBRATION || {}, window.DEV_MODE_CONFIG);
    if (applyToGlobal) {
      try { localStorage.setItem("devmode_last_renderer", JSON.stringify(window.GAME_CALIBRATION)); } catch(e){}
    }
  }

  function buildConstantsBlock(calib) {
    const keys = KEYS;
    const lines = [];
    lines.push("// --- CALIBRATION START ---");
    keys.forEach(k => {
      const val = calib && calib[k] !== undefined ? calib[k] : defaultForKey(k);
      const isFloat = /LERP|CAMERA|MIRA/i.test(k);
      const formatted = isFloat ? Number(val).toFixed(4).replace(/\.?0+$/,'') : val;
      lines.push(`${k.includes('_OFFSET') || k.includes('Y') ? '' : ''}let ${k} = ${formatted};`);
    });
    lines.push("// --- CALIBRATION END ---");
    return lines.join("\n");
  }

  async function saveRendererCopy() {
    try {
      // 1) fetch the original renderer.js content
      const res = await fetch('/renderer.js');
      if (!res.ok) { alert('Erro ao buscar renderer.js: ' + res.status); return; }
      const text = await res.text();

      // 2) build new calibration block from current window.GAME_CALIBRATION
      const newBlock = buildConstantsBlock(window.GAME_CALIBRATION || {});

      // 3) replace the block between CALIB_START and CALIB_END
      const startIdx = text.indexOf(CALIB_START);
      const endIdx = text.indexOf(CALIB_END);
      if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
        alert('Não foi possível localizar bloco de calibração em renderer.js (marcadores não encontrados).');
        return;
      }
      const before = text.slice(0, startIdx);
      const after = text.slice(endIdx + CALIB_END.length);
      const newContent = before + newBlock + after;

      // 4) POST to server to write to developerMode/renderer.js
      const post = await fetch('/__dev_save_file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: SAVE_TARGET, content: newContent })
      });
      const j = await post.json();
      if (!j.ok) {
        alert('Erro salvar no servidor: ' + (j.error || 'unknown'));
        return;
      }
      notify(`Salvo em ${SAVE_TARGET}`);
    } catch (err) {
      alert('Erro salvando renderer copy: ' + err.message);
    }
  }

  function downloadText(text, name='download.txt') {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  function notify(msg) {
    const el = document.createElement('div');
    el.textContent = msg;
    Object.assign(el.style, {
      position: 'fixed', right: '12px', top: hud ? (hud.getBoundingClientRect().height + 24) + 'px' : '12px',
      zIndex: 2147483647, background: 'rgba(0,0,0,0.8)', padding: '6px 10px', borderRadius: '6px',
      color: '#b7ffd0', fontFamily: 'monospace', fontSize: '12px', border: '1px solid rgba(120,255,140,0.08)'
    });
    document.body.appendChild(el); setTimeout(() => el.remove(), 1800);
  }

  // Expor API para console
  window.DevModeRenderer = {
    open: () => { if (!hud) createHud(); },
    saveCopy: () => saveRendererCopy()
  };

  // se tiver um save anterior no localStorage, aplica
  try {
    const last = localStorage.getItem("devmode_last_renderer");
    if (last) {
      const parsed = JSON.parse(last);
      window.GAME_CALIBRATION = Object.assign(window.GAME_CALIBRATION || {}, parsed);
      window.DEV_MODE_CONFIG = Object.assign(window.DEV_MODE_CONFIG || {}, parsed);
      window.dispatchEvent(new CustomEvent("DevModeConfigChanged", { detail: window.DEV_MODE_CONFIG }));
    }
  } catch (e) {}
})();
