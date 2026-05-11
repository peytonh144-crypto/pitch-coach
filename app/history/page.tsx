"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import { PERSONAS, SCENARIOS } from "@/lib/personas";
import {
  deleteSession,
  extractOutcome,
  extractScore,
  loadSessions,
  type PracticeSession,
} from "@/lib/practiceHistory";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<PracticeSession[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    setSessions(loadSessions());
    setHydrated(true);
  }, []);

  function onDelete(id: string) {
    if (!confirm("Delete this practice session? This can't be undone.")) return;
    const next = deleteSession(id);
    setSessions(next);
    if (expandedId === id) setExpandedId(null);
  }

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="flex w-full max-w-3xl flex-1 flex-col gap-6 px-5 py-10 sm:px-6 sm:py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">History</h1>
          <p className="text-sm text-zinc-400">
            Your past practice sessions. Click a row to see the full transcript
            and grade.
          </p>
        </header>

        {!hydrated ? null : sessions.length === 0 ? (
          <div className="flex flex-col items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-6 py-12 text-center">
            <p className="text-base text-zinc-300">
              No practice sessions yet.
            </p>
            <p className="max-w-md text-sm text-zinc-400">
              Head to Practice Mode and run one — your sessions and grades show
              up here.
            </p>
            <Link
              href="/practice"
              className="inline-flex h-11 items-center justify-center rounded-lg bg-brand px-5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
            >
              Start a Practice
            </Link>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {sessions.map((s) => {
              const score = extractScore(s.grade);
              const outcome = extractOutcome(s.grade);
              const personaShort =
                PERSONAS[s.persona]?.label.split(" — ")[0] ?? s.persona;
              const scenarioShort =
                SCENARIOS[s.scenario]?.label.split(" — ")[0] ?? s.scenario;
              const isOpen = expandedId === s.id;

              return (
                <li
                  key={s.id}
                  className="overflow-hidden rounded-lg border border-zinc-800 bg-zinc-900"
                >
                  <div className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-zinc-800/60">
                    <button
                      type="button"
                      onClick={() => setExpandedId(isOpen ? null : s.id)}
                      className="flex min-w-0 flex-1 items-center justify-between gap-4 text-left"
                    >
                      <div className="flex min-w-0 flex-1 flex-col gap-1">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                          <span className="text-sm font-medium text-zinc-100">
                            {personaShort}
                          </span>
                          <span className="text-xs text-zinc-500">
                            {scenarioShort}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-zinc-400">
                          <span>{formatDate(s.timestamp)}</span>
                          {outcome && (
                            <>
                              <span className="text-zinc-700">·</span>
                              <span>{outcome}</span>
                            </>
                          )}
                        </div>
                      </div>
                      {score !== null && (
                        <span className="shrink-0 rounded-md bg-zinc-800 px-2 py-1 text-xs font-medium text-zinc-100">
                          {score}/10
                        </span>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(s.id)}
                      className="shrink-0 rounded-md border border-zinc-700 px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-red-950/40 hover:text-red-200"
                    >
                      Delete
                    </button>
                  </div>

                  {isOpen && (
                    <div className="flex flex-col gap-4 border-t border-zinc-800 bg-zinc-950 px-4 py-4">
                      <div className="flex flex-col gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Transcript
                        </h3>
                        <div className="flex flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-900 p-3">
                          {s.transcript.map((t, i) => (
                            <div
                              key={i}
                              className={
                                t.role === "rep"
                                  ? "flex justify-end"
                                  : "flex justify-start"
                              }
                            >
                              <div
                                className={
                                  t.role === "rep"
                                    ? "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-blue-600 px-3 py-1.5 text-xs text-white"
                                    : "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-zinc-800 px-3 py-1.5 text-xs text-zinc-100"
                                }
                              >
                                {t.content}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex flex-col gap-2">
                        <h3 className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                          Grade
                        </h3>
                        <article className="prose-grade rounded-md border border-emerald-900/40 bg-emerald-950/20 px-4 py-3 text-sm leading-relaxed text-zinc-100">
                          <ReactMarkdown>{s.grade}</ReactMarkdown>
                        </article>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </main>
    </div>
  );
}
