import * as vscode from 'vscode';

/**
 * Returns the complete HTML document for the AI Office Webview Panel.
 *
 * ── Sprite sheet spec (assets/character.png) ──────────────────────────────
 *  FRAME_W / FRAME_H : native pixel size of ONE frame in the PNG
 *  SCALE             : integer upscale factor (image-rendering: pixelated)
 *  Displayed size    : FRAME_W*SCALE × FRAME_H*SCALE  px
 *
 *  Row layout (top → bottom):
 *    row 0  idle     — 4 frames  (sitting still, breathing)
 *    row 1  typing   — 6 frames  (paws hammering keyboard, fast)
 *    row 2  reading  — 4 frames  (head tilting over book, slow)
 *
 *  If your PNG has different counts, change IDLE_FRAMES / TYPING_FRAMES /
 *  READING_FRAMES in the JS SPRITE_CONFIG block below.
 * ─────────────────────────────────────────────────────────────────────────
 */
export function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const nonce = getNonce();

  // character.png lives in assets/ (added to localResourceRoots in AiOfficePanel)
  const spriteUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'assets', 'character.png')
  );

  const csp = [
    `default-src 'none'`,
    `style-src 'unsafe-inline' ${webview.cspSource}`,
    `img-src ${webview.cspSource} data:`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  return /* html */ `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="${csp}" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AI Office</title>
  <style>
    /* ------------------------------------------------------------------ */
    /* Reset & base                                                          */
    /* ------------------------------------------------------------------ */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg:        var(--vscode-editor-background,   #1e1e2e);
      --fg:        var(--vscode-editor-foreground,   #cdd6f4);
      --accent:    var(--vscode-button-background,   #89b4fa);
      --btn-fg:    var(--vscode-button-foreground,   #1e1e2e);
      --border:    var(--vscode-panel-border,        #313244);
      --badge-bg:  var(--vscode-badge-background,    #313244);
      --green:     #a6e3a1;
      --yellow:    #f9e2af;
      --blue:      #89b4fa;
    }

    body {
      background: var(--bg);
      color: var(--fg);
      font-family: var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px 40px;
      gap: 20px;
      min-height: 100vh;
    }

    h1 {
      font-size: 1.4rem;
      letter-spacing: 0.05em;
      color: var(--accent);
    }

    /* ------------------------------------------------------------------ */
    /* Sprite                                                                */
    /* ------------------------------------------------------------------ */
    .sprite-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 10px;
    }

    /*
     * .sprite — the clipping window for one frame.
     * Width / height are set dynamically by JS (FRAME_W*SCALE × FRAME_H*SCALE).
     * background-size is also set by JS to match the full scaled sheet.
     * image-rendering:pixelated keeps pixel art crisp at any integer scale.
     */
    .sprite {
      background-image: url('${spriteUri}');
      background-repeat: no-repeat;
      image-rendering: pixelated;
      image-rendering: crisp-edges; /* Firefox fallback */
      border: 2px solid var(--border);
      border-radius: 12px;
      /* width / height / background-size injected by initSprite() in JS */
    }

    /*
     * @keyframes for each state are generated and injected by JS so that
     * pixel offsets stay in sync with SPRITE_CONFIG automatically.
     * Only the animation shorthand is declared here as a placeholder;
     * JS overwrites it after computing the correct step-count & duration.
     */
    .sprite.idle    { animation: sprite-idle    1.6s steps(1, end) infinite; }
    .sprite.typing  { animation: sprite-typing  0.6s steps(1, end) infinite; }
    .sprite.reading { animation: sprite-reading 2.4s steps(1, end) infinite; }

    /* ------------------------------------------------------------------ */
    /* State badge                                                           */
    /* ------------------------------------------------------------------ */
    .state-badge {
      display: inline-block;
      padding: 2px 12px;
      border-radius: 99px;
      background: var(--badge-bg);
      font-size: 0.75rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      border: 1px solid var(--border);
      transition: color 0.2s;
    }
    .state-badge.idle    { color: var(--blue);   }
    .state-badge.typing  { color: var(--yellow);  }
    .state-badge.reading { color: var(--green);   }

    /* ------------------------------------------------------------------ */
    /* Manual control buttons                                               */
    /* ------------------------------------------------------------------ */
    .controls {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .btn {
      padding: 5px 14px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: transparent;
      color: var(--fg);
      cursor: pointer;
      font-size: 0.82rem;
      transition: background 0.15s, color 0.15s;
    }
    .btn:hover, .btn.active {
      background: var(--accent);
      color: var(--btn-fg);
      border-color: var(--accent);
    }

    /* ------------------------------------------------------------------ */
    /* Source indicator                                                      */
    /* ------------------------------------------------------------------ */
    .source-row {
      font-size: 0.75rem;
      color: var(--fg);
      opacity: 0.5;
      text-align: center;
    }
    .source-row span { font-weight: 600; opacity: 1; color: var(--accent); }

    /* ------------------------------------------------------------------ */
    /* Live log feed                                                         */
    /* ------------------------------------------------------------------ */
    .log-section {
      width: 100%;
      max-width: 420px;
    }

    .log-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6px;
    }

    .log-title {
      font-size: 0.8rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      color: var(--accent);
      text-transform: uppercase;
    }

    .log-clear-btn {
      font-size: 0.72rem;
      background: none;
      border: none;
      color: var(--fg);
      opacity: 0.45;
      cursor: pointer;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .log-clear-btn:hover { opacity: 0.9; background: var(--badge-bg); }

    .log-feed {
      height: 220px;
      overflow-y: auto;
      border: 1px solid var(--border);
      border-radius: 8px;
      background: var(--badge-bg);
      padding: 6px 0;
      display: flex;
      flex-direction: column;
      gap: 0;
      scroll-behavior: smooth;
    }

    /* Empty-state placeholder */
    .log-empty {
      display: flex;
      align-items: center;
      justify-content: center;
      height: 100%;
      font-size: 0.78rem;
      opacity: 0.4;
      padding: 12px;
      text-align: center;
    }

    .log-row {
      display: grid;
      grid-template-columns: 56px 80px 1fr;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      font-size: 0.76rem;
      border-bottom: 1px solid transparent;
      animation: fadeIn 0.2s ease;
    }
    .log-row:hover { background: rgba(255,255,255,0.04); }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0);    }
    }

    .log-time  { color: var(--fg); opacity: 0.38; font-variant-numeric: tabular-nums; }
    .log-state { font-weight: 600; font-size: 0.72rem; border-radius: 4px; padding: 1px 5px; text-align: center; }
    .log-state.idle    { color: var(--bg); background: var(--blue);   }
    .log-state.typing  { color: var(--bg); background: var(--yellow); }
    .log-state.reading { color: var(--bg); background: var(--green);  }
    .log-action { opacity: 0.75; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .log-action strong { opacity: 1; color: var(--fg); }
    .log-action em     { font-style: normal; opacity: 0.5; margin-left: 4px; }
  </style>
</head>
<body>
  <h1>AI Office</h1>

  <!-- Sprite animation -->
  <div class="sprite-wrapper">
    <div class="sprite idle" id="sprite" aria-label="AI Office sprite animation"></div>
    <span class="state-badge idle" id="stateBadge">idle — 發呆</span>
  </div>

  <!-- Manual override buttons -->
  <div class="controls">
    <button class="btn active" data-state="idle">Idle 發呆</button>
    <button class="btn"        data-state="typing">Typing 打字</button>
    <button class="btn"        data-state="reading">Reading 讀取</button>
  </div>

  <!-- Log source hint -->
  <p class="source-row">
    Watching: <span id="logPath">—</span>
  </p>

  <!-- Live log feed -->
  <section class="log-section">
    <div class="log-header">
      <span class="log-title">Live Action Log</span>
      <button class="log-clear-btn" id="clearBtn">clear</button>
    </div>
    <div class="log-feed" id="logFeed">
      <div class="log-empty" id="logEmpty">
        Run <strong>AI Office: Start Mock Log</strong> to see live entries…
      </div>
    </div>
  </section>

  <script nonce="${nonce}">
  (function () {
    'use strict';

    // ----------------------------------------------------------------
    // VS Code API — must be acquired exactly once
    // ----------------------------------------------------------------
    const vscode = acquireVsCodeApi();

    // ================================================================
    // SPRITE CONFIGURATION
    // Adjust these values to match your character.png sprite sheet.
    // ================================================================
    const SPRITE = {
      // ── Native frame dimensions (pixels in the PNG file) ──────────
      FRAME_W: 48,   // width  of one frame  ← change to match your PNG
      FRAME_H: 48,   // height of one frame  ← change to match your PNG

      // ── Integer upscale factor ────────────────────────────────────
      // Display size = FRAME_W*SCALE × FRAME_H*SCALE px
      // 48×4 = 192 px  (crisp pixel art, same as before)
      SCALE: 4,

      // ── Total columns in the sheet (= widest row's frame count) ──
      // Used to compute background-size width.
      TOTAL_COLS: 6,

      // ── Per-state animation rows ───────────────────────────────────
      // row  : 0-based row index in the PNG
      // frames : number of frames in that row
      // durationMs : total loop duration in ms
      // label : text shown in the state badge
      states: {
        idle:    { row: 0, frames: 4, durationMs: 1600, label: 'idle — 發呆'    },
        typing:  { row: 1, frames: 6, durationMs:  600, label: 'typing — 打字'  },
        reading: { row: 2, frames: 4, durationMs: 2400, label: 'reading — 讀取' },
      },
    };
    // ================================================================

    // ----------------------------------------------------------------
    // initSprite() — compute pixel geometry and inject @keyframes
    // ----------------------------------------------------------------
    function initSprite() {
      var fw   = SPRITE.FRAME_W * SPRITE.SCALE;   // displayed frame width
      var fh   = SPRITE.FRAME_H * SPRITE.SCALE;   // displayed frame height
      var shW  = SPRITE.TOTAL_COLS * fw;           // full sheet width  at scale
      var shH  = Object.keys(SPRITE.states).length * fh; // full sheet height at scale

      // Size the sprite viewport
      spriteEl.style.width           = fw + 'px';
      spriteEl.style.height          = fh + 'px';
      spriteEl.style.backgroundSize  = shW + 'px ' + shH + 'px';

      // Build and inject @keyframes for every state
      var css = '';
      Object.keys(SPRITE.states).forEach(function (name) {
        var cfg   = SPRITE.states[name];
        var rowY  = -(cfg.row * fh);         // Y offset for this row
        var steps = cfg.frames;
        var pct   = 100 / steps;
        var kf    = '@keyframes sprite-' + name + ' {\n';

        for (var i = 0; i < steps; i++) {
          var x   = -(i * fw);
          var pct_val = (i * pct).toFixed(4);
          kf += '  ' + pct_val + '% { background-position: ' + x + 'px ' + rowY + 'px; }\n';
        }
        // Loop-back keyframe at 100%
        kf += '  100% { background-position: 0px ' + rowY + 'px; }\n}\n';

        // Rewrite the animation shorthand on the state class
        // (steps(N, end) makes it snap frame-by-frame, not interpolate)
        kf += '.sprite.' + name + ' { animation: sprite-' + name + ' ' +
          cfg.durationMs + 'ms steps(' + steps + ', end) infinite; }\n';

        css += kf;
      });

      var styleTag = document.createElement('style');
      styleTag.textContent = css;
      document.head.appendChild(styleTag);
    }

    // ----------------------------------------------------------------
    // DOM refs
    // ----------------------------------------------------------------
    const spriteEl  = document.getElementById('sprite');
    const badgeEl   = document.getElementById('stateBadge');
    const buttons   = document.querySelectorAll('.btn[data-state]');
    const logFeed   = document.getElementById('logFeed');
    const logEmpty  = document.getElementById('logEmpty');
    const clearBtn  = document.getElementById('clearBtn');
    const logPathEl = document.getElementById('logPath');

    let currentState = 'idle';
    const MAX_LOG_ROWS = 120;

    // Initialise sprite geometry + inject computed @keyframes
    initSprite();

    // ----------------------------------------------------------------
    // setSpriteState — single, authoritative state-change function
    // ----------------------------------------------------------------
    function setSpriteState(state) {
      if (!SPRITE.states[state]) { return; }
      currentState = state;

      spriteEl.classList.remove('idle', 'typing', 'reading');
      spriteEl.classList.add(state);

      badgeEl.className = 'state-badge ' + state;
      badgeEl.textContent = SPRITE.states[state].label;

      buttons.forEach(function (btn) {
        btn.classList.toggle('active', btn.dataset.state === state);
      });

      // Persist across panel hide/show cycles
      vscode.setState({ spriteState: state });
    }

    // ----------------------------------------------------------------
    // appendLogRow — adds one entry to the live feed
    // ----------------------------------------------------------------
    function appendLogRow(entry) {
      // Hide placeholder text on first entry
      if (logEmpty) { logEmpty.style.display = 'none'; }

      // Build row
      var row = document.createElement('div');
      row.className = 'log-row';

      var time = new Date(entry.ts);
      var hms  = time.toTimeString().slice(0, 8);

      row.innerHTML =
        '<span class="log-time">' + hms + '</span>' +
        '<span class="log-state ' + entry.state + '">' + entry.state + '</span>' +
        '<span class="log-action"><strong>' + escHtml(entry.action) + '</strong>' +
          (entry.detail ? '<em>' + escHtml(entry.detail) + '</em>' : '') +
        '</span>';

      logFeed.appendChild(row);

      // Cap maximum rows to avoid unbounded DOM growth
      var rows = logFeed.querySelectorAll('.log-row');
      if (rows.length > MAX_LOG_ROWS) {
        rows[0].remove();
      }

      // Auto-scroll to newest entry
      logFeed.scrollTop = logFeed.scrollHeight;
    }

    function escHtml(str) {
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
    }

    // ----------------------------------------------------------------
    // Message handler — extension host → webview
    // ----------------------------------------------------------------
    window.addEventListener('message', function (event) {
      var msg = event.data;
      if (!msg || !msg.command) { return; }

      switch (msg.command) {
        case 'setSpriteState':
          setSpriteState(msg.state);
          break;

        case 'appendLog':
          setSpriteState(msg.entry.state);   // keep sprite in sync
          appendLogRow(msg.entry);
          if (msg.logPath && logPathEl) {
            logPathEl.textContent = msg.logPath;
          }
          break;
      }
    });

    // ----------------------------------------------------------------
    // Manual button listeners
    // ----------------------------------------------------------------
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        setSpriteState(btn.dataset.state);
      });
    });

    // ----------------------------------------------------------------
    // Clear button
    // ----------------------------------------------------------------
    clearBtn.addEventListener('click', function () {
      var rows = logFeed.querySelectorAll('.log-row');
      rows.forEach(function (r) { r.remove(); });
      if (logEmpty) { logEmpty.style.display = ''; }
    });

    // ----------------------------------------------------------------
    // Restore persisted state after panel revival
    // ----------------------------------------------------------------
    var prev = vscode.getState();
    setSpriteState((prev && prev.spriteState) || 'idle');

  }());
  </script>
</body>
</html>`;
}

function getNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let text = '';
  for (let i = 0; i < 32; i++) {
    text += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return text;
}
