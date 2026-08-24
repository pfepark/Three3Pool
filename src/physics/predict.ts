import * as THREE from 'three';
import type { BallId } from './ball';
import { applyStrike, type StrikeParams } from './strike';
import type { CollisionEvent } from './collision';
import { World } from './world';

export interface Prediction {
  cuePath: THREE.Vector3[];
  objectPaths: { id: BallId; points: THREE.Vector3[] }[];
  ghost: THREE.Vector3 | null;
  ghostBallId: BallId | null;
}

export type PredictParams = StrikeParams & { cueId?: BallId };

const SAMPLE_DT = 1 / 60;
const HORIZON = 1.8;

export function predict(world: World, params: PredictParams): Prediction {
  const sim = world.clone();
  const cue = sim.ballById(params.cueId ?? 'white');
  applyStrike(cue, params);

  const allPaths = new Map<BallId, THREE.Vector3[]>();
  for (const b of sim.balls) allPaths.set(b.id, [b.pos.clone()]);

  let ghost: THREE.Vector3 | null = null;
  let ghostBallId: BallId | null = null;
  let contactIndex = -1;

  const onCollision = (ev: CollisionEvent): void => {
    if (contactIndex >= 0 || ev.kind !== 'ball') return;
    const idA = sim.balls[ev.i].id;
    const idB = sim.balls[ev.j].id;
    if (idA !== cue.id && idB !== cue.id) return;
    ghost = cue.pos.clone();
    ghostBallId = idA === cue.id ? idB : idA;
    contactIndex = allPaths.get(cue.id)!.length - 1;
  };

  const steps = Math.round(HORIZON / SAMPLE_DT);
  for (let s = 0; s < steps; s++) {
    sim.step(SAMPLE_DT, onCollision);
    for (const b of sim.balls) allPaths.get(b.id)!.push(b.pos.clone());
    if (contactIndex >= 0 && sim.isSettled()) break;
  }

  const cuePath = trimTail(allPaths.get(cue.id)!);
  const objectPaths: { id: BallId; points: THREE.Vector3[] }[] = [];
  if (contactIndex >= 0) {
    for (const b of sim.balls) {
      if (b.id === cue.id) continue;
      const moved = sliceMoving(allPaths.get(b.id)!, contactIndex);
      if (moved.length >= 2) objectPaths.push({ id: b.id, points: moved });
    }
  }

  return { cuePath, objectPaths, ghost, ghostBallId };
}

function trimTail(path: THREE.Vector3[]): THREE.Vector3[] {
  const last = path[path.length - 1];
  let end = path.length;
  while (end > 2 && path[end - 2].distanceToSquared(last) < 1e-8) end--;
  return path.slice(0, end);
}

function sliceMoving(path: THREE.Vector3[], from: number): THREE.Vector3[] {
  const sliced = path.slice(from);
  if (sliced.length < 2) return sliced;
  const last = sliced[sliced.length - 1];
  let end = sliced.length;
  while (end > 2 && sliced[end - 2].distanceToSquared(last) < 1e-8) end--;
  return sliced.slice(0, end);
}
