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

  const bevel = 0.08 * (radius / 0.55);
  const extrudeSettings: THREE.ExtrudeGeometryOptions = {
    depth: thickness,
    bevelEnabled: true,
    bevelSegments: 4,
    steps: 1,
    bevelSize: bevel,
    bevelThickness: bevel,
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
 * 리렌더링 시 흔들림 없이 일관된 유기적 배치를 보장하는 결정론적 의사 난수 생성기
 */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * 유리병 내부에 차곡차곡 자연스럽게 쌓이는 3D 왁스 그룹 생성 (중앙 밀집 해소 & 유기적 랜덤 안착)
 */
export function createWaxPiecesGroup(pieces: WaxPieceData[]): {
  waxGroup: THREE.Group;
  waxMeshes: THREE.Mesh[];
} {
  const waxGroup = new THREE.Group();
  waxGroup.name = 'WaxPiecesCollection';

  const waxMeshes: THREE.Mesh[] = [];

  // 사용자 요청: 실링 왁스 크기를 기존의 0.7배로 축소
  const WAX_SCALE = 0.7;

  // 병 안쪽 반경과 안전 경계 계산 (유리병 내부 바닥 Y=0.08 밀착)
  const safeMaxR = 0.86; // 병 유리 벽면과 충돌하지 않는 최대 중심 반경 (innerRadius 1.35 고려)
  const floorLimit = 0.14; // 병 바닥 바로 위에 닿는 실질적 최하단 중심 Y (두께 0.11 고려)
  const baseHeight = 0.14;

  pieces.forEach((piece, index) => {
    // 사용자의 요청에 따라 모든 왁스를 온전하고 매끄러운 원형 실링 왁스 인장 코인으로 통일 (0.7배 크기)
    const pieceSize = (piece.size || 1.0) * WAX_SCALE;
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
    mesh.receiveShadow = false; // 왁스 코인 자체 섀도우 수신 비활성화로 모바일 프래그먼트 셰이더 부하 절반 절감 (바닥 그림자는 유지)

    // 조각별 고유 시드를 사용한 결정론적 랜덤 (중앙 밀집 해소 & 병 바닥 전체 고른 유기적 분포)
    const s1 = pseudoRandom(index * 7 + 1);
    const s2 = pseudoRandom(index * 7 + 2);
    const s3 = pseudoRandom(index * 7 + 3);
    const s4 = pseudoRandom(index * 7 + 4);

    // 바닥부터 차곡차곡 쌓이는 3~4개 단위 층 분할 (1개 층이 바닥면에 평평하게 깔린 뒤 그 위에 포개짐)
    const piecesPerLayer = 3;
    const layer = Math.floor(index / piecesPerLayer);
    const slotInLayer = index % piecesPerLayer;

    // 황금각 기반 회전 + 층마다 서로 다른 방향으로 어긋나며 포개짐
    const angleStep = (Math.PI * 2) / piecesPerLayer;
    const layerTwist = layer * 1.35;
    const angleJitter = (s1 - 0.5) * 0.4;
    const angle = slotInLayer * angleStep + layerTwist + angleJitter;

    // 바닥면에 자연스럽게 분산 (중심 0.18R ~ 외곽 0.78R)
    const baseRatios = [0.65, 0.28, 0.72];
    const baseRatio = baseRatios[slotInLayer];
    const ratioJitter = (s2 - 0.5) * 0.18;
    const distRatio = Math.max(0.18, Math.min(0.82, baseRatio + ratioJitter));
    const distance = distRatio * safeMaxR;

    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const yJitter = (s3 - 0.5) * 0.03;
    // 층당 코인 두께(약 0.11)만큼 차곡차곡 겹쳐 쌓임
    const y = baseHeight + layer * 0.115 + yJitter;

    mesh.position.set(x, y, z);

    // 바닥(0층)은 거의 수평에 가깝게 납작하게 눕히고, 윗층은 아래 코인에 기대어 살짝 기움
    const tiltAmount = layer === 0 ? 0.12 : 0.28;
    const pitch = (Math.PI / 2) + (s1 - 0.5) * tiltAmount;
    const yaw = s4 * Math.PI * 2;
    const roll = (s3 - 0.5) * (tiltAmount * 0.8);

    mesh.rotation.set(pitch, yaw, roll);

    waxGroup.add(mesh);
    waxMeshes.push(mesh);
  });

  // 물리 법칙 준수 보장: 초기 겹침 제거 및 바닥/유리벽 경계 완충 (Relaxation Passes)
  const coinRadius = 0.55 * WAX_SCALE;
  const minDist = coinRadius * 1.65; // 두 코인 사이 안전 비관통 최소 거리

  for (let pass = 0; pass < 30; pass++) {
    for (let i = 0; i < waxMeshes.length; i++) {
      const m1 = waxMeshes[i];

      // 바닥 및 외벽 경계 보정 (바닥면 0.14 밑으로 내려가지 않음)
      if (m1.position.y < floorLimit) {
        m1.position.y = floorLimit;
      }
      const distXZ = Math.hypot(m1.position.x, m1.position.z);
      if (distXZ > safeMaxR) {
        m1.position.x = (m1.position.x / distXZ) * safeMaxR;
        m1.position.z = (m1.position.z / distXZ) * safeMaxR;
      }

      // 왁스 간 상호 충돌 분리
      for (let j = i + 1; j < waxMeshes.length; j++) {
        const m2 = waxMeshes[j];
        const dx = m2.position.x - m1.position.x;
        const dy = m2.position.y - m1.position.y;
        const dz = m2.position.z - m1.position.z;
        const dist = Math.hypot(dx, dy, dz);

        if (dist < minDist && dist > 0.0001) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;
          const push = overlap * 0.5;

          m1.position.x -= nx * push;
          m1.position.y -= ny * push * 0.8;
          m1.position.z -= nz * push;

          m2.position.x += nx * push;
          m2.position.y += ny * push * 0.8;
          m2.position.z += nz * push;
        }
      }
    }
  }

  // 최종 위치 확정 후 메타데이터 바인딩
  pieces.forEach((piece, index) => {
    const mesh = waxMeshes[index];
    if (mesh) {
      const pieceSize = (piece.size || 1.0) * WAX_SCALE;
      mesh.userData = {
        ...piece,
        size: pieceSize,
        originalPosition: mesh.position.clone(),
        originalRotation: mesh.rotation.clone(),
      };
    }
  });

  return { waxGroup, waxMeshes };
}
