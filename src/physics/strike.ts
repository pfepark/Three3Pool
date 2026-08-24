import * as THREE from 'three';
import { BALL_RADIUS, BALL_MASS, CUE_MASS } from './constants';
import type { BallState } from './ball';

export interface StrikeParams {
  dir: THREE.Vector3;
  Vcue: number;
  a: number;
  b: number;
}

export interface StrikeResult {
  speed: number;
  omega: THREE.Vector3;
}

const UP = new THREE.Vector3(0, 1, 0);
const SIDE = new THREE.Vector3();

export function strikeEfficiency(a: number, b: number): number {
  return 1 / (1 + BALL_MASS / CUE_MASS + (5 * (a * a + b * b)) / (2 * BALL_RADIUS * BALL_RADIUS));
}

export function computeStrike(params: StrikeParams): StrikeResult {
  const speed = strikeEfficiency(params.a, params.b) * params.Vcue;
  const side = SIDE.crossVectors(params.dir, UP).normalize();
  const omega = new THREE.Vector3()
    .addScaledVector(UP, params.b)
    .addScaledVector(side, -params.a)
    .multiplyScalar((5 * speed) / (2 * BALL_RADIUS * BALL_RADIUS));
  return { speed, omega };
}

export function applyStrike(ball: BallState, params: StrikeParams): void {
  const { speed, omega } = computeStrike(params);
  ball.vel.copy(params.dir).multiplyScalar(speed);
  ball.vel.y = 0;
  ball.omega.copy(omega);
}
