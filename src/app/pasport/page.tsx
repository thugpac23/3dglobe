'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { UserProfile, AvatarConfig } from '@/types';
import { fetchUsers } from '@/lib/api';
import { BG_NAMES } from '@/data/countryNamesBg';
import { sounds, resumeAudio } from '@/lib/sounds';

const Avatar3D = dynamic(() => import('@/components/Avatar3D/Avatar3D'), { ssr: false });

interface StampCountry { name: string; isoCode: string; capital: string; }
interface Stamp {
  id: string; user: string; countryId: string; stampedAt: string;
  page: number; positionX: number; positionY: number; rotation: number;
  country: StampCountry;
}

const COVER_RED  = '#6B1520';
const COVER_DARK = '#3e0a13';
const COVER_GOLD = '#C9A227';
const PW = 290;
const PH = 420;
const BOOK_W = PW * 2 + 12; // 592px total spread width
const STAMPS_PER_PAGE = 6;

function getFlagEmoji(iso: string): string {
  if (!iso || iso.length !== 2) return '🌍';
  try {
    return String.fromCodePoint(
      0x1F1E6 + iso.toUpperCase().charCodeAt(0) - 65,
      0x1F1E6 + iso.toUpperCase().charCodeAt(1) - 65,
    );
  } catch { return '🌍'; }
}

// Hand-drawn waving Bulgarian flag (white/green/red), with a flagpole.
function BgWavingFlag({ size = 26 }: { size?: number }) {
  const w = Math.round(size * 1.55);
  return (
    <svg
      viewBox="0 0 62 40"
      width={w}
      height={size}
      style={{ display: 'inline-block', verticalAlign: '-0.18em', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.18))' }}
      aria-label="Bulgarian flag"
    >
      {/* Pole */}
      <rect x="0" y="0" width="2.4" height="40" rx="0.8" fill="#7a5a2c" />
      <circle cx="1.2" cy="2" r="1.6" fill="#caa83b" />
      {/* Stripes — each is a waving band drawn with cubic bezier curves */}
      {/* White */}
      <path
        d="M 2.4 5
           C 12 2.5, 22 7.2, 32 4.5
           S 52 7.2, 62 4.8
           L 62 14
           C 52 16.4, 42 11.7, 32 14
           S 12 16.6, 2.4 14
           Z"
        fill="#ffffff"
      />
      {/* Green */}
      <path
        d="M 2.4 14
           C 12 11.6, 22 16.4, 32 14
           S 52 16.6, 62 14
           L 62 24
           C 52 26.6, 42 21.7, 32 24
           S 12 26.6, 2.4 24
           Z"
        fill="#00966E"
      />
      {/* Red */}
      <path
        d="M 2.4 24
           C 12 21.6, 22 26.4, 32 24
           S 52 26.6, 62 24
           L 62 34
           C 52 36.6, 42 31.7, 32 34
           S 12 36.6, 2.4 34
           Z"
        fill="#D62612"
      />
      {/* Subtle shading along the wave troughs */}
      <path
        d="M 2.4 14 C 12 11.6, 22 16.4, 32 14 S 52 16.6, 62 14"
        fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="0.6"
      />
      <path
        d="M 2.4 24 C 12 21.6, 22 26.4, 32 24 S 52 26.6, 62 24"
        fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="0.6"
      />
    </svg>
  );
}

function InkStamp({ stamp, color }: { stamp: Stamp; color: string }) {
  const bgName = BG_NAMES[stamp.country.isoCode] ?? stamp.country.name;
  const flag   = getFlagEmoji(stamp.country.isoCode);
  const date   = new Date(stamp.stampedAt).toLocaleDateString('bg-BG', { year: 'numeric', month: 'short' });
  const short  = bgName.length > 11 ? bgName.slice(0, 10) + '…' : bgName;
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%">
      <circle cx="50" cy="50" r="47" fill="none" stroke={color} strokeWidth="2.5" strokeDasharray="5 3" opacity="0.75" />
      <circle cx="50" cy="50" r="40" fill={`${color}18`} stroke={color} strokeWidth="1.5" opacity="0.8" />
      <text x="50" y="37" textAnchor="middle" fontSize="22" dominantBaseline="middle">{flag}</text>
      <text x="50" y="59" textAnchor="middle" fontSize="8.5" fill={color} fontWeight="700"
            fontFamily="-apple-system,Arial,sans-serif" opacity="0.9">{short}</text>
      <text x="50" y="71" textAnchor="middle" fontSize="6.5" fill={color} opacity="0.6"
            fontFamily="-apple-system,Arial,sans-serif">{date}</text>
    </svg>
  );
}

