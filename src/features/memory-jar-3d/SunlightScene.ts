import * as THREE from 'three';

/**
 * 오후 햇살(Golden Hour Sunlight) 조명 환경 및 부유 먼지 입자(Sunbeam Dust Particles) 시스템
 */
export class SunlightSceneManager {
  public scene: THREE.Scene;
  public camera: THREE.PerspectiveCamera;
  public sunLight: THREE.DirectionalLight;
  public ambientLight: THREE.AmbientLight;
  public floorMesh: THREE.Mesh;
  public dustParticles?: THREE.Points;

  private dustPositions?: Float32Array;
  private dustCount = 80;

  constructor(containerWidth: number, containerHeight: number) {
    // 1. 씬 생성
    this.scene = new THREE.Scene();

    // 2. 카메라 설정 (빈티지한 원근감)
    this.camera = new THREE.PerspectiveCamera(
      38,
      containerWidth / containerHeight,
      0.1,
      100
    );
    // 병 전체(코르크부터 바닥까지)가 여유있게 프레임 안에 들어오도록 배치
    this.camera.position.set(0, 0.2, 12.5);
    this.camera.lookAt(0, 0.1, 0);

    // 3. 오른쪽 위에서 쏟아지는 따스한 햇빛 (Top-Right Directional Sunlight)
    // 따뜻한 골든 아워 앰버 컬러 (약 3500K ~ 4000K 색온도 느낌)
    this.sunLight = new THREE.DirectionalLight(0xFFF3D6, 3.2);
    // 우측 상단 (+X, +Y, 약간 전면 +Z)에서 비추도록 배치
    this.sunLight.position.set(6.0, 7.5, 4.5);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 1024;
    this.sunLight.shadow.mapSize.height = 1024;
    this.sunLight.shadow.camera.near = 0.5;
    this.sunLight.shadow.camera.far = 25;
    this.sunLight.shadow.bias = -0.001;
    this.scene.add(this.sunLight);

    // 4. 햇빛 반사광 / 환경광 (따뜻한 노을 톤과 차분한 바닥 반사)
    this.ambientLight = new THREE.AmbientLight(0xFFEAD2, 1.2);
    this.scene.add(this.ambientLight);

    // 반대편 부드러운 필 라이트 (유리병 좌측 윤곽 림라이트)
    const rimLight = new THREE.DirectionalLight(0xE0ECF8, 0.8);
    rimLight.position.set(-6, 2, -3);
    this.scene.add(rimLight);

    // 5. 따뜻한 원목/패브릭 바닥 그림자 수신용 바닥면
    const floorGeo = new THREE.PlaneGeometry(16, 16);
    const floorMat = new THREE.ShadowMaterial({
      opacity: 0.18, // 부드러운 그림자
    });
    this.floorMesh = new THREE.Mesh(floorGeo, floorMat);
    this.floorMesh.rotation.x = -Math.PI / 2;
    this.floorMesh.position.y = -2.42;
    this.floorMesh.receiveShadow = true;
    this.scene.add(this.floorMesh);

    // 6. 햇살 속 부유하는 반짝이는 먼지 파티클 (Sunbeam Dust)
    this.initDustParticles();
  }

  /**
   * 부드러운 원형 그러데이션 먼지 파티클 텍스처 생성 (GPU 기본 사각형 방지)
   */
  private createDustTexture(): THREE.CanvasTexture {
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      grad.addColorStop(0, 'rgba(255, 245, 200, 1.0)');
      grad.addColorStop(0.3, 'rgba(255, 230, 160, 0.6)');
      grad.addColorStop(0.7, 'rgba(255, 200, 120, 0.15)');
      grad.addColorStop(1, 'rgba(255, 180, 80, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, 64, 64);
    }
    const texture = new THREE.CanvasTexture(canvas);
    return texture;
  }

  /**
   * 햇빛 줄기 안에서 은은하게 떠다니는 먼지 입자 초기화
   */
  private initDustParticles(): void {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(this.dustCount * 3);

    for (let i = 0; i < this.dustCount; i++) {
      // 햇살 통로(오른쪽 위에서 유리병 쪽) 영역에 집중 분포
      positions[i * 3 + 0] = (Math.random() - 0.3) * 5; // X
      positions[i * 3 + 1] = (Math.random() - 0.2) * 5; // Y
      positions[i * 3 + 2] = (Math.random() - 0.5) * 3; // Z
    }

    this.dustPositions = positions;
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));

    const dustTexture = this.createDustTexture();

    // 은은한 골드빛 틴트 입자 머티리얼
    const material = new THREE.PointsMaterial({
      color: 0xFFF0BD,
      map: dustTexture,
      size: 0.14,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.dustParticles = new THREE.Points(geometry, material);
    this.scene.add(this.dustParticles);
  }

  /**
   * 애니메이션 틱 업데이트 (햇빛 먼지 흩날림 & 조명 미세 요동)
   */
  public update(time: number): void {
    // 먼지 입자 자연스러운 부유 (브라운 운동 시뮬레이션)
    if (this.dustParticles && this.dustPositions) {
      const posAttr = this.dustParticles.geometry.attributes.position as THREE.BufferAttribute;
      const array = posAttr.array as Float32Array;

      for (let i = 0; i < this.dustCount; i++) {
        // Y축으로 서서히 상승
        array[i * 3 + 1] += Math.sin(time * 0.001 + i) * 0.003 + 0.002;
        // X, Z 축 미세한 요동
        array[i * 3 + 0] += Math.cos(time * 0.0008 + i * 2) * 0.002;
        array[i * 3 + 2] += Math.sin(time * 0.0007 + i * 3) * 0.002;

        // 경계 밖으로 벗어나면 다시 하단으로 리셋
        if (array[i * 3 + 1] > 4.5) {
          array[i * 3 + 1] = -2.2;
        }
      }
      posAttr.needsUpdate = true;
    }

    // 햇빛의 미세한 온기 흔들림 (1~2% 정도의 아늑한 맥동)
    this.sunLight.intensity = 2.8 + Math.sin(time * 0.0015) * 0.12;
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
      if (this.dustParticles) {
        this.dustParticles.geometry?.dispose();
        const mat = this.dustParticles.material as THREE.PointsMaterial;
        if (mat?.map) mat.map.dispose();
        mat?.dispose();
        this.scene.remove(this.dustParticles);
      }
      if (this.floorMesh) {
        this.floorMesh.geometry?.dispose();
        (this.floorMesh.material as THREE.Material)?.dispose();
        this.scene.remove(this.floorMesh);
      }
    } catch {
      // safe cleanup
    }
  }
}
