'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { soundEngine } from '@/lib/audio';
import confetti from 'canvas-confetti';
import { Sparkles, RotateCcw, Stamp, Hand, Palette } from 'lucide-react';

interface StampJigsawPuzzleProps {
  onSolve: () => void;
  partnerName?: string;
}

const STAMP_WIDTH = 154;
const STAMP_HEIGHT = 196;
const BOARD_WIDTH = 308;
const BOARD_HEIGHT = 410;
const TARGET_X = (BOARD_WIDTH - STAMP_WIDTH) / 2; // 77px
const TARGET_Y = 12; // 12px from top

export interface StampTheme {
  id: string;
  name: string;
  badgeLabel: string;
  bgGradStart: string;
  bgGradMid: string;
  bgGradEnd: string;
  primaryColor: string;
  secondaryColor: string;
  accentGold: string;
  perforateColor: string;
  innerBg: string;
  topHeaderHanzi: string;
  topHeaderSub: string;
  centerTitle: string;
  denomWon: string;
  denomYear: string;
  bottomMotto: string;
  sealColor: string;
  renderSymbol: (theme: StampTheme) => React.ReactNode;
}

export const STAMP_THEMES: StampTheme[] = [
  {
    id: 'classic-burgundy',
    name: '버건디 깃펜',
    badgeLabel: '버건디 깃펜',
    bgGradStart: '#FFFDF9',
    bgGradMid: '#F9F3EA',
    bgGradEnd: '#F2E8D8',
    primaryColor: '#8C2131',
    secondaryColor: '#54121C',
    accentGold: '#B8860B',
    perforateColor: '#C4A882',
    innerBg: '#FAF5ED',
    topHeaderHanzi: '大韓 溫氣 郵便',
    topHeaderSub: 'SPECIAL CORRESPONDENCE',
    centerTitle: '온기 · 溫氣',
    denomWon: '42',
    denomYear: '1926',
    bottomMotto: '★ TWO SOULS UNITED ★',
    sealColor: '#6B1724',
    renderSymbol: (theme) => (
      <g transform={`translate(${STAMP_WIDTH / 2 - 14}, ${STAMP_HEIGHT / 2 - 18})`}>
        <path
          d="M 14,3 C 20,10 20,21 14,32 C 8,21 8,10 14,3 Z"
          fill={`url(#stampInkGrad-${theme.id})`}
          opacity="0.88"
        />
        <circle cx="14" cy="14" r="2.5" fill="#E3B338" />
        <path d="M 12.5,18 L 15.5,18 L 14,35 Z" fill={theme.secondaryColor} />
      </g>
    ),
  },
  {
    id: 'forest-dove',
    name: '포레스트 비둘기',
    badgeLabel: '포레스트 비둘기',
    bgGradStart: '#F9FDF7',
    bgGradMid: '#EFF6EF',
    bgGradEnd: '#E3ECE2',
    primaryColor: '#22543D',
    secondaryColor: '#143727',
    accentGold: '#C59B27',
    perforateColor: '#A3BFA8',
    innerBg: '#F2F7F2',
    topHeaderHanzi: '愛之 郵便 · 平和',
    topHeaderSub: 'SECRET CARRIER DOVE',
    centerTitle: '초록의 온기 · 翠綠',
    denomWon: '77',
    denomYear: '1988',
    bottomMotto: '★ ALWAYS IN MY HEART ★',
    sealColor: '#1B4732',
    renderSymbol: (theme) => (
      <g transform={`translate(${STAMP_WIDTH / 2 - 16}, ${STAMP_HEIGHT / 2 - 18})`}>
        {/* 날개 펼친 평화의 전서구 */}
        <path
          d="M 16,23 C 13,19 7,16 4,14 C 4,11 10,12 14,14 C 13,10 12,5 15,2 C 18,7 19,13 18,17 C 22,14 27,11 29,12 C 27,15 22,18 19,21 C 21,24 22,28 23,31 C 20,29 18,26 16,23 Z"
          fill={theme.primaryColor}
          opacity="0.9"
        />
        <circle cx="26" cy="13.5" r="1.1" fill={theme.accentGold} />
        {/* 부리에 물린 올리브 잎가지 */}
        <path d="M 27,14 Q 31,15 33,13" fill="none" stroke={theme.accentGold} strokeWidth="1.2" strokeLinecap="round" />
        <ellipse cx="32" cy="11.5" rx="2" ry="1.1" fill={theme.primaryColor} transform="rotate(-20 32 11.5)" />
        <ellipse cx="30" cy="16" rx="1.8" ry="1" fill={theme.primaryColor} transform="rotate(30 30 16)" />
      </g>
    ),
  },
  {
    id: 'midnight-moon',
    name: '미드나잇 달빛',
    badgeLabel: '미드나잇 달빛',
    bgGradStart: '#F5F8FE',
    bgGradMid: '#E8EEF8',
    bgGradEnd: '#DBE4F2',
    primaryColor: '#1E3A5F',
    secondaryColor: '#10223A',
    accentGold: '#DDA218',
    perforateColor: '#9BB1D0',
    innerBg: '#EFF4FA',
    topHeaderHanzi: '星夜 郵便 · 永遠',
    topHeaderSub: 'MIDNIGHT RENDEZVOUS',
    centerTitle: '달빛 서약 · 月光',
    denomWon: '99',
    denomYear: '2026',
    bottomMotto: '★ SHINING LIKE THE STARS ★',
    sealColor: '#152B47',
    renderSymbol: (theme) => (
      <g transform={`translate(${STAMP_WIDTH / 2 - 16}, ${STAMP_HEIGHT / 2 - 18})`}>
        {/* 우아한 초승달 */}
        <path
          d="M 19,4 C 11,6 6,13 8,22 C 10,29 17,33 24,31 C 18,29 14,24 14,18 C 14,12 18,6 24,4 C 22,4 20,4 19,4 Z"
          fill={theme.primaryColor}
          opacity="0.92"
        />
        {/* 반짝이는 4방향 별 */}
        <path
          d="M 25,12 Q 25,16 29,16 Q 25,16 25,20 Q 25,16 21,16 Q 25,16 25,12 Z"
          fill={theme.accentGold}
        />
        <circle cx="8" cy="11" r="1.2" fill={theme.accentGold} opacity="0.8" />
        <circle cx="10" cy="27" r="1" fill={theme.accentGold} opacity="0.75" />
        <circle cx="28" cy="25" r="1.3" fill={theme.accentGold} opacity="0.85" />
      </g>
    ),
  },
  {
    id: 'sunset-camellia',
    name: '선셋 동백꽃',
    badgeLabel: '선셋 동백꽃',
    bgGradStart: '#FDF8F6',
    bgGradMid: '#FAECE7',
    bgGradEnd: '#F3DDD6',
    primaryColor: '#A83220',
    secondaryColor: '#6E1B0E',
    accentGold: '#D88B27',
    perforateColor: '#D19F95',
    innerBg: '#FAF0ED',
    topHeaderHanzi: '花語 郵便 · 初心',
    topHeaderSub: 'BLOOMING AFFECTION',
    centerTitle: '그리움의 꽃 · 冬柏',
    denomWon: '520',
    denomYear: '2024',
    bottomMotto: '★ LOVE THAT NEVER FADES ★',
    sealColor: '#7E2314',
    renderSymbol: (theme) => (
      <g transform={`translate(${STAMP_WIDTH / 2 - 16}, ${STAMP_HEIGHT / 2 - 17})`}>
        {/* 푸른 잎사귀 */}
        <path d="M 9,24 Q 4,27 7,32 Q 12,31 12,26 Z" fill="#3D5A38" opacity="0.85" />
        <path d="M 23,25 Q 28,28 25,33 Q 20,32 20,27 Z" fill="#3D5A38" opacity="0.85" />
        {/* 5장의 동백꽃잎 */}
        <ellipse cx="16" cy="10" rx="6.5" ry="5.5" fill={theme.primaryColor} opacity="0.92" />
        <ellipse cx="22" cy="15" rx="6.5" ry="5.5" fill={theme.primaryColor} opacity="0.92" transform="rotate(40 22 15)" />
        <ellipse cx="19" cy="22" rx="6.5" ry="5.5" fill={theme.primaryColor} opacity="0.92" transform="rotate(80 19 22)" />
        <ellipse cx="13" cy="22" rx="6.5" ry="5.5" fill={theme.primaryColor} opacity="0.92" transform="rotate(-80 13 22)" />
        <ellipse cx="10" cy="15" rx="6.5" ry="5.5" fill={theme.primaryColor} opacity="0.92" transform="rotate(-40 10 15)" />
        {/* 내부 꽃심 및 황금 꽃술 */}
        <circle cx="16" cy="16" r="4.2" fill={theme.secondaryColor} />
        <circle cx="16" cy="16" r="2.2" fill={theme.accentGold} />
        <circle cx="14.5" cy="14.5" r="0.9" fill="#FFE58F" />
        <circle cx="17.5" cy="14.5" r="0.9" fill="#FFE58F" />
        <circle cx="16" cy="18" r="0.9" fill="#FFE58F" />
      </g>
    ),
  },
  {
    id: 'sepia-pocketwatch',
    name: '세피아 회중시계',
    badgeLabel: '세피아 회중시계',
    bgGradStart: '#FAF7F2',
    bgGradMid: '#F2EBE0',
    bgGradEnd: '#E7DCCB',
    primaryColor: '#63452E',
    secondaryColor: '#3D2716',
    accentGold: '#B8860B',
    perforateColor: '#BDA58E',
    innerBg: '#F5EFE6',
    topHeaderHanzi: '歲月 郵便 · 記憶',
    topHeaderSub: 'TIMELESS MEMORIES',
    centerTitle: '기억의 서재 · 歲月',
    denomWon: '365',
    denomYear: '2025',
    bottomMotto: '★ EVERY MOMENT WITH YOU ★',
    sealColor: '#4A3220',
    renderSymbol: (theme) => (
      <g transform={`translate(${STAMP_WIDTH / 2 - 16}, ${STAMP_HEIGHT / 2 - 17})`}>
        {/* 상단 고리 & 크라운 */}
        <circle cx="16" cy="4" r="3.2" fill="none" stroke={theme.accentGold} strokeWidth="1.4" />
        <rect x="14.5" y="6" width="3" height="2" fill={theme.accentGold} />
        {/* 시계 몸통 다이얼 */}
        <circle cx="16" cy="18" r="13" fill={theme.innerBg} stroke={theme.primaryColor} strokeWidth="1.8" />
        <circle cx="16" cy="18" r="10.5" fill="none" stroke={theme.accentGold} strokeWidth="0.8" strokeDasharray="1.5 1.5" />
        {/* 4방향 인덱스 */}
        <rect x="15.5" y="9" width="1" height="2" fill={theme.primaryColor} />
        <rect x="23" y="17.5" width="2" height="1" fill={theme.primaryColor} />
        <rect x="15.5" y="25" width="1" height="2" fill={theme.primaryColor} />
        <rect x="9" y="17.5" width="2" height="1" fill={theme.primaryColor} />
        {/* 시침 및 분침 (10시 10분) */}
        <line x1="16" y1="18" x2="12.5" y2="13.5" stroke={theme.secondaryColor} strokeWidth="1.4" strokeLinecap="round" />
        <line x1="16" y1="18" x2="20.5" y2="14" stroke={theme.secondaryColor} strokeWidth="1.1" strokeLinecap="round" />
        <circle cx="16" cy="18" r="1.5" fill={theme.accentGold} />
      </g>
    ),
  },
  {
    id: 'lavender-twilight',
    name: '트와일라잇 연서',
    badgeLabel: '트와일라잇 연서',
    bgGradStart: '#FBF7FC',
    bgGradMid: '#F3EBF5',
    bgGradEnd: '#E9DBEB',
    primaryColor: '#6E3569',
    secondaryColor: '#451B41',
    accentGold: '#C8952B',
    perforateColor: '#C3A4C7',
    innerBg: '#F7EEF8',
    topHeaderHanzi: '心音 郵便 · 告白',
    topHeaderSub: 'WHISPERING TWILIGHT',
    centerTitle: '수줍은 고백 · 戀書',
    denomWon: '1004',
    denomYear: '2026',
    bottomMotto: '★ TO MY ONE AND ONLY ★',
    sealColor: '#4E214B',
    renderSymbol: (theme) => (
      <g transform={`translate(${STAMP_WIDTH / 2 - 16}, ${STAMP_HEIGHT / 2 - 17})`}>
        {/* 편지 봉투 본체 */}
        <rect x="3" y="9" width="26" height="18" rx="2" fill="#FAF5FA" stroke={theme.primaryColor} strokeWidth="1.4" />
        <path d="M 3,9 L 16,19 L 29,9" fill="none" stroke={theme.primaryColor} strokeWidth="1.2" />
        <path d="M 3,27 L 11,18" stroke={theme.primaryColor} strokeWidth="0.8" opacity="0.6" />
        <path d="M 29,27 L 21,18" stroke={theme.primaryColor} strokeWidth="0.8" opacity="0.6" />
        {/* 중앙 하트 왁스 실링 */}
        <path
          d="M 16,16 C 14.5,14 12,14.5 12,16.5 C 12,18.5 16,21.5 16,21.5 C 16,21.5 20,18.5 20,16.5 C 20,14.5 17.5,14 16,16 Z"
          fill={theme.accentGold}
        />
        <circle cx="16" cy="18" r="0.8" fill="#FFFDF9" />
      </g>
    ),
  },
];

