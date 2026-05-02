'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import dynamic from 'next/dynamic';
import { UserType, USER_DISPLAY, USER_COLOR } from '@/types';
import { sounds, resumeAudio } from '@/lib/sounds';

const AvatarRPM = dynamic(() => import('@/components/AvatarRPM/AvatarRPM'), { ssr: false });

// Public RPM demo endpoint — replace with your own partner subdomain for production.
const RPM_BASE = 'https://demo.readyplayer.me/avatar';

interface AvatarRecord {
  avatarUrl: string | null;
}

/** Build RPM URL for the given user gender */
function rpmUrl(user: UserType, redirectUrl?: string): string {
  const gender = user === 'tati' ? 'male' : 'female';
  let url = `${RPM_BASE}?frameApi&clearCache&gender=${gender}&bodyType=fullbody`;
  if (redirectUrl) url += `&redirectUrl=${encodeURIComponent(redirectUrl)}`;
  return url;
}

/**
 * On iOS Safari, third-party iframes are blocked by ITP and camera
 * permissions inside iframes are disabled. Detect this case so we can
 * open RPM in a full tab instead.
 */
function needsRedirectMode(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(ua as string & { MSStream?: unknown }).MSStream;
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua);
  const isSmallScreen = typeof window !== 'undefined' && window.innerWidth < 768;
  return isIOS || isSafari || isSmallScreen;
}

