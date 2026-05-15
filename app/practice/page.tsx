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

const SILENCE_SENTINEL = "[REP_SILENT]";
const SILENCE_TIMEOUT_MS = 5000;
const FIRST_SILENCE_PACING_DELAY_MS = 800;

const VOICE_BY_PERSONA: Record<PersonaKey, string> = {
  generic: "alloy",
  skeptical_bob: "onyx",
  busy_mom_sarah: "nova",
  shopping_steve: "echo",
  retired_vet_ron: "fable",
  diy_dave: "onyx",
  renter_riley: "shimmer",
  already_in_progress_pam: "nova",
};

// CDN paths so we don't have to copy ONNX/worklet assets into /public
const VAD_ASSETS = {
  baseAssetPath: "https://cdn.jsdelivr.net/npm/@ricky0123/vad-web@0.0.30/dist/",
  onnxWASMBasePath:
    "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.26.0/dist/",
};

type VoiceState = "idle" | "listening" | "thinking" | "speaking" | "error";

type MicVADInstance = {
  start: () => Promise<void>;
  pause: () => Promise<void>;
  destroy: () => Promise<void>;
};

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

  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceState>("idle");
  // 0..1 progress toward the 5s start-of-turn silence trigger; resets when the
  // rep starts speaking. Drives the pulse-faster animation in the indicator.
  const [silenceProgress, setSilenceProgress] = useState(0);
  const [speechActive, setSpeechActive] = useState(false);
  const [needsTapToResume, setNeedsTapToResume] = useState(false);

  // Refs so VAD callbacks always see the latest values without re-init
  const historyRef = useRef<Turn[]>([]);
  const personaRef = useRef<PersonaKey | "">("");
  const scenarioRef = useRef<ScenarioKey | "">("");
  const processingRef = useRef(false);
  const endedRef = useRef(false);
  const vadRef = useRef<MicVADInstance | null>(null);
  const audioElRef = useRef<HTMLAudioElement | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumePlaybackRef = useRef<(() => void) | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    historyRef.current = history;
  }, [history]);
  useEffect(() => {
    personaRef.current = persona;
  }, [persona]);
  useEffect(() => {
    scenarioRef.current = scenario;
  }, [scenario]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      void teardownVoice();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Drive the start-of-turn silence visual. Only ticks while we're actively
  // listening AND no speech is currently in progress. Speech start resets it.
  useEffect(() => {
    if (voiceState !== "listening" || speechActive) {
      setSilenceProgress(0);
      return;
    }
    const startedAt = Date.now();
    setSilenceProgress(0);
    const id = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const p = Math.min(1, elapsed / SILENCE_TIMEOUT_MS);
      setSilenceProgress(p);
      if (p >= 1) clearInterval(id);
    }, 150);
    return () => clearInterval(id);
  }, [voiceState, speechActive]);

  function getRepConfig(): RepConfig {
    if (typeof window === "undefined")
      return { company: "", years: "", area: "" };
    return {
      company: localStorage.getItem("pc_company") ?? "",
      years: localStorage.getItem("pc_years") ?? "",
      area: localStorage.getItem("pc_area") ?? "",
    };
  }

  function clearSilenceTimer() {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  // Must run synchronously inside a user-gesture handler. Whisper + Claude +
  // TTS roundtrips break the gesture chain, so browsers (especially iOS
  // Safari) reject the eventual TTS .play() unless we've already unlocked an
  // <audio> element during the click. We create one shared element, play a
  // few ms of silence to flip its "user-activated" bit, then reuse the same
  // element for every later TTS reply.
  function unlockAudioPlayback() {
    const audio = new Audio();
    audio.setAttribute("playsinline", "");
    audio.preload = "auto";
    audio.src =
      "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAVFYAAFRWAAABAAgAZGF0YQAAAAA=";
    audio.play().catch(() => {
      // The silent unlock itself may reject in obscure cases — that's fine,
      // the element is still our reuse target.
    });
    audioElRef.current = audio;

    // iOS Safari also gates Web Audio behind a user gesture. Resume an
    // AudioContext during the same click so any future audio graph works.
    try {
      const Ctx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (Ctx) {
        const ctx = new Ctx();
        void ctx.resume();
      }
    } catch {
      // ignore
    }
  }

  async function teardownVoice() {
    endedRef.current = true;
    processingRef.current = false;
    clearSilenceTimer();
    if (vadRef.current) {
      try {
        await vadRef.current.destroy();
      } catch {
        // ignore
      }
      vadRef.current = null;
    }
    if (audioElRef.current) {
      try {
        audioElRef.current.pause();
      } catch {
        // ignore
      }
      audioElRef.current = null;
    }
    resumePlaybackRef.current = null;
    setNeedsTapToResume(false);
  }

  async function fetchHomeowner(
    nextHistory: Turn[],
  ): Promise<{ text: string; isEnd: boolean } | null> {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/practice", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          persona: personaRef.current,
          scenario: scenarioRef.current,
          history: nextHistory,
          repConfig: getRepConfig(),
        }),
      });
      const data = (await res.json()) as {
        response?: string;
        error?: string;
        isEndOfConversation?: boolean;
      };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
        return null;
      }
      if (data.response) {
        const text = data.response;
        setHistory((h) => {
          const next = [...h, { role: "homeowner" as const, content: text }];
          historyRef.current = next;
          return next;
        });
        return { text, isEnd: !!data.isEndOfConversation };
      }
      return null;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function speakReply(text: string): Promise<void> {
    if (endedRef.current) return;
    const p = personaRef.current;
    if (!p) return;
    const voice = VOICE_BY_PERSONA[p as PersonaKey] ?? "alloy";
    setVoiceState("speaking");
    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? `TTS failed (${res.status})`);
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);

      // Reuse the element unlocked during the Start click. A fresh
      // new Audio() here would be re-blocked by autoplay policy.
      let audio = audioElRef.current;
      if (!audio) {
        audio = new Audio();
        audio.setAttribute("playsinline", "");
        audio.preload = "auto";
        audioElRef.current = audio;
      }
      audio.src = url;

      await new Promise<void>((resolve) => {
        const cleanup = () => {
          URL.revokeObjectURL(url);
          audio!.onended = null;
          audio!.onerror = null;
          resumePlaybackRef.current = null;
          resolve();
        };
        audio!.onended = cleanup;
        audio!.onerror = cleanup;
        audio!.play().catch(() => {
          // Edge case: the unlock didn't take (e.g., user navigated away and
          // back, gesture got reused, etc.). Surface a tap-to-resume button
          // and hold the conversation flow until the user re-arms playback.
          resumePlaybackRef.current = () => {
            setNeedsTapToResume(false);
            audio!.play().catch(() => {
              // Truly stuck — drop the audio and let the conversation
              // continue rather than freezing.
              cleanup();
            });
          };
          setNeedsTapToResume(true);
        });
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    }
  }

  async function processSpeechSegment(audio: Float32Array) {
    if (endedRef.current || processingRef.current) return;
    processingRef.current = true;

    // Pause VAD while we process so it doesn't re-fire during TTS playback
    if (vadRef.current) {
      try {
        await vadRef.current.pause();
      } catch {
        // ignore
      }
    }

    setVoiceState("thinking");

    let transcript = "";
    try {
      const { utils } = await import("@ricky0123/vad-web");
      const wav = utils.encodeWAV(audio);
      const blob = new Blob([wav], { type: "audio/wav" });
      const file = new File([blob], "speech.wav", { type: "audio/wav" });
      const fd = new FormData();
      fd.append("audio", file);
      const res = await fetch("/api/transcribe", {
        method: "POST",
        body: fd,
      });
      const data = (await res.json()) as { text?: string; error?: string };
      if (!res.ok || typeof data.text !== "string") {
        setError(data.error ?? `Transcription failed (${res.status})`);
        return;
      }
      transcript = data.text.trim();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Transcription error");
      return;
    }

    if (endedRef.current) return;

    if (!transcript) {
      // Silent / unintelligible — restart listening without recording a turn
      processingRef.current = false;
      await resumeListening();
      return;
    }

    await processRepTurn(transcript);
  }

  async function processSilence() {
    if (endedRef.current || processingRef.current) return;
    processingRef.current = true;
    clearSilenceTimer();
    if (vadRef.current) {
      try {
        await vadRef.current.pause();
      } catch {
        // ignore
      }
    }
    setVoiceState("thinking");
    await processRepTurn(SILENCE_SENTINEL);
  }

  // Shared post-rep-turn flow: append rep, fetch homeowner, speak, then either
  // end the practice (if the homeowner closed the door) or re-open the mic.
  async function processRepTurn(content: string) {
    const next: Turn[] = [
      ...historyRef.current,
      { role: "rep", content },
    ];
    setHistory(next);
    historyRef.current = next;

    const reply = await fetchHomeowner(next);
    if (endedRef.current) return;

    if (reply) {
      // Pacing for the first silence: small beat before the impatient reaction.
      if (content === SILENCE_SENTINEL && !reply.isEnd) {
        await new Promise((r) => setTimeout(r, FIRST_SILENCE_PACING_DELAY_MS));
      }
      await speakReply(reply.text);
    }

    processingRef.current = false;
    if (endedRef.current) return;

    if (reply && reply.isEnd) {
      // Homeowner ended the conversation — auto-trigger grading.
      void endPractice();
      return;
    }

    await resumeListening();
  }

  async function resumeListening() {
    if (endedRef.current) return;
    if (!vadRef.current) return;
    try {
      await vadRef.current.start();
      setVoiceState("listening");
      // Start the rep-silence timer. VAD's onSpeechStart will clear it.
      clearSilenceTimer();
      silenceTimerRef.current = setTimeout(() => {
        silenceTimerRef.current = null;
        if (endedRef.current || processingRef.current) return;
        void processSilence();
      }, SILENCE_TIMEOUT_MS);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to resume mic";
      setError(`Microphone error: ${msg}`);
      setVoiceState("error");
    }
  }

  async function initVAD(): Promise<MicVADInstance | null> {
    try {
      const { MicVAD } = await import("@ricky0123/vad-web");
      const vad = await MicVAD.new({
        ...VAD_ASSETS,
        model: "v5",
        // ~1.8s of silence before we consider the rep done speaking. Long enough
        // to ride out a mid-sentence "thinking pause" without cutting them off.
        // The captured audio includes this trailing window, which doubles as the
        // post-speech padding buffer for the rep's final word.
        redemptionMs: 1800,
        preSpeechPadMs: 200,
        minSpeechMs: 250,
        positiveSpeechThreshold: 0.5,
        negativeSpeechThreshold: 0.35,
        onSpeechStart: () => {
          // Real human speech detected — cancel the silence countdown and
          // freeze the silence-progress visual.
          clearSilenceTimer();
          setSpeechActive(true);
        },
        onSpeechEnd: (audio) => {
          setSpeechActive(false);
          void processSpeechSegment(audio);
        },
        onVADMisfire: () => {
          // Brief noise that didn't pan out as speech — reset visual state.
          setSpeechActive(false);
        },
      });
      return vad as unknown as MicVADInstance;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      // Bail to text mode on permission failure or load failure
      setError(
        msg.toLowerCase().includes("permission") ||
          msg.toLowerCase().includes("denied")
          ? "Microphone permission denied — falling back to text mode."
          : `Voice setup failed: ${msg}. Falling back to text mode.`,
      );
      setVoiceMode(false);
      setVoiceState("idle");
      return null;
    }
  }

  async function startPractice() {
    if (!persona || !scenario || loading) return;

    // Unlock audio playback SYNCHRONOUSLY, before any await consumes the
    // user-gesture context. Without this, the eventual TTS .play() is
    // blocked by autoplay policy ("not allowed by the user agent").
    if (voiceMode) {
      unlockAudioPlayback();
    }

    endedRef.current = false;
    processingRef.current = false;
    setStarted(true);
    setHistory([]);
    historyRef.current = [];
    setGrade(null);
    setError("");
    setNeedsTapToResume(false);
    resumePlaybackRef.current = null;
    setVoiceState("idle");

    if (voiceMode) {
      // Initialize VAD before fetching opening so the mic permission prompt
      // happens during the user gesture (the Start click).
      const vad = await initVAD();
      if (!vad) return; // already fell back to text
      vadRef.current = vad;
    }

    const opening = await fetchHomeowner([]);
    if (endedRef.current) return;

    if (opening && voiceMode) {
      await speakReply(opening.text);
      if (endedRef.current) return;
      await resumeListening();
    }
  }

  async function sendRepMessage() {
    const text = draft.trim();
    if (!text || loading || grading || grade) return;
    const next = [...history, { role: "rep" as const, content: text }];
    setHistory(next);
    historyRef.current = next;
    setDraft("");
    await fetchHomeowner(next);
  }

  async function endPractice() {
    if (grading || grade || !persona || !scenario) return;
    if (history.length === 0) return;
    await teardownVoice();
    setVoiceState("idle");
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

  async function reset() {
    await teardownVoice();
    endedRef.current = false;
    setStarted(false);
    setHistory([]);
    historyRef.current = [];
    setDraft("");
    setError("");
    setGrade(null);
    setGrading(false);
    setVoiceState("idle");
  }

  async function skipMyTurn() {
    if (voiceState !== "listening" || !vadRef.current) return;
    // Treat as if the rep just stood there silently — same flow as the timer.
    await processSilence();
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

  // Voice live-view: only show last rep turn + last homeowner turn
  const lastHomeowner = [...history]
    .reverse()
    .find((t) => t.role === "homeowner");
  const lastRep = [...history].reverse().find((t) => t.role === "rep");
  const liveView: Turn[] = [];
  if (lastRep) liveView.push(lastRep);
  if (lastHomeowner) liveView.push(lastHomeowner);
  // Show in chronological order
  liveView.sort(
    (a, b) => history.lastIndexOf(a) - history.lastIndexOf(b),
  );

  const showFullTranscript = !voiceMode || showPostGradeActions;
  const messagesToRender = showFullTranscript ? history : liveView;

  return (
    <div className="flex flex-1 flex-col items-center">
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-10 sm:px-6 sm:py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Practice Mode
          </h1>
          <p className="text-sm text-zinc-400">
            Pick a homeowner persona and a scenario, then run a practice
            conversation.
          </p>
        </header>

        {showStartScreen ? (
          <section className="flex flex-col gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4">
            <div className="flex items-center justify-between gap-3 rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2.5">
              <div className="flex flex-col">
                <span className="text-sm font-medium text-zinc-200">
                  Voice Mode
                </span>
                <span className="text-xs text-zinc-500">
                  Hands-free — speak naturally, no buttons.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={voiceMode}
                onClick={() => setVoiceMode((v) => !v)}
                className={
                  voiceMode
                    ? "relative h-6 w-11 shrink-0 rounded-full bg-brand transition-colors"
                    : "relative h-6 w-11 shrink-0 rounded-full bg-zinc-700 transition-colors"
                }
              >
                <span
                  className={
                    voiceMode
                      ? "absolute top-0.5 left-[22px] h-5 w-5 rounded-full bg-white transition-all"
                      : "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-all"
                  }
                />
              </button>
            </div>

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
              className="self-start rounded-lg bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {loading ? "Starting…" : "Start Practice"}
            </button>
          </section>
        ) : (
          <section className="flex flex-1 flex-col gap-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-500">
                <span>
                  {PERSONAS[persona as PersonaKey]?.label.split(" — ")[0]} ·{" "}
                  {SCENARIOS[scenario as ScenarioKey]?.label.split(" — ")[0]}
                </span>
                {voiceMode && !showPostGradeActions && (
                  <span className="rounded-full bg-brand/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand">
                    Voice
                  </span>
                )}
              </div>
              {showPostGradeActions && (
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={reset}
                    className="rounded-md bg-brand px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-hover"
                  >
                    Practice Again
                  </button>
                  <Link
                    href="/history"
                    className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
                  >
                    View History
                  </Link>
                </div>
              )}
            </div>

            <div
              ref={scrollRef}
              className="flex min-h-96 flex-1 flex-col gap-3 overflow-y-auto rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4"
            >
              {messagesToRender.length === 0 && voiceMode && (
                <div className="flex flex-1 items-center justify-center text-xs text-zinc-500">
                  Waiting for the homeowner to open the door…
                </div>
              )}
              {messagesToRender.map((turn, i) => {
                if (
                  turn.role === "rep" &&
                  turn.content === SILENCE_SENTINEL
                ) {
                  return (
                    <div
                      key={`${i}-silent`}
                      className="flex justify-end"
                    >
                      <span className="text-xs italic text-zinc-500">
                        (stood there silently)
                      </span>
                    </div>
                  );
                }
                return (
                  <div
                    key={`${i}-${turn.role}`}
                    className={
                      turn.role === "rep"
                        ? "flex justify-end"
                        : "flex justify-start"
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
                );
              })}
              {!voiceMode && loading && (
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

            {needsTapToResume && (
              <button
                type="button"
                onClick={() => resumePlaybackRef.current?.()}
                className="self-center rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-hover"
              >
                Tap to continue
              </button>
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

            {/* Input area: text mode OR voice controls. Hidden after grading. */}
            {!showPostGradeActions &&
              (voiceMode ? (
                <VoiceControls
                  state={voiceState}
                  silenceProgress={silenceProgress}
                  onEnd={endPractice}
                  onSkip={skipMyTurn}
                  endDisabled={
                    grading || loading || history.length === 0
                  }
                />
              ) : (
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
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={endPractice}
                      disabled={
                        grading || loading || history.length === 0
                      }
                      className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      End Practice
                    </button>
                    <button
                      type="button"
                      onClick={sendRepMessage}
                      disabled={inputDisabled || !draft.trim()}
                      className="rounded-md bg-brand px-5 py-2 text-xs font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                    >
                      Send
                    </button>
                  </div>
                </div>
              ))}
          </section>
        )}
      </main>
    </div>
  );
}

function VoiceControls({
  state,
  silenceProgress,
  onEnd,
  onSkip,
  endDisabled,
}: {
  state: VoiceState;
  silenceProgress: number;
  onEnd: () => void;
  onSkip: () => void;
  endDisabled: boolean;
}) {
  return (
    <div className="flex flex-col items-center gap-4 rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-6">
      <StateIndicator state={state} silenceProgress={silenceProgress} />

      <div className="flex flex-wrap items-center justify-center gap-2">
        {state === "listening" && (
          <button
            type="button"
            onClick={onSkip}
            className="rounded-md border border-zinc-700 px-3 py-2 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
          >
            Skip my turn
          </button>
        )}
        <button
          type="button"
          onClick={onEnd}
          disabled={endDisabled}
          className="rounded-md bg-brand px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          End Practice
        </button>
      </div>
    </div>
  );
}

function StateIndicator({
  state,
  silenceProgress,
}: {
  state: VoiceState;
  silenceProgress: number;
}) {
  if (state === "listening") {
    // Pulse speeds up as the rep stays silent, from a calm 1.6s to a tight
    // 0.5s as we approach the impatience threshold.
    const pulseDuration = `${(1.6 - silenceProgress * 1.1).toFixed(2)}s`;
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="relative flex h-20 w-20 items-center justify-center">
          <span
            className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brand opacity-30"
            style={{ animationDuration: pulseDuration }}
          ></span>
          <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-brand/20 ring-2 ring-brand">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="#FF6B35"
              aria-hidden="true"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
              <path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21a1 1 0 1 0 2 0v-3.08A7 7 0 0 0 19 11z" />
            </svg>
          </span>
        </div>
        <span className="text-sm font-medium text-brand">Listening…</span>
      </div>
    );
  }

  if (state === "thinking") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-20 w-20 items-center justify-center">
          <svg
            className="h-10 w-10 animate-spin text-zinc-300"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <circle
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeOpacity="0.2"
              strokeWidth="3"
            />
            <path
              d="M22 12a10 10 0 0 0-10-10"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <span className="text-sm font-medium text-zinc-300">Thinking…</span>
      </div>
    );
  }

  if (state === "speaking") {
    return (
      <div className="flex flex-col items-center gap-2">
        <div className="flex h-20 w-20 items-end justify-center gap-1">
          <span className="h-6 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:-0.3s] [animation-duration:0.7s]"></span>
          <span className="h-10 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:-0.15s] [animation-duration:0.7s]"></span>
          <span className="h-14 w-1.5 animate-pulse rounded-full bg-brand [animation-duration:0.7s]"></span>
          <span className="h-10 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:-0.15s] [animation-duration:0.7s]"></span>
          <span className="h-6 w-1.5 animate-pulse rounded-full bg-brand [animation-delay:-0.3s] [animation-duration:0.7s]"></span>
        </div>
        <span className="text-sm font-medium text-brand">Speaking…</span>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex h-20 items-center justify-center text-sm text-red-300">
        Voice error — see message above
      </div>
    );
  }

  // idle
  return (
    <div className="flex h-20 items-center justify-center text-sm text-zinc-500">
      Connecting…
    </div>
  );
}
