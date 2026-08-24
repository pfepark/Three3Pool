import { BALL_RADIUS } from '../physics/constants';

export type CueSelect = 'white' | 'yellow';

export interface HudCallbacks {
  onPower: (p: number) => void;
  onTip: (a: number, b: number) => void;
  onElev: (deg: number) => void;
  onShoot: () => void;
  onReset: () => void;
  onCueSelect: (id: CueSelect) => void;
}

export interface Hud {
  setStatus: (text: string) => void;
  setPower: (p: number) => void;
  setTip: (a: number, b: number) => void;
  setElev: (deg: number) => void;
  setCueActive: (id: CueSelect) => void;
  toggleHelp: () => void;
  powerToSpeed: (p: number) => number;
}

const MAX_OFFSET = 0.45 * BALL_RADIUS;

export function powerToSpeed(p: number): number {
  return 0.5 * Math.pow(18, p / 100);
}

export function createHud(root: HTMLElement, cbs: HudCallbacks): Hud {
  injectStyles();

  const status = el('status');
  const panel = el('panel');

  const powerLabel = el('label');
  const powerSlider = document.createElement('input');
  powerSlider.type = 'range';
  powerSlider.min = '0';
  powerSlider.max = '100';
  powerSlider.step = '1';
  powerSlider.value = '50';
  const powerWrap = el('block');
  powerWrap.append(powerLabel, powerSlider);

  const elevLabel = el('label');
  const elevSlider = document.createElement('input');
  elevSlider.type = 'range';
  elevSlider.min = '0';
  elevSlider.max = '60';
  elevSlider.step = '1';
  elevSlider.value = '0';
  const elevWrap = el('block');
  elevWrap.append(elevLabel, elevSlider);

  const padLabel = el('label');
  padLabel.textContent = '타격점 (영어)';
  const padCanvas = document.createElement('canvas');
  padCanvas.width = 150;
  padCanvas.height = 150;
  padCanvas.className = 'pad';
  const padHint = el('hint');
  const padWrap = el('block');
  padWrap.append(padLabel, padCanvas, padHint);

  const shootBtn = button('발사 (Space)');
  const resetBtn = button('리셋 (R)');
  const btnRow = el('row');
  btnRow.append(shootBtn, resetBtn);

  const whiteBtn = button('흰공');
  const yellowBtn = button('노란공');
  whiteBtn.dataset.cue = 'white';
  yellowBtn.dataset.cue = 'yellow';
  const cueRow = el('row');
  cueRow.append(whiteBtn, yellowBtn);
  const cueLabel = el('label');
  cueLabel.textContent = '큐볼 (3구: 양쪽 다 가능)';
  const cueBlock = el('block');
  cueBlock.append(cueLabel, cueRow);

  const camLabel = el('hint');
  camLabel.innerHTML =
    '카메라: <b>1</b> 탑다운 · <b>2</b> 큐 뒤 · <b>3</b> 자유<br>휠 줌 · 우클릭 드래그 = 타격점<br>PgUp/PgDn = 큐 각도(커브)';
  panel.append(powerWrap, elevWrap, padWrap, btnRow, cueBlock, camLabel);

  root.append(status, panel);
  root.classList.add('hud-root');

  let power = 50;
  let elevDeg = 0;
  let tipA = 0;
  let tipB = 0;

  const drawPad = (): void => {
    const ctx = padCanvas.getContext('2d')!;
    const w = padCanvas.width;
    const cx = w / 2;
    const cy = w / 2;
    const scale = (w / 2 - 14) / MAX_OFFSET;
    ctx.clearRect(0, 0, w, w);
    ctx.fillStyle = '#141821';
    ctx.beginPath();
    ctx.arc(cx, cy, w / 2 - 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3d4657';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, w / 2 - 14, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#2a3242';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(cx - w / 2 + 10, cy);
    ctx.lineTo(cx + w / 2 - 10, cy);
    ctx.moveTo(cx, cy - w / 2 + 10);
    ctx.lineTo(cx, cy + w / 2 - 10);
    ctx.stroke();
    ctx.strokeStyle = '#5b667c';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.arc(cx, cy, scale * BALL_RADIUS, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ff5544';
    ctx.beginPath();
    ctx.arc(cx + tipB * scale, cy - tipA * scale, 6, 0, Math.PI * 2);
    ctx.fill();
  };

  const updatePowerLabel = (): void => {
    powerLabel.textContent = `파워 ${power} — ${powerToSpeed(power).toFixed(2)} m/s`;
  };

  const updateElevLabel = (): void => {
    elevLabel.textContent = elevDeg > 0 ? `큐 각도 ${elevDeg}° (커브)` : '큐 각도 0° (수평)';
  };

  const updatePadHint = (): void => {
    const aR = tipA / BALL_RADIUS;
    const bR = tipB / BALL_RADIUS;
    const parts: string[] = [];
    parts.push(aR > 0.02 ? '상단' : aR < -0.02 ? '하단' : '중심');
    if (Math.abs(bR) > 0.02) parts.push(bR > 0 ? '라이트' : '레프트');
    padHint.textContent = `${parts.join(' + ')} · a=${aR.toFixed(2)}R b=${bR.toFixed(2)}R`;
  };

  powerSlider.addEventListener('input', () => {
    power = Number(powerSlider.value);
    updatePowerLabel();
    cbs.onPower(power);
  });
  elevSlider.addEventListener('input', () => {
    elevDeg = Number(elevSlider.value);
    updateElevLabel();
    cbs.onElev(elevDeg);
  });
  shootBtn.addEventListener('click', () => cbs.onShoot());
  resetBtn.addEventListener('click', () => cbs.onReset());
  for (const b of [whiteBtn, yellowBtn]) {
    b.addEventListener('click', () => cbs.onCueSelect(b.dataset.cue as CueSelect));
  }

  const pointerOffset = (e: PointerEvent): void => {
    const rect = padCanvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const scale = (rect.width / 2 - 14) / MAX_OFFSET;
    let b = (e.clientX - rect.left - cx) / scale;
    let a = -(e.clientY - rect.top - cy) / scale;
    const r = Math.hypot(a, b);
    if (r > MAX_OFFSET) {
      a *= MAX_OFFSET / r;
      b *= MAX_OFFSET / r;
    }
    tipA = a;
    tipB = b;
    drawPad();
    updatePadHint();
    cbs.onTip(tipA, tipB);
  };
  let dragging = false;
  padCanvas.addEventListener('pointerdown', (e) => {
    dragging = true;
    padCanvas.setPointerCapture(e.pointerId);
    pointerOffset(e);
  });
  padCanvas.addEventListener('pointermove', (e) => {
    if (dragging) pointerOffset(e);
  });
  padCanvas.addEventListener('pointerup', () => {
    dragging = false;
  });

  updatePowerLabel();
  updateElevLabel();
  updatePadHint();
  drawPad();

  function setCueActive(id: CueSelect): void {
    whiteBtn.classList.toggle('active', id === 'white');
    yellowBtn.classList.toggle('active', id === 'yellow');
  }
  setCueActive('white');

  return {
    setStatus: (t) => {
      status.textContent = t;
    },
    setPower: (p) => {
      power = p;
      powerSlider.value = String(p);
      updatePowerLabel();
    },
    setTip: (a, b) => {
      tipA = a;
      tipB = b;
      drawPad();
      updatePadHint();
    },
    setElev: (deg) => {
      elevDeg = deg;
      elevSlider.value = String(deg);
      updateElevLabel();
    },
    setCueActive,
    toggleHelp: () => {
      panel.classList.toggle('hidden-panel');
    },
    powerToSpeed,
  };
}

function el(className: string): HTMLDivElement {
  const d = document.createElement('div');
  d.className = className;
  return d;
}

function button(text: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.textContent = text;
  return b;
}

function injectStyles(): void {
  if (document.getElementById('pool-hud-style')) return;
  const style = document.createElement('style');
  style.id = 'pool-hud-style';
  style.textContent = `
    .hud-root { position: fixed; inset: 0; pointer-events: none; font-family: system-ui, sans-serif; color: #dde3ee; z-index: 10; }
    .hud-root .status { position: absolute; top: 12px; left: 14px; background: rgba(10,13,20,.72); padding: 7px 11px; border-radius: 8px; font-size: 13px; }
    .hud-root .panel { position: absolute; top: 12px; right: 14px; width: 190px; background: rgba(10,13,20,.78); border-radius: 12px; padding: 12px; display: flex; flex-direction: column; gap: 10px; pointer-events: auto; }
    .hud-root .panel.hidden-panel { display: none; }
    .hud-root .block { display: flex; flex-direction: column; gap: 5px; }
    .hud-root .label { font-size: 12px; opacity: .85; }
    .hud-root .hint { font-size: 11px; opacity: .6; }
    .hud-root input[type=range] { width: 100%; accent-color: #4f8fe0; }
    .hud-root .row { display: flex; gap: 6px; }
    .hud-root button { flex: 1; background: #233047; color: #dde3ee; border: 1px solid #35455f; border-radius: 8px; padding: 7px 4px; font-size: 12px; cursor: pointer; }
    .hud-root button:hover { background: #2d3d59; }
    .hud-root button.active { background: #3f6ea8; border-color: #5d8cc9; }
    .hud-root canvas.pad { width: 100%; aspect-ratio: 1; touch-action: none; cursor: crosshair; border-radius: 50%; }
  `;
  document.head.appendChild(style);
}
