import * as THREE from '/vendor/three.module.js';
import { createGlassJarGroup } from './jarGeometry.js';
import { SunlightSceneManager } from './sunlightScene.js';
import { createMarblesGroup } from './marbleGeometry.js';
import { MarblePhysicsEngine } from './marblePhysics.js';

const stageEl = document.getElementById('jar-stage');
const canvas = document.getElementById('jar-canvas');
const btnHome = document.getElementById('btn-home');
const btnMinus = document.getElementById('btn-minus');
const btnPlus = document.getElementById('btn-plus');
const btnCork = document.getElementById('btn-cork');
const countValEl = document.getElementById('marble-count-val');
const selectedBadge = document.getElementById('selected-badge');

const cooldownToast = document.getElementById('cooldown-toast');
const pickerPopover = document.getElementById('picker-popover');
const pickerList = document.getElementById('picker-list');
const pickerTotal = document.getElementById('picker-total');
const btnPrev = document.getElementById('btn-prev');
const btnMonth = document.getElementById('btn-month');
const monthLabel = document.getElementById('month-label');
const chevronDown = document.getElementById('chevron-down');
const btnNext = document.getElementById('btn-next');
const btnShake = document.getElementById('btn-shake');

const monthJars = [
  { key: '2026-09', label: '2026년 9월', count: 11, isLatest: false },
  { key: '2026-10', label: '2026년 10월', count: 22, isLatest: false },
  { key: '2026-11', label: '2026년 11월', count: 18, isLatest: true },
];
let selectedMonthIndex = 2;
let isCorkOpen = monthJars[selectedMonthIndex].isLatest;
let isPickerOpen = false;
let isThrottled = false;
let isSliding = false;
let lastShakeTime = 0;

function getStageSize() {
  const w = stageEl.clientWidth || window.innerWidth;
  const h = stageEl.clientHeight || Math.max(window.innerHeight, 480);
  return { w, h };
}

const initialSize = getStageSize();
const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true,
  powerPreference: 'high-performance',
});
renderer.setSize(initialSize.w, initialSize.h);
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const sceneManager = new SunlightSceneManager(initialSize.w, initialSize.h, renderer);
const { jarGroup, setCorkOpen } = createGlassJarGroup({ isCorkOpen });
sceneManager.scene.add(jarGroup);

let { marblesGroup, marbleObjects } = createMarblesGroup(monthJars[selectedMonthIndex].count);
jarGroup.add(marblesGroup);

const physics = new MarblePhysicsEngine(marbleObjects);

function rebuildMarbles(count) {
  jarGroup.remove(marblesGroup);
  const next = createMarblesGroup(count);
  marblesGroup = next.marblesGroup;
  marbleObjects = next.marbleObjects;
  jarGroup.add(marblesGroup);
  physics.initBodies(marbleObjects);
  countValEl.textContent = String(count);
  selectedBadge.classList.add('hidden');
}

function updateUI() {
  const current = monthJars[selectedMonthIndex];
  monthLabel.textContent = current.label;
  countValEl.textContent = String(current.count);

  btnPrev.disabled = selectedMonthIndex <= 0 || isSliding;
  btnNext.disabled = selectedMonthIndex >= monthJars.length - 1 || isSliding;
  btnShake.disabled = isThrottled || isSliding || current.count <= 0;

  pickerTotal.textContent = `${monthJars.length}개의 온기 달`;
  pickerList.innerHTML = '';
  monthJars.forEach((jar, idx) => {
    const active = idx === selectedMonthIndex;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `picker-item font-serif-warm${active ? ' active' : ''}`;
    btn.innerHTML = `
      <span class="picker-item-left">
        <span style="color:${active ? '#fcd34d' : 'rgba(251,191,36,0.4)'};font-weight:${active ? 700 : 400}">•</span>
        <span>${jar.label}</span>
        ${jar.isLatest ? '<span class="badge-live">기록 중</span>' : ''}
      </span>
      <span class="picker-item-right">${jar.count}알</span>
    `;
    btn.addEventListener('click', () => {
      if (idx === selectedMonthIndex || isSliding) {
        togglePicker(false);
        return;
      }
      const dir = idx < selectedMonthIndex ? 'prev' : 'next';
      togglePicker(false);
      startSlideTransition(dir, idx);
    });
    pickerList.appendChild(btn);
  });
}