// 앤틱 대형 우표 원본 그래픽 SVG 컴포넌트 (선택된 테마 반영)
function LargeStampArt({ partnerName, theme }: { partnerName: string; theme: StampTheme }) {
  return (
    <svg
      width={STAMP_WIDTH}
      height={STAMP_HEIGHT}
      viewBox={`0 0 ${STAMP_WIDTH} ${STAMP_HEIGHT}`}
      className="w-full h-full select-none"
    >
      <defs>
        <linearGradient id={`stampPaperGrad-${theme.id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={theme.bgGradStart} />
          <stop offset="50%" stopColor={theme.bgGradMid} />
          <stop offset="100%" stopColor={theme.bgGradEnd} />
        </linearGradient>

        <linearGradient id={`stampInkGrad-${theme.id}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={theme.primaryColor} />
          <stop offset="100%" stopColor={theme.secondaryColor} />
        </linearGradient>
      </defs>

      <rect x="0" y="0" width={STAMP_WIDTH} height={STAMP_HEIGHT} fill={`url(#stampPaperGrad-${theme.id})`} />

      {/* 외곽 천공 점선 */}
      <rect
        x="4"
        y="4"
        width={STAMP_WIDTH - 8}
        height={STAMP_HEIGHT - 8}
        fill="none"
        stroke={theme.perforateColor}
        strokeWidth="1.2"
        strokeDasharray="3.5 2.5"
      />

      {/* 앤틱 우표 이중 프레임 */}
      <rect
        x="10"
        y="10"
        width={STAMP_WIDTH - 20}
        height={STAMP_HEIGHT - 20}
        fill="none"
        stroke={theme.primaryColor}
        strokeWidth="1.8"
      />
      <rect
        x="12.5"
        y="12.5"
        width={STAMP_WIDTH - 25}
        height={STAMP_HEIGHT - 25}
        fill="none"
        stroke={theme.accentGold}
        strokeWidth="0.7"
      />

      {/* 상단 텍스트 */}
      <text
        x={STAMP_WIDTH / 2}
        y="26"
        textAnchor="middle"
        fill={theme.primaryColor}
        fontSize="10"
        fontFamily="serif"
        fontWeight="bold"
        letterSpacing="2.5"
      >
        {theme.topHeaderHanzi}
      </text>
      <text
        x={STAMP_WIDTH / 2}
        y="37"
        textAnchor="middle"
        fill={theme.secondaryColor}
        opacity="0.8"
        fontSize="6.5"
        fontFamily="sans-serif"
        letterSpacing="1.8"
      >
        {theme.topHeaderSub}
      </text>

      {/* 중앙 타원형 앤틱 일러스트 프레임 */}
      <ellipse
        cx={STAMP_WIDTH / 2}
        cy={STAMP_HEIGHT / 2 + 3}
        rx="50"
        ry="42"
        fill={theme.innerBg}
        stroke={theme.accentGold}
        strokeWidth="1"
        strokeDasharray="2 2"
      />

      {/* 중앙 테마별 고유 일러스트 심볼 */}
      {theme.renderSymbol(theme)}

      <text
        x={STAMP_WIDTH / 2}
        y={STAMP_HEIGHT / 2 + 28}
        textAnchor="middle"
        fill={theme.primaryColor}
        fontSize="11"
        fontFamily="serif"
        fontWeight="bold"
      >
        {theme.centerTitle}
      </text>

      <text
        x={STAMP_WIDTH / 2}
        y={STAMP_HEIGHT / 2 + 39}
        textAnchor="middle"
        fill={theme.secondaryColor}
        opacity="0.85"
        fontSize="8"
        fontFamily="serif"
        fontStyle="italic"
      >
        To. {partnerName}
      </text>

      {/* 좌우 하단 우표 액면가 */}
      <text x="16" y={STAMP_HEIGHT - 16} fill={theme.primaryColor} fontSize="13" fontFamily="serif" fontWeight="bold">
        {theme.denomWon}
      </text>
      <text x="16" y={STAMP_HEIGHT - 27} fill={theme.secondaryColor} opacity="0.75" fontSize="5.5" fontFamily="sans-serif">
        WON
      </text>

      <text x={STAMP_WIDTH - 16} y={STAMP_HEIGHT - 16} textAnchor="end" fill={theme.primaryColor} fontSize="13" fontFamily="serif" fontWeight="bold">
        {theme.denomYear}
      </text>
      <text x={STAMP_WIDTH - 16} y={STAMP_HEIGHT - 27} textAnchor="end" fill={theme.secondaryColor} opacity="0.75" fontSize="5.5" fontFamily="sans-serif">
        YEAR
      </text>

      <text
        x={STAMP_WIDTH / 2}
        y={STAMP_HEIGHT - 14}
        textAnchor="middle"
        fill={theme.accentGold}
        fontSize="6.5"
        fontFamily="sans-serif"
        letterSpacing="1.5"
      >
        {theme.bottomMotto}
      </text>
    </svg>
  );
}

export interface PieceData {
  id: number;
  path: string;
  originX: number;
  originY: number;
  width: number;
  height: number;
  shapeName: string;
}

export interface TornData {
  pieces: PieceData[];
  patternName: string;
}

// 찢어진 종이의 거친 섬유와 이빨을 시뮬레이션하는 지그재그 세그먼트 생성
function generateJaggedSegment(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  steps: number = 8,
  maxDev: number = 5
): [number, number][] {
  const points: [number, number][] = [[x1, y1]];
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;

  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const baseTx = x1 + dx * t;
    const baseTy = y1 + dy * t;
    // 불규칙한 찢김 이빨과 섬유 진동
    const tooth = (i % 2 === 0 ? 1 : -1) * (1.6 + Math.random() * 2.8);
    const jitter = (Math.random() - 0.5) * maxDev;
    const offset = tooth + jitter;
    points.push([
      Math.round((baseTx + nx * offset) * 10) / 10,
      Math.round((baseTy + ny * offset) * 10) / 10,
    ]);
  }
  points.push([x2, y2]);
  return points;
}

