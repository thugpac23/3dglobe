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

// Derive a 3-color outfit palette from a single base hex.
// top = base, bot = darker shade, acc = lighter complementary highlight.
function deriveOutfitPalette(baseHex: number): { top: number; bot: number; acc: number } {
  const c = new THREE.Color(baseHex);
  const hsl = { h: 0, s: 0, l: 0 };
  c.getHSL(hsl);
  const bot = new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.05), Math.max(0.04, hsl.l - 0.18));
  const acc = new THREE.Color().setHSL(hsl.h, Math.max(0.05, hsl.s * 0.55), Math.min(0.93, hsl.l + 0.24));
  return { top: c.getHex(), bot: bot.getHex(), acc: acc.getHex() };
}

// ── Country flag patch helpers ───────────────────────────────────────────────
function isoToFlagEmoji(iso: string): string {
  if (!iso || iso.length !== 2) return '🏳';
  try {
    return String.fromCodePoint(
      0x1F1E6 + iso.toUpperCase().charCodeAt(0) - 65,
      0x1F1E6 + iso.toUpperCase().charCodeAt(1) - 65,
    );
  } catch { return '🏳'; }
}

function makePatchTexture(iso: string): THREE.CanvasTexture {
  const c  = document.createElement('canvas');
  c.width  = 128; c.height = 96;
  const ctx = c.getContext('2d')!;
  // Cloth patch background
  const grad = ctx.createLinearGradient(0, 0, 0, 96);
  grad.addColorStop(0, '#F8FAFC');
  grad.addColorStop(1, '#CBD5E1');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 96);
  // Outer border
  ctx.strokeStyle = '#1E293B';
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 124, 92);
  // Flag emoji centered
  ctx.font = '64px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(isoToFlagEmoji(iso), 64, 50);
  // ISO code label below the flag for reliability when emoji fonts are missing
  ctx.font = 'bold 18px sans-serif';
  ctx.fillStyle = '#1E293B';
  ctx.fillText(iso.toUpperCase(), 64, 84);
  // Stitched dashes inside border
  ctx.strokeStyle = '#475569';
  ctx.setLineDash([4, 4]);
  ctx.lineWidth = 1.4;
  ctx.strokeRect(7, 7, 114, 82);
  ctx.setLineDash([]);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Lay flag patches across the front-left chest. They are positioned on the
