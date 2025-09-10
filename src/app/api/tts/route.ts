import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing CARTESIA_API_KEY" }), { status: 500 });
  }

  const { text } = await req.json();
  if (!text) {
    return new Response(JSON.stringify({ error: "Missing text" }), { status: 400 });
  }

  try {
    const response = await fetch("https://api.cartesia.ai/tts/bytes", {
      method: "POST",
      headers: {
        "Cartesia-Version": "2024-06-30",
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({
        model_id: "sonic-english",
        transcript: text,
        voice: {
          mode: "id",
          id: "b7d50908-b17c-442d-ad8d-810c63997ed9",
        },
        output_format: {
          container: "raw",
          encoding: "pcm_f32le",
          sample_rate: 24000,
        },
      }),
    });
    // ...existing code for handling response and returning audio...
    return new Response(await response.arrayBuffer(), { status: 200 });
  } catch (error) {
    return new Response(JSON.stringify({ error: "TTS error" }), { status: 500 });
  }
}
