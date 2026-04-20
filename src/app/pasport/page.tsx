'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { UserType, USER_DISPLAY } from '@/types';
import { BG_NAMES } from '@/data/countryNamesBg';
import { sounds, resumeAudio } from '@/lib/sounds';

interface StampCountry { name: string; isoCode: string; capital: string; }
interface Stamp {
  id: string; user: string; countryId: string; stampedAt: string;
  page: number; positionX: number; positionY: number; rotation: number;
  country: StampCountry;
}

const COVER_RED  = '#6B1520';
const COVER_DARK = '#3e0a13';
const COVER_GOLD = '#C9A227';
const PW = 220;
const PH = 320;
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

function DraggableStamp({ stamp, color, onSave, getPage }: {
  stamp: Stamp;
  color: string;
  onSave: (id: string, x: number, y: number) => void;
  getPage: () => HTMLDivElement | null;
}) {
  const divRef   = useRef<HTMLDivElement>(null);
  const pos      = useRef({ x: stamp.positionX, y: stamp.positionY });
  const dragging = useRef(false);
  const lastMouse= useRef({ x: 0, y: 0 });
  const [hover, setHover] = useState(false);

  useEffect(() => {
    pos.current = { x: stamp.positionX, y: stamp.positionY };
    if (divRef.current) {
      divRef.current.style.left = `${stamp.positionX}%`;
      divRef.current.style.top  = `${stamp.positionY}%`;
    }
  }, [stamp.id, stamp.positionX, stamp.positionY]);

  function onMouseDown(e: React.MouseEvent) {
    const pageEl = getPage();
    if (!pageEl) return;
    const page: HTMLDivElement = pageEl;
    e.preventDefault();
    dragging.current  = true;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    resumeAudio();

    function onMove(ev: MouseEvent) {
      if (!dragging.current || !divRef.current) return;
      const rect = page.getBoundingClientRect();
      const dx = ((ev.clientX - lastMouse.current.x) / rect.width)  * 100;
      const dy = ((ev.clientY - lastMouse.current.y) / rect.height) * 100;
      lastMouse.current = { x: ev.clientX, y: ev.clientY };
      pos.current.x = Math.max(7, Math.min(93, pos.current.x + dx));
      pos.current.y = Math.max(7, Math.min(93, pos.current.y + dy));
      divRef.current.style.left = `${pos.current.x}%`;
      divRef.current.style.top  = `${pos.current.y}%`;
    }

    function onUp() {
      if (!dragging.current) return;
      dragging.current = false;
      sounds.stamp();
      onSave(stamp.id, pos.current.x, pos.current.y);
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  return (
    <div
      ref={divRef}
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        position: 'absolute',
        left: `${stamp.positionX}%`,
        top: `${stamp.positionY}%`,
        width: 72, height: 72,
        transform: `translate(-50%,-50%) rotate(${stamp.rotation}deg) scale(${hover ? 1.1 : 1})`,
        cursor: 'grab',
        transition: 'transform 0.15s ease, filter 0.15s',
        userSelect: 'none',
        filter: `drop-shadow(0 2px 6px ${color}55)`,
        zIndex: hover ? 10 : 1,
      }}
    >
      <InkStamp stamp={stamp} color={color} />
    </div>
  );
}

// Interactive page — each has its own internal ref for drag calculations
function StampsPage({ stamps, color, onSave }: {
  stamps: Stamp[];
  color: string;
  onSave: (id: string, x: number, y: number) => void;
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
      {stamps.map(s => (
        <DraggableStamp key={s.id} stamp={s} color={color} onSave={onSave} getPage={() => pageRef.current} />
      ))}
    </div>
  );
}

// Non-interactive snapshot used in flip animation faces
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

function InfoPage({ user, count }: { user: UserType; count: number }) {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: 'linear-gradient(160deg, #fffdf5 0%, #faf6e8 60%, #f2edd8 100%)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 8, padding: 24,
    }}>
      <div style={{ fontSize: 34, lineHeight: 1 }}>🌹</div>
      <div style={{
        fontSize: 8.5, fontWeight: 800, letterSpacing: '0.2em', color: COVER_GOLD,
        textTransform: 'uppercase', textAlign: 'center', lineHeight: 1.5,
      }}>
        Република<br/>България
      </div>
      <div style={{ width: 40, height: 1, background: `${COVER_GOLD}80`, marginTop: 2 }} />
      <div style={{ fontSize: 15, fontWeight: 700, color: '#3d2a0f', marginTop: 4 }}>
        {USER_DISPLAY[user]}
      </div>
      <div style={{ fontSize: 9, color: '#8a7a60', marginTop: 2 }}>
        {count} посетени държави
      </div>
      <div style={{ fontSize: 7.5, color: '#c0b090', fontStyle: 'italic', marginTop: 16, textAlign: 'center', lineHeight: 1.6 }}>
        ПАСПОРТ НА ПЪТЕШЕСТВЕНИКА
      </div>
    </div>
  );
}