// Each stamp: outer div handles position + rotation (also draggable);
// inner div handles the impact animation independently.
function DraggableStamp({ stamp, color, onSave, getPage, animEpoch, index }: {
  stamp: Stamp;
  color: string;
  onSave: (id: string, x: number, y: number) => void;
  getPage: () => HTMLDivElement | null;
  animEpoch: number;
  index: number;
}) {
  const outerRef    = useRef<HTMLDivElement>(null);
  const pos         = useRef({ x: stamp.positionX, y: stamp.positionY });
  const dragging    = useRef(false);
  const lastMouse   = useRef({ x: 0, y: 0 });
  const hasAnimated = useRef(false);
  const [hover,     setHover]     = useState(false);
  const [animating, setAnimating] = useState(false);
  const [inkRing,   setInkRing]   = useState(false);

  // Sync position if stamp data changes (e.g. after PATCH round-trip)
  useEffect(() => {
    pos.current = { x: stamp.positionX, y: stamp.positionY };
    if (outerRef.current) {
      outerRef.current.style.left = `${stamp.positionX}%`;
      outerRef.current.style.top  = `${stamp.positionY}%`;
    }
  }, [stamp.id, stamp.positionX, stamp.positionY]);

  // Stamp impact animation — fires once per mount when epoch > 0
  useEffect(() => {
    if (animEpoch === 0 || hasAnimated.current) return;
    hasAnimated.current = true;

    const delay     = index * 80;
    const impactAt  = delay + 225; // 50% of 450ms

    const t1 = setTimeout(() => setAnimating(true), delay);
    const t2 = setTimeout(() => {
      setInkRing(true);
      if (index < 3) { resumeAudio(); sounds.stamp(); }
    }, impactAt);
    const t3 = setTimeout(() => setAnimating(false), delay + 460);
    const t4 = setTimeout(() => setInkRing(false),   impactAt + 430);

    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [animEpoch, index]);

  function startDrag(pageEl: HTMLDivElement, startX: number, startY: number) {
    dragging.current  = true;
    lastMouse.current = { x: startX, y: startY };
    resumeAudio();
  }

  function moveDrag(pageEl: HTMLDivElement, clientX: number, clientY: number) {
    if (!dragging.current || !outerRef.current) return;
    const rect = pageEl.getBoundingClientRect();
    const dx = ((clientX - lastMouse.current.x) / rect.width)  * 100;
    const dy = ((clientY - lastMouse.current.y) / rect.height) * 100;
    lastMouse.current = { x: clientX, y: clientY };
    pos.current.x = Math.max(7, Math.min(93, pos.current.x + dx));
    pos.current.y = Math.max(7, Math.min(93, pos.current.y + dy));
    outerRef.current.style.left = `${pos.current.x}%`;
    outerRef.current.style.top  = `${pos.current.y}%`;
  }

  function endDrag() {
    if (!dragging.current) return;
    dragging.current = false;
    sounds.stamp();
    onSave(stamp.id, pos.current.x, pos.current.y);
  }

  function onMouseDown(e: React.MouseEvent) {
    const pageEl = getPage();
    if (!pageEl) return;
    const page = pageEl;
    e.preventDefault();
    startDrag(page, e.clientX, e.clientY);

    function onMove(ev: MouseEvent) { moveDrag(page, ev.clientX, ev.clientY); }
    function onUp() {
      endDrag();
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function onTouchStart(e: React.TouchEvent) {
    const pageEl = getPage();
    if (!pageEl || e.touches.length !== 1) return;
    e.preventDefault();
    const page = pageEl;
    const t = e.touches[0];
    startDrag(page, t.clientX, t.clientY);

    function onMove(ev: TouchEvent) {
      if (ev.touches.length !== 1) return;
      ev.preventDefault();
      moveDrag(page, ev.touches[0].clientX, ev.touches[0].clientY);
    }
    function onEnd() {
      endDrag();
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onEnd);
    }
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onEnd);
  }

  return (
    <div
      ref={outerRef}
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        left: `${stamp.positionX}%`,
        top: `${stamp.positionY}%`,
        transform: `translate(-50%,-50%) rotate(${stamp.rotation}deg)`,
        userSelect: 'none',
        zIndex: hover ? 10 : (animating ? 8 : 1),
        filter: `drop-shadow(0 2px 6px ${color}55)`,
        cursor: 'grab',
      }}
    >
      {/* Ink ring — expands and fades on impact */}
      {inkRing && (
        <div className="ink-ring" style={{ width: 72, height: 72, border: `1.5px solid ${color}` }} />
      )}

      {/* Inner container — handles drop + squash animation, hover scale when idle */}
      <div
        className={animating ? 'stamp-impact' : ''}
        style={{
          width: 72, height: 72,
          transform: animating ? undefined : `scale(${hover ? 1.1 : 1})`,
          transition: animating ? 'none' : 'transform 0.15s ease',
        }}
      >
        <InkStamp stamp={stamp} color={color} />
      </div>
    </div>
  );
}

