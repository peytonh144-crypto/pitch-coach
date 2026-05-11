import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const PERSONAS: Record<string, string> = {
  skeptical_bob:
    "Homeowner is cynical and has been burned by a contractor before. He asks tough questions, demands proof, slow to trust. Strategy: lead with proof and credentials. Slow the pace. Acknowledge his skepticism directly. No urgency tactics.",
  busy_mom_sarah:
    "Homeowner is friendly but distracted — kids in the background, dinner cooking. Strategy: be brief. Cut small talk. Make the inspection ask fast and frictionless. Offer to come back at a better time if needed. CRITICAL: Sarah responses must be 50 words or less. Be ruthlessly brief — cut every unnecessary word, no fluff, no 'totally understand' preambles. Get to the inspection ask in 2 sentences max.",
  shopping_steve:
    "Homeowner is comparison-shopping for 3 quotes. Focused on price. Strategy: educate that insurance claims pay the same to any legit contractor — the difference is who fights for the full claim. Differentiate on outcomes (claim recovery, supplement capture), not price. Don't trash competitors.",
  retired_vet_ron:
    "Older homeowner, possibly retired, distrustful of door-knockers. Warms up when treated with respect and given specifics. Strategy: be respectful and formal at first ('sir' is appropriate). Lead with technical info about damage and the claims process. Never talk down. Offer to leave information without pressure.",
  diy_dave:
    "Homeowner thinks he can fix it himself or has a 'guy' who'll do it cheap. Has opinions on every product. Strategy: don't argue with his expertise. Pivot to insurance specifically — point out the difference between a cash repair and a full insurance claim, code upgrade compliance, manufacturer warranty requirements a DIY job won't satisfy.",
  renter_riley:
    "Homeowner just moved in or doesn't fully own the decision — defers to a spouse, parents, or landlord. Strategy: help them be the hero who brings useful info to the decision-maker. Push to inspect, not to close. Offer to document everything so they can show the actual decision-maker exactly what's going on.",
  already_in_progress_pam:
    "Homeowner has already filed a claim or has a contractor lined up — you're the third or fourth person at the door. Strategy: don't trash the existing contractor. Ask what's been done so far (adjuster visit? supplement filed? work started?). Position yourself as a second opinion. Often the existing contractor missed damage or underpaid the claim — that's the opening.",
};

function buildSystemPrompt(opts: {
  company: string;
  years: string;
  area: string;
  persona: string;
}) {
  const companyRef = opts.company
    ? `the rep's company is "${opts.company}" — refer to it by name (or as "we"/"our team" naturally) instead of generic phrasing`
    : `the rep has not provided a company name — use "we" or "our team" instead of any placeholder or bracketed text`;

  const yearsRef = opts.years
    ? `the rep's company has ${opts.years} years in business — weave this in naturally when credibility comes up`
    : `the rep has not provided years in business — do not invent a number and do not use placeholders like "[X years]"; just speak about experience generically if needed`;

  const areaRef = opts.area
    ? `the rep works in ${opts.area} — reference it by name when location matters (recent storms, local crews, etc.)`
    : `the rep has not provided a service area — use "your area" instead of any placeholder or bracketed text`;

  const lines = [
    "You are a sales coach for a door-to-door storm restoration roofing rep. The user will give you a homeowner objection they heard at the door.",
    "Respond in 60 to 100 words with three sections: (a) a one-line read on what the homeowner actually means, (b) a tight, conversational response the rep can use, (c) the next move (what to ask, where to lead the conversation).",
    "If the persona below specifies its own length constraint, that constraint overrides the 60–100 word target.",
    "Be specific to insurance roofing — talk about hail damage, free inspections, working with their carrier, etc. Don't be salesy or pushy.",
    "Rep context:",
    `- ${companyRef}`,
    `- ${yearsRef}`,
    `- ${areaRef}`,
    "Never output bracketed placeholders like [company] or [X years] or [area]. If a value is missing, fall back to natural generic language.",
  ];

  const personaStrategy = PERSONAS[opts.persona];
  if (personaStrategy) {
    lines.push(
      `The homeowner you're advising on appears to be this type: ${personaStrategy}. Tailor your suggested response and next move to fit this persona.`,
    );
  }

  return lines.join("\n");
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    objection?: string;
    company?: string;
    years?: string;
    area?: string;
    persona?: string;
  };

  const objection = body.objection;
  if (!objection || typeof objection !== "string" || !objection.trim()) {
    return Response.json(
      { error: "Missing 'objection' string in request body." },
      { status: 400 },
    );
  }

  const system = buildSystemPrompt({
    company: typeof body.company === "string" ? body.company.trim() : "",
    years: typeof body.years === "string" ? body.years.trim() : "",
    area: typeof body.area === "string" ? body.area.trim() : "",
    persona: typeof body.persona === "string" ? body.persona : "",
  });

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      system,
      messages: [{ role: "user", content: objection }],
    });

    const text = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n");

    return Response.json({ response: text });
  } catch (error) {
    if (error instanceof Anthropic.APIError) {
      return Response.json(
        { error: error.message },
        { status: error.status ?? 500 },
      );
    }
    const message = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: message }, { status: 500 });
  }
}