// Determines left/right stamp page numbers for a given spread
// spread 0: left = 'info', right = stamp page 0
// spread n>0: left = stamp page (2n-1), right = stamp page (2n)
function spreadToPages(idx: number): [number | 'info', number] {
  if (idx === 0) return ['info', 0];
  return [idx * 2 - 1, idx * 2];
}

export default function PasportPage() {
  const [activeUser, setActiveUser] = useState<UserType>('tati');
  const [stamps, setStamps]         = useState<Stamp[]>([]);
  const [loading, setLoading]       = useState(true);
  const [spreadIdx, setSpreadIdx]   = useState(0);
  const [flipping, setFlipping]     = useState<'fwd' | 'bwd' | null>(null);

  useEffect(() => {
    setLoading(true);
    setSpreadIdx(0);
    fetch(`/api/passport?user=${activeUser}`)
      .then(r => r.json())
      .then((data: Stamp[]) => { setStamps(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [activeUser]);

  const byPage = useCallback((pg: number) => stamps.filter(s => s.page === pg), [stamps]);

  const totalStampPages = Math.max(1, Math.ceil(stamps.length / STAMPS_PER_PAGE));
  // spread 0 consumes 1 stamp page; each additional spread consumes 2
  const maxSpread = Math.ceil((totalStampPages - 1) / 2);

  const [curLeft,  curRight]  = spreadToPages(spreadIdx);
  const [nextLeft, nextRight] = spreadToPages(spreadIdx + 1);
  const [,         prevRight] = spreadToPages(Math.max(0, spreadIdx - 1));

  function doFlip(dir: 'fwd' | 'bwd') {
    if (flipping) return;
    setFlipping(dir);
    setTimeout(() => {
      setSpreadIdx(p => dir === 'fwd' ? p + 1 : p - 1);
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
      <h1 style={{ fontSize: 22, fontWeight: 800, color: '#1e293b', marginBottom: 4 }}>📕 Паспорт</h1>
      <p style={{ fontSize: 13, color: '#64748b', marginBottom: 24 }}>Разгледай своите печати от обиколения свят</p>

      {/* User tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {(['tati', 'iva'] as UserType[]).map(u => (
          <button
            key={u}
            onClick={() => { resumeAudio(); sounds.click(); setActiveUser(u); }}
            style={{
              padding: '8px 20px', borderRadius: 99, fontWeight: 700, fontSize: 13,
              cursor: 'pointer',
              background: activeUser === u ? COVER_RED : 'white',
              color:      activeUser === u ? COVER_GOLD : '#64748b',
              border:     `2px solid ${activeUser === u ? COVER_RED : '#E2E8F0'}`,
              boxShadow:  activeUser === u ? `0 4px 16px ${COVER_RED}55` : '0 1px 4px rgba(0,0,0,0.08)',
              transition: 'all 0.2s',
            }}
          >
            {USER_DISPLAY[u]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: '#94a3b8', padding: '64px 0' }}>Зареждане…</div>
      ) : (
        <>
          {/* ── Book spread ── */}
          <div style={{ display: 'flex', justifyContent: 'center', perspective: 1200, marginBottom: 28 }}>
            <div style={{
              position: 'relative', display: 'flex',
              boxShadow: '0 20px 60px rgba(0,0,0,0.45), 0 4px 16px rgba(0,0,0,0.25)',
              borderRadius: 4,
            }}>

              {/* LEFT PAGE */}
              <div style={{
                width: PW, height: PH, borderRadius: '3px 0 0 3px',
                overflow: 'hidden', flexShrink: 0, position: 'relative',
                borderRight: '1.5px solid rgba(0,0,0,0.18)',
                boxShadow: 'inset -8px 0 22px rgba(0,0,0,0.10)',
              }}>
                {curLeft === 'info'
                  ? <InfoPage user={activeUser} count={stamps.length} />
                  : <StampsPage stamps={byPage(curLeft)} color={COVER_GOLD} onSave={savePosition} />}
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
                <StampsPage stamps={byPage(curRight)} color={COVER_GOLD} onSave={savePosition} />
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
                    {/* Front — current right page */}
                    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}>
                      <StaticStampsPage stamps={byPage(curRight)} color={COVER_GOLD} />
                    </div>
                    {/* Back — next spread's left page */}
                    <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}>
                      {nextLeft === 'info'
                        ? <InfoPage user={activeUser} count={stamps.length} />
                        : <StaticStampsPage stamps={byPage(nextLeft as number)} color={COVER_GOLD} />}
                    </div>
                  </div>
                )}
              </div>

              {/* BACKWARD FLIP OVERLAY — on left page area */}
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
                  {/* Front — current left page */}
                  <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden' }}>
                    {curLeft === 'info'
                      ? <InfoPage user={activeUser} count={stamps.length} />
                      : <StaticStampsPage stamps={byPage(curLeft as number)} color={COVER_GOLD} />}
                  </div>
                  {/* Back — previous spread's right page */}
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
