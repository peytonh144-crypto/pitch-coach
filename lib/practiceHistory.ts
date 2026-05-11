import type { PersonaKey, ScenarioKey } from "./personas";

export type Turn = { role: "rep" | "homeowner"; content: string };

export type RepConfig = {
  company: string;
  years: string;
  area: string;
};

export type PracticeSession = {
  id: string;
  timestamp: string;
  persona: PersonaKey;
  scenario: ScenarioKey;
  repConfig: RepConfig;
  transcript: Turn[];
  grade: string;
};

const STORAGE_KEY = "pc_practice_history";
const MAX_SESSIONS = 50;

export function loadSessions(): PracticeSession[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed as PracticeSession[];
  } catch {
    return [];
  }
}

export function saveSession(session: PracticeSession): void {
  if (typeof window === "undefined") return;
  const existing = loadSessions();
  const next = [session, ...existing].slice(0, MAX_SESSIONS);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export function deleteSession(id: string): PracticeSession[] {
  if (typeof window === "undefined") return [];
  const next = loadSessions().filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function newId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function extractScore(grade: string): number | null {
  const m = grade.match(/##\s*Score:\s*(\d+)\s*\/\s*10/i);
  return m ? Number(m[1]) : null;
}

export function extractOutcome(grade: string): string | null {
  const m = grade.match(/\*\*Outcome:\*\*\s*(.+?)(?:\n|$)/);
  return m ? m[1].trim() : null;
}
