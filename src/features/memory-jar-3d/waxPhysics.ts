import * as THREE from 'three';

export interface WaxPhysicsBody {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  radius: number;
  height: number;
  isResting: boolean;
  restTimer: number;
}

/**
 * 온기 유리병 왁스 조각 물리 시뮬레이션 엔진
 * - 흔들기(Shake) 시 조각들이 병 내부에서 공중으로 솟구쳤다가 텀블링하며 떨어집니다.
 * - 유리벽 실린더 충돌, 바닥 충돌 및 반발 탄성, 조각 간 상호 분리(Separation) 처리.
 * - 정지 상태(Resting) 시 연산을 정지하여 CPU 및 배터리를 100% 절약합니다.
 */
export class JarPhysicsEngine {
  public bodies: WaxPhysicsBody[] = [];
  public isSimulating: boolean = false;
  public shakeTimer: number = 0;
  public shakeOffset: THREE.Vector3 = new THREE.Vector3();
  public shakeAngle: THREE.Euler = new THREE.Euler();

  // 유리병 내부 치수
  private readonly innerRadius = 1.35;
  private readonly floorY = 0.28;
  private readonly ceilingY = 4.1;
  private readonly gravity = -17.0;

  constructor(waxMeshes: THREE.Mesh[]) {
    this.initBodies(waxMeshes);
  }

  public initBodies(waxMeshes: THREE.Mesh[]): void {
    this.bodies = waxMeshes.map((mesh) => {
      const size = (mesh.userData?.size as number) || 1.0;
      return {
        mesh,
        velocity: new THREE.Vector3(0, 0, 0),
        angularVelocity: new THREE.Vector3(0, 0, 0),
        radius: 0.38 * size,
        height: 0.16 * size,
        isResting: true,
        restTimer: 0,
      };
    });
  }

  /**
   * 병 흔들기 임펄스 발동!
   * 모든 왁스 조각을 공중으로 흩뿌리고 병 자체를 흔듭니다.
   */
  public triggerShake(intensity: number = 1.0): void {
    this.isSimulating = true;
    this.shakeTimer = 0.85;

    this.bodies.forEach((body) => {
      // 위쪽 솟구치는 힘 + 무작위 3D 방향 충격량
      const upwardForce = (3.5 + Math.random() * 4.2) * intensity;
      const angle = Math.random() * Math.PI * 2;
      const horizontalSpeed = (1.2 + Math.random() * 2.8) * intensity;

      body.velocity.set(
        Math.cos(angle) * horizontalSpeed,
        upwardForce,
        Math.sin(angle) * horizontalSpeed
      );

      // 무작위 스핀 회전량
      body.angularVelocity.set(
        (Math.random() - 0.5) * 14 * intensity,
        (Math.random() - 0.5) * 14 * intensity,
        (Math.random() - 0.5) * 14 * intensity
      );

      body.isResting = false;
      body.restTimer = 0;
    });
  }

  /**
   * 매 프레임 물리 시뮬레이션 계산
   */
  public update(deltaTime: number): { isShaking: boolean } {
    if (!this.isSimulating && this.shakeTimer <= 0) {
      return { isShaking: false };
    }

    const dt = Math.min(deltaTime, 0.033); // 30FPS 델타 타임 클램프 (터널링 방지)

    // 1. 유리병 자체의 좌우 요동(Jostle) 계산
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt * 1.4;
      const freq = 36;
      const amp = Math.max(0, this.shakeTimer) * 0.24;
      this.shakeOffset.set(
        Math.sin(Date.now() * 0.001 * freq) * amp,
        Math.cos(Date.now() * 0.001 * freq * 1.3) * (amp * 0.4),
        Math.sin(Date.now() * 0.001 * freq * 0.7) * amp
      );
      this.shakeAngle.set(
        Math.cos(Date.now() * 0.001 * freq) * (amp * 0.4),
        0,
        Math.sin(Date.now() * 0.001 * freq) * (amp * 0.4)
      );
    } else {
      this.shakeOffset.set(0, 0, 0);
      this.shakeAngle.set(0, 0, 0);
    }

    let anyActive = false;

    // 2. 개별 왁스 조각 물리 이동 및 경계 충돌
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (b.isResting) continue;

