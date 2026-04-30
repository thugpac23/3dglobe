'use client';

import { useState, useCallback } from 'react';
import { UserType, USER_COLOR, USER_DISPLAY } from '@/types';
import { addXP } from '@/lib/api';
import { sounds, resumeAudio } from '@/lib/sounds';

interface Country {
  name: string;
  capital: string;
  flag: string;
}

interface FamousPerson {
  name: string;
  country: string;
  hint: string;
}

interface FactQuestion {
  prompt: string;
  correct: string;
  wrong: string[];
  category: string;
}

interface Question {
  category: string;
  prompt: string;
  correct: string;
  choices: string[];
}

const COUNTRIES: Country[] = [
  { name: 'България', capital: 'София', flag: '🇧🇬' },
  { name: 'Франция', capital: 'Париж', flag: '🇫🇷' },
  { name: 'Германия', capital: 'Берлин', flag: '🇩🇪' },
  { name: 'Италия', capital: 'Рим', flag: '🇮🇹' },
  { name: 'Испания', capital: 'Мадрид', flag: '🇪🇸' },
  { name: 'Гърция', capital: 'Атина', flag: '🇬🇷' },
  { name: 'Турция', capital: 'Анкара', flag: '🇹🇷' },
  { name: 'Япония', capital: 'Токио', flag: '🇯🇵' },
  { name: 'Китай', capital: 'Пекин', flag: '🇨🇳' },
  { name: 'Бразилия', capital: 'Бразилия', flag: '🇧🇷' },
  { name: 'Австралия', capital: 'Канбера', flag: '🇦🇺' },
  { name: 'Канада', capital: 'Отава', flag: '🇨🇦' },
  { name: 'САЩ', capital: 'Вашингтон', flag: '🇺🇸' },
  { name: 'Великобритания', capital: 'Лондон', flag: '🇬🇧' },
  { name: 'Русия', capital: 'Москва', flag: '🇷🇺' },
  { name: 'Египет', capital: 'Кайро', flag: '🇪🇬' },
  { name: 'Южна Африка', capital: 'Претория', flag: '🇿🇦' },
  { name: 'Индия', capital: 'Ню Делхи', flag: '🇮🇳' },
  { name: 'Мексико', capital: 'Мексико Сити', flag: '🇲🇽' },
  { name: 'Аржентина', capital: 'Буенос Айрес', flag: '🇦🇷' },
  { name: 'Норвегия', capital: 'Осло', flag: '🇳🇴' },
  { name: 'Швеция', capital: 'Стокхолм', flag: '🇸🇪' },
  { name: 'Нидерландия', capital: 'Амстердам', flag: '🇳🇱' },
  { name: 'Португалия', capital: 'Лисабон', flag: '🇵🇹' },
  { name: 'Полша', capital: 'Варшава', flag: '🇵🇱' },
  { name: 'Румъния', capital: 'Букурещ', flag: '🇷🇴' },
  { name: 'Унгария', capital: 'Будапеща', flag: '🇭🇺' },
  { name: 'Хърватия', capital: 'Загреб', flag: '🇭🇷' },
  { name: 'Австрия', capital: 'Виена', flag: '🇦🇹' },
  { name: 'Швейцария', capital: 'Берн', flag: '🇨🇭' },
  { name: 'Тайланд', capital: 'Банкок', flag: '🇹🇭' },
  { name: 'Мароко', capital: 'Рабат', flag: '🇲🇦' },
  { name: 'Перу', capital: 'Лима', flag: '🇵🇪' },
  { name: 'Нова Зеландия', capital: 'Уелингтън', flag: '🇳🇿' },
  { name: 'Южна Кореа', capital: 'Сеул', flag: '🇰🇷' },
];

