"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  PERSONAS,
  SCENARIOS,
  type PersonaKey,
  type ScenarioKey,
} from "@/lib/personas";
import {
  newId,
  saveSession,
  type RepConfig,
  type Turn,
} from "@/lib/practiceHistory";

export default function PracticePage() {
  const [persona, setPersona] = useState<PersonaKey | "">("");
  const [scenario, setScenario] = useState<ScenarioKey | "">("");
  const [started, setStarted] = useState(false);

  const [history, setHistory] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [grading, setGrading] = useState(false);
  const [grade, setGrade] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  function getRepConfig(): RepConfig {
    if (typeof window === "undefined")
      return { company: "", years: "", area: "" };
    return {
      company: localStorage.getItem("pc_company") ?? "",
      years: localStorage.getItem("pc_years") ?? "",
      area: localStorage.getItem("pc_area") ?? "",
    };
  }

  async function fetchHomeowner(nextHistory: Turn[]) {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona,
          scenario,
          history: nextHistory,
          repConfig: getRepConfig(),
        }),
      });
      const data = (await res.json()) as { response?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return;
      }
      if (data.response) {
        setHistory((h) => [...h, { role: "homeowner", content: data.response! }]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  async function startPractice() {
    if (!persona || !scenario || loading) return;
    setStarted(true);
    setHistory([]);
    setGrade(null);
    setError("");
    await fetchHomeowner([]);
  }

  async function sendRepMessage() {
    const text = draft.trim();
    if (!text || loading || grading || grade) return;
    const next = [...history, { role: "rep" as const, content: text }];
    setHistory(next);
    setDraft("");
    await fetchHomeowner(next);
  }

  async function endPractice() {
    if (grading || grade || !persona || !scenario) return;
    if (history.length === 0) return;
    setGrading(true);
    setError("");
    const repConfig = getRepConfig();
    try {
      const res = await fetch("/api/grade", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona,
          scenario,
          history,
          repConfig,
        }),
      });
      const data = (await res.json()) as { grade?: string; error?: string };
      if (!res.ok || !data.grade) {
        setError(data.error ?? `Grading failed (${res.status})`);
        return;
      }
      setGrade(data.grade);
      saveSession({
        id: newId(),
        timestamp: new Date().toISOString(),
        persona: persona as PersonaKey,
        scenario: scenario as ScenarioKey,
        repConfig,
        transcript: history,
        grade: data.grade,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setGrading(false);
    }
  }

  function reset() {
    setStarted(false);
    setHistory([]);
    setDraft("");
    setError("");
    setGrade(null);
    setGrading(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      void sendRepMessage();
    }
  }

  const inputDisabled = loading || grading || grade !== null;
  const showStartScreen = !started;
  const showPostGradeActions = grade !== null;

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Practice Mode
          </h1>
          <p className="text-sm text-zinc-400">
            Roleplay a door conversation with an AI homeowner. Choose a persona
            and scenario, then practice your pitch.
          </p>
        </header>

        {showStartScreen ? (
          <section className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="persona"
                className="text-sm font-medium text-zinc-300"
              >
                Homeowner persona
              </label>
              <select
                id="persona"
                value={persona}
                onChange={(e) => setPersona(e.target.value as PersonaKey)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
              >
                <option value="">Select a persona…</option>
                {(Object.keys(PERSONAS) as PersonaKey[]).map((k) => (
                  <option key={k} value={k} className="bg-zinc-900">
                    {PERSONAS[k].label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-2">
              <label
                htmlFor="scenario"
                className="text-sm font-medium text-zinc-300"
              >
                Scenario
              </label>
              <select
                id="scenario"
                value={scenario}
                onChange={(e) => setScenario(e.target.value as ScenarioKey)}
                className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
              >
                <option value="">Select a scenario…</option>
                {(Object.keys(SCENARIOS) as ScenarioKey[]).map((k) => (
                  <option key={k} value={k} className="bg-zinc-900">
                    {SCENARIOS[k].label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={startPractice}
              disabled={!persona || !scenario || loading}
              className="self-start rounded-lg bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {loading ? "Starting…" : "Start Practice"}
            </button>
          </section>
        ) : (
          <section className="flex flex-1 flex-col gap-3">
            <div className="flex items-center justify-between">
              <div className="text-xs text-zinc-500">
                {PERSONAS[persona as PersonaKey]?.label.split(" — ")[0]} ·{" "}
                {SCENARIOS[scenario as ScenarioKey]?.label.split(" — ")[0]}
              </div>
              <div className="flex gap-2">
                {showPostGradeActions ? (
                  <>
                    <button
                      type="button"
                      onClick={reset}
                      className="rounded-md bg-zinc-100 px-3 py-1 text-xs font-medium text-zinc-950 transition-colors hover:bg-white"
                    >
                      Practice Again
                    </button>
                    <Link
                      href="/history"
                      className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
                    >
                      View History
                    </Link>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={endPractice}
                      disabled={
                        grading || loading || history.length === 0
                      }
                      className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      End Practice
                    </button>
                    <button
                      type="button"
                      onClick={reset}
                      disabled={grading}
                      className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Restart
                    </button>
                  </>
                )}
              </div>
            </div>

            <div
              ref={scrollRef}
              className="flex min-h-96 flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4"
            >
              {history.map((turn, i) => (
                <div
                  key={i}
                  className={
                    turn.role === "rep" ? "flex justify-end" : "flex justify-start"
                  }
                >
                  <div
                    className={
                      turn.role === "rep"
                        ? "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-blue-600 px-4 py-2 text-sm text-white"
                        : "max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-bl-sm bg-zinc-800 px-4 py-2 text-sm text-zinc-100"
                    }
                  >
                    {turn.content}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm bg-zinc-800 px-4 py-2 text-sm text-zinc-400">
                    <span className="inline-flex gap-1">
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.3s]"></span>
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500 [animation-delay:-0.15s]"></span>
                      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-zinc-500"></span>
                    </span>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
                {error}
              </div>
            )}

            {grading && (
              <div className="flex items-center gap-3 rounded-lg border border-amber-900/40 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
                <span className="inline-flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400 [animation-delay:-0.3s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400 [animation-delay:-0.15s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-amber-400"></span>
                </span>
                Grading your conversation…
              </div>
            )}

            {grade && (
              <article className="prose-grade rounded-lg border border-emerald-900/40 bg-emerald-950/20 px-5 py-4 text-sm leading-relaxed text-zinc-100">
                <ReactMarkdown>{grade}</ReactMarkdown>
              </article>
            )}

            {!showPostGradeActions && (
              <div className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3">
                <textarea
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onKeyDown}
                  placeholder="Your turn — what does the rep say? (⌘/Ctrl+Enter to send)"
                  rows={3}
                  disabled={inputDisabled}
                  className="w-full resize-y rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none disabled:opacity-60"
                />
                <button
                  type="button"
                  onClick={sendRepMessage}
                  disabled={inputDisabled || !draft.trim()}
                  className="self-end rounded-md bg-zinc-100 px-4 py-1.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  Send
                </button>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
