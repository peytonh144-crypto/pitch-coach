import Anthropic from "@anthropic-ai/sdk";
import {
  PERSONAS,
  SCENARIOS,
  type PersonaKey,
  type ScenarioKey,
} from "@/lib/personas";

const client = new Anthropic();

type Turn = { role: "rep" | "homeowner"; content: string };

const SILENCE_SENTINEL = "[REP_SILENT]";

function countTrailingSilences(history: Turn[]): number {
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const t = history[i];
    if (t.role === "homeowner") continue;
    if (t.content === SILENCE_SENTINEL) count++;
    else break;
  }
  return count;
}

function buildSystemPrompt(opts: {
  persona: PersonaKey;
  scenario: ScenarioKey;
  company: string;
  years: string;
  area: string;
}) {
  const personaCharacter = PERSONAS[opts.persona].homeownerCharacter;
  const scenarioContext = SCENARIOS[opts.scenario].context;

  const company = opts.company || "an unknown company";
  const years = opts.years || "an unspecified number of";
  const area = opts.area || "your area";
  const repContext = `The rep at your door works for ${company} which has been in business for ${years} years in ${area}. You don't know this yet — they may or may not mention it.`;

  return [
    "You are roleplaying a HOMEOWNER answering the door for a roofing rep. You are NOT a sales coach. You play the homeowner character entirely and never break character.",
    "",
    "Your character:",
    personaCharacter,
    "",
    "The scenario:",
    scenarioContext,
    "",
    "Rep context:",
    repContext,
    "",
    "Rules:",
    "- Keep responses SHORT — 1 to 3 sentences, like real porch conversation. Use contractions, fragments, occasional interruptions. Natural and conversational.",
    "- React to what the rep actually says. Don't be a pushover. Be skeptical of empty pitches and pushy tactics.",
    "- If the rep is pushy, lying, or off-putting: get annoyed, look at your watch, threaten to close the door, say 'I'm not interested.'",
    "- If the rep handles things well: gradually warm up. Eventually agreeing to a free inspection is a realistic 'win' — but only after real rapport and trust have been earned. Don't fold easily.",
    "- If the conversation history is empty, produce the opening line in character for the scenario.",
    "- Never give the rep advice or hints. Don't explain what you'd want to hear. Stay in character.",
    "- Output only the homeowner's spoken line. No stage directions, no quotation marks, no narration.",
  ].join("\n");
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
  const repConfig = body.repConfig ?? {};

  const trailingSilences = countTrailingSilences(history);
  let isEndOfConversation = false;

  const baseSystem = buildSystemPrompt({
    persona,
    scenario,
    company:
      typeof repConfig.company === "string" ? repConfig.company.trim() : "",
    years: typeof repConfig.years === "string" ? repConfig.years.trim() : "",
    area: typeof repConfig.area === "string" ? repConfig.area.trim() : "",
  });

  let system = baseSystem;
  if (trailingSilences === 1) {
    system =
      baseSystem +
      "\n\nThe rep just stood there silently for 5+ seconds. React in character with light impatience — look at your watch, gesture toward inside, say something like 'You good?' or 'Do you need something?'. Make it feel like they're losing your attention. Keep it to 1 sentence.";
  } else if (trailingSilences >= 2) {
    system =
      baseSystem +
      "\n\nThe rep has now been silent twice in a row. They've lost you. Close the conversation in character — say something like 'Okay well I gotta get back inside, have a good one' or similar. Keep it natural and brief.";
    isEndOfConversation = true;
  }

  // Map our role names → Anthropic API role names.
  // The rep IS the user driving the conversation, so rep → "user".
  // The homeowner is the model's character, so homeowner → "assistant".
  // Replace silence sentinels with a description the model can read.
  const messages: Anthropic.MessageParam[] = history.map((turn) => ({
    role: turn.role === "rep" ? "user" : "assistant",
    content:
      turn.role === "rep" && turn.content === SILENCE_SENTINEL
        ? "[The rep stood there silently, saying nothing.]"
        : turn.content,
  }));

  // If history is empty (start of practice), we need the model to produce the
  // opening line. Anthropic requires the first message to be from "user", so
  // we seed a hidden user nudge.
  if (messages.length === 0) {
    messages.push({
      role: "user",
      content: "[The rep has just knocked on your door. Open the door and say your opening line in character.]",
    });
  } else if (messages[messages.length - 1].role === "assistant") {
    // Last turn was the homeowner — we need a rep turn before asking for the next homeowner line.
    // This shouldn't happen in normal use, but guard anyway.
    return Response.json(
      { error: "Awaiting rep input before homeowner can respond." },
      { status: 400 },
    );
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 400,
      system,
      messages,
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    return Response.json({ response: text, isEndOfConversation });
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
