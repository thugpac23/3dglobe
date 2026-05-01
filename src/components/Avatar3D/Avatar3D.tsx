'use client';

import { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { AvatarConfig } from '@/types';

// ── Outfit colour tables ──────────────────────────────────────────────────────
const OUTFIT_TOP: Record<string, number> = {
  casual: 0x60A5FA, travel: 0x4B5563, explorer: 0x92400E, summer: 0xFCD34D,
  winter: 0x1E3A5F, sporty: 0x10B981, adventure: 0x78350F, beach: 0xFB923C,
  city: 0x6D28D9, formal: 0x1E293B, safari: 0xA16207, ninja: 0x111827,
  royal: 0x7E22CE, scuba: 0x0369A1,
};
const OUTFIT_BOT: Record<string, number> = {
  casual: 0x1E40AF, travel: 0x374151, explorer: 0x78350F, summer: 0xFB923C,
  winter: 0x1E40AF, sporty: 0x065F46, adventure: 0x451A03, beach: 0xFCD34D,
  city: 0x4C1D95, formal: 0x0F172A, safari: 0x78350F, ninja: 0x111827,
  royal: 0x4C1D95, scuba: 0x0C4A6E,
};
const OUTFIT_ACC: Record<string, number> = {
  casual: 0xBFDBFE, travel: 0xD1D5DB, explorer: 0xD97706, summer: 0xFEF3C7,
  winter: 0x93C5FD, sporty: 0x6EE7B7, adventure: 0xD97706, beach: 0xFED7AA,
  city: 0xDDD6FE, formal: 0xF1F5F9, safari: 0xFDE68A, ninja: 0x6B7280,
  royal: 0xFCD34D, scuba: 0x7DD3FC,
};

function cssToHex(css: string): number {
  return parseInt(css.replace('#', ''), 16);
}

function mat(color: number, opts: Partial<THREE.MeshPhongMaterialParameters> = {}): THREE.MeshPhongMaterial {
  return new THREE.MeshPhongMaterial({ color, shininess: 40, ...opts });
}

function mesh(geo: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  return m;
}

// ── Character builder ─────────────────────────────────────────────────────────
function buildCharacter(avatar: Partial<AvatarConfig>): THREE.Group {
  const skinHex   = cssToHex(avatar.skinColor  ?? '#FBBF8A');
  const hairHex   = cssToHex(avatar.hairColor  ?? '#8B4513');
  const eyeHex    = cssToHex(avatar.eyeColor   ?? '#4B5563');
  const outfit    = avatar.outfit ?? 'casual';
  const hairStyle = avatar.hairStyle ?? 'short';
  const acc       = avatar.accessories ?? [];
  const isMale    = avatar.user !== 'iva';

  const skinM  = mat(skinHex);
  const hairM  = mat(hairHex);
  const eyeM   = mat(eyeHex);
  const whiteM = mat(0xffffff);
  const darkM  = mat(0x2D2D2D);
  const topM   = mat(OUTFIT_TOP[outfit] ?? 0x60A5FA);
  const botM   = mat(OUTFIT_BOT[outfit] ?? 0x1E40AF);
  const accM   = mat(OUTFIT_ACC[outfit] ?? 0xBFDBFE);

  const g = new THREE.Group();

  // ── HEAD ──
  const head = mesh(new THREE.SphereGeometry(0.32, 16, 16), skinM);
  head.position.set(0, 1.54, 0);
  g.add(head);

  // Ears
  for (const sx of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.07, 8, 8), skinM);
    ear.scale.z = 0.55;
    ear.position.set(sx * 0.31, 1.54, 0);
    g.add(ear);
  }

  // Eyes (whites + iris)
  for (const [sx, ix] of [[-1, -0.115], [1, 0.115]] as [number, number][]) {
    const white = mesh(new THREE.SphereGeometry(0.065, 8, 8), whiteM);
    white.position.set(sx * 0.115, 1.57, 0.27);
    g.add(white);
    const iris = mesh(new THREE.SphereGeometry(0.042, 8, 8), eyeM);
    iris.position.set(ix, 1.57, 0.3);
    g.add(iris);
    const pupil = mesh(new THREE.SphereGeometry(0.02, 6, 6), mat(0x111111));
    pupil.position.set(ix, 1.57, 0.315);
    g.add(pupil);
  }

  // Smile
  const smileCurve = new THREE.QuadraticBezierCurve3(
    new THREE.Vector3(-0.1, 1.41, 0.3),
    new THREE.Vector3(0, 1.37, 0.32),
    new THREE.Vector3(0.1, 1.41, 0.3),
  );
  const smilePoints = smileCurve.getPoints(8);
  const smileGeo = new THREE.BufferGeometry().setFromPoints(smilePoints);
  const smileLine = new THREE.Line(smileGeo, new THREE.LineBasicMaterial({ color: 0x92400E, linewidth: 2 }));
  g.add(smileLine);

  // Nose
  const nose = mesh(new THREE.SphereGeometry(0.038, 6, 6), skinM);
  nose.position.set(0, 1.49, 0.31);
  g.add(nose);

  // Female lashes (thin box above each eye)
  if (!isMale) {
    for (const sx of [-1, 1]) {
      const lash = mesh(new THREE.BoxGeometry(0.14, 0.025, 0.01), mat(hairHex));
      lash.position.set(sx * 0.115, 1.635, 0.28);
      lash.rotation.z = sx * 0.12;
      g.add(lash);
    }
  }

  // ── NECK ──
  const neck = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.18, 8), skinM);
  neck.position.set(0, 1.14, 0);
  g.add(neck);

  // ── TORSO ──
  const torso = mesh(new THREE.CylinderGeometry(isMale ? 0.29 : 0.25, isMale ? 0.31 : 0.28, 0.64, 8), topM);
  torso.position.set(0, 0.74, 0);
  g.add(torso);

  // Outfit torso details
  if (outfit === 'formal' || outfit === 'travel' || outfit === 'city' || outfit === 'royal') {
    // Lapels
    const lapelL = mesh(new THREE.BoxGeometry(0.1, 0.28, 0.04), mat(OUTFIT_BOT[outfit] ?? 0x374151));
    lapelL.position.set(-0.1, 0.82, 0.27);
    lapelL.rotation.z = 0.4;
    g.add(lapelL);
    const lapelR = lapelL.clone();
    lapelR.position.set(0.1, 0.82, 0.27);
    lapelR.rotation.z = -0.4;
    g.add(lapelR);
  }
  if (outfit === 'formal') {
    // White shirt peek
    const shirt = mesh(new THREE.BoxGeometry(0.12, 0.38, 0.04), whiteM);
    shirt.position.set(0, 0.78, 0.28);
    g.add(shirt);
    // Tie
    const tie = mesh(new THREE.BoxGeometry(0.055, 0.32, 0.035), mat(0xDC2626));
    tie.position.set(0, 0.78, 0.31);
    g.add(tie);
  }
  if (outfit === 'royal') {
    // Gold shoulder epaulettes
    for (const sx of [-1, 1]) {
      const ep = mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.06, 8), mat(OUTFIT_ACC.royal));
      ep.position.set(sx * 0.32, 1.08, 0);
      g.add(ep);
    }
    // Gold buttons
    for (let i = 0; i < 3; i++) {
      const btn = mesh(new THREE.SphereGeometry(0.04, 6, 6), mat(OUTFIT_ACC.royal));
      btn.position.set(0, 0.92 - i * 0.14, 0.3);
      g.add(btn);
    }
  }
  if (outfit === 'ninja') {
    // Sash belt
    const sash = mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 12), mat(OUTFIT_ACC.ninja));
    sash.position.set(0, 0.56, 0);
    g.add(sash);
    // Face mask (covering lower head)
    const maskM = mat(OUTFIT_BOT.ninja);
    const mask = mesh(new THREE.SphereGeometry(0.33, 12, 8, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.3), maskM);
    mask.position.set(0, 1.54, 0);
    g.add(mask);
  }
  if (outfit === 'scuba') {
    // Chest valve
    const valve = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8), mat(OUTFIT_ACC.scuba));
    valve.position.set(0, 0.96, 0.29);
    g.add(valve);
    // Horizontal stripes
    for (let i = 0; i < 3; i++) {
      const stripe = mesh(new THREE.TorusGeometry(0.31, 0.022, 4, 16, Math.PI), mat(OUTFIT_ACC.scuba));
      stripe.position.set(0, 0.88 - i * 0.18, 0);
      stripe.rotation.x = Math.PI / 2;
      g.add(stripe);
    }
  }
  if (outfit === 'safari') {
    // Chest pockets
    for (const sx of [-1, 1]) {
      const pocket = mesh(new THREE.BoxGeometry(0.14, 0.11, 0.04), mat(OUTFIT_BOT.safari));
      pocket.position.set(sx * 0.18, 0.88, 0.28);
      g.add(pocket);
    }
    // Belt
    const belt = mesh(new THREE.TorusGeometry(0.31, 0.03, 4, 14), mat(OUTFIT_BOT.safari));
    belt.position.set(0, 0.47, 0);
    belt.rotation.x = Math.PI / 2;
    g.add(belt);
  }

  // ── SHOULDERS ──
  for (const sx of [-1, 1]) {
    const sho = mesh(new THREE.SphereGeometry(0.15, 8, 8), topM);
    sho.position.set(sx * 0.38, 1.04, 0);
    g.add(sho);
  }

  // ── ARMS ──
  const armTopM = outfit === 'explorer' || outfit === 'summer' || outfit === 'beach' ? skinM : topM;
  for (const sx of [-1, 1]) {
    // Upper arm
    const ua = mesh(new THREE.CylinderGeometry(0.1, 0.09, 0.38, 8), armTopM);
    ua.position.set(sx * 0.5, 0.82, 0);
    ua.rotation.z = sx * 0.28;
    g.add(ua);
    // Forearm (skin)
    const fa = mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.36, 8), skinM);
    fa.position.set(sx * 0.63, 0.5, 0);
    fa.rotation.z = sx * 0.18;
    g.add(fa);
    // Hand
    const hand = mesh(new THREE.SphereGeometry(0.085, 8, 8), skinM);
    hand.position.set(sx * 0.73, 0.32, 0);
    g.add(hand);
  }

  // ── HIPS ──
  const hips = mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.22, 8), botM);
  hips.position.set(0, 0.4, 0);
  g.add(hips);

  // ── LEGS ──
  for (const sx of [-1, 1]) {
    const ul = mesh(new THREE.CylinderGeometry(0.12, 0.1, 0.38, 8), botM);
    ul.position.set(sx * 0.14, 0.13, 0);
    g.add(ul);
    const ll = mesh(new THREE.CylinderGeometry(0.09, 0.08, 0.36, 8), botM);
    ll.position.set(sx * 0.14, -0.23, 0);
    g.add(ll);
    // Shoe
    const shoe = mesh(new THREE.BoxGeometry(0.18, 0.1, 0.3), darkM);
    shoe.position.set(sx * 0.14, -0.46, 0.05);
    g.add(shoe);
  }

  // ── HAIR ──
  if (hairStyle !== 'bald') {
    // Top cap (all styles)
    const capGeo = new THREE.SphereGeometry(0.335, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52);
    const cap = mesh(capGeo, hairM);
    cap.position.set(0, 1.54, 0);
    g.add(cap);

    if (hairStyle === 'long') {
      // Side curtains
      for (const sx of [-1, 1]) {
        const strand = mesh(new THREE.CylinderGeometry(0.09, 0.06, 0.56, 6), hairM);
        strand.position.set(sx * 0.27, 1.2, 0);
        g.add(strand);
      }
      // Back curtain
      const back = mesh(new THREE.CylinderGeometry(0.2, 0.12, 0.42, 8), hairM);
      back.position.set(0, 1.2, -0.12);
      g.add(back);
    }
    if (hairStyle === 'curly') {
      // Extra curls
      const positions: [number, number, number][] = [
        [-0.22, 1.72, 0.1], [0.22, 1.72, 0.1],
        [-0.3, 1.56, 0.05], [0.3, 1.56, 0.05],
        [-0.15, 1.78, -0.1], [0.15, 1.78, -0.1],
        [0, 1.82, 0],
      ];
      for (const [x, y, z] of positions) {
        const curl = mesh(new THREE.SphereGeometry(0.14, 8, 8), hairM);
        curl.position.set(x, y, z);
        g.add(curl);
      }
    }
    if (hairStyle === 'ponytail') {
      // Tail going backward+down
      const tail = mesh(new THREE.CylinderGeometry(0.07, 0.04, 0.44, 6), hairM);
      tail.position.set(0, 1.34, -0.22);
      tail.rotation.x = 0.55;
      g.add(tail);
      // Tie band
      const band = mesh(new THREE.TorusGeometry(0.07, 0.02, 5, 10), mat(0xDC2626));
      band.position.set(0, 1.46, -0.2);
      band.rotation.x = Math.PI / 2;
      g.add(band);
    }
  } else {
    // Bald shine
    const shine = mesh(new THREE.SphereGeometry(0.1, 8, 8), mat(0xffffff, { transparent: true, opacity: 0.22 }));
    shine.position.set(-0.12, 1.72, 0.14);
    shine.scale.set(1, 0.5, 0.5);
    g.add(shine);
  }

  // ── ACCESSORIES ──

  if (acc.includes('hat')) {
    const brim = mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.06, 14), mat(0xDC2626));
    brim.position.set(0, 1.85, 0);
    g.add(brim);
    const crown3d = mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.38, 14), mat(0xDC2626));
    crown3d.position.set(0, 2.08, 0);
    g.add(crown3d);
  }

  if (acc.includes('cap')) {
    const capHat = mesh(new THREE.SphereGeometry(0.34, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(0x1D4ED8));
    capHat.position.set(0, 1.54, 0);
    g.add(capHat);
    const visor = mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.06, 12, 1, false, -Math.PI * 0.15, Math.PI * 0.8), mat(0x1E3A5F));
    visor.position.set(0, 1.72, 0.22);
    visor.rotation.x = 0.4;
    g.add(visor);
  }

  if (acc.includes('crown')) {
    const crownBase = mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.1, 12), mat(0xFCD34D));
    crownBase.position.set(0, 1.9, 0);
    g.add(crownBase);
    // Crown spikes
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const spike = mesh(new THREE.ConeGeometry(0.06, 0.2, 5), mat(0xFCD34D));
      spike.position.set(
        Math.sin(angle) * 0.3,
        2.05,
        Math.cos(angle) * 0.3,
      );
      g.add(spike);
      // Gem on spike
      const gem = mesh(new THREE.SphereGeometry(0.04, 5, 5), mat(i % 3 === 0 ? 0xEF4444 : i % 3 === 1 ? 0x60A5FA : 0x34D399));
      gem.position.copy(spike.position);
      gem.position.y -= 0.04;
      g.add(gem);
    }
  }

  if (acc.includes('glasses') || acc.includes('sunglasses')) {
    const lensColor = acc.includes('sunglasses') ? 0x1e293b : 0xdbeafe;
    const lensOpacity = acc.includes('sunglasses') ? 0.85 : 0.35;
    const lensM = mat(lensColor, { transparent: true, opacity: lensOpacity });
    const frameM = mat(0x1e293b);
    for (const [sx, fx] of [[-1, -0.115], [1, 0.115]] as [number, number][]) {
      const lens = mesh(new THREE.TorusGeometry(0.07, 0.015, 6, 14), frameM);
      lens.position.set(fx, 1.57, 0.3);
      g.add(lens);
      const fill = mesh(new THREE.CircleGeometry(0.07, 14), lensM);
      fill.position.set(fx, 1.57, 0.305);
      g.add(fill);
      void sx;
    }
    // Bridge
    const bridge = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.09, 4), frameM);
    bridge.position.set(0, 1.57, 0.3);
    bridge.rotation.z = Math.PI / 2;
    g.add(bridge);
  }

  if (acc.includes('backpack') || acc.includes('travel-backpack')) {
    const packColor = acc.includes('travel-backpack') ? 0x65A30D : 0xD97706;
    const pack = mesh(new THREE.BoxGeometry(0.42, 0.48, 0.18), mat(packColor));
    pack.position.set(0, 0.76, -0.3);
    g.add(pack);
    const pocket = mesh(new THREE.BoxGeometry(0.3, 0.16, 0.04), mat(packColor - 0x111100));
    pocket.position.set(0, 0.9, -0.4);
    g.add(pocket);
    // Straps
    for (const sx of [-1, 1]) {
      const strap = mesh(new THREE.BoxGeometry(0.05, 0.52, 0.03), mat(packColor - 0x111100));
      strap.position.set(sx * 0.17, 0.82, -0.22);
      g.add(strap);
    }
  }

  if (acc.includes('scarf')) {
    const scarfM = mat(0xDC2626);
    const scarf = mesh(new THREE.TorusGeometry(0.17, 0.07, 7, 16), scarfM);
    scarf.position.set(0, 1.18, 0);
    g.add(scarf);
    // Hanging end
    const end = mesh(new THREE.BoxGeometry(0.08, 0.28, 0.07), scarfM);
    end.position.set(0.12, 0.9, 0.2);
    end.rotation.z = 0.2;
    g.add(end);
  }

  if (acc.includes('headphones')) {
    const hpM = mat(0x374151);
    const arc = new THREE.TorusGeometry(0.34, 0.035, 6, 16, Math.PI);
    const arcMesh = mesh(arc, hpM);
    arcMesh.position.set(0, 1.62, 0);
    arcMesh.rotation.z = Math.PI / 2;
    g.add(arcMesh);
    for (const sx of [-1, 1]) {
      const cup = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 10), hpM);
      cup.position.set(sx * 0.34, 1.55, 0);
      cup.rotation.z = Math.PI / 2;
      g.add(cup);
    }
  }

  if (acc.includes('medal')) {
    // Ribbon
    const ribM = mat(0xDC2626);
    const rib = mesh(new THREE.BoxGeometry(0.05, 0.22, 0.02), ribM);
    rib.position.set(0.08, 1.05, 0.31);
    rib.rotation.z = 0.15;
    g.add(rib);
    // Medal disc
    const disc = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 12), mat(0xFCD34D));
    disc.position.set(0.1, 0.9, 0.31);
    disc.rotation.x = Math.PI / 2;
    g.add(disc);
  }

  if (acc.includes('camera')) {
    const camM = mat(0x1F2937);
    const body3d = mesh(new THREE.BoxGeometry(0.2, 0.14, 0.1), camM);
    body3d.position.set(-0.38, 0.76, 0.22);
    g.add(body3d);
    const lens3d = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 10), mat(0x374151));
    lens3d.position.set(-0.38, 0.76, 0.3);
    lens3d.rotation.x = Math.PI / 2;
    g.add(lens3d);
    // Strap
    const strap = mesh(new THREE.BoxGeometry(0.03, 0.32, 0.02), mat(0x92400E));
    strap.position.set(-0.2, 0.92, 0.18);
    strap.rotation.z = -0.4;
    g.add(strap);
  }

  if (acc.includes('umbrella')) {
    const uM = mat(0xEF4444);
    const dome = mesh(new THREE.SphereGeometry(0.3, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), uM);
    dome.position.set(-0.8, 1.08, 0);
    g.add(dome);
    const pole = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.7, 6), mat(0x94A3B8));
    pole.position.set(-0.8, 0.72, 0);
    g.add(pole);
  }

  if (acc.includes('binoculars')) {
    const binoM = mat(0x374151);
    for (const sx of [-1, 1]) {
      const tube = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 10), binoM);
      tube.position.set(sx * 0.1, 0.84, 0.28);
      tube.rotation.x = Math.PI / 2;
      g.add(tube);
    }
    const bridge2 = mesh(new THREE.BoxGeometry(0.12, 0.06, 0.05), binoM);
    bridge2.position.set(0, 0.84, 0.28);
    g.add(bridge2);
    // Strap
    const binoStrap = mesh(new THREE.BoxGeometry(0.03, 0.26, 0.02), mat(0x92400E));
    binoStrap.position.set(0, 0.98, 0.22);
    g.add(binoStrap);
  }

  if (acc.includes('map')) {
    const mapM = mat(0xFFFDE7);
    const scroll = mesh(new THREE.BoxGeometry(0.22, 0.28, 0.03), mapM);
    scroll.position.set(0.76, 0.62, 0.1);
    scroll.rotation.z = -0.2;
    g.add(scroll);
    // Scroll rolls
    for (const sy of [0.76, 0.48]) {
      const roll = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 8), mat(0xD97706));
      roll.position.set(0.76, sy, 0.1);
      roll.rotation.z = Math.PI / 2;
      g.add(roll);
    }
  }

  // Center the group vertically so y=0 is at feet
  group_offset(g, 0.46);
  return g;
}

