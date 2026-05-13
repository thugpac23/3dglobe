'use client';

import { useState, useEffect, useRef } from 'react';
import { UserProfile } from '@/types';

const EMOJI_CHOICES = [
  '🧳', '🌸', '✈️', '🌍', '🗺️', '⭐', '🏔️', '🌊', '🌺', '🦋',
  '🌈', '🎒', '📸', '🎭', '🌙', '☀️', '🍀', '🌴', '🦁', '🐬',
  '🦊', '🌹', '🎨', '🏖️', '🚀', '🌻', '🦄', '🎵',
];

const DEFAULT_EMOJI = '🌍';

interface UserCardProps {
  user: UserProfile;
  isActive: boolean;
  onClick: () => void;
  onDelete?: (userId: string) => void;
}

export default function UserCard({ user, isActive, onClick, onDelete }: UserCardProps) {
  const { id, color, displayName, protected: isProtected } = user;
  const [emoji, setEmoji] = useState(DEFAULT_EMOJI);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch('/api/settings', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : {})
      .then((data: Record<string, string>) => {
        const saved = data[`emoji_${id}`];
        if (saved) setEmoji(saved);
      })
      .catch(() => {});
  }, [id]);

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [pickerOpen]);

  const handleEmojiSelect = (newEmoji: string) => {
    setEmoji(newEmoji);
    setPickerOpen(false);
    fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: `emoji_${id}`, value: newEmoji }),
    }).catch(() => {});
  };

  return (
    <div
      className="flex-1 relative transition-all duration-200 select-none"
      style={{
        background: isActive ? 'white' : 'rgba(255,255,255,0.55)',
        border: `2px solid ${isActive ? color : 'rgba(0,0,0,0.08)'}`,
        borderRadius: 14,
        padding: '8px 12px',
        boxShadow: isActive ? `0 3px 14px ${color}28` : '0 1px 4px rgba(0,0,0,0.07)',
        cursor: 'pointer',
      }}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        <span
          onClick={(e) => { e.stopPropagation(); setPickerOpen(p => !p); }}
          style={{ fontSize: 22, lineHeight: 1, cursor: 'pointer' }}
          title="Смени иконата"
        >
          {emoji}
        </span>
        <span className="font-bold text-sm text-slate-800 flex-1 min-w-0 truncate">{displayName}</span>

        {/* Delete button — non-protected users only */}
        {!isProtected && onDelete && (
          <span
            onClick={(e) => { e.stopPropagation(); setConfirmDelete(p => !p); }}
            title="Изтрий потребителя"
            style={{
              fontSize: 12, color: confirmDelete ? '#DC2626' : '#94a3b8',
              cursor: 'pointer', lineHeight: 1, padding: '2px 4px',
              borderRadius: 6,
              background: confirmDelete ? '#FEE2E2' : 'transparent',
              transition: 'all 0.15s',
            }}
          >
            ✕
          </span>
        )}
      </div>

      {/* Confirm delete inline */}
      {confirmDelete && !isProtected && (
        <div
          onClick={e => e.stopPropagation()}
          style={{
            marginTop: 6, padding: '6px 8px',
            background: '#FEF2F2', borderRadius: 8,
            border: '1px solid #FECACA',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          <span style={{ fontSize: 11, color: '#DC2626', flex: 1 }}>
            Изтрий {displayName}?
          </span>
          <button
            onClick={() => { onDelete?.(id); }}
            style={{ fontSize: 11, fontWeight: 700, color: 'white', background: '#DC2626', border: 'none', borderRadius: 5, padding: '2px 8px', cursor: 'pointer' }}
          >
            Да
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            style={{ fontSize: 11, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer' }}
          >
            Не
          </button>
        </div>
      )}

      {/* macOS-style emoji picker */}
      {pickerOpen && (
        <div
          ref={pickerRef}
          className="absolute z-50 rounded-2xl shadow-2xl p-3"
          style={{
            top: 'calc(100% + 6px)',
            left: 0,
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(0,0,0,0.1)',
            minWidth: 224,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="text-xs text-slate-400 mb-2 font-medium px-1">Избери иконa</div>
          <div className="grid grid-cols-7 gap-1">
            {EMOJI_CHOICES.map(e => (
              <button
                key={e}
                onClick={() => handleEmojiSelect(e)}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-xl transition-all hover:scale-125 active:scale-95"
                style={{
                  background: e === emoji ? `${color}22` : 'transparent',
                  border: `1.5px solid ${e === emoji ? color : 'transparent'}`,
                }}
              >
                {e}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