      // 중력 및 공기 저항
      b.velocity.y += this.gravity * dt;
      b.velocity.multiplyScalar(0.985);
      b.angularVelocity.multiplyScalar(0.97);

      // 위치 및 회전 업데이트
      b.mesh.position.addScaledVector(b.velocity, dt);
      b.mesh.rotation.x += b.angularVelocity.x * dt;
      b.mesh.rotation.y += b.angularVelocity.y * dt;
      b.mesh.rotation.z += b.angularVelocity.z * dt;

      // 원통형 유리벽 충돌 (수평 반경 제한)
      const distXZ = Math.sqrt(b.mesh.position.x ** 2 + b.mesh.position.z ** 2);
      const maxRadius = this.innerRadius - b.radius;
      if (distXZ > maxRadius) {
        const normX = b.mesh.position.x / distXZ;
        const normZ = b.mesh.position.z / distXZ;
        b.mesh.position.x = normX * maxRadius;
        b.mesh.position.z = normZ * maxRadius;

        const dot = b.velocity.x * normX + b.velocity.z * normZ;
        if (dot > 0) {
          b.velocity.x -= 1.4 * dot * normX;
          b.velocity.z -= 1.4 * dot * normZ;
        }
      }

      // 바닥 충돌
      const floorLimit = this.floorY + b.height;
      if (b.mesh.position.y <= floorLimit) {
        b.mesh.position.y = floorLimit;
        if (b.velocity.y < 0) {
          b.velocity.y = -b.velocity.y * 0.3; // 바닥 탄성 반발
          b.velocity.x *= 0.75; // 바닥 마찰
          b.velocity.z *= 0.75;
          b.angularVelocity.multiplyScalar(0.65);
        }
      }

      // 상단 병목 천장 충돌
      if (b.mesh.position.y > this.ceilingY) {
        b.mesh.position.y = this.ceilingY;
        if (b.velocity.y > 0) {
          b.velocity.y = -b.velocity.y * 0.3;
        }
      }

      // 정지 상태 안착 감지
      const speedSq = b.velocity.lengthSq();
      if (speedSq < 0.05 && Math.abs(b.mesh.position.y - floorLimit) < 0.25) {
        b.restTimer += dt;
        if (b.restTimer > 0.35) {
          b.isResting = true;
          b.velocity.set(0, 0, 0);
          b.angularVelocity.set(0, 0, 0);
        }
      } else {
        b.restTimer = 0;
        anyActive = true;
      }
    }

    // 3. 조각 간 충돌 및 겹침 방지 (자연스러운 층층 쌓임)
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        const b1 = this.bodies[i];
        const b2 = this.bodies[j];
        const dx = b2.mesh.position.x - b1.mesh.position.x;
        const dy = b2.mesh.position.y - b1.mesh.position.y;
        const dz = b2.mesh.position.z - b1.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const minDist = (b1.radius + b2.radius) * 0.85;

        if (dist < minDist && dist > 0.001) {
          const overlap = (minDist - dist) * 0.5;
          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;

          // 겹침 밀어내기
          b1.mesh.position.x -= nx * overlap * 0.5;
          b1.mesh.position.y -= ny * overlap * 0.7;
          b1.mesh.position.z -= nz * overlap * 0.5;

          b2.mesh.position.x += nx * overlap * 0.5;
          b2.mesh.position.y += ny * overlap * 0.7;
          b2.mesh.position.z += nz * overlap * 0.5;

          // 탄성 충돌 속도 교환
          const relVel = (b1.velocity.x - b2.velocity.x) * nx +
                         (b1.velocity.y - b2.velocity.y) * ny +
                         (b1.velocity.z - b2.velocity.z) * nz;
          if (relVel > 0) {
            const impulse = relVel * 0.35;
            b1.velocity.x -= impulse * nx;
            b1.velocity.y -= impulse * ny;
            b1.velocity.z -= impulse * nz;
            b2.velocity.x += impulse * nx;
            b2.velocity.y += impulse * ny;
            b2.velocity.z += impulse * nz;
          }
        }
      }
    }

    if (!anyActive && this.shakeTimer <= 0) {
      this.isSimulating = false;
    }

    return { isShaking: this.shakeTimer > 0 || anyActive };
  }
}
