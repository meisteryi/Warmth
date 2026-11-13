import * as THREE from 'three';
import { WaxPieceData } from './types';

/**
 * 유리구슬 내부에 영롱하게 빛나는 3D 입체 별(Star) 지오메트리 생성
 */
function createStarGeometry(
  points = 5,
  outerRadius = 0.56,
  innerRadius = 0.25,
  thickness = 0.16,
  bevel = 0.05
): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  const step = Math.PI / points;

  for (let i = 0; i < 2 * points; i++) {
    const r = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = i * step - Math.PI / 2; // 상단 꼭짓점이 수직 위를 향하도록
    const x = Math.cos(angle) * r;
    const y = Math.sin(angle) * r;
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 3,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.center();
  geo.computeVertexNormals();
  return geo;
}

let sharedOuterSphereGeo: THREE.SphereGeometry | null = null;
let sharedStarGeo: THREE.BufferGeometry | null = null;

function ensureSharedGeometries() {
  if (!sharedOuterSphereGeo) {
    sharedOuterSphereGeo = new THREE.SphereGeometry(1, 28, 28);
  }
  if (!sharedStarGeo) {
    sharedStarGeo = createStarGeometry();
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

  // 구슬 안쪽에는 사용자가 지정한 단일 왁스 색상의 3D 입체 별 1개만 배치
  const starMat = new THREE.MeshStandardMaterial({
    color: singleColor,
    emissive: singleColor,
    emissiveIntensity: 0.28,
    roughness: 0.25,
    metalness: 0.12,
    side: THREE.DoubleSide,
  });
  const starMesh = new THREE.Mesh(sharedStarGeo!, starMat);
  starMesh.scale.setScalar(radius);
  // 구슬마다 별이 다양한 각도로 아름답게 기울어져 빛을 반사하도록 설정
  starMesh.rotation.set(
    (index * 0.73) % (Math.PI * 2),
    (index * 1.37) % (Math.PI * 2),
    (index * 0.49) % (Math.PI * 2)
  );
  starMesh.renderOrder = 1;
  marbleGroup.add(starMesh);

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

