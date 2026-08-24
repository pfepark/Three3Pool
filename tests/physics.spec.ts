import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import {
  BALL_RADIUS,
  E_BALL_BALL,
  PLAY_W,
  PLAY_H,
} from '../src/physics/constants';
import { World } from '../src/physics/world';
import { resolveBallBall } from '../src/physics/collision';
import { applyStrike, strikeEfficiency } from '../src/physics/strike';
import { kineticEnergy, type BallState } from '../src/physics/ball';

const UP_R = BALL_RADIUS;

function parkOthers(w: World, ...keep: BallState[]): void {
  const kept = new Set(keep);
  let slot = 0;
  for (const b of w.balls) {
    if (kept.has(b)) continue;
    b.pos.set(-PLAY_W / 2 + 0.15, UP_R, -PLAY_H / 2 + 0.1 + slot * 0.22);
    b.vel.set(0, 0, 0);
    b.omega.set(0, 0, 0);
    slot++;
  }
}

describe('strike model', () => {
  it('center hit efficiency matches analytic value', () => {
    expect(strikeEfficiency(0, 0)).toBeCloseTo(1 / (1 + 0.21 / 0.55), 12);
  });

  it('a=+0.4R produces immediate natural roll', () => {
    const dir = new THREE.Vector3(1, 0, 0);
    const r = applyStrikeResult(dir, 2.5, 0.4 * BALL_RADIUS, 0);
    expect(r.speed).toBeGreaterThan(0);
    expect(r.omega.z + r.speed / BALL_RADIUS).toBeCloseTo(0, 9);
    expect(r.omega.x).toBeCloseTo(0, 9);
    expect(r.omega.y).toBeCloseTo(0, 9);
  });
});

function applyStrikeResult(dir: THREE.Vector3, V: number, a: number, b: number) {
  const w = World.initial();
  const cue = w.ballById('white');
  applyStrike(cue, { dir, Vcue: V, a, b });
  return { speed: cue.vel.length(), omega: cue.omega };
}

describe('ball-ball head-on', () => {
  it('impulse resolver: object takes (1+e)/2, cue keeps (1-e)/2', () => {
    const w = World.initial();
    const cue = w.ballById('white');
    const obj = w.ballById('red');
    cue.pos.set(-2 * BALL_RADIUS, UP_R, 0);
    obj.pos.set(0, UP_R, 0);
    cue.vel.set(2, 0, 0);
    obj.vel.set(0, 0, 0);
    resolveBallBall(cue, obj);
    expect(obj.vel.x).toBeCloseTo(((1 + E_BALL_BALL) / 2) * 2, 9);
    expect(cue.vel.x).toBeCloseTo(((1 - E_BALL_BALL) / 2) * 2, 9);
    expect(obj.vel.z).toBeCloseTo(0, 9);
    expect(cue.vel.z).toBeCloseTo(0, 9);
  });

  it('integrated rolling cue transfers speed at contact', () => {
    const w = World.initial();
    const cue = w.ballById('white');
    const obj = w.ballById('red');
    cue.pos.set(0, UP_R, 0);
    obj.pos.set(2 * BALL_RADIUS + 0.001, UP_R, 0);
    parkOthers(w, cue, obj);
    cue.vel.set(2, 0, 0);
    cue.omega.set(0, 0, -2 / BALL_RADIUS);

    let checked = false;
    for (let t = 0; t < 3 && !checked; ) {
      const dt = 0.002;
      w.step(dt, (ev) => {
        if (checked || ev.kind !== 'ball') return;
        checked = true;
        expect(obj.vel.length()).toBeCloseTo(((1 + E_BALL_BALL) / 2) * 2, 3);
        expect(cue.vel.length()).toBeCloseTo(((1 - E_BALL_BALL) / 2) * 2, 3);
      });
      t += dt;
    }
    expect(checked).toBe(true);
  });
});