// 다각형 정점 목록으로부터 조각 Bounding Box 및 SVG path 생성
function pointsToPieceData(
  id: number,
  points: [number, number][],
  shapeName: string,
  stampWidth: number,
  stampHeight: number
): PieceData {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);

  const minX = Math.max(0, Math.min(...xs));
  const maxX = Math.min(stampWidth, Math.max(...xs));
  const minY = Math.max(0, Math.min(...ys));
  const maxY = Math.min(stampHeight, Math.max(...ys));

  const originX = Math.floor(minX);
  const originY = Math.floor(minY);
  const width = Math.max(30, Math.ceil(maxX - minX));
  const height = Math.max(30, Math.ceil(maxY - minY));

  const path = points.map(([x, y], i) => (i === 0 ? `M ${x},${y}` : `L ${x},${y}`)).join(' ') + ' Z';

  return {
    id,
    path,
    originX,
    originY,
    width,
    height,
    shapeName,
  };
}

// 1. 대각선 삼각 & 오각 분할 (Triangle & Pentagon Cut)
function generateDiagonalTriPent(W: number, H: number): TornData {
  const x1 = Math.round(W * (0.52 + Math.random() * 0.16));
  const y1 = Math.round(H * (0.46 + Math.random() * 0.16));
  const cutTL = generateJaggedSegment(x1, 0, 0, y1, 8, 5);

  const mIdx = Math.floor(cutTL.length / 2);
  const midTL = cutTL[mIdx];

  const x2 = Math.round(W * (0.36 + Math.random() * 0.22));
  const y2 = Math.round(H * (0.42 + Math.random() * 0.22));
  const centerPt: [number, number] = [Math.round(W * 0.50), Math.round(H * 0.50)];

  const cutMidC = generateJaggedSegment(midTL[0], midTL[1], centerPt[0], centerPt[1], 5, 4);
  const cutCB = generateJaggedSegment(centerPt[0], centerPt[1], x2, H, 6, 5);
  const cutCR = generateJaggedSegment(centerPt[0], centerPt[1], W, y2, 6, 5);

  // 0. 좌상단 삼각형 (Top-Left Triangle: [0,0], [x1,0], [0,y1])
  const pts0: [number, number][] = [
    [0, 0],
    [x1, 0],
    ...cutTL.slice(1),
    [0, 0],
  ];

  // 1. 우상단 오각형 (Top-Right Pentagon: 5 vertices)
  const pts1: [number, number][] = [
    [x1, 0],
    [W, 0],
    [W, y2],
    ...cutCR.slice().reverse(),
    ...cutMidC.slice().reverse(),
    ...cutTL.slice(0, mIdx + 1).reverse(),
  ];

  // 2. 좌하단 오각형 (Bottom-Left Pentagon: 5 vertices)
  const pts2: [number, number][] = [
    [0, y1],
    ...cutTL.slice(mIdx),
    ...cutMidC.slice(1),
    ...cutCB.slice(1),
    [0, H],
    [0, y1],
  ];

  // 3. 우하단 사변형 다각형 (Bottom-Right Quad/Polygon)
  const pts3: [number, number][] = [
    centerPt,
    ...cutCR.slice(1),
    [W, H],
    [x2, H],
    ...cutCB.slice().reverse(),
  ];

  return {
    patternName: '대각선 삼각·오각 분할',
    pieces: [
      pointsToPieceData(0, pts0, '삼각형', W, H),
      pointsToPieceData(1, pts1, '오각형', W, H),
      pointsToPieceData(2, pts2, '오각형', W, H),
      pointsToPieceData(3, pts3, '사변형', W, H),
    ],
  };
}