// Interactive stamps page — owns its internal ref so DraggableStamps can measure it
function StampsPage({ stamps, color, onSave, animEpoch }: {
  stamps: Stamp[];
  color: string;
  onSave: (id: string, x: number, y: number) => void;
  animEpoch: number;
}) {
  const pageRef = useRef<HTMLDivElement>(null);
  return (
    <div ref={pageRef} style={{
      position: 'relative', width: '100%', height: '100%',
      background: 'linear-gradient(160deg, #fffdf5 0%, #faf6e8 60%, #f2edd8 100%)',
      overflow: 'hidden',
    }}>
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: 8, right: 8,
          top: `${6 + i * 6.7}%`, height: 1,
          background: 'rgba(90,110,60,0.055)', pointerEvents: 'none',
        }} />
      ))}
      {stamps.length === 0 && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
          justifyContent: 'center', flexDirection: 'column', gap: 6, pointerEvents: 'none',
        }}>
          <div style={{ fontSize: 28, opacity: 0.12 }}>✈️</div>
          <div style={{ fontSize: 10, color: '#b0a080', opacity: 0.5, fontStyle: 'italic' }}>няма печати</div>
        </div>
      )}
      {stamps.map((s, i) => (
        <DraggableStamp
          key={s.id}
          stamp={s}
          color={color}
          onSave={onSave}
          getPage={() => pageRef.current}
          animEpoch={animEpoch}
          index={i}
        />
      ))}
    </div>
  );
}

// Non-interactive snapshot used for flip animation faces
function StaticStampsPage({ stamps, color }: { stamps: Stamp[]; color: string }) {
  return (
    <div style={{
      position: 'relative', width: '100%', height: '100%',
      background: 'linear-gradient(160deg, #fffdf5 0%, #faf6e8 60%, #f2edd8 100%)',
      overflow: 'hidden',
    }}>
      {Array.from({ length: 14 }).map((_, i) => (
        <div key={i} style={{
          position: 'absolute', left: 8, right: 8,
          top: `${6 + i * 6.7}%`, height: 1,
          background: 'rgba(90,110,60,0.055)', pointerEvents: 'none',
        }} />
      ))}
      {stamps.map(s => (
        <div key={s.id} style={{
          position: 'absolute',
          left: `${s.positionX}%`, top: `${s.positionY}%`,
          width: 72, height: 72,
          transform: `translate(-50%,-50%) rotate(${s.rotation}deg)`,
          opacity: 0.88, pointerEvents: 'none',
        }}>
          <InkStamp stamp={s} color={color} />
        </div>
      ))}
    </div>
  );
}

