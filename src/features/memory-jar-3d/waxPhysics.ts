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
 * - 흔들기(Shake) 시 조각들이 병 내부에서 공중으로 솟구쳤다가 텀블링하며 부드럽게 안착합니다.
 * - 유리벽 실린더 충돌, 바닥 충돌 및 쫀득한 왁스 탄성, 조각 간 상호 분리(Separation Relaxation) 처리.
 * - 순간적인 위치 점프나 텔레포트 없이 프레임 간 완벽히 연속적인 움직임을 보장합니다.
 */
export class JarPhysicsEngine {
  public bodies: WaxPhysicsBody[] = [];
  public isSimulating: boolean = false;
  public shakeTimer: number = 0;
  public shakeOffset: THREE.Vector3 = new THREE.Vector3();
  public shakeAngle: THREE.Euler = new THREE.Euler();

  // 유리병 내부 치수
  private readonly innerRadius = 1.35;
  private readonly floorY = 0.32;
  private readonly ceilingY = 3.9;
  private readonly gravity = -18.0;
  private simTime: number = 0;

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
   * 모든 왁스 조각을 공중으로 자연스럽게 솟구치게 하고 병 자체의 탄성 흔들림을 트리거합니다.
   */
  public triggerShake(intensity: number = 1.0): void {
    this.isSimulating = true;
    this.shakeTimer = 0.85;

    this.bodies.forEach((body) => {
      // 위쪽 솟구치는 힘 + 부드러운 수평 분산력
      const upwardForce = (3.2 + Math.random() * 3.8) * intensity;
      const angle = Math.random() * Math.PI * 2;
      const horizontalSpeed = (0.8 + Math.random() * 2.2) * intensity;

      body.velocity.set(
        Math.cos(angle) * horizontalSpeed,
        upwardForce,
        Math.sin(angle) * horizontalSpeed
      );

      // 자연스러운 텀블링 회전 토크
      body.angularVelocity.set(
        (Math.random() - 0.5) * 10 * intensity,
        (Math.random() - 0.5) * 8 * intensity,
        (Math.random() - 0.5) * 10 * intensity
      );

      body.isResting = false;
      body.restTimer = 0;
    });
  }

  /**
   * 매 프레임 연속적 물리 시뮬레이션 계산
   */
  public update(deltaTime: number): { isShaking: boolean } {
    if (!this.isSimulating && this.shakeTimer <= 0) {
      return { isShaking: false };
    }

    // 60FPS 서브스텝 시간 클램프
    const dt = Math.min(deltaTime, 0.025);
    this.simTime += dt;

    // 1. 유리병 자체의 탄성 감쇠 진동 (Damped Harmonic Vibration)
    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt * 1.35;
      const progress = Math.max(0, this.shakeTimer / 0.85); // 1.0 -> 0.0
      const amp = progress * progress * 0.16; // 2차 감쇠 곡선으로 매우 부드러움

      const freq1 = 28;
      const freq2 = 34;
      this.shakeOffset.set(
        Math.sin(this.simTime * freq1) * amp,
        Math.cos(this.simTime * freq2) * (amp * 0.35),
        Math.sin(this.simTime * freq1 * 0.8) * (amp * 0.7)
      );
    } else {
      // 흔들림이 끝나면 원점으로 부드럽게 지수 보간 수렴
      this.shakeOffset.lerp(new THREE.Vector3(0, 0, 0), 0.15);
    }

    let anyActive = false;

