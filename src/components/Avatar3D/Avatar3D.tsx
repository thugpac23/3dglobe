'use client';

import { useEffect, useRef, useMemo } from 'react';
import * as THREE from 'three';
import { AvatarConfig, FaceType, Expression } from '@/types';

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

// Face shape scale per type: [sx, sy, sz]
const FACE_SCALE: Record<string, [number, number, number]> = {
  standard: [1,    1,    1   ],
  round:    [1.1,  0.92, 1.06],
  long:     [0.88, 1.16, 0.91],
  child:    [1.07, 1.04, 1.07],
  angular:  [1.04, 0.97, 0.84],
};

// ── Material / mesh helpers ───────────────────────────────────────────────────
function cssToHex(css: string): number {
  return parseInt(css.replace('#', ''), 16);
}

function mat(
  color: number,
  opts: Partial<THREE.MeshStandardMaterialParameters> = {},
): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.65, metalness: 0.05, ...opts });
}

function mesh(geo: THREE.BufferGeometry, material: THREE.Material): THREE.Mesh {
  const m = new THREE.Mesh(geo, material);
  m.castShadow = true;
  return m;
}

// ── Animatable parts ─────────────────────────────────────────────────────────
interface CharacterParts {
  torso: THREE.Mesh;
  leftEyelid: THREE.Mesh;
  rightEyelid: THREE.Mesh;
}