function InfoPage({ displayName, userId, count, avatarConfig }: {
  displayName: string;
  userId: string;
  count: number;
  avatarConfig?: Partial<AvatarConfig> | null;
}) {
  return (
    <div style={{
      position: 'relative',
      width: '100%', height: '100%',
      background: 'linear-gradient(170deg, #fffef8 0%, #faf7ec 55%, #f0e9d2 100%)',
      display: 'flex', flexDirection: 'column',
      overflow: 'hidden',
    }}>
      {/* Subtle diagonal watermark pattern */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.045, pointerEvents: 'none' }} aria-hidden>
        <defs>
          <pattern id="wp" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <text x="14" y="20" textAnchor="middle" fontSize="11" fontFamily="serif" fill={COVER_GOLD}>✦</text>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#wp)" />
      </svg>

      {/* Gold ornamental border frame */}
      <svg viewBox={`0 0 ${PW} ${PH}`} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none' }} aria-hidden>
        {/* Outer line */}
        <rect x="7" y="7" width={PW - 14} height={PH - 14}
          rx="2" fill="none" stroke={COVER_GOLD} strokeWidth="1.2" strokeOpacity="0.55"
        />
        {/* Inner line */}
        <rect x="11" y="11" width={PW - 22} height={PH - 22}
          rx="1" fill="none" stroke={COVER_GOLD} strokeWidth="0.5" strokeOpacity="0.35"
        />
        {/* Corner flourishes */}
        {([[7, 7], [PW - 7, 7], [7, PH - 7], [PW - 7, PH - 7]] as [number, number][]).map(([cx, cy], qi) => (
          <circle key={qi} cx={cx} cy={cy} r="2.5" fill={COVER_GOLD} fillOpacity="0.45" />
        ))}
      </svg>

      {/* Content area with padding */}
      <div style={{ padding: '20px 18px 16px', display: 'flex', flexDirection: 'column', flex: 1, position: 'relative' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 10 }}>
          <div style={{
            fontSize: 7.5, fontWeight: 800, letterSpacing: '0.28em',
            color: COVER_GOLD, textTransform: 'uppercase', lineHeight: 1.5, opacity: 0.9,
          }}>
            Република България
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4 }}>
            <div style={{ flex: 1, height: 0.8, background: `linear-gradient(90deg, transparent, ${COVER_GOLD}90)` }} />
            <BgWavingFlag size={20} />
            <div style={{ flex: 1, height: 0.8, background: `linear-gradient(90deg, ${COVER_GOLD}90, transparent)` }} />
          </div>
          <div style={{
            fontSize: 11, fontWeight: 900, letterSpacing: '0.18em',
            color: COVER_RED, textTransform: 'uppercase', marginTop: 5, lineHeight: 1,
          }}>
            ПАСПОРТ
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 0.8, background: `linear-gradient(90deg, transparent, ${COVER_GOLD}60, transparent)`, marginBottom: 12 }} />

        {/* Photo + info row */}
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flex: 1 }}>
          {/* Photo box */}
          <div style={{
            flex: '0 0 auto',
            width: 98, height: 124,
            border: `1.5px solid ${COVER_GOLD}70`,
            background: '#d8e8f4',
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
          }}>
            {avatarConfig
              ? <Avatar3D avatar={{ ...avatarConfig, user: userId }} expression={avatarConfig.expression ?? 'smile'} width={98} height={124} />
              : <div style={{ width: 98, height: 124, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 36 }}>🧑</div>
            }
          </div>

          {/* Info fields */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 7.5, color: '#a08e6a', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 2 }}>
                Пътешественик
              </div>
              <div style={{ fontSize: 20, fontWeight: 900, color: '#3d2a0f', lineHeight: 1.1 }}>
                {displayName}
              </div>
            </div>

            <div style={{ height: 0.8, background: `${COVER_GOLD}50` }} />

            <div>
              <div style={{ fontSize: 7.5, color: '#a08e6a', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 3 }}>
                Посетени държави
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <div style={{ fontSize: 30, fontWeight: 900, color: COVER_RED, lineHeight: 1 }}>
                  {count}
                </div>
                <div style={{ fontSize: 9, color: '#b0906a', fontStyle: 'italic' }}>страни</div>
              </div>
            </div>

            <div style={{ height: 0.8, background: `${COVER_GOLD}50` }} />

            <div>
              <div style={{ fontSize: 7.5, color: '#a08e6a', textTransform: 'uppercase', letterSpacing: '0.16em', marginBottom: 2 }}>
                Статус
              </div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: count >= 10 ? '#15803D' : COVER_RED }}>
                {count === 0 ? 'Начинаещ' : count < 5 ? 'Изследовател' : count < 15 ? 'Откривател' : 'Глобален герой'}
              </div>
            </div>
          </div>
        </div>

        {/* Decorative horizontal rule */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '12px 0 8px' }}>
          <div style={{ flex: 1, height: 0.8, background: `linear-gradient(90deg, transparent, ${COVER_GOLD}60)` }} />
          <div style={{ fontSize: 10, color: COVER_GOLD, opacity: 0.7 }}>✦</div>
          <div style={{ flex: 1, height: 0.8, background: `linear-gradient(90deg, ${COVER_GOLD}60, transparent)` }} />
        </div>

        {/* MRZ-style zone */}
        <div style={{
          background: `${COVER_RED}08`,
          border: `0.8px solid ${COVER_GOLD}40`,
          borderRadius: 2,
          padding: '5px 8px',
          fontFamily: '"Courier New", monospace',
          fontSize: 7,
          color: '#6B4F2A',
          letterSpacing: '0.06em',
          lineHeight: 1.7,
          opacity: 0.75,
          userSelect: 'none',
        }}>
          <div>P&lt;BGR{displayName.toUpperCase().padEnd(16, '<').slice(0,16)}&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>
          <div>BG{String(count).padStart(2,'0')}00000&lt;{new Date().getFullYear()}BG&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</div>
        </div>
      </div>
    </div>
  );
}

