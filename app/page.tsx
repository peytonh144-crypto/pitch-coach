"use client";

import { useEffect, useState } from "react";

export default function Home() {
  const [company, setCompany] = useState("");
  const [years, setYears] = useState("");
  const [area, setArea] = useState("");
  const [editingConfig, setEditingConfig] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  const [persona, setPersona] = useState("generic");
  const [objection, setObjection] = useState("");
  const [response, setResponse] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const PERSONA_OPTIONS: { value: string; label: string }[] = [
    { value: "generic", label: "Generic / Not sure yet" },
    {
      value: "skeptical_bob",
      label: "Skeptical Bob — been burned, asks tough questions",
    },
    {
      value: "busy_mom_sarah",
      label: "Busy Mom Sarah — distracted, wants short answers",
    },
    {
      value: "shopping_steve",
      label: "Shopping Steve — wants 3 quotes, price-focused",
    },
    {
      value: "retired_vet_ron",
      label: "Retired Vet Ron — older, distrustful, respects respect",
    },
    {
      value: "diy_dave",
      label: "DIY Dave — thinks he can fix it himself",
    },
    {
      value: "renter_riley",
      label: "Renter / Just-Bought Riley — defers to spouse/landlord",
    },
    {
      value: "already_in_progress_pam",
      label: "Already-In-Progress Pam — has a contractor already",
    },
  ];

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
    <div className="flex flex-1 flex-col items-center bg-zinc-950 text-zinc-100">
      <main className="flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 py-12">
        <header className="flex flex-col gap-2">
          <h1 className="text-3xl font-semibold tracking-tight">Pitch Coach</h1>
          <p className="text-sm text-zinc-400">
            Paste a homeowner objection. Get a coached response in seconds.
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
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
                  />
                  <input
                    type="text"
                    inputMode="numeric"
                    value={years}
                    onChange={(e) => setYears(e.target.value)}
                    placeholder="Years (e.g. 12)"
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
                  />
                  <input
                    type="text"
                    value={area}
                    onChange={(e) => setArea(e.target.value)}
                    placeholder="Area (e.g. Dallas-Fort Worth)"
                    className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-500 focus:border-zinc-600 focus:outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={saveConfig}
                  disabled={!company.trim() || !years.trim() || !area.trim()}
                  className="self-start rounded-md bg-zinc-100 px-4 py-1.5 text-xs font-medium text-zinc-950 transition-colors hover:bg-white disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                >
                  Save
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-zinc-300">
                  <span className="text-emerald-400">✓ Configured:</span>{" "}
                  {company} · {years}yr · {area}
                </span>
                <button
                  type="button"
                  onClick={() => setEditingConfig(true)}
                  className="rounded-md border border-zinc-700 px-3 py-1 text-xs text-zinc-300 transition-colors hover:bg-zinc-800"
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
            onChange={(e) => setPersona(e.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-100 focus:border-zinc-600 focus:outline-none"
          >
            {PERSONA_OPTIONS.map((p) => (
              <option key={p.value} value={p.value} className="bg-zinc-900">
                {p.label}
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
