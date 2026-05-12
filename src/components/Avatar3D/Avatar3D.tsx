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
  // ACCESSORIES — head-attached go into headGroup; body accessories into g
  // ──────────────────────────────────────────────────────────────────────────

  // Adaptive vertical offset so hats sit on top of hair rather than clipping
  const hairLift =
    hair === 'bald'                       ? 0.00 :
    hair === 'curly'                      ? 0.05 :
    hair === 'longest'                    ? 0.030 :
    hair === 'long' || hair === 'loose'   ? 0.020 :
                                            0.010;
  // Face-type Y scale (head sphere is scaled by FACE_SCALE[faceType][1])
  const faceY = FACE_SCALE[faceType]?.[1] ?? 1;
  // Bring face-mounted items just outside the head surface (in front of eyes).
  // Eyes sit at z=eyeZ=0.27, head surface at (x≈0.113, y≈0.03) is ~0.298.
  const faceFrontZ = eyeZ + 0.045;

  // ── HEAD ─────────────────────────────────────────────────────────────────

  // Winter hat / pompom beanie  (also matches legacy key 'hat')
  if (acc.includes('hat') || acc.includes('winter-hat')) {
    const beanieM = mat(0xDC2626, { roughness: 0.78 });
    const cuffM   = mat(0xB91C1C, { roughness: 0.74 });
    const baseY = 0.18 * faceY + hairLift;
    // Dome — half-sphere, bottom edge at hairline (above eyebrows)
    const bBody = mesh(new THREE.SphereGeometry(0.348, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), beanieM);
    bBody.position.set(0, baseY, 0);
    headGroup.add(bBody);
    // Rolled cuff fold — slightly wider, just below dome edge
    const bCuff = mesh(new THREE.CylinderGeometry(0.354, 0.350, 0.080, 18), cuffM);
    bCuff.position.set(0, baseY - 0.022, 0);
    headGroup.add(bCuff);
    // Subtle cuff seam (lighter highlight on top edge)
    const cuffSeam = mesh(new THREE.TorusGeometry(0.352, 0.005, 4, 22), mat(0xFCA5A5, { roughness: 0.72 }));
    cuffSeam.position.set(0, baseY + 0.018, 0);
    cuffSeam.rotation.x = Math.PI / 2;
    headGroup.add(cuffSeam);
    // 3 knit ribs running over the dome (smaller toward apex)
    for (let i = 0; i < 3; i++) {
      const fr = 1 - (i + 1) / 5;
      const rib = mesh(new THREE.TorusGeometry(0.336 * fr + 0.02, 0.010, 4, 22), mat(0xEF4444, { roughness: 0.74 }));
      rib.position.set(0, baseY + 0.06 + i * 0.085, 0);
      rib.rotation.x = Math.PI / 2;
      headGroup.add(rib);
    }
    // Pompom at top
    const pompom = mesh(new THREE.SphereGeometry(0.078, 12, 12), mat(0xFECACA, { roughness: 0.84 }));
    pompom.position.set(0, baseY + 0.36, 0);
    headGroup.add(pompom);
    // Pompom string base (small connector)
    const pompomBase = mesh(new THREE.CylinderGeometry(0.014, 0.012, 0.020, 6), beanieM);
    pompomBase.position.set(0, baseY + 0.32, 0);
    headGroup.add(pompomBase);
  }

  // Baseball cap (improved)
  if (acc.includes('cap')) {
    const capM = mat(0x1D4ED8, { roughness: 0.72 });
    const capDarkM = mat(0x1E3A5F, { roughness: 0.74 });
    const baseY = 0.16 * faceY + hairLift;
    // Cap dome (full half-sphere)
    const capDome = mesh(new THREE.SphereGeometry(0.348, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), capM);
    capDome.position.set(0, baseY, 0);
    headGroup.add(capDome);
    // Stitched seams running over the dome
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      const seamArc = mesh(new THREE.TorusGeometry(0.348, 0.0035, 3, 12, Math.PI * 0.5), mat(0x172554, { roughness: 0.74 }));
      seamArc.position.set(0, baseY, 0);
      seamArc.rotation.y = a;
      seamArc.rotation.z = Math.PI / 2;
      headGroup.add(seamArc);
    }
    // Sweatband (gold/contrast strip at base)
    const sweatband = mesh(new THREE.CylinderGeometry(0.350, 0.350, 0.034, 18), mat(0xFCD34D, { roughness: 0.68 }));
    sweatband.position.set(0, baseY - 0.018, 0);
    headGroup.add(sweatband);
    // Visor (top — main fabric)
    const visor = mesh(
      new THREE.CylinderGeometry(0.34, 0.38, 0.040, 16, 1, false, -Math.PI * 0.15, Math.PI * 0.8),
      capDarkM,
    );
    visor.position.set(0, baseY + 0.005, 0.30);
    visor.rotation.x = 0.30;
    headGroup.add(visor);
    // Visor underside (darker for depth)
    const visorUnder = mesh(
      new THREE.CylinderGeometry(0.32, 0.36, 0.022, 16, 1, false, -Math.PI * 0.15, Math.PI * 0.8),
      mat(0x172554, { roughness: 0.78 }),
    );
    visorUnder.position.set(0, baseY - 0.008, 0.305);
    visorUnder.rotation.x = 0.30;
    headGroup.add(visorUnder);
    // Top button on dome apex
    const capTopBtn = mesh(new THREE.SphereGeometry(0.024, 8, 8), capDarkM);
    capTopBtn.position.set(0, baseY + 0.348, 0);
    headGroup.add(capTopBtn);
  }

  // Explorer / fedora hat
  if (acc.includes('explorer-hat')) {
    const feltM = mat(0x78350F, { roughness: 0.82 });
    const baseY = 0.19 * faceY + hairLift;
    // Wide brim at hairline
    const hatBrim = mesh(new THREE.CylinderGeometry(0.52, 0.54, 0.05, 18), feltM);
    hatBrim.position.set(0, baseY, 0);
    headGroup.add(hatBrim);
    // Brim underside (darker)
    const brimUnder = mesh(new THREE.CylinderGeometry(0.48, 0.50, 0.020, 18), mat(0x451A03, { roughness: 0.84 }));
    brimUnder.position.set(0, baseY - 0.028, 0);
    headGroup.add(brimUnder);
    // Crown (cylinder) sitting on the brim
    const hatCrown = mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.30, 16), feltM);
    hatCrown.position.set(0, baseY + 0.18, 0);
    headGroup.add(hatCrown);
    // Domed top
    const hatDomeTop = mesh(new THREE.SphereGeometry(0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.5), feltM);
    hatDomeTop.position.set(0, baseY + 0.33, 0);
    headGroup.add(hatDomeTop);
    // Crown pinch (front dent)
    const pinch = mesh(new THREE.SphereGeometry(0.08, 8, 6), mat(0x5C2F0A, { roughness: 0.84 }));
    pinch.scale.set(0.7, 0.5, 1.2);
    pinch.position.set(0, baseY + 0.36, 0.10);
    headGroup.add(pinch);
    // Dark band
    const hatBand = mesh(new THREE.CylinderGeometry(0.245, 0.245, 0.07, 16), mat(0x1C1917, { roughness: 0.72 }));
    hatBand.position.set(0, baseY + 0.05, 0);
    headGroup.add(hatBand);
    // Gold buckle on band (front)
    const hatBuckle = mesh(new THREE.BoxGeometry(0.054, 0.044, 0.022), mat(0xFCD34D, { metalness: 0.46, roughness: 0.36 }));
    hatBuckle.position.set(0, baseY + 0.05, 0.248);
    headGroup.add(hatBuckle);
  }

  // Crown
  if (acc.includes('crown')) {
    const goldM2 = mat(0xFCD34D, { roughness: 0.36, metalness: 0.38 });
    const baseY = 0.22 * faceY + hairLift;
    const crownBase = mesh(new THREE.CylinderGeometry(0.36, 0.38, 0.10, 16), goldM2);
    crownBase.position.set(0, baseY, 0);
    headGroup.add(crownBase);
    const crownRidge = mesh(new THREE.CylinderGeometry(0.37, 0.37, 0.024, 16), mat(0xD97706, { metalness: 0.40, roughness: 0.40 }));
    crownRidge.position.set(0, baseY + 0.05, 0);
    headGroup.add(crownRidge);
    const gemColors = [0xEF4444, 0x60A5FA, 0x34D399, 0xF472B6, 0xFBBF24];
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const spike = mesh(new THREE.ConeGeometry(0.058, 0.22, 6), goldM2);
      spike.position.set(Math.sin(angle) * 0.30, baseY + 0.17, Math.cos(angle) * 0.30);
      headGroup.add(spike);
      const gem = mesh(new THREE.SphereGeometry(0.036, 8, 8), mat(gemColors[i], { roughness: 0.12, metalness: 0.16 }));
      gem.position.set(Math.sin(angle) * 0.30, baseY + 0.08, Math.cos(angle) * 0.30);
      headGroup.add(gem);
    }
    for (let i = 0; i < 10; i++) {
      const angle = (i / 10) * Math.PI * 2;
      const stud = mesh(new THREE.SphereGeometry(0.020, 6, 6), mat(0xD97706, { metalness: 0.42 }));
      stud.position.set(Math.sin(angle) * 0.37, baseY + 0.01, Math.cos(angle) * 0.37);
      headGroup.add(stud);
    }
  }

  // Flower crown
  if (acc.includes('flower-crown')) {
    const baseY = 0.21 * faceY + hairLift;
    const vine = mesh(new THREE.TorusGeometry(0.34, 0.026, 6, 26), mat(0x15803D, { roughness: 0.78 }));
    vine.position.set(0, baseY, 0);
    vine.rotation.x = Math.PI / 2;
    headGroup.add(vine);
    // Small leaves on vine
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.2;
      const leaf = mesh(new THREE.SphereGeometry(0.028, 6, 5), mat(0x22C55E, { roughness: 0.72 }));
      leaf.scale.set(0.5, 0.25, 1.2);
      leaf.position.set(Math.sin(a) * 0.345, baseY + 0.012, Math.cos(a) * 0.345);
      leaf.rotation.y = a;
      headGroup.add(leaf);
    }
    const flPetalColors = [0xFB7185, 0xF9A8D4, 0xFDE68A, 0x86EFAC, 0xBAE6FD, 0xC4B5FD, 0xFDB87A];
    for (let f = 0; f < 7; f++) {
      const fAngle = (f / 7) * Math.PI * 2;
      const fx2 = Math.sin(fAngle) * 0.34;
      const fz2 = Math.cos(fAngle) * 0.34;
      const flCenter = mesh(new THREE.SphereGeometry(0.030, 7, 7), mat(0xFEF08A, { roughness: 0.62 }));
      flCenter.position.set(fx2, baseY + 0.03, fz2);
      headGroup.add(flCenter);
      for (let p = 0; p < 5; p++) {
        const pAngle = (p / 5) * Math.PI * 2;
        const petal = mesh(new THREE.SphereGeometry(0.036, 6, 5), mat(flPetalColors[f], { roughness: 0.66 }));
        petal.scale.set(0.7, 0.42, 1.1);
        petal.position.set(fx2 + Math.sin(pAngle) * 0.052, baseY + 0.03, fz2 + Math.cos(pAngle) * 0.052);
        headGroup.add(petal);
      }
    }
  }

  // Headphones (improved)  (arc goes OVER the head, not down the side)
  if (acc.includes('headphones')) {
    const hpM = mat(0x374151, { roughness: 0.60 });
    // Headband — half-torus from ear to ear over the top of the head.
    // Default torus is in XY plane (hole along Z); upper-half ring (phi=0..π)
    // already arcs from (+R,0,0) via (0,+R,0) to (-R,0,0) — exactly what we want.
    const arc = mesh(new THREE.TorusGeometry(0.36 + hairLift * 0.4, 0.030, 6, 20, Math.PI), hpM);
    arc.position.set(0, 0, 0);
    headGroup.add(arc);
    // Padded top cushion on band apex
    const hpTopPad = mesh(new THREE.SphereGeometry(0.046, 10, 8), mat(0x111827, { roughness: 0.74 }));
    hpTopPad.scale.set(0.65, 0.40, 1);
    hpTopPad.position.set(0, 0.36 + hairLift * 0.4, 0);
    headGroup.add(hpTopPad);
    // Sliders that connect band to cups
    for (const sx of [-1, 1]) {
      const slider = mesh(new THREE.BoxGeometry(0.022, 0.030, 0.045), mat(0xC0C0C0, { metalness: 0.35, roughness: 0.40 }));
      slider.position.set(sx * 0.36, 0.05, 0);
      headGroup.add(slider);
    }
    // Ear cups (left and right)
    for (const sx of [-1, 1]) {
      const cup = mesh(new THREE.CylinderGeometry(0.10, 0.10, 0.082, 14), hpM);
      cup.position.set(sx * 0.36, 0.005, 0);
      cup.rotation.z = Math.PI / 2;
      headGroup.add(cup);
      // Soft pad (driver enclosure)
      const driver = mesh(new THREE.CylinderGeometry(0.074, 0.074, 0.024, 14), mat(0x111827, { roughness: 0.78 }));
      driver.position.set(sx * 0.418, 0.005, 0);
      driver.rotation.z = Math.PI / 2;
      headGroup.add(driver);
      // Accent ring
      const hpRing = mesh(new THREE.TorusGeometry(0.092, 0.012, 5, 16), mat(0x6B7280, { roughness: 0.46 }));
      hpRing.position.set(sx * 0.410, 0.005, 0);
      hpRing.rotation.z = Math.PI / 2;
      headGroup.add(hpRing);
    }
  }

  // Pirate hat (bicorne style)
  if (acc.includes('pirate-hat')) {
    const pirateHatM = mat(0x111827, { roughness: 0.74 });
    const pirateTrimM = mat(0xFCD34D, { metalness: 0.40, roughness: 0.40 });
    const baseY = 0.19 * faceY + hairLift;
    // Crown body
    const pirateBody = mesh(new THREE.CylinderGeometry(0.28, 0.30, 0.28, 4), pirateHatM);
    pirateBody.position.set(0, baseY + 0.14, 0);
    pirateBody.rotation.y = Math.PI / 4;
    headGroup.add(pirateBody);
    // Side brims (left / right, tilted upward)
    for (const sx of [-1, 1]) {
      const brimPiece = mesh(
        new THREE.CylinderGeometry(0.46, 0.46, 0.05, 12, 1, false, -Math.PI * 0.42, Math.PI * 0.84),
        pirateHatM,
      );
      brimPiece.position.set(sx * 0.10, baseY + 0.02, 0);
      brimPiece.rotation.z = sx * 0.68;
      headGroup.add(brimPiece);
      const goldTrim = mesh(new THREE.BoxGeometry(0.038, 0.34, 0.028), pirateTrimM);
      goldTrim.position.set(sx * 0.40, baseY + 0.02, 0);
      goldTrim.rotation.z = sx * 0.68;
      headGroup.add(goldTrim);
    }
    // Skull at front
    const pirateSkull = mesh(new THREE.SphereGeometry(0.060, 10, 8), mat(0xFFFDE7, { roughness: 0.66 }));
    pirateSkull.position.set(0, baseY + 0.16, 0.27);
    headGroup.add(pirateSkull);
    for (const sx of [-1, 1]) {
      const bone = mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.14, 5), mat(0xFFFDE7, { roughness: 0.66 }));
      bone.position.set(sx * 0.04, baseY + 0.06, 0.27);
      bone.rotation.z = sx * 0.72;
      headGroup.add(bone);
    }
  }

  // Wizard hat
  if (acc.includes('wizard-hat')) {
    const wizM = mat(0x5B21B6, { roughness: 0.74 });
    const baseY = 0.19 * faceY + hairLift;
    // Wide brim at hairline
    const wizBrim = mesh(new THREE.CylinderGeometry(0.50, 0.52, 0.06, 18), wizM);
    wizBrim.position.set(0, baseY, 0);
    headGroup.add(wizBrim);
    // Brim underside (darker)
    const wizBrimUnder = mesh(new THREE.CylinderGeometry(0.46, 0.48, 0.02, 18), mat(0x3B0764, { roughness: 0.80 }));
    wizBrimUnder.position.set(0, baseY - 0.030, 0);
    headGroup.add(wizBrimUnder);
    // Tall cone
    const wizCone = mesh(new THREE.ConeGeometry(0.30, 0.68, 16), wizM);
    wizCone.position.set(0, baseY + 0.36, 0);
    headGroup.add(wizCone);
    // Gold band at base of cone
    const wizBand = mesh(new THREE.CylinderGeometry(0.31, 0.31, 0.058, 16), mat(0xFCD34D, { metalness: 0.40, roughness: 0.40 }));
    wizBand.position.set(0, baseY + 0.04, 0);
    headGroup.add(wizBand);
    // Stars spiraling up the cone
    const wizStarColors = [0xFCD34D, 0x60A5FA, 0xF9A8D4, 0x86EFAC];
    for (let i = 0; i < 4; i++) {
      const star = mesh(new THREE.SphereGeometry(0.032, 7, 7), mat(wizStarColors[i], { roughness: 0.46 }));
      const angle = (i / 4) * Math.PI * 2;
      star.position.set(Math.sin(angle) * (0.20 - i * 0.034), baseY + 0.14 + i * 0.10, Math.cos(angle) * (0.20 - i * 0.034));
      headGroup.add(star);
    }
    // Crescent moon at front
    const moon = mesh(new THREE.TorusGeometry(0.060, 0.020, 6, 14, Math.PI * 1.4), mat(0xFCD34D, { metalness: 0.30 }));
    moon.position.set(-0.08, baseY + 0.42, 0.15);
    moon.rotation.z = 0.82;
    headGroup.add(moon);
  }

  // Animal ears (cat)
  if (acc.includes('animal-ears')) {
    const baseY = 0.28 * faceY + hairLift * 0.4;
    for (const sx of [-1, 1]) {
      const earOuter = mesh(new THREE.ConeGeometry(0.10, 0.22, 5), mat(0xD97706, { roughness: 0.72 }));
      earOuter.position.set(sx * 0.22, baseY, -0.04);
      earOuter.rotation.z = sx * 0.22;
      headGroup.add(earOuter);
      const earInner = mesh(new THREE.ConeGeometry(0.054, 0.14, 5), mat(0xFBBF8A, { roughness: 0.72 }));
      earInner.position.set(sx * 0.22, baseY + 0.02, 0.02);
      earInner.rotation.z = sx * 0.22;
      headGroup.add(earInner);
    }
  }

  // ── FACE ─────────────────────────────────────────────────────────────────

  // Sunglasses
  if (acc.includes('sunglasses')) {
    const sunFrameM = mat(0x111827, { roughness: 0.36 });
    const sunLensM = mat(0x030712, { transparent: true, opacity: 0.90, roughness: 0.06, metalness: 0.12 });
    for (const fx of [-0.113, 0.113]) {
      const sunFrame = mesh(new THREE.TorusGeometry(0.072, 0.014, 8, 20), sunFrameM);
      sunFrame.position.set(fx, eyeBaseY, faceFrontZ);
      headGroup.add(sunFrame);
      const sunFill = mesh(new THREE.CircleGeometry(0.072, 20), sunLensM);
      sunFill.position.set(fx, eyeBaseY, faceFrontZ + 0.004);
      headGroup.add(sunFill);
    }
    const sunBridge = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.085, 6), sunFrameM);
    sunBridge.position.set(0, eyeBaseY + 0.004, faceFrontZ);
    sunBridge.rotation.z = Math.PI / 2;
    headGroup.add(sunBridge);
    // Nose-bridge pads
    for (const fx of [-0.058, 0.058]) {
      const pad = mesh(new THREE.SphereGeometry(0.008, 6, 5), sunFrameM);
      pad.scale.set(0.5, 0.9, 0.5);
      pad.position.set(fx, eyeBaseY - 0.025, faceFrontZ - 0.005);
      headGroup.add(pad);
    }
    // Temple arms folding back to the ears
    for (const fx of [-0.113, 0.113]) {
      const sunArm = mesh(new THREE.BoxGeometry(0.018, 0.010, 0.22), sunFrameM);
      sunArm.position.set(fx + Math.sign(fx) * 0.16, eyeBaseY + 0.010, faceFrontZ - 0.13);
      sunArm.rotation.y = -Math.sign(fx) * 0.18;
      headGroup.add(sunArm);
    }
  }

  // Regular glasses
  if (acc.includes('glasses')) {
    const glFrameM = mat(0x92400E, { roughness: 0.54 });
    const glLensM = mat(0xBAE6FD, { transparent: true, opacity: 0.34, roughness: 0.08 });
    for (const fx of [-0.113, 0.113]) {
      const glFrame = mesh(new THREE.TorusGeometry(0.070, 0.012, 8, 20), glFrameM);
      glFrame.position.set(fx, eyeBaseY, faceFrontZ);
      headGroup.add(glFrame);
      const glFill = mesh(new THREE.CircleGeometry(0.070, 20), glLensM);
      glFill.position.set(fx, eyeBaseY, faceFrontZ + 0.004);
      headGroup.add(glFill);
    }
    const glBridge = mesh(new THREE.CylinderGeometry(0.009, 0.009, 0.085, 6), glFrameM);
    glBridge.position.set(0, eyeBaseY + 0.004, faceFrontZ);
    glBridge.rotation.z = Math.PI / 2;
    headGroup.add(glBridge);
    for (const fx of [-0.058, 0.058]) {
      const pad = mesh(new THREE.SphereGeometry(0.007, 6, 5), glFrameM);
      pad.scale.set(0.5, 0.9, 0.5);
      pad.position.set(fx, eyeBaseY - 0.025, faceFrontZ - 0.005);
      headGroup.add(pad);
    }
    for (const fx of [-0.113, 0.113]) {
      const glArm = mesh(new THREE.BoxGeometry(0.016, 0.008, 0.22), glFrameM);
      glArm.position.set(fx + Math.sign(fx) * 0.16, eyeBaseY + 0.008, faceFrontZ - 0.13);
      glArm.rotation.y = -Math.sign(fx) * 0.18;
      headGroup.add(glArm);
    }
  }

  // Sporty glasses
  if (acc.includes('sporty-glasses')) {
    const spFrameM = mat(0xC2410C, { roughness: 0.44 });
    const spLensM = mat(0xFEF3C7, { transparent: true, opacity: 0.46, roughness: 0.06 });
    for (const fx of [-0.113, 0.113]) {
      const spFrame = mesh(new THREE.TorusGeometry(0.080, 0.014, 8, 20), spFrameM);
      spFrame.scale.x = 1.28;
      spFrame.position.set(fx, eyeBaseY, faceFrontZ);
      headGroup.add(spFrame);
      const spFill = mesh(new THREE.SphereGeometry(0.070, 16, 12), spLensM);
      spFill.scale.set(1.28, 0.66, 0.16);
      spFill.position.set(fx, eyeBaseY, faceFrontZ + 0.005);
      headGroup.add(spFill);
    }
    const spNose = mesh(new THREE.BoxGeometry(0.08, 0.020, 0.018), spFrameM);
    spNose.position.set(0, eyeBaseY - 0.020, faceFrontZ + 0.004);
    headGroup.add(spNose);
    // Temple arms
    for (const fx of [-0.113, 0.113]) {
      const spArm = mesh(new THREE.BoxGeometry(0.018, 0.010, 0.22), spFrameM);
      spArm.position.set(fx + Math.sign(fx) * 0.18, eyeBaseY + 0.008, faceFrontZ - 0.13);
      spArm.rotation.y = -Math.sign(fx) * 0.18;
      headGroup.add(spArm);
    }
  }

  // Ski goggles
  if (acc.includes('ski-goggles')) {
    const gogFrameM = mat(0x1E40AF, { roughness: 0.62 });
    const gogLensM = mat(0xFDE68A, { transparent: true, opacity: 0.58, roughness: 0.06, metalness: 0.10 });
    for (const fx of [-0.113, 0.113]) {
      const gogFrame = mesh(new THREE.TorusGeometry(0.090, 0.024, 8, 20), gogFrameM);
      gogFrame.scale.y = 0.72;
      gogFrame.position.set(fx, eyeBaseY, faceFrontZ - 0.006);
      headGroup.add(gogFrame);
      const gogFill = mesh(new THREE.CircleGeometry(0.090, 20), gogLensM);
      gogFill.scale.y = 0.72;
      gogFill.position.set(fx, eyeBaseY, faceFrontZ + 0.012);
      headGroup.add(gogFill);
    }
    const gogBridge = mesh(new THREE.BoxGeometry(0.06, 0.046, 0.022), gogFrameM);
    gogBridge.position.set(0, eyeBaseY, faceFrontZ - 0.006);
    headGroup.add(gogBridge);
    // Elastic band around back of head
    const gogElastic = mesh(new THREE.TorusGeometry(0.34, 0.014, 5, 18, Math.PI), mat(0x1D4ED8, { roughness: 0.72 }));
    gogElastic.position.set(0, eyeBaseY, 0);
    gogElastic.rotation.y = Math.PI;
    headGroup.add(gogElastic);
    // Strap detail (small buckles on sides)
    for (const sx of [-1, 1]) {
      const buckle = mesh(new THREE.BoxGeometry(0.024, 0.018, 0.016), mat(0xC0C0C0, { metalness: 0.45, roughness: 0.4 }));
      buckle.position.set(sx * 0.30, eyeBaseY, -0.10);
      headGroup.add(buckle);
    }
  }

  // Monocle
  if (acc.includes('monocle')) {
    const monoGoldM = mat(0xD97706, { metalness: 0.46, roughness: 0.36 });
    const monoFrame = mesh(new THREE.TorusGeometry(0.068, 0.014, 8, 18), monoGoldM);
    monoFrame.position.set(0.113, eyeBaseY, faceFrontZ);
    headGroup.add(monoFrame);
    const monoGlass = mesh(new THREE.CircleGeometry(0.068, 18), mat(0xBAE6FD, { transparent: true, opacity: 0.34, roughness: 0.06 }));
    monoGlass.position.set(0.113, eyeBaseY, faceFrontZ + 0.004);
    headGroup.add(monoGlass);
    for (let i = 0; i < 6; i++) {
      const link = mesh(new THREE.TorusGeometry(0.013, 0.005, 4, 10), monoGoldM);
      link.position.set(0.113 + i * 0.021, eyeBaseY - 0.030 - i * 0.016, faceFrontZ - 0.004);
      link.rotation.z = (i % 2) ? Math.PI / 2 : 0;
      headGroup.add(link);
    }
  }

  // Superhero mask
  if (acc.includes('superhero-mask')) {
    const maskM2 = mat(0x7C3AED, { roughness: 0.58 });
    // Curved mask shell wrapping the eye/brow band
    for (const fx of [-0.113, 0, 0.113]) {
      const seg = mesh(new THREE.SphereGeometry(0.130, 12, 8, 0, Math.PI * 2, Math.PI * 0.40, Math.PI * 0.20), maskM2);
      seg.position.set(fx * 0.6, eyeBaseY + 0.014, 0);
      headGroup.add(seg);
    }
    // Eye holes
    for (const fx of [-0.113, 0.113]) {
      const maskHole = mesh(new THREE.CircleGeometry(0.054, 16), mat(0x1C1917, { roughness: 0.84 }));
      maskHole.position.set(fx, eyeBaseY, faceFrontZ + 0.004);
      headGroup.add(maskHole);
    }
    // Wing flares on sides
    for (const sx of [-1, 1]) {
      const wingFlare = mesh(new THREE.BoxGeometry(0.12, 0.080, 0.028), maskM2);
      wingFlare.position.set(sx * 0.36, eyeBaseY + 0.026, faceFrontZ - 0.08);
      wingFlare.rotation.z = sx * 0.30;
      wingFlare.rotation.y = sx * 0.30;
      headGroup.add(wingFlare);
    }
  }

  // ── NECK ─────────────────────────────────────────────────────────────────

  // Scarf (double wrap + fringe)
  if (acc.includes('scarf')) {
    const scarfM2 = mat(0xDC2626, { roughness: 0.76 });
    const wrap1 = mesh(new THREE.TorusGeometry(0.17, 0.065, 8, 18), scarfM2);
    wrap1.position.set(0, 1.18, 0);
    wrap1.rotation.x = 0.10;
    g.add(wrap1);
    const wrap2 = mesh(new THREE.TorusGeometry(0.17, 0.055, 8, 18), scarfM2);
    wrap2.position.set(0, 1.10, 0);
    wrap2.rotation.x = -0.08;
    g.add(wrap2);
    const scarfEnd = mesh(new THREE.BoxGeometry(0.085, 0.30, 0.07), scarfM2);
    scarfEnd.position.set(0.12, 0.88, 0.18);
    scarfEnd.rotation.z = 0.18;
    g.add(scarfEnd);
    for (let i = 0; i < 4; i++) {
      const fringe = mesh(new THREE.BoxGeometry(0.014, 0.058, 0.012), scarfM2);
      fringe.position.set(0.08 + i * 0.018, 0.75, 0.18);
      g.add(fringe);
    }
  }

  // Tie
  if (acc.includes('tie')) {
    const tieM2 = mat(0x1E40AF, { roughness: 0.64 });
    const tieKnot = mesh(new THREE.BoxGeometry(0.065, 0.058, 0.040), mat(0x1E3A5F, { roughness: 0.62 }));
    tieKnot.position.set(0, 1.06, 0.30);
    g.add(tieKnot);
    const tieBlade = mesh(new THREE.BoxGeometry(0.055, 0.30, 0.032), tieM2);
    tieBlade.position.set(0, 0.86, 0.30);
    g.add(tieBlade);
    const tieTip = mesh(new THREE.ConeGeometry(0.038, 0.12, 4), tieM2);
    tieTip.position.set(0, 0.65, 0.30);
    g.add(tieTip);
    const tieStripe = mesh(new THREE.BoxGeometry(0.040, 0.10, 0.036), mat(0x7DD3FC, { roughness: 0.64 }));
    tieStripe.position.set(0.004, 0.88, 0.314);
    tieStripe.rotation.z = 0.28;
    g.add(tieStripe);
  }

  // Bow tie
  if (acc.includes('bow-tie')) {
    const bowM = mat(0xDC2626, { roughness: 0.68 });
    for (const sx of [-1, 1]) {
      const bowWing = mesh(new THREE.BoxGeometry(0.10, 0.06, 0.030), bowM);
      bowWing.position.set(sx * 0.07, 1.10, 0.30);
      bowWing.rotation.z = sx * 0.18;
      g.add(bowWing);
      const bowAccent = mesh(new THREE.BoxGeometry(0.004, 0.055, 0.032), mat(0xFB923C, { roughness: 0.60 }));
      bowAccent.position.set(sx * 0.07, 1.10, 0.316);
      g.add(bowAccent);
    }
    const bowKnot = mesh(new THREE.SphereGeometry(0.024, 7, 7), mat(0xB91C1C, { roughness: 0.68 }));
    bowKnot.scale.set(0.8, 1, 0.6);
    bowKnot.position.set(0, 1.10, 0.312);
    g.add(bowKnot);
  }

  // Necklace with heart pendant
  if (acc.includes('necklace')) {
    const nkGoldM = mat(0xFCD34D, { metalness: 0.44, roughness: 0.36 });
    for (let i = -4; i <= 4; i++) {
      const t = i / 4;
      const bead = mesh(new THREE.SphereGeometry(0.016, 6, 6), nkGoldM);
      bead.position.set(t * 0.14, 1.08 - Math.abs(t) * 0.040, 0.26 + (1 - Math.abs(t)) * 0.06);
      g.add(bead);
    }
    const pendantM = mat(0xFCA5A5, { roughness: 0.40, metalness: 0.10 });
    for (const hx of [-0.018, 0.018]) {
      const lobe = mesh(new THREE.SphereGeometry(0.034, 8, 8), pendantM);
      lobe.position.set(hx, 0.924, 0.28);
      g.add(lobe);
    }
    const heartTip = mesh(new THREE.ConeGeometry(0.024, 0.048, 6), pendantM);
    heartTip.position.set(0, 0.885, 0.28);
    heartTip.rotation.z = Math.PI;
    g.add(heartTip);
    const bail2 = mesh(new THREE.TorusGeometry(0.015, 0.006, 4, 10), nkGoldM);
    bail2.position.set(0, 0.960, 0.28);
    g.add(bail2);
  }

  // Compass necklace
  if (acc.includes('compass-necklace')) {
    const compChainM = mat(0xD1D5DB, { metalness: 0.40, roughness: 0.44 });
    for (let i = -3; i <= 3; i++) {
      const t = i / 3;
      const link = mesh(new THREE.SphereGeometry(0.011, 5, 5), compChainM);
      link.position.set(t * 0.10, 1.06 - Math.abs(t) * 0.030, 0.25 + (1 - Math.abs(t)) * 0.048);
      g.add(link);
    }
    const compCaseM = mat(0xFCD34D, { metalness: 0.46, roughness: 0.36 });
    const compCase = mesh(new THREE.CylinderGeometry(0.064, 0.064, 0.022, 14), compCaseM);
    compCase.position.set(0, 0.92, 0.27);
    compCase.rotation.x = Math.PI / 2;
    g.add(compCase);
    const compFace = mesh(new THREE.CircleGeometry(0.054, 14), mat(0xFFFDE7, { roughness: 0.72 }));
    compFace.position.set(0, 0.92, 0.283);
    g.add(compFace);
    const needleN = mesh(new THREE.BoxGeometry(0.008, 0.042, 0.005), mat(0xEF4444));
    needleN.position.set(0.004, 0.936, 0.285);
    g.add(needleN);
    const needleS = mesh(new THREE.BoxGeometry(0.008, 0.042, 0.005), mat(0x374151));
    needleS.position.set(-0.004, 0.903, 0.285);
    g.add(needleS);
  }

  // ── BACK ─────────────────────────────────────────────────────────────────

  // Regular / travel backpack
  if (acc.includes('backpack') || acc.includes('travel-backpack')) {
    const packColor = acc.includes('travel-backpack') ? 0x65A30D : 0xD97706;
    const packM2 = mat(packColor, { roughness: 0.78 });
    const packDarkM = mat(packColor - 0x111100, { roughness: 0.80 });
    const packBody = mesh(new THREE.BoxGeometry(0.42, 0.50, 0.20), packM2);
    packBody.position.set(0, 0.76, -0.32);
    g.add(packBody);
    const packTopPocket = mesh(new THREE.BoxGeometry(0.30, 0.12, 0.06), packDarkM);
    packTopPocket.position.set(0, 1.03, -0.40);
    g.add(packTopPocket);
    const packFrontPocket = mesh(new THREE.BoxGeometry(0.30, 0.18, 0.05), packDarkM);
    packFrontPocket.position.set(0, 0.72, -0.44);
    g.add(packFrontPocket);
    const packZip = mesh(new THREE.BoxGeometry(0.28, 0.008, 0.052), mat(0xC0C0C0, { metalness: 0.5, roughness: 0.4 }));
    packZip.position.set(0, 0.816, -0.445);
    g.add(packZip);
    for (const sx of [-1, 1]) {
      const packStrap = mesh(new THREE.BoxGeometry(0.05, 0.54, 0.030), packDarkM);
      packStrap.position.set(sx * 0.17, 0.82, -0.226);
      g.add(packStrap);
    }
  }

  // Hiking backpack
  if (acc.includes('hiking-backpack')) {
    const hikeM = mat(0x0C4A6E, { roughness: 0.80 });
    const hikeDarkM = mat(0x0369A1, { roughness: 0.80 });
    const hikeBody = mesh(new THREE.BoxGeometry(0.44, 0.62, 0.22), hikeM);
    hikeBody.position.set(0, 0.72, -0.34);
    g.add(hikeBody);
    const hikeLid = mesh(new THREE.BoxGeometry(0.44, 0.14, 0.14), hikeDarkM);
    hikeLid.position.set(0, 1.06, -0.30);
    hikeLid.rotation.x = 0.20;
    g.add(hikeLid);
    for (const sx of [-1, 1]) {
      const hikeComp = mesh(new THREE.BoxGeometry(0.018, 0.40, 0.040), mat(0xFCD34D, { roughness: 0.72 }));
      hikeComp.position.set(sx * 0.24, 0.76, -0.37);
      g.add(hikeComp);
      const hikeBuckle = mesh(new THREE.BoxGeometry(0.040, 0.040, 0.060), mat(0xC0C0C0, { metalness: 0.5 }));
      hikeBuckle.position.set(sx * 0.24, 0.82, -0.39);
      g.add(hikeBuckle);
      const hikeStrap = mesh(new THREE.BoxGeometry(0.060, 0.56, 0.040), hikeDarkM);
      hikeStrap.position.set(sx * 0.18, 0.84, -0.246);
      g.add(hikeStrap);
      const hikePad = mesh(new THREE.BoxGeometry(0.070, 0.16, 0.050), hikeM);
      hikePad.position.set(sx * 0.18, 0.94, -0.242);
      g.add(hikePad);
    }
    const hikeHipBelt = mesh(new THREE.BoxGeometry(0.50, 0.050, 0.050), hikeM);
    hikeHipBelt.position.set(0, 0.44, -0.34);
    g.add(hikeHipBelt);
    for (let i = 0; i < 2; i++) {
      const hikeLoop = mesh(new THREE.TorusGeometry(0.022, 0.008, 4, 10), mat(0xFCD34D, { roughness: 0.62 }));
      hikeLoop.position.set(0, 0.84 - i * 0.16, -0.46);
      g.add(hikeLoop);
    }
  }

  // School backpack
  if (acc.includes('school-backpack')) {
    const schoolM = mat(0x1D4ED8, { roughness: 0.76 });
    const schoolBody = mesh(new THREE.BoxGeometry(0.40, 0.48, 0.18), schoolM);
    schoolBody.position.set(0, 0.76, -0.31);
    g.add(schoolBody);
    const schoolPocket = mesh(new THREE.BoxGeometry(0.30, 0.16, 0.05), mat(0x1E40AF, { roughness: 0.78 }));
    schoolPocket.position.set(0, 0.70, -0.42);
    g.add(schoolPocket);
    const schoolTrim = mesh(new THREE.BoxGeometry(0.40, 0.018, 0.19), mat(0xDC2626, { roughness: 0.72 }));
    schoolTrim.position.set(0, 1.02, -0.31);
    g.add(schoolTrim);
    const schoolZip = mesh(new THREE.BoxGeometry(0.28, 0.010, 0.052), mat(0xC0C0C0, { metalness: 0.5 }));
    schoolZip.position.set(0, 0.79, -0.436);
    g.add(schoolZip);
    for (const sx of [-1, 1]) {
      const schoolStrap = mesh(new THREE.BoxGeometry(0.050, 0.50, 0.030), mat(0x1E3A5F, { roughness: 0.78 }));
      schoolStrap.position.set(sx * 0.16, 0.80, -0.226);
      g.add(schoolStrap);
    }
  }

  // Guitar case
  if (acc.includes('guitar-case')) {
    const gcBodyM = mat(0x1C1917, { roughness: 0.80 });
    const gcTrimM = mat(0xFCD34D, { metalness: 0.42, roughness: 0.38 });
    const gcBody = mesh(new THREE.BoxGeometry(0.34, 0.68, 0.14), gcBodyM);
    gcBody.position.set(-0.08, 0.72, -0.34);
    g.add(gcBody);
    const gcNeck = mesh(new THREE.BoxGeometry(0.13, 0.38, 0.10), gcBodyM);
    gcNeck.position.set(-0.08, 1.12, -0.34);
    g.add(gcNeck);
    for (const sy of [0.58, 0.88]) {
      const gcClasp = mesh(new THREE.BoxGeometry(0.050, 0.030, 0.16), gcTrimM);
      gcClasp.position.set(-0.08, sy, -0.37);
      g.add(gcClasp);
    }
    const gcHandle = mesh(new THREE.BoxGeometry(0.12, 0.030, 0.030), gcBodyM);
    gcHandle.position.set(-0.08, 1.08, -0.40);
    g.add(gcHandle);
    const gcGrip = mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.10, 8), mat(0x92400E, { roughness: 0.74 }));
    gcGrip.position.set(-0.08, 1.08, -0.40);
    gcGrip.rotation.x = Math.PI / 2;
    g.add(gcGrip);
  }

  // Butterfly wings
  if (acc.includes('butterfly-wings')) {
    for (const sx of [-1, 1]) {
      const bwUpper = mesh(
        new THREE.SphereGeometry(0.32, 10, 8),
        mat(0xF472B6, { transparent: true, opacity: 0.68, roughness: 0.12 }),
      );
      bwUpper.scale.set(1.0, 1.2, 0.18);
      bwUpper.position.set(sx * 0.44, 0.96, -0.22);
      bwUpper.rotation.y = sx * 0.42;
      g.add(bwUpper);
      const bwLower = mesh(
        new THREE.SphereGeometry(0.22, 10, 8),
        mat(0x60A5FA, { transparent: true, opacity: 0.62, roughness: 0.12 }),
      );
      bwLower.scale.set(0.9, 0.9, 0.18);
      bwLower.position.set(sx * 0.38, 0.64, -0.20);
      bwLower.rotation.y = sx * 0.50;
      g.add(bwLower);
    }
    const bwBody = mesh(new THREE.CylinderGeometry(0.028, 0.022, 0.44, 8), mat(0x1C1917, { roughness: 0.72 }));
    bwBody.position.set(0, 0.82, -0.16);
    g.add(bwBody);
    for (const sx of [-1, 1]) {
      const bwAntenna = mesh(new THREE.CylinderGeometry(0.006, 0.010, 0.22, 5), mat(0x374151, { roughness: 0.72 }));
      bwAntenna.position.set(sx * 0.05, 1.08, -0.14);
      bwAntenna.rotation.z = sx * 0.50;
      g.add(bwAntenna);
      const bwTip = mesh(new THREE.SphereGeometry(0.020, 7, 7), mat(0xF472B6, { roughness: 0.55 }));
      bwTip.position.set(sx * 0.10, 1.18, -0.13);
      g.add(bwTip);
    }
  }

  // ── BODY / HANDS ─────────────────────────────────────────────────────────

  // Watch (left wrist: x=-0.72, y=0.32 in g-space)
  if (acc.includes('watch')) {
    const wFaceM = mat(0xD1D5DB, { metalness: 0.46, roughness: 0.36 });
    const wStrapM = mat(0x1C1917, { roughness: 0.76 });
    const wStrap = mesh(new THREE.TorusGeometry(0.088, 0.016, 5, 14), wStrapM);
    wStrap.position.set(-0.72, 0.32, 0);
    wStrap.rotation.y = Math.PI / 2;
    g.add(wStrap);
    const wCase = mesh(new THREE.CylinderGeometry(0.056, 0.056, 0.036, 14), wFaceM);
    wCase.position.set(-0.72, 0.32, 0.090);
    wCase.rotation.x = Math.PI / 2;
    g.add(wCase);
    const wDial = mesh(new THREE.CircleGeometry(0.046, 14), mat(0xFFFDE7, { roughness: 0.70 }));
    wDial.position.set(-0.72, 0.32, 0.110);
    g.add(wDial);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      const wMarker = mesh(new THREE.BoxGeometry(0.006, 0.012, 0.004), mat(0x374151));
      wMarker.position.set(-0.72 + Math.sin(a) * 0.034, 0.32 + Math.cos(a) * 0.034, 0.112);
      g.add(wMarker);
    }
    const wHandH = mesh(new THREE.BoxGeometry(0.005, 0.020, 0.004), mat(0x1C1917));
    wHandH.position.set(-0.714, 0.336, 0.113);
    g.add(wHandH);
    const wHandM2 = mesh(new THREE.BoxGeometry(0.004, 0.028, 0.004), mat(0xDC2626));
    wHandM2.position.set(-0.728, 0.320, 0.113);
    g.add(wHandM2);
    const wCrown2 = mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.018, 5), wFaceM);
    wCrown2.position.set(-0.72, 0.378, 0.090);
    g.add(wCrown2);
  }

  // Bracelet (right wrist: x=0.72, y=0.32)
  if (acc.includes('bracelet')) {
    const brGoldM = mat(0xFCD34D, { metalness: 0.44, roughness: 0.36 });
    const brRing = mesh(new THREE.TorusGeometry(0.090, 0.018, 6, 18), brGoldM);
    brRing.position.set(0.72, 0.32, 0);
    brRing.rotation.y = Math.PI / 2;
    g.add(brRing);
    const brBeadColors = [0xEF4444, 0xFB923C, 0xFCD34D, 0x34D399, 0x60A5FA, 0x818CF8, 0xF472B6, 0xA78BFA];
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const bead = mesh(new THREE.SphereGeometry(0.025, 7, 7), mat(brBeadColors[i], { roughness: 0.54 }));
      bead.position.set(0.72, 0.32 + Math.sin(angle) * 0.090, Math.cos(angle) * 0.090);
      g.add(bead);
    }
  }

  // Gloves (both hands)
  if (acc.includes('gloves')) {
    for (const sx of [-1, 1]) {
      const glPalm = mesh(new THREE.SphereGeometry(0.086, 10, 10), mat(0x7F1D1D, { roughness: 0.74 }));
      glPalm.scale.set(1.0, 0.76, 0.86);
      glPalm.position.set(sx * 0.72, 0.32, 0);
      g.add(glPalm);
      for (let k = 0; k < 4; k++) {
        const knuckle = mesh(new THREE.SphereGeometry(0.022, 6, 6), mat(0x7F1D1D, { roughness: 0.74 }));
        knuckle.position.set(sx * 0.72 + (k - 1.5) * 0.026, 0.354, 0.060);
        g.add(knuckle);
      }
      const glCuff = mesh(new THREE.CylinderGeometry(0.062, 0.066, 0.044, 10), mat(0x6B1A1A, { roughness: 0.76 }));
      glCuff.position.set(sx * 0.72, 0.366, 0);
      g.add(glCuff);
    }
  }

  // Belt bag (left hip)
  if (acc.includes('belt-bag')) {
    const bbBeltM = mat(0x1C1917, { roughness: 0.80 });
    const bbBagM = mat(0x374151, { roughness: 0.74 });
    const bbBelt = mesh(new THREE.BoxGeometry(0.52, 0.040, 0.030), bbBeltM);
    bbBelt.position.set(0, 0.46, 0.29);
    g.add(bbBelt);
    const bbBeltBack = mesh(new THREE.BoxGeometry(0.52, 0.040, 0.030), bbBeltM);
    bbBeltBack.position.set(0, 0.46, -0.29);
    g.add(bbBeltBack);
    const bbBuckle = mesh(new THREE.BoxGeometry(0.040, 0.052, 0.040), mat(0xD1D5DB, { metalness: 0.44, roughness: 0.36 }));
    bbBuckle.position.set(0.22, 0.46, 0.30);
    g.add(bbBuckle);
    const bbBody = mesh(new THREE.BoxGeometry(0.22, 0.14, 0.08), bbBagM);
    bbBody.position.set(-0.24, 0.46, 0.32);
    g.add(bbBody);
    const bbPocket = mesh(new THREE.BoxGeometry(0.16, 0.10, 0.030), mat(0x2D3748, { roughness: 0.76 }));
    bbPocket.position.set(-0.24, 0.46, 0.37);
    g.add(bbPocket);
    const bbZip = mesh(new THREE.BoxGeometry(0.14, 0.008, 0.032), mat(0xC0C0C0, { metalness: 0.50 }));
    bbZip.position.set(-0.24, 0.515, 0.375);
    g.add(bbZip);
  }

  // Camera (improved)
  if (acc.includes('camera')) {
    const camBodyM2 = mat(0x1F2937, { roughness: 0.76 });
    const camMetalM2 = mat(0x374151, { roughness: 0.48, metalness: 0.18 });
    const camBody2 = mesh(new THREE.BoxGeometry(0.22, 0.15, 0.11), camBodyM2);
    camBody2.position.set(-0.38, 0.76, 0.22);
    g.add(camBody2);
    const camDial = mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.014, 10), camMetalM2);
    camDial.position.set(-0.29, 0.848, 0.22);
    g.add(camDial);
    const camShutter = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 8), mat(0xEF4444, { roughness: 0.60 }));
    camShutter.position.set(-0.31, 0.850, 0.250);
    g.add(camShutter);
    const camBarrel1 = mesh(new THREE.CylinderGeometry(0.054, 0.058, 0.060, 14), camMetalM2);
    camBarrel1.position.set(-0.38, 0.76, 0.295);
    camBarrel1.rotation.x = Math.PI / 2;
    g.add(camBarrel1);
    const camBarrel2 = mesh(new THREE.CylinderGeometry(0.046, 0.050, 0.040, 14), camMetalM2);
    camBarrel2.position.set(-0.38, 0.76, 0.329);
    camBarrel2.rotation.x = Math.PI / 2;
    g.add(camBarrel2);
    const camGlass = mesh(new THREE.CircleGeometry(0.040, 14), mat(0x1E3A5F, { transparent: true, opacity: 0.82, roughness: 0.06 }));
    camGlass.position.set(-0.38, 0.76, 0.352);
    g.add(camGlass);
    const camStrap2 = mesh(new THREE.BoxGeometry(0.028, 0.34, 0.018), mat(0x92400E, { roughness: 0.72 }));
    camStrap2.position.set(-0.22, 0.92, 0.18);
    camStrap2.rotation.z = -0.38;
    g.add(camStrap2);
  }

  // Medal (improved with star motif)
  if (acc.includes('medal')) {
    const mdRibM = mat(0xDC2626, { roughness: 0.72 });
    const mdDiscM = mat(0xFCD34D, { metalness: 0.40, roughness: 0.36 });
    const mdRib = mesh(new THREE.BoxGeometry(0.050, 0.24, 0.018), mdRibM);
    mdRib.position.set(0.10, 1.04, 0.31);
    mdRib.rotation.z = 0.12;
    g.add(mdRib);
    const mdDisc = mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.026, 16), mdDiscM);
    mdDisc.position.set(0.10, 0.89, 0.31);
    mdDisc.rotation.x = Math.PI / 2;
    g.add(mdDisc);
    const mdRim = mesh(new THREE.TorusGeometry(0.092, 0.012, 5, 16), mat(0xD97706, { metalness: 0.42 }));
    mdRim.position.set(0.10, 0.89, 0.325);
    g.add(mdRim);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
      const ray = mesh(new THREE.BoxGeometry(0.012, 0.062, 0.010), mat(0xD97706, { metalness: 0.36 }));
      ray.position.set(0.10 + Math.cos(a) * 0.028, 0.89 + Math.sin(a) * 0.028, 0.338);
      ray.rotation.z = a;
      g.add(ray);
    }
  }

  // Umbrella (improved)
  if (acc.includes('umbrella')) {
    const umbDome = mesh(
      new THREE.SphereGeometry(0.30, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.5),
      mat(0xEF4444, { roughness: 0.65 }),
    );
    umbDome.position.set(-0.80, 1.10, 0);
    g.add(umbDome);
    const umbPanelColors = [0xEF4444, 0xFFFDE7, 0xEF4444, 0xFFFDE7];
    for (let i = 0; i < 4; i++) {
      const umbPanel = mesh(
        new THREE.SphereGeometry(0.296, 5, 10, (i / 4) * Math.PI * 2, Math.PI * 0.5, 0, Math.PI * 0.5),
        mat(umbPanelColors[i], { roughness: 0.68 }),
      );
      umbPanel.position.set(-0.80, 1.10, 0);
      g.add(umbPanel);
    }
    for (let i = 0; i < 8; i++) {
      const sAngle = (i / 8) * Math.PI * 2;
      const spoke = mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.32, 4), mat(0xD1D5DB, { metalness: 0.30 }));
      spoke.position.set(-0.80 + Math.sin(sAngle) * 0.14, 1.08, Math.cos(sAngle) * 0.14);
      spoke.rotation.z = -Math.atan2(Math.cos(sAngle), 0.5);
      spoke.rotation.x = -Math.atan2(Math.sin(sAngle), 0.5);
      g.add(spoke);
    }
    const umbShaft = mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.72, 6), mat(0x94A3B8, { metalness: 0.22, roughness: 0.48 }));
    umbShaft.position.set(-0.80, 0.72, 0);
    g.add(umbShaft);
    const umbHandle = mesh(new THREE.TorusGeometry(0.062, 0.016, 5, 12, Math.PI * 0.9), mat(0x92400E, { roughness: 0.74 }));
    umbHandle.position.set(-0.80, 0.37, 0);
    umbHandle.rotation.x = Math.PI / 2;
    g.add(umbHandle);
  }

  // Binoculars (improved)
  if (acc.includes('binoculars')) {
    const binoBodyM = mat(0x374151, { roughness: 0.72 });
    const binoLensM = mat(0x1E3A5F, { transparent: true, opacity: 0.76, roughness: 0.06 });
    for (const sx of [-1, 1]) {
      const binoTube = mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.20, 12), binoBodyM);
      binoTube.position.set(sx * 0.10, 0.84, 0.28);
      binoTube.rotation.x = Math.PI / 2;
      g.add(binoTube);
      const binoRim = mesh(new THREE.TorusGeometry(0.068, 0.010, 5, 14), mat(0xD1D5DB, { metalness: 0.32 }));
      binoRim.position.set(sx * 0.10, 0.84, 0.382);
      g.add(binoRim);
      const binoLens2 = mesh(new THREE.CircleGeometry(0.058, 14), binoLensM);
      binoLens2.position.set(sx * 0.10, 0.84, 0.384);
      g.add(binoLens2);
      const binoFocusRing = mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.036, 12), mat(0x4B5563, { roughness: 0.68 }));
      binoFocusRing.position.set(sx * 0.10, 0.84, 0.22);
      binoFocusRing.rotation.x = Math.PI / 2;
      g.add(binoFocusRing);
    }
    const binoBridge = mesh(new THREE.BoxGeometry(0.12, 0.060, 0.080), binoBodyM);
    binoBridge.position.set(0, 0.84, 0.26);
    g.add(binoBridge);
    const binoWheel = mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.060, 10), mat(0x6B7280, { roughness: 0.62 }));
    binoWheel.position.set(0, 0.876, 0.26);
    g.add(binoWheel);
    const binoStrap2 = mesh(new THREE.BoxGeometry(0.028, 0.28, 0.018), mat(0x92400E, { roughness: 0.72 }));
    binoStrap2.position.set(0, 0.98, 0.22);
    g.add(binoStrap2);
  }

  // Map (improved)
  if (acc.includes('map')) {
    const mapBodyM = mat(0xFFFDE7, { roughness: 0.82 });
    const mapLineM = mat(0xC5B358, { roughness: 0.78 });
    const mapScroll = mesh(new THREE.BoxGeometry(0.24, 0.30, 0.030), mapBodyM);
    mapScroll.position.set(0.76, 0.62, 0.10);
    mapScroll.rotation.z = -0.18;
    g.add(mapScroll);
    for (let i = 0; i < 3; i++) {
      const hLine = mesh(new THREE.BoxGeometry(0.20, 0.006, 0.032), mapLineM);
      hLine.position.set(0.76, 0.66 - i * 0.07, 0.116);
      hLine.rotation.z = -0.18;
      g.add(hLine);
    }
    for (let i = 0; i < 3; i++) {
      const vLine = mesh(new THREE.BoxGeometry(0.006, 0.26, 0.032), mapLineM);
      vLine.position.set(0.68 + i * 0.08, 0.62, 0.116);
      vLine.rotation.z = -0.18;
      g.add(vLine);
    }
    for (const sy of [0.78, 0.46]) {
      const mapRoll = mesh(new THREE.CylinderGeometry(0.030, 0.030, 0.26, 8), mat(0xD97706, { roughness: 0.74 }));
      mapRoll.position.set(0.76, sy, 0.10);
      mapRoll.rotation.z = Math.PI / 2;
      g.add(mapRoll);
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
}

// Available illustrated background scenes
export const BACKGROUND_KEYS = ['studio','beach','mountain','city','home','forest','sunset','space'] as const;

export default function Avatar3D({
  avatar, width = 220, height = 300,
  expression: expressionProp, background = 'studio',
  outfitColor,
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

  const avatarKey = useMemo(() => [
    avatar.hairStyle, avatar.hairColor, avatar.eyeColor,
    avatar.skinColor, avatar.outfit, avatar.user,
    effectiveFaceType, effectiveExpression,
    outfitColor ?? '',
    ...(avatar.accessories ?? []),
  ].join(','), [avatar, effectiveFaceType, effectiveExpression, outfitColor]);

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

    const { group: char, parts } = buildCharacter(avatar, effectiveExpression, effectiveFaceType, outfitColor);
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
    const { group: char, parts } = buildCharacter(avatar, effectiveExpression, effectiveFaceType, outfitColor);
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
