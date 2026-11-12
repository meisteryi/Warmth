import * as THREE from '/vendor/three.module.js';

/**
 * 온기(Warmth) 실링 왁스 병과 100% 동일한 단일 겹 빈티지 유리병 3D 지오메트리
 * (src/features/memory-jar-3d/jarGeometry.ts 동일 사양)
 */
export function createGlassJarGroup(initialOptions = {}) {
  const jarGroup = new THREE.Group();
  jarGroup.name = 'MemoryJarGroup';

  const points = [];
  // 바닥 중심 (0,0) -> 바닥 평면
  points.push(new THREE.Vector2(0.0, 0.0));
  points.push(new THREE.Vector2(1.65, 0.0));

  // 둥근 바닥 모서리
  points.push(new THREE.Vector2(1.85, 0.15));
  points.push(new THREE.Vector2(1.95, 0.45));

  // 몸체 기둥
  points.push(new THREE.Vector2(1.95, 3.2));

  // 어깨 곡선 (병목)
  points.push(new THREE.Vector2(1.85, 3.65));
  points.push(new THREE.Vector2(1.6, 4.05));
  points.push(new THREE.Vector2(1.3, 4.35));
  points.push(new THREE.Vector2(1.18, 4.6));

  // 병 입구 주둥이
  points.push(new THREE.Vector2(1.24, 4.8));
  points.push(new THREE.Vector2(1.22, 5.0));
  points.push(new THREE.Vector2(1.12, 5.05));

  const jarGeometry = new THREE.LatheGeometry(points, 64);
  jarGeometry.computeVertexNormals();

  // 내부 유리구슬이 선명하게 투과되면서도 유리 표면 반사가 살아있는 광학 유리 재질
  const glassMaterial = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.42,
    roughness: 0.04,
    metalness: 0.0,
    ior: 1.5,
    reflectivity: 0.95,
    envMapIntensity: 1.5,
    specularIntensity: 1.0,
    specularColor: new THREE.Color(0xffffff),
    clearcoat: 1.0,
    clearcoatRoughness: 0.02,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const glassMesh = new THREE.Mesh(jarGeometry, glassMaterial);
  glassMesh.castShadow = false;
  glassMesh.receiveShadow = true;
  glassMesh.renderOrder = 10;
  glassMesh.name = 'GlassBody';
  jarGroup.add(glassMesh);

  // 상단 원목 코르크 마개
  const corkGeo = new THREE.CylinderGeometry(1.08, 0.98, 0.65, 32);
  const corkMat = new THREE.MeshStandardMaterial({
    color: 0x8c6747,
    roughness: 0.85,
    metalness: 0.05,
  });
  const corkMesh = new THREE.Mesh(corkGeo, corkMat);
  corkMesh.castShadow = true;
  corkMesh.receiveShadow = true;
  corkMesh.name = 'CorkStopper';

  const setCorkOpen = (isOpen) => {
    if (isOpen) {
      corkMesh.position.set(0.65, 5.35, 0.3);
      corkMesh.rotation.set(0.3, 0.15, -0.45);
    } else {
      corkMesh.position.set(0, 5.1, 0);
      corkMesh.rotation.set(0, 0, 0);
    }
  };

  setCorkOpen(initialOptions.isCorkOpen ?? false);
  jarGroup.add(corkMesh);

  // 병목 앤틱 황동 링 장식
  const rimGeo = new THREE.TorusGeometry(1.2, 0.04, 16, 48);
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xc5a059,
    metalness: 0.85,
    roughness: 0.3,
  });
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  rimMesh.rotation.x = Math.PI / 2;
  rimMesh.position.set(0, 4.62, 0);
  rimMesh.castShadow = true;
  rimMesh.name = 'BrassRim';
  jarGroup.add(rimMesh);

  jarGroup.position.y = -2.35;

  return { jarGroup, glassMesh, corkMesh, rimMesh, setCorkOpen };
}

