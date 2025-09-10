import type { NextApiRequest, NextApiResponse } from 'next';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.CARTESIA_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Missing CARTESIA_API_KEY' });
  }

  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ error: 'Missing text' });
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
      return res.status(500).json({ error: 'TTS API error' });
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

        // WAV header
        function createWavHeader(dataLength: number, sampleRate: number, numChannels: number = 1): Buffer {
          const header = Buffer.alloc(44);
          header.write('RIFF', 0);
          header.writeUInt32LE(36 + dataLength, 4);
          header.write('WAVE', 8);
          header.write('fmt ', 12);
          header.writeUInt32LE(16, 16); // PCM header size
          header.writeUInt16LE(1, 20); // PCM format
          header.writeUInt16LE(numChannels, 22);
          header.writeUInt32LE(sampleRate, 24);
          header.writeUInt32LE(sampleRate * numChannels * 2, 28); // byte rate
          header.writeUInt16LE(numChannels * 2, 32); // block align
          header.writeUInt16LE(16, 34); // bits per sample
          header.write('data', 36);
          header.writeUInt32LE(dataLength, 40);
          return header;
        }

        const wavHeader = createWavHeader(int16Buffer.length, sampleRate);
        const wavBuffer = Buffer.concat([wavHeader, int16Buffer]);
        res.setHeader('Content-Type', 'audio/wav');
        res.setHeader('Content-Length', wavBuffer.length);
        res.status(200).send(wavBuffer);
  } catch (error) {
    return res.status(500).json({ error: 'TTS error' });
  }
}