function togglePicker(force) {
  isPickerOpen = typeof force === 'boolean' ? force : !isPickerOpen;
  pickerPopover.classList.toggle('hidden', !isPickerOpen);
  chevronDown.classList.toggle('open', isPickerOpen);
}

// 원본 MemoryJarCanvas.tsx와 동일한 슬라이드 전환 애니메이션
const slideAnim = {
  active: false,
  phase: 'EXIT',
  progress: 0,
  direction: 'next',
  targetIndex: selectedMonthIndex,
  swapped: false,
};
let slideOffsetX = 0;
let slideTiltZ = 0;
const maxSlideDist = 11;

function startSlideTransition(direction, nextIndex) {
  if (slideAnim.active) return;
  isSliding = true;
  slideAnim.active = true;
  slideAnim.phase = 'EXIT';
  slideAnim.progress = 0;
  slideAnim.direction = direction;
  slideAnim.targetIndex = nextIndex;
  slideAnim.swapped = false;
  updateUI();
}

// 원본 MemoryJarCanvas.tsx와 동일한 포인터 회전 & 관성
let isDragging = false;
let lastPointerX = 0;
let pointerDownPos = { x: 0, y: 0, time: 0 };
let targetRotationY = 0;
let rotationY = 0;
let dragInertia = 0;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();

canvas.addEventListener('pointerdown', (e) => {
  if (slideAnim.active) return;
  isDragging = true;
  dragInertia = 0;
  lastPointerX = e.clientX;
  pointerDownPos = { x: e.clientX, y: e.clientY, time: Date.now() };
  try {
    canvas.setPointerCapture(e.pointerId);
  } catch {}
});

window.addEventListener('pointermove', (e) => {
  if (!isDragging) return;
  const dx = e.clientX - lastPointerX;
  lastPointerX = e.clientX;

  const sensitivity = 0.0075;
  targetRotationY += dx * sensitivity;
  dragInertia = dx * sensitivity * 0.75;
});

window.addEventListener('pointerup', (e) => {
  if (!isDragging) return;
  isDragging = false;

  const deltaDist = Math.hypot(e.clientX - pointerDownPos.x, e.clientY - pointerDownPos.y);
  const deltaTime = Date.now() - pointerDownPos.time;

  if (deltaDist < 8 && deltaTime < 450) {
    dragInertia = 0;
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, sceneManager.camera);

    const targets = marbleObjects.map((m) => m.userData.outerMesh).filter(Boolean);
    const hits = raycaster.intersectObjects(targets, false);
    if (hits.length > 0) {
      const info = hits[0].object.userData;
      selectedBadge.textContent = `구슬 #${info.marbleIndex + 1} · ${info.paletteName}`;
      selectedBadge.classList.remove('hidden');
    } else {
      selectedBadge.classList.add('hidden');
    }
  }

  try {
    canvas.releasePointerCapture(e.pointerId);
  } catch {}
});

// UI 이벤트
btnHome.addEventListener('click', () => {
  targetRotationY = 0;
  dragInertia = 0;
});

btnPrev.addEventListener('click', () => {
  if (selectedMonthIndex <= 0 || isSliding) return;
  togglePicker(false);
  startSlideTransition('prev', selectedMonthIndex - 1);
});

btnNext.addEventListener('click', () => {
  if (selectedMonthIndex >= monthJars.length - 1 || isSliding) return;
  togglePicker(false);
  startSlideTransition('next', selectedMonthIndex + 1);
});

btnMonth.addEventListener('click', (e) => {
  e.stopPropagation();
  togglePicker();
});

document.addEventListener('pointerdown', (e) => {
  if (isPickerOpen && !pickerPopover.contains(e.target) && !btnMonth.contains(e.target)) {
    togglePicker(false);
  }
});

