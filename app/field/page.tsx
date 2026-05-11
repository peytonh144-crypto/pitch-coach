"use client";

import { useEffect, useState } from "react";
import { PERSONAS, type PersonaKey } from "@/lib/personas";

export default function FieldPage() {
  const [company, setCompany] = useState("");
  const [years, setYears] = useState("");
  const [area, setArea] = useState("");
  const [editingConfig, setEditingConfig] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const [persona, setPersona] = useState<PersonaKey>("generic");
  const [objection, setObjection] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const c = localStorage.getItem("pc_company") ?? "";
    const y = localStorage.getItem("pc_years") ?? "";
    const a = localStorage.getItem("pc_area") ?? "";
    setCompany(c);
    setYears(y);
    setArea(a);
    if (c.trim() && y.trim() && a.trim()) {
      setEditingConfig(false);
    }
    setHydrated(true);
  }, []);

  function saveConfig() {
    localStorage.setItem("pc_company", company.trim());
    localStorage.setItem("pc_years", years.trim());
    localStorage.setItem("pc_area", area.trim());
    if (company.trim() && years.trim() && area.trim()) {
      setEditingConfig(false);
    }
  }

  async function handleSubmit() {
    if (!objection.trim() || loading) return;
    setLoading(true);
    setError("");
    setResponse("");
    try {
      const res = await fetch("/api/respond", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          objection,
          company: company.trim(),
          years: years.trim(),
          area: area.trim(),
          persona,
        }),
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
    <div className="flex flex-1 flex-col items-center">
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-6 px-5 py-10 sm:px-6 sm:py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Field Mode</h1>
          <p className="text-sm text-zinc-400">
            Paste an objection you just heard at the door. Get a coached
            response calibrated to the homeowner type.
          </p>
        </header>

        {hydrated && (
          <section className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-4">
            {editingConfig ? (
              <div className="flex flex-col gap-3">
                <h2 className="text-sm font-medium text-zinc-300">Your Info</h2>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Company (e.g. Lone Star Roofing)"
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={years}
                    onChange={(e) => setYears(e.target.value)}
                    placeholder="Years (e.g. 12)"
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Area (e.g. Dallas-Fort Worth)"
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-3 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={saveConfig}
                  disabled={!company.trim() || !years.trim() || !area.trim()}
                  className="self-start rounded-md bg-brand px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm text-zinc-300">
                  <span className="text-brand">✓ Configured:</span> {company} ·{" "}
                  {years}yr · {area}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingConfig(true)}
                  className="rounded-md border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
                >
                  Edit
                </button>
              </div>
            )}
          </section>
        )}

        <div className="flex flex-col gap-2">
          <label
            htmlFor="persona"
            className="text-sm font-medium text-zinc-300"
          >
            Homeowner type
          </label>
          <select
            id="persona"
            value={persona}
            onChange={(e) => setPersona(e.target.value as PersonaKey)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
          >
            {(Object.keys(PERSONAS) as PersonaKey[]).map((k) => (
              <option key={k} value={k} className="bg-zinc-900">
                {PERSONAS[k].label}
              </option>
            ))}
          </select>
        </div>

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
          className="self-start rounded-lg bg-brand px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-hover disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
        >
          {loading ? (
            <span className="inline-flex items-center gap-2">
              <span className="inline-flex gap-1">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:-0.3s]"></span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white [animation-delay:-0.15s]"></span>
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white"></span>
              </span>
              Thinking
            </span>
          ) : (
            "Get Response"
          )}
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