// 2. X자 사선 4중 삼각 분할 (Four Triangles Cut)
function generateFourTriangles(W: number, H: number): TornData {
  const C: [number, number] = [
    Math.round(W * (0.44 + Math.random() * 0.12)),
    Math.round(H * (0.44 + Math.random() * 0.12)),
  ];

  const cTL = generateJaggedSegment(C[0], C[1], 0, 0, 8, 5);
  const cTR = generateJaggedSegment(C[0], C[1], W, 0, 8, 5);
  const cBR = generateJaggedSegment(C[0], C[1], W, H, 8, 5);
  const cBL = generateJaggedSegment(C[0], C[1], 0, H, 8, 5);

  // 0. 상단 삼각형 (Top Triangle)
  const pts0: [number, number][] = [C, ...cTL.slice(1), [W, 0], ...cTR.slice().reverse()];
  // 1. 우측 삼각형 (Right Triangle)
  const pts1: [number, number][] = [C, ...cTR.slice(1), [W, H], ...cBR.slice().reverse()];
  // 2. 하단 삼각형 (Bottom Triangle)
  const pts2: [number, number][] = [C, ...cBR.slice(1), [0, H], ...cBL.slice().reverse()];
  // 3. 좌측 삼각형 (Left Triangle)
  const pts3: [number, number][] = [C, ...cBL.slice(1), [0, 0], ...cTL.slice().reverse()];

  return {
    patternName: 'X자 사선 4각 삼각 찢김',
    pieces: [
      pointsToPieceData(0, pts0, '삼각형', W, H),
      pointsToPieceData(1, pts1, '삼각형', W, H),
      pointsToPieceData(2, pts2, '삼각형', W, H),
      pointsToPieceData(3, pts3, '삼각형', W, H),
    ],
  };
}

