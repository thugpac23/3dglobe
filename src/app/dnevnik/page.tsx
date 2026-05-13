'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { UserProfile } from '@/types';
import { fetchUsers } from '@/lib/api';
import { sounds, resumeAudio } from '@/lib/sounds';
import UserCard from '@/components/XPBar/XPBar';

interface DiaryPhoto {
  id: string;
  diaryEntryId: string;
  url: string;
  positionX: number;
  positionY: number;
  rotation: number;
  caption: string;
}

interface DiaryEntry {
  id: string;
  userId: string;
  title: string;
  content: string;
  date: string;
  photos: DiaryPhoto[];
}

// ── Image compression: resize to max 1200px and JPEG quality 0.82 ──
async function compressImage(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  const ratio = Math.min(1, maxDim / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d unavailable');
  ctx.drawImage(img, 0, 0, w, h);
  return canvas.toDataURL('image/jpeg', quality);
}

// ── Polaroid: absolutely positioned on the entry card, freely draggable ──
function Polaroid({
  photo,
  isDeleting,
  onUpdate,
  onOpen,
  containerRef,
}: {
  photo: DiaryPhoto;
  isDeleting: boolean;
  onUpdate: (id: string, patch: Partial<DiaryPhoto>) => void;
  onOpen: (photo: DiaryPhoto) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [dragOffset, setDragOffset] = useState<{ x: number; y: number } | null>(null);
  const dragState = useRef<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const lastTapRef = useRef<number>(0);
  const [editingCaption, setEditingCaption] = useState(false);
  const [captionDraft, setCaptionDraft] = useState(photo.caption);

  useEffect(() => { setCaptionDraft(photo.caption); }, [photo.caption]);

  const beginDrag = useCallback((clientX: number, clientY: number) => {
    dragState.current = {
      startX: clientX,
      startY: clientY,
      baseX: photo.positionX,
      baseY: photo.positionY,
    };
    setDragOffset({ x: 0, y: 0 });
  }, [photo.positionX, photo.positionY]);

  const moveDrag = useCallback((clientX: number, clientY: number) => {
    if (!dragState.current) return;
    setDragOffset({
      x: clientX - dragState.current.startX,
      y: clientY - dragState.current.startY,
    });
  }, []);

  // endDrag: compute new position as (basePos + delta) in % of container.
  // This preserves grab offset — no jump on release.
  const endDrag = useCallback((clientX: number, clientY: number) => {
    if (!dragState.current || !containerRef.current) {
      dragState.current = null;
      setDragOffset(null);
      return;
    }
    const rect = containerRef.current.getBoundingClientRect();
    const dxPct = ((clientX - dragState.current.startX) / rect.width) * 100;
    const dyPct = ((clientY - dragState.current.startY) / rect.height) * 100;
    const newX = dragState.current.baseX + dxPct;
    const newY = dragState.current.baseY + dyPct;
    dragState.current = null;
    setDragOffset(null);
    onUpdate(photo.id, { positionX: newX, positionY: newY });
  }, [containerRef, onUpdate, photo.id]);

  // Mouse drag — starts only after 4px threshold so clicks pass through.
  const onMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.polaroid-no-drag')) return;
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    let started = false;
    const onMove = (ev: MouseEvent) => {
      if (!started) {
        if (Math.abs(ev.clientX - startX) < 4 && Math.abs(ev.clientY - startY) < 4) return;
        started = true;
        beginDrag(startX, startY);
      }
      ev.preventDefault();
      moveDrag(ev.clientX, ev.clientY);
    };
    const onUp = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (started) endDrag(ev.clientX, ev.clientY);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  // Touch drag with double-tap detection.
  const onTouchStart = (e: React.TouchEvent) => {
    if ((e.target as HTMLElement).closest('.polaroid-no-drag')) return;
    const t = e.touches[0];
    const startX = t.clientX;
    const startY = t.clientY;
    const now = Date.now();
    const isDoubleTap = now - lastTapRef.current < 350;
    lastTapRef.current = now;
    let started = false;
    const onMove = (ev: TouchEvent) => {
      const tt = ev.touches[0];
      if (!started) {
        if (Math.abs(tt.clientX - startX) < 6 && Math.abs(tt.clientY - startY) < 6) return;
        started = true;
        beginDrag(startX, startY);
      }
      ev.preventDefault();
      moveDrag(tt.clientX, tt.clientY);
    };
    const onUp = (ev: TouchEvent) => {
      window.removeEventListener('touchmove', onMove);
      window.removeEventListener('touchend', onUp);
      window.removeEventListener('touchcancel', onUp);
      if (started) {
        endDrag(ev.changedTouches[0].clientX, ev.changedTouches[0].clientY);
      } else if (isDoubleTap) {
        onOpen(photo);
      }
    };
    window.addEventListener('touchmove', onMove, { passive: false });
    window.addEventListener('touchend', onUp);
    window.addEventListener('touchcancel', onUp);
  };

  const commitCaption = () => {
    setEditingCaption(false);
    if (captionDraft !== photo.caption) onUpdate(photo.id, { caption: captionDraft });
  };

  return (
    <div
      onMouseDown={onMouseDown}
      onTouchStart={onTouchStart}
      className="select-none"
      style={{
        position: 'absolute',
        left: `${photo.positionX}%`,
        top: `${photo.positionY}%`,
        width: 168,
        background: 'white',
        padding: '8px 8px 28px 8px',
        boxShadow: dragOffset
          ? '0 14px 30px rgba(0,0,0,0.32)'
          : '2px 4px 12px rgba(0,0,0,0.18)',
        border: '1px solid rgba(0,0,0,0.06)',
        borderRadius: 2,
        cursor: dragOffset ? 'grabbing' : 'grab',
        transform: isDeleting
          ? `rotate(${photo.rotation}deg) scale(0.6)`
          : `rotate(${photo.rotation}deg) translate(${dragOffset?.x ?? 0}px, ${dragOffset?.y ?? 0}px)`,
        opacity: isDeleting ? 0 : 1,
        transition: isDeleting
          ? 'opacity 0.28s ease, transform 0.28s ease'
          : dragOffset ? 'none' : 'transform 0.25s ease, box-shadow 0.2s',
        zIndex: dragOffset ? 100 : 10,
        touchAction: 'none',
        pointerEvents: isDeleting ? 'none' : 'auto',
      }}
      title="Плъзни за преместване · двоен клик за уголемяване"
    >
      {/* Tape strip */}
      <div style={{
        position: 'absolute',
        top: -10,
        left: '50%',
        transform: 'translateX(-50%) rotate(-4deg)',
        width: 64,
        height: 20,
        background: 'rgba(255, 240, 160, 0.72)',
        borderLeft: '1px dashed rgba(0,0,0,0.05)',
        borderRight: '1px dashed rgba(0,0,0,0.05)',
        boxShadow: '0 1px 3px rgba(0,0,0,0.10)',
        zIndex: 2,
      }} />

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photo.url}
        alt={photo.caption || 'Спомен'}
        draggable={false}
        onDoubleClick={(e) => { e.stopPropagation(); onOpen(photo); }}
        style={{
          width: '100%',
          height: 136,
          objectFit: 'cover',
          display: 'block',
          background: '#f4f4f4',
          cursor: 'inherit',
        }}
      />

      {/* Caption */}
      <div className="polaroid-no-drag" style={{ marginTop: 6, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {editingCaption ? (
          <input
            autoFocus
            value={captionDraft}
            onChange={(e) => setCaptionDraft(e.target.value)}
            onBlur={commitCaption}
            onKeyDown={(e) => { if (e.key === 'Enter') commitCaption(); }}
            placeholder="Място / описание"
            className="diary-font"
            style={{ width: '100%', fontSize: 17, textAlign: 'center', background: 'transparent', border: 'none', outline: 'none', color: '#2D1B0E' }}
          />
        ) : (
          <div
            onClick={(e) => { e.stopPropagation(); setEditingCaption(true); }}
            className="diary-font"
            style={{ width: '100%', fontSize: 17, textAlign: 'center', color: photo.caption ? '#2D1B0E' : '#A89478', cursor: 'text', lineHeight: 1.1 }}
          >
            {photo.caption || '…'}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Notebook paper background — always at least 20 lines ──
function NotebookLines({ height }: { height: number }) {
  const lineCount = Math.max(Math.ceil(height / 30), 20);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 0 }}>
      {Array.from({ length: lineCount }).map((_, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: 56,
            right: 14,
            top: 64 + i * 30,
            height: 1,
            background: 'rgba(100, 149, 237, 0.26)',
          }}
        />
      ))}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: 52, width: 1.5,
        background: 'rgba(220,80,80,0.35)',
      }} />
      {/* Margin holes (decorative) */}
      {[0.2, 0.5, 0.8].map((y) => (
        <div key={y} style={{
          position: 'absolute', top: `${y * 100}%`, left: 18,
          width: 14, height: 14, borderRadius: '50%',
          background: 'rgba(255,255,255,0.6)',
          boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.12)',
        }} />
      ))}
    </div>
  );
}

