import * as THREE from 'three';

/**
 * 앤틱한 원목 책상(Antique Wooden Desk) 및 따스한 오후 햇살 조명 환경 매니저
 * - 위에서 내려다보는 시점(High-Angle Perspective)에 최적화된 카메라 앵글
 * - 앤틱한 나뭇결과 판자 이음새, 은은한 오일 바니시 광택이 살아 있는 정교한 원목 책상
 * - 눈부시거나 산만한 파티클을 배제한 정갈하고 아늑한 분위기
 */
export class SunlightSceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public sunLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;
  public deskMesh: THREE.Mesh;
  public woodTexture?: THREE.CanvasTexture;

  constructor(containerWidth: number, containerHeight: number) {
    // 1. 씬 생성
    this.scene = new THREE.Scene();

    // 2. 카메라 설정 (병과 책상을 조금 더 멀리서 여유롭게 조망하는 하이앵글 시점)
    this.camera = new THREE.PerspectiveCamera(
      36,
      containerWidth / containerHeight,
      0.1,
      100
    );
    // 상단에서 조금 더 뒤로 물러나 병과 앤틱 책상 상판의 전체적인 실루엣이 한눈에 들어오도록 배치
    this.camera.position.set(0, 4.0, 13.8);
    this.camera.lookAt(0, -0.4, 0);

    // 3. 오른쪽 위에서 쏟아지는 따스한 햇빛 (Top-Right Directional Sunlight)
    this.sunLight = new THREE.DirectionalLight(0xFFF3D6, 3.2);
    this.sunLight.position.set(6.0, 8.0, 5.0);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 25;
    this.sunLight.shadow.bias = -0.001;
    this.scene.add(this.sunLight);

    // 4. 부드러운 환경광 & 좌측 윤곽 림라이트
    this.ambientLight = new THREE.AmbientLight(0xFFEAD2, 1.3);
    this.scene.add(this.ambientLight);

    const rimLight = new THREE.DirectionalLight(0xE0ECF8, 0.7);
    rimLight.position.set(-6, 3, -3);
    this.scene.add(rimLight);

    // 5. 앤틱한 느낌의 짙은 나무 질감이 살아 있는 작은 책상 상판 (Dark Antique Wooden Desk)
    const deskGeo = new THREE.BoxGeometry(20, 0.8, 16);
    this.woodTexture = this.createAntiqueWoodTexture();
    const deskMat = new THREE.MeshStandardMaterial({
      map: this.woodTexture,
      roughness: 0.46,      // 짙은 앤틱 원목의 은은한 오일 광택
      metalness: 0.04,
    });
    this.deskMesh = new THREE.Mesh(deskGeo, deskMat);
    // 책상 상판 높이: 병 바닥(-2.35)이 책상 상판 위에 자연스럽게 닿도록 배치 (상판 두께 0.8 -> 중심 y = -2.75)
    this.deskMesh.position.set(0, -2.75, 0.5);
    this.deskMesh.receiveShadow = true;
    this.scene.add(this.deskMesh);
  }

  /**
   * 고해상도 짙은 앤틱 원목 데스크 질감 캔버스 텍스처 생성
   * - 깊고 묵직한 다크 월넛/에스프레소 나뭇결
   * - 섬세한 원목 판자(Planks) 이음새와 은은한 바니시 오일 반광
   */
  private createAntiqueWoodTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    if (!ctx) return new THREE.CanvasTexture(canvas);

    // 1. 깊고 진한 다크 앤틱 에스프레소/월넛 베이스 그라데이션
    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 0);
    bgGrad.addColorStop(0.0, '#1C0D05');
    bgGrad.addColorStop(0.25, '#261308');
    bgGrad.addColorStop(0.5, '#1E0F06');
    bgGrad.addColorStop(0.75, '#281409');
    bgGrad.addColorStop(1.0, '#170B04');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 1024);

    // 2. 가로 방향 원목 판자(Planks) 4분할 및 앤틱 홈 라인
    const plankHeight = 256;
    for (let p = 0; p < 4; p++) {
      const py = p * plankHeight;
      ctx.fillStyle = `rgba(0, 0, 0, ${p % 2 === 0 ? 0.12 : 0.04})`;
      ctx.fillRect(0, py, 1024, plankHeight);

      // 판자 이음새 틈새 깊은 그림자 & 은은한 하이라이트 베벨
      ctx.fillStyle = 'rgba(8, 4, 2, 0.92)';
      ctx.fillRect(0, py - 2, 1024, 4);
      ctx.fillStyle = 'rgba(180, 130, 85, 0.12)';
      ctx.fillRect(0, py + 2, 1024, 2);
    }

    // 3. 정교한 짙은 나뭇결(Wood Grain) 섬유 라인 그리기
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
        // 자연스러운 나뭇결 요동 (파동)
        cy = y + Math.sin(cx * 0.015) * 8 + Math.cos(cx * 0.006) * 12;
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }

    // 4. 앤틱 가구 특유의 나이테 옹이(Wood Knots) 자연스럽게 배치
    const knots = [
      { x: 260, y: 380, r: 42 },
      { x: 740, y: 680, r: 52 },
      { x: 820, y: 190, r: 34 },
    ];

    knots.forEach((knot) => {
      for (let r = knot.r; r > 5; r -= 5) {
        ctx.beginPath();
        ctx.ellipse(
          knot.x + Math.sin(r) * 3,
          knot.y + Math.cos(r) * 3,
          r * 1.8,
          r * 0.65,
          0.12,
          0,
          Math.PI * 2
        );
        ctx.strokeStyle = `rgba(12, 6, 3, ${0.14 + (knot.r - r) * 0.005})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
      }
    });

    // 5. 따스하고 중후한 비네팅(Vignette) 모서리 마감
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

  /**
   * 애니메이션 틱 업데이트
   */
  public update(time: number): void {
    // 햇빛의 미세한 온기 숨결 (1~2% 정도의 아늑한 맥동)
    this.sunLight.intensity = 3.0 + Math.sin(time * 0.0015) * 0.12;
  }

  /**
   * 창 크기 변경 시 카메라 비율 업데이트
   */
  public resize(width: number, height: number): void {
    if (height === 0) return;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  /**
   * 메모리 정리
   */
  public dispose(): void {
    try {
      if (this.woodTexture) {
        this.woodTexture.dispose();
      }
      if (this.deskMesh) {
        this.deskMesh.geometry?.dispose();
        (this.deskMesh.material as THREE.Material)?.dispose();
        this.scene.remove(this.deskMesh);
      }
    } catch {
      // safe cleanup
    }
  }
}
