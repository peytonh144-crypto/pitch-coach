import OpenAI from "openai";

let _openai: OpenAI | null = null;
function openai(): OpenAI {
  if (!_openai) _openai = new OpenAI();
  return _openai;
}

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json(
      { error: "Expected multipart/form-data with an 'audio' field." },
      { status: 400 },
    );
  }

  const audio = formData.get("audio");
  if (!(audio instanceof Blob)) {
    return Response.json(
      { error: "Missing 'audio' file in form data." },
      { status: 400 },
    );
  }

  // OpenAI's Node SDK accepts a File. The browser sends a Blob; on the server
  // we wrap it in a File so the SDK gets a usable filename + mime type.
  const fileName =
    audio instanceof File && audio.name ? audio.name : "audio.webm";
  const file = new File([audio], fileName, {
    type: audio.type || "audio/webm",
  });

  try {
    const transcription = await openai().audio.transcriptions.create({
      file,
      model: "whisper-1",
    });
    return Response.json({ text: transcription.text });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
