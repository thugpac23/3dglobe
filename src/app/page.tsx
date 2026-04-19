'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { UserType, Visit, VisitsByCountry, USER_DISPLAY } from '@/types';
import { fetchVisits, addVisit, removeVisit } from '@/lib/api';
import UserToggle from '@/components/UserToggle';
import VisitsTable from '@/components/VisitsTable';

const Globe = dynamic(() => import('@/components/Globe'), { ssr: false });

interface Toast {
  id: number;
  message: string;
  type: 'add' | 'remove';
}

export default function Home() {
  const [visits, setVisits] = useState<Visit[]>([]);
  const [activeUser, setActiveUser] = useState<UserType>('tati');
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = useCallback((message: string, type: 'add' | 'remove') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2800);
  }, []);

  useEffect(() => {
    fetchVisits()
      .then(setVisits)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const visitsByCountry = useMemo<VisitsByCountry>(() => {
    const map: VisitsByCountry = {};
    for (const visit of visits) {
      const iso = visit.country.isoCode;
      if (!map[iso]) map[iso] = { country: visit.country, tati: false, iva: false };
      map[iso][visit.user] = true;
    }
    return map;
  }, [visits]);

  const visitCount = useMemo(() => {
    let tati = 0, iva = 0, both = 0;
    for (const entry of Object.values(visitsByCountry)) {
      if (entry.tati && entry.iva) both++;
      else if (entry.tati) tati++;
      else if (entry.iva) iva++;
    }
    return { tati, iva, both };
  }, [visitsByCountry]);

  const handleCountryClick = useCallback(
    async (isoCode: string, countryName: string) => {
      const entry = visitsByCountry[isoCode];
      const alreadyVisited = entry?.[activeUser] ?? false;
      const displayName = USER_DISPLAY[activeUser];

      if (alreadyVisited) {
        const visit = visits.find(
          (v) => v.country.isoCode === isoCode && v.user === activeUser
        );
        if (!visit) return;

        setVisits((prev) => prev.filter((v) => v.id !== visit.id));
        showToast(`${countryName} премахната от списъка на ${displayName}`, 'remove');

        try {
          await removeVisit(visit.countryId, activeUser);
        } catch {
          setVisits((prev) => [...prev, visit]);
          showToast('Грешка: не може да се премахне посещението', 'remove');
        }
      } else {
        let countryId: string | null = null;
        const anyVisit = visits.find((v) => v.country.isoCode === isoCode);
        if (anyVisit) {
          countryId = anyVisit.countryId;
        } else {
          try {
            const res = await fetch(`/api/country?iso=${isoCode}`);
            if (!res.ok) throw new Error('Not found');
            const data = await res.json();
            countryId = data.id;
          } catch {
            showToast(`${countryName} не е намерена в базата данни`, 'remove');
            return;
          }
        }

        const optimisticVisit: Visit = {
          id: `temp-${Date.now()}`,
          countryId: countryId!,
          user: activeUser,
          country: entry?.country ?? {
            id: countryId!,
            name: countryName,
            capital: '',
            isoCode,
          },
        };
        setVisits((prev) => [...prev, optimisticVisit]);
        showToast(`${countryName} добавена в списъка на ${displayName} ✓`, 'add');

        try {
          const newVisit = await addVisit(countryId!, activeUser);
          setVisits((prev) => [
            ...prev.filter((v) => v.id !== optimisticVisit.id),
            newVisit,
          ]);
        } catch {
          setVisits((prev) => prev.filter((v) => v.id !== optimisticVisit.id));
          showToast('Грешка: не може да се запази посещението', 'remove');
        }
      }
    },
    [visitsByCountry, visits, activeUser, showToast]
  );

  return (
    <main
      className="min-h-screen flex flex-col items-center pb-20"
      style={{ background: 'radial-gradient(ellipse at top, #060e24 0%, #020810 100%)' }}
    >
      {/* Header */}
      <header className="w-full py-5 px-6 text-center relative">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-950/20 to-transparent pointer-events-none" />
        <h1 className="text-2xl font-bold tracking-tight text-white relative z-10">
          🌍 Пътешественически Глобус
        </h1>
        <p className="text-slate-600 text-xs mt-1 relative z-10 tracking-wide">
          Открийте света заедно
        </p>
      </header>

      {/* User toggle */}
      <UserToggle
        activeUser={activeUser}
        onToggle={setActiveUser}
        visitCount={visitCount}
      />

      {/* Globe */}
      {loading ? (
        <div className="flex items-center justify-center" style={{ height: '70vh' }}>
          <div className="text-slate-500 flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            <span className="text-sm">Зареждане на глобуса...</span>
          </div>
        </div>
      ) : (
        <div className="globe-glow flex justify-center">
          <Globe
            visitsByCountry={visitsByCountry}
            onCountryClick={handleCountryClick}
          />
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-5 mt-3 text-xs text-slate-500">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#FFD700] opacity-80" />
          само {USER_DISPLAY.tati}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#FF69B4] opacity-80" />
          само {USER_DISPLAY.iva}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full inline-block bg-[#FFB347] opacity-80" />
          двете заедно
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full inline-block bg-yellow-200 opacity-70" />
          столица
        </div>
      </div>

      {/* Visits table */}
      <VisitsTable visitsByCountry={visitsByCountry} />

      {/* Toast notifications */}
      <div
        className="fixed top-4 left-1/2 z-50 flex flex-col gap-2 pointer-events-none"
        style={{ transform: 'translateX(-50%)' }}
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="toast px-5 py-2.5 rounded-xl text-sm font-medium shadow-2xl whitespace-nowrap"
            style={{
              background:
                toast.type === 'add'
                  ? 'rgba(5,150,105,0.97)'
                  : 'rgba(220,38,38,0.93)',
              color: '#fff',
              border:
                toast.type === 'add'
                  ? '1px solid rgba(16,185,129,0.5)'
                  : '1px solid rgba(248,113,113,0.5)',
            }}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </main>
  );
}
