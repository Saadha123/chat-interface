import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (!openaiApiKey) {
    return new Response(JSON.stringify({ error: "Missing OPENAI_API_KEY" }), { status: 500 });
  }

  const { message } = await req.json();
  if (!message) {
    return new Response(JSON.stringify({ error: "Missing message" }), { status: 400 });
  }

  // Call OpenAI Chat API
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: message },
        ],
      }),
    });
    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "No response.";
    return new Response(JSON.stringify({ reply }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: "AI response failed", details: String(err) }), { status: 500 });
  }
}
