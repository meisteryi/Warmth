import * as THREE from 'three';

/**
 * 깔끔한 단일 겹(Single Layer) 빈티지 유리병 3D 지오메트리 & 셰이더 생성
 * 안쪽/바깥쪽 이중벽으로 인한 겹침/왜곡 현상을 완전히 없애고
 * 맑고 투명한 한 겹의 매끄러운 유리 외피로만 렌더링합니다.
 */
export function createGlassJarGroup(): {
  jarGroup: THREE.Group;
  glassMesh: THREE.Mesh;
  corkMesh: THREE.Mesh;
  rimMesh: THREE.Mesh;
} {
  const jarGroup = new THREE.Group();
  jarGroup.name = 'MemoryJarGroup';

  // 1. 단일 겹(Single Shell) 프로파일: 안쪽 되돌아오는 선 없이 하나의 매끄러운 외곽선만 정의
  const points: THREE.Vector2[] = [];
  
  // 바닥 중심 (0,0) -> 바닥 평면
  points.push(new THREE.Vector2(0.0, 0.0));
  points.push(new THREE.Vector2(1.65, 0.0));
  
  // 둥근 바닥 모서리 (완만한 곡면)
  points.push(new THREE.Vector2(1.85, 0.15));
  points.push(new THREE.Vector2(1.95, 0.45));

  // 몸체 기둥 (매끄러운 단일 원통)
  points.push(new THREE.Vector2(1.95, 3.2));
  
  // 어깨 곡선 (부드럽게 좁아지는 병목)
  points.push(new THREE.Vector2(1.85, 3.65));
  points.push(new THREE.Vector2(1.6, 4.05));
  points.push(new THREE.Vector2(1.3, 4.35));
  points.push(new THREE.Vector2(1.18, 4.6));

  // 병 입구 주둥이 (깔끔한 립 라인)
  points.push(new THREE.Vector2(1.24, 4.8));
  points.push(new THREE.Vector2(1.22, 5.0));
  points.push(new THREE.Vector2(1.12, 5.05));

  // 회전체 생성 (정교한 64각 원형)
  const jarGeometry = new THREE.LatheGeometry(points, 64);
  jarGeometry.computeVertexNormals();

  // 2. 단일 겹 전용 투명 광학 유리 재질 (Single-Layer Clear Physical Glass)
  // 두께(thickness) 볼륨 중첩을 배제하여 다중 겹 왜곡 없이 속이 훤히 비치는 맑은 유리
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xFFFFFF,
    transparent: true,
    opacity: 0.65,         // 은은하고 깨끗한 투명도
    transmission: 0.92,    // 빛 투과
    roughness: 0.05,       // 아주 매끄러운 광택
    metalness: 0.0,
    ior: 1.48,             // 맑은 유리 굴절률
    specularIntensity: 1.0,
    specularColor: new THREE.Color(0xFFFFFF),
    clearcoat: 1.0,        // 표면 코팅 빛반사
    clearcoatRoughness: 0.03,
    side: THREE.DoubleSide, // 단일 면의 앞/뒤만 자연스럽게 투과
    depthWrite: false,     // 내부 왁스 조각들이 선명하게 투과되도록 깊이 버퍼 설정
  });

  const glassMesh = new THREE.Mesh(jarGeometry, glassMaterial);
  glassMesh.castShadow = true;
  glassMesh.receiveShadow = true;
  glassMesh.name = 'GlassBody';
  jarGroup.add(glassMesh);

  // 3. 상단 원목 코르크 마개 (Cork Stopper)
  const corkGeo = new THREE.CylinderGeometry(1.08, 0.98, 0.65, 32);
  const corkMat = new THREE.MeshStandardMaterial({
    color: 0x8C6747, // 따뜻한 코르크 원목 컬러
    roughness: 0.85,
    metalness: 0.05,
    bumpScale: 0.05,
  });
  const corkMesh = new THREE.Mesh(corkGeo, corkMat);
  corkMesh.position.set(0, 5.1, 0);
  corkMesh.castShadow = true;
  corkMesh.receiveShadow = true;
  corkMesh.name = 'CorkStopper';
  jarGroup.add(corkMesh);

  // 4. 병목 앤틱 황동 링 장식 (Brass Rim Detail)
  const rimGeo = new THREE.TorusGeometry(1.2, 0.04, 16, 48);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xC5A059, // 앤틱 골드/황동
    metalness: 0.85,
    roughness: 0.3,
  });
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  rimMesh.rotation.x = Math.PI / 2;
  rimMesh.position.set(0, 4.62, 0);
  rimMesh.castShadow = true;
  rimMesh.name = 'BrassRim';
  jarGroup.add(rimMesh);

  // 병 중심점을 바닥이 아닌 정중앙으로 보정하여 자연스럽게 회전하도록 오프셋 설정
  jarGroup.position.y = -2.35;

  return { jarGroup, glassMesh, corkMesh, rimMesh };
}