// 3. 쐐기형 사선 삼각 & 오각 분할 (Wedge Triangle & Pentagon Cut)
function generateWedgeTriPent(W: number, H: number): TornData {
  const xT = Math.round(W * (0.35 + Math.random() * 0.15));
  const xB = Math.round(W * (0.58 + Math.random() * 0.16));
  const M: [number, number] = [Math.round(W * 0.48), Math.round(H * 0.50)];

  const cutTM = generateJaggedSegment(xT, 0, M[0], M[1], 6, 5);
  const cutMB = generateJaggedSegment(M[0], M[1], xB, H, 6, 5);

  const yR = Math.round(H * (0.32 + Math.random() * 0.18));
  const yL = Math.round(H * (0.58 + Math.random() * 0.18));
  const cutMR = generateJaggedSegment(M[0], M[1], W, yR, 6, 5);
  const cutML = generateJaggedSegment(M[0], M[1], 0, yL, 6, 5);

  // 0. 좌상단 사변형 (Top-Left Quad)
  const pts0: [number, number][] = [
    [0, 0],
    [xT, 0],
    ...cutTM.slice(1),
    ...cutML.slice().reverse(),
    [0, 0],
  ];

  // 1. 우상단 오각형 (Top-Right Pentagon)
  const pts1: [number, number][] = [
    [xT, 0],
    [W, 0],
    [W, yR],
    ...cutMR.slice().reverse(),
    ...cutTM.slice().reverse(),
  ];

  // 2. 좌하단 삼각형 (Bottom-Left Triangle: [0, yL], M, [0, H])
  const pts2: [number, number][] = [
    [0, yL],
    ...cutML.slice().reverse(),
    ...cutMB.slice(1),
    [0, H],
    [0, yL],
  ];

  // 3. 우하단 오각형 (Bottom-Right Pentagon)
  const pts3: [number, number][] = [
    M,
    ...cutMR.slice(1),
    [W, H],
    [xB, H],
    ...cutMB.slice().reverse(),
  ];

  return {
    patternName: '사선 쐐기형 삼각·오각 분할',
    pieces: [
      pointsToPieceData(0, pts0, '사변형', W, H),
      pointsToPieceData(1, pts1, '오각형', W, H),
      pointsToPieceData(2, pts2, '삼각형', W, H),
      pointsToPieceData(3, pts3, '오각형', W, H),
    ],
  };
}

