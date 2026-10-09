'use client';

import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from 'react';
import * as THREE from 'three';
import { WaxPieceData, JarRenderOptions, SAMPLE_WAX_PIECES } from './types';
import { createGlassJarGroup } from './jarGeometry';
import { createWaxPiecesGroup } from './waxGeometry';
import { SunlightSceneManager } from './SunlightScene';
import { JarPhysicsEngine } from './waxPhysics';
import { soundEngine } from '@/lib/audio';

export interface MemoryJarCanvasHandle {
  shake: () => boolean;
  slideTransition: (direction: 'prev' | 'next', onMidpoint: () => void) => boolean;
}

export interface MemoryJarCanvasProps {
  pieces?: WaxPieceData[];
  options?: JarRenderOptions;
  onSelectPiece?: (piece: WaxPieceData) => void;
  onOpenDiaryPiece?: (piece: WaxPieceData) => void;
  showInternalShakeButton?: boolean;
  showSunlightBadge?: boolean;
  showHint?: boolean;
  className?: string;
}

/**
 * WebGL 지원 여부 사전 감지 헬퍼
 */
function isWebGLAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const testCanvas = document.createElement('canvas');
    const gl =
      testCanvas.getContext('webgl2', { failIfMajorPerformanceCaveat: false }) ||
      testCanvas.getContext('webgl', { failIfMajorPerformanceCaveat: false }) ||
      testCanvas.getContext('experimental-webgl', { failIfMajorPerformanceCaveat: false });
    return !!gl;
  } catch {
    return false;
  }
}

/**
 * 안전한 WebGL Renderer 인스턴스 생성 헬퍼
 */
function tryCreateWebGLRenderer(canvas: HTMLCanvasElement): THREE.WebGLRenderer | null {
  const configs: THREE.WebGLRendererParameters[] = [
    {
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false,
    },
    {
      canvas,
      antialias: false,
      alpha: true,
      powerPreference: 'default',
      failIfMajorPerformanceCaveat: false,
    },
    {
      canvas,
      antialias: false,
      alpha: false,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: false,
    },
  ];

  for (const config of configs) {
    try {
      const renderer = new THREE.WebGLRenderer(config);
      return renderer;
    } catch {
      // 다음 설정으로 재시도
    }
  }
  return null;
}

