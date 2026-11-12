import * as THREE from '/vendor/three.module.js';

/**
 * 유리구슬과 유리병 표면 반사를 위한 밝은 스튜디오 소프트박스 환경맵 생성 (PMREM)
 */
function createStudioEnvironment(renderer) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  pmrem.compileEquirectangularShader();

  const envScene = new THREE.Scene();
  envScene.background = new THREE.Color(0x2a241e);

  // 상단 우측 대형 햇살 소프트박스 (구슬 상단에 선명한 흰색 광택 하이라이트 형성)
  const mainPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 10),
    new THREE.MeshBasicMaterial({ color: 0xfffaf0, side: THREE.DoubleSide })
  );
  mainPanel.position.set(6, 9, 6);
  mainPanel.lookAt(0, 0, 0);
  envScene.add(mainPanel);

  // 좌측 보조 반사판 (유리 윤곽 림라이트)
  const leftPanel = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 10),
    new THREE.MeshBasicMaterial({ color: 0xeaf6ff, side: THREE.DoubleSide })
  );
  leftPanel.position.set(-9, 4, 3);
  leftPanel.lookAt(0, 0, 0);
  envScene.add(leftPanel);

  // 정면 상단 소형 스페큘러 도트용 패널
  const frontDot = new THREE.Mesh(
    new THREE.CircleGeometry(1.8, 24),
    new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
  );
  frontDot.position.set(-2.5, 6.5, 8);
  frontDot.lookAt(0, 0, 0);
  envScene.add(frontDot);

  // 하단 따뜻한 반사광
  const floorBounce = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.MeshBasicMaterial({ color: 0x6b4c35, side: THREE.DoubleSide })
  );
  floorBounce.position.set(0, -7, 0);
  floorBounce.rotation.x = -Math.PI / 2;
  envScene.add(floorBounce);

  const envRT = pmrem.fromScene(envScene, 0.035);
  pmrem.dispose();
  return envRT.texture;
}

export class SunlightSceneManager {
  constructor(width, height, renderer) {
    this.scene = new THREE.Scene();
    this.scene.environment = createStudioEnvironment(renderer);

    this.camera = new THREE.PerspectiveCamera(36, width / height, 0.1, 100);
    this.camera.position.set(0, 2.8, 13.2);
    this.camera.lookAt(0, 0.15, 0);

    // 햇살 직사광
    this.sunLight = new THREE.DirectionalLight(0xfff5e0, 3.2);
    this.sunLight.position.set(6.0, 8.0, 5.0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 25;
    this.sunLight.shadow.bias = -0.001;
    this.scene.add(this.sunLight);

    // 따뜻한 환경광 + 좌측 림라이트
    this.ambientLight = new THREE.AmbientLight(0xffeed9, 1.45);
    this.scene.add(this.ambientLight);

    this.rimLight = new THREE.DirectionalLight(0xdff2ff, 0.9);
    this.rimLight.position.set(-6, 4, -3);
    this.scene.add(this.rimLight);

    // 원목 책상 텍스처 & 스튜디오 화이트 매트 프리셋 지원
    this.woodTexture = this.createAntiqueWoodTexture();
    this.woodDeskMat = new THREE.MeshStandardMaterial({
      map: this.woodTexture,
      roughness: 0.46,
      metalness: 0.04,
    });
    this.studioDeskMat = new THREE.MeshStandardMaterial({
      color: 0xf7f5f0,
      roughness: 0.38,
      metalness: 0.0,
    });

    const deskGeo = new THREE.BoxGeometry(20, 0.8, 16);
    this.deskMesh = new THREE.Mesh(deskGeo, this.woodDeskMat);
    this.deskMesh.position.set(0, -2.75, 0.5);
    this.deskMesh.receiveShadow = true;
    this.scene.add(this.deskMesh);
  }

  setDeskPreset(preset) {
    if (preset === 'studio') {
      this.deskMesh.material = this.studioDeskMat;
      this.scene.background = new THREE.Color(0xf4f2ed);
      this.ambientLight.intensity = 1.8;
    } else {
      this.deskMesh.material = this.woodDeskMat;
      this.scene.background = null;
      this.ambientLight.intensity = 1.45;
    }
  }

  createAntiqueWoodTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 0);
    bgGrad.addColorStop(0.0, '#1C0D05');
    bgGrad.addColorStop(0.25, '#261308');
    bgGrad.addColorStop(0.5, '#1E0F06');
    bgGrad.addColorStop(0.75, '#281409');
    bgGrad.addColorStop(1.0, '#170B04');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    const plankHeight = 256;
    for (let p = 0; p < 4; p++) {
      const py = p * plankHeight;
      ctx.fillStyle = `rgba(0, 0, 0, ${p % 2 === 0 ? 0.12 : 0.04})`;
      ctx.fillRect(0, py, 1024, plankHeight);
      ctx.fillStyle = 'rgba(8, 4, 2, 0.92)';
      ctx.fillRect(0, py - 2, 1024, 4);
      ctx.fillStyle = 'rgba(180, 130, 85, 0.12)';
      ctx.fillRect(0, py + 2, 1024, 2);
    }

    for (let i = 0; i < 560; i++) {
      const y = Math.random() * 1024;
      const alpha = 0.035 + Math.random() * 0.065;
      const isHighlight = Math.random() > 0.72;
      ctx.strokeStyle = isHighlight
        ? `rgba(165, 110, 70, ${alpha * 0.6})`
        : `rgba(10, 5, 2, ${alpha * 1.2})`;
      ctx.lineWidth = 1 + Math.random() * 2.0;

      ctx.beginPath();
      let cx = 0;
      let cy = y;
      ctx.moveTo(cx, cy);
      while (cx < 1024) {
        cx += 35 + Math.random() * 55;
        cy = y + Math.sin(cx * 0.015) * 8 + Math.cos(cx * 0.006) * 12;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    const vigGrad = ctx.createRadialGradient(512, 512, 260, 512, 512, 720);
    vigGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vigGrad.addColorStop(1, 'rgba(8, 4, 2, 0.62)');
    ctx.fillStyle = vigGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(1.4, 1.4);
    return texture;
  }

  update(time) {
    this.sunLight.intensity = 3.05 + Math.sin(time * 0.0015) * 0.1;
  }

  resize(width, height) {
    if (height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
}