// ── Character builder ─────────────────────────────────────────────────────────
function buildCharacter(
  avatar: Partial<AvatarConfig>,
  expression: Expression,
  faceType: FaceType,
): { group: THREE.Group; parts: CharacterParts } {

  const skinHex = cssToHex(avatar.skinColor ?? '#FBBF8A');
  const hairHex = cssToHex(avatar.hairColor ?? '#8B4513');
  const eyeHex  = cssToHex(avatar.eyeColor  ?? '#4B5563');
  const outfit  = avatar.outfit    ?? 'casual';
  const hair    = avatar.hairStyle ?? 'short';
  const acc     = avatar.accessories ?? [];
  const isMale  = avatar.user !== 'iva';

  const skinM  = mat(skinHex, { roughness: 0.58 });
  const hairM  = mat(hairHex, { roughness: 0.78 });
  const eyeM   = mat(eyeHex,  { roughness: 0.28 });
  const whiteM = mat(0xffffff, { roughness: 0.22 });
  const darkM  = mat(0x2D2D2D, { roughness: 0.82 });
  const topM   = mat(OUTFIT_TOP[outfit] ?? 0x60A5FA, { roughness: 0.72 });
  const botM   = mat(OUTFIT_BOT[outfit] ?? 0x1E40AF, { roughness: 0.72 });

  const g = new THREE.Group();

  // ── TORSO ──
  const torso = mesh(
    new THREE.CylinderGeometry(isMale ? 0.29 : 0.25, isMale ? 0.31 : 0.28, 0.64, 12),
    topM,
  );
  torso.position.set(0, 0.74, 0);
  g.add(torso);

  // Outfit details on torso
  if (['formal','travel','city','royal'].includes(outfit)) {
    const lapelM = mat(OUTFIT_BOT[outfit] ?? 0x374151, { roughness: 0.7 });
    for (const sx of [-1, 1]) {
      const lapel = mesh(new THREE.BoxGeometry(0.1, 0.28, 0.04), lapelM);
      lapel.position.set(sx * -0.1, 0.82, 0.27);
      lapel.rotation.z = sx * -0.4;
      g.add(lapel);
    }
  }
  if (outfit === 'formal') {
    const shirt = mesh(new THREE.BoxGeometry(0.12, 0.38, 0.04), whiteM);
    shirt.position.set(0, 0.78, 0.28);
    g.add(shirt);
    const tie = mesh(new THREE.BoxGeometry(0.055, 0.32, 0.035), mat(0xDC2626, { roughness: 0.6 }));
    tie.position.set(0, 0.78, 0.31);
    g.add(tie);
  }
  if (outfit === 'royal') {
    const epM = mat(OUTFIT_ACC.royal, { metalness: 0.4, roughness: 0.38 });
    for (const sx of [-1, 1]) {
      const ep = mesh(new THREE.CylinderGeometry(0.1, 0.08, 0.06, 10), epM);
      ep.position.set(sx * 0.32, 1.08, 0);
      g.add(ep);
    }
    const btnM = mat(OUTFIT_ACC.royal, { metalness: 0.4 });
    for (let i = 0; i < 3; i++) {
      const btn = mesh(new THREE.SphereGeometry(0.04, 8, 8), btnM);
      btn.position.set(0, 0.92 - i * 0.14, 0.3);
      g.add(btn);
    }
  }
  if (outfit === 'ninja') {
    const sash = mesh(new THREE.TorusGeometry(0.3, 0.04, 6, 14), mat(OUTFIT_ACC.ninja, { roughness: 0.8 }));
    sash.position.set(0, 0.56, 0);
    g.add(sash);
  }
  if (outfit === 'scuba') {
    const valve = mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.06, 8), mat(OUTFIT_ACC.scuba, { metalness: 0.2 }));
    valve.position.set(0, 0.96, 0.29);
    g.add(valve);
    for (let i = 0; i < 3; i++) {
      const stripe = mesh(new THREE.TorusGeometry(0.31, 0.022, 4, 16, Math.PI), mat(OUTFIT_ACC.scuba));
      stripe.position.set(0, 0.88 - i * 0.18, 0);
      stripe.rotation.x = Math.PI / 2;
      g.add(stripe);
    }
  }
  if (outfit === 'safari') {
    const pocketM = mat(OUTFIT_BOT.safari, { roughness: 0.75 });
    for (const sx of [-1, 1]) {
      const pocket = mesh(new THREE.BoxGeometry(0.14, 0.11, 0.04), pocketM);
      pocket.position.set(sx * 0.18, 0.88, 0.28);
      g.add(pocket);
    }
    const belt = mesh(new THREE.TorusGeometry(0.31, 0.03, 4, 14), mat(OUTFIT_BOT.safari));
    belt.position.set(0, 0.47, 0);
    belt.rotation.x = Math.PI / 2;
    g.add(belt);
  }

  // ── SHOULDERS ──
  for (const sx of [-1, 1]) {
    const sho = mesh(new THREE.SphereGeometry(0.146, 10, 10), topM);
    sho.position.set(sx * 0.37, 1.04, 0);
    g.add(sho);
  }

  // ── ARMS ──
  const armTopM = ['explorer','summer','beach'].includes(outfit) ? skinM : topM;
  for (const sx of [-1, 1]) {
    const ua = mesh(new THREE.CylinderGeometry(0.096, 0.086, 0.38, 10), armTopM);
    ua.position.set(sx * 0.49, 0.82, 0);
    ua.rotation.z = sx * 0.27;
    g.add(ua);
    const fa = mesh(new THREE.CylinderGeometry(0.076, 0.066, 0.36, 10), skinM);
    fa.position.set(sx * 0.62, 0.5, 0);
    fa.rotation.z = sx * 0.17;
    g.add(fa);
    const hand = mesh(new THREE.SphereGeometry(0.08, 10, 10), skinM);
    hand.position.set(sx * 0.72, 0.32, 0);
    g.add(hand);
  }

  // ── HIPS ──
  const hips = mesh(new THREE.CylinderGeometry(0.3, 0.27, 0.22, 10), botM);
  hips.position.set(0, 0.4, 0);
  g.add(hips);

  // ── LEGS ──
  for (const sx of [-1, 1]) {
    const ul = mesh(new THREE.CylinderGeometry(0.116, 0.096, 0.38, 10), botM);
    ul.position.set(sx * 0.13, 0.13, 0);
    g.add(ul);
    const ll = mesh(new THREE.CylinderGeometry(0.086, 0.076, 0.36, 10), botM);
    ll.position.set(sx * 0.13, -0.23, 0);
    g.add(ll);
    const shoe = mesh(new THREE.BoxGeometry(0.17, 0.09, 0.28), darkM);
    shoe.position.set(sx * 0.13, -0.46, 0.04);
    g.add(shoe);
  }

  // ── NECK ──
  const neck = mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.18, 10), skinM);
  neck.position.set(0, 1.14, 0);
  g.add(neck);

  // ──────────────────────────────────────────────────────────────────────────
  // HEAD GROUP — contains all face/hair elements, scaled per faceType
  // ──────────────────────────────────────────────────────────────────────────
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 1.54, 0);
  g.add(headGroup);

  const [fsx, fsy, fsz] = FACE_SCALE[faceType] ?? [1, 1, 1];

  const headGeo = new THREE.SphereGeometry(0.32, 20, 18);
  const headMesh = mesh(headGeo, skinM);
  headMesh.scale.set(fsx, fsy, fsz);
  headGroup.add(headMesh);

  // Ears (placed at sides of scaled head)
  for (const sx of [-1, 1]) {
    const ear = mesh(new THREE.SphereGeometry(0.068, 10, 10), skinM);
    ear.scale.set(0.5, 1, 0.55);
    ear.position.set(sx * 0.316 * fsx, 0, 0);
    headGroup.add(ear);
  }

  // ── EYES (coords relative to headGroup center) ──
  const eyeBaseY = 0.03;
  const eyeZ     = 0.27;
  const eyeScale = expression === 'surprised' ? 1.18 : 1.0;

  for (const sx of [-1, 1]) {
    const ex = sx * 0.113;
    const w = mesh(new THREE.SphereGeometry(0.062, 10, 10), whiteM);
    w.scale.setScalar(eyeScale);
    w.position.set(ex, eyeBaseY, eyeZ);
    headGroup.add(w);

    const iris = mesh(new THREE.SphereGeometry(0.041, 10, 10), eyeM);
    iris.scale.setScalar(eyeScale);
    iris.position.set(ex, eyeBaseY, eyeZ + 0.026);
    headGroup.add(iris);

    const pupil = mesh(new THREE.SphereGeometry(0.019, 8, 8), mat(0x111111, { roughness: 0.18 }));
    pupil.scale.setScalar(eyeScale);
    pupil.position.set(ex, eyeBaseY, eyeZ + 0.042);
    headGroup.add(pupil);

    // Specular highlight
    const spec = mesh(new THREE.SphereGeometry(0.008, 5, 5), mat(0xffffff, { roughness: 0.08, metalness: 0.2 }));
    spec.position.set(ex + 0.016 * sx, eyeBaseY + 0.022, eyeZ + 0.048);
    headGroup.add(spec);
  }

  // ── EYELIDS — for blink animation ──
  function makeEyelidGeo() {
    const geo = new THREE.BoxGeometry(0.146, 0.072, 0.022);
    geo.translate(0, -0.036, 0); // pivot at top edge → scale.y covers downward
    return geo;
  }
  const lidSkinM = mat(skinHex, { roughness: 0.58 });
  const leftEyelid = mesh(makeEyelidGeo(), lidSkinM);
  leftEyelid.position.set(-0.113, eyeBaseY + 0.054, eyeZ + 0.013);
  leftEyelid.scale.y = 0.05; // open
  headGroup.add(leftEyelid);

  const rightEyelid = mesh(makeEyelidGeo(), lidSkinM);
  rightEyelid.position.set(0.113, eyeBaseY + 0.054, eyeZ + 0.013);
  rightEyelid.scale.y = 0.05;
  headGroup.add(rightEyelid);

  // Female lashes
  if (!isMale) {
    for (const sx of [-1, 1]) {
      const lash = mesh(new THREE.BoxGeometry(0.136, 0.023, 0.009), mat(hairHex, { roughness: 0.82 }));
      lash.position.set(sx * 0.113, eyeBaseY + 0.066, eyeZ + 0.013);
      lash.rotation.z = sx * 0.12;
      headGroup.add(lash);
    }
  }

  // ── NOSE ──
  const nose = mesh(new THREE.SphereGeometry(0.035, 8, 8), skinM);
  nose.position.set(0, -0.05, 0.31);
  headGroup.add(nose);

  // ── MOUTH — expression-specific ──
  const mouthY = -0.13;
  const mouthZ = 0.3;

  if (expression === 'smile') {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.1, mouthY, mouthZ),
      new THREE.Vector3(0,   mouthY - 0.042, mouthZ + 0.02),
      new THREE.Vector3(0.1, mouthY, mouthZ),
    );
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(10));
    headGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x7C3043, linewidth: 2 })));
    // Lip hint
    const lip = mesh(new THREE.SphereGeometry(0.021, 6, 6), mat(skinHex - 0x181010, { roughness: 0.6 }));
    lip.scale.set(2.4, 0.65, 0.75);
    lip.position.set(0, mouthY - 0.005, mouthZ - 0.002);
    headGroup.add(lip);
  } else if (expression === 'neutral') {
    const pts = [new THREE.Vector3(-0.088, mouthY, mouthZ), new THREE.Vector3(0.088, mouthY, mouthZ)];
    headGroup.add(new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(pts),
      new THREE.LineBasicMaterial({ color: 0x7C3043 }),
    ));
  } else if (expression === 'surprised') {
    const oval = mesh(new THREE.TorusGeometry(0.053, 0.024, 8, 16), mat(0x7C3043, { roughness: 0.7 }));
    oval.scale.y = 1.32;
    oval.position.set(0, mouthY - 0.018, mouthZ + 0.005);
    headGroup.add(oval);
    const inner = mesh(new THREE.CircleGeometry(0.038, 12), mat(0x1a0a0a));
    inner.position.set(0, mouthY - 0.018, mouthZ + 0.022);
    headGroup.add(inner);
  } else if (expression === 'thinking') {
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-0.048, mouthY, mouthZ),
      new THREE.Vector3(0.022, mouthY - 0.012, mouthZ + 0.018),
      new THREE.Vector3(0.096, mouthY - 0.004, mouthZ),
    );
    const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(8));
    headGroup.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x7C3043 })));
  }

  // ── EYEBROWS — expression-specific ──
  type BrowEntry = { lx: number; ly: number; lz: number; rx: number; ry: number; rz: number };
  const browConfigs: Record<Expression, BrowEntry> = {
    smile:     { lx: -0.113, ly: 0.128, lz:  0.16, rx: 0.113, ry: 0.128, rz: -0.16 },
    neutral:   { lx: -0.113, ly: 0.112, lz:  0.07, rx: 0.113, ry: 0.112, rz: -0.07 },
    surprised: { lx: -0.113, ly: 0.178, lz:  0.04, rx: 0.113, ry: 0.178, rz: -0.04 },
    thinking:  { lx: -0.113, ly: 0.176, lz:  0.22, rx: 0.113, ry: 0.113, rz: -0.06 },
  };
  const bc = browConfigs[expression] ?? browConfigs.smile;
  const browGeoBase = new THREE.BoxGeometry(0.128, 0.025, 0.013);
  const browM = mat(hairHex, { roughness: 0.78 });
  const lb = mesh(browGeoBase.clone(), browM);
  lb.position.set(bc.lx, bc.ly, 0.286);
  lb.rotation.z = bc.lz;
  headGroup.add(lb);
  const rb = mesh(browGeoBase, browM);
  rb.position.set(bc.rx, bc.ry, 0.286);
  rb.rotation.z = bc.rz;
  headGroup.add(rb);

  // ── NINJA FACE MASK ──
  if (outfit === 'ninja') {
    const maskM = mat(OUTFIT_BOT.ninja, { roughness: 0.8 });
    const mask = mesh(new THREE.SphereGeometry(0.33, 14, 10, 0, Math.PI * 2, Math.PI * 0.42, Math.PI * 0.3), maskM);
    headGroup.add(mask);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // HAIR
  // ──────────────────────────────────────────────────────────────────────────
  if (hair !== 'bald') {
    // Top cap — radius slightly outside head (0.32 → 0.336), 50% sphere from top
    const cap = mesh(
      new THREE.SphereGeometry(0.336, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.5),
      hairM,
    );
    headGroup.add(cap);

    if (hair === 'long') {
      // Side curtains: pushed out to x=±0.345 and back z=-0.04 to avoid head clipping
      for (const sx of [-1, 1]) {
        const strand = mesh(new THREE.CylinderGeometry(0.08, 0.054, 0.52, 8), hairM);
        strand.position.set(sx * 0.345, -0.35, -0.04);
        headGroup.add(strand);
      }
      // Back curtain: clearly behind head center (z=-0.29)
      const back = mesh(new THREE.CylinderGeometry(0.17, 0.1, 0.48, 10), hairM);
      back.position.set(0, -0.32, -0.3);
      headGroup.add(back);
    }

    if (hair === 'curly') {
      // Curls placed outside head+cap boundary (min dist ≈ 0.46 from headGroup center)
      const curls: [number, number, number][] = [
        [-0.38, 0.22, 0.0],  [0.38, 0.22, 0.0 ],
        [-0.42, 0.0,  0.0],  [0.42, 0.0,  0.0 ],
        [-0.22, 0.3, -0.2],  [0.22, 0.3, -0.2 ],
        [  0,   0.38, 0.0],
        [-0.3, -0.06,-0.28], [0.3, -0.06,-0.28],
      ];
      for (const [x, y, z] of curls) {
        const curl = mesh(new THREE.SphereGeometry(0.108, 10, 10), hairM);
        curl.position.set(x, y, z);
        headGroup.add(curl);
      }
    }

    if (hair === 'ponytail') {
      const tail = mesh(new THREE.CylinderGeometry(0.066, 0.04, 0.46, 8), hairM);
      tail.position.set(0, -0.2, -0.3);
      tail.rotation.x = 0.52;
      headGroup.add(tail);
      const band = mesh(new THREE.TorusGeometry(0.066, 0.022, 6, 12), mat(0xDC2626, { roughness: 0.62 }));
      band.position.set(0, -0.08, -0.28);
      band.rotation.x = Math.PI / 2;
      headGroup.add(band);
    }
  } else {
    // Bald shine
    const shine = mesh(
      new THREE.SphereGeometry(0.088, 8, 8),
      mat(0xffffff, { transparent: true, opacity: 0.17, roughness: 0.08, metalness: 0.22 }),
    );
    shine.scale.set(1, 0.44, 0.5);
    shine.position.set(-0.1, 0.17, 0.12);
    headGroup.add(shine);
  }

  // ──────────────────────────────────────────────────────────────────────────
  // ACCESSORIES — head-attached go into headGroup; body accessories go into g
  // ──────────────────────────────────────────────────────────────────────────

  if (acc.includes('hat')) {
    const hatM = mat(0xDC2626, { roughness: 0.7 });
    const brim = mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.06, 16), hatM);
    brim.position.set(0, 0.34, 0);
    headGroup.add(brim);
    const crown3d = mesh(new THREE.CylinderGeometry(0.3, 0.33, 0.38, 16), hatM);
    crown3d.position.set(0, 0.57, 0);
    headGroup.add(crown3d);
  }

  if (acc.includes('cap')) {
    const capM = mat(0x1D4ED8, { roughness: 0.7 });
    const capHat = mesh(new THREE.SphereGeometry(0.342, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capM);
    headGroup.add(capHat);
    const visor = mesh(
      new THREE.CylinderGeometry(0.3, 0.32, 0.06, 14, 1, false, -Math.PI * 0.15, Math.PI * 0.8),
      mat(0x1E3A5F),
    );
    visor.position.set(0, 0.19, 0.22);
    visor.rotation.x = 0.4;
    headGroup.add(visor);
  }

  if (acc.includes('crown')) {
    const crownBaseM = mat(0xFCD34D, { roughness: 0.38, metalness: 0.32 });
    const crownBase = mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.1, 14), crownBaseM);
    crownBase.position.set(0, 0.38, 0);
    headGroup.add(crownBase);
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const spike = mesh(new THREE.ConeGeometry(0.06, 0.2, 6), mat(0xFCD34D, { metalness: 0.32 }));
      spike.position.set(Math.sin(angle) * 0.3, 0.52, Math.cos(angle) * 0.3);
      headGroup.add(spike);
      const gemColor = i % 3 === 0 ? 0xEF4444 : i % 3 === 1 ? 0x60A5FA : 0x34D399;
      const gem = mesh(new THREE.SphereGeometry(0.04, 6, 6), mat(gemColor, { roughness: 0.18, metalness: 0.12 }));
      gem.position.copy(spike.position);
      gem.position.y -= 0.06;
      headGroup.add(gem);
    }
  }

  if (acc.includes('glasses') || acc.includes('sunglasses')) {
    const lensColor   = acc.includes('sunglasses') ? 0x1e293b : 0xdbeafe;
    const lensOpacity = acc.includes('sunglasses') ? 0.85 : 0.35;
    const lensM  = mat(lensColor, { transparent: true, opacity: lensOpacity, roughness: 0.1 });
    const frameM = mat(0x1e293b, { roughness: 0.48 });
    for (const fx of [-0.113, 0.113]) {
      const frame = mesh(new THREE.TorusGeometry(0.068, 0.013, 6, 16), frameM);
      frame.position.set(fx, eyeBaseY, eyeZ + 0.026);
      headGroup.add(frame);
      const fill = mesh(new THREE.CircleGeometry(0.068, 16), lensM);
      fill.position.set(fx, eyeBaseY, eyeZ + 0.031);
      headGroup.add(fill);
    }
    const bridge = mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.09, 4), frameM);
    bridge.position.set(0, eyeBaseY, eyeZ + 0.026);
    bridge.rotation.z = Math.PI / 2;
    headGroup.add(bridge);
  }

  if (acc.includes('headphones')) {
    const hpM = mat(0x374151, { roughness: 0.62 });
    const arc = mesh(new THREE.TorusGeometry(0.34, 0.033, 6, 16, Math.PI), hpM);
    arc.position.set(0, 0.08, 0);
    arc.rotation.z = Math.PI / 2;
    headGroup.add(arc);
    for (const sx of [-1, 1]) {
      const cup = mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.08, 12), hpM);
      cup.position.set(sx * 0.34, 0.01, 0);
      cup.rotation.z = Math.PI / 2;
      headGroup.add(cup);
    }
  }

  if (acc.includes('scarf')) {
    const scarfM = mat(0xDC2626, { roughness: 0.76 });
    const scarf = mesh(new THREE.TorusGeometry(0.17, 0.067, 8, 18), scarfM);
    scarf.position.set(0, 1.18, 0);
    g.add(scarf);
    const end = mesh(new THREE.BoxGeometry(0.08, 0.28, 0.07), scarfM);
    end.position.set(0.12, 0.9, 0.2);
    end.rotation.z = 0.2;
    g.add(end);
  }

  if (acc.includes('backpack') || acc.includes('travel-backpack')) {
    const packColor = acc.includes('travel-backpack') ? 0x65A30D : 0xD97706;
    const pack = mesh(new THREE.BoxGeometry(0.42, 0.48, 0.18), mat(packColor, { roughness: 0.78 }));
    pack.position.set(0, 0.76, -0.3);
    g.add(pack);
    const pocket = mesh(new THREE.BoxGeometry(0.3, 0.16, 0.04), mat(packColor - 0x111100));
    pocket.position.set(0, 0.9, -0.4);
    g.add(pocket);
    for (const sx of [-1, 1]) {
      const strap = mesh(new THREE.BoxGeometry(0.05, 0.52, 0.03), mat(packColor - 0x111100));
      strap.position.set(sx * 0.17, 0.82, -0.22);
      g.add(strap);
    }
  }

  if (acc.includes('medal')) {
    const rib = mesh(new THREE.BoxGeometry(0.05, 0.22, 0.02), mat(0xDC2626, { roughness: 0.7 }));
    rib.position.set(0.08, 1.05, 0.31);
    rib.rotation.z = 0.15;
    g.add(rib);
    const disc = mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.03, 14), mat(0xFCD34D, { metalness: 0.36, roughness: 0.38 }));
    disc.position.set(0.1, 0.9, 0.31);
    disc.rotation.x = Math.PI / 2;
    g.add(disc);
  }

  if (acc.includes('camera')) {
    const camM = mat(0x1F2937, { roughness: 0.75 });
    const body3d = mesh(new THREE.BoxGeometry(0.2, 0.14, 0.1), camM);
    body3d.position.set(-0.38, 0.76, 0.22);
    g.add(body3d);
    const lens3d = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 12), mat(0x374151));
    lens3d.position.set(-0.38, 0.76, 0.3);
    lens3d.rotation.x = Math.PI / 2;
    g.add(lens3d);
    const strap = mesh(new THREE.BoxGeometry(0.03, 0.32, 0.02), mat(0x92400E));
    strap.position.set(-0.2, 0.92, 0.18);
    strap.rotation.z = -0.4;
    g.add(strap);
  }

  if (acc.includes('umbrella')) {
    const dome = mesh(
      new THREE.SphereGeometry(0.3, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      mat(0xEF4444, { roughness: 0.65 }),
    );
    dome.position.set(-0.8, 1.08, 0);
    g.add(dome);
    const pole = mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.7, 6), mat(0x94A3B8, { roughness: 0.48, metalness: 0.22 }));
    pole.position.set(-0.8, 0.72, 0);
    g.add(pole);
  }

  if (acc.includes('binoculars')) {
    const binoM = mat(0x374151, { roughness: 0.7 });
    for (const sx of [-1, 1]) {
      const tube = mesh(new THREE.CylinderGeometry(0.067, 0.067, 0.18, 12), binoM);
      tube.position.set(sx * 0.1, 0.84, 0.28);
      tube.rotation.x = Math.PI / 2;
      g.add(tube);
    }
    const bridge2 = mesh(new THREE.BoxGeometry(0.12, 0.06, 0.05), binoM);
    bridge2.position.set(0, 0.84, 0.28);
    g.add(bridge2);
    const binoStrap = mesh(new THREE.BoxGeometry(0.03, 0.26, 0.02), mat(0x92400E));
    binoStrap.position.set(0, 0.98, 0.22);
    g.add(binoStrap);
  }

  if (acc.includes('map')) {
    const mapM = mat(0xFFFDE7, { roughness: 0.82 });
    const scroll = mesh(new THREE.BoxGeometry(0.22, 0.28, 0.03), mapM);
    scroll.position.set(0.76, 0.62, 0.1);
    scroll.rotation.z = -0.2;
    g.add(scroll);
    for (const sy of [0.76, 0.48]) {
      const roll = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.24, 8), mat(0xD97706));
      roll.position.set(0.76, sy, 0.1);
      roll.rotation.z = Math.PI / 2;
      g.add(roll);
    }
  }

  // Centre vertically so y=0 is at feet
  groupOffset(g, 0.46);

  return { group: g, parts: { torso, leftEyelid, rightEyelid } };
}

