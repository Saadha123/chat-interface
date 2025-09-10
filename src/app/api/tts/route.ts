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

    if (!response.ok) {
      return new Response(JSON.stringify({ error: "TTS API error" }), { status: 500 });
    }

    // Convert PCM Float32LE to PCM Int16LE for WAV
    const float32Buffer = Buffer.from(await response.arrayBuffer());
    const sampleRate = 24000;
    const numSamples = float32Buffer.length / 4;
    const int16Buffer = Buffer.alloc(numSamples * 2);
    
    for (let i = 0; i < numSamples; i++) {
      // Read float32, clamp, convert to int16
      const f = float32Buffer.readFloatLE(i * 4);
      let s = Math.max(-1, Math.min(1, f));
      s = s < 0 ? s * 32768 : s * 32767;
      int16Buffer.writeInt16LE(Math.round(s), i * 2);
    }

    // WAV header creation function
    function createWavHeader(dataLength: number, sampleRate: number, numChannels: number = 1): Buffer {
      const header = Buffer.alloc(44);
      header.write('RIFF', 0); // ChunkID
      header.writeUInt32LE(36 + dataLength, 4); // ChunkSize
      header.write('WAVE', 8); // Format
      header.write('fmt ', 12); // Subchunk1ID
      header.writeUInt32LE(16, 16); // Subchunk1Size (PCM)
      header.writeUInt16LE(1, 20); // AudioFormat (PCM)
      header.writeUInt16LE(numChannels, 22); // NumChannels
      header.writeUInt32LE(sampleRate, 24); // SampleRate
      header.writeUInt32LE(sampleRate * numChannels * 2, 28); // ByteRate
      header.writeUInt16LE(numChannels * 2, 32); // BlockAlign
      header.writeUInt16LE(16, 34); // BitsPerSample
      header.write('data', 36); // Subchunk2ID
      header.writeUInt32LE(dataLength, 40); // Subchunk2Size
      return header;
    }

    const wavHeader = createWavHeader(int16Buffer.length, sampleRate);
    const wavBuffer = Buffer.concat([wavHeader, int16Buffer]);

    return new Response(wavBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Content-Length': wavBuffer.length.toString(),
      },
    });
  } catch (error) {
    console.error('TTS error:', error);
    return new Response(JSON.stringify({ error: "TTS error" }), { status: 500 });
  }
}
