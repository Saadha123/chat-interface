import { NextRequest } from "next/server";
import axios from "axios";

export async function POST(req: NextRequest) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: "Missing GROQ_API_KEY" }), { status: 500 });
  }

  const contentType = req.headers.get("content-type") || "";
  if (!contentType.includes("multipart/form-data")) {
    return new Response(JSON.stringify({ error: "Invalid content type" }), { status: 400 });
  }

  const formData = await req.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof Blob)) {
    return new Response(JSON.stringify({ error: "Missing audio file" }), { status: 400 });
  }

  // Convert Blob to Buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  // Prepare form data for axios
  const FormData = require('form-data');
  const axiosFormData = new FormData();
  axiosFormData.append('file', buffer, {
    filename: 'audio.wav',
    contentType: 'audio/wav',
  });
  axiosFormData.append('model', 'whisper-large-v3');
  axiosFormData.append('response_format', 'text');

  try {
    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      axiosFormData,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          ...axiosFormData.getHeaders(),
        },
        responseType: 'text',
      }
    );
    return new Response(JSON.stringify({ transcript: response.data }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Transcription failed', details: err?.message || err }), { status: 500 });
  }
}
