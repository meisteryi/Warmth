import * as THREE from 'three';

interface MarbleBody {
  group: THREE.Group;
  velocity: THREE.Vector3;
  angularVelocity: THREE.Vector3;
  radius: number;
  isResting: boolean;
  restTimer: number;
}

const ZERO_VEC = new THREE.Vector3(0, 0, 0);

/**
 * 병(jarGeometry.ts) 내부 윤곽에 맞춘 3D 유리구슬 물리 시뮬레이션 엔진
 * - 흔들기(triggerShake) 및 병 탄성 감쇠 진동(shakeOffset)은 원본 waxPhysics.ts와 동일
 * - 구형-구형 탄성 충돌 + 구슬 간 밀어내기 이후 병 벽면/바닥 이탈 방지 재클램프
 * - 초기 배치 직후 한 번 흔든 것처럼 자연스럽게 바닥에 안착(preSettle)
 */
export class MarblePhysicsEngine {
  public bodies: MarbleBody[] = [];
  public isSimulating = false;
  public shakeTimer = 0;
  public shakeOffset = new THREE.Vector3();

  private readonly gravity = -24.0;
  private readonly floorY = 0.05;
  private readonly ceilingY = 4.35;
  private simTime = 0;

  constructor(marbleObjects: THREE.Group[] = []) {
    this.initBodies(marbleObjects);
  }

  private getInnerRadiusAtY(y: number): number {
    if (y < 0.25) return 1.50;
    if (y < 0.55) return 1.50 + ((y - 0.25) / 0.3) * 0.24;
    if (y <= 3.2) return 1.74;
    if (y <= 3.65) return 1.74 - ((y - 3.2) / 0.45) * 0.14;
    if (y <= 4.35) return 1.60 - ((y - 3.65) / 0.7) * 0.48;
    return 1.04;
  }

  private clampBodyToJar(b: MarbleBody, applyBounce = true): void {
    const minY = this.floorY + b.radius;
    if (b.group.position.y < minY) {
      b.group.position.y = minY;
      if (applyBounce) {
        if (Math.abs(b.velocity.y) > 0.35) {
          b.velocity.y = -b.velocity.y * 0.48;
          b.velocity.x *= 0.9;
          b.velocity.z *= 0.9;
        } else {
          b.velocity.y = 0;
          b.velocity.x *= 0.85;
          b.velocity.z *= 0.85;
        }
      } else if (b.velocity.y < 0) {
        b.velocity.y = 0;
      }
    }

    const maxY = this.ceilingY - b.radius;
    if (b.group.position.y > maxY) {
      b.group.position.y = maxY;
      if (applyBounce) {
        b.velocity.y = -Math.abs(b.velocity.y) * 0.45;
      } else if (b.velocity.y > 0) {
        b.velocity.y = 0;
      }
    }

    const maxR = Math.max(0.2, this.getInnerRadiusAtY(b.group.position.y) - b.radius);
    const distXZ = Math.hypot(b.group.position.x, b.group.position.z);
    if (distXZ > maxR && distXZ > 0.0001) {
      const nx = b.group.position.x / distXZ;
      const nz = b.group.position.z / distXZ;
      b.group.position.x = nx * maxR;
      b.group.position.z = nz * maxR;

      const vn = b.velocity.x * nx + b.velocity.z * nz;
      if (vn > 0) {
        const bounce = applyBounce ? 1.48 : 1.05;
        b.velocity.x -= bounce * vn * nx;
        b.velocity.z -= bounce * vn * nz;
      }
    }
  }

  public initBodies(marbleObjects: THREE.Group[]): void {
    this.bodies = marbleObjects.map((group) => {
      const radius = (group.userData?.radius as number) || 0.31;
      return {
        group,
        velocity: new THREE.Vector3(0, 0, 0),
        angularVelocity: new THREE.Vector3(0, 0, 0),
        radius,
        isResting: true,
        restTimer: 0,
      };
    });

    this.resolveOverlaps(45);
    this.preSettle();
  }

  private preSettle(steps = 150): void {
    if (this.bodies.length === 0) return;

    this.isSimulating = true;
    this.shakeTimer = 0;
    this.shakeOffset.set(0, 0, 0);

    for (const b of this.bodies) {
      b.velocity.set(
        (Math.random() - 0.5) * 1.6,
        0.5 + Math.random() * 1.5,
        (Math.random() - 0.5) * 1.6
      );
      b.angularVelocity.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      );
      b.isResting = false;
      b.restTimer = 0;
    }

    for (let i = 0; i < steps && this.isSimulating; i++) {
      this.update(0.016);
    }

