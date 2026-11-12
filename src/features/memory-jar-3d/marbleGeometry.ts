import * as THREE from 'three';
import { WaxPieceData } from './types';

function createTwistedVaneGeometry(
  radius: number,
  twistAmount = 1.15,
  archOffset = 0.22
): THREE.BufferGeometry {
  const segU = 18;
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
      // -1..+1 대칭 폭으로 단일 리본 1개가 구슬 중심을 우아하게 가로지름
      const radial = (v * 2 - 1) * maxReach;
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
let sharedVaneGeos: THREE.BufferGeometry[] | null = null;

function ensureSharedGeometries() {
  if (!sharedOuterSphereGeo) {
    sharedOuterSphereGeo = new THREE.SphereGeometry(1, 28, 28);
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
 * 사용자가 지정한 실링 왁스 단일 색상 반환
 */
function parseWaxColor(hexColor: string): THREE.Color {
  try {
    return new THREE.Color(hexColor || '#6B1724');
  } catch {
    return new THREE.Color('#6B1724');
  }
}

export function createGlassMarble(
  piece: WaxPieceData,
  index: number,
  radius = 0.4425
): { group: THREE.Group; outerMesh: THREE.Mesh } {
  ensureSharedGeometries();

  const singleColor = parseWaxColor(piece.color);
  const marbleGroup = new THREE.Group();
  marbleGroup.name = `GlassMarble_${piece.id}`;

  // 구슬 안쪽은 사용자가 선택한 단일 색상의 오브젝트 1개만 배치해 그래픽 부하 최소화
  const vaneGeo = sharedVaneGeos![index % sharedVaneGeos!.length];
  const vaneMat = new THREE.MeshStandardMaterial({
    color: singleColor,
    emissive: singleColor,
    emissiveIntensity: 0.25,
    roughness: 0.22,
    metalness: 0.04,
    side: THREE.DoubleSide,
  });
  const vaneMesh = new THREE.Mesh(vaneGeo, vaneMat);
  vaneMesh.scale.setScalar(radius);
  vaneMesh.rotation.y = ((index * 0.73) % (Math.PI * 2));
  vaneMesh.rotation.z = ((index % 3) - 1) * 0.16;
  vaneMesh.renderOrder = 1;
  marbleGroup.add(vaneMesh);

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
    const radius = 0.295 * 1.5 * sizeScale;
    const { group, outerMesh } = createGlassMarble(piece, idx, radius);

    const layer = Math.floor(idx / 5);
    const inLayer = idx % 5;
    const angle = inLayer * 2.39996 + layer * 0.7;
    const ringRadius = inLayer === 0 ? 0.06 : 0.48 + Math.sqrt(inLayer / 5) * 0.52;

    group.position.set(
      Math.cos(angle) * ringRadius,
      0.55 + layer * 0.88 + (idx % 3) * 0.05,
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

