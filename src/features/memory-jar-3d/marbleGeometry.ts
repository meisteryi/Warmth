import * as THREE from 'three';
import { WaxPieceData } from './types';

function createTwistedVaneGeometry(
  radius: number,
  twistAmount = 1.15,
  archOffset = 0.22
): THREE.BufferGeometry {
  const segU = 22;
  const segV = 8;

  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let iu = 0; iu <= segU; iu++) {
    const u = iu / segU;
    const s = u * 2 - 1;
    const profile = Math.sqrt(Math.max(0, 1 - s * s));
    const y = s * radius * 0.8;

    const twistAngle = Math.sin(s * Math.PI * 0.85) * twistAmount + s * 0.45;
    const cosA = Math.cos(twistAngle);
    const sinA = Math.sin(twistAngle);

    const maxReach = radius * 0.72 * Math.pow(profile, 0.72);

    for (let iv = 0; iv <= segV; iv++) {
      const v = iv / segV;
      const radial = v * maxReach;
      const cupCurve = Math.sin(v * Math.PI) * archOffset * radius * profile;

      const x = radial * cosA - cupCurve * sinA;
      const z = radial * sinA + cupCurve * cosA;

      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  const rowStride = segV + 1;
  for (let iu = 0; iu < segU; iu++) {
    for (let iv = 0; iv < segV; iv++) {
      const a = iu * rowStride + iv;
      const b = (iu + 1) * rowStride + iv;
      const c = (iu + 1) * rowStride + (iv + 1);
      const d = iu * rowStride + (iv + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

let sharedOuterSphereGeo: THREE.SphereGeometry | null = null;
let sharedBubbleGeo: THREE.SphereGeometry | null = null;
let sharedVaneGeos: THREE.BufferGeometry[] | null = null;

function ensureSharedGeometries() {
  if (!sharedOuterSphereGeo) {
    sharedOuterSphereGeo = new THREE.SphereGeometry(1, 32, 32);
  }
  if (!sharedBubbleGeo) {
    sharedBubbleGeo = new THREE.SphereGeometry(1, 10, 10);
  }
  if (!sharedVaneGeos) {
    sharedVaneGeos = [
      createTwistedVaneGeometry(1, 1.05, 0.24),
      createTwistedVaneGeometry(1, -1.2, 0.2),
      createTwistedVaneGeometry(1, 0.9, 0.26),
    ];
  }
}

/**
 * 사용자가 지정한 실링 왁스 색상을 구슬 내부 S-커브 리본 3가지 톤으로 변환
 */
function buildWaxColorRibbonTriad(hexColor: string): THREE.Color[] {
  let base: THREE.Color;
  try {
    base = new THREE.Color(hexColor || '#6B1724');
  } catch {
    base = new THREE.Color('#6B1724');
  }

  const highlight = base.clone().lerp(new THREE.Color(0xffffff), 0.34);
  const deepAccent = base.clone().offsetHSL(0.03, 0.08, -0.08);
  return [base, highlight, deepAccent];
}

export function createGlassMarble(
  piece: WaxPieceData,
  index: number,
  radius = 0.31
): { group: THREE.Group; outerMesh: THREE.Mesh } {
  ensureSharedGeometries();

  const ribbonColors = buildWaxColorRibbonTriad(piece.color);
  const marbleGroup = new THREE.Group();
  marbleGroup.name = `GlassMarble_${piece.id}`;

  const vaneGroup = new THREE.Group();
  const baseAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  const vaneGeo = sharedVaneGeos![index % sharedVaneGeos!.length];

  ribbonColors.forEach((ribbonColor, idx) => {
    const vaneMat = new THREE.MeshStandardMaterial({
      color: ribbonColor,
      emissive: ribbonColor,
      emissiveIntensity: 0.24,
      roughness: 0.22,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
    const vaneMesh = new THREE.Mesh(vaneGeo, vaneMat);
    vaneMesh.scale.setScalar(radius);
    vaneMesh.rotation.y = baseAngles[idx] + ((index * 0.37) % 1.0);
    vaneMesh.rotation.z = (idx - 1) * 0.14;
    vaneMesh.renderOrder = 1;
    vaneGroup.add(vaneMesh);
  });

  const bubbleMat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    emissive: 0xdffaf4,
    emissiveIntensity: 0.55,
    roughness: 0.05,
    transparent: true,
    opacity: 0.85,
  });

  const bubbleCount = 5;
  for (let b = 0; b < bubbleCount; b++) {
    const bMesh = new THREE.Mesh(sharedBubbleGeo!, bubbleMat);
    const br = radius * (0.02 + ((index + b) % 3) * 0.008);
    const angle = (b / bubbleCount) * Math.PI * 2 + index * 1.1;
    const dist = radius * (0.28 + ((b * 17 + index) % 5) * 0.08);
    const by = (((b * 23 + index * 7) % 11) / 10 - 0.5) * radius * 0.9;
    bMesh.scale.setScalar(br);
    bMesh.position.set(Math.cos(angle) * dist, by, Math.sin(angle) * dist);
    bMesh.renderOrder = 2;
    vaneGroup.add(bMesh);
  }

  marbleGroup.add(vaneGroup);

  const outerMat = new THREE.MeshPhysicalMaterial({
    color: 0xc4efe4,
    transparent: true,
    opacity: 0.34,
    roughness: 0.025,
    metalness: 0.0,
    ior: 1.52,
    reflectivity: 1.0,
    envMapIntensity: 2.1,
    specularIntensity: 1.0,
    specularColor: new THREE.Color(0xffffff),
    clearcoat: 1.0,
    clearcoatRoughness: 0.018,
    side: THREE.FrontSide,
    depthWrite: false,
  });

  const outerMesh = new THREE.Mesh(sharedOuterSphereGeo!, outerMat);
  outerMesh.scale.setScalar(radius);
  outerMesh.castShadow = true;
  outerMesh.receiveShadow = true;
  outerMesh.renderOrder = 4;
  // MemoryJarCanvas 레이캐스팅(1:1 일기 매칭)과 호버를 위해 WaxPieceData 그대로 바인딩
  outerMesh.userData = { ...piece, radius };
  marbleGroup.add(outerMesh);

  marbleGroup.userData = {
    ...piece,
    radius,
    outerMesh,
  };

  return { group: marbleGroup, outerMesh };
}

export function createGlassMarblesGroup(pieces: WaxPieceData[]): {
  marbleGroup: THREE.Group;
  marbleMeshes: THREE.Mesh[];
  marbleObjects: THREE.Group[];
} {
  const marbleGroup = new THREE.Group();
  marbleGroup.name = 'GlassMarblesGroup';
  const marbleMeshes: THREE.Mesh[] = [];
  const marbleObjects: THREE.Group[] = [];

  pieces.forEach((piece, idx) => {
    const sizeScale = Math.max(0.85, Math.min(1.15, piece.size || 1));
    const radius = 0.295 * sizeScale;
    const { group, outerMesh } = createGlassMarble(piece, idx, radius);

    const layer = Math.floor(idx / 9);
    const inLayer = idx % 9;
    const angle = inLayer * 2.39996 + layer * 0.7;
    const ringRadius = inLayer === 0 ? 0.08 : 0.36 + Math.sqrt(inLayer / 9) * 0.75;

    group.position.set(
      Math.cos(angle) * ringRadius,
      0.42 + layer * 0.62 + (idx % 3) * 0.05,
      Math.sin(angle) * ringRadius
    );

    group.rotation.set(
      ((idx * 1.13) % (Math.PI * 2)) - Math.PI,
      ((idx * 2.07) % (Math.PI * 2)) - Math.PI,
      ((idx * 0.71) % (Math.PI * 2)) - Math.PI
    );

    marbleGroup.add(group);
    marbleMeshes.push(outerMesh);
    marbleObjects.push(group);
  });

  return { marbleGroup, marbleMeshes, marbleObjects };
}