function groupOffset(g: THREE.Group, dy: number) {
  g.children.forEach(c => { c.position.y -= dy; });
}

// ── Component ────────────────────────────────────────────────────────────────
interface Props {
  avatar: Partial<AvatarConfig>;
  width?: number;
  height?: number;
  /** Override expression — used by quiz page to show reaction */
  expression?: Expression;
}

export default function Avatar3D({ avatar, width = 220, height = 300, expression: expressionProp }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef     = useRef<THREE.Scene | null>(null);
  const characterRef = useRef<THREE.Group | null>(null);
  const partsRef     = useRef<CharacterParts | null>(null);
  const rafRef       = useRef<number>(0);
  const rotYRef      = useRef(0);
  const isDragRef    = useRef(false);
  const lastXRef     = useRef(0);

  // Idle animation refs
  const lastTRef      = useRef(0);
  const breathRef     = useRef(0);
  const headBobRef    = useRef(0);
  const blinkTimerRef = useRef(0);
  const nextBlinkRef  = useRef(2.5 + Math.random() * 3);
  const blinkPhaseRef = useRef(-1); // -1 = idle, ≥0 = animating

  const effectiveExpression: Expression = expressionProp ?? avatar.expression ?? 'smile';
  const effectiveFaceType: FaceType     = avatar.faceType ?? 'standard';

  const avatarKey = useMemo(() => [
    avatar.hairStyle, avatar.hairColor, avatar.eyeColor,
    avatar.skinColor, avatar.outfit, avatar.user,
    effectiveFaceType, effectiveExpression,
    ...(avatar.accessories ?? []),
  ].join(','), [avatar, effectiveFaceType, effectiveExpression]);

  // Mount: renderer, scene, camera, lights, initial character, RAF loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    camera.position.set(0, 0.86, 3.9);
    camera.lookAt(0, 0.62, 0);

    // Soft 3-point lighting
    scene.add(new THREE.AmbientLight(0xfff4e8, 0.52));
    const key = new THREE.DirectionalLight(0xffffff, 0.96);
    key.position.set(2.5, 5, 4);
    key.castShadow = true;
    key.shadow.mapSize.setScalar(1024);
    scene.add(key);
    const fill = new THREE.DirectionalLight(0x8ab4f8, 0.36);
    fill.position.set(-3, 1, -2);
    scene.add(fill);
    const rim = new THREE.DirectionalLight(0xffe0cc, 0.2);
    rim.position.set(0, -1, -4);
    scene.add(rim);

    const { group: char, parts } = buildCharacter(avatar, effectiveExpression, effectiveFaceType);
    scene.add(char);
    rendererRef.current  = renderer;
    sceneRef.current     = scene;
    characterRef.current = char;
    partsRef.current     = parts;

    const animate = () => {
      rafRef.current = requestAnimationFrame(animate);
      if (characterRef.current) characterRef.current.rotation.y = rotYRef.current;

      const now = performance.now() / 1000;
      const dt  = lastTRef.current > 0 ? Math.min(now - lastTRef.current, 0.08) : 0.016;
      lastTRef.current = now;

      const p = partsRef.current;
      if (p) {
        // Breathing
        breathRef.current += dt * 0.88;
        p.torso.scale.y = 1 + Math.sin(breathRef.current) * 0.009;

        // Subtle head tilt via full-character z-rotation
        headBobRef.current += dt * 0.52;
        if (characterRef.current) {
          characterRef.current.rotation.z = Math.sin(headBobRef.current) * 0.011;
        }

        // Blink
        blinkTimerRef.current += dt;
        if (blinkTimerRef.current >= nextBlinkRef.current && blinkPhaseRef.current < 0) {
          blinkTimerRef.current = 0;
          nextBlinkRef.current  = 2.8 + Math.random() * 4.2;
          blinkPhaseRef.current = 0;
        }
        if (blinkPhaseRef.current >= 0) {
          blinkPhaseRef.current += dt;
          const t        = blinkPhaseRef.current / 0.16;
          const openness = t < 0.5 ? 1 - t / 0.5 : (t - 0.5) / 0.5;
          const sy       = Math.max(0.04, Math.min(1, openness));
          p.leftEyelid.scale.y  = sy;
          p.rightEyelid.scale.y = sy;
          if (blinkPhaseRef.current > 0.16) {
            blinkPhaseRef.current = -1;
            p.leftEyelid.scale.y  = 0.05;
            p.rightEyelid.scale.y = 0.05;
          }
        }
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(rafRef.current);
      renderer.dispose();
      rendererRef.current  = null;
      sceneRef.current     = null;
      characterRef.current = null;
      partsRef.current     = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // Rebuild character when config changes
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene) return;
    if (characterRef.current) scene.remove(characterRef.current);
    const { group: char, parts } = buildCharacter(avatar, effectiveExpression, effectiveFaceType);
    scene.add(char);
    char.rotation.y      = rotYRef.current;
    characterRef.current = char;
    partsRef.current     = parts;
    blinkPhaseRef.current = -1;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarKey]);

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
