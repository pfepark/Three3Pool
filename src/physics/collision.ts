import * as THREE from 'three';
import {
  BALL_RADIUS,
  BALL_MASS,
  BALL_INERTIA,
  PLAY_W,
  PLAY_H,
  E_BALL_BALL,
  E_CUSHION,
  MU_THROW,
  MU_CUSHION,
  CUSHION_REACH,
  CUSHION_DYN_ARM,
  POSITION_SLOP,
} from './constants';
import type { BallState } from './ball';

export type Wall = 0 | 1 | 2 | 3;

export type CollisionEvent =
  | { kind: 'ball'; i: number; j: number; t: number }
  | { kind: 'cushion'; i: number; wall: Wall; t: number };

const WALL_NORMALS: readonly THREE.Vector3[] = [
  new THREE.Vector3(-1, 0, 0),
  new THREE.Vector3(1, 0, 0),
  new THREE.Vector3(0, 0, -1),
  new THREE.Vector3(0, 0, 1),
];

const UP_Y = new THREE.Vector3(0, 1, 0);

const N = new THREE.Vector3();
const W = new THREE.Vector3();
const D = new THREE.Vector3();
const S = new THREE.Vector3();
const ST = new THREE.Vector3();
const T = new THREE.Vector3();
const RC = new THREE.Vector3();
const RA = new THREE.Vector3();
const RB = new THREE.Vector3();
const CROSS = new THREE.Vector3();

export function wallNormal(wall: Wall): THREE.Vector3 {
  return WALL_NORMALS[wall];
}

function wallLimit(wall: Wall): number {
  return (wall < 2 ? PLAY_W : PLAY_H) / 2 - CUSHION_REACH;
}

export function toiBallBall(a: BallState, b: BallState): number | null {
  D.subVectors(b.pos, a.pos);
  D.y = 0;
  W.subVectors(b.vel, a.vel);
  W.y = 0;
  const A = W.lengthSq();
  const B = D.dot(W);
  const C = D.lengthSq() - 4 * BALL_RADIUS * BALL_RADIUS;
  if (C < 0) return B < 0 ? 0 : null;
  if (A < 1e-18 || B >= 0) return null;
  const disc = B * B - A * C;
  if (disc < 0) return null;
  const t = (-B - Math.sqrt(disc)) / A;
  return t >= 0 ? t : null;
}

export function toiCushion(ball: BallState, wall: Wall): number | null {
  const n = WALL_NORMALS[wall];
  const limit = wallLimit(wall);
  const v = -ball.vel.dot(n);
  if (v <= 0) return null;
  const p = -ball.pos.dot(n);
  const t = (limit - p) / v;
  return t >= 0 ? t : 0;
}

export function findEarliestCollision(balls: BallState[], horizon: number): CollisionEvent | null {
  let best: CollisionEvent | null = null;
  let tBest = horizon;
  for (let i = 0; i < balls.length; i++) {
    for (let j = i + 1; j < balls.length; j++) {
      const t = toiBallBall(balls[i], balls[j]);
      if (t !== null && t <= tBest) {
        tBest = t;
        best = { kind: 'ball', i, j, t };
      }
    }
    for (let wall = 0 as Wall; wall < 4; wall++) {
      const t = toiCushion(balls[i], wall);
      if (t !== null && t <= tBest) {
        tBest = t;
        best = { kind: 'cushion', i, wall, t };
      }
    }
  }
  return best;
}

export function resolveBallBall(A: BallState, B: BallState): void {
  N.subVectors(B.pos, A.pos);
  N.y = 0;
  const dist = N.length();
  if (dist < 1e-12) return;
  N.multiplyScalar(1 / dist);

  const pen = 2 * BALL_RADIUS - dist;
  if (pen > POSITION_SLOP) {
    const half = pen / 2;
    A.pos.addScaledVector(N, -half);
    B.pos.addScaledVector(N, half);
  }

  const vn = A.vel.dot(N) - B.vel.dot(N);
  if (vn <= 0) return;

  const jn = ((1 + E_BALL_BALL) * vn) / (2 / BALL_MASS);
  A.vel.addScaledVector(N, -jn / BALL_MASS);
  B.vel.addScaledVector(N, jn / BALL_MASS);

  RA.copy(N).multiplyScalar(BALL_RADIUS);
  RB.copy(RA).negate();
  S.crossVectors(A.omega, RA).add(A.vel);
  CROSS.crossVectors(B.omega, RB).add(B.vel);
  S.sub(CROSS);
  S.y = 0;
  ST.copy(S).addScaledVector(N, -S.dot(N));
  const stMag = ST.length();
  if (stMag > 1e-9) {
    ST.multiplyScalar(1 / stMag);
    const jt = Math.min(MU_THROW * jn, (BALL_MASS * stMag) / 7);
    A.vel.addScaledVector(ST, -jt / BALL_MASS);
    B.vel.addScaledVector(ST, jt / BALL_MASS);
    A.omega.addScaledVector(CROSS.crossVectors(RA, ST), -jt / BALL_INERTIA);
    B.omega.addScaledVector(CROSS.crossVectors(RB, ST), jt / BALL_INERTIA);
  }
}

export function resolveCushion(ball: BallState, wall: Wall): void {
  const n = WALL_NORMALS[wall];
  const limit = wallLimit(wall);
  const depth = -ball.pos.dot(n) - limit;
  if (depth > POSITION_SLOP) ball.pos.addScaledVector(n, depth);

  const vn = ball.vel.dot(n);
  if (vn >= 0) return;

  const c = CUSHION_DYN_ARM;
  const h = CUSHION_REACH;
  T.crossVectors(UP_Y, n);
  RC.copy(n).multiplyScalar(-h);
  RC.y = c;

  const un = vn + c * ball.omega.dot(T);
  const invMn = 1 / BALL_MASS + (c * c) / BALL_INERTIA;
  const jn = (-(1 + E_CUSHION) * un) / invMn;
  ball.vel.addScaledVector(n, jn / BALL_MASS);
  ball.omega.addScaledVector(T, (jn * c) / BALL_INERTIA);

  const omegaN = ball.omega.dot(n);
  const omegaY = ball.omega.y;
  const ut = ball.vel.dot(T) - omegaN * c - omegaY * h;
  const invMt = 1 / BALL_MASS + (h * h + c * c) / BALL_INERTIA;
  let jt = -ut / invMt;
  const maxJt = MU_CUSHION * jn;
  if (jt > maxJt) jt = maxJt;
  else if (jt < -maxJt) jt = -maxJt;
  ball.vel.addScaledVector(T, jt / BALL_MASS);
  ball.omega.x += (-n.x * c) * (jt / BALL_INERTIA);
  ball.omega.z += (-n.z * c) * (jt / BALL_INERTIA);
  ball.omega.y += (-h) * (jt / BALL_INERTIA);
}