// 4. 비정형 다각 찢김 (Irregular Asymmetric Multi-angle Cut)
function generateIrregularPattern(W: number, H: number): TornData {
  const midX = Math.round(W * (0.42 + Math.random() * 0.18));
  const midY = Math.round(H * (0.42 + Math.random() * 0.18));
  const C: [number, number] = [midX, midY];

  const xTop = Math.round(W * (0.35 + Math.random() * 0.30));
  const yRight = Math.round(H * (0.35 + Math.random() * 0.30));
  const xBottom = Math.round(W * (0.35 + Math.random() * 0.30));
  const yLeft = Math.round(H * (0.35 + Math.random() * 0.30));

  const cTop = generateJaggedSegment(xTop, 0, C[0], C[1], 7, 5);
  const cRight = generateJaggedSegment(C[0], C[1], W, yRight, 7, 5);
  const cBottom = generateJaggedSegment(C[0], C[1], xBottom, H, 7, 5);
  const cLeft = generateJaggedSegment(0, yLeft, C[0], C[1], 7, 5);

  const pts0: [number, number][] = [[0, 0], [xTop, 0], ...cTop.slice(1), ...cLeft.slice().reverse(), [0, 0]];
  const pts1: [number, number][] = [[xTop, 0], [W, 0], [W, yRight], ...cRight.slice().reverse(), ...cTop.slice().reverse()];
  const pts2: [number, number][] = [[0, yLeft], ...cLeft.slice(1), ...cBottom.slice(1), [0, H], [0, yLeft]];
  const pts3: [number, number][] = [C, ...cRight.slice(1), [W, H], [xBottom, H], ...cBottom.slice().reverse()];

  return {
    patternName: '비정형 다각 찢김',
    pieces: [
      pointsToPieceData(0, pts0, '비정형 사각', W, H),
      pointsToPieceData(1, pts1, '오각형', W, H),
      pointsToPieceData(2, pts2, '오각형', W, H),
      pointsToPieceData(3, pts3, '사변형', W, H),
    ],
  };
}

// 새로고침이나 재생성 시 매번 무작위 형태(삼각형, 오각형, 비정형 등)로 찢음
function generateTornPaths(stampWidth: number, stampHeight: number): TornData {
  const generators = [
    generateDiagonalTriPent,
    generateFourTriangles,
    generateWedgeTriPent,
    generateIrregularPattern,
  ];
  const chosenGen = generators[Math.floor(Math.random() * generators.length)];
  return chosenGen(stampWidth, stampHeight);
}

