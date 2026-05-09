import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

const SYSTEM_PROMPT =
  "You are a sales coach for a door-to-door storm restoration roofing rep. The user will give you a homeowner objection they heard at the door. Respond in 60 words or less with: (a) a one-line read on what the homeowner actually means, (b) a tight, conversational response the rep can use, (c) the next move (what to ask, where to lead the conversation). Be specific to insurance roofing — talk about hail damage, free inspections, working with their carrier, etc. Don't be salesy or pushy.";

export async function POST(request: Request) {
  const { objection } = (await request.json()) as { objection?: string };

  if (!objection || typeof objection !== "string" || !objection.trim()) {
    return Response.json(
      { error: "Missing 'objection' string in request body." },
      { status: 400 },
    );
  }

  try {
    const message = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
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