function group_offset(g: THREE.Group, dy: number) {
  g.children.forEach(c => { c.position.y -= dy; });
}

// ── Component ────────────────────────────────────────────────────────────────

interface Props {
  avatar: Partial<AvatarConfig>;
  width?: number;
  height?: number;
}

export default function Avatar3D({ avatar, width = 220, height = 300 }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef     = useRef<THREE.Scene | null>(null);
  const characterRef = useRef<THREE.Group | null>(null);
  const rafRef       = useRef<number>(0);
  const rotYRef      = useRef(0);
  const isDragRef    = useRef(false);
  const lastXRef     = useRef(0);

  // Key that changes when avatar config changes
  const avatarKey = useMemo(() => [
    avatar.hairStyle, avatar.hairColor, avatar.eyeColor,
    avatar.skinColor, avatar.outfit, avatar.user,
    ...(avatar.accessories ?? []),
  ].join(','), [avatar]);

  // Mount: create renderer, scene, camera, lights, start loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    camera.position.set(0, 0.8, 3.8);
    camera.lookAt(0, 0.6, 0);

    scene.add(new THREE.AmbientLight(0xffffff, 0.65));
    const sun = new THREE.DirectionalLight(0xffffff, 0.9);
    sun.position.set(3, 5, 4);
    sun.castShadow = true;
    scene.add(sun);
    const fill2 = new THREE.DirectionalLight(0x8ab4f8, 0.35);
    fill2.position.set(-3, 1, -3);
    scene.add(fill2);

    const char = buildCharacter(avatar);
    scene.add(char);

    rendererRef.current  = renderer;
    sceneRef.current     = scene;
    characterRef.current = char;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      if (characterRef.current) characterRef.current.rotation.y = rotYRef.current;
      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      rendererRef.current  = null;
      sceneRef.current     = null;
      characterRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // Rebuild character when config changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (characterRef.current) {
      scene.remove(characterRef.current);
      characterRef.current = null;
    }
    const char = buildCharacter(avatar);
    scene.add(char);
    characterRef.current = char;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarKey]);

  // Drag handlers
  function startDrag(x: number) { isDragRef.current = true; lastXRef.current = x; }
  function moveDrag(x: number) {
    if (!isDragRef.current) return;
    rotYRef.current += (x - lastXRef.current) * 0.012;
    lastXRef.current = x;
  }
  function endDrag() { isDragRef.current = false; }

  return (
    <canvas
      ref={canvasRef}
      width={width}
      height={height}
      style={{ display: 'block', cursor: 'grab', touchAction: 'none', borderRadius: 16 }}
      onMouseDown={e => startDrag(e.clientX)}
      onMouseMove={e => moveDrag(e.clientX)}
      onMouseUp={endDrag}
      onMouseLeave={endDrag}
      onTouchStart={e => startDrag(e.touches[0].clientX)}
      onTouchMove={e => { e.preventDefault(); moveDrag(e.touches[0].clientX); }}
      onTouchEnd={endDrag}
    />
  );
}
