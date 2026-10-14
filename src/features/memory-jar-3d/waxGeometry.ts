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

  // 병 안쪽 반경과 안전 경계 계산
  const safeMaxR = 0.88; // 병 유리 벽면과 충돌하지 않는 최대 중심 반경 (innerRadius 1.35 고려)
  const floorLimit = 0.38; // 병 바닥 아래로 뚫고 나가지 않는 최하단 Y
  const baseHeight = 0.40;

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

    // 4개 단위 층 분할 (1개 층이 바닥 전체 면적에 자연스럽게 퍼짐)
    const piecesPerLayer = 4;
    const layer = Math.floor(index / piecesPerLayer);
    const slotInLayer = index % piecesPerLayer;

    // 황금각(Golden Angle) 기반 자연스러운 회전 각도 + 개별 유기적 미세 각도 편차
    const angleStep = (Math.PI * 2) / piecesPerLayer;
    const layerTwist = layer * 1.15; // 층마다 서로 다른 방향으로 어긋나며 적재
    const angleJitter = (s1 - 0.5) * 0.45;
    const angle = slotInLayer * angleStep + layerTwist + angleJitter;

    // 중앙 밀집 원천 제거: 중심 부근(0.25R)부터 외곽 유리벽 근처(0.85R)까지 다양하게 랜덤 분산
    const baseRatios = [0.72, 0.38, 0.82, 0.48];
    const baseRatio = baseRatios[slotInLayer];
    const ratioJitter = (s2 - 0.5) * 0.22;
    const distRatio = Math.max(0.22, Math.min(0.88, baseRatio + ratioJitter));
    const distance = distRatio * safeMaxR;

    const x = Math.cos(angle) * distance;
    const z = Math.sin(angle) * distance;
    const yJitter = (s3 - 0.5) * 0.05;
    const y = baseHeight + layer * 0.19 + yJitter;

    mesh.position.set(x, y, z);

    // 실제 바닥에 자연스럽게 떨어져 눕혀진 실링 왁스 인장의 유기적 3D 회전
    // 1) 바닥에 안착된 기본 수평 눕힘 각도 (Math.PI / 2) + 약간의 불규칙한 기울기
    const pitch = (Math.PI / 2) + (s1 - 0.5) * 0.35;
    // 2) 전방향(0 ~ 360도) 자유롭고 자연스러운 인장 요(Yaw) 회전
    const yaw = s4 * Math.PI * 2;
    // 3) 미세한 롤(Roll) 틸트
    const roll = (s3 - 0.5) * 0.32;

    mesh.rotation.set(pitch, yaw, roll);

    waxGroup.add(mesh);
    waxMeshes.push(mesh);
  });

  // 물리 법칙 준수 보장: 초기 겹침 제거 및 바닥/유리벽 경계 완충 (Relaxation Passes)
  const coinRadius = 0.55 * WAX_SCALE;
  const minDist = coinRadius * 1.65; // 두 코인 사이 안전 비관통 최소 거리

  for (let pass = 0; pass < 25; pass++) {
    for (let i = 0; i < waxMeshes.length; i++) {
      const m1 = waxMeshes[i];

      // 바닥 및 외벽 경계 보정
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