    for (const b of this.bodies) {
      this.clampBodyToJar(b, false);
      b.velocity.set(0, 0, 0);
      b.angularVelocity.set(0, 0, 0);
      b.isResting = true;
      b.restTimer = 0;
    }
    this.isSimulating = false;
    this.shakeTimer = 0;
    this.shakeOffset.set(0, 0, 0);
  }

  private resolveOverlaps(iterations = 30): void {
    for (let iter = 0; iter < iterations; iter++) {
      for (let i = 0; i < this.bodies.length; i++) {
        const b1 = this.bodies[i];
        this.clampBodyToJar(b1, false);

        for (let j = i + 1; j < this.bodies.length; j++) {
          const b2 = this.bodies[j];
          const dx = b2.group.position.x - b1.group.position.x;
          const dy = b2.group.position.y - b1.group.position.y;
          const dz = b2.group.position.z - b1.group.position.z;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
          const minDist = b1.radius + b2.radius;

          if (dist < minDist && dist > 0.0001) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;
            const push = overlap * 0.52;

            b1.group.position.x -= nx * push;
            b1.group.position.y -= ny * push;
            b1.group.position.z -= nz * push;

            b2.group.position.x += nx * push;
            b2.group.position.y += ny * push;
            b2.group.position.z += nz * push;
          }
        }
      }
    }
  }

  public triggerShake(intensity = 1.0): void {
    this.isSimulating = true;
    this.shakeTimer = 1.15;

    this.bodies.forEach((b) => {
      const upwardForce = (9.5 + Math.random() * 10.5) * intensity;
      const angle = Math.random() * Math.PI * 2;
      const horizontalSpeed = (1.5 + Math.random() * 3.5) * intensity;

      b.velocity.set(
        Math.cos(angle) * horizontalSpeed,
        upwardForce,
        Math.sin(angle) * horizontalSpeed
      );
      b.angularVelocity.set(
        (Math.random() - 0.5) * 26 * intensity,
        (Math.random() - 0.5) * 20 * intensity,
        (Math.random() - 0.5) * 26 * intensity
      );
      b.isResting = false;
      b.restTimer = 0;
    });
  }

  public update(deltaTime: number): { isShaking: boolean } {
    if (!this.isSimulating && this.shakeTimer <= 0) {
      if (this.shakeOffset.lengthSq() > 0.000001) {
        this.shakeOffset.lerp(ZERO_VEC, 0.15);
      } else {
        this.shakeOffset.set(0, 0, 0);
      }
      return { isShaking: false };
    }

    const dt = Math.min(deltaTime, 0.025);
    this.simTime += dt;

    if (this.shakeTimer > 0) {
      this.shakeTimer -= dt * 1.35;
      const progress = Math.max(0, this.shakeTimer / 0.85);
      const amp = progress * progress * 0.16;

      const freq1 = 28;
      const freq2 = 34;
      this.shakeOffset.set(
        Math.sin(this.simTime * freq1) * amp,
        Math.cos(this.simTime * freq2) * (amp * 0.35),
        Math.sin(this.simTime * freq1 * 0.8) * (amp * 0.7)
      );
    } else {
      this.shakeOffset.lerp(ZERO_VEC, 0.15);
    }

    const subSteps = 3;
    const subDt = dt / subSteps;

    for (let step = 0; step < subSteps; step++) {
      for (const b of this.bodies) {
        if (b.isResting) continue;

        b.velocity.y += this.gravity * subDt;
        b.velocity.multiplyScalar(0.994);
        b.group.position.addScaledVector(b.velocity, subDt);

        b.group.rotation.x += b.angularVelocity.x * subDt + (b.velocity.z / b.radius) * subDt * 0.35;
        b.group.rotation.y += b.angularVelocity.y * subDt;
        b.group.rotation.z += b.angularVelocity.z * subDt - (b.velocity.x / b.radius) * subDt * 0.35;
        b.angularVelocity.multiplyScalar(0.97);

        this.clampBodyToJar(b, true);
      }

      for (let i = 0; i < this.bodies.length; i++) {
        for (let j = i + 1; j < this.bodies.length; j++) {
          const b1 = this.bodies[i];
          const b2 = this.bodies[j];

          const dx = b2.group.position.x - b1.group.position.x;
          const dy = b2.group.position.y - b1.group.position.y;
          const dz = b2.group.position.z - b1.group.position.z;
          const distSq = dx * dx + dy * dy + dz * dz;
          const minDist = b1.radius + b2.radius;

          if (distSq < minDist * minDist && distSq > 0.00001) {
            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const ny = dy / dist;
            const nz = dz / dist;
            const overlap = minDist - dist;

            b1.group.position.x -= nx * overlap * 0.5;
            b1.group.position.y -= ny * overlap * 0.5;
            b1.group.position.z -= nz * overlap * 0.5;

            b2.group.position.x += nx * overlap * 0.5;
            b2.group.position.y += ny * overlap * 0.5;
            b2.group.position.z += nz * overlap * 0.5;

            if (overlap > 0.004) {
              b1.isResting = false;
              b2.isResting = false;
              b1.restTimer = 0;
              b2.restTimer = 0;
            }

            const rvx = b2.velocity.x - b1.velocity.x;
            const rvy = b2.velocity.y - b1.velocity.y;
            const rvz = b2.velocity.z - b1.velocity.z;
            const velAlongNormal = rvx * nx + rvy * ny + rvz * nz;

            if (velAlongNormal < 0) {
              const restitution = 0.52;
              const jImp = -(1 + restitution) * velAlongNormal * 0.5;
              b1.velocity.x -= jImp * nx;
              b1.velocity.y -= jImp * ny;
              b1.velocity.z -= jImp * nz;

              b2.velocity.x += jImp * nx;
              b2.velocity.y += jImp * ny;
              b2.velocity.z += jImp * nz;

              if (Math.abs(velAlongNormal) > 0.25) {
                b1.isResting = false;
                b2.isResting = false;
                b1.restTimer = 0;
                b2.restTimer = 0;
              }
            }
          }
        }
      }

      for (const b of this.bodies) {
        this.clampBodyToJar(b, false);
      }
    }

    let activeCount = 0;
    for (const b of this.bodies) {
      if (b.isResting) continue;
      if (b.velocity.lengthSq() < 0.015) {
        b.restTimer += dt;
        if (b.restTimer > 0.35) {
          b.isResting = true;
          b.velocity.set(0, 0, 0);
          b.angularVelocity.set(0, 0, 0);
        } else {
          activeCount++;
        }
      } else {
        b.restTimer = 0;
        activeCount++;
      }
    }

    if (activeCount === 0 && this.shakeTimer <= 0) {
      this.isSimulating = false;
    }

    return { isShaking: this.shakeTimer > 0 || activeCount > 0 };
  }
}

