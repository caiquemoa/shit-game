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

  // Estrutura de configuração para o HUD
  const ANIMATION_GROUPS = [
    'PIERCE_SIDE', 'PIERCE_UP', 'PIERCE_DOWN',
    'SLICE_SIDE', 'SLICE_UP', 'SLICE_DOWN',
    'IDLE_SIDE', // NOVO (para flip/offset de idle)
    'WALK_SIDE', // NOVO (para flip/offset de walk)
    'GENERAL' // Grupo para ajustes globais/câmera
  ];
  // ANIMATION_PROPS inclui todos os campos possíveis para ataques
  const ANIMATION_PROPS = ['WIDTH', 'HEIGHT', 'OFFSET_X', 'OFFSET_Y', 'BLEED_CUT', 'FLIP_OVERRIDE', 'LEFT_OFFSET_X', 'CUT_ALIGNMENT']; 
  const GENERAL_PROPS = ['CAMERA_LERP_ATTACK', 'CAMERA_LERP_IDLE', 'BAR_WIDTH', 'BAR_Y_OFFSET', 'MIRA_Y_OFFSET'];

  let buffer = "";
  let hud = null;
  let currentConfigGroup = 'PIERCE_SIDE'; // Inicial

  // Inicializa a estrutura de configuração
  let initial = window.GAME_CALIBRATION || {};
  window.DEV_MODE_CONFIG = Object.assign({
      IS_ACTIVE: false, // **FLAG DE ESTADO DEV MODE (Inicialmente inativo)**
      CALIBRATION_DATA: initial
  }, window.DEV_MODE_CONFIG || {});
  
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
    if (hud) { 
        window.DEV_MODE_CONFIG.IS_ACTIVE = false; // Desativa o delineado
        applyFromHud(true); // Aplica a desativação
        hud.remove(); 
        hud = null; 
        return; 
    }
    window.DEV_MODE_CONFIG.IS_ACTIVE = true; // Ativa o delineado
    createHud();
    applyFromHud(true); // Aplica a ativação
  }

  function createHud() {
    if (hud) return;
    hud = document.createElement("div");
    Object.assign(hud.style, {
      position: "fixed",
      right: "12px",
      top: "12px",
      width: "420px",
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
    title.innerHTML = "<b style='color:#9ef08c'>DEVELOPER MODE</b> — CALIBRAÇÃO DE SPRITES";
    title.style.marginBottom = "8px";
    hud.appendChild(title);

    // Selector
    const selectorRow = document.createElement("div");
    selectorRow.style.marginBottom = "12px";
    selectorRow.innerHTML = "<b>Grupo de Calibração: </b>";
    const selector = document.createElement("select");
    selector.style.background = '#070707'; selector.style.color = '#dfffe0'; selector.style.border = '1px solid #9ef08c';
    ANIMATION_GROUPS.forEach(g => {
        const opt = document.createElement("option"); opt.value = g; opt.textContent = g;
        selector.appendChild(opt);
    });
    selector.value = currentConfigGroup; // Set initial value
    selector.onchange = (e) => {
        currentConfigGroup = e.target.value;
        renderInputs(currentConfigGroup);
    };
    selectorRow.appendChild(selector);
    hud.appendChild(selectorRow);

    const desc = document.createElement("div");
    desc.style.fontSize = "11px";
    desc.style.opacity = "0.9";
    desc.style.marginBottom = "8px";
    desc.innerText = "Edite as variáveis do grupo selecionado. Aplique para ver em tempo real. Salve para atualizar renderer.js.";
    hud.appendChild(desc);

    const rows = document.createElement("div");
    rows.id = "dev-rows";
    hud.appendChild(rows);

    // Buttons
    const btnRow = document.createElement("div"); 
    btnRow.style.display = "flex"; btnRow.style.flexWrap = "wrap"; btnRow.style.gap = "8px"; btnRow.style.marginTop = "12px";

    const applyBtn = document.createElement("button"); applyBtn.textContent = "Aplicar (runtime)"; styleActionButton(applyBtn);
    const saveBtn = document.createElement("button"); saveBtn.textContent = `Salvar → ${SAVE_TARGET}`; styleActionButton(saveBtn);
    const dlBtn = document.createElement("button"); dlBtn.textContent = "Download (bloco)"; styleActionButton(dlBtn);
    const closeBtn = document.createElement("button"); closeBtn.textContent = "Fechar"; styleActionButton(closeBtn);

    applyBtn.onclick = () => { applyFromHud(true); notify("Aplicado em runtime"); };
    saveBtn.onclick = async () => { await saveRendererCopy(); };
    dlBtn.onclick = () => { const block = buildConstantsBlock(window.DEV_MODE_CONFIG.CALIBRATION_DATA); downloadText(block, "renderer-calibration-block.txt"); notify("Baixado"); };
    closeBtn.onclick = () => { toggleHud(); }; 

    btnRow.appendChild(applyBtn); btnRow.appendChild(saveBtn); btnRow.appendChild(dlBtn); btnRow.appendChild(closeBtn);
    hud.appendChild(btnRow);

    document.body.appendChild(hud);
    renderInputs(currentConfigGroup); // Renderiza os inputs iniciais
  }

  function renderInputs(groupKey) {
      if (!hud) return;
      const rowsContainer = hud.querySelector("#dev-rows");
      rowsContainer.innerHTML = ''; // Limpa inputs anteriores
      
      const calib = window.DEV_MODE_CONFIG.CALIBRATION_DATA;
      
      let props;
      if (groupKey === 'GENERAL') {
          props = GENERAL_PROPS;
      } else if (groupKey === 'IDLE_SIDE' || groupKey === 'WALK_SIDE') {
          // Mostra apenas FLIP_OVERRIDE e LEFT_OFFSET_X para base side
          props = ['FLIP_OVERRIDE', 'LEFT_OFFSET_X'];
      } else if (groupKey.includes('_SIDE')) {
          // Attack side groups: todas as props de side (WIDTH, HEIGHT, OFFSET_X, OFFSET_Y, BLEED_CUT, FLIP_OVERRIDE, LEFT_OFFSET_X, CUT_ALIGNMENT)
          props = ANIMATION_PROPS;
      } else { 
          // UP/DOWN attack groups: todas as props, exceto FLIP/LEFT_OFFSET
          props = ['WIDTH', 'HEIGHT', 'OFFSET_X', 'OFFSET_Y', 'BLEED_CUT', 'CUT_ALIGNMENT'];
      }

      props.forEach(k => {
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
          
          const minus = document.createElement("button"); styleSmallButton(minus);
          const plus = document.createElement("button"); styleSmallButton(plus);

          let inp;
          let isBoolean = k === 'FLIP_OVERRIDE';
          let isSelect = k === 'CUT_ALIGNMENT';

          // Cria o elemento de input/select/checkbox
          if (isBoolean) {
             inp = document.createElement("input");
             inp.type = "checkbox";
          } else if (isSelect) {
             inp = document.createElement("select");
             inp.style.width = "90px";
             ['START', 'END'].forEach(opt => {
                const option = document.createElement("option");
                option.value = opt;
                option.textContent = opt;
                inp.appendChild(option);
             });
          } else {
             inp = document.createElement("input");
             inp.type = "number";
             inp.step = /LERP|CAMERA|MIRA|LEFT_OFFSET_X/i.test(k) ? "0.01" : "1";
             minus.textContent = "-";
             plus.textContent = "+";
          }
          
          // Define o valor
          const val = (calib[groupKey] && calib[groupKey][k] !== undefined) 
                    ? calib[groupKey][k] 
                    : defaultForKey(groupKey, k);
                    
          if (isBoolean) {
              inp.checked = val === true; // Handle boolean
          } else if (isSelect) {
              inp.value = val; // Handle select string
          } else {
              inp.value = val; // Handle number
              inp.style.width = "90px";
          }

          inp.dataset.group = groupKey;
          inp.dataset.key = k;
          inp.style.background = "#070707"; inp.style.color = "#dfffe0"; inp.style.border = "1px solid rgba(120,255,140,0.06)";
          
          if (!isBoolean && !isSelect) {
              row.appendChild(minus);
          }
          
          row.appendChild(inp);
          
          if (!isBoolean && !isSelect) {
              row.appendChild(plus);
          }
          
          if (!isBoolean && !isSelect) {
            minus.addEventListener("click", () => { changeInput(inp, -Number(inp.step)); });
            plus.addEventListener("click", () => { changeInput(inp, Number(inp.step)); });
          }
          inp.addEventListener("change", () => { applyFromHud(); });
          
          rowsContainer.appendChild(row);
      });
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

  function defaultForKey(group, k) { 
    // Usamos os valores padrão que o Dev Mode deve fornecer, alinhados com renderer.js
    const SPRITE_HEIGHT = 32; 
    
    if (k === 'FLIP_OVERRIDE') return false;
    if (k === 'LEFT_OFFSET_X') return 0;
    if (k === 'CUT_ALIGNMENT') return 'START';

    if (group === 'GENERAL') {
        if (k === "BAR_Y_OFFSET") return -37;
        if (k === "MIRA_Y_OFFSET") return -16;
        if (/LERP|CAMERA/i.test(k)) return 0.25; 
        if (k === "BAR_WIDTH") return 20;
    } else {
        // Defaults para WIDTH, HEIGHT, OFFSET_X, OFFSET_Y, BLEED_CUT
        if (/WIDTH|HEIGHT/i.test(k)) {
            // PIERCE/SLICE UP e DOWN usam HEIGHT 128, WIDTH 64
            if (group.includes('UP') || group.includes('DOWN')) {
                 return (k === 'HEIGHT' ? 128 : 64);
            }
            return 64; // SIDE usa 64x64
        }
        if (k === "OFFSET_X") return -32;
        if (k === "OFFSET_Y") {
            // OFFSET_Y é igual a -HEIGHT do grupo
            return group.includes('UP') || group.includes('DOWN') ? -128 : -64;
        }
        // BLEED_CUT default: 4 para SIDE/DOWN, 0 para UP
        if (k === "BLEED_CUT") return group.includes('UP') ? 0 : 4; 
    }
    return 0; // Default fallback
  }

  function applyFromHud(applyToGlobal = false) {
    if (!hud) return;
    const inputs = hud.querySelectorAll("input[data-key], select[data-key]");
    const updateObj = { CALIBRATION_DATA: {} };
    
    inputs.forEach(inp => {
      const g = inp.dataset.group;
      const k = inp.dataset.key;
      
      if (!updateObj.CALIBRATION_DATA[g]) {
          updateObj.CALIBRATION_DATA[g] = {};
      }
      
      if (inp.type === 'checkbox') {
          updateObj.CALIBRATION_DATA[g][k] = inp.checked;
      } else if (inp.tagName === 'SELECT') {
          updateObj.CALIBRATION_DATA[g][k] = inp.value;
      } else {
          updateObj.CALIBRATION_DATA[g][k] = Number(inp.value);
      }
    });

    // Merge e aplica via evento
    Object.assign(window.DEV_MODE_CONFIG.CALIBRATION_DATA, updateObj.CALIBRATION_DATA);
    
    window.dispatchEvent(new CustomEvent("DevModeConfigChanged", { 
        detail: {
            CALIBRATION_DATA: window.DEV_MODE_CONFIG.CALIBRATION_DATA,
            IS_ACTIVE: window.DEV_MODE_CONFIG.IS_ACTIVE
        }
    }));
    
    // Persistência local (para carregar ao reabrir o jogo)
    if (applyToGlobal) {
      try { localStorage.setItem("devmode_last_renderer", JSON.stringify(window.DEV_MODE_CONFIG.CALIBRATION_DATA)); } catch(e){}
    }
  }

  // Novo e crucial: recria o bloco de constantes aninhado para salvar no arquivo.
  function buildConstantsBlock(calib) {
    const lines = [];
    lines.push(CALIB_START);
    lines.push("let CALIBRATION_DATA = {");
    
    ANIMATION_GROUPS.forEach((group, index) => {
        const groupData = calib[group] || {};
        const isGeneral = group === 'GENERAL';
        
        let props;
        if (isGeneral) {
            props = GENERAL_PROPS;
        } else if (group === 'IDLE_SIDE' || group === 'WALK_SIDE') {
            props = ['FLIP_OVERRIDE', 'LEFT_OFFSET_X'];
        } else if (group.includes('_SIDE')) {
            props = ANIMATION_PROPS;
        } else {
            props = ['WIDTH', 'HEIGHT', 'OFFSET_X', 'OFFSET_Y', 'BLEED_CUT', 'CUT_ALIGNMENT'];
        }

        // Comentário para o grupo
        let groupComment = '';
        if (group.includes('PIERCE') || group.includes('SLICE')) { groupComment = `${group.split('_')[0]} - Calibração de Sprites e Hitboxes`; }
        else if (group === 'IDLE_SIDE' || group === 'WALK_SIDE') { groupComment = `FLIP/OFFSET para Base Sprites (${group.split('_')[0]})`; }
        else if (group === 'GENERAL') { groupComment = 'GENERAL - Ajustes Globais e Câmera'; }

        lines.push(`    // ${groupComment}`);
        lines.push(`    '${group}': {`);
        
        props.forEach(k => {
            const SPRITE_HEIGHT = 32;
            let val = groupData[k] !== undefined ? groupData[k] : defaultForKey(group, k);
            
            const isFloat = /LERP|CAMERA|MIRA|LEFT_OFFSET_X/i.test(k);
            let formatted;
            
            if (k === 'FLIP_OVERRIDE') {
                formatted = val ? 'true' : 'false';
            } else if (k === 'CUT_ALIGNMENT') {
                formatted = `'${val}'`;
            } else {
                formatted = isFloat ? Number(val).toFixed(4).replace(/\.?0+$/,'') : val;
            }

            // Adiciona comentário descritivo
            let comment = '';
            if (isGeneral) {
                switch(k) {
                    case "CAMERA_LERP_ATTACK": comment = 'Velocidade lerp câmera em ataques (aumente para menos lag/pulinho)'; break;
                    case "CAMERA_LERP_IDLE": comment = 'Lerp em idle/walk'; break;
                    case "BAR_WIDTH": comment = 'Largura barra vida (fixa)'; break;
                    case "BAR_Y_OFFSET": comment = `Posição Y barra (acima body: -SPRITE_HEIGHT - 5, usando ${SPRITE_HEIGHT})`; break;
                    case "MIRA_Y_OFFSET": comment = `Posição Y mira (centro base: -SPRITE_HEIGHT / 2, usando ${SPRITE_HEIGHT})`; break;
                }
            } else {
                switch(k) {
                    case "WIDTH": comment = 'Largura do frame'; break;
                    case "HEIGHT": comment = 'Altura do frame'; break;
                    case "OFFSET_X": comment = 'Offset Horizontal (posição X do canto superior esquerdo do frame em relação ao pivô)'; break;
                    case "OFFSET_Y": comment = 'Offset Vertical (posição Y do canto superior esquerdo do frame em relação ao pivô)'; break;
                    case "BLEED_CUT": comment = (group.includes('SIDE') ? 'Corte (em pixels) para vazamentos/ghosts no flip lateral' : (group.includes('DOWN') ? 'Corte (em pixels) para vazamentos/ghosts no bottom (perna residual)' : 'Corte (em pixels) para vazamentos/ghosts (geralmente 0 para UP)')); break;
                    case "FLIP_OVERRIDE": comment = 'Desativa o espelhamento automático se TRUE.'; break;
                    case "LEFT_OFFSET_X": comment = 'Offset X aplicado se FLIP_OVERRIDE for TRUE e estiver virado para a esquerda.'; break;
                    case "CUT_ALIGNMENT": comment = 'Posição do corte (START: Esquerda/Cima, END: Direita/Baixo)'; break;
                }
            }

            lines.push(`        ${k}: ${formatted}, // ${comment}`);
        });

        lines.push(`    }${index < ANIMATION_GROUPS.length - 1 ? ',' : ''}`);
    });

    lines.push("};");
    lines.push(CALIB_END);
    return lines.join("\n");
  }

  async function saveRendererCopy() {
    try {
      // 1) fetch the original renderer.js content
      const res = await fetch('/renderer.js');
      if (!res.ok) { alert('Erro ao buscar renderer.js: ' + res.status); return; }
      const text = await res.text();

      // 2) build new calibration block from current window.DEV_MODE_CONFIG.CALIBRATION_DATA
      const newBlock = buildConstantsBlock(window.DEV_MODE_CONFIG.CALIBRATION_DATA || {});

      // 3) replace the block between CALIB_START and CALIB_END
      const startIdx = text.indexOf(CALIB_START);
      const endIdx = text.indexOf(CALIB_END);
      if (startIdx === -1 || endIdx === -1 || endIdx < startIdx) {
        alert('Não foi possível localizar bloco de calibração em renderer.js (marcadores não encontrados).');
        return;
      }
      
      const newContent = text.slice(0, startIdx) + newBlock + text.slice(endIdx + CALIB_END.length);
      
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
        const parsedData = JSON.parse(last);
        // Garante que o Dev Mode use os valores persistidos
        window.DEV_MODE_CONFIG.CALIBRATION_DATA = Object.assign(window.DEV_MODE_CONFIG.CALIBRATION_DATA, parsedData);
        // Aplica o estado inicial de calibração ao renderer
        window.dispatchEvent(new CustomEvent("DevModeConfigChanged", { 
            detail: {
                CALIBRATION_DATA: window.DEV_MODE_CONFIG.CALIBRATION_DATA,
                IS_ACTIVE: false // Deve começar sempre inativo
            }
        }));
    }
  } catch (e) {}
})();