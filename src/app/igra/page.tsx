'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserType, USER_COLOR, USER_DISPLAY } from '@/types';
import { addXP } from '@/lib/api';
import { sounds, resumeAudio } from '@/lib/sounds';

interface QuizCountry {
  name: string;
  capital: string;
  isoCode: string;
}

const QUIZ_POOL: QuizCountry[] = [
  { name: 'България', capital: 'София', isoCode: 'BG' },
  { name: 'Франция', capital: 'Париж', isoCode: 'FR' },
  { name: 'Германия', capital: 'Берлин', isoCode: 'DE' },
  { name: 'Италия', capital: 'Рим', isoCode: 'IT' },
  { name: 'Испания', capital: 'Мадрид', isoCode: 'ES' },
  { name: 'Гърция', capital: 'Атина', isoCode: 'GR' },
  { name: 'Турция', capital: 'Анкара', isoCode: 'TR' },
  { name: 'Япония', capital: 'Токио', isoCode: 'JP' },
  { name: 'Китай', capital: 'Пекин', isoCode: 'CN' },
  { name: 'Бразилия', capital: 'Бразилия', isoCode: 'BR' },
  { name: 'Австралия', capital: 'Канбера', isoCode: 'AU' },
  { name: 'Канада', capital: 'Отава', isoCode: 'CA' },
  { name: 'САЩ', capital: 'Вашингтон', isoCode: 'US' },
  { name: 'Великобритания', capital: 'Лондон', isoCode: 'GB' },
  { name: 'Русия', capital: 'Москва', isoCode: 'RU' },
  { name: 'Египет', capital: 'Кайро', isoCode: 'EG' },
  { name: 'Южна Африка', capital: 'Претория', isoCode: 'ZA' },
  { name: 'Индия', capital: 'Ню Делхи', isoCode: 'IN' },
  { name: 'Мексико', capital: 'Мексико Сити', isoCode: 'MX' },
  { name: 'Аржентина', capital: 'Буенос Айрес', isoCode: 'AR' },
  { name: 'Норвегия', capital: 'Осло', isoCode: 'NO' },
  { name: 'Швеция', capital: 'Стокхолм', isoCode: 'SE' },
  { name: 'Нидерландия', capital: 'Амстердам', isoCode: 'NL' },
  { name: 'Португалия', capital: 'Лисабон', isoCode: 'PT' },
  { name: 'Полша', capital: 'Варшава', isoCode: 'PL' },
  { name: 'Румъния', capital: 'Букурещ', isoCode: 'RO' },
  { name: 'Унгария', capital: 'Будапеща', isoCode: 'HU' },
  { name: 'Хърватия', capital: 'Загреб', isoCode: 'HR' },
  { name: 'Австрия', capital: 'Виена', isoCode: 'AT' },
  { name: 'Швейцария', capital: 'Берн', isoCode: 'CH' },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeQuestion(pool: QuizCountry[]) {
  const idx = Math.floor(Math.random() * pool.length);
  const correct = pool[idx];
  const wrong = shuffle(pool.filter((_, i) => i !== idx)).slice(0, 3);
  const choices = shuffle([correct, ...wrong]);
  return { correct, choices };
}

type Phase = 'idle' | 'playing' | 'answered' | 'done';

export default function IgraPage() {
  const [activeUser, setActiveUser] = useState<UserType>('tati');
  const [phase, setPhase] = useState<Phase>('idle');
  const [question, setQuestion] = useState<ReturnType<typeof makeQuestion> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [totalRounds] = useState(5);
  const [xpEarned, setXpEarned] = useState(0);

  const startGame = useCallback(() => {
    resumeAudio(); sounds.click();
    setScore(0); setRound(0); setXpEarned(0);
    setQuestion(makeQuestion(QUIZ_POOL));
    setSelected(null);
    setPhase('playing');
  }, []);

  const answer = useCallback(async (capital: string) => {
    if (phase !== 'playing' || !question) return;
    resumeAudio();
    setSelected(capital);
    const correct = capital === question.correct.capital;
    if (correct) {
      sounds.quizCorrect();
      setScore(s => s + 1);
      const earned = 5;
      setXpEarned(x => x + earned);
    } else {
      sounds.quizWrong();
    }
    setPhase('answered');
  }, [phase, question]);

  const nextQuestion = useCallback(() => {
    resumeAudio(); sounds.click();
    const nextRound = round + 1;
    setRound(nextRound);
    if (nextRound >= totalRounds) {
      setPhase('done');
      if (xpEarned > 0) {
        addXP(activeUser, xpEarned).catch(() => {});
      }
    } else {
      setQuestion(makeQuestion(QUIZ_POOL));
      setSelected(null);
      setPhase('playing');
    }
  }, [round, totalRounds, xpEarned, activeUser]);

  return (
    <main className="min-h-screen px-4 py-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-800 mb-1">🎮 Игра: Столици</h1>
      <p className="text-slate-500 text-sm mb-5">Познай столицата на държавата</p>

      {/* User tabs */}
      <div className="flex gap-2 mb-6">
        {(['tati', 'iva'] as UserType[]).map(u => (
          <button
            key={u}
            onClick={() => { if (phase === 'idle' || phase === 'done') { resumeAudio(); sounds.click(); setActiveUser(u); setPhase('idle'); } }}
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

      {/* Idle */}
      {phase === 'idle' && (
        <div className="text-center py-10">
          <div className="text-6xl mb-4">🗺️</div>
          <h2 className="text-xl font-bold text-slate-700 mb-2">Готов ли си?</h2>
          <p className="text-slate-500 text-sm mb-6">{totalRounds} въпроса · 5 XP за всеки верен отговор</p>
          <button
            onClick={startGame}
            className="px-8 py-3 rounded-2xl font-bold text-white text-lg shadow-md transition-all hover:scale-105"
            style={{ background: USER_COLOR[activeUser] }}
          >
            Започни играта
          </button>
        </div>
      )}

      {/* Playing / Answered */}
      {(phase === 'playing' || phase === 'answered') && question && (
        <div>
          {/* Progress bar */}
          <div className="flex items-center gap-2 mb-4">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(round / totalRounds) * 100}%`, background: USER_COLOR[activeUser] }}
              />
            </div>
            <span className="text-xs font-bold text-slate-500">{round + 1}/{totalRounds}</span>
          </div>

          {/* Score */}
          <div className="text-right text-xs font-bold mb-4" style={{ color: USER_COLOR[activeUser] }}>
            {score} верни · +{xpEarned + (phase === 'answered' && selected === question.correct.capital ? 0 : 0)} XP
          </div>

          {/* Question */}
          <div
            className="rounded-2xl p-6 mb-5 text-center shadow-sm"
            style={{ background: `${USER_COLOR[activeUser]}10`, border: `2px solid ${USER_COLOR[activeUser]}30` }}
          >
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Каква е столицата на</p>
            <p className="text-2xl font-extrabold text-slate-800">{question.correct.name}?</p>
          </div>

          {/* Choices */}
          <div className="grid grid-cols-2 gap-3">
            {question.choices.map(c => {
              const isCorrect = c.capital === question.correct.capital;
              const isSelected = c.capital === selected;
              let bg = 'white';
              let border = '#E2E8F0';
              let color = '#334155';
              if (phase === 'answered') {
                if (isCorrect) { bg = '#D1FAE5'; border = '#059669'; color = '#065F46'; }
                else if (isSelected) { bg = '#FEE2E2'; border = '#DC2626'; color = '#7F1D1D'; }
              }
              return (
                <button
                  key={c.capital}
                  onClick={() => answer(c.capital)}
                  disabled={phase === 'answered'}
                  className="px-4 py-3 rounded-xl font-semibold text-sm text-left transition-all"
                  style={{ background: bg, border: `2px solid ${border}`, color }}
                >
                  {c.capital}
                  {phase === 'answered' && isCorrect && ' ✓'}
                  {phase === 'answered' && isSelected && !isCorrect && ' ✗'}
                </button>
              );
            })}
          </div>

          {phase === 'answered' && (
            <button
              onClick={nextQuestion}
              className="w-full mt-5 py-3 rounded-2xl font-bold text-white transition-all"
              style={{ background: USER_COLOR[activeUser] }}
            >
              {round + 1 >= totalRounds ? 'Виж резултата' : 'Следващ въпрос →'}
            </button>
          )}
        </div>
      )}

      {/* Done */}
      {phase === 'done' && (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">
            {score === totalRounds ? '🏆' : score >= totalRounds / 2 ? '🌟' : '📚'}
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 mb-2">
            {score} / {totalRounds}
          </h2>
          <p className="text-slate-500 mb-2">
            {score === totalRounds ? 'Перфектно!' : score >= totalRounds / 2 ? 'Много добре!' : 'Продължавай да учиш!'}
          </p>
          {xpEarned > 0 && (
            <div
              className="inline-block px-4 py-1.5 rounded-full text-white text-sm font-bold mb-6"
              style={{ background: USER_COLOR[activeUser] }}
            >
              +{xpEarned} XP спечелени!
            </div>
          )}
          <div className="flex gap-3 justify-center">
            <button
              onClick={startGame}
              className="px-6 py-3 rounded-2xl font-bold text-white shadow-md"
              style={{ background: USER_COLOR[activeUser] }}
            >
              Играй отново
            </button>
            <button
              onClick={() => setPhase('idle')}
              className="px-6 py-3 rounded-2xl font-bold text-slate-600 border-2 border-slate-200"
            >
              Меню
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
