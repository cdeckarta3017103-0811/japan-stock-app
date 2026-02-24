import * as vscode from 'vscode';

/**
 * Returns the complete HTML document for the AI Office Webview Panel.
 *
 * The Webview uses a Content Security Policy that:
 *  - Allows inline styles (needed for dynamic CSS variable injection)
 *  - Allows scripts only from the extension's own nonce
 *  - Allows images from the extension's media directory and data URIs
 *
 * Sprite sheet assumptions (replace with your actual sheet):
 *  - Each state row is 192 px tall, each frame is 192 × 192 px.
 *  - idle:   row 0, 4 frames
 *  - typing: row 1, 6 frames
 *  - reading:row 2, 5 frames
 * Adjust SPRITE_CONFIG inside the HTML to match your actual asset.
 */
export function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  // Generate a random nonce for CSP
  const nonce = getNonce();

  // URI for the sprite sheet placed in /media/sprite.png
  const spriteUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'sprite.png')
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
      --bg: var(--vscode-editor-background, #1e1e2e);
      --fg: var(--vscode-editor-foreground, #cdd6f4);
      --accent: var(--vscode-button-background, #89b4fa);
      --btn-fg: var(--vscode-button-foreground, #1e1e2e);
      --border: var(--vscode-panel-border, #313244);
      --badge-bg: var(--vscode-badge-background, #313244);
    }

    body {
      background: var(--bg);
      color: var(--fg);
      font-family: var(--vscode-font-family, 'Segoe UI', system-ui, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 24px 16px;
      gap: 24px;
      min-height: 100vh;
    }

    h1 {
      font-size: 1.4rem;
      letter-spacing: 0.05em;
      color: var(--accent);
    }

    /* ------------------------------------------------------------------ */
    /* Sprite container                                                      */
    /* ------------------------------------------------------------------ */
    .sprite-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }

    /**
     * .sprite is the visible "window" into the sprite sheet.
     * Width & height equal one frame; background-position shifts the sheet.
     *
     * Sprite sheet layout (pixels):
     *   Frame size : 192 × 192 px
     *   idle       : row 0, 4 frames  → sheet width >= 768 px
     *   typing     : row 1, 6 frames  → sheet width >= 1152 px
     *   reading    : row 2, 5 frames  → sheet width >= 960 px
     *
     * Change FRAME_W / FRAME_H in the JS config to match your asset.
     */
    .sprite {
      width: 192px;
      height: 192px;
      background-image: url('${spriteUri}');
      background-repeat: no-repeat;
      /* background-position is set dynamically by JS */
      image-rendering: pixelated; /* keeps pixel art crisp */
      border: 2px solid var(--border);
      border-radius: 12px;
    }

    /* ------------------------------------------------------------------ */
    /* CSS keyframe animations                                               */
    /* Each animation steps through frames by shifting background-position. */
    /* ------------------------------------------------------------------ */

    /*
     * idle — 4 frames on row 0 (y = 0 px)
     * Steps through x = 0, -192, -384, -576 px
     */
    @keyframes sprite-idle {
      0%   { background-position:    0px 0px; }
      25%  { background-position: -192px 0px; }
      50%  { background-position: -384px 0px; }
      75%  { background-position: -576px 0px; }
      100% { background-position:    0px 0px; }
    }

    /*
     * typing — 6 frames on row 1 (y = -192 px)
     * Steps through x = 0, -192, -384, -576, -768, -960 px
     * Faster tempo to convey rapid key-pressing.
     */
    @keyframes sprite-typing {
      0%                { background-position:    0px -192px; }
      16.666%           { background-position: -192px -192px; }
      33.333%           { background-position: -384px -192px; }
      50%               { background-position: -576px -192px; }
      66.666%           { background-position: -768px -192px; }
      83.333%           { background-position: -960px -192px; }
      100%              { background-position:    0px -192px; }
    }

    /*
     * reading — 5 frames on row 2 (y = -384 px)
     * Slow, contemplative pace to suggest reading / file scanning.
     */
    @keyframes sprite-reading {
      0%   { background-position:    0px -384px; }
      20%  { background-position: -192px -384px; }
      40%  { background-position: -384px -384px; }
      60%  { background-position: -576px -384px; }
      80%  { background-position: -768px -384px; }
      100% { background-position:    0px -384px; }
    }

    /* State classes applied dynamically by JS */
    .sprite.idle {
      animation: sprite-idle 1.6s steps(1, end) infinite;
    }

    .sprite.typing {
      animation: sprite-typing 0.6s steps(1, end) infinite;
    }

    .sprite.reading {
      animation: sprite-reading 2.4s steps(1, end) infinite;
    }

    /* ------------------------------------------------------------------ */
    /* State badge                                                           */
    /* ------------------------------------------------------------------ */
    .state-badge {
      display: inline-block;
      padding: 2px 10px;
      border-radius: 99px;
      background: var(--badge-bg);
      font-size: 0.75rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--accent);
      border: 1px solid var(--border);
      transition: opacity 0.2s;
    }

    /* ------------------------------------------------------------------ */
    /* Control buttons                                                       */
    /* ------------------------------------------------------------------ */
    .controls {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .btn {
      padding: 6px 16px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: transparent;
      color: var(--fg);
      cursor: pointer;
      font-size: 0.85rem;
      transition: background 0.15s, color 0.15s;
    }

    .btn:hover {
      background: var(--accent);
      color: var(--btn-fg);
      border-color: var(--accent);
    }

    .btn.active {
      background: var(--accent);
      color: var(--btn-fg);
      border-color: var(--accent);
    }

    /* ------------------------------------------------------------------ */
    /* Info card                                                             */
    /* ------------------------------------------------------------------ */
    .info-card {
      width: 100%;
      max-width: 380px;
      background: var(--badge-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 14px 16px;
      font-size: 0.8rem;
      line-height: 1.6;
      color: var(--fg);
      opacity: 0.75;
    }

    .info-card strong {
      color: var(--accent);
    }
  </style>
</head>
<body>
  <h1>AI Office</h1>

  <div class="sprite-wrapper">
    <!-- The sprite element starts in idle state -->
    <div class="sprite idle" id="sprite" aria-label="AI Office sprite animation"></div>
    <span class="state-badge" id="stateBadge">idle — 發呆</span>
  </div>

  <div class="controls">
    <button class="btn active" id="btnIdle"    data-state="idle">Idle 發呆</button>
    <button class="btn"        id="btnTyping"  data-state="typing">Typing 打字</button>
    <button class="btn"        id="btnReading" data-state="reading">Reading 讀取</button>
  </div>

  <div class="info-card">
    <strong>Sprite Sheet 規格（預設值）</strong><br>
    Frame size: <strong>192 × 192 px</strong><br>
    idle:    row 0, <strong>4 frames</strong> @ 1.6 s/loop<br>
    typing:  row 1, <strong>6 frames</strong> @ 0.6 s/loop<br>
    reading: row 2, <strong>5 frames</strong> @ 2.4 s/loop<br><br>
    將 sprite sheet 圖片放到<br>
    <strong>media/sprite.png</strong> 即可套用動畫。
  </div>

  <script nonce="${nonce}">
    (function () {
      'use strict';

      // ------------------------------------------------------------------
      // Sprite configuration
      // Adjust these values to match your actual sprite sheet asset.
      // ------------------------------------------------------------------
      const SPRITE_CONFIG = {
        idle:    { frames: 4, row: 0, durationMs: 1600, label: 'idle — 發呆'    },
        typing:  { frames: 6, row: 1, durationMs:  600, label: 'typing — 打字'  },
        reading: { frames: 5, row: 2, durationMs: 2400, label: 'reading — 讀取' },
      };

      // ------------------------------------------------------------------
      // State management
      // ------------------------------------------------------------------
      const sprite    = /** @type {HTMLElement} */ (document.getElementById('sprite'));
      const badge     = /** @type {HTMLElement} */ (document.getElementById('stateBadge'));
      const buttons   = /** @type {NodeListOf<HTMLButtonElement>} */ (
        document.querySelectorAll('.btn[data-state]')
      );

      let currentState = 'idle';

      /**
       * Switch the sprite to the given state.
       * @param {'idle'|'typing'|'reading'} state
       */
      function setState(state) {
        if (!SPRITE_CONFIG[state]) { return; }
        currentState = state;

        // Swap CSS class on the sprite element
        sprite.classList.remove('idle', 'typing', 'reading');
        sprite.classList.add(state);

        // Update badge text
        badge.textContent = SPRITE_CONFIG[state].label;

        // Update button active styling
        buttons.forEach((btn) => {
          btn.classList.toggle('active', btn.dataset.state === state);
        });

        // Notify the extension host (optional — for future persistence)
        vscode.postMessage({ command: 'setState', state });
      }

      // ------------------------------------------------------------------
      // Button listeners
      // ------------------------------------------------------------------
      buttons.forEach((btn) => {
        btn.addEventListener('click', () => setState(btn.dataset.state));
      });

      // ------------------------------------------------------------------
      // Message listener (extension host → webview)
      // Allows external code to drive state changes, e.g.:
      //   panel.setSpriteState('typing');
      // ------------------------------------------------------------------
      window.addEventListener('message', (event) => {
        const msg = event.data;
        if (msg && msg.command === 'setSpriteState') {
          setState(msg.state);
        }
      });

      // ------------------------------------------------------------------
      // VS Code API
      // ------------------------------------------------------------------
      // acquireVsCodeApi() must be called exactly once.
      const vscode = acquireVsCodeApi();

      // Restore previous state if VS Code serialized it
      const previousState = vscode.getState();
      if (previousState && previousState.spriteState) {
        setState(previousState.spriteState);
      }

      // Persist state on every change (already done inside setState via
      // postMessage; keep vscode.setState in sync for panel revival).
      const _origSetState = setState;
      function setState(state) {
        _origSetState(state);
        vscode.setState({ spriteState: state });
      }

      // Initial call to wire everything up
      setState(currentState);
    })();
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