export default function StampJigsawPuzzle({
  onSolve,
  partnerName = '유라',
}: StampJigsawPuzzleProps) {
  const [tornData, setTornData] = useState<TornData | null>(null);
  const [themeIdx, setThemeIdx] = useState<number>(() => Math.floor(Math.random() * STAMP_THEMES.length));
  const currentTheme = STAMP_THEMES[themeIdx];
  const [snapped, setSnapped] = useState<boolean[]>([false, false, false, false]);
  const [rotations, setRotations] = useState<number[]>([90, 180, 270, 90]);
  const [activePiece, setActivePiece] = useState<number | null>(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [stampKey, setStampKey] = useState(0);

  const boardRef = useRef<HTMLDivElement>(null);
  const targetSlotRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);
  const pieceRefs = useRef<(HTMLDivElement | null)[]>([null, null, null, null]);

  // 퍼즐 초기화 (새로운 무작위 찢김, 무작위 회전 각도, 새로운 무작위 우표 테마 생성)
  const initPuzzle = useCallback(() => {
    const data = generateTornPaths(STAMP_WIDTH, STAMP_HEIGHT);
    setTornData(data);
    setSnapped([false, false, false, false]);

    // 회전 각도 무작위화: 90, 180, 270 중 무작위 배치 (0도는 처음에 나오지 않음)
    const angles = [90, 180, 270];
    const randRots = [
      angles[Math.floor(Math.random() * angles.length)],
      angles[Math.floor(Math.random() * angles.length)],
      angles[Math.floor(Math.random() * angles.length)],
      angles[Math.floor(Math.random() * angles.length)],
    ];
    setRotations(randRots);

    // 새로 찢을 때 우표 디자인도 함께 무작위 교체
    setThemeIdx((prev) => {
      let next = Math.floor(Math.random() * STAMP_THEMES.length);
      if (next === prev) {
        next = (next + 1) % STAMP_THEMES.length;
      }
      return next;
    });

    setIsCompleted(false);
    setStampKey((k) => k + 1);
  }, []);

  useEffect(() => {
    initPuzzle();
  }, [initPuzzle]);

  // 다른 우표 테마로 수동 변경
  const handleNextTheme = () => {
    soundEngine.playTileSlideSound();
    setThemeIdx((prev) => (prev + 1) % STAMP_THEMES.length);
  };

  // 조각 탭(클릭) 시 제자리에서 시계방향 90도 회전!
  const handleRotate = (pieceIdx: number) => {
    soundEngine.playTileSlideSound();
    setRotations((prev) => {
      const next = [...prev];
      next[pieceIdx] = next[pieceIdx] + 90;
      return next;
    });
  };

  // 드래그 종료 시 위치 및 회전각 검증 -> 정답 슬롯 위치 근처(55px 이내) + 정방향(0°)일 때 결합!
  const checkSnap = (pieceIdx: number) => {
    if (snapped[pieceIdx] || isCompleted) return;

    const pieceEl = pieceRefs.current[pieceIdx];
    const slotEl = targetSlotRefs.current[pieceIdx];
    if (!pieceEl || !slotEl) return;

    const pRect = pieceEl.getBoundingClientRect();
    const sRect = slotEl.getBoundingClientRect();

    // 조각 중심과 타겟 슬롯 중심 간의 거리 계산
    const pCenter = { x: pRect.left + pRect.width / 2, y: pRect.top + pRect.height / 2 };
    const sCenter = { x: sRect.left + sRect.width / 2, y: sRect.top + sRect.height / 2 };
    const dist = Math.hypot(pCenter.x - sCenter.x, pCenter.y - sCenter.y);

    // 360도 배수일 때 올바른 정방향 (0도, 360도, 720도 등)
    const isOrientationCorrect = ((rotations[pieceIdx] % 360) + 360) % 360 === 0;

    // 타겟 슬롯(거리 55px 이내)에 올려놓았고, 올바른 정방향(0도)을 맞췄을 때 결합!
    if (dist < 55 && isOrientationCorrect) {
      soundEngine.playTileSlideSound();
      const nextSnapped = [...snapped];
      nextSnapped[pieceIdx] = true;
      setSnapped(nextSnapped);

      if (nextSnapped.every((s) => s)) {
        triggerSuccess();
      }
    }
  };

  // 4조각 모두 결합 완료 시 소인 타격 및 봉인 해제
  const triggerSuccess = () => {
    setIsCompleted(true);

    setTimeout(() => {
      soundEngine.playStampThudSound(); // 쿵! 도장 소인 타격음
    }, 350);

    setTimeout(() => {
      soundEngine.playMissionPassChime();
      confetti({
        particleCount: 65,
        spread: 75,
        origin: { y: 0.5 },
        colors: [currentTheme.primaryColor, currentTheme.accentGold, '#FFFDF9', currentTheme.secondaryColor],
      });
    }, 700);

    setTimeout(() => {
      onSolve();
    }, 1800);
  };

  if (!tornData) return null;

  // 4개 조각이 작업대(하단 2x2)에서 겹치지 않고 정돈되는 시작 위치
  const initialPositions = tornData.pieces.map((piece, idx) => {
    const qX = idx % 2 === 0 ? 12 : 160;
    const qY = idx < 2 ? 228 : 318;
    const qW = 136;
    const qH = 84;
    return {
      x: Math.max(8, Math.min(BOARD_WIDTH - piece.width - 8, qX + Math.round((qW - piece.width) / 2))),
      y: Math.max(224, Math.min(BOARD_HEIGHT - piece.height - 8, qY + Math.round((qH - piece.height) / 2))),
    };
  });

  return (
    <div className="flex flex-col items-center select-none w-full max-w-sm mx-auto touch-none">
      {/* 가이드 안내 */}
      <div className="text-center mb-2">
        <p className="text-stone-800 font-serif-warm text-sm font-semibold flex items-center justify-center gap-1.5 flex-wrap">
          <span>📮 찢어진 우표 맞추기</span>
          <span className="text-[10px] font-sans-ui text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded-full border border-amber-300 font-medium">
            {currentTheme.name}
          </span>
          <span className="text-[10px] font-sans-ui text-stone-600 bg-stone-100 px-2 py-0.5 rounded-full border border-stone-200 font-normal">
            {tornData.patternName}
          </span>
        </p>
        <p className="text-[11px] text-stone-600 font-sans-ui mt-0.5 flex items-center justify-center gap-1">
          <Hand className="w-3.5 h-3.5 text-amber-700 shrink-0" />
          <span>조각을 <strong>탭(클릭)하면 90° 회전</strong>하고, 드래그하여 우표 틀에 맞출 수 있어요!</span>
        </p>
      </div>

      {/* 퍼즐 작업대 */}
      <div
        ref={boardRef}
        className="relative bg-[#F5EFE6] rounded-2xl border-2 border-[#C4B29A] shadow-inner overflow-hidden touch-none select-none"
        style={{ width: BOARD_WIDTH, height: BOARD_HEIGHT }}
      >
        {/* 상단 타겟: 우표 결합 틀 */}
        <div
          className="absolute rounded-lg overflow-hidden bg-[#EFE7DC]/70 border border-dashed border-[#B89B72]/60 shadow-xs"
          style={{
            width: STAMP_WIDTH,
            height: STAMP_HEIGHT,
            left: TARGET_X,
            top: TARGET_Y,
          }}
        >
          {/* 밑바탕 가이드 실루엣 */}
          <div className="absolute inset-0 opacity-15 pointer-events-none filter grayscale">
            <LargeStampArt partnerName={partnerName} theme={currentTheme} />
          </div>

          <div className="absolute inset-0 flex items-center justify-center text-[9px] font-serif-warm text-[#8C2131]/30 font-bold uppercase tracking-widest pointer-events-none">
            {snapped.some((s) => s) ? '' : '우표 틀에 조각을 맞춰 넣으세요'}
          </div>

          {/* 4개의 결합 슬롯 (삼각형/오각형 등 각 조각의 위치에 맞춰 정확히 결합) */}
          {tornData.pieces.map((piece, idx) => (
            <div
              key={`target-slot-${idx}`}
              ref={(el) => {
                targetSlotRefs.current[idx] = el;
              }}
              className="absolute"
              style={{
                left: piece.originX,
                top: piece.originY,
                width: piece.width,
                height: piece.height,
              }}
            >
              {snapped[idx] && (
                <motion.div
                  initial={{ scale: 1.08, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                  className="relative overflow-hidden w-full h-full pointer-events-none"
                >
                  <div
                    style={{
                      position: 'absolute',
                      left: -piece.originX,
                      top: -piece.originY,
                      width: STAMP_WIDTH,
                      height: STAMP_HEIGHT,
                      clipPath: `path('${piece.path}')`,
                    }}
                  >
                    <LargeStampArt partnerName={partnerName} theme={currentTheme} />
                    <svg className="absolute inset-0 w-full h-full pointer-events-none">
                      <path
                        d={piece.path}
                        fill="none"
                        stroke="#FFFDF9"
                        strokeWidth="1.2"
                        opacity="0.6"
                      />
                    </svg>
                  </div>
                </motion.div>
              )}
            </div>
          ))}

          {/* 4조각 모두 결합 시 매끄러운 원본 우표 완성 효과 */}
          {isCompleted && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3, duration: 0.5 }}
              className="absolute inset-0 z-20 pointer-events-none"
            >
              <LargeStampArt partnerName={partnerName} theme={currentTheme} />
            </motion.div>
          )}

          {/* 쿵! 소인 도장 타격 애니메이션 */}
          <AnimatePresence>
            {isCompleted && (
              <motion.div
                initial={{ scale: 3, opacity: 0, rotate: -28 }}
                animate={{ scale: 1, opacity: 0.9, rotate: -12 }}
                transition={{ type: 'spring', damping: 14, stiffness: 280, delay: 0.2 }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
              >
                <div
                  className="w-28 h-28 rounded-full border-[2.2px] border-dashed flex flex-col items-center justify-center font-mono text-[8px] p-2 backdrop-blur-2xs shadow-xl"
                  style={{
                    borderColor: currentTheme.sealColor,
                    color: currentTheme.sealColor,
                    backgroundColor: `${currentTheme.sealColor}1A`,
                  }}
                >
                  <Stamp className="w-6 h-6 stroke-[2.2] mb-0.5" />
                  <span className="font-bold tracking-widest text-[9px]">WARMTH SEOUL</span>
                  <span className="font-bold text-[8px]">2026.09.28</span>
                  <span className="text-[7.5px] tracking-wider uppercase font-sans">OFFICIALLY RESTORED</span>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* 구분선 (작업대 라벨) */}
        <div className="absolute top-[214px] inset-x-3 flex items-center gap-2 pointer-events-none opacity-40">
          <div className="h-px flex-1 bg-stone-400 border-t border-dashed border-stone-500" />
          <span className="text-[9px] font-mono text-stone-600">조각 작업대</span>
          <div className="h-px flex-1 bg-stone-400 border-t border-dashed border-stone-500" />
        </div>

        {/* 4개의 직접 손으로 움직여 맞추는 찢어진 우표 조각들 */}
        {tornData.pieces.map((piece, idx) => {
          if (snapped[idx]) return null;

          const isCurrentActive = activePiece === idx;

          return (
            <motion.div
              key={`piece-${idx}-${stampKey}`}
              ref={(el) => {
                pieceRefs.current[idx] = el;
              }}
              drag
              dragConstraints={{
                top: -initialPositions[idx].y - 60,
                bottom: BOARD_HEIGHT - initialPositions[idx].y + 30,
                left: -initialPositions[idx].x - 30,
                right: BOARD_WIDTH - initialPositions[idx].x + 30,
              }}
              dragElastic={0.12}
              dragMomentum={false}
              onDragStart={() => setActivePiece(idx)}
              onDragEnd={() => checkSnap(idx)}
              onTap={() => handleRotate(idx)}
              animate={{ rotate: rotations[idx] }}
              transition={{ rotate: { type: 'spring', stiffness: 350, damping: 25 } }}
              style={{
                position: 'absolute',
                left: initialPositions[idx].x,
                top: initialPositions[idx].y,
                width: piece.width,
                height: piece.height,
                transformOrigin: 'center center',
                zIndex: isCurrentActive ? 40 : 20 + idx,
                cursor: 'grab',
                filter: isCurrentActive
                  ? 'drop-shadow(0 6px 14px rgba(0,0,0,0.3))'
                  : 'drop-shadow(0 3px 6px rgba(0,0,0,0.18))',
              }}
              whileTap={{ cursor: 'grabbing', scale: 1.02 }}
            >
              {/* 조각 그래픽 컨테이너 */}
              <div
                className="relative overflow-hidden w-full h-full pointer-events-none rounded-xs select-none"
              >
                <div
                  style={{
                    position: 'absolute',
                    left: -piece.originX,
                    top: -piece.originY,
                    width: STAMP_WIDTH,
                    height: STAMP_HEIGHT,
                    clipPath: `path('${piece.path}')`,
                  }}
                >
                  <LargeStampArt partnerName={partnerName} theme={currentTheme} />
                  {/* 찢긴 종이 흰색 섬유 질감 테두리 */}
                  <svg className="absolute inset-0 w-full h-full pointer-events-none">
                    <path
                      d={piece.path}
                      fill="none"
                      stroke="#FFFDF9"
                      strokeWidth="1.8"
                      strokeDasharray="2 1"
                      opacity="0.85"
                    />
                  </svg>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* 하단 컨트롤러 */}
      <div className="mt-1 sm:mt-3 flex items-center justify-between w-full max-w-sm text-xs font-sans-ui text-stone-500 px-1 gap-1">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={initPuzzle}
            title="새로운 우표와 무작위 찢김 형태로 다시 도전"
            className="p-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-600 active:scale-95 flex items-center gap-1 text-[11px]"
          >
            <RotateCcw className="w-3 h-3" />
            <span>새로 찢기</span>
          </button>

          <button
            type="button"
            onClick={handleNextTheme}
            title="다음 우표 테마로 교체"
            className="p-1.5 rounded-lg border border-stone-300 hover:bg-stone-100 text-stone-600 active:scale-95 flex items-center gap-1 text-[11px]"
          >
            <Palette className="w-3 h-3 text-stone-500" />
            <span>우표 변경</span>
          </button>
        </div>

        <span className="text-[11px] text-stone-500 font-mono">
          완성 {snapped.filter((s) => s).length}/4
        </span>
      </div>
    </div>
  );
}
