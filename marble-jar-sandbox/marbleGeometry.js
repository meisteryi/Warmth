import * as THREE from '/vendor/three.module.js';

/**
 * 레퍼런스 이미지(고양이 눈 유리구슬) 컬러 팔레트
 * - 맑은 민트-아쿠아빛 투명 유리구슬 안에 코발트블루, 오렌지앰버, 라임그린, 에메랄드, 러스트레드 나선 리본
 */
export const MARBLE_PALETTES = [
  { name: '파랑 · 주황 · 라임', colors: [0x1c7ed6, 0xe8590c, 0x94d82d] },
  { name: '하늘 · 앰버 · 에메랄드', colors: [0x339af0, 0xf08c00, 0x2b8a3e] },
  { name: '코발트 · 러스트 · 레몬', colors: [0x1864ab, 0xd9480f, 0xd8f542] },
  { name: '에메랄드 · 스카이 · 골드', colors: [0x12b886, 0x228be6, 0xf59f00] },
  { name: '주황 · 청록 · 연두', colors: [0xe64900, 0x15aabf, 0x82c91e] },
  { name: '딥블루 · 브론즈 · 민트', colors: [0x1971c2, 0xb85214, 0x51cf66] },
];

/**
 * 구슬 내부에 들어가는 3D S-커브 비틀린 리본(Cat's-eye Vane) 지오메트리 생성
 * - 양 끝이 뾰족하게 모이고 중앙부가 넓게 휘어지며 살짝 비틀리는 3차원 리본
 */
function createTwistedVaneGeometry(radius, twistAmount = 1.15, archOffset = 0.22) {
  const segU = 22; // 길이 방향 (세로축 -0.78R ~ +0.78R)
  const segV = 8;  // 폭 방향 (코어 -> 바깥쪽 날개)

  const positions = [];
  const uvs = [];
  const indices = [];

  for (let iu = 0; iu <= segU; iu++) {
    const u = iu / segU; // 0..1
    const s = u * 2 - 1; // -1..+1
    // 양 끝이 구슬 내부에서 자연스럽게 가늘어지는 타원형 프로파일
    const profile = Math.sqrt(Math.max(0, 1 - s * s));
    const y = s * radius * 0.8;

    // S자 곡선 비틀림 각도
    const twistAngle = Math.sin(s * Math.PI * 0.85) * twistAmount + s * 0.45;
    const cosA = Math.cos(twistAngle);
    const sinA = Math.sin(twistAngle);

    // 코어에서 바깥쪽으로 뻗는 최대 날개 반경
    const maxReach = radius * 0.72 * Math.pow(profile, 0.72);

    for (let iv = 0; iv <= segV; iv++) {
      const v = iv / segV; // 0..1
      const radial = v * maxReach;
      // 날개가 살짝 컵처럼 휘어지도록 Z 오프셋 추가
      const cupCurve = Math.sin(v * Math.PI) * archOffset * radius * profile;

      const localX = radial;
      const localZ = cupCurve;

      const x = localX * cosA - localZ * sinA;
      const z = localX * sinA + localZ * cosA;

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

// 공유 지오메트리 캐시 (성능 최적화)
let sharedOuterSphereGeo = null;
let sharedBubbleGeo = null;
let sharedVaneGeos = null;

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
 * 투명 아쿠아 민트 유리구슬(Cat's-eye Glass Marble) 그룹 생성
 */
export function createGlassMarble(index, radius = 0.31) {
  ensureSharedGeometries();

  const palette = MARBLE_PALETTES[index % MARBLE_PALETTES.length];
  const marbleGroup = new THREE.Group();
  marbleGroup.name = `GlassMarble_${index}`;

  // 1. 내부 고양이 눈 컬러 리본 3장 (서로 다른 각도로 교차)
  const vaneGroup = new THREE.Group();
  const baseAngles = [0, (Math.PI * 2) / 3, (Math.PI * 4) / 3];
  const vaneGeo = sharedVaneGeos[index % sharedVaneGeos.length];

  palette.colors.forEach((hex, idx) => {
    const vaneMat = new THREE.MeshStandardMaterial({
      color: hex,
      emissive: hex,
      emissiveIntensity: 0.22, // 유리 내부에서 빛을 머금은 듯 선명한 발색
      roughness: 0.22,
      metalness: 0.04,
      side: THREE.DoubleSide,
    });
    const vaneMesh = new THREE.Mesh(vaneGeo, vaneMat);
    vaneMesh.scale.setScalar(radius);
    vaneMesh.rotation.y = baseAngles[idx] + (index * 0.37) % 1.0;
    vaneMesh.rotation.z = (idx - 1) * 0.14;
    vaneMesh.renderOrder = 1;
    vaneGroup.add(vaneMesh);
  });

  // 2. 유리 속 미세 기포(Micro-bubbles) 포인트
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
    const bMesh = new THREE.Mesh(sharedBubbleGeo, bubbleMat);
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

  // 3. 맑은 연민트-아쿠아 유리 외피 (Outer Clear Aqua Glass Sphere)
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
    clearcoatRoughness: 0.02,
    depthWrite: false,
  });

  const outerMesh = new THREE.Mesh(sharedOuterSphereGeo, outerMat);
  outerMesh.scale.setScalar(radius);
  outerMesh.castShadow = true;
  outerMesh.receiveShadow = false;
  outerMesh.renderOrder = 4;
  outerMesh.userData = {
    marbleIndex: index,
    paletteName: palette.name,
    colors: palette.colors,
    radius,
  };
  marbleGroup.add(outerMesh);

  // 4. 유리구슬 내부 굴절감을 살려주는 은은한 테두리 광택 림 (Rim Highlight)
  const rimMat = new THREE.MeshBasicMaterial({
    color: 0xd9faf2,
    transparent: true,
    opacity: 0.12,
    side: THREE.BackSide,
    depthWrite: false,
  });
  const innerRim = new THREE.Mesh(sharedOuterSphereGeo, rimMat);
  innerRim.scale.setScalar(radius * 0.96);
  innerRim.renderOrder = 3;
  marbleGroup.add(innerRim);

  marbleGroup.userData = {
    marbleIndex: index,
    paletteName: palette.name,
    colors: palette.colors,
    radius,
    outerMesh,
  };

  return marbleGroup;
}

/**
 * N개의 구슬을 병 바닥부터 차곡차곡 자연스럽게 쌓아 초기 배치 생성
 */
export function createMarblesGroup(count = 28) {
  const group = new THREE.Group();
  group.name = 'GlassMarblesGroup';
  const marbles = [];

  for (let i = 0; i < count; i++) {
    const radius = 0.295 + (i % 3) * 0.015; // 0.295 ~ 0.325 살짝씩 다른 구슬 크기
    const marble = createGlassMarble(i, radius);

    // 나선형 층 쌓기 초기 좌표
    const layer = Math.floor(i / 8);
    const idxInLayer = i % 8;
    const angle = idxInLayer * ((Math.PI * 2) / 8) + layer * 0.65;
    const r = idxInLayer === 0 && layer % 2 === 0 ? 0.12 : 0.65 + (idxInLayer % 3) * 0.24;

    marble.position.set(
      Math.cos(angle) * r,
      radius + 0.1 + layer * 0.56,
      Math.sin(angle) * r
    );
    marble.rotation.set(
      ((i * 1.7) % (Math.PI * 2)),
      ((i * 2.3) % (Math.PI * 2)),
      ((i * 0.9) % (Math.PI * 2))
    );

    group.add(marble);
    marbles.push(marble);
  }

  return { marblesGroup: group, marbleObjects: marbles };
}

