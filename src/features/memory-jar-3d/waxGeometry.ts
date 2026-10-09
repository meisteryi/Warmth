import * as THREE from 'three';
import { WaxPieceData } from './types';

/**
 * 3D 왁스 인장 코인 지오메트리 생성 (원형 인장 스탬프 축소판)
 */
function createWaxCoinGeometry(radius: number, thickness: number): THREE.BufferGeometry {
  const shape = new THREE.Shape();
  // 약간의 불규칙성을 준 유기적 원형 둘레
  const segments = 32;
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    // 왁스가 흘러내린 듯한 미세한 유기적 굴곡
    const r = radius * (1 + 0.04 * Math.sin(theta * 5) + 0.02 * Math.cos(theta * 7));
    const x = r * Math.cos(theta);
    const y = r * Math.sin(theta);
    if (i === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }

  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: 0.08,
    bevelThickness: 0.08,
  };

  const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
  geo.center();
  return geo;
}

/**
 * 3D 깨진 왁스 파편 지오메트리 생성 (불규칙한 각진 단면)
 */
function createWaxFragmentGeometry(size: number): THREE.BufferGeometry {
  const geo = new THREE.DodecahedronGeometry(size * 0.45, 0);
  // 꼭짓점 좌표에 불규칙한 노이즈를 주어 깨진 단면 생성
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);
    pos.setXYZ(
      i,
      x * (0.8 + Math.random() * 0.4),
      y * (0.5 + Math.random() * 0.4), // 납작하게 파편화
      z * (0.8 + Math.random() * 0.4)
    );
  }
  geo.computeVertexNormals();
  geo.center();
  return geo;
}

/**
 * 유리병 내부에 차곡차곡 자연스럽게 쌓이는 3D 왁스 그룹 생성
 */
export function createWaxPiecesGroup(pieces: WaxPieceData[]): {
  waxGroup: THREE.Group;
  waxMeshes: THREE.Mesh[];
} {
  const waxGroup = new THREE.Group();
  waxGroup.name = 'WaxPiecesCollection';

  const waxMeshes: THREE.Mesh[] = [];

  // 병 안쪽 반경과 층 높이 계산
  const innerRadius = 1.35;
  const baseHeight = 0.45;

  pieces.forEach((piece, index) => {
    // 사용자의 요청에 따라 모든 왁스를 온전하고 매끄러운 원형 실링 왁스 인장 코인으로 통일
    const pieceSize = piece.size || 1.0;
    const geo = createWaxCoinGeometry(0.55 * pieceSize, 0.16 * pieceSize);

    // 왁스 특유의 매트하고 쫀득한 PBR 질감
    const colorHex = parseInt(piece.color.replace('#', '0x'), 16) || 0x6B1724;
    const mat = new THREE.MeshStandardMaterial({
      color: colorHex,
      roughness: 0.45,       // 실링 왁스의 부드러운 매트함
      metalness: 0.1,        // 약간의 고급스러운 광택
      bumpScale: 0.03,
    });

    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;

    // 자연스러운 바닥 적재(Settling) 좌표 계산
    // 나선형(Spiral) + 약간의 난수로 병 바닥부터 층층이 채움
    const angle = index * 2.39996; // 황금각 (Golden Angle)
    const layer = Math.floor(index / 4); // 4개당 1층
    const layerSubIndex = index % 4;
    const distance = (0.2 + (layerSubIndex / 4) * 0.85) * innerRadius;

    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const y = baseHeight + layer * 0.38 + (Math.random() * 0.08 - 0.04);

    mesh.position.set(x, y, z);

    // 자연스럽게 비스듬히 누운 회전각
    mesh.rotation.set(
      (Math.PI / 2) + (Math.random() * 0.5 - 0.25),
      Math.random() * Math.PI * 2,
      Math.random() * 0.6 - 0.3
    );

    // 인터랙션 메타데이터 직접 바인딩 (시각적 코인 지오메트리에 1:1 정확한 레이캐스팅)
    const metadata = {
      ...piece,
      originalPosition: mesh.position.clone(),
      originalRotation: mesh.rotation.clone(),
    };
    mesh.userData = metadata;

    waxGroup.add(mesh);
    waxMeshes.push(mesh);
  });

  return { waxGroup, waxMeshes };
}
