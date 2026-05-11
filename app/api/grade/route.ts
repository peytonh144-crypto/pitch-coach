import Anthropic from "@anthropic-ai/sdk";
import {
  PERSONAS,
  SCENARIOS,
  type PersonaKey,
  type ScenarioKey,
} from "@/lib/personas";

const client = new Anthropic();

type Turn = { role: "rep" | "homeowner"; content: string };

function buildSystemPrompt(opts: {
  persona: PersonaKey;
  scenario: ScenarioKey;
}) {
  const personaCharacter = PERSONAS[opts.persona].homeownerCharacter;
  const scenarioContext = SCENARIOS[opts.scenario].context;
  const personaLabel = PERSONAS[opts.persona].label;
  const scenarioLabel = SCENARIOS[opts.scenario].label;

  return [
    `You're a master sales trainer for a storm restoration roofing company. The user will give you a full transcript of a door-knock practice conversation. The rep was practicing against an AI homeowner playing "${personaLabel}" in the "${scenarioLabel}" scenario.`,
    "Your job: review the rep's performance honestly and produce structured feedback. Be specific. Quote the rep's actual words when calling out moments. Be direct but not harsh — coaching tone, not critique.",
    "",
    "For context, the homeowner the rep was talking to was modeled as:",
    personaCharacter,
    "",
    "And the scenario context was:",
    scenarioContext,
    "",
    "Output FORMAT — return EXACTLY this Markdown structure, no preamble, no closing remarks:",
    "",
    "## Score: [N]/10",
    "",
    "**Outcome:** [one of: Inspection booked | Callback scheduled | Info exchanged (left card, got phone, etc.) | No progress (homeowner not interested) | Door closed (rep lost rapport)]",
    "",
    "## What worked",
    '- **[Short label]:** "[exact quote from rep]" — [1 sentence why this worked]',
    "- (1–3 bullets total)",
    "",
    "## Where you lost ground",
    '- **[Short label]:** "[exact quote from rep]" — [1 sentence why this hurt + what the homeowner likely felt]',
    "- (1–3 bullets total)",
    "",
    "## Try next time",
    "- [Concrete actionable line or move, 1 sentence each]",
    "- (2–4 bullets total)",
    "",
    "## The biggest lesson",
    "[1–2 sentences. What's the single most important takeaway?]",
  ].join("\n");
}

function formatTranscript(history: Turn[]): string {
  return history
    .map((t) => (t.role === "rep" ? `REP: ${t.content}` : `HOMEOWNER: ${t.content}`))
    .join("\n\n");
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    persona?: string;
    scenario?: string;
    history?: Turn[];
    repConfig?: { company?: string; years?: string; area?: string };
  };

  const persona = body.persona as PersonaKey | undefined;
  const scenario = body.scenario as ScenarioKey | undefined;

  if (!persona || !PERSONAS[persona]) {
    return Response.json({ error: "Invalid 'persona'." }, { status: 400 });
  }
  if (!scenario || !SCENARIOS[scenario]) {
    return Response.json({ error: "Invalid 'scenario'." }, { status: 400 });
  }

  const history = Array.isArray(body.history) ? body.history : [];
  if (history.length === 0) {
    return Response.json(
      { error: "Cannot grade an empty conversation." },
      { status: 400 },
    );
  }

  const system = buildSystemPrompt({ persona, scenario });
  const transcript = formatTranscript(history);

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system,
      messages: [
        {
          role: "user",
          content: `Here is the full transcript of the practice conversation. Grade it using the exact format above.\n\n${transcript}`,
        },
      ],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return Response.json({ grade: text });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return Response.json(
        { error: error.message },
        { status: error.status ?? 500 },
      );
    }
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
