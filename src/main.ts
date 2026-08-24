import * as THREE from 'three';
import { BALL_RADIUS } from './physics/constants';
import { World } from './physics/world';
import { applyStrike } from './physics/strike';
import { predict, type Prediction } from './physics/predict';
import type { BallState } from './physics/ball';
import { createScene, type SceneBundle } from './render/scene';
import { createTable } from './render/table';
import { Entities } from './render/entities';
import { createHud, powerToSpeed, type CueSelect } from './ui/hud';

const UP_Y = new THREE.Vector3(0, 1, 0);
const MAX_TIP = 0.45 * BALL_RADIUS;
const AIM_STEP = 0.004;
const AIM_FINE = 0.0008;
const POWER_STEP = 3;
const TIP_DRAG_SCALE = MAX_TIP / 120;
const MOUSE_SENS = 0.0025;
const MOUSE_FINE = 0.0005;

const STATUS_AIM =
  '마우스 좌우 = 조준 · ↑↓ 파워 · 우클릭 드래그 타격점 · PgUp/PgDn 큐각도 · Space 발사';

type State = 'aim' | 'run';

const app = document.getElementById('app')!;
const hudRoot = document.getElementById('hud')!;

const bundle: SceneBundle = createScene(app);
bundle.scene.add(createTable());
const entities = new Entities();
bundle.scene.add(entities.group);

let world = World.initial();
let state: State = 'aim';
const aimDir = new THREE.Vector3(1, 0, 0);
let power = 50;
let elevDeg = 0;
let tipA = 0;
let tipB = 0;
let selectedCue: CueSelect = 'white';
let camMode: 1 | 2 | 3 = 3;
let predictionDirty = false;
let currentPrediction: Prediction | null = null;

const hud = createHud(hudRoot, {
  onPower: (p) => {
    power = p;
    markDirty();
  },
  onTip: (a, b) => {
    tipA = a;
    tipB = b;
    markDirty();
  },
  onElev: (deg) => {
    elevDeg = deg;
    markDirty();
  },
  onShoot: () => shoot(),
  onReset: () => reset(),
  onCueSelect: (id) => {
    selectedCue = id;
    hud.setCueActive(id);
    markDirty();
  },
});

const cueBall = (): BallState => world.ballById(selectedCue);

function strikeParams() {
  return {
    dir: aimDir.clone(),
    Vcue: powerToSpeed(power),
    a: tipA,
    b: tipB,
    elev: (elevDeg * Math.PI) / 180,
    cueId: selectedCue,
  };
}

function markDirty(): void {
  if (state === 'aim') predictionDirty = true;
}

function refreshPrediction(): void {
  currentPrediction = predict(world, strikeParams());
  entities.updatePrediction(currentPrediction);
  entities.setCueAim(cueBall().pos, aimDir, 0.03 + power * 0.0018, true, (elevDeg * Math.PI) / 180);
  predictionDirty = false;
}

function shoot(): void {
  if (state !== 'aim') return;
  const cue = cueBall();
  applyStrike(cue, strikeParams());
  state = 'run';
  entities.setCueAim(cue.pos, aimDir, 0, false);
  entities.updatePrediction(null);
  currentPrediction = null;
  hud.setStatus('구르는 중...');
}

function reset(): void {
  world = World.initial();
  entities.syncWorld(world);
  state = 'aim';
  markDirty();
  applyCamera(camMode);
  hud.setStatus(STATUS_AIM);
}

function rotateAim(angle: number): void {
  if (state !== 'aim') return;
  aimDir.applyAxisAngle(UP_Y, angle).setY(0).normalize();
  markDirty();
}

function adjustPower(delta: number): void {
  if (state !== 'aim') return;
  power = Math.min(100, Math.max(0, power + delta));
  hud.setPower(power);
  markDirty();
}

function adjustElev(delta: number): void {
  if (state !== 'aim') return;
  elevDeg = Math.min(60, Math.max(0, elevDeg + delta));
  hud.setElev(elevDeg);
  markDirty();
}

function setCamMode(mode: 1 | 2 | 3): void {
  camMode = mode;
  applyCamera(mode);
}

function applyCamera(mode: 1 | 2 | 3): void {
  const { camera, controls } = bundle;
  camera.up.set(0, 1, 0);
  if (mode === 1) {
    controls.enabled = false;
    camera.position.set(0, 3.6, 0.0001);
    camera.lookAt(0, 0, 0);
  } else if (mode === 2) {
    controls.enabled = false;
    const c = cueBall().pos;
    camera.position.set(c.x - aimDir.x * 1.15, 0.55, c.z - aimDir.z * 1.15);
    camera.lookAt(c.x + aimDir.x * 0.7, 0.02, c.z + aimDir.z * 0.7);
  } else {
    controls.enabled = true;
    controls.target.set(0, 0.02, 0);
    controls.update();
  }
}

