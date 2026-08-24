import * as THREE from 'three';
import {
  BALL_RADIUS,
  G,
  MU_SLIDE,
  MU_ROLL,
  MU_SPIN,
  SLIDE_EPS,
  STOP_SPEED_EPS,
  SPIN_STOP_EPS,
  MAX_SUBSTEP,
  MAX_EVENTS_PER_STEP,
  CUSHION_REACH,
  PLAY_W,
  PLAY_H,
} from './constants';
import { makeBall, slipVelocity, type BallState, type BallId } from './ball';
import { findEarliestCollision, resolveBallBall, resolveCushion, type CollisionEvent } from './collision';

const UP_Y = new THREE.Vector3(0, 1, 0);
const U = new THREE.Vector3();
const UHAT = new THREE.Vector3();
const VHAT = new THREE.Vector3();
const VEL0 = new THREE.Vector3();
const OMEGA_D = new THREE.Vector3();
const N = new THREE.Vector3();
const ROLL_AXIS = new THREE.Vector3();

const TABLE_LIMIT_X = PLAY_W / 2 - CUSHION_REACH;
const TABLE_LIMIT_Z = PLAY_H / 2 - CUSHION_REACH;

export type CollisionListener = (event: CollisionEvent) => void;

export class World {
  balls: BallState[];

  constructor(balls?: BallState[]) {
    this.balls =
      balls ?? [
        makeBall('red', 0, PLAY_H / 4),
        makeBall('white', -0.19, -PLAY_H / 4),
        makeBall('yellow', 0.19, -PLAY_H / 4),
      ];
  }

  static initial(): World {
    return new World();
  }

  clone(): World {
    return new World(
      this.balls.map((b) => ({
        id: b.id,
        pos: b.pos.clone(),
        vel: b.vel.clone(),
        omega: b.omega.clone(),
      })),
    );
  }

  ballById(id: BallId): BallState {
    return this.balls.find((b) => b.id === id)!;
  }

  isSettled(): boolean {
    for (const b of this.balls) {
      if (b.vel.lengthSq() > 1e-12) return false;
      if (Math.abs(b.omega.y) > SPIN_STOP_EPS) return false;
      slipVelocity(U, b);
      if (U.lengthSq() > SLIDE_EPS * SLIDE_EPS) return false;
    }
    return true;
  }

  step(dt: number, onCollision?: CollisionListener): void {
    let remaining = dt;
    let events = 0;
    while (remaining > 1e-12 && events < MAX_EVENTS_PER_STEP) {
      const horizon = Math.min(remaining, MAX_SUBSTEP);
      const ev = findEarliestCollision(this.balls, horizon);
      if (ev && ev.t <= horizon) {
        if (ev.t > 1e-12) this.integrate(ev.t);
        if (ev.kind === 'ball') resolveBallBall(this.balls[ev.i], this.balls[ev.j]);
        else resolveCushion(this.balls[ev.i], ev.wall);
        onCollision?.(ev);
        events++;
        remaining -= ev.t;
      } else {
        this.integrate(horizon);
        remaining -= horizon;
      }
      this.depenetrate();
    }
  }

  private depenetrate(): void {
    for (let i = 0; i < this.balls.length; i++) {
      for (let j = i + 1; j < this.balls.length; j++) {
        const A = this.balls[i];
        const B = this.balls[j];
        N.subVectors(B.pos, A.pos);
        N.y = 0;
        const d = N.length();
        const pen = 2 * BALL_RADIUS - d;
        if (pen > 1e-9 && d > 1e-12) {
          N.multiplyScalar(1 / d);
          A.pos.addScaledVector(N, -pen / 2);
          B.pos.addScaledVector(N, pen / 2);
        }
      }
      clampToTable(this.balls[i].pos);
    }
  }

  private integrate(dt: number): void {
    for (const ball of this.balls) {
      slipVelocity(U, ball);
      const us = U.length();
      if (us > SLIDE_EPS) {
        const slideTime = us / ((7 / 2) * MU_SLIDE * G);
        const tAct = Math.min(slideTime, dt);
        UHAT.copy(U).multiplyScalar(1 / us);
        VEL0.copy(ball.vel);
        ball.vel.addScaledVector(UHAT, -MU_SLIDE * G * tAct);
        ball.pos.addScaledVector(VEL0, tAct).addScaledVector(UHAT, -0.5 * MU_SLIDE * G * tAct * tAct);
        OMEGA_D.crossVectors(UP_Y, UHAT).multiplyScalar(((5 * MU_SLIDE * G) / (2 * BALL_RADIUS)) * tAct);
        ball.omega.add(OMEGA_D);
        const rem = dt - tAct;
        if (rem > 1e-12) this.integrateRolling(ball, rem);
      } else {
        this.integrateRolling(ball, dt);
      }
      decayVerticalSpin(ball, dt);
    }
  }

  private integrateRolling(ball: BallState, dt: number): void {
    const speed = Math.hypot(ball.vel.x, ball.vel.z);
    if (speed < STOP_SPEED_EPS) {
      ball.vel.set(0, 0, 0);
      snapRolling(ball);
      return;
    }
    VHAT.copy(ball.vel).multiplyScalar(1 / speed);
    const fullDec = MU_ROLL * G * dt;
    if (fullDec >= speed) {
      const tStop = speed / (MU_ROLL * G);
      ball.pos.addScaledVector(VHAT, 0.5 * speed * tStop);
      ball.vel.set(0, 0, 0);
    } else {
      ball.vel.addScaledVector(VHAT, -fullDec);
      ball.pos.addScaledVector(VHAT, speed * dt - 0.5 * fullDec * dt);
    }
    snapRolling(ball);
  }
}

function snapRolling(ball: BallState): void {
  ROLL_AXIS.crossVectors(UP_Y, ball.vel);
  ball.omega.x = ROLL_AXIS.x / BALL_RADIUS;
  ball.omega.z = ROLL_AXIS.z / BALL_RADIUS;
}

function decayVerticalSpin(ball: BallState, dt: number): void {
  const drop = ((5 * MU_SPIN * G) / (2 * BALL_RADIUS)) * dt;
  if (Math.abs(ball.omega.y) <= drop + SPIN_STOP_EPS) ball.omega.y = 0;
  else ball.omega.y -= Math.sign(ball.omega.y) * drop;
}

function clampToTable(pos: THREE.Vector3): void {
  if (pos.x > TABLE_LIMIT_X) pos.x = TABLE_LIMIT_X;
  else if (pos.x < -TABLE_LIMIT_X) pos.x = -TABLE_LIMIT_X;
  if (pos.z > TABLE_LIMIT_Z) pos.z = TABLE_LIMIT_Z;
  else if (pos.z < -TABLE_LIMIT_Z) pos.z = -TABLE_LIMIT_Z;
}
