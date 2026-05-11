import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

function buildSystemPrompt(opts: {
  company: string;
  years: string;
  area: string;
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

  return [
    "You are a sales coach for a door-to-door storm restoration roofing rep. The user will give you a homeowner objection they heard at the door.",
    "Respond in 60 to 100 words with three sections: (a) a one-line read on what the homeowner actually means, (b) a tight, conversational response the rep can use, (c) the next move (what to ask, where to lead the conversation).",
    "Be specific to insurance roofing — talk about hail damage, free inspections, working with their carrier, etc. Don't be salesy or pushy.",
    "Rep context:",
    `- ${companyRef}`,
    `- ${yearsRef}`,
    `- ${areaRef}`,
    "Never output bracketed placeholders like [company] or [X years] or [area]. If a value is missing, fall back to natural generic language.",
  ].join("\n");
}

export async function POST(request: Request) {
  const body = (await request.json()) as {
    objection?: string;
    company?: string;
    years?: string;
    area?: string;
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
