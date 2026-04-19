'use client';

import { UserType, USER_DISPLAY } from '@/types';

interface UserToggleProps {
  activeUser: UserType;
  onToggle: (user: UserType) => void;
  visitCount: { tati: number; iva: number; both: number };
}

export default function UserToggle({ activeUser, onToggle, visitCount }: UserToggleProps) {
  return (
    <div className="flex flex-col items-center gap-3 my-3 px-4">
      <p className="text-slate-500 text-xs text-center tracking-wide">
        Кликни върху държава, за да я отбележиш като посетена
      </p>

      <div className="flex items-center gap-2">
        {(['tati', 'iva'] as UserType[]).map((user) => {
          const isActive = activeUser === user;
          const color = user === 'tati' ? '#FFD700' : '#FF50A0';
          const count = visitCount[user] + (user === 'tati' ? visitCount.both : visitCount.both);
          return (
            <button
              key={user}
              onClick={() => onToggle(user)}
              className="relative px-6 py-2 rounded-full text-sm font-semibold transition-all duration-200 select-none"
              style={{
                background: isActive ? color : 'rgba(30,40,60,0.7)',
                color: isActive ? '#0a0a0a' : '#64748b',
                border: isActive ? 'none' : '1px solid rgba(100,116,139,0.3)',
                boxShadow: isActive ? `0 0 28px ${color}55` : 'none',
                transform: isActive ? 'scale(1.06)' : 'scale(1)',
              }}
            >
              ✈ {USER_DISPLAY[user]}
              <span
                className="ml-1.5 text-xs font-normal"
                style={{ opacity: isActive ? 0.65 : 0.45 }}
              >
                ({count})
              </span>
            </button>
          );
        })}

        <div
          className="flex items-center gap-1 px-4 py-2 rounded-full text-xs"
          style={{ background: 'rgba(255,155,40,0.12)', border: '1px solid rgba(255,155,40,0.2)', color: '#FF9B28' }}
        >
          🌍 {visitCount.both}
        </div>
      </div>
    </div>
  );
}
