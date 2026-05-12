'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { UserType, USER_DISPLAY, USER_COLOR } from '@/types';
import { sounds, resumeAudio } from '@/lib/sounds';

interface DiaryEntry {
  id: string;
  user: UserType;
  title: string;
  content: string;
  date: string;
  photoUrl: string | null;
  photoX: number;
  photoY: number;
  photoRot: number;
}

// Draggable polaroid component
function Polaroid({
  entry,
  onMove,
  onRotate,
}: {
  entry: DiaryEntry;
  onMove: (id: string, x: number, y: number) => void;
  onRotate: (id: string, rot: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const dragStart = useRef<{ mx: number; my: number; ox: number; oy: number } | null>(null);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    dragStart.current = { mx: e.clientX, my: e.clientY, ox: entry.photoX, oy: entry.photoY };
    const handleDrag = (ev: MouseEvent) => {
      if (!dragStart.current) return;
      const dx = ev.clientX - dragStart.current.mx;
      const dy = ev.clientY - dragStart.current.my;
      onMove(entry.id, dragStart.current.ox + dx * 0.15, dragStart.current.oy + dy * 0.15);
    };
    const onUp = () => {
      dragStart.current = null;
      window.removeEventListener('mousemove', handleDrag);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', handleDrag);
    window.addEventListener('mouseup', onUp);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    dragStart.current = { mx: t.clientX, my: t.clientY, ox: entry.photoX, oy: entry.photoY };
    const onTouchMove = (ev: TouchEvent) => {
      if (!dragStart.current) return;
      const touch = ev.touches[0];
      const dx = touch.clientX - dragStart.current.mx;
      const dy = touch.clientY - dragStart.current.my;
      onMove(entry.id, dragStart.current.ox + dx * 0.15, dragStart.current.oy + dy * 0.15);
    };
    const onTouchEnd = () => {
      dragStart.current = null;
      window.removeEventListener('touchmove', onTouchMove);
      window.removeEventListener('touchend', onTouchEnd);
    };
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onTouchEnd);
  };

  if (!entry.photoUrl) return null;

  return (
    <div
      ref={ref}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      className="absolute select-none cursor-grab active:cursor-grabbing"
      style={{
        left: `${Math.max(0, Math.min(80, entry.photoX))}%`,
        top: `${Math.max(0, Math.min(80, entry.photoY))}%`,
        transform: `rotate(${entry.photoRot}deg)`,
        zIndex: 10,
        filter: 'drop-shadow(2px 4px 8px rgba(0,0,0,0.22))',
      }}
      title="Плъзни поляроида"
    >
      {/* Tape strip */}
      <div style={{
        position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
        width: 48, height: 18,
        background: 'rgba(255,255,190,0.72)',
        borderRadius: 2,
        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        zIndex: 11,
      }} />
      {/* Polaroid frame */}
      <div style={{
        background: 'white',
        padding: '6px 6px 20px 6px',
        boxShadow: '1px 2px 8px rgba(0,0,0,0.18)',
        border: '1px solid #e5e7eb',
        borderRadius: 2,
        width: 120,
      }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={entry.photoUrl}
          alt={entry.title}
          style={{ width: '100%', height: 100, objectFit: 'cover', display: 'block' }}
          draggable={false}
        />
      </div>
    </div>
  );
}

// Lined notebook paper background lines
function NotebookLines({ lineCount = 24 }: { lineCount?: number }) {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {Array.from({ length: lineCount }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 52,
            right: 12,
            top: 60 + i * 28,
            height: 1,
            background: 'rgba(100,149,237,0.18)',
          }}
        />
      ))}
      {/* Red margin line */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 48, width: 1,
        background: 'rgba(220,80,80,0.22)',
      }} />
    </div>
  );
}

