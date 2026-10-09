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
  shake: () => void;
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

    // 병 회전 인터랙션 상태 (관성 & 매끄러운 손끝 반응)
    const rotationYRef = useRef<number>(0);
    const targetRotationYRef = useRef<number>(0);
    const rotationXRef = useRef<number>(0);
    const targetRotationXRef = useRef<number>(0);

    const isDraggingRef = useRef<boolean>(false);
    const lastPointerXRef = useRef<number>(0);
    const lastPointerYRef = useRef<number>(0);
    const pointerDownPosRef = useRef<{ x: number; y: number; time: number }>({ x: 0, y: 0, time: 0 });
    const dragInertiaRef = useRef<number>(0);

    // 외부 명령(흔들기) 노출
    const handleTriggerShake = useCallback(() => {
      if (physicsEngineRef.current) {
        physicsEngineRef.current.triggerShake(1.0);
        try {
          soundEngine.playTileSlideSound();
        } catch {}
      }
    }, []);

    useImperativeHandle(ref, () => ({
      shake: handleTriggerShake,
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

        // 단일 겹 유리병 생성
        const { jarGroup } = createGlassJarGroup();
        jarGroupRef.current = jarGroup;

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

          // 물리 시뮬레이션 갱신 (흔들림 및 연속 텀블링 낙하)
          if (physics) {
            physics.update(deltaTime);

            // 병 자체의 탄성 흔들림 오프셋 반영 (덜컹거림 없는 연속 곡선)
            jarGroup.position.x = physics.shakeOffset.x;
            jarGroup.position.y = -2.35 + physics.shakeOffset.y;
            jarGroup.position.z = physics.shakeOffset.z;
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

          // 손끝과 즉각적으로 일체화되는 부드러운 회전 보간 (지연 없는 0.22 계수)
          rotationYRef.current += (targetRotationYRef.current - rotationYRef.current) * 0.22;
          rotationXRef.current += (targetRotationXRef.current - rotationXRef.current) * 0.22;

          jarGroup.rotation.y = rotationYRef.current;
          jarGroup.rotation.x = Math.max(-0.15, Math.min(0.2, rotationXRef.current));

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

        // 자이로스코프 기울기 연동 (명시적으로 켜져 있을 때만)
        const handleDeviceOrientation = (event: DeviceOrientationEvent) => {
          if (!optionsRef.current.enableGyroscope || isDraggingRef.current) return;
          const gamma = event.gamma ?? 0;
          const beta = event.beta ?? 0;
          targetRotationYRef.current += gamma * 0.0004;
          targetRotationXRef.current = (beta - 45) * 0.003;
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
      isDraggingRef.current = true;
      setIsInteracting(true);
      dragInertiaRef.current = 0; // 터치 시 즉시 이전 회전 관성 멈춤
      lastPointerXRef.current = e.clientX;
      lastPointerYRef.current = e.clientY;
      pointerDownPosRef.current = { x: e.clientX, y: e.clientY, time: Date.now() };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    };

    // 마우스/터치 이동 (손끝과 오차 없이 100% 일체화되는 매끄러운 3D 회전 추종)
    const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
      if (isDraggingRef.current) {
        const dx = e.clientX - lastPointerXRef.current;
        const dy = e.clientY - lastPointerYRef.current;
        lastPointerXRef.current = e.clientX;
        lastPointerYRef.current = e.clientY;

        const sensitivity = 0.0075;
        targetRotationYRef.current += dx * sensitivity;
        targetRotationXRef.current += dy * (sensitivity * 0.35);

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
      const intersects = raycaster.intersectObjects(waxMeshesRef.current, true);

      if (intersects.length > 0) {
        let hit: THREE.Object3D | null = intersects[0].object;
        while (hit && !(hit.userData && hit.userData.title) && hit.parent) {
          hit = hit.parent;
        }

        if (hit && hoveredMeshRef.current !== hit) {
          const meshHit = hit as THREE.Mesh;
          if (hoveredMeshRef.current && (hoveredMeshRef.current.material as THREE.MeshStandardMaterial)?.emissive) {
            (hoveredMeshRef.current.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
          }
          if (meshHit.material && (meshHit.material as THREE.MeshStandardMaterial)?.emissive) {
            (meshHit.material as THREE.MeshStandardMaterial).emissive.setHex(0x442211);
          }
          hoveredMeshRef.current = meshHit;
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
      const now = Date.now();
      if (now - lastPickTimeRef.current < 200) return;
      lastPickTimeRef.current = now;

      const canvas = canvasRef.current;
      const sceneManager = sceneManagerRef.current;
      if (!canvas || !sceneManager || waxMeshesRef.current.length === 0) return;

      const rect = canvas.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((clientY - rect.top) / rect.height) * 2 + 1;

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(new THREE.Vector2(x, y), sceneManager.camera);

      // 투명 유리는 관통하여 오직 waxMeshesRef(왁스 조각들)만 정확히 검출
      const intersects = raycaster.intersectObjects(waxMeshesRef.current, true);

      if (intersects.length > 0) {
        // 가장 앞쪽에서 클릭된 1:1 대응 왁스 조각 (상위 메쉬 탐색)
        let hitMesh: THREE.Object3D | null = intersects[0].object;
        while (hitMesh && !(hitMesh.userData && hitMesh.userData.title) && hitMesh.parent) {
          hitMesh = hitMesh.parent;
        }

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
        onClick={(e) => {
          handleRaycastPick(e.clientX, e.clientY);
        }}
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
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
            <span>
              {webglUnavailable
                ? '따스한 오후 햇살 (2.5D 호환 모드)'
                : '따스한 오후 햇살 (Top-Right 3D)'}
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
            👆 병을 360° 돌리고, 원하는 왁스 조각을 눌러보세요
          </div>
        )}

        {/* 선택된 왁스 조각 프리뷰 팝업 창 (일기 날짜/사진/제목 및 탭 시 일기 열기) */}
        {selectedPiece && (
          <div
            className="absolute inset-0 z-20 flex items-center justify-center p-4 bg-stone-950/45 backdrop-blur-sm transition-all"
            onClick={() => setSelectedPiece(null)}
          >
            <div
              className={`w-full max-w-xs p-5 bg-[#FFFDF9] rounded-2xl shadow-2xl border border-[#E8DFC8] text-stone-800 space-y-3.5 transform transition-all scale-100 paper-texture ${
                onOpenDiaryPiece ? 'cursor-pointer hover:border-[#6B1724]/40 hover:shadow-3xl' : ''
              }`}
              onClick={(e) => {
                e.stopPropagation();
                if (onOpenDiaryPiece) {
                  onOpenDiaryPiece(selectedPiece);
                  setSelectedPiece(null);
                }
              }}
            >
              {/* 상단: 왁스 색상 인장 뱃지 & 날짜 */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="w-4 h-4 rounded-full shadow-inner border border-black/10"
                    style={{ backgroundColor: selectedPiece.color }}
                  />
                  <span className="text-xs font-semibold text-stone-500 font-serif-warm">
                    {selectedPiece.label} (실링 왁스)
                  </span>
                </div>
                <span className="text-[11px] text-stone-400 font-mono">{selectedPiece.date}</span>
              </div>

              {/* 사진 썸네일 (일기에 사진이 등록되어 있을 때 표시) */}
              {selectedPiece.photoUrl && (
                <div className="w-full h-36 rounded-xl overflow-hidden bg-stone-100 border border-stone-200/80 shadow-inner relative">
                  <img
                    src={selectedPiece.photoUrl}
                    alt={selectedPiece.title}
                    className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                  />
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-black/60 backdrop-blur-xs text-[10px] text-white font-medium">
                    사진 첨부
                  </div>
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenDiaryPiece(selectedPiece);
                      setSelectedPiece(null);
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
      {/* 우측 상단 햇빛 광원 그러데이션 */}
      <div className="absolute -top-12 -right-12 w-80 h-80 rounded-full bg-gradient-to-br from-amber-200/35 via-amber-400/15 to-transparent blur-3xl pointer-events-none" />

      {/* 햇살 속 부유하는 반짝이는 먼지 파티클 */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(16)].map((_, i) => (
          <div
            key={i}
            className="absolute rounded-full bg-amber-200/70 blur-[0.5px] animate-pulse"
            style={{
              width: `${(i % 3) * 2 + 2}px`,
              height: `${(i % 3) * 2 + 2}px`,
              top: `${15 + (i * 5) % 65}%`,
              left: `${20 + (i * 9) % 65}%`,
              animationDuration: `${2 + (i % 3)}s`,
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* 2.5D 유리병 실루엣 컨테이너 */}
      <div className="relative w-56 sm:w-64 h-96 flex flex-col items-center justify-end">
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
        <div className="w-52 h-4 rounded-full bg-black/40 blur-md mt-1" />
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
