'use client';

import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { RealtimePostgresChangesPayload } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabaseClient';

type SubmissionRow = {
  id?: string;
  text?: string;
  created_at?: string;
  [key: string]: unknown;
};

type SubmissionEvent = RealtimePostgresChangesPayload<SubmissionRow>;

type MessageBubble = {
  id: string;
  text: string;
  top: number;
  left: number;
  colorClass: (typeof bubblePalettes)[number];
};

const bubblePalettes = [
  'from-blue-500 to-sky-400',
  'from-emerald-500 to-lime-400',
  'from-rose-500 to-pink-400',
  'from-amber-500 to-orange-400',
  'from-purple-500 to-fuchsia-400',
  'from-cyan-500 to-teal-400',
] as const;

const SLOT_ROWS = 5;
const SLOT_COLS = 5;
const MAX_SLOTS = SLOT_ROWS * SLOT_COLS;

function hashString(input: string) {
  return input.split('').reduce((acc, char) => (acc * 31 + char.charCodeAt(0)) % 1000000007, 7);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

const slotTemplates = Array.from({ length: MAX_SLOTS }, (_, slotIndex) => {
  const row = Math.floor(slotIndex / SLOT_COLS);
  const col = slotIndex % SLOT_COLS;
  const top = 12 + row * (75 / (SLOT_ROWS - 1));
  const left = 12 + col * (76 / (SLOT_COLS - 1));
  return { top, left };
});

function getBubblePosition(seed: string) {
  const hash = hashString(seed);
  const slotPreference = Math.abs(hash) % MAX_SLOTS;

  return { slotPreference, hash };
}

function resolveSlot(preference: number, taken: Set<number>) {
  if (!taken.has(preference)) {
    taken.add(preference);
    return preference;
  }

  let next = (preference + 1) % MAX_SLOTS;
  while (taken.has(next)) {
    next = (next + 1) % MAX_SLOTS;
  }

  taken.add(next);
  return next;
}

export default function DemoPage() {
  const [input, setInput] = useState('');
  const [submissions, setSubmissions] = useState<SubmissionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'subscribing' | 'subscribed' | 'error'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadInitial = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('submissions')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(50);

        if (fetchError) throw fetchError;
        if (isMounted && data) {
          setSubmissions(data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load submissions');
      }
    };

    void loadInitial();

    setStatus('subscribing');

    const channel = supabase
      .channel('public:submissions')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'submissions',
        },
        (payload: SubmissionEvent) => {
          const newRow = payload.new as SubmissionRow | null;
          if (!newRow || typeof newRow.text !== 'string') return;

          setSubmissions((prev) => {
            const deduped = prev.filter((row) => row.id !== newRow.id);
            return [newRow, ...deduped].slice(0, 50);
          });
        },
      )
      .subscribe((subscriptionStatus) => {
        if (subscriptionStatus === 'SUBSCRIBED') {
          setStatus('subscribed');
          setError(null);
        }

        if (subscriptionStatus === 'CHANNEL_ERROR') {
          setStatus('error');
          setError('Realtime channel error. Please refresh to retry.');
        }
      });

    return () => {
      isMounted = false;
      void channel.unsubscribe();
    };
  }, []);

  const messages = useMemo<MessageBubble[]>(() => {
    const takenSlots = new Set<number>();
    const bubbles: MessageBubble[] = [];

    const limit = Math.min(submissions.length, MAX_SLOTS);

    for (let index = 0; index < limit; index += 1) {
      const item = submissions[index];
      const text = typeof item.text === 'string' ? item.text : '';
      if (!text) continue;

      const identifier = item.id ?? `${item.created_at ?? 'unknown'}-${index}`;
      const { slotPreference, hash } = getBubblePosition(identifier);
      const slotIndex = resolveSlot(slotPreference, takenSlots);
      const baseSlot = slotTemplates[slotIndex];

      const jitterTop = ((hash % 9) - 4) * 0.4;
      const jitterLeft = (((Math.floor(hash / 19) % 9) - 4) * 0.4);

      const top = clamp(baseSlot.top + jitterTop, 5, 92);
      const left = clamp(baseSlot.left + jitterLeft, 10, 90);
      const paletteIndex = Math.abs(hash) % bubblePalettes.length;

      bubbles.push({
        id: `${identifier}-${index}`,
        text,
        top,
        left,
        colorClass: bubblePalettes[paletteIndex],
      });
    }

    return bubbles;
  }, [submissions]);

  const handleSubmit = async () => {
    const trimmed = input.trim();
    if (!trimmed || isSubmitting) return;
    const lower = trimmed.toLowerCase();
    const bannedWords = ['sex', 'sexual', 'porn', 'nazi', 'hitler', 'racist', 'hate', 'kill', 'murder', 'violence'];

    if (bannedWords.some((word) => lower.includes(word))) {
      setError('Please keep submissions respectful—harmful or explicit language is not allowed.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const response = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: trimmed }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit message');
      }

      setInput('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSubmit();
    }
  };

  return (
    <main className="flex min-h-screen flex-col items-center gap-10 bg-slate-950 px-4 py-10 text-slate-100">
      <section className="w-full max-w-2xl text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Realtime demo</p>
        <h1 className="mt-4 text-4xl font-semibold text-white">Give me ideas</h1>
        <p className="mt-3 text-base text-slate-300">Tools · Languages · Concepts · Emojis ✨</p>

        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <input
            type="text"
            value={input}
            placeholder="Type your message"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-base text-white placeholder:text-slate-500 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
          />
          <button
            type="submit"
            disabled={!input.trim() || isSubmitting}
            className="rounded-2xl bg-emerald-500 px-5 py-3 text-base font-semibold text-emerald-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-slate-700 disabled:text-slate-400"
          >
            {isSubmitting ? 'Sending…' : 'Submit'}
          </button>
        </form>

        <div className="mt-4 text-sm text-slate-400">
          Realtime status:{' '}
          <span
            className={`font-semibold ${
              {
                subscribing: 'text-amber-300',
                subscribed: 'text-emerald-300',
                error: 'text-rose-300',
                idle: 'text-slate-400',
              }[status]
            }`}
          >
            {status}
          </span>
        </div>

        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
      </section>

      <section className="w-full max-w-4xl">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Live submissions</h2>
          <span className="text-xs uppercase tracking-wide text-slate-400">{messages.length} visible</span>
        </header>

        <div className="relative mt-6 h-[32rem] w-full">
          {messages.length === 0 && (
            <p className="absolute left-1/2 top-1/2 w-full -translate-x-1/2 -translate-y-1/2 text-center text-sm text-slate-500">
              Loading submissions…
            </p>
          )}

          {messages.map((message, index) => {
            const delay = (index % 5) * 50;
            return (
              <article
                key={message.id}
                style={{ top: `${message.top}%`, left: `${message.left}%`, animationDelay: `${delay}ms` }}
                className={`absolute max-w-xs -translate-x-1/2 rounded-[26px] bg-gradient-to-br ${message.colorClass} px-5 py-3 text-sm font-medium text-white shadow-xl shadow-blue-900/50 ring-1 ring-white/10 transition will-change-transform hover:scale-[1.02] whitespace-pre-line break-words`}
              >
                {message.text}
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}