export default function DnevnikPage() {
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeUser, setActiveUser] = useState<UserType>('tati');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', content: '', date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/diary')
      .then(r => r.ok ? r.json() : [])
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  const userEntries = entries.filter(e => e.user === activeUser);

  const handleSave = useCallback(async () => {
    if (!form.title.trim() || !form.content.trim()) return;
    setSaving(true);
    try {
      if (editingId) {
        const r = await fetch(`/api/diary/${editingId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form }),
        });
        if (r.ok) {
          const updated = await r.json();
          setEntries(p => p.map(e => e.id === editingId ? { ...e, ...updated } : e));
        }
      } else {
        const r = await fetch('/api/diary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, user: activeUser }),
        });
        if (r.ok) {
          const created = await r.json();
          setEntries(p => [created, ...p]);
        }
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ title: '', content: '', date: new Date().toISOString().slice(0, 10) });
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }, [form, editingId, activeUser]);

  const handleDelete = useCallback(async (id: string) => {
    await fetch(`/api/diary/${id}`, { method: 'DELETE' });
    setEntries(p => p.filter(e => e.id !== id));
  }, []);

  const handlePolaroidMove = useCallback(async (id: string, x: number, y: number) => {
    setEntries(p => p.map(e => e.id === id ? { ...e, photoX: x, photoY: y } : e));
    await fetch(`/api/diary/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoX: x, photoY: y }),
    });
  }, []);

  const startEdit = (entry: DiaryEntry) => {
    setEditingId(entry.id);
    setForm({ title: entry.title, content: entry.content, date: entry.date.slice(0, 10) });
    setShowForm(true);
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return d; }
  };

  return (
    <main className="min-h-screen pb-24 px-3" style={{ background: 'linear-gradient(135deg, #f5f0e8 0%, #ede8d9 100%)' }}>
      {/* Load handwriting font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&display=swap');
        .diary-font { font-family: 'Caveat', cursive !important; }
      `}</style>

      {/* Header */}
      <header className="w-full max-w-2xl mx-auto pt-5 pb-3 text-center">
        <h1 className="diary-font text-4xl font-bold" style={{ color: '#2D1B0E', letterSpacing: '0.01em' }}>
          📓 Пътешественически дневник
        </h1>
        <p className="text-sm mt-1" style={{ color: '#7A5C3A', fontFamily: 'Caveat, cursive' }}>
          Запиши своите приключения
        </p>
      </header>

      {/* User switcher */}
      <div className="flex gap-3 max-w-lg mx-auto mb-4">
        {(['tati', 'iva'] as UserType[]).map(u => (
          <button
            key={u}
            onClick={() => { sounds.click(); resumeAudio(); setActiveUser(u); }}
            className="flex-1 py-2 rounded-xl font-bold text-sm transition-all diary-font text-lg"
            style={{
              background: activeUser === u ? USER_COLOR[u] : 'rgba(255,255,255,0.55)',
              color: activeUser === u ? 'white' : '#64748b',
              border: `2px solid ${activeUser === u ? USER_COLOR[u] : 'rgba(0,0,0,0.08)'}`,
              boxShadow: activeUser === u ? `0 3px 10px ${USER_COLOR[u]}40` : 'none',
            }}
          >
            {USER_DISPLAY[u]}
          </button>
        ))}
      </div>

      {/* Add button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={() => { sounds.click(); resumeAudio(); setEditingId(null); setForm({ title: '', content: '', date: new Date().toISOString().slice(0, 10) }); setShowForm(true); }}
          className="diary-font text-xl px-6 py-2.5 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95"
          style={{ background: USER_COLOR[activeUser], color: 'white', boxShadow: `0 4px 14px ${USER_COLOR[activeUser]}50` }}
        >
          ✏️ Нов запис
        </button>
      </div>

      {/* Add/Edit form */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div
            className="w-full max-w-lg mx-4 rounded-2xl p-6 relative"
            style={{
              background: '#FFF9F0',
              border: '2px solid rgba(0,0,0,0.08)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.25)',
              transform: 'rotate(-0.5deg)',
            }}
          >
            <NotebookLines lineCount={16} />
            <div className="relative" style={{ zIndex: 2 }}>
              <h2 className="diary-font text-3xl font-bold mb-4" style={{ color: '#2D1B0E' }}>
                {editingId ? '✏️ Редактирай запис' : '✏️ Нов запис'}
              </h2>
              <input
                type="text"
                placeholder="Заглавие…"
                value={form.title}
                onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                className="diary-font text-xl w-full mb-3 px-3 py-2 rounded-lg border-0 border-b-2 bg-transparent outline-none"
                style={{ borderColor: USER_COLOR[activeUser], color: '#2D1B0E', fontSize: 22 }}
              />
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
                className="diary-font text-base w-full mb-3 px-3 py-1.5 rounded-lg outline-none bg-transparent border"
                style={{ borderColor: 'rgba(0,0,0,0.12)', color: '#5C3D1A', fontSize: 16 }}
              />
              <textarea
                placeholder="Разкажи за твоето приключение…"
                value={form.content}
                onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
                rows={7}
                className="diary-font text-lg w-full px-3 py-2 rounded-lg border-0 bg-transparent outline-none resize-none"
                style={{ color: '#2D1B0E', lineHeight: '28px', fontSize: 18 }}
              />
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleSave}
                  disabled={saving || !form.title.trim() || !form.content.trim()}
                  className="flex-1 diary-font text-xl py-2.5 rounded-xl font-bold transition-all"
                  style={{ background: USER_COLOR[activeUser], color: 'white', opacity: saving ? 0.7 : 1 }}
                >
                  {saving ? 'Запазване…' : '💾 Запази'}
                </button>
                <button
                  onClick={() => { setShowForm(false); setEditingId(null); }}
                  className="diary-font text-xl px-5 py-2.5 rounded-xl font-bold transition-all"
                  style={{ background: 'rgba(0,0,0,0.07)', color: '#64748b' }}
                >
                  Отказ
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Diary entries */}
      {loading && (
        <div className="text-center diary-font text-xl mt-12" style={{ color: '#7A5C3A' }}>
          Зареждане на дневника…
        </div>
      )}

      {!loading && userEntries.length === 0 && (
        <div className="text-center mt-12">
          <div className="diary-font text-3xl mb-2" style={{ color: '#7A5C3A' }}>Все още няма записи</div>
          <div className="diary-font text-lg" style={{ color: '#A08060' }}>
            Натисни „Нов запис" за да започнеш своя дневник ✨
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-8">
        {userEntries.map((entry, idx) => (
          <div
            key={entry.id}
            className="relative rounded-2xl overflow-visible"
            style={{
              background: idx % 2 === 0 ? '#FFF9F0' : '#F8F4EC',
              border: '1px solid rgba(0,0,0,0.07)',
              boxShadow: '2px 4px 16px rgba(0,0,0,0.10)',
              transform: `rotate(${idx % 2 === 0 ? '-0.4' : '0.4'}deg)`,
              minHeight: 200,
              padding: '24px 24px 24px 64px',
            }}
          >
            <NotebookLines lineCount={Math.ceil((entry.content.length / 55) + 4)} />

            {/* Polaroid photo */}
            {entry.photoUrl && (
              <Polaroid
                entry={entry}
                onMove={handlePolaroidMove}
                onRotate={(id, rot) => setEntries(p => p.map(e => e.id === id ? { ...e, photoRot: rot } : e))}
              />
            )}

            <div className="relative" style={{ zIndex: 1 }}>
              {/* Date */}
              <div className="diary-font text-sm mb-1" style={{ color: '#B08050', fontSize: 15 }}>
                {formatDate(entry.date)}
              </div>
              {/* Title */}
              <h3 className="diary-font font-bold mb-2" style={{ fontSize: 28, color: '#2D1B0E', lineHeight: 1.2 }}>
                {entry.title}
              </h3>
              {/* Content — reflows naturally below polaroid */}
              <div
                className="diary-font"
                style={{
                  fontSize: 18,
                  color: '#2D1B0E',
                  lineHeight: '28px',
                  whiteSpace: 'pre-wrap',
                  paddingRight: entry.photoUrl ? '130px' : 0,
                }}
              >
                {entry.content}
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => startEdit(entry)}
                  className="diary-font text-sm px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: 'rgba(0,0,0,0.06)', color: '#5C3D1A' }}
                >
                  ✏️ Редактирай
                </button>
                <button
                  onClick={() => handleDelete(entry.id)}
                  className="diary-font text-sm px-3 py-1.5 rounded-lg transition-all"
                  style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626' }}
                >
                  🗑️ Изтрий
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