// ── Entry card: text flows freely, photos are absolutely positioned on top ──
function DiaryEntryCard({
  entry,
  rotation,
  onEdit,
  onDelete,
  onAddPhoto,
  onUpdatePhoto,
  onDeletePhoto,
}: {
  entry: DiaryEntry;
  rotation: number;
  onEdit: () => void;
  onDelete: () => void;
  onAddPhoto: (file: File) => Promise<void>;
  onUpdatePhoto: (photoId: string, patch: Partial<DiaryPhoto>) => void;
  onDeletePhoto: (photoId: string) => void;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [fullscreenPhoto, setFullscreenPhoto] = useState<DiaryPhoto | null>(null);
  const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);

  const handleDeletePhoto = (photoId: string) => {
    setFullscreenPhoto(null);
    setDeletingPhotoId(photoId);
    setTimeout(() => {
      setDeletingPhotoId(null);
      onDeletePhoto(photoId);
    }, 300);
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d).toLocaleDateString('bg-BG', { day: 'numeric', month: 'long', year: 'numeric' });
    } catch { return d; }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await onAddPhoto(file);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // 700px fits 20+ notebook lines (lines start at y=64, spaced 30px)
  const minHeight = 700;

  return (
    <div
      ref={cardRef}
      className="relative rounded-2xl"
      style={{
        background: '#FFF9EE',
        backgroundImage: 'linear-gradient(135deg, #FFF9EE 0%, #F8F2DF 100%)',
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '3px 5px 18px rgba(70,40,15,0.12)',
        transform: `rotate(${rotation}deg)`,
        padding: '28px 28px 72px 76px',
        minHeight,
      }}
    >
      <NotebookLines height={contentRef.current?.scrollHeight ?? minHeight} />

      {/* Absolutely positioned polaroids sit on top of text */}
      {entry.photos.map(photo => (
        <Polaroid
          key={photo.id}
          photo={photo}
          isDeleting={deletingPhotoId === photo.id}
          onUpdate={onUpdatePhoto}
          onOpen={setFullscreenPhoto}
          containerRef={cardRef}
        />
      ))}

      {/* Text content — unaffected by photos */}
      <div className="relative" style={{ zIndex: 1 }} ref={contentRef}>
        {/* Date */}
        <div className="diary-font" style={{ color: '#B08050', fontSize: 16, marginBottom: 2 }}>
          {formatDate(entry.date)}
        </div>
        {/* Title */}
        <h3 className="diary-font font-bold" style={{ fontSize: 30, color: '#2D1B0E', lineHeight: 1.15, marginBottom: 12 }}>
          {entry.title}
        </h3>

        <div
          className="diary-font"
          style={{
            fontSize: 19,
            color: '#2D1B0E',
            lineHeight: '30px',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
          }}
        >
          {entry.content}
        </div>

      </div>

      {/* Actions — pinned to bottom of card, centered */}
      <div style={{
        position: 'absolute',
        bottom: 18,
        left: 76,
        right: 28,
        display: 'flex',
        justifyContent: 'center',
        gap: 8,
        flexWrap: 'nowrap',
        zIndex: 2,
      }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="diary-font px-3 py-1.5 rounded-lg transition-all shrink-0"
          style={{ background: 'rgba(34,197,94,0.10)', color: '#15803D', fontSize: 15, opacity: uploading ? 0.6 : 1 }}
        >
          {uploading ? '⏳' : '📷 Снимка'}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={handleFileChange} style={{ display: 'none' }} />
        <button
          onClick={onEdit}
          className="diary-font px-3 py-1.5 rounded-lg transition-all shrink-0"
          style={{ background: 'rgba(0,0,0,0.06)', color: '#5C3D1A', fontSize: 15 }}
        >
          ✏️ Редактирай
        </button>
        <button
          onClick={onDelete}
          className="diary-font px-3 py-1.5 rounded-lg transition-all shrink-0"
          style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', fontSize: 15 }}
        >
          🗑️ Изтрий
        </button>
      </div>

      {/* Fullscreen photo preview */}
      {fullscreenPhoto && (
        <div
          className="fixed inset-0 flex items-center justify-center z-[100]"
          style={{ background: 'rgba(0,0,0,0.92)' }}
          onClick={() => setFullscreenPhoto(null)}
        >
          {/* Top-right controls: X close + trash delete */}
          <div style={{ position: 'fixed', top: 18, right: 20, display: 'flex', flexDirection: 'column', gap: 8, zIndex: 101 }}>
            {/* Close */}
            <button
              onClick={(e) => { e.stopPropagation(); setFullscreenPhoto(null); }}
              style={{
                background: '#111',
                color: 'white',
                border: '1.5px solid rgba(255,255,255,0.35)',
                borderRadius: '50%',
                width: 40,
                height: 40,
                fontSize: 20,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Затвори"
            >
              ✕
            </button>
            {/* Delete */}
            <button
              onClick={(e) => { e.stopPropagation(); handleDeletePhoto(fullscreenPhoto.id); }}
              style={{
                background: 'rgba(220,38,38,0.9)',
                color: 'white',
                border: '1.5px solid rgba(255,255,255,0.2)',
                borderRadius: '50%',
                width: 40,
                height: 40,
                fontSize: 18,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
              title="Изтрий снимката"
            >
              🗑
            </button>
          </div>

          {/* Photo + optional caption — centered */}
          <div className="flex flex-col items-center" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={fullscreenPhoto.url}
              alt={fullscreenPhoto.caption || 'Снимка'}
              style={{
                maxWidth: '88vw',
                maxHeight: '80vh',
                objectFit: 'contain',
                borderRadius: 4,
                boxShadow: '0 8px 40px rgba(0,0,0,0.7)',
              }}
            />
            {fullscreenPhoto.caption && (
              <div
                className="diary-font"
                style={{ color: 'rgba(255,255,255,0.85)', fontSize: 22, marginTop: 14, textAlign: 'center' }}
              >
                {fullscreenPhoto.caption}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DnevnikPage() {
  const [users, setUsers]   = useState<UserProfile[]>([]);
  const [entries, setEntries] = useState<DiaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeUser, setActiveUser] = useState<UserProfile | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', content: '', date: new Date().toISOString().slice(0, 10) });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchUsers().then(u => { setUsers(u); setActiveUser(u[0] ?? null); }).catch(() => {});
    fetch('/api/diary')
      .then(r => r.ok ? r.json() : [])
      .then((data) => setEntries(data.map((e: DiaryEntry) => ({ ...e, photos: e.photos ?? [] }))))
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  const userEntries = entries.filter(e => e.userId === activeUser?.id);

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
          setEntries(p => p.map(e => e.id === editingId ? { ...e, ...updated, photos: updated.photos ?? e.photos } : e));
        }
      } else {
        const r = await fetch('/api/diary', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, userId: activeUser?.id }),
        });
        if (r.ok) {
          const created = await r.json();
          setEntries(p => [{ ...created, photos: created.photos ?? [] }, ...p]);
        }
      }
      setShowForm(false);
      setEditingId(null);
      setForm({ title: '', content: '', date: new Date().toISOString().slice(0, 10) });
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }, [form, editingId, activeUser]);

  const handleDelete = useCallback(async (id: string) => {
    if (!window.confirm('Сигурен ли си, че искаш да изтриеш този запис?')) return;
    await fetch(`/api/diary/${id}`, { method: 'DELETE' });
    setEntries(p => p.filter(e => e.id !== id));
  }, []);

  const startEdit = (entry: DiaryEntry) => {
    setEditingId(entry.id);
    setForm({ title: entry.title, content: entry.content, date: entry.date.slice(0, 10) });
    setShowForm(true);
  };

  // ── Photo handlers ──
  const handleAddPhoto = useCallback(async (entryId: string, file: File) => {
    try {
      const url = await compressImage(file);
      const r = await fetch(`/api/diary/${entryId}/photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url,
          positionX: 20 + Math.random() * 60,
          positionY: 10 + Math.random() * 40,
          rotation: Math.random() * 5 + 2,
          caption: '',
        }),
      });
      if (r.ok) {
        const photo = await r.json();
        setEntries(p => p.map(e => e.id === entryId ? { ...e, photos: [...e.photos, photo] } : e));
      }
    } catch (err) {
      console.error('addPhoto error:', err);
    }
  }, []);

  const handleUpdatePhoto = useCallback(async (photoId: string, patch: Partial<DiaryPhoto>) => {
    setEntries(p => p.map(e => ({
      ...e,
      photos: e.photos.map(ph => ph.id === photoId ? { ...ph, ...patch } : ph),
    })));
    try {
      await fetch(`/api/diary/photos/${photoId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
    } catch { /* swallow — optimistic update remains */ }
  }, []);

  const handleDeletePhoto = useCallback(async (photoId: string) => {
    setEntries(p => p.map(e => ({ ...e, photos: e.photos.filter(ph => ph.id !== photoId) })));
    try {
      await fetch(`/api/diary/photos/${photoId}`, { method: 'DELETE' });
    } catch { /* swallow */ }
  }, []);

  return (
    <main className="min-h-screen pb-24 px-3" style={{ background: 'linear-gradient(135deg, #f0e8d6 0%, #e3d9bf 100%)' }}>
      {/* Load handwriting font */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Caveat:wght@400;600;700&display=swap');
        .diary-font { font-family: 'Caveat', 'Comic Sans MS', cursive !important; }
      `}</style>

      {/* Header */}
      <header className="w-full max-w-2xl mx-auto pt-5 pb-3 text-center">
        <h1 className="diary-font font-bold" style={{ color: '#2D1B0E', fontSize: 42, letterSpacing: '0.01em' }}>
          📓 Пътешественически дневник
        </h1>
        <p className="diary-font" style={{ color: '#7A5C3A', fontSize: 18, marginTop: 2 }}>
          Запиши своите приключения и спомени
        </p>
      </header>

      {/* User switcher */}
      <div className="flex gap-3 max-w-lg mx-auto mb-4 flex-wrap">
        {users.map(u => (
          <UserCard
            key={u.id}
            user={u}
            isActive={activeUser?.id === u.id}
            onClick={() => { sounds.click(); resumeAudio(); setActiveUser(u); }}
          />
        ))}
      </div>

      {/* Add button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={() => { sounds.click(); resumeAudio(); setEditingId(null); setForm({ title: '', content: '', date: new Date().toISOString().slice(0, 10) }); setShowForm(true); }}
          className="diary-font px-6 py-2.5 rounded-2xl font-bold transition-all hover:scale-105 active:scale-95"
          style={{ background: activeUser?.color ?? '#7A5C3A', color: 'white', boxShadow: `0 4px 14px ${activeUser?.color ?? '#7A5C3A'}50`, fontSize: 22 }}
        >
          ✏️ Нов запис
        </button>
      </div>

      {/* Add/Edit form modal */}
      {showForm && (
        <div className="fixed inset-0 flex items-center justify-center z-50 p-3" style={{ background: 'rgba(0,0,0,0.45)' }}>
          <div
            className="w-full max-w-lg rounded-2xl p-6 relative"
            style={{
              background: '#FFF9EE',
              border: '2px solid rgba(0,0,0,0.08)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.28)',
              transform: 'rotate(-0.4deg)',
            }}
          >
            <h2 className="diary-font font-bold mb-4" style={{ color: '#2D1B0E', fontSize: 28 }}>
              {editingId ? '✏️ Редактирай запис' : '✏️ Нов запис'}
            </h2>
            <input
              type="text"
              placeholder="Заглавие…"
              value={form.title}
              onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              className="diary-font w-full mb-3 px-3 py-2 rounded-lg border-0 border-b-2 bg-transparent outline-none"
              style={{ borderColor: activeUser?.color ?? '#7A5C3A', color: '#2D1B0E', fontSize: 22 }}
            />
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(p => ({ ...p, date: e.target.value }))}
              className="diary-font w-full mb-3 px-3 py-1.5 rounded-lg outline-none bg-transparent border"
              style={{ borderColor: 'rgba(0,0,0,0.12)', color: '#5C3D1A', fontSize: 16 }}
            />
            <textarea
              placeholder="Разкажи за твоето приключение…"
              value={form.content}
              onChange={e => setForm(p => ({ ...p, content: e.target.value }))}
              rows={8}
              className="diary-font w-full px-3 py-2 rounded-lg border-0 bg-transparent outline-none resize-none"
              style={{ color: '#2D1B0E', lineHeight: '30px', fontSize: 19, background: 'rgba(255,255,255,0.5)' }}
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSave}
                disabled={saving || !form.title.trim() || !form.content.trim()}
                className="flex-1 diary-font py-2.5 rounded-xl font-bold transition-all"
                style={{ background: activeUser?.color ?? '#7A5C3A', color: 'white', opacity: saving ? 0.7 : 1, fontSize: 22 }}
              >
                {saving ? 'Запазване…' : '💾 Запази'}
              </button>
              <button
                onClick={() => { setShowForm(false); setEditingId(null); }}
                className="diary-font px-5 py-2.5 rounded-xl font-bold transition-all"
                style={{ background: 'rgba(0,0,0,0.07)', color: '#64748b', fontSize: 22 }}
              >
                Отказ
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Diary entries */}
      {loading && (
        <div className="text-center diary-font mt-12" style={{ color: '#7A5C3A', fontSize: 22 }}>
          Зареждане на дневника…
        </div>
      )}

      {!loading && userEntries.length === 0 && (
        <div className="text-center mt-12 px-4">
          <div className="diary-font mb-2" style={{ color: '#7A5C3A', fontSize: 30 }}>Все още няма записи</div>
          <div className="diary-font" style={{ color: '#A08060', fontSize: 19 }}>
            Натисни „Нов запис" за да започнеш своя дневник ✨
          </div>
        </div>
      )}

      <div className="max-w-2xl mx-auto space-y-10 px-1">
        {userEntries.map((entry, idx) => (
          <DiaryEntryCard
            key={entry.id}
            entry={entry}
            rotation={idx % 2 === 0 ? -0.4 : 0.4}
            onEdit={() => startEdit(entry)}
            onDelete={() => handleDelete(entry.id)}
            onAddPhoto={(file) => handleAddPhoto(entry.id, file)}
            onUpdatePhoto={handleUpdatePhoto}
            onDeletePhoto={handleDeletePhoto}
          />
        ))}
      </div>
    </main>
  );
}