// spread 0: left = 'info', right = stamp page 0
// spread n>0: left = stamp page (2n-1), right = stamp page (2n)
function spreadToPages(idx: number): [number | 'info', number] {
  if (idx === 0) return ['info', 0];
  return [idx * 2 - 1, idx * 2];
}

export default function PasportPage() {
  const [users, setUsers]             = useState<UserProfile[]>([]);
  const [activeUser, setActiveUser]   = useState<UserProfile | null>(null);
  const [stamps, setStamps]           = useState<Stamp[]>([]);
  const [loading, setLoading]         = useState(true);
  const [spreadIdx, setSpreadIdx]     = useState(0);
  const [flipping, setFlipping]       = useState<'fwd' | 'bwd' | null>(null);
  const [bookScale, setBookScale]     = useState(1);
  const [avatarConfigs, setAvatarConfigs] = useState<Record<string, Partial<AvatarConfig> | null>>({});
  // Incremented each time stamps should (re-)animate on the visible spread
  const [animEpoch, setAnimEpoch]     = useState(0);

  useEffect(() => {
    const update = () => setBookScale(Math.min(1, (window.innerWidth - 32) / BOOK_W));
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    fetchUsers().then(us => {
      setUsers(us);
      setActiveUser(u => u ?? (us[0] ?? null));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/api/avatar')
      .then(r => r.json())
      .then(data => {
        const map: Record<string, Partial<AvatarConfig> | null> = {};
        for (const uid of Object.keys(data)) map[uid] = data[uid] ?? null;
        setAvatarConfigs(map);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!activeUser) return;
    setLoading(true);
    setSpreadIdx(0);
    fetch(`/api/passport?user=${activeUser.id}`)
      .then(r => r.json())
      .then((data: Stamp[]) => {
        setStamps(data);
        setLoading(false);
        setAnimEpoch(e => e + 1); // trigger animation on first visible spread
      })
      .catch(() => setLoading(false));
  }, [activeUser]);

  const byPage = useCallback((pg: number) => stamps.filter(s => s.page === pg), [stamps]);

  const totalStampPages = Math.max(1, Math.ceil(stamps.length / STAMPS_PER_PAGE));
  const maxSpread       = Math.ceil((totalStampPages - 1) / 2);

  const [curLeft,  curRight]  = spreadToPages(spreadIdx);
  const [nextLeft, nextRight] = spreadToPages(spreadIdx + 1);
  const [,         prevRight] = spreadToPages(Math.max(0, spreadIdx - 1));

  function doFlip(dir: 'fwd' | 'bwd') {
    if (flipping) return;
    setFlipping(dir);
    setTimeout(() => {
      setSpreadIdx(p => dir === 'fwd' ? p + 1 : p - 1);
      setAnimEpoch(e => e + 1); // animate newly revealed stamps
      setFlipping(null);
    }, 640);
  }

  const savePosition = useCallback(async (id: string, x: number, y: number) => {
    setStamps(prev => prev.map(s => s.id === id ? { ...s, positionX: x, positionY: y } : s));
    try {
      await fetch(`/api/passport/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionX: x, positionY: y }),
      });
    } catch { /* ignore */ }
  }, []);

  const btnStyle = (disabled: boolean) => ({
    width: 42, height: 42, borderRadius: 12,
    background: disabled ? '#f1f5f9' : COVER_RED,
    color: disabled ? '#94a3b8' : COVER_GOLD,
    border: 'none', fontSize: 22, fontWeight: 700,
    cursor: disabled ? 'default' as const : 'pointer' as const,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    opacity: disabled ? 0.5 : 1, transition: 'all 0.2s',
  });

  return (
    <main style={{ minHeight: '100vh', padding: '24px 16px', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{
        fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 4,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <BgWavingFlag size={26} />
        <span>Паспорт</span>
      </h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Разгледай своите печати от обиколения свят</p>

      {/* User tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
        {users.map(u => (
          <button
            key={u.id}
            onClick={() => { resumeAudio(); sounds.click(); setActiveUser(u); }}
            style={{
              padding: '8px 20px', borderRadius: 99, fontWeight: 700, fontSize: 13,
              cursor: 'pointer',
              background: activeUser?.id === u.id ? COVER_RED : 'white',
              color:      activeUser?.id === u.id ? COVER_GOLD : '#64748b',
              border:     `2px solid ${activeUser?.id === u.id ? COVER_RED : '#E2E8F0'}`,
              boxShadow:  activeUser?.id === u.id ? `0 4px 16px ${COVER_RED}55` : '0 1px 4px rgba(0,0,0,0.08)',
              transition: 'all 0.2s',
            }}
          >
            {u.displayName}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '64px 0' }}>Зареждане…</div>
      ) : (
        <>
          {/* ── Book spread ── */}
          <div style={{ display: 'flex', justifyContent: 'center', perspective: 1200, marginBottom: 28, height: PH * bookScale + 8, overflow: 'visible' }}>
            <div style={{
              position: 'relative', display: 'flex',
              boxShadow: '0 20px 60px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.25)',
              borderRadius: 4,
              transformOrigin: 'top center',
              transform: `scale(${bookScale})`,
            }}>

              {/* LEFT PAGE */}
              <div style={{
                width: PW, height: PH, borderRadius: '3px 0 0 3px',
                overflow: 'hidden', flexShrink: 0, position: 'relative',
                borderRight: '1.5px solid rgba(0,0,0,0.18)',
                boxShadow: 'inset -8px 0 22px rgba(0,0,0,0.10)',
              }}>
                {curLeft === 'info'
                  ? <InfoPage displayName={activeUser?.displayName ?? ''} userId={activeUser?.id ?? ''} count={stamps.length} avatarConfig={activeUser ? (avatarConfigs[activeUser.id] ?? null) : null} />
                  : <StampsPage stamps={byPage(curLeft)} color={COVER_GOLD} onSave={savePosition} animEpoch={animEpoch} />}
                {curLeft !== 'info' && (
                  <div style={{
                    position: 'absolute', bottom: 8, right: 10,
                    fontSize: 8, color: '#b0a080', fontStyle: 'italic', pointerEvents: 'none',
                  }}>{(curLeft as number) + 1}</div>
                )}
              </div>

              {/* SPINE */}
              <div style={{
                width: 10, height: PH, flexShrink: 0,
                background: `linear-gradient(90deg, ${COVER_DARK} 0%, ${COVER_RED} 45%, ${COVER_DARK} 100%)`,
                boxShadow: 'inset 0 0 6px rgba(0,0,0,0.6)',
              }} />

              {/* RIGHT PAGE */}
              <div style={{
                width: PW, height: PH, borderRadius: '0 3px 3px 0',
                overflow: 'hidden', flexShrink: 0, position: 'relative',
                boxShadow: 'inset 8px 0 22px rgba(0,0,0,0.08)',
              }}>
                <StampsPage stamps={byPage(curRight)} color={COVER_GOLD} onSave={savePosition} animEpoch={animEpoch} />
                <div style={{
                  position: 'absolute', bottom: 8, left: 10,
                  fontSize: 8, color: '#b0a080', fontStyle: 'italic', pointerEvents: 'none',
                }}>{curRight + 1}</div>

                {/* FORWARD FLIP OVERLAY */}
                {flipping === 'fwd' && (
                  <div
                    className="passport-flip-fwd"
                    style={{
                      position: 'absolute', inset: 0,
                      transformStyle: 'preserve-3d',
                      transformOrigin: 'left center',
                      zIndex: 20,
                    }}
                  >
                    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}>
                      <StaticStampsPage stamps={byPage(curRight)} color={COVER_GOLD} />
                    </div>
                    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                      {nextLeft === 'info'
                        ? <InfoPage displayName={activeUser?.displayName ?? ''} userId={activeUser?.id ?? ''} count={stamps.length} avatarConfig={activeUser ? (avatarConfigs[activeUser.id] ?? null) : null} />
                        : <StaticStampsPage stamps={byPage(nextLeft as number)} color={COVER_GOLD} />}
                    </div>
                  </div>
                )}
              </div>

              {/* BACKWARD FLIP OVERLAY */}
              {flipping === 'bwd' && (
                <div
                  className="passport-flip-bwd"
                  style={{
                    position: 'absolute', top: 0, left: 0,
                    width: PW, height: PH,
                    transformStyle: 'preserve-3d',
                    transformOrigin: 'right center',
                    zIndex: 20,
                  }}
                >
                  <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}>
                    {curLeft === 'info'
                      ? <InfoPage displayName={activeUser?.displayName ?? ''} userId={activeUser?.id ?? ''} count={stamps.length} avatarConfig={activeUser ? (avatarConfigs[activeUser.id] ?? null) : null} />
                      : <StaticStampsPage stamps={byPage(curLeft as number)} color={COVER_GOLD} />}
                  </div>
                  <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                    <StaticStampsPage stamps={byPage(prevRight)} color={COVER_GOLD} />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Navigation ── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, marginBottom: 24 }}>
            <button onClick={() => { resumeAudio(); sounds.click(); doFlip('bwd'); }}
                    disabled={spreadIdx === 0 || !!flipping}
                    style={btnStyle(spreadIdx === 0 || !!flipping)}>‹</button>
            <span style={{ fontSize: 12, color: '#64748b', minWidth: 120, textAlign: 'center' }}>
              Стр. {spreadIdx * 2 + 1} – {spreadIdx * 2 + 2}
            </span>
            <button onClick={() => { resumeAudio(); sounds.click(); doFlip('fwd'); }}
                    disabled={spreadIdx >= maxSpread || !!flipping}
                    style={btnStyle(spreadIdx >= maxSpread || !!flipping)}>›</button>
          </div>

          {stamps.length === 0 && (
            <div style={{ textAlign: 'center', padding: '16px 0 32px', color: '#94a3b8' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>✈️</div>
              <div style={{ fontWeight: 600, color: '#64748b', fontSize: 14 }}>Все още няма печати</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Добавете посетени страни от глобуса!</div>
            </div>
          )}
        </>
      )}
    </main>
  );
}