describe('draw shot', () => {
  it('strong bottom spin reverses cue ball after contact', () => {
    const w = World.initial();
    const cue = w.ballById('white');
    const obj = w.ballById('red');
    cue.pos.set(-0.5, UP_R, 0);
    obj.pos.set(0, UP_R, 0);
    parkOthers(w, cue, obj);

    applyStrike(cue, {
      dir: new THREE.Vector3(1, 0, 0),
      Vcue: 4,
      a: -0.45 * BALL_RADIUS,
      b: 0,
    });

    let hit = false;
    for (let t = 0; t < 3 && !hit; ) {
      const dt = 0.002;
      w.step(dt, (ev) => {
        if (ev.kind === 'ball') hit = true;
      });
      t += dt;
    }
    expect(hit).toBe(true);
    expect(obj.vel.x).toBeGreaterThan(1.5);

    for (let t = 0; t < 0.12; t += 0.002) w.step(0.002);
    expect(cue.vel.x).toBeLessThan(-0.02);
  });
});

describe('side spin off cushion', () => {
  function reboundVz(spinY: number): number {
    const w = World.initial();
    const cue = w.ballById('white');
    parkOthers(w, cue);
    cue.pos.set(PLAY_W / 2 - 0.4, UP_R, 0);
    cue.vel.set(2, 0, 0);
    cue.omega.set(0, spinY, 0);
    for (let t = 0; t < 0.4; t += 0.002) w.step(0.002);
    return cue.vel.z;
  }

  it('+/- english deflect rebound in opposite directions', () => {
    const plus = reboundVz(60);
    const minus = reboundVz(-60);
    expect(plus).toBeGreaterThan(0.02);
    expect(minus).toBeLessThan(-0.02);
    expect(Math.abs(plus)).toBeCloseTo(Math.abs(minus), 2);
  });
});

describe('determinism', () => {
  it('identical inputs produce bit-identical outcomes', () => {
    const w1 = World.initial();
    const w2 = w1.clone();
    const dir = new THREE.Vector3(1, 0, 0.35).normalize();
    for (const w of [w1, w2]) {
      applyStrike(w.ballById('white'), {
        dir,
        Vcue: 6,
        a: 0.2 * BALL_RADIUS,
        b: 0.3 * BALL_RADIUS,
      });
    }
    for (let t = 0; t < 6; t += 1 / 120) {
      w1.step(1 / 120);
      w2.step(1 / 120);
    }
    for (let i = 0; i < w1.balls.length; i++) {
      expect(w2.balls[i].pos.x).toBe(w1.balls[i].pos.x);
      expect(w2.balls[i].pos.z).toBe(w1.balls[i].pos.z);
      expect(w2.balls[i].vel.x).toBe(w1.balls[i].vel.x);
      expect(w2.balls[i].vel.z).toBe(w1.balls[i].vel.z);
    }
  });
});

describe('energy monotonicity', () => {
  it('kinetic energy never increases across collisions', () => {
    const w = World.initial();
    applyStrike(w.ballById('white'), {
      dir: new THREE.Vector3(1, 0, 0.3).normalize(),
      Vcue: 7,
      a: -0.3 * BALL_RADIUS,
      b: 0.25 * BALL_RADIUS,
    });
    let ke = totalKE(w);
    for (let t = 0; t < 5; t += 0.002) {
      w.step(0.002);
      const next = totalKE(w);
      expect(next).toBeLessThanOrEqual(ke + 1e-9);
      ke = next;
    }
  });

  it('max-power english shot settles finite within 30s', () => {
    const w = World.initial();
    applyStrike(w.ballById('yellow'), {
      dir: new THREE.Vector3(1, 0, 0.4).normalize(),
      Vcue: 9,
      a: -0.45 * BALL_RADIUS,
      b: 0.45 * BALL_RADIUS,
    });
    let t = 0;
    while (!w.isSettled() && t < 30) {
      w.step(1 / 60);
      t += 1 / 60;
    }
    expect(w.isSettled()).toBe(true);
    expect(t).toBeLessThan(30);
    for (const b of w.balls) {
      expect(Number.isFinite(b.pos.x)).toBe(true);
      expect(Number.isFinite(b.pos.z)).toBe(true);
      expect(Math.abs(b.pos.x)).toBeLessThanOrEqual(PLAY_W / 2);
      expect(Math.abs(b.pos.z)).toBeLessThanOrEqual(PLAY_H / 2);
    }
  });
});

function totalKE(w: World): number {
  let sum = 0;
  for (const b of w.balls) sum += kineticEnergy(b);
  return sum;
}