const FAMOUS_PEOPLE: FamousPerson[] = [
  { name: 'Леонардо да Винчи', country: 'Италия', hint: 'художник и изобретател' },
  { name: 'Алберт Айнщайн', country: 'Германия', hint: 'физик, теория на относителността' },
  { name: 'Мария Кюри', country: 'Полша', hint: 'учена, открила радия' },
  { name: 'Уилям Шекспир', country: 'Великобритания', hint: 'велик драматург' },
  { name: 'Наполеон Бонапарт', country: 'Франция', hint: 'военен стратег и император' },
  { name: 'Пабло Пикасо', country: 'Испания', hint: 'художник, основател на кубизма' },
  { name: 'Клеопатра', country: 'Египет', hint: 'последната фараонка' },
  { name: 'Ганди', country: 'Индия', hint: 'борец за независимост с ненасилие' },
  { name: 'Нелсън Мандела', country: 'Южна Африка', hint: 'борец срещу апартейда' },
  { name: 'Николай Коперник', country: 'Полша', hint: 'астроном, хелиоцентрична система' },
  { name: 'Чарлз Дарвин', country: 'Великобритания', hint: 'теория за еволюцията' },
  { name: 'Фридерик Шопен', country: 'Полша', hint: 'велик пианист и композитор' },
];

const GEOGRAPHY_FACTS: FactQuestion[] = [
  {
    prompt: 'Коя е най-дългата река в света?',
    correct: 'Нил',
    wrong: ['Амазонка', 'Янцзъ', 'Мисисипи'],
    category: 'География',
  },
  {
    prompt: 'Кой е най-високият планински връх в света?',
    correct: 'Еверест',
    wrong: ['К2', 'Килиманджаро', 'Монблан'],
    category: 'География',
  },
  {
    prompt: 'Кой е най-големият океан на Земята?',
    correct: 'Тихи океан',
    wrong: ['Атлантически', 'Индийски', 'Арктически'],
    category: 'География',
  },
  {
    prompt: 'Кой е най-голямата пустиня в света?',
    correct: 'Сахара',
    wrong: ['Гоби', 'Намиб', 'Калахари'],
    category: 'География',
  },
  {
    prompt: 'На кой континент е Бразилия?',
    correct: 'Южна Америка',
    wrong: ['Северна Америка', 'Африка', 'Азия'],
    category: 'География',
  },
  {
    prompt: 'Колко континента има на Земята?',
    correct: '7',
    wrong: ['5', '6', '8'],
    category: 'География',
  },
  {
    prompt: 'Кой е най-малкият континент?',
    correct: 'Австралия',
    wrong: ['Европа', 'Антарктида', 'Южна Америка'],
    category: 'География',
  },
  {
    prompt: 'Коя страна е с най-голяма площ в света?',
    correct: 'Русия',
    wrong: ['Канада', 'Китай', 'САЩ'],
    category: 'География',
  },
  {
    prompt: 'Кой е най-дълбокият океан в света?',
    correct: 'Тихи океан',
    wrong: ['Атлантически', 'Индийски', 'Арктически'],
    category: 'География',
  },
];