// torso cylinder surface (radius ≈ 0.30) and oriented along the radial normal
// so they look stitched onto the clothing as the avatar rotates.
function buildPatches(visitedIso: string[]): THREE.Group {
  const g = new THREE.Group();
  const isos = visitedIso.slice(0, 6);
  if (!isos.length) return g;

  const cols = isos.length <= 3 ? 1 : 2;
  const xStart  = cols === 1 ? -0.13 : -0.18;
  const xSpace  = 0.105;
  const yStart  = 0.96;
  const ySpace  = 0.082;
  const torsoR  = 0.30;
  const standoff = 0.022;
  const pw = 0.094, ph = 0.070, pd = 0.008;

  isos.forEach((iso, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = xStart + col * xSpace;
    const y = yStart - row * ySpace;
    const surfaceZ = Math.sqrt(Math.max(0, torsoR * torsoR - x * x));
    const z = surfaceZ + standoff;
    const tex = makePatchTexture(iso);
    const m   = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.74, metalness: 0.04 });
    const patch = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, pd), m);
    patch.position.set(x, y, z);
    patch.rotation.y = Math.atan2(x, surfaceZ);
    patch.castShadow = true;
    g.add(patch);
  });

  return g;
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
  outfitColor: string | undefined,
  visitedIso: string[],
): { group: THREE.Group; parts: CharacterParts } {

  const skinHex = cssToHex(avatar.skinColor ?? '#FBBF8A');
  const hairHex = cssToHex(avatar.hairColor ?? '#8B4513');
  const eyeHex  = cssToHex(avatar.eyeColor  ?? '#4B5563');
  const outfit  = avatar.outfit    ?? 'casual';
  const hair    = avatar.hairStyle ?? 'short';
  const acc     = avatar.accessories ?? [];
  const isMale  = avatar.user !== 'iva';

  // Outfit palette — main + bottom shade follow user override, accent stays
  // outfit-specific so structural details (gold royal buttons, white sporty
  // stripes, etc.) keep their identity even when colour is customized.
  let topHex = OUTFIT_TOP[outfit] ?? 0x60A5FA;
  let botHex = OUTFIT_BOT[outfit] ?? 0x1E40AF;
  if (outfitColor) {
    const palette = deriveOutfitPalette(cssToHex(outfitColor));
    topHex = palette.top;
    botHex = palette.bot;
  }

  const skinM  = mat(skinHex, { roughness: 0.52, metalness: 0.02 });
  const hairM  = mat(hairHex, { roughness: 0.72, metalness: 0.01 });
  const eyeM   = mat(eyeHex,  { roughness: 0.28 });
  const whiteM = mat(0xffffff, { roughness: 0.22 });
  const darkM  = mat(0x2D2D2D, { roughness: 0.82 });
  const topM   = mat(topHex, { roughness: 0.72 });
  const botM   = mat(botHex, { roughness: 0.72 });
  // Subtle highlight + shadow shades derived from main outfit colour
  const highlightHex = (() => {
    const c = new THREE.Color(topHex); const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl); return new THREE.Color().setHSL(hsl.h, hsl.s * 0.85, Math.min(0.95, hsl.l + 0.12)).getHex();
  })();
  const shadowHex = (() => {
    const c = new THREE.Color(topHex); const hsl = { h: 0, s: 0, l: 0 };
    c.getHSL(hsl); return new THREE.Color().setHSL(hsl.h, Math.min(1, hsl.s * 1.05), Math.max(0.04, hsl.l - 0.10)).getHex();
  })();
  const seamM      = mat(shadowHex, { roughness: 0.78 });
  const highlightM = mat(highlightHex, { roughness: 0.62 });

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
    const lapelM = mat(botHex, { roughness: 0.7 });
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
    const pocketM = mat(botHex, { roughness: 0.75 });
    for (const sx of [-1, 1]) {
      const pocket = mesh(new THREE.BoxGeometry(0.14, 0.11, 0.04), pocketM);
      pocket.position.set(sx * 0.18, 0.88, 0.28);
      g.add(pocket);
      // Pocket flap with button
      const flap = mesh(new THREE.BoxGeometry(0.15, 0.04, 0.04), pocketM);
      flap.position.set(sx * 0.18, 0.945, 0.282);
      g.add(flap);
      const btn = mesh(new THREE.SphereGeometry(0.012, 6, 6), mat(0x854D0E, { metalness: 0.4 }));
      btn.position.set(sx * 0.18, 0.94, 0.305);
      g.add(btn);
    }
    const belt = mesh(new THREE.TorusGeometry(0.31, 0.03, 4, 14), mat(botHex));
    belt.position.set(0, 0.47, 0);
    belt.rotation.x = Math.PI / 2;
    g.add(belt);
    // Epaulets on each shoulder
    for (const sx of [-1, 1]) {
      const ep = mesh(new THREE.BoxGeometry(0.14, 0.04, 0.06), pocketM);
      ep.position.set(sx * 0.27, 1.10, 0.05);
      ep.rotation.z = sx * 0.12;
      g.add(ep);
    }
  }

  // ── Realistic outfit details (folds, hoods, zippers, layers) ────────────────
  // Travel jacket: collar + zipper + horizontal fold lines
  if (outfit === 'travel') {
    const jacketDarkM = mat(0x2D3744, { roughness: 0.74 });
    // Collar
    const collar = mesh(new THREE.TorusGeometry(0.16, 0.04, 6, 16, Math.PI), jacketDarkM);
    collar.position.set(0, 1.04, 0.04);
    collar.rotation.x = -0.4;
    g.add(collar);
    // Vertical zipper line
    const zipper = mesh(new THREE.BoxGeometry(0.022, 0.55, 0.024), mat(0x9CA3AF, { metalness: 0.4, roughness: 0.4 }));
    zipper.position.set(0, 0.78, 0.295);
    g.add(zipper);
    // Chest pocket
    const chestPocket = mesh(new THREE.BoxGeometry(0.13, 0.10, 0.022), jacketDarkM);
    chestPocket.position.set(-0.13, 0.92, 0.296);
    g.add(chestPocket);
    // Side pockets
    for (const sx of [-1, 1]) {
      const sp = mesh(new THREE.BoxGeometry(0.16, 0.10, 0.022), jacketDarkM);
      sp.position.set(sx * 0.16, 0.66, 0.292);
      g.add(sp);
    }
    // Cuff lines
    for (const sx of [-1, 1]) {
      const cuff = mesh(new THREE.TorusGeometry(0.082, 0.014, 5, 12), jacketDarkM);
      cuff.position.set(sx * 0.66, 0.36, 0);
      cuff.rotation.y = Math.PI / 2;
      g.add(cuff);
      // Velcro / strap detail above cuff
      const strap = mesh(new THREE.BoxGeometry(0.06, 0.022, 0.02), jacketDarkM);
      strap.position.set(sx * 0.66, 0.42, 0.062);
      g.add(strap);
    }
    // Shoulder yoke seam (horizontal across upper back/chest)
    const yoke = mesh(new THREE.BoxGeometry(0.50, 0.012, 0.05), seamM);
    yoke.position.set(0, 1.02, 0.28);
    yoke.rotation.x = -0.2;
    g.add(yoke);
    // Pocket flap highlights
    for (const sx of [-1, 1]) {
      const flap = mesh(new THREE.BoxGeometry(0.16, 0.02, 0.022), highlightM);
      flap.position.set(sx * 0.16, 0.72, 0.298);
      g.add(flap);
    }
  }

  // Sporty: zip detail, contrast stripes, side panels, reflective trim
  if (outfit === 'sporty') {
    const stripeM = mat(0xFFFFFF, { roughness: 0.55 });
    for (const sx of [-1, 1]) {
      const stripe = mesh(new THREE.BoxGeometry(0.022, 0.62, 0.012), stripeM);
      stripe.position.set(sx * 0.21, 0.78, 0.30);
      g.add(stripe);
      // Reflective trim along sleeve
      const refl = mesh(new THREE.TorusGeometry(0.082, 0.008, 4, 12), mat(0xE5E7EB, { metalness: 0.3, roughness: 0.4 }));
      refl.position.set(sx * 0.59, 0.42, 0);
      refl.rotation.y = Math.PI / 2;
      g.add(refl);
      // Side panel — darker accent flank
      const sidePanel = mesh(new THREE.BoxGeometry(0.05, 0.42, 0.022), seamM);
      sidePanel.position.set(sx * 0.27, 0.74, 0.15);
      sidePanel.rotation.y = sx * 0.5;
      g.add(sidePanel);
    }
    // High collar
    const sCollar = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.08, 12, 1, true), mat(botHex, { roughness: 0.65 }));
    sCollar.position.set(0, 1.06, 0);
    g.add(sCollar);
    const sZip = mesh(new THREE.BoxGeometry(0.016, 0.18, 0.022), mat(0xC0C0C0, { metalness: 0.5 }));
    sZip.position.set(0, 1.0, 0.30);
    g.add(sZip);
    // Logo box on chest
    const logo = mesh(new THREE.BoxGeometry(0.07, 0.04, 0.02), stripeM);
    logo.position.set(0.13, 0.94, 0.30);
    g.add(logo);
  }

  // City outfit: hoodie hood + drawstring + kangaroo pocket + sleeve cuffs
  if (outfit === 'city') {
    const hoodM = mat(topHex, { roughness: 0.78 });
    const hood = mesh(new THREE.SphereGeometry(0.28, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.55), hoodM);
    hood.position.set(0, 1.10, -0.04);
    hood.scale.set(1.05, 0.95, 1.10);
    g.add(hood);
    // Hood lining ring (darker inside)
    const hoodLining = mesh(new THREE.TorusGeometry(0.20, 0.022, 6, 18), mat(shadowHex, { roughness: 0.85 }));
    hoodLining.position.set(0, 1.06, 0.06);
    hoodLining.rotation.x = -0.5;
    g.add(hoodLining);
    // Drawstrings
    for (const sx of [-1, 1]) {
      const string = mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6), mat(0xF4F4F5));
      string.position.set(sx * 0.04, 0.94, 0.27);
      g.add(string);
      const tip = mesh(new THREE.SphereGeometry(0.018, 6, 6), mat(0xF4F4F5));
      tip.position.set(sx * 0.04, 0.84, 0.27);
      g.add(tip);
    }
    // Kangaroo pocket — large front fold with seam line
    const pocket = mesh(new THREE.BoxGeometry(0.4, 0.18, 0.04), mat(botHex, { roughness: 0.78 }));
    pocket.position.set(0, 0.62, 0.295);
    g.add(pocket);
    const pocketSeam = mesh(new THREE.BoxGeometry(0.4, 0.005, 0.03), seamM);
    pocketSeam.position.set(0, 0.71, 0.30);
    g.add(pocketSeam);
    // Sleeve cuff bands
    for (const sx of [-1, 1]) {
      const cuff = mesh(new THREE.CylinderGeometry(0.080, 0.080, 0.06, 12, 1, true), mat(botHex, { roughness: 0.78 }));
      cuff.position.set(sx * 0.66, 0.36, 0);
      g.add(cuff);
    }
  }

  // Casual: horizontal fold + henley placket + chest pocket + buttons
  if (outfit === 'casual') {
    const foldM = mat(botHex, { roughness: 0.7 });
    const fold = mesh(new THREE.TorusGeometry(0.30, 0.014, 4, 16, Math.PI), foldM);
    fold.position.set(0, 0.66, 0);
    fold.rotation.x = Math.PI / 2;
    g.add(fold);
    // Henley placket
    const placket = mesh(new THREE.BoxGeometry(0.05, 0.18, 0.022), foldM);
    placket.position.set(0, 0.96, 0.29);
    g.add(placket);
    // Two small placket buttons
    for (let i = 0; i < 2; i++) {
      const btn = mesh(new THREE.SphereGeometry(0.011, 6, 6), mat(0xF8FAFC, { metalness: 0.2 }));
      btn.position.set(0, 1.02 - i * 0.07, 0.305);
      g.add(btn);
    }
    // Right chest pocket outline
    const pocketOutline = mesh(new THREE.BoxGeometry(0.10, 0.082, 0.006), seamM);
    pocketOutline.position.set(0.13, 0.86, 0.302);
    g.add(pocketOutline);
    const pocketInner = mesh(new THREE.BoxGeometry(0.092, 0.072, 0.004), topM);
    pocketInner.position.set(0.13, 0.86, 0.305);
    g.add(pocketInner);
  }

  // Summer outfit: shoulder straps + waist tie
  if (outfit === 'summer') {
    const strapM = mat(OUTFIT_ACC.summer, { roughness: 0.68 });
    for (const sx of [-1, 1]) {
      const strap = mesh(new THREE.BoxGeometry(0.05, 0.30, 0.026), strapM);
      strap.position.set(sx * 0.16, 0.96, 0.22);
      strap.rotation.x = -0.4;
      g.add(strap);
    }
    const waistTie = mesh(new THREE.TorusGeometry(0.30, 0.018, 4, 16), strapM);
    waistTie.position.set(0, 0.52, 0);
    waistTie.rotation.x = Math.PI / 2;
    g.add(waistTie);
  }

  // Winter outfit: puffy quilt rings + tall collar + zipper + arm seam stitching
  if (outfit === 'winter') {
    const puffM = mat(topHex, { roughness: 0.84 });
    for (let i = 0; i < 4; i++) {
      const ring = mesh(new THREE.TorusGeometry(0.30, 0.022, 4, 18), puffM);
      ring.position.set(0, 0.50 + i * 0.16, 0);
      ring.rotation.x = Math.PI / 2;
      g.add(ring);
    }
    const wCollar = mesh(new THREE.CylinderGeometry(0.15, 0.18, 0.14, 12, 1, true), puffM);
    wCollar.position.set(0, 1.10, 0);
    g.add(wCollar);
    // Front zipper
    const wZip = mesh(new THREE.BoxGeometry(0.018, 0.62, 0.024), mat(0xC0C0C0, { metalness: 0.5 }));
    wZip.position.set(0, 0.78, 0.305);
    g.add(wZip);
    // Zipper pull
    const pull = mesh(new THREE.BoxGeometry(0.04, 0.022, 0.012), mat(0x9CA3AF, { metalness: 0.4 }));
    pull.position.set(0, 1.04, 0.32);
    g.add(pull);
    // Arm puff rings (sleeve quilting)
    for (const sx of [-1, 1]) {
      for (let i = 0; i < 2; i++) {
        const ring = mesh(new THREE.TorusGeometry(0.082, 0.014, 4, 12), puffM);
        ring.position.set(sx * (0.50 + i * 0.10), 0.74 - i * 0.18, 0);
        ring.rotation.y = Math.PI / 2;
        ring.rotation.z = sx * 0.27;
        g.add(ring);
      }
    }
  }

  // Adventure: chest harness + utility loops
  if (outfit === 'adventure') {
    const harnessM = mat(0x44403C, { roughness: 0.6 });
    for (const sx of [-1, 1]) {
      const strap = mesh(new THREE.BoxGeometry(0.04, 0.48, 0.022), harnessM);
      strap.position.set(sx * 0.10, 0.86, 0.295);
      strap.rotation.z = sx * 0.1;
      g.add(strap);
    }
    const buckle = mesh(new THREE.BoxGeometry(0.06, 0.06, 0.025), mat(0xC0C0C0, { metalness: 0.5 }));
    buckle.position.set(0, 0.82, 0.30);
    g.add(buckle);
    // Utility pouches on belt
    for (const sx of [-1, 1]) {
      const pouch = mesh(new THREE.BoxGeometry(0.10, 0.08, 0.05), mat(0x57534E, { roughness: 0.7 }));
      pouch.position.set(sx * 0.18, 0.50, 0.27);
      g.add(pouch);
    }
  }

  // ── COMMON OUTFIT DETAILS ── seams + hem applied to every garment
  // (skipped for skin-only outfits where torso would otherwise stay bare)
  const skipCommonSeam = ['ninja'].includes(outfit);
  if (!skipCommonSeam) {
    // Bottom hem ring at waist
    const hem = mesh(new THREE.TorusGeometry(0.305, 0.013, 5, 18), seamM);
    hem.position.set(0, 0.43, 0);
    hem.rotation.x = Math.PI / 2;
    g.add(hem);
    // Subtle shoulder yoke highlight on each shoulder cap
    for (const sx of [-1, 1]) {
      const sShine = mesh(new THREE.SphereGeometry(0.08, 8, 6), highlightM);
      sShine.scale.set(0.9, 0.32, 0.66);
      sShine.position.set(sx * 0.36, 1.085, 0.06);
      g.add(sShine);
    }
    // Side seam — thin vertical line down each torso side
    for (const sx of [-1, 1]) {
      const sideSeam = mesh(new THREE.BoxGeometry(0.006, 0.62, 0.01), seamM);
      sideSeam.position.set(sx * 0.298, 0.74, 0);
      g.add(sideSeam);
    }
  }

  // ── PATCHES ── flag patches of visited countries on front-left chest
  if (visitedIso.length) {
    g.add(buildPatches(visitedIso));
  }

  // ── SHOULDERS ── flattened spheres → deltoid silhouette, not round balls
  for (const sx of [-1, 1]) {
    const sho = mesh(new THREE.SphereGeometry(0.152, 10, 10), topM);
    sho.scale.set(1.0, 0.60, 0.88);
    sho.position.set(sx * 0.37, 1.04, 0);
    g.add(sho);
  }

  // ── ARMS ── increased taper shoulder→elbow and elbow→wrist
  const armTopM = ['explorer','summer','beach'].includes(outfit) ? skinM : topM;
  for (const sx of [-1, 1]) {
    const ua = mesh(new THREE.CylinderGeometry(0.104, 0.076, 0.38, 10), armTopM);
    ua.position.set(sx * 0.49, 0.82, 0);
    ua.rotation.z = sx * 0.27;
    g.add(ua);
    const fa = mesh(new THREE.CylinderGeometry(0.080, 0.056, 0.36, 10), skinM);
    fa.position.set(sx * 0.62, 0.5, 0);
    fa.rotation.z = sx * 0.17;
    g.add(fa);
    // Hand: slightly flattened palm shape
    const hand = mesh(new THREE.SphereGeometry(0.082, 10, 10), skinM);
    hand.scale.set(1.0, 0.76, 0.86);
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
  // HAIR — all geometry sits outside head sphere (r=0.32).
  //
  // Cap math: SphereGeometry thetaLength PI*0.31 (55.8° from crown).
  //   Front bottom edge: y = 0.338*cos(55.8°) = 0.190  → above eyebrows (y≈0.128) ✓
  //                      z = 0.338*sin(55.8°) = 0.280  → behind eyebrows (z=0.286) ✓
  // This eliminates the cap-over-forehead clipping entirely.
  // ──────────────────────────────────────────────────────────────────────────
  if (hair !== 'bald') {
    // ── SCALP BASE ── full hair-colored under-layer that prevents bald patches
    // from any angle. Slight backward offset hides the front edge behind the face.
    const scalpBase = mesh(
      new THREE.SphereGeometry(0.327, 18, 14, 0, Math.PI * 2, 0, Math.PI * 0.55),
      hairM,
    );
    scalpBase.scale.set(fsx, fsy, fsz);
    scalpBase.position.set(0, 0, -0.018 * fsz);
    headGroup.add(scalpBase);

    // Bridge piece — fills the upper back gap between cap edge and back coverage
    const skullBridge = mesh(new THREE.SphereGeometry(0.18, 12, 10), hairM);
    skullBridge.scale.set(1.45, 0.78, 0.55);
    skullBridge.position.set(0, 0.13, -0.20);
    headGroup.add(skullBridge);

    // Shared top dome — sits above hairline, never touches forehead/eyes
    const capR     = 0.338;
    const capAngle = Math.PI * 0.31;
    const cap = mesh(
      new THREE.SphereGeometry(capR, 16, 10, 0, Math.PI * 2, 0, capAngle),
      hairM,
    );
    headGroup.add(cap);

    if (hair === 'short') {
      // Side pieces fill from cap edge (y≈0.19) down to ear level (y≈0)
      for (const sx of [-1, 1]) {
        const side = mesh(new THREE.SphereGeometry(0.138, 10, 8), hairM);
        side.scale.set(0.54, 0.88, 0.74);
        side.position.set(sx * 0.303, 0.07, -0.03);
        headGroup.add(side);
      }
      // Back coverage from nape to cap
      const back = mesh(new THREE.SphereGeometry(0.200, 10, 8), hairM);
      back.scale.set(1.32, 0.70, 0.64);
      back.position.set(0, 0.01, -0.268);
      headGroup.add(back);
    }

    if (hair === 'long') {
      // Temple bridges: connect cap seamlessly to long side strands
      for (const sx of [-1, 1]) {
        const temple = mesh(new THREE.SphereGeometry(0.128, 10, 8), hairM);
        temple.scale.set(0.58, 1.06, 0.72);
        temple.position.set(sx * 0.308, 0.04, -0.02);
        headGroup.add(temple);
        // Long draping strand — x=0.352 clears head equator (r=0.32) ✓
        const strand = mesh(new THREE.CylinderGeometry(0.086, 0.050, 0.54, 8), hairM);
        strand.position.set(sx * 0.352, -0.38, -0.04);
        headGroup.add(strand);
      }
      // Back upper mass bridges cap to curtain
      const backUpper = mesh(new THREE.SphereGeometry(0.210, 10, 8), hairM);
      backUpper.scale.set(1.28, 0.74, 0.74);
      backUpper.position.set(0, -0.01, -0.278);
      headGroup.add(backUpper);
      // Back curtain
      const backCurtain = mesh(new THREE.CylinderGeometry(0.175, 0.098, 0.50, 10), hairM);
      backCurtain.position.set(0, -0.32, -0.298);
      headGroup.add(backCurtain);
    }

    if (hair === 'curly') {
      // All positions verified outside head sphere (r=0.32)
      const curlPos: [number, number, number][] = [
        [-0.38, 0.22, 0.02], [ 0.38, 0.22, 0.02],  // sides upper
        [-0.42, 0.02, 0.01], [ 0.42, 0.02, 0.01],  // sides mid
        [-0.22, 0.30,-0.19], [ 0.22, 0.30,-0.19],  // back-upper diagonal
        [  0,   0.36, 0.04],                         // crown
        [-0.29,-0.06,-0.30], [ 0.29,-0.06,-0.30],  // back lower
        [  0,   0.08,-0.34],                         // back mid
      ];
      for (const [x, y, z] of curlPos) {
        const curl = mesh(new THREE.SphereGeometry(0.108, 10, 10), hairM);
        curl.position.set(x, y, z);
        headGroup.add(curl);
      }
    }

    if (hair === 'ponytail') {
      // Neat side pieces (keeps temples tidy)
      for (const sx of [-1, 1]) {
        const side = mesh(new THREE.SphereGeometry(0.120, 10, 8), hairM);
        side.scale.set(0.52, 0.82, 0.70);
        side.position.set(sx * 0.296, 0.06, -0.02);
        headGroup.add(side);
      }
      // Back volume anchors the tail
      const backV = mesh(new THREE.SphereGeometry(0.182, 10, 8), hairM);
      backV.scale.set(1.30, 0.68, 0.70);
      backV.position.set(0, -0.01, -0.272);
      headGroup.add(backV);
      // Band — z=-0.335 clears head sphere at y=-0.09 (head z-extent=0.306 there) ✓
      const band = mesh(new THREE.TorusGeometry(0.068, 0.022, 6, 12), mat(0xDC2626, { roughness: 0.62 }));
      band.position.set(0, -0.09, -0.335);
      band.rotation.x = Math.PI / 2;
      headGroup.add(band);
      // Ponytail
      const tail = mesh(new THREE.CylinderGeometry(0.066, 0.038, 0.48, 8), hairM);
      tail.position.set(0, -0.22, -0.348);
      tail.rotation.x = 0.48;
      headGroup.add(tail);
    }

    if (hair === 'loose') {
      // Loose flowing hair — soft volume on sides + slightly outward sweep
      for (const sx of [-1, 1]) {
        const temple = mesh(new THREE.SphereGeometry(0.140, 10, 8), hairM);
        temple.scale.set(0.62, 1.10, 0.78);
        temple.position.set(sx * 0.310, 0.03, -0.03);
        headGroup.add(temple);
        // Two flowing strands per side, slight outward angle
        const strand1 = mesh(new THREE.CylinderGeometry(0.082, 0.044, 0.52, 8), hairM);
        strand1.position.set(sx * 0.350, -0.36, -0.04);
        strand1.rotation.z = sx * 0.06;
        headGroup.add(strand1);
        const strand2 = mesh(new THREE.CylinderGeometry(0.062, 0.034, 0.46, 8), hairM);
        strand2.position.set(sx * 0.298, -0.40, 0.06);
        strand2.rotation.z = sx * -0.10;
        headGroup.add(strand2);
      }
      const backUpper = mesh(new THREE.SphereGeometry(0.215, 10, 8), hairM);
      backUpper.scale.set(1.30, 0.78, 0.78);
      backUpper.position.set(0, 0, -0.282);
      headGroup.add(backUpper);
      const backLower = mesh(new THREE.CylinderGeometry(0.180, 0.108, 0.46, 12), hairM);
      backLower.position.set(0, -0.30, -0.292);
      headGroup.add(backLower);
    }

    if (hair === 'braid') {
      // Braid (плитка) — tied at the back with stacked spheres for woven look
      for (const sx of [-1, 1]) {
        const side = mesh(new THREE.SphereGeometry(0.122, 10, 8), hairM);
        side.scale.set(0.52, 0.86, 0.70);
        side.position.set(sx * 0.298, 0.05, -0.02);
        headGroup.add(side);
      }
      const backV = mesh(new THREE.SphereGeometry(0.190, 10, 8), hairM);
      backV.scale.set(1.30, 0.74, 0.72);
      backV.position.set(0, -0.005, -0.276);
      headGroup.add(backV);
      // Braid: 5 stacked overlapping spheres going down from nape
      const braidStartY = -0.13;
      const braidStep   = 0.092;
      for (let i = 0; i < 5; i++) {
        const segR = 0.078 - i * 0.008;
        const seg  = mesh(new THREE.SphereGeometry(segR, 10, 10), hairM);
        // Slight zig-zag offset gives woven illusion
        seg.position.set((i % 2 === 0 ? 0.018 : -0.018), braidStartY - i * braidStep, -0.34 - i * 0.01);
        headGroup.add(seg);
      }
      // Tie band at top of braid
      const band = mesh(new THREE.TorusGeometry(0.062, 0.020, 6, 12), mat(0xDC2626, { roughness: 0.62 }));
      band.position.set(0, braidStartY + 0.05, -0.336);
      band.rotation.x = Math.PI / 2;
      headGroup.add(band);
    }

    if (hair === 'tied') {
      // Tied hair — sleek pulled-back style with bun at the back
      for (const sx of [-1, 1]) {
        const side = mesh(new THREE.SphereGeometry(0.108, 10, 8), hairM);
        side.scale.set(0.46, 0.74, 0.66);
        side.position.set(sx * 0.288, 0.06, -0.04);
        headGroup.add(side);
      }
      const back = mesh(new THREE.SphereGeometry(0.178, 10, 8), hairM);
      back.scale.set(1.24, 0.74, 0.62);
      back.position.set(0, 0.02, -0.262);
      headGroup.add(back);
      // Bun
      const bun = mesh(new THREE.SphereGeometry(0.118, 12, 12), hairM);
      bun.position.set(0, -0.02, -0.388);
      headGroup.add(bun);
      // Wrap band around bun
      const bunBand = mesh(new THREE.TorusGeometry(0.118, 0.018, 6, 16), mat(0xDC2626, { roughness: 0.62 }));
      bunBand.position.set(0, -0.02, -0.388);
      bunBand.rotation.y = Math.PI / 2;
      headGroup.add(bunBand);
    }

    if (hair === 'longest') {
      // Longer flowing hair — reaches well past shoulders with bottom flare
      for (const sx of [-1, 1]) {
        const temple = mesh(new THREE.SphereGeometry(0.130, 10, 8), hairM);
        temple.scale.set(0.60, 1.08, 0.74);
        temple.position.set(sx * 0.308, 0.04, -0.02);
        headGroup.add(temple);
        const strand = mesh(new THREE.CylinderGeometry(0.094, 0.072, 0.78, 10), hairM);
        strand.position.set(sx * 0.354, -0.50, -0.04);
        headGroup.add(strand);
      }
      const backUpper = mesh(new THREE.SphereGeometry(0.218, 10, 8), hairM);
      backUpper.scale.set(1.32, 0.78, 0.78);
      backUpper.position.set(0, -0.01, -0.282);
      headGroup.add(backUpper);
      // Long curtain to mid-back
      const backCurtain = mesh(new THREE.CylinderGeometry(0.190, 0.120, 0.78, 12), hairM);
      backCurtain.position.set(0, -0.50, -0.302);
      headGroup.add(backCurtain);
      // Bottom flare
      const flare = mesh(new THREE.CylinderGeometry(0.125, 0.180, 0.16, 12), hairM);
      flare.position.set(0, -0.92, -0.302);
      headGroup.add(flare);
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

// ── Illustrated background scenes ────────────────────────────────────────────
// Each painter draws a full scene to a portrait off-screen canvas; the result
// is uploaded as a CanvasTexture and cross-faded between scene changes.
const SCENE_W = 256;
const SCENE_H = 512;

function paintScene(c: HTMLCanvasElement, key: string) {
  const ctx = c.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, c.width, c.height);
  switch (key) {
    case 'beach':    paintBeach(ctx, c.width, c.height); break;
    case 'mountain': paintMountain(ctx, c.width, c.height); break;
    case 'city':     paintCity(ctx, c.width, c.height); break;
    case 'home':     paintHome(ctx, c.width, c.height); break;
    case 'forest':   paintForest(ctx, c.width, c.height); break;
    case 'sunset':   paintSunset(ctx, c.width, c.height); break;
    case 'space':    paintSpace(ctx, c.width, c.height); break;
    case 'studio':
    default:         paintStudio(ctx, c.width, c.height);
  }
}

function paintStudio(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#F1F5F9');
  grad.addColorStop(1, '#94A3B8');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  // Soft floor curve
  const floor = ctx.createLinearGradient(0, h * 0.62, 0, h);
  floor.addColorStop(0, 'rgba(100,116,139,0.22)');
  floor.addColorStop(1, 'rgba(30,41,59,0.55)');
  ctx.fillStyle = floor; ctx.fillRect(0, h * 0.62, w, h * 0.38);
  // Vignette
  const vg = ctx.createRadialGradient(w * 0.5, h * 0.5, h * 0.2, w * 0.5, h * 0.5, h * 0.7);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.35)');
  ctx.fillStyle = vg; ctx.fillRect(0, 0, w, h);
}

function paintBeach(ctx: CanvasRenderingContext2D, w: number, h: number) {
  let grad = ctx.createLinearGradient(0, 0, 0, h * 0.55);
  grad.addColorStop(0, '#7DD3FC'); grad.addColorStop(1, '#FBCFE8');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h * 0.55);
  // Sun
  ctx.fillStyle = 'rgba(254,243,199,0.45)';
  ctx.beginPath(); ctx.arc(w * 0.78, h * 0.18, 56, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FDE68A';
  ctx.beginPath(); ctx.arc(w * 0.78, h * 0.18, 30, 0, Math.PI * 2); ctx.fill();
  // Clouds
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (const [cx, cy, cr] of [[60, 70, 16], [110, 90, 22], [180, 60, 18]] as [number, number, number][]) {
    ctx.beginPath(); ctx.arc(cx, cy, cr, 0, Math.PI * 2);
    ctx.arc(cx + cr, cy + 4, cr * 0.78, 0, Math.PI * 2);
    ctx.arc(cx - cr * 0.7, cy + 4, cr * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  // Ocean
  grad = ctx.createLinearGradient(0, h * 0.55, 0, h * 0.78);
  grad.addColorStop(0, '#0EA5E9'); grad.addColorStop(1, '#0369A1');
  ctx.fillStyle = grad; ctx.fillRect(0, h * 0.55, w, h * 0.23);
  // Wave highlights
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 1.4;
  for (let i = 0; i < 6; i++) {
    const y = h * 0.57 + i * 6;
    ctx.beginPath();
    for (let x = 0; x <= w; x += 8) ctx.lineTo(x, y + Math.sin(x * 0.1 + i) * 2);
    ctx.stroke();
  }
  // Sand
  grad = ctx.createLinearGradient(0, h * 0.78, 0, h);
  grad.addColorStop(0, '#FCD34D'); grad.addColorStop(1, '#D97706');
  ctx.fillStyle = grad; ctx.fillRect(0, h * 0.78, w, h * 0.22);
  // Palm
  ctx.strokeStyle = '#78350F'; ctx.lineWidth = 8; ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(w * 0.92, h * 0.85);
  ctx.quadraticCurveTo(w * 0.99, h * 0.6, w * 0.86, h * 0.4);
  ctx.stroke();
  ctx.fillStyle = '#15803D';
  for (let i = 0; i < 7; i++) {
    const angle = (i / 7) * Math.PI * 2;
    ctx.save(); ctx.translate(w * 0.86, h * 0.4); ctx.rotate(angle);
    ctx.beginPath(); ctx.ellipse(0, -28, 12, 36, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function paintMountain(ctx: CanvasRenderingContext2D, w: number, h: number) {
  let grad = ctx.createLinearGradient(0, 0, 0, h * 0.5);
  grad.addColorStop(0, '#A5B4FC'); grad.addColorStop(1, '#E0E7FF');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h * 0.5);
  // Sun glow
  ctx.fillStyle = 'rgba(252,243,207,0.4)';
  ctx.beginPath(); ctx.arc(w * 0.7, h * 0.16, 44, 0, Math.PI * 2); ctx.fill();
  // Far mountains
  ctx.fillStyle = '#64748B';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.55);
  for (let i = 0; i <= 8; i++) {
    const x = (i / 8) * w;
    const y = h * 0.5 - Math.sin(i * 1.3) * 28 - 10;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(w, h * 0.55); ctx.closePath(); ctx.fill();
  // Near peaks
  const peaks: [number, number][] = [[0.08, 0.42], [0.32, 0.30], [0.55, 0.36], [0.80, 0.28]];
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.moveTo(0, h * 0.66);
  for (const [px, py] of peaks) {
    const x = px * w, y = py * h;
    ctx.lineTo(x - 56, h * 0.66);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 56, h * 0.66);
  }
  ctx.lineTo(w, h * 0.66); ctx.closePath(); ctx.fill();
  // Snow
  ctx.fillStyle = '#F8FAFC';
  for (const [px, py] of peaks) {
    const x = px * w, y = py * h;
    ctx.beginPath();
    ctx.moveTo(x - 16, y + 22);
    ctx.lineTo(x, y);
    ctx.lineTo(x + 16, y + 22);
    ctx.lineTo(x + 8, y + 26);
    ctx.lineTo(x - 8, y + 26);
    ctx.closePath(); ctx.fill();
  }
  // Pine forest foreground
  grad = ctx.createLinearGradient(0, h * 0.66, 0, h);
  grad.addColorStop(0, '#65A30D'); grad.addColorStop(1, '#1A2E05');
  ctx.fillStyle = grad; ctx.fillRect(0, h * 0.66, w, h * 0.34);
  ctx.fillStyle = '#14532D';
  for (let i = 0; i < 14; i++) {
    const x = i * (w / 14) + Math.random() * 8;
    const baseY = h * 0.7 + Math.random() * 6;
    ctx.beginPath();
    ctx.moveTo(x - 9, baseY); ctx.lineTo(x, baseY - 28); ctx.lineTo(x + 9, baseY);
    ctx.closePath(); ctx.fill();
  }
}

function paintCity(ctx: CanvasRenderingContext2D, w: number, h: number) {
  let grad = ctx.createLinearGradient(0, 0, 0, h * 0.65);
  grad.addColorStop(0, '#FCA5A5'); grad.addColorStop(0.5, '#F472B6'); grad.addColorStop(1, '#312E81');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h * 0.65);
  // Distant building silhouettes
  ctx.fillStyle = '#1E1B4B';
  const farBuildings: [number, number, number][] = [
    [0.04, 0.46, 0.10], [0.16, 0.40, 0.12], [0.28, 0.50, 0.09],
    [0.40, 0.36, 0.13], [0.54, 0.28, 0.14], [0.68, 0.42, 0.10],
    [0.80, 0.38, 0.10], [0.92, 0.46, 0.09],
  ];
  for (const [bx, top, wd] of farBuildings) {
    const bw = wd * w;
    ctx.fillRect(bx * w - bw / 2, top * h, bw, h * 0.65 - top * h);
  }
  // Window dots (warm)
  for (let i = 0; i < 90; i++) {
    const x = Math.random() * w;
    const y = h * 0.32 + Math.random() * h * 0.32;
    ctx.fillStyle = Math.random() > 0.7 ? '#F59E0B' : '#FCD34D';
    ctx.fillRect(x, y, 2.2, 2.2);
  }
  // Antenna lights
  ctx.fillStyle = '#EF4444';
  for (const [bx, top] of farBuildings) {
    if (Math.random() > 0.5) ctx.fillRect(bx * w, top * h - 8, 1.5, 1.5);
  }
  // Foreground street
  grad = ctx.createLinearGradient(0, h * 0.65, 0, h);
  grad.addColorStop(0, '#0F172A'); grad.addColorStop(1, '#020617');
  ctx.fillStyle = grad; ctx.fillRect(0, h * 0.65, w, h * 0.35);
  // Street markings
  ctx.fillStyle = '#FCD34D';
  for (let i = 0; i < 5; i++) ctx.fillRect(w * 0.5 - 6, h * 0.74 + i * 28, 12, 8);
}

function paintHome(ctx: CanvasRenderingContext2D, w: number, h: number) {
  // Wall
  let grad = ctx.createLinearGradient(0, 0, 0, h * 0.7);
  grad.addColorStop(0, '#FED7AA'); grad.addColorStop(1, '#FDBA74');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h * 0.7);
  // Window with sky outside
  const wx = w * 0.66, wy = h * 0.16, ww = w * 0.26, wh = h * 0.32;
  const sky = ctx.createLinearGradient(wx, wy, wx, wy + wh);
  sky.addColorStop(0, '#7DD3FC'); sky.addColorStop(1, '#FBCFE8');
  ctx.fillStyle = sky; ctx.fillRect(wx, wy, ww, wh);
  // Window mullions
  ctx.strokeStyle = '#7C2D12'; ctx.lineWidth = 6;
  ctx.strokeRect(wx, wy, ww, wh);
  ctx.beginPath();
  ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
  ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
  ctx.stroke();
  // Picture frame on left wall
  ctx.fillStyle = '#92400E';
  ctx.fillRect(w * 0.08, h * 0.18, w * 0.16, h * 0.18);
  ctx.fillStyle = '#FBBF24';
  ctx.fillRect(w * 0.094, h * 0.195, w * 0.132, h * 0.150);
  // Sofa silhouette
  ctx.fillStyle = '#7F1D1D';
  ctx.fillRect(w * 0.04, h * 0.56, w * 0.42, h * 0.14);
  ctx.fillRect(w * 0.04, h * 0.50, w * 0.10, h * 0.20);
  ctx.fillRect(w * 0.36, h * 0.50, w * 0.10, h * 0.20);
  // Floor
  grad = ctx.createLinearGradient(0, h * 0.7, 0, h);
  grad.addColorStop(0, '#92400E'); grad.addColorStop(1, '#451A03');
  ctx.fillStyle = grad; ctx.fillRect(0, h * 0.7, w, h * 0.3);
  // Floor planks
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
  for (let i = 1; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(0, h * 0.7 + i * h * 0.06); ctx.lineTo(w, h * 0.7 + i * h * 0.06);
    ctx.stroke();
  }
}

function paintForest(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#86EFAC'); grad.addColorStop(0.45, '#15803D'); grad.addColorStop(1, '#052E16');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  // Canopy clusters at top
  ctx.fillStyle = 'rgba(20,83,45,0.85)';
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.arc((i / 14) * w + Math.random() * 16, Math.random() * h * 0.28, 30 + Math.random() * 18, 0, Math.PI * 2);
    ctx.fill();
  }
  // Tree trunks (back layer)
  ctx.fillStyle = '#3F2A14';
  for (const tx of [0.06, 0.23, 0.48, 0.65, 0.86]) {
    ctx.fillRect(tx * w - 4, 0, 8, h);
  }
  // Tree trunks (front layer with bark line)
  ctx.fillStyle = '#451A03';
  for (const tx of [0.13, 0.34, 0.58, 0.78]) {
    ctx.fillRect(tx * w - 7, 0, 14, h);
    ctx.fillStyle = '#1C0A01'; ctx.fillRect(tx * w - 1, 0, 2, h);
    ctx.fillStyle = '#451A03';
  }
  // Light beams through canopy
  ctx.fillStyle = 'rgba(254,243,199,0.10)';
  for (let i = 0; i < 5; i++) {
    const x = (i / 5) * w + 18;
    ctx.beginPath();
    ctx.moveTo(x, 0); ctx.lineTo(x + 80, h); ctx.lineTo(x + 110, h); ctx.lineTo(x + 30, 0);
    ctx.closePath(); ctx.fill();
  }
  // Forest floor leaves
  ctx.fillStyle = '#65A30D';
  for (let i = 0; i < 60; i++) {
    ctx.beginPath();
    ctx.ellipse(Math.random() * w, h * 0.85 + Math.random() * h * 0.14, 4, 2, Math.random() * Math.PI, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintSunset(ctx: CanvasRenderingContext2D, w: number, h: number) {
  let grad = ctx.createLinearGradient(0, 0, 0, h * 0.6);
  grad.addColorStop(0, '#7C3AED'); grad.addColorStop(0.5, '#F472B6'); grad.addColorStop(1, '#FB923C');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h * 0.6);
  // Sun glow
  ctx.fillStyle = 'rgba(252,211,77,0.35)';
  ctx.beginPath(); ctx.arc(w * 0.5, h * 0.6, 100, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#FB923C';
  ctx.beginPath(); ctx.arc(w * 0.5, h * 0.6, 52, 0, Math.PI * 2); ctx.fill();
  // Cloud streaks
  ctx.fillStyle = 'rgba(126,34,206,0.55)';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.36 + i * 24, 90 + i * 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // Ocean
  grad = ctx.createLinearGradient(0, h * 0.6, 0, h);
  grad.addColorStop(0, '#7C3AED'); grad.addColorStop(1, '#1E1B4B');
  ctx.fillStyle = grad; ctx.fillRect(0, h * 0.6, w, h * 0.4);
  // Reflection
  ctx.fillStyle = 'rgba(251,146,60,0.45)';
  for (let i = 0; i < 8; i++) {
    const y = h * 0.62 + i * 12;
    const wsh = 12 + i * 12;
    ctx.beginPath();
    ctx.ellipse(w * 0.5, y, wsh, 3 + i * 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function paintSpace(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, '#0B0F2D'); grad.addColorStop(1, '#000000');
  ctx.fillStyle = grad; ctx.fillRect(0, 0, w, h);
  // Stars
  for (let i = 0; i < 110; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = Math.random() * 1.6 + 0.4;
    ctx.fillStyle = `rgba(255,255,255,${0.45 + Math.random() * 0.55})`;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  }
  // Nebula tint
  const neb = ctx.createRadialGradient(w * 0.3, h * 0.4, 12, w * 0.3, h * 0.4, 140);
  neb.addColorStop(0, 'rgba(168,85,247,0.35)'); neb.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = neb; ctx.fillRect(0, 0, w, h);
  // Distant planet with ring
  const px = w * 0.78, py = h * 0.22;
  const pgrad = ctx.createRadialGradient(px - 14, py - 10, 4, px, py, 42);
  pgrad.addColorStop(0, '#60A5FA'); pgrad.addColorStop(0.6, '#1D4ED8'); pgrad.addColorStop(1, '#172554');
  ctx.fillStyle = pgrad;
  ctx.beginPath(); ctx.arc(px, py, 38, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(252,211,77,0.55)';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(px, py, 60, 12, -0.4, 0, Math.PI * 2);
  ctx.stroke();
}

// ── Component ────────────────────────────────────────────────────────────────
interface Props {
  avatar: Partial<AvatarConfig>;
  width?: number;
  height?: number;
  /** Override expression — used by quiz page to show reaction */
  expression?: Expression;
  /** Background scene key — one of BACKGROUND_KEYS */
  background?: string;
  /** Optional outfit color override — affects main + bot shades */
  outfitColor?: string;
  /** ISO-2 codes of countries the user has visited — rendered as flag patches */
  visitedIsoCodes?: string[];
}

// Available illustrated background scenes
export const BACKGROUND_KEYS = ['studio','beach','mountain','city','home','forest','sunset','space'] as const;

export default function Avatar3D({
  avatar, width = 220, height = 300,
  expression: expressionProp, background = 'studio',
  outfitColor, visitedIsoCodes,
}: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const rendererRef  = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef     = useRef<THREE.Scene | null>(null);
  const characterRef = useRef<THREE.Group | null>(null);
  const partsRef     = useRef<CharacterParts | null>(null);
  const rafRef       = useRef<number>(0);
  const rotYRef      = useRef(0);
  const isDragRef    = useRef(false);
  const lastXRef     = useRef(0);
  // Background scene refs — illustrated cross-fade between scenes
  const bgCanvasRef   = useRef<HTMLCanvasElement | null>(null);  // visible composite
  const bgFromCanvasRef = useRef<HTMLCanvasElement | null>(null); // previous scene
  const bgToCanvasRef = useRef<HTMLCanvasElement | null>(null);   // target scene
  const bgTextureRef  = useRef<THREE.CanvasTexture | null>(null);
  const bgMixRef      = useRef(1); // 1 = fully on "to"
  const bgKeyRef      = useRef('studio');

  // Idle animation refs
  const lastTRef      = useRef(0);
  const breathRef     = useRef(0);
  const headBobRef    = useRef(0);
  const blinkTimerRef = useRef(0);
  const nextBlinkRef  = useRef(2.5 + Math.random() * 3);
  const blinkPhaseRef = useRef(-1); // -1 = idle, ≥0 = animating

  const effectiveExpression: Expression = expressionProp ?? avatar.expression ?? 'smile';
  const effectiveFaceType: FaceType     = avatar.faceType ?? 'standard';

  const visitedIsoMemo = useMemo(() => visitedIsoCodes ?? [], [visitedIsoCodes]);

  const avatarKey = useMemo(() => [
    avatar.hairStyle, avatar.hairColor, avatar.eyeColor,
    avatar.skinColor, avatar.outfit, avatar.user,
    effectiveFaceType, effectiveExpression,
    outfitColor ?? '',
    visitedIsoMemo.join('|'),
    ...(avatar.accessories ?? []),
  ].join(','), [avatar, effectiveFaceType, effectiveExpression, outfitColor, visitedIsoMemo]);

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

    // Background — CanvasTexture cross-faded between illustrated scenes
    const bgCanvas = document.createElement('canvas');
    bgCanvas.width = SCENE_W; bgCanvas.height = SCENE_H;
    const bgFrom = document.createElement('canvas');
    bgFrom.width = SCENE_W; bgFrom.height = SCENE_H;
    const bgTo = document.createElement('canvas');
    bgTo.width = SCENE_W; bgTo.height = SCENE_H;
    const bgTex = new THREE.CanvasTexture(bgCanvas);
    bgTex.colorSpace = THREE.SRGBColorSpace;
    bgCanvasRef.current     = bgCanvas;
    bgFromCanvasRef.current = bgFrom;
    bgToCanvasRef.current   = bgTo;
    bgTextureRef.current    = bgTex;
    bgKeyRef.current        = background;
    paintScene(bgTo, background);
    paintScene(bgFrom, background);
    bgCanvas.getContext('2d')!.drawImage(bgTo, 0, 0);
    bgMixRef.current = 1;
    bgTex.needsUpdate = true;
    scene.background = bgTex;

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

    const { group: char, parts } = buildCharacter(avatar, effectiveExpression, effectiveFaceType, outfitColor, visitedIsoMemo);
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

      // Cross-fade between illustrated background scenes
      const bgC    = bgCanvasRef.current;
      const bgFrom = bgFromCanvasRef.current;
      const bgTo   = bgToCanvasRef.current;
      const bgT    = bgTextureRef.current;
      if (bgC && bgFrom && bgTo && bgT && bgMixRef.current < 1) {
        bgMixRef.current = Math.min(1, bgMixRef.current + dt * 1.6); // ~0.6s
        const ctx = bgC.getContext('2d')!;
        ctx.globalAlpha = 1; ctx.clearRect(0, 0, SCENE_W, SCENE_H);
        ctx.drawImage(bgFrom, 0, 0);
        ctx.globalAlpha = bgMixRef.current;
        ctx.drawImage(bgTo, 0, 0);
        ctx.globalAlpha = 1;
        bgT.needsUpdate = true;
      }

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
    const { group: char, parts } = buildCharacter(avatar, effectiveExpression, effectiveFaceType, outfitColor, visitedIsoMemo);
    scene.add(char);
    char.rotation.y      = rotYRef.current;
    characterRef.current = char;
    partsRef.current     = parts;
    blinkPhaseRef.current = -1;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarKey]);

  // Cross-fade to a new scene when the background prop changes
  useEffect(() => {
    if (background === bgKeyRef.current) return;
    const bgC    = bgCanvasRef.current;
    const bgFrom = bgFromCanvasRef.current;
    const bgTo   = bgToCanvasRef.current;
    if (!bgC || !bgFrom || !bgTo) return;
    // Snapshot current visible composite into "from"
    const fctx = bgFrom.getContext('2d');
    if (fctx) { fctx.clearRect(0, 0, SCENE_W, SCENE_H); fctx.drawImage(bgC, 0, 0); }
    paintScene(bgTo, background);
    bgMixRef.current = 0;
    bgKeyRef.current = background;
  }, [background]);

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
