import * as THREE from 'three';
import { BALL_RADIUS, BALL_MASS, BALL_INERTIA } from './constants';

export type BallId = 'white' | 'yellow' | 'red';

export interface BallState {
  id: BallId;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  omega: THREE.Vector3;
}

const DOWN_R = new THREE.Vector3(0, -BALL_RADIUS, 0);
const SCRATCH = new THREE.Vector3();

export function makeBall(id: BallId, x: number, z: number): BallState {
  return {
    id,
    pos: new THREE.Vector3(x, BALL_RADIUS, z),
    vel: new THREE.Vector3(),
    omega: new THREE.Vector3(),
  };
}

export function copyBall(from: BallState, to: BallState): void {
  to.pos.copy(from.pos);
  to.vel.copy(from.vel);
  to.omega.copy(from.omega);
}

export function slipVelocity(out: THREE.Vector3, ball: BallState): THREE.Vector3 {
  return out.copy(ball.vel).add(SCRATCH.crossVectors(ball.omega, DOWN_R));
}

export function kineticEnergy(ball: BallState): number {
  const trans = 0.5 * BALL_MASS * ball.vel.lengthSq();
  const rot = 0.5 * BALL_INERTIA * ball.omega.lengthSq();
  return trans + rot;
}