let lastPointerX: number | null = null;

bundle.renderer.domElement.addEventListener('pointermove', (e) => {
  if (state !== 'aim' || englishDrag || orbitDragging || e.buttons !== 0) {
    lastPointerX = null;
    return;
  }
  if (lastPointerX !== null) {
    const dx = e.clientX - lastPointerX;
    if (dx !== 0) rotateAim(-dx * (e.shiftKey ? MOUSE_FINE : MOUSE_SENS));
  }
  lastPointerX = e.clientX;
});

bundle.renderer.domElement.addEventListener('pointerleave', () => {
  lastPointerX = null;
});

let englishDrag: { x: number; y: number } | null = null;

function applyTipDelta(daPx: number, dbPx: number): void {
  let a = tipA + daPx * TIP_DRAG_SCALE;
  let b = tipB + dbPx * TIP_DRAG_SCALE;
  const r = Math.hypot(a, b);
  if (r > MAX_TIP) {
    a *= MAX_TIP / r;
    b *= MAX_TIP / r;
  }
  tipA = a;
  tipB = b;
  hud.setTip(tipA, tipB);
  markDirty();
}

let orbitDragging = false;
bundle.controls.addEventListener('start', () => {
  orbitDragging = true;
});
bundle.controls.addEventListener('end', () => {
  orbitDragging = false;
});

bundle.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());

bundle.renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.button === 2 && state === 'aim') englishDrag = { x: e.clientX, y: e.clientY };
});

window.addEventListener('pointermove', (e) => {
  if (!englishDrag) return;
  applyTipDelta(-(e.clientY - englishDrag.y), e.clientX - englishDrag.x);
  englishDrag = { x: e.clientX, y: e.clientY };
});

window.addEventListener('pointerup', (e) => {
  if (e.button === 2) englishDrag = null;
});

window.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    shoot();
  } else if (e.code === 'ArrowUp') {
    e.preventDefault();
    adjustPower(e.shiftKey ? 1 : POWER_STEP);
  } else if (e.code === 'ArrowDown') {
    e.preventDefault();
    adjustPower(e.shiftKey ? -1 : -POWER_STEP);
  } else if (e.code === 'ArrowLeft') {
    e.preventDefault();
    rotateAim(e.shiftKey ? -AIM_FINE : -AIM_STEP);
  } else if (e.code === 'ArrowRight') {
    e.preventDefault();
    rotateAim(e.shiftKey ? AIM_FINE : AIM_STEP);
  } else if (e.code === 'PageUp') {
    e.preventDefault();
    adjustElev(e.shiftKey ? 1 : 5);
  } else if (e.code === 'PageDown') {
    e.preventDefault();
    adjustElev(e.shiftKey ? -1 : -5);
  } else if (e.code === 'KeyQ') rotateAim(e.shiftKey ? -AIM_FINE : -AIM_STEP);
  else if (e.code === 'KeyE') rotateAim(e.shiftKey ? AIM_FINE : AIM_STEP);
  else if (e.code === 'Digit1') setCamMode(1);
  else if (e.code === 'Digit2') setCamMode(2);
  else if (e.code === 'Digit3') setCamMode(3);
  else if (e.code === 'KeyR') reset();
  else if (e.code === 'KeyH') hud.toggleHelp();
});

entities.syncWorld(world);
hud.setStatus(STATUS_AIM);
markDirty();

const clock = new THREE.Clock();

bundle.renderer.setAnimationLoop(() => {
  const dt = Math.min(clock.getDelta(), 0.05);
  if (state === 'run') {
    world.step(dt);
    entities.syncWorld(world);
    if (world.isSettled()) {
      state = 'aim';
      hud.setStatus(STATUS_AIM);
      markDirty();
      if (camMode === 2) applyCamera(2);
    }
  } else if (predictionDirty) {
    refreshPrediction();
  }
  if (state === 'aim' && !predictionDirty && currentPrediction) {
    entities.setCueAim(cueBall().pos, aimDir, 0.03 + power * 0.0018, true, (elevDeg * Math.PI) / 180);
  }
  if (camMode === 3) bundle.controls.update();
  bundle.renderer.render(bundle.scene, bundle.camera);
});