    // 2. 개별 왁스 조각 물리 이동 및 완충 충돌
    for (let i = 0; i < this.bodies.length; i++) {
      const b = this.bodies[i];
      if (b.isResting) continue;

      // 중력 및 공기 점성 저항
      b.velocity.y += this.gravity * dt;
      b.velocity.multiplyScalar(0.988);
      b.angularVelocity.multiplyScalar(0.975);

      // 연속적 위치 및 회전 적분
      b.mesh.position.addScaledVector(b.velocity, dt);
      b.mesh.rotation.x += b.angularVelocity.x * dt;
      b.mesh.rotation.y += b.angularVelocity.y * dt;
      b.mesh.rotation.z += b.angularVelocity.z * dt;

      // 원통형 유리벽 충돌 (수평 반경 제한 및 부드러운 반발)
      const distXZ = Math.hypot(b.mesh.position.x, b.mesh.position.z);
      const maxRadius = this.innerRadius - b.radius;
      if (distXZ > maxRadius && distXZ > 0.0001) {
        const normX = b.mesh.position.x / distXZ;
        const normZ = b.mesh.position.z / distXZ;
        const penetration = distXZ - maxRadius;

        // 벽면 침투 부드러운 이완
        b.mesh.position.x -= normX * penetration * 0.6;
        b.mesh.position.z -= normZ * penetration * 0.6;

        const dot = b.velocity.x * normX + b.velocity.z * normZ;
        if (dot > 0) {
          b.velocity.x -= 1.35 * dot * normX;
          b.velocity.z -= 1.35 * dot * normZ;
        }
      }

      // 바닥 충돌 및 쫀득한 왁스 탄성
      const floorLimit = this.floorY + b.height * 0.6;
      if (b.mesh.position.y < floorLimit) {
        const penetrationY = floorLimit - b.mesh.position.y;
        b.mesh.position.y += penetrationY * 0.6; // 순간 고정 대신 부드러운 이완

        if (b.velocity.y < 0) {
          b.velocity.y = -b.velocity.y * 0.22; // 낮은 반발 탄성 (쫀득하게 안착)
          b.velocity.x *= 0.82; // 바닥 마찰 감속
          b.velocity.z *= 0.82;
          b.angularVelocity.multiplyScalar(0.72);
        }
      }

      // 상단 병목 천장 충돌
      if (b.mesh.position.y > this.ceilingY) {
        b.mesh.position.y = this.ceilingY;
        if (b.velocity.y > 0) {
          b.velocity.y = -b.velocity.y * 0.25;
        }
      }

      // 연속적 감속 및 정지 상태 안착 판정
      const speedSq = b.velocity.lengthSq();
      if (speedSq < 0.15 && Math.abs(b.mesh.position.y - floorLimit) < 0.35) {
        // 점진적인 감속 마찰
        b.velocity.multiplyScalar(0.92);
        b.angularVelocity.multiplyScalar(0.9);
        b.restTimer += dt;

        if (b.restTimer > 0.45 && speedSq < 0.004) {
          b.isResting = true;
          b.velocity.set(0, 0, 0);
          b.angularVelocity.set(0, 0, 0);
        } else {
          anyActive = true;
        }
      } else {
        b.restTimer = 0;
        anyActive = true;
      }
    }

    // 3. 조각 간 충돌 및 겹침 이완 (부드러운 상호 분리 Relaxation)
    for (let i = 0; i < this.bodies.length; i++) {
      for (let j = i + 1; j < this.bodies.length; j++) {
        const b1 = this.bodies[i];
        const b2 = this.bodies[j];
        if (b1.isResting && b2.isResting) continue; // 둘 다 정지 중이면 불필요한 떨림 방지

        const dx = b2.mesh.position.x - b1.mesh.position.x;
        const dy = b2.mesh.position.y - b1.mesh.position.y;
        const dz = b2.mesh.position.z - b1.mesh.position.z;
        const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
        const minDist = (b1.radius + b2.radius) * 0.82;

        if (dist < minDist && dist > 0.001) {
          const overlap = minDist - dist;
          const nx = dx / dist;
          const ny = dy / dist;
          const nz = dz / dist;

          // 부드러운 위치 분리 (순간 이동 대신 점진적 이완)
          const push = overlap * 0.3;
          b1.mesh.position.x -= nx * push;
          b1.mesh.position.y -= ny * push * 0.8;
          b1.mesh.position.z -= nz * push;

          b2.mesh.position.x += nx * push;
          b2.mesh.position.y += ny * push * 0.8;
          b2.mesh.position.z += nz * push;

          // 충돌 속도 교환
          const relVel =
            (b1.velocity.x - b2.velocity.x) * nx +
            (b1.velocity.y - b2.velocity.y) * ny +
            (b1.velocity.z - b2.velocity.z) * nz;

          if (relVel > 0) {
            const impulse = relVel * 0.28;
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