export const MemoryJarCanvas = forwardRef<MemoryJarCanvasHandle, MemoryJarCanvasProps>(
  (
    {
      pieces = SAMPLE_WAX_PIECES,
      options = {},
      onSelectPiece,
      onOpenDiaryPiece,
      showInternalShakeButton = false,
      showSunlightBadge = true,
      showHint = true,
      className = '',
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [selectedPiece, setSelectedPiece] = useState<WaxPieceData | null>(null);
    const [isInteracting, setIsInteracting] = useState(false);
    const [isHoveringWax, setIsHoveringWax] = useState(false);
    const [webglUnavailable, setWebglUnavailable] = useState(false);
    const [retryKey, setRetryKey] = useState(0);

    // 물리 엔진 참조
    const physicsEngineRef = useRef<JarPhysicsEngine | null>(null);
    const hoveredMeshRef = useRef<THREE.Mesh | null>(null);

    // 옵션 최신 참조 유지 (불필요한 전체 씬 리렌더링/파괴 방지)
    const optionsRef = useRef(options);
    useEffect(() => {
      optionsRef.current = options;
    }, [options]);

    // 세부 오브젝트 & 씬 참조
    const waxMeshesRef = useRef<THREE.Mesh[]>([]);
    const waxGroupRef = useRef<THREE.Group | null>(null);
    const sceneManagerRef = useRef<SunlightSceneManager | null>(null);
    const jarGroupRef = useRef<THREE.Group | null>(null);
    const setCorkOpenRef = useRef<((isOpen: boolean) => void) | null>(null);

    // 코르크 마개 열림/닫힘 동기화
    useEffect(() => {
      setCorkOpenRef.current?.(options.isCorkOpen ?? false);
    }, [options.isCorkOpen]);

    // 병 회전 인터랙션 상태 (관성 & 매끄러운 수평 손끝 반응: 횡방향만 허용)
    const rotationYRef = useRef<number>(0);
    const targetRotationYRef = useRef<number>(0);

    const isDraggingRef = useRef<boolean>(false);
    const lastPointerXRef = useRef<number>(0);
    const lastPointerYRef = useRef<number>(0);
    const pointerDownPosRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
    const dragInertiaRef = useRef<number>(0);

    // 흔들기 속도 제한 (1초에 1번으로 제한하여 과도한 연타 방지 및 안정적 물리 연산 유지)
    const lastShakeTimeRef = useRef<number>(0);

    // 책상은 고정되고 유리병만 좌우로 스르륵 미끄러지는 3D 슬라이드 트랜지션 상태
    const slideAnimRef = useRef<{
      active: boolean;
      phase: 'EXIT' | 'ENTER';
      direction: 'prev' | 'next';
      progress: number;
      onMidpoint?: () => void;
    } | null>(null);
    const slideOffsetXRef = useRef<number>(0);
    const slideTiltZRef = useRef<number>(0);

    // 외부 명령(흔들기) 노출 (1초 1회 쿨다운 반환 & 슬라이드 중 방지)
    const handleTriggerShake = useCallback((): boolean => {
      if (slideAnimRef.current?.active) {
        return false;
      }
      const now = performance.now();
      if (now - lastShakeTimeRef.current < 1000) {
        return false; // 1초 내 중복 실행 차단
      }
      lastShakeTimeRef.current = now;

      if (physicsEngineRef.current) {
        physicsEngineRef.current.triggerShake(1.0);
        try {
          soundEngine.playTileSlideSound();
        } catch {}
      }
      return true;
    }, []);

    // 슬라이드 트랜지션 트리거 (연타 방지)
    const handleSlideTransition = useCallback((direction: 'prev' | 'next', onMidpoint: () => void): boolean => {
      if (slideAnimRef.current?.active) {
        return false;
      }
      slideAnimRef.current = {
        active: true,
        phase: 'EXIT',
        direction,
        progress: 0,
        onMidpoint,
      };
      try {
        soundEngine.playTileSlideSound();
      } catch {}
      return true;
    }, []);

    useImperativeHandle(ref, () => ({
      shake: handleTriggerShake,
      slideTransition: handleSlideTransition,
    }));

    // pieces 변경 시 씬 전체를 파괴하지 않고 내부 왁스 그룹만 안전하게 갱신
    useEffect(() => {
      if (!jarGroupRef.current) return;
      const jarGroup = jarGroupRef.current;

      // 이전 왁스 그룹 제거
      if (waxGroupRef.current) {
        jarGroup.remove(waxGroupRef.current);
      }

      // 새 왁스 그룹 생성 및 추가
      const { waxGroup, waxMeshes } = createWaxPiecesGroup(pieces);
      waxGroupRef.current = waxGroup;
      waxMeshesRef.current = waxMeshes;
      jarGroup.add(waxGroup);

      // 물리 엔진 바디 재동기화
      if (physicsEngineRef.current) {
        physicsEngineRef.current.initBodies(waxMeshes);
      } else {
        physicsEngineRef.current = new JarPhysicsEngine(waxMeshes);
      }

      // 현재 프리뷰 팝업이 열려있다면 새로 갱신된 pieces에서 1:1 매칭되는 최신 일기 데이터로 자동 동기화
      setSelectedPiece((prev) => {
        if (!prev) return null;
        const matching = pieces.find(
          (p) => (p.diaryId && p.diaryId === prev.diaryId) || p.id === prev.id || p.title === prev.title
        );
        return matching || prev;
      });
    }, [pieces]);

    // 메인 Three.js 캔버스 렌더러 & 씬 라이프사이클 (마운트 시 단 1회만 초기화)
    useEffect(() => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;

      let width = container.clientWidth || 360;
      let height = container.clientHeight || 480;

      let renderer: THREE.WebGLRenderer | null = null;
      let sceneManager: SunlightSceneManager | null = null;
      let animationFrameId: number | null = null;
      let resizeObserver: ResizeObserver | null = null;

      try {
        if (!isWebGLAvailable()) {
          setWebglUnavailable(true);
          return;
        }

        renderer = tryCreateWebGLRenderer(canvas);
        if (!renderer) {
          setWebglUnavailable(true);
          return;
        }

        setWebglUnavailable(false);
        renderer.setSize(width, height);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFShadowMap;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.05;

        // 조명 & 씬 매니저
        sceneManager = new SunlightSceneManager(width, height);
        sceneManagerRef.current = sceneManager;

        // 단일 겹 유리병 생성 (코르크 마개 열림/닫힘 지원)
        const { jarGroup, setCorkOpen } = createGlassJarGroup({ isCorkOpen: options.isCorkOpen });
        jarGroupRef.current = jarGroup;
        setCorkOpenRef.current = setCorkOpen;

        // 초기 왁스 조각 그룹 생성
        const { waxGroup, waxMeshes } = createWaxPiecesGroup(pieces);
        waxGroupRef.current = waxGroup;
        waxMeshesRef.current = waxMeshes;

        jarGroup.add(waxGroup);
        sceneManager.scene.add(jarGroup);

        // 왁스 물리 시뮬레이션 엔진 초기화
        const physics = new JarPhysicsEngine(waxMeshes);
        physicsEngineRef.current = physics;

        let lastTime = performance.now();

        // 애니메이션 렌더 루프
        const animate = (currentTime: number) => {
          animationFrameId = requestAnimationFrame(animate);

          const deltaTime = (currentTime - lastTime) * 0.001;
          lastTime = currentTime;

          // 3D 슬라이드 트랜지션 연산 (책상은 고정되어 있고 병만 책상 위를 스르륵 미끄러짐)
          if (slideAnimRef.current && slideAnimRef.current.active) {
            const anim = slideAnimRef.current;
            const speed = anim.phase === 'EXIT' ? 3.6 : 3.2;
            anim.progress += deltaTime * speed;

            const maxSlideDist = 13.5;

            if (anim.phase === 'EXIT') {
              const t = Math.min(anim.progress, 1);
              const eased = t * t * t; // 출발 시 부드러운 가속 (easeInCubic)
              const sign = anim.direction === 'next' ? -1 : 1;
              slideOffsetXRef.current = sign * maxSlideDist * eased;
              slideTiltZRef.current = -sign * 0.07 * eased;

              if (anim.progress >= 1) {
                try {
                  anim.onMidpoint?.();
                } catch (err) {
                  console.warn('Slide midpoint error:', err);
                }
                anim.phase = 'ENTER';
                anim.progress = 0;
                targetRotationYRef.current = 0;
                rotationYRef.current = 0;
              }
            } else if (anim.phase === 'ENTER') {
              const t = Math.min(anim.progress, 1);
              const eased = 1 - Math.pow(1 - t, 3); // 도착 시 부드러운 감속 안착 (easeOutCubic)
              const sign = anim.direction === 'next' ? 1 : -1;
              slideOffsetXRef.current = sign * maxSlideDist * (1 - eased);
              slideTiltZRef.current = sign * 0.07 * (1 - eased);

              if (anim.progress >= 1) {
                slideOffsetXRef.current = 0;
                slideTiltZRef.current = 0;
                anim.active = false;
              }
            }
          } else {
            slideOffsetXRef.current = 0;
            slideTiltZRef.current = 0;
          }

          // 물리 시뮬레이션 갱신 (흔들림 및 연속 텀블링 낙하)
          if (physics) {
            physics.update(deltaTime);

            // 병 자체의 탄성 흔들림 오프셋 + 슬라이드 미끄러짐 반영
            jarGroup.position.x = physics.shakeOffset.x + slideOffsetXRef.current;
            jarGroup.position.y = -2.35 + physics.shakeOffset.y;
            jarGroup.position.z = physics.shakeOffset.z;
          } else {
            jarGroup.position.x = slideOffsetXRef.current;
            jarGroup.position.y = -2.35;
            jarGroup.position.z = 0;
          }

          // 자동 회전 (옵션 명시적으로 활성화된 경우만)
          const currentOpts = optionsRef.current;
          if (!isDraggingRef.current && (currentOpts.autoRotate ?? false)) {
            targetRotationYRef.current += 0.003;
          }

          // 손을 뗐을 때 자연스러운 관성 감속 (Inertial deceleration)
          if (!isDraggingRef.current && Math.abs(dragInertiaRef.current) > 0.0001) {
            targetRotationYRef.current += dragInertiaRef.current;
            dragInertiaRef.current *= 0.93; // 93%로 부드럽게 지수 감속
          }

          // 손끝과 즉각적으로 일체화되는 부드러운 회전 보간 (횡방향 Y축만 회전)
          rotationYRef.current += (targetRotationYRef.current - rotationYRef.current) * 0.22;

          jarGroup.rotation.y = rotationYRef.current;
          jarGroup.rotation.x = 0; // 하이앵글 시점에서 위아래 회전 완전 고정 (왁스 돌출 방지)
          jarGroup.rotation.z = slideTiltZRef.current;

          if (sceneManager) {
            sceneManager.update(currentTime);
            renderer?.render(sceneManager.scene, sceneManager.camera);
          }
        };

        animationFrameId = requestAnimationFrame(animate);

        // 창 크기 반응형 리사이즈 핸들러
        const handleResize = () => {
          if (!container || !renderer || !sceneManager) return;
          width = container.clientWidth;
          height = container.clientHeight;
          if (width === 0 || height === 0) return;

          renderer.setSize(width, height);
          sceneManager.resize(width, height);
        };

        resizeObserver = new ResizeObserver(handleResize);
        resizeObserver.observe(container);

        // 자이로스코프 기울기 연동 (명시적으로 켜져 있을 때만 수평 회전)
        const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
          if (!optionsRef.current.enableGyroscope || isDraggingRef.current) return;
          const gamma = event.gamma ?? 0;
          targetRotationYRef.current += gamma * 0.0004;
        };

        if (window.DeviceOrientationEvent && optionsRef.current.enableGyroscope) {
          window.addEventListener('deviceorientation', handleDeviceOrientation);
        }

        return () => {
          if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
          resizeObserver?.disconnect();
          if (window.DeviceOrientationEvent) {
            window.removeEventListener('deviceorientation', handleDeviceOrientation);
          }
          sceneManager?.dispose();
          renderer?.dispose();
        };
      } catch (err) {
        console.warn('WebGL init error:', err);
        setWebglUnavailable(true);
        return () => {
          if (animationFrameId !== null) cancelAnimationFrame(animationFrameId);
          resizeObserver?.disconnect();
          sceneManager?.dispose();
          renderer?.dispose();
        };
      }
    }, [retryKey]);

    // 마우스/터치 다운
    const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
      if (selectedPiece || slideAnimRef.current?.active) return; // 모달이 떠있거나 슬라이드 중일 때는 조작 차단
      isDraggingRef.current = true;
      setIsInteracting(true);
      dragInertiaRef.current = 0; // 터치 시 즉시 이전 회전 관성 멈춤
      lastPointerXRef.current = e.clientX;
      lastPointerYRef.current = e.clientY;
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    // 마우스/터치 이동 (횡방향 수평 회전만 100% 매끄럽게 추종)
    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (selectedPiece) return;
      if (isDraggingRef.current) {
        const dx = e.clientX - lastPointerXRef.current;
        lastPointerXRef.current = e.clientX;
        lastPointerYRef.current = e.clientY;

        const sensitivity = 0.0075;
        targetRotationYRef.current += dx * sensitivity;
        // 위아래 회전(dy)은 완전히 배제하여 왁스가 바닥 밑으로 삐져나오지 않도록 차단

        // 손을 뗐을 때 자연스럽게 이어질 회전 관성 속도 보존
        dragInertiaRef.current = dx * sensitivity * 0.75;
        return;
      }

      // 드래그 중이 아닐 때는 호버 레이캐스트 감지 (1:1 마우스오버 피드백)
      const canvas = canvasRef.current;
      const sceneManager = sceneManagerRef.current;
      if (!canvas || !sceneManager || waxMeshesRef.current.length === 0) return;

      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), sceneManager.camera);
      const intersects = raycaster.intersectObjects(waxMeshesRef.current, false);

      if (intersects.length > 0) {
        const hit = intersects[0].object as THREE.Mesh;
        if (hit && hoveredMeshRef.current !== hit) {
          if (hoveredMeshRef.current && (hoveredMeshRef.current.material as THREE.MeshStandardMaterial)?.emissive) {
            (hoveredMeshRef.current.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
          }
          if (hit.material && (hit.material as THREE.MeshStandardMaterial)?.emissive) {
            (hit.material as THREE.MeshStandardMaterial).emissive.setHex(0x442211);
          }
          hoveredMeshRef.current = hit;
          setIsHoveringWax(true);
        }
      } else {
        if (hoveredMeshRef.current) {
          if (hoveredMeshRef.current.material && (hoveredMeshRef.current.material as THREE.MeshStandardMaterial)?.emissive) {
            (hoveredMeshRef.current.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
          }
          hoveredMeshRef.current = null;
          setIsHoveringWax(false);
        }
      }
    };

    // 마우스/터치 업 (정확한 1:1 레이캐스팅 선택)
    const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
      if (selectedPiece) return;
      if (!isDraggingRef.current) return;
      isDraggingRef.current = false;
      setIsInteracting(false);

      const deltaDist = Math.hypot(
        e.clientX - pointerDownPosRef.current.x,
        e.clientY - pointerDownPosRef.current.y
      );
      const deltaTime = Date.now() - pointerDownPosRef.current.time;

      // 8px 미만 이동 & 450ms 이하 클릭/탭인 경우에만 1:1 피킹 수행
      if (deltaDist < 8 && deltaTime < 450) {
        dragInertiaRef.current = 0; // 탭 클릭 시에는 관성 회전 방지
        handleRaycastPick(e.clientX, e.clientY);
      }

      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    };

    const lastPickTimeRef = useRef<number>(0);

    // 정확한 1:1 왁스 조각 레이캐스팅 선택 함수
    const handleRaycastPick = (clientX: number, clientY: number) => {
      if (selectedPiece) return; // 모달이 열려있으면 중복 피킹 절대 차단
      const now = Date.now();
      if (now - lastPickTimeRef.current < 250) return;
      lastPickTimeRef.current = now;

      const canvas = canvasRef.current;
      const sceneManager = sceneManagerRef.current;
      if (!canvas || !sceneManager || waxMeshesRef.current.length === 0) return;

      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), sceneManager.camera);

      // 시각적으로 보이는 왁스 코인 메쉬 자체를 정확히 직접 검출
      const intersects = raycaster.intersectObjects(waxMeshesRef.current, false);

      if (intersects.length > 0) {
        // 가장 앞쪽에서 클릭된 1:1 대응 왁스 조각
        const hitMesh = intersects[0].object as THREE.Mesh;
        if (hitMesh && hitMesh.userData && hitMesh.userData.title) {
          const pieceData = hitMesh.userData as WaxPieceData;
          setSelectedPiece(pieceData);
          if (onSelectPiece) onSelectPiece(pieceData);
          try {
            soundEngine.playStampThudSound();
          } catch {}
        }
      }
      // 아무 왁스도 맞지 않은 빈 유리나 바깥 영역 클릭 시에는 일기 창을 절대 띄우지 않음!
    };

    return (
      <div
        ref={containerRef}
        className={`relative w-full h-full flex flex-col items-center justify-center select-none touch-none ${className}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          cursor: isInteracting ? 'grabbing' : isHoveringWax ? 'pointer' : 'grab',
        }}
      >
        {/* WebGL 가속 비활성화 시 2.5D 인터랙티브 호환 뷰 표시 */}
        {webglUnavailable ? (
          <Jar2DFallbackView
            pieces={pieces}
            autoRotate={options.autoRotate ?? true}
            isInteracting={isInteracting}
            onSelectPiece={(piece) => {
              setSelectedPiece(piece);
              if (onSelectPiece) onSelectPiece(piece);
            }}
            onRetry={() => {
              setWebglUnavailable(false);
              setRetryKey((k) => k + 1);
            }}
          />
        ) : (
          <canvas ref={canvasRef} className="w-full h-full block" />
        )}

        {/* 상단 우측 햇살 조명 인디케이터 배지 */}
        {showSunlightBadge && (
          <div className="absolute top-4 right-4 pointer-events-none flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-amber-50/80 backdrop-blur-md border border-amber-200/60 shadow-sm text-xs text-amber-900 font-medium">
            <span className="w-2 h-2 rounded-full bg-amber-600" />
            <span>
              {webglUnavailable
                ? '앤틱 책상 (2.5D 호환 모드)'
                : '앤틱 책상 위의 온기 병'}
            </span>
          </div>
        )}

        {/* 캔버스 내 '병 흔들기 (위치 섞기)' 퀵 버튼 (외부 버튼이 없을 때만 표시) */}
        {showInternalShakeButton && (
          <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleTriggerShake();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-stone-900/60 hover:bg-stone-900/80 active:scale-95 backdrop-blur-md border border-white/20 text-white text-xs font-medium shadow-md transition-all cursor-pointer"
              title="병을 흔들어 묻혀 있는 왁스 조각들을 무작위로 섞습니다"
            >
              <span>🎲</span>
              <span>병 흔들기</span>
            </button>
          </div>
        )}

        {/* 조작 힌트 */}
        {showHint && (
          <div className="absolute bottom-4 inset-x-0 mx-auto w-fit pointer-events-none px-4 py-1.5 rounded-full bg-stone-900/50 backdrop-blur-md border border-white/20 text-white/90 text-xs tracking-tight shadow-md transition-opacity duration-300">
            👆 병을 좌우로 돌리고, 원하는 왁스 조각을 눌러보세요
          </div>
        )}

        {/* 선택된 왁스 조각 프리뷰 팝업 창 (애니메이션, 날짜 단독 중앙 정렬, 일기 연결) */}
        {selectedPiece && (
          <div
            className="absolute inset-0 z-30 flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-sm transition-all"
            style={{ animation: 'previewBackdropFade 0.22s ease-out forwards' }}
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setSelectedPiece(null);
            }}
          >
            <style>{`
              @keyframes previewBackdropFade {
                from { opacity: 0; }
                to { opacity: 1; }
              }
              @keyframes previewModalPop {
                from { opacity: 0; transform: scale(0.9) translateY(14px); }
                to { opacity: 1; transform: scale(1) translateY(0); }
              }
            `}</style>
            <div
              className={`w-full max-w-xs p-5 bg-[#FFFDF9] rounded-2xl shadow-2xl border border-[#E8DFC8] text-stone-800 space-y-3.5 transform transition-all paper-texture ${
                onOpenDiaryPiece ? 'cursor-pointer hover:border-[#6B1724]/40 hover:shadow-3xl' : ''
              }`}
              style={{
                animation: 'previewModalPop 0.28s cubic-bezier(0.16, 1, 0.3, 1) forwards',
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
              onPointerUp={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenDiaryPiece && selectedPiece) {
                  const pieceToOpen = selectedPiece;
                  setSelectedPiece(null);
                  onOpenDiaryPiece(pieceToOpen);
                }
              }}
            >
              {/* 상단: 날짜만 단독 중앙 정렬 (왁스 색상 텍스트 표시 제거) */}
              <div className="flex items-center justify-center pb-0.5 border-b border-[#F0E8D8]">
                <span className="text-xs font-serif-warm tracking-widest text-stone-500 font-medium">
                  {selectedPiece.date}
                </span>
              </div>

              {/* 사진 썸네일 (일기에 사진이 등록되어 있을 때 표시) */}
              {selectedPiece.photoUrl && (
                <div className="w-full h-36 rounded-xl overflow-hidden bg-stone-100 border border-stone-200/80 shadow-inner relative">
                  <img
                    src={selectedPiece.photoUrl}
                    alt={selectedPiece.title}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                </div>
              )}

              {/* 제목 & 작성자 */}
              <div className="pt-0.5">
                <h4 className="font-serif-warm font-bold text-base text-stone-900 leading-snug break-keep">
                  {selectedPiece.title}
                </h4>
                <p className="text-xs text-stone-600 mt-1 font-sans-ui flex items-center justify-between">
                  <span>
                    기록자: <span className="font-semibold text-amber-800">{selectedPiece.authorName}</span>
                  </span>
                </p>
              </div>

              {/* 하단 액션 버튼 영역 */}
              <div className="pt-2 border-t border-[#E8DFC8] flex items-center justify-between gap-2">
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onPointerUp={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPiece(null);
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-stone-100 hover:bg-stone-200 text-stone-600 transition-colors cursor-pointer"
                >
                  닫기
                </button>

                {onOpenDiaryPiece ? (
                  <button
                    type="button"
                    onPointerDown={(e) => e.stopPropagation()}
                    onPointerUp={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      if (selectedPiece) {
                        const pieceToOpen = selectedPiece;
                        setSelectedPiece(null);
                        onOpenDiaryPiece(pieceToOpen);
                      }
                    }}
                    className="flex-1 py-1.5 px-3 rounded-lg bg-[#6B1724] hover:bg-[#831D2D] text-amber-50 text-xs font-serif-warm font-bold flex items-center justify-center gap-1 shadow-sm active:scale-95 transition-all cursor-pointer"
                  >
                    <span>일기 펼쳐보기</span>
                    <span>→</span>
                  </button>
                ) : (
                  <span className="text-[10px] text-stone-400">1:1 연결된 온기 조각</span>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }
);

MemoryJarCanvas.displayName = 'MemoryJarCanvas';

/**
 * 2.5D 호환 뷰 (WebGL 미지원 시 작동)
 */
interface Jar2DFallbackViewProps {
  pieces: WaxPieceData[];
  autoRotate: boolean;
  isInteracting: boolean;
  onSelectPiece: (piece: WaxPieceData) => void;
  onRetry: () => void;
}

const Jar2DFallbackView: React.FC<Jar2DFallbackViewProps> = ({
  pieces,
  autoRotate,
  onSelectPiece,
  onRetry,
}) => {
  const [shuffledPieces, setShuffledPieces] = useState<WaxPieceData[]>(pieces);
  const [rotationAngle, setRotationAngle] = useState(0);

  useEffect(() => {
    setShuffledPieces(pieces);
  }, [pieces]);

  useEffect(() => {
    if (!autoRotate) return;
    const interval = setInterval(() => {
      setRotationAngle((prev) => (prev + 0.8) % 360);
    }, 30);
    return () => clearInterval(interval);
  }, [autoRotate]);

  // 호환 모드 흔들기
  const handleShuffle = () => {
    try {
      soundEngine.playTileSlideSound();
    } catch {}
    setShuffledPieces((prev) => [...prev].sort(() => Math.random() - 0.5));
  };

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-center overflow-hidden p-6">
      {/* 우측 상단 따스한 오후 햇살 은은한 앰비언트 (파티클 제거) */}
      <div className="absolute -top-12 -right-12 w-80 h-80 rounded-full bg-gradient-to-br from-amber-200/25 via-amber-400/10 to-transparent blur-3xl pointer-events-none" />

      {/* 2.5D 유리병 실루엣 컨테이너 */}
      <div className="relative w-56 sm:w-64 h-96 flex flex-col items-center justify-end z-10">
        {/* 상단 코르크 마개 */}
        <div className="w-20 h-8 bg-gradient-to-b from-[#A07855] via-[#8C6747] to-[#6E4F35] rounded-t-md border border-[#5A402A] shadow-md z-10 relative">
          <div className="absolute inset-x-2 top-1 h-1 rounded-full bg-amber-200/30 blur-[0.5px]" />
        </div>

        {/* 병목 황동 링 */}
        <div className="w-24 h-3 bg-gradient-to-r from-[#D4AF37] via-[#F3E5AB] to-[#AA771C] rounded-sm border border-[#8C6212] shadow-sm z-10" />

        {/* 병목 유리 곡면 */}
        <div className="w-24 h-8 bg-gradient-to-b from-white/20 to-white/10 border-x border-white/40 backdrop-blur-[2px]" />

        {/* 유리병 본체 */}
        <div className="relative w-full h-72 rounded-[2.5rem] bg-gradient-to-br from-white/25 via-white/10 to-amber-100/10 border-2 border-white/40 shadow-2xl backdrop-blur-[3px] overflow-hidden flex flex-col justify-end p-4">
          {/* 유리 하이라이트 빛반사 라인 */}
          <div className="absolute top-4 left-6 w-3 h-48 rounded-full bg-gradient-to-b from-white/60 via-white/20 to-transparent blur-[1px] transform -rotate-3 pointer-events-none" />
          <div className="absolute top-6 right-8 w-2 h-40 rounded-full bg-gradient-to-b from-amber-100/40 via-white/10 to-transparent blur-[1px] transform rotate-2 pointer-events-none" />

          {/* 내부 왁스 조각들이 층층이 담긴 공간 */}
          <div className="relative w-full h-44 flex flex-wrap content-end justify-center gap-1.5 p-2 z-10">
            {shuffledPieces.map((piece, index) => {
              const rad = ((rotationAngle + index * 45) * Math.PI) / 180;
              const scale = 0.85 + Math.sin(rad) * 0.15;
              const opacity = 0.75 + Math.cos(rad) * 0.25;

              return (
                <button
                  key={piece.id || index}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectPiece(piece);
                  }}
                  title={`${piece.authorName} - ${piece.title}`}
                  className="group relative cursor-pointer transform transition-transform active:scale-90"
                  style={{
                    transform: `scale(${scale})`,
                    opacity,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-full shadow-lg border border-white/30 flex items-center justify-center transform transition-transform group-hover:scale-110"
                    style={{
                      backgroundColor: piece.color,
                      boxShadow: `0 4px 12px ${piece.color}66`,
                    }}
                  >
                    <span className="text-[10px] text-white/90 font-serif font-bold">溫</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* 두툼한 유리병 바닥 베이스 */}
          <div className="absolute inset-x-0 bottom-0 h-4 bg-white/25 border-t border-white/30" />
        </div>

        {/* 바닥 그림자 */}
        <div className="w-52 h-4 rounded-full bg-black/50 blur-md mt-1" />
      </div>

      {/* 앤틱 원목 책상 상판 (2.5D 다크 데스크 베이스) */}
      <div className="relative w-full max-w-sm h-7 -mt-2 rounded-t-xl bg-gradient-to-r from-[#1C0D05] via-[#261308] to-[#170B04] border-t-2 border-[#4A2612] shadow-2xl flex items-center justify-center overflow-hidden">
        <div className="absolute inset-x-0 top-0 h-[1px] bg-[#D7A573]/20" />
        <div className="text-[10px] text-[#A67C52]/40 font-serif-warm tracking-wider select-none">
          antique wooden desk
        </div>
      </div>

      {/* WebGL 하드웨어 가속 설정 안내 카드 */}
      <div className="mt-4 max-w-xs p-3 rounded-xl bg-amber-950/60 border border-amber-700/50 backdrop-blur-md text-[11px] text-amber-200/90 space-y-1.5 text-center">
        <p className="font-semibold text-amber-300">
          ⚠️ 브라우저 WebGL 가속 비활성화 감지
        </p>
        <p className="text-stone-300 text-[10.5px] leading-relaxed">
          현재 브라우저의 하드웨어 가속이 꺼져 있어 <strong>2.5D 호환 모드</strong>로 구동 중입니다.
        </p>
        <div className="flex items-center justify-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleShuffle}
            className="px-2.5 py-1 rounded-md bg-stone-800 hover:bg-stone-700 text-stone-200 text-[10.5px] transition-colors"
          >
            🎲 위치 섞기
          </button>
          <button
            type="button"
            onClick={onRetry}
            className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-[10.5px] transition-colors"
          >
            🔄 3D 재시도
          </button>
        </div>
      </div>
    </div>
  );
};
