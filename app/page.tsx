"use client";

import { useState } from "react";

export default function Home() {
  const [objection, setObjection] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    if (!objection.trim() || loading) return;
    setLoading(true);
    setError("");
    setResponse("");
    try {
      const res = await fetch("/api/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ objection }),
      });
      const data = (await res.json()) as { response?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? `Request failed (${res.status})`);
      } else {
        setResponse(data.response ?? "");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-1 flex-col items-center bg-zinc-950 text-zinc-100">
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Pitch Coach
          </h1>
          <p className="text-sm text-zinc-400">
            Paste a homeowner objection. Get a coached response in seconds.
          </p>
        </header>

        <textarea
          value={objection}
          onChange={(e) => setObjection(e.target.value)}
          placeholder="e.g. 'I already have a roofer I trust.'"
          rows={5}
          className="w-full resize-y rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
        />

        <button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !objection.trim()}
          className="self-start rounded-lg bg-zinc-100 px-5 py-2.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {loading ? "Thinking…" : "Get Response"}
        </button>

        {error && (
          <div className="rounded-lg border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}

        {response && (
          <div className="whitespace-pre-wrap rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm leading-relaxed text-zinc-100">
            {response}
          </div>
        )}
      </main>
    </div>
  );
}
