import * as THREE from 'three';
import { BALL_RADIUS } from '../physics/constants';
import type { BallId } from '../physics/ball';
import type { World } from '../physics/world';
import type { Prediction } from '../physics/predict';

const BALL_COLORS: Record<BallId, number> = {
  white: 0xf2efe9,
  yellow: 0xe8c520,
  red: 0xc62828,
};

const LINE_COLORS: Record<BallId, number> = {
  white: 0xffffff,
  yellow: 0xf4d03f,
  red: 0xff7a70,
};

export class Entities {
  group = new THREE.Group();
  private ballMeshes = new Map<BallId, THREE.Mesh>();
  private stick = new THREE.Group();
  private stickInner = new THREE.Group();
  private ghostBall: THREE.Mesh;
  private cueLine: THREE.Line;
  private objectLines = new Map<BallId, THREE.Line>();

  constructor() {
    const ballGeo = new THREE.SphereGeometry(BALL_RADIUS, 48, 32);
    for (const id of ['white', 'yellow', 'red'] as BallId[]) {
      const mat = new THREE.MeshPhysicalMaterial({
        color: BALL_COLORS[id],
        roughness: 0.32,
        metalness: 0,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
      });
      const mesh = new THREE.Mesh(ballGeo, mat);
      mesh.castShadow = true;
      this.ballMeshes.set(id, mesh);
      this.group.add(mesh);
    }

    this.buildStick();
    this.group.add(this.stick);

    this.ghostBall = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS, 24, 16),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.28,
        roughness: 0.15,
        clearcoat: 0.5,
        depthWrite: false,
      }),
    );
    this.ghostBall.visible = false;
    this.group.add(this.ghostBall);

    this.cueLine = new THREE.Line(
      new THREE.BufferGeometry(),
      new THREE.LineDashedMaterial({
        color: 0xffffff,
        dashSize: 0.025,
        gapSize: 0.02,
        transparent: true,
        opacity: 0.8,
      }),
    );
    this.cueLine.frustumCulled = false;
    this.cueLine.visible = false;
    this.group.add(this.cueLine);

    for (const id of ['yellow', 'red'] as BallId[]) {
      const line = new THREE.Line(
        new THREE.BufferGeometry(),
        new THREE.LineBasicMaterial({ color: LINE_COLORS[id], transparent: true, opacity: 0.95 }),
      );
      line.frustumCulled = false;
      line.visible = false;
      this.objectLines.set(id, line);
      this.group.add(line);
    }
  }

  private buildStick(): void {
    const len = 1.45;
    const shaftFront = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0068, 0.0092, len * 0.55, 20),
      new THREE.MeshStandardMaterial({ color: 0xd8b98a, roughness: 0.45 }),
    );
    const shaftBack = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0092, 0.0135, len * 0.45, 20),
      new THREE.MeshStandardMaterial({ color: 0x4a2c17, roughness: 0.4 }),
    );
    const ferrule = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0068, 0.0068, 0.01, 16),
      new THREE.MeshStandardMaterial({ color: 0xf5f3ec, roughness: 0.35 }),
    );
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0058, 0.0064, 0.008, 16),
      new THREE.MeshStandardMaterial({ color: 0x2b3a55, roughness: 0.7 }),
    );
    for (const m of [shaftFront, shaftBack, ferrule, tip]) {
      m.rotation.x = Math.PI / 2;
      m.castShadow = true;
    }
    tip.position.z = -0.004;
    ferrule.position.z = -0.013;
    shaftFront.position.z = -0.018 - (len * 0.55) / 2;
    shaftBack.position.z = -0.018 - len * 0.55 - (len * 0.45) / 2;
    this.stickInner.add(tip, ferrule, shaftFront, shaftBack);
    this.stick.add(this.stickInner);
    this.stick.visible = false;
  }

  syncWorld(world: World): void {
    for (const b of world.balls) {
      this.ballMeshes.get(b.id)!.position.copy(b.pos);
    }
  }

  setCueAim(origin: THREE.Vector3, dir: THREE.Vector3, pull: number, visible: boolean, elev = 0): void {
    this.stick.visible = visible;
    if (!visible) return;
    this.stick.position.copy(origin);
    this.stick.rotation.order = 'YXZ';
    this.stick.rotation.y = Math.atan2(dir.x, dir.z);
    this.stick.rotation.x = elev;
    this.stickInner.position.z = -pull;
  }

  updatePrediction(pred: Prediction | null): void {
    if (!pred) {
      this.cueLine.visible = false;
      this.ghostBall.visible = false;
      for (const l of this.objectLines.values()) l.visible = false;
      return;
    }
    setLinePoints(this.cueLine, pred.cuePath, true);
    this.ghostBall.visible = pred.ghost !== null;
    if (pred.ghost) this.ghostBall.position.copy(pred.ghost);
    for (const [id, line] of this.objectLines) {
      const path = pred.objectPaths.find((p) => p.id === id);
      if (path && path.points.length >= 2) setLinePoints(line, path.points, false);
      else line.visible = false;
    }
  }
}

function setLinePoints(line: THREE.Line, points: THREE.Vector3[], dashed: boolean): void {
  line.geometry.dispose();
  line.geometry = new THREE.BufferGeometry().setFromPoints(points);
  line.visible = true;
  if (dashed) line.computeLineDistances();
}
