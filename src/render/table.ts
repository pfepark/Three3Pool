import * as THREE from 'three';
import { PLAY_W, PLAY_H } from '../physics/constants';

const CUSHION_WIDTH = 0.055;
const RAIL_WIDTH = 0.135;
const CUSHION_HEIGHT = 0.042;
const RAIL_HEIGHT = 0.055;

export function createTable(): THREE.Group {
  const table = new THREE.Group();

  const clothMat = new THREE.MeshStandardMaterial({ color: 0x2069a8, roughness: 0.94, metalness: 0 });
  const cushionMat = new THREE.MeshStandardMaterial({ color: 0x1d5c93, roughness: 0.9, metalness: 0 });
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x5a3d2b, roughness: 0.55, metalness: 0.05 });
  const apronMat = new THREE.MeshStandardMaterial({ color: 0x3a2718, roughness: 0.7, metalness: 0 });

  const bedW = PLAY_W + 2 * CUSHION_WIDTH + 2 * RAIL_WIDTH;
  const bedD = PLAY_H + 2 * CUSHION_WIDTH + 2 * RAIL_WIDTH;
  const bed = new THREE.Mesh(new THREE.BoxGeometry(bedW, 0.02, bedD), clothMat);
  bed.position.y = -0.01;
  bed.receiveShadow = true;
  table.add(bed);

  for (const side of [1, -1] as const) {
    const longCushion = buildCushion(PLAY_W, cushionMat);
    longCushion.position.z = (side * PLAY_H) / 2;
    if (side < 0) longCushion.rotation.y = Math.PI;
    table.add(longCushion);

    const shortCushion = buildCushion(PLAY_H, cushionMat);
    shortCushion.position.x = (side * PLAY_W) / 2;
    shortCushion.rotation.y = (side * Math.PI) / 2;
    table.add(shortCushion);

    const longRail = new THREE.Mesh(new THREE.BoxGeometry(bedW, RAIL_HEIGHT, RAIL_WIDTH), woodMat);
    longRail.position.set(0, RAIL_HEIGHT / 2, side * (PLAY_H / 2 + CUSHION_WIDTH + RAIL_WIDTH / 2));
    longRail.castShadow = true;
    longRail.receiveShadow = true;
    table.add(longRail);

    const shortRail = new THREE.Mesh(new THREE.BoxGeometry(RAIL_WIDTH, RAIL_HEIGHT, bedD), woodMat);
    shortRail.position.set(side * (PLAY_W / 2 + CUSHION_WIDTH + RAIL_WIDTH / 2), RAIL_HEIGHT / 2, 0);
    shortRail.castShadow = true;
    shortRail.receiveShadow = true;
    table.add(shortRail);
  }

  const apron = new THREE.Mesh(
    new THREE.BoxGeometry(bedW + 0.03, 0.14, bedD + 0.03),
    apronMat,
  );
  apron.position.y = -0.095;
  apron.castShadow = true;
  table.add(apron);

  addDiamonds(table);
  addSpots(table);

  return table;
}

function buildCushion(length: number, mat: THREE.Material): THREE.Mesh {
  const hw = length / 2;
  const shape = new THREE.Shape();
  shape.moveTo(-hw, 0);
  shape.lineTo(hw, 0);
  shape.lineTo(hw + CUSHION_WIDTH, -CUSHION_WIDTH);
  shape.lineTo(-hw - CUSHION_WIDTH, -CUSHION_WIDTH);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: CUSHION_HEIGHT, bevelEnabled: false });
  geo.rotateX(-Math.PI / 2);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function addDiamonds(table: THREE.Group): void {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf3ead2,
    roughness: 0.35,
    metalness: 0.4,
    emissive: 0x222015,
  });
  const geo = new THREE.CircleGeometry(0.009, 20);
  const railTopY = RAIL_HEIGHT + 0.0006;
  const outerX = PLAY_W / 2 + CUSHION_WIDTH + RAIL_WIDTH / 2;
  const outerZ = PLAY_H / 2 + CUSHION_WIDTH + RAIL_WIDTH / 2;

  const add = (x: number, z: number): void => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, railTopY, z);
    m.rotation.x = -Math.PI / 2;
    table.add(m);
  };

  for (const k of [-3, -2, -1, 1, 2, 3]) {
    const x = (k * PLAY_W) / 8;
    add(x, outerZ);
    add(x, -outerZ);
  }
  for (const k of [-1, 1]) {
    const z = (k * PLAY_H) / 4;
    add(outerX, z);
    add(-outerX, z);
  }
}

function addSpots(table: THREE.Group): void {
  const mat = new THREE.MeshBasicMaterial({ color: 0xe8e4da, transparent: true, opacity: 0.85 });
  const geo = new THREE.CircleGeometry(0.006, 16);
  const spots: [number, number][] = [
    [0, PLAY_H / 4],
    [-0.19, -PLAY_H / 4],
    [0.19, -PLAY_H / 4],
  ];
  for (const [x, z] of spots) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, 0.0008, z);
    m.rotation.x = -Math.PI / 2;
    table.add(m);
  }
}