const ANIMAL_FACTS: FactQuestion[] = [
  {
    prompt: 'Кое животно е най-бързото на сушата?',
    correct: 'Гепард',
    wrong: ['Лъв', 'Кон', 'Щраус'],
    category: 'Животни',
  },
  {
    prompt: 'Кое е най-голямото животно на Земята?',
    correct: 'Син кит',
    wrong: ['Слон', 'Жираф', 'Акула'],
    category: 'Животни',
  },
  {
    prompt: 'Кое животно спи правостоящо?',
    correct: 'Жираф',
    wrong: ['Слон', 'Зебра', 'Хипопотам'],
    category: 'Животни',
  },
  {
    prompt: 'Кое е националното животно на Австралия?',
    correct: 'Кенгуру',
    wrong: ['Коала', 'Ехидна', 'Вомбат'],
    category: 'Животни',
  },
  {
    prompt: 'Колко крака има октопода?',
    correct: '8',
    wrong: ['6', '10', '4'],
    category: 'Животни',
  },
  {
    prompt: 'Кое животно има най-дълъг език спрямо тялото си?',
    correct: 'Хамелеон',
    wrong: ['Жираф', 'Мравояд', 'Гущер'],
    category: 'Животни',
  },
  {
    prompt: 'Кое животно може да живее без вода най-дълго?',
    correct: 'Камила',
    wrong: ['Слон', 'Пустинна мишка', 'Кенгуру'],
    category: 'Животни',
  },
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function makeQuestion(): Question {
  const type = Math.floor(Math.random() * 5);

  if (type === 0) {
    // Capital → country: "Каква е столицата на X?"
    const correct = pickRandom(COUNTRIES);
    const wrong = shuffle(COUNTRIES.filter(c => c.name !== correct.name)).slice(0, 3);
    return {
      category: '🏙️ Столици',
      prompt: `Каква е столицата на ${correct.flag} ${correct.name}?`,
      correct: correct.capital,
      choices: shuffle([correct.capital, ...wrong.map(c => c.capital)]),
    };
  }

  if (type === 1) {
    // Reverse: "В коя страна е столицата X?"
    const correct = pickRandom(COUNTRIES);
    const wrong = shuffle(COUNTRIES.filter(c => c.name !== correct.name)).slice(0, 3);
    return {
      category: '🗺️ Обратно',
      prompt: `В коя страна се намира столицата ${correct.capital}?`,
      correct: `${correct.flag} ${correct.name}`,
      choices: shuffle([
        `${correct.flag} ${correct.name}`,
        ...wrong.map(c => `${c.flag} ${c.name}`),
      ]),
    };
  }

  if (type === 2) {
    // Famous person: "Откъде е [person]?"
    const person = pickRandom(FAMOUS_PEOPLE);
    const wrongCountries = shuffle(
      COUNTRIES.filter(c => c.name !== person.country)
    ).slice(0, 3).map(c => `${c.flag} ${c.name}`);
    const correctCountry = COUNTRIES.find(c => c.name === person.country);
    const correctLabel = correctCountry
      ? `${correctCountry.flag} ${person.country}`
      : person.country;
    return {
      category: '🌟 Известни личности',
      prompt: `${person.name} (${person.hint}) е от коя страна?`,
      correct: correctLabel,
      choices: shuffle([correctLabel, ...wrongCountries]),
    };
  }

  if (type === 3) {
    // Geography fact
    const fact = pickRandom(GEOGRAPHY_FACTS);
    return {
      category: `🌍 ${fact.category}`,
      prompt: fact.prompt,
      correct: fact.correct,
      choices: shuffle([fact.correct, ...fact.wrong]),
    };
  }

  // type === 4: Animal fact
  const fact = pickRandom(ANIMAL_FACTS);
  return {
    category: `🦁 ${fact.category}`,
    prompt: fact.prompt,
    correct: fact.correct,
    choices: shuffle([fact.correct, ...fact.wrong]),
  };
}

const TOTAL_ROUNDS = 7;
type Phase = 'idle' | 'playing' | 'answered' | 'done';

export default function IgraPage() {
  const [activeUser, setActiveUser] = useState<UserType>('tati');
  const [phase, setPhase] = useState<Phase>('idle');
  const [question, setQuestion] = useState<Question | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [score, setScore] = useState(0);
  const [round, setRound] = useState(0);
  const [xpEarned, setXpEarned] = useState(0);

  const startGame = useCallback(() => {
    resumeAudio(); sounds.click();
    setScore(0); setRound(0); setXpEarned(0);
    setQuestion(makeQuestion());
    setSelected(null);
    setPhase('playing');
  }, []);

  const answer = useCallback(async (choice: string) => {
    if (phase !== 'playing' || !question) return;
    resumeAudio();
    setSelected(choice);
    const correct = choice === question.correct;
    if (correct) {
      sounds.quizCorrect();
      setScore(s => s + 1);
      setXpEarned(x => x + 5);
    } else {
      sounds.quizWrong();
    }
    setPhase('answered');
  }, [phase, question]);

  const nextQuestion = useCallback(() => {
    resumeAudio(); sounds.click();
    const nextRound = round + 1;
    setRound(nextRound);
    if (nextRound >= TOTAL_ROUNDS) {
      setPhase('done');
      if (xpEarned > 0) {
        addXP(activeUser, xpEarned).catch(() => {});
      }
    } else {
      setQuestion(makeQuestion());
      setSelected(null);
      setPhase('playing');
    }
  }, [round, xpEarned, activeUser]);

  return (
    <main className="min-h-screen px-4 py-6 max-w-xl mx-auto">
      <h1 className="text-2xl font-extrabold text-slate-800 mb-1">🎮 Игра: Познай!</h1>
      <p className="text-slate-500 text-sm mb-5">Столици · Личности · Факти · Животни</p>

      {/* User tabs */}
      <div className="flex gap-2 mb-6">
        {(['tati', 'iva'] as UserType[]).map(u => (
          <button
            key={u}
            onClick={() => {
              if (phase === 'idle' || phase === 'done') {
                resumeAudio(); sounds.click();
                setActiveUser(u);
                setPhase('idle');
              }
            }}
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
          <p className="text-slate-500 text-sm mb-2">{TOTAL_ROUNDS} въпроса · 5 XP за всеки верен отговор</p>
          <p className="text-slate-400 text-xs mb-6">Смесени категории: столици, личности, животни и факти</p>
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
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(round / TOTAL_ROUNDS) * 100}%`, background: USER_COLOR[activeUser] }}
              />
            </div>
            <span className="text-xs font-bold text-slate-500">{round + 1}/{TOTAL_ROUNDS}</span>
          </div>

          {/* Category badge + score */}
          <div className="flex items-center justify-between mb-4">
            <span
              className="text-xs font-bold px-3 py-1 rounded-full"
              style={{ background: `${USER_COLOR[activeUser]}20`, color: USER_COLOR[activeUser] }}
            >
              {question.category}
            </span>
            <span className="text-xs font-bold text-slate-500">
              {score} верни · +{xpEarned} XP
            </span>
          </div>

          {/* Question */}
          <div
            className="rounded-2xl p-6 mb-5 text-center shadow-sm"
            style={{ background: `${USER_COLOR[activeUser]}10`, border: `2px solid ${USER_COLOR[activeUser]}30` }}
          >
            <p className="text-lg font-extrabold text-slate-800 leading-snug">{question.prompt}</p>
          </div>

          {/* Choices */}
          <div className="grid grid-cols-2 gap-3">
            {question.choices.map(c => {
              const isCorrect = c === question.correct;
              const isSelected = c === selected;
              let bg = 'white';
              let border = '#E2E8F0';
              let color = '#334155';
              if (phase === 'answered') {
                if (isCorrect) { bg = '#D1FAE5'; border = '#059669'; color = '#065F46'; }
                else if (isSelected) { bg = '#FEE2E2'; border = '#DC2626'; color = '#7F1D1D'; }
              }
              return (
                <button
                  key={c}
                  onClick={() => answer(c)}
                  disabled={phase === 'answered'}
                  className="px-4 py-3 rounded-xl font-semibold text-sm text-left transition-all"
                  style={{ background: bg, border: `2px solid ${border}`, color }}
                >
                  {c}
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
              {round + 1 >= TOTAL_ROUNDS ? 'Виж резултата' : 'Следващ въпрос →'}
            </button>
          )}
        </div>
      )}

      {/* Done */}
      {phase === 'done' && (
        <div className="text-center py-8">
          <div className="text-6xl mb-4">
            {score === TOTAL_ROUNDS ? '🏆' : score >= TOTAL_ROUNDS / 2 ? '🌟' : '📚'}
          </div>
          <h2 className="text-2xl font-extrabold text-slate-800 mb-2">
            {score} / {TOTAL_ROUNDS}
          </h2>
          <p className="text-slate-500 mb-2">
            {score === TOTAL_ROUNDS ? 'Перфектно!' : score >= TOTAL_ROUNDS / 2 ? 'Много добре!' : 'Продължавай да учиш!'}
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