let toastTimer = null;
btnShake.addEventListener('click', () => {
  if (isSliding) return;
  const now = Date.now();
  if (now - lastShakeTime < 1000) {
    cooldownToast.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => cooldownToast.classList.add('hidden'), 1200);
    return;
  }

  lastShakeTime = now;
  isThrottled = true;
  updateUI();
  physics.triggerShake(1.0);

  setTimeout(() => {
    isThrottled = false;
    updateUI();
  }, 1000);
});

btnMinus.addEventListener('click', () => {
  const next = Math.max(1, monthJars[selectedMonthIndex].count - 3);
  monthJars[selectedMonthIndex].count = next;
  rebuildMarbles(next);
  updateUI();
});

btnPlus.addEventListener('click', () => {
  const next = Math.min(45, monthJars[selectedMonthIndex].count + 3);
  monthJars[selectedMonthIndex].count = next;
  rebuildMarbles(next);
  updateUI();
});

btnCork.addEventListener('click', () => {
  isCorkOpen = !isCorkOpen;
  setCorkOpen(isCorkOpen);
});

window.addEventListener('resize', () => {
  const { w, h } = getStageSize();
  if (w <= 0 || h <= 0) return;
  renderer.setSize(w, h);
  sceneManager.resize(w, h);
});

updateUI();

let prevTime = performance.now();
function animate(now) {
  requestAnimationFrame(animate);
  const deltaTime = Math.min((now - prevTime) / 1000, 0.05);
  prevTime = now;

  // 월별 슬라이드 전환 (MemoryJarCanvas.tsx 동일)
  if (slideAnim.active) {
    slideAnim.progress += deltaTime * 3.6;
    if (slideAnim.phase === 'EXIT') {
      const t = Math.min(slideAnim.progress, 1);
      const eased = t * t;
      const sign = slideAnim.direction === 'next' ? -1 : 1;
      slideOffsetX = sign * maxSlideDist * eased;
      slideTiltZ = sign * 0.07 * eased;

      if (slideAnim.progress >= 1) {
        if (!slideAnim.swapped) {
          slideAnim.swapped = true;
          selectedMonthIndex = slideAnim.targetIndex;
          const nextJar = monthJars[selectedMonthIndex];
          isCorkOpen = nextJar.isLatest;
          setCorkOpen(isCorkOpen);
          rebuildMarbles(nextJar.count);
        }
        slideAnim.phase = 'ENTER';
        slideAnim.progress = 0;
      }
    } else if (slideAnim.phase === 'ENTER') {
      const t = Math.min(slideAnim.progress, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      const sign = slideAnim.direction === 'next' ? 1 : -1;
      slideOffsetX = sign * maxSlideDist * (1 - eased);
      slideTiltZ = sign * 0.07 * (1 - eased);

      if (slideAnim.progress >= 1) {
        slideOffsetX = 0;
        slideTiltZ = 0;
        slideAnim.active = false;
        isSliding = false;
        updateUI();
      }
    }
  } else {
    slideOffsetX = 0;
    slideTiltZ = 0;
  }

  physics.step(deltaTime);

  // 원본 MemoryJarCanvas.tsx와 100% 동일한 병 위치/회전 바인딩
  jarGroup.position.x = physics.shakeOffset.x + slideOffsetX;
  jarGroup.position.y = -2.35 + physics.shakeOffset.y;
  jarGroup.position.z = physics.shakeOffset.z;

  if (!isDragging && Math.abs(dragInertia) > 0.0001) {
    targetRotationY += dragInertia;
    dragInertia *= 0.93;
  }

  rotationY += (targetRotationY - rotationY) * 0.22;

  jarGroup.rotation.y = rotationY;
  jarGroup.rotation.x = 0;
  jarGroup.rotation.z = slideTiltZ;

  sceneManager.update(now);
  renderer.render(sceneManager.scene, sceneManager.camera);
}

requestAnimationFrame(animate);