export default function AvatarPage() {
  const [activeUser, setActiveUser]   = useState<UserType>('tati');
  const [avatars, setAvatars]         = useState<Record<UserType, AvatarRecord>>({
    tati: { avatarUrl: null },
    iva:  { avatarUrl: null },
  });
  const [showCreator, setShowCreator] = useState(false);
  const [saving, setSaving]           = useState(false);
  const [saved,  setSaved]            = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Load persisted avatar URLs on mount ────────────────────────────────────
  useEffect(() => {
    fetch('/api/avatar').then(r => r.json()).then(data => {
      setAvatars({
        tati: { avatarUrl: data.tati?.avatarUrl ?? null },
        iva:  { avatarUrl: data.iva?.avatarUrl  ?? null },
      });
    }).catch(() => {});
  }, []);

  // ── Handle redirect return from RPM (mobile/Safari flow) ──────────────────
  // RPM redirects back to /avatar?avatarUrl=…  or  /avatar?id=…
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const returnedUrl = params.get('avatarUrl');
    const returnedId  = params.get('id');
    const url = returnedUrl ?? (returnedId ? `https://models.readyplayer.me/${returnedId}.glb` : null);

    if (url) {
      const user = (sessionStorage.getItem('rpm_user') as UserType | null) ?? 'tati';
      sessionStorage.removeItem('rpm_user');
      // Clean the URL params without triggering navigation
      window.history.replaceState({}, '', '/avatar');
      // Optimistically update UI then persist
      setAvatars(prev => ({ ...prev, [user]: { avatarUrl: url } }));
      setActiveUser(user);
      persistAvatar(user, url);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Listen for postMessage from iframe (desktop flow) ─────────────────────
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      let data = event.data as unknown;
      if (typeof data === 'string') {
        try { data = JSON.parse(data); } catch { return; }
      }
      const d = data as Record<string, unknown>;
      if (d?.source !== 'readyplayerme') return;
      if (d?.eventName === 'v1.avatar.exported') {
        const url = (d?.data as Record<string, string>)?.url;
        if (url) {
          setShowCreator(false);
          setAvatars(prev => ({ ...prev, [activeUser]: { avatarUrl: url } }));
          persistAvatar(activeUser, url);
        }
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeUser]);

  // ── Subscribe RPM iframe to events once it loads ───────────────────────────
  const onIframeLoad = useCallback(() => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify({ target: 'readyplayerme', type: 'subscribe', eventName: 'v1.avatar.exported' }),
      '*',
    );
  }, []);

  // ── Persist avatar URL to DB ───────────────────────────────────────────────
  const persistAvatar = useCallback(async (user: UserType, avatarUrl: string) => {
    setSaving(true);
    resumeAudio(); sounds.add();
    try {
      await fetch('/api/avatar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, avatarUrl }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    setSaving(false);
  }, []);

  // ── Open avatar creator ────────────────────────────────────────────────────
  const openCreator = useCallback(() => {
    resumeAudio(); sounds.click();

    if (needsRedirectMode()) {
      // iOS / Safari / mobile: open RPM in a new full tab so the browser
      // can grant camera permission properly. RPM redirects back with ?avatarUrl=
      sessionStorage.setItem('rpm_user', activeUser);
      const returnUrl = `${window.location.origin}/avatar`;
      window.open(rpmUrl(activeUser, returnUrl), '_blank', 'noopener');
    } else {
      // Desktop: render RPM inside the full-screen iframe modal
      setShowCreator(true);
    }
  }, [activeUser]);

  const current = avatars[activeUser];
  const color   = USER_COLOR[activeUser];

  return (
    <main className="min-h-screen px-4 py-6 max-w-2xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-800 mb-1">🧑 Моят герой</h1>
      <p className="text-slate-500 text-sm mb-5">Създай и персонализирай своя 3D герой</p>

      {/* User tabs */}
      <div className="flex gap-2 mb-6">
        {(['tati', 'iva'] as UserType[]).map(u => (
          <button
            key={u}
            onClick={() => { sounds.click(); resumeAudio(); setActiveUser(u); setSaved(false); }}
            className="px-5 py-2 rounded-full font-bold text-sm transition-all"
            style={{
              background: activeUser === u ? USER_COLOR[u] : 'white',
              color: activeUser === u ? 'white' : '#64748b',
              border: `2px solid ${activeUser === u ? USER_COLOR[u] : '#E2E8F0'}`,
              boxShadow: activeUser === u ? `0 4px 16px ${USER_COLOR[u]}40` : '0 1px 4px rgba(0,0,0,0.08)',
            }}
          >
            {USER_DISPLAY[u]}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-6 items-start">
        {/* ── Avatar preview ─────────────────────────────────────────────── */}
        <div
          className="flex flex-col items-center gap-3 p-5 rounded-2xl bg-white shadow-md"
          style={{ border: `2px solid ${color}28`, minWidth: 200 }}
        >
          {current.avatarUrl ? (
            <>
              <AvatarRPM avatarUrl={current.avatarUrl} width={240} height={320} />
              <span className="font-bold text-slate-700 text-sm">{USER_DISPLAY[activeUser]}</span>
              <span className="text-xs text-slate-400">Завърти / Приближи</span>
            </>
          ) : (
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-xl"
              style={{
                width: 240, height: 320,
                background: `linear-gradient(135deg, ${color}12, ${color}22)`,
                border: `2px dashed ${color}44`,
              }}
            >
              <span style={{ fontSize: 52 }}>🧑‍🚀</span>
              <span className="text-slate-500 text-sm text-center px-4 leading-snug">
                Все още нямаш герой.<br/>Натисни <strong>Създай</strong>!
              </span>
            </div>
          )}
        </div>

        {/* ── Actions + info ─────────────────────────────────────────────── */}
        <div className="flex-1 space-y-4">
          <div
            className="rounded-2xl p-4"
            style={{ background: `${color}0e`, border: `1.5px solid ${color}28` }}
          >
            <p className="font-bold text-slate-700 mb-1" style={{ color }}>
              🎨 Ready Player Me
            </p>
            <p className="text-xs text-slate-500 leading-relaxed">
              Използвай безплатния 3D avatar creator. Избери прическа, дрехи, аксесоари и цвят на кожата — резултатът се запазва автоматично.
            </p>
          </div>

          <button
            onClick={openCreator}
            className="w-full py-3 rounded-2xl font-bold text-white text-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
            style={{ background: color, boxShadow: `0 4px 16px ${color}40` }}
          >
            {current.avatarUrl ? '✏️ Промени героя' : '✨ Създай герой'}
          </button>

          {saving && (
            <p className="text-center text-xs text-slate-400 animate-pulse">Запазване…</p>
          )}
          {saved && (
            <p className="text-center text-xs font-semibold text-emerald-600">✓ Героят е запазен!</p>
          )}

          {/* Feature list */}
          <div className="space-y-1.5 text-xs text-slate-500">
            {[
              '✅ Реалистичен 3D модел',
              '✅ Персонализирани дрехи и прическа',
              '✅ Мъжки / женски avatar',
              '✅ Завъртане и приближаване',
              '✅ Автоматично запазване в базата',
            ].map(t => <p key={t}>{t}</p>)}
          </div>
        </div>
      </div>

      {/* ── Desktop iframe creator modal ────────────────────────────────────── */}
      {showCreator && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'grid',
            gridTemplateRows: 'auto auto 1fr',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 text-white font-bold text-sm"
            style={{ background: color }}
          >
            <span>🎨 Създай герой — {USER_DISPLAY[activeUser]}</span>
            <button
              onClick={() => setShowCreator(false)}
              className="text-white text-xl font-bold leading-none hover:opacity-75 transition-opacity"
              aria-label="Затвори"
            >
              ✕
            </button>
          </div>

          {/* Hint bar */}
          <div
            className="flex items-center gap-2 px-4 py-2 text-xs font-medium"
            style={{ background: `${color}22`, color: '#334155' }}
          >
            <span>💡</span>
            <span>
              Персонализирай героя и натисни <strong>„Next"</strong> → <strong>„Done"</strong>, за да запазиш.
            </span>
          </div>

          {/* RPM iframe */}
          <iframe
            ref={iframeRef}
            src={rpmUrl(activeUser)}
            onLoad={onIframeLoad}
            allow="camera *; microphone *; xr-spatial-tracking; gyroscope; accelerometer"
            allowFullScreen
            style={{ width: '100%', height: '100%', border: 'none', background: '#111' }}
            title="Ready Player Me avatar creator"
          />
        </div>
      )}
    </main>
  );
}
