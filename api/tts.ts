
export const config = {
  runtime: 'edge',
};

export async function POST(request: Request) {
  try {
    const { text, voiceId } = await request.json();
    const apiKey = process.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server configuration error: Missing TTS Key" }), { status: 500 });
    }

    // Default to 'Hanisah' voice ID if not provided
    const targetVoice = voiceId || 'JBFqnCBsd6RMkjVDRZzb';

    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${targetVoice}/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': apiKey
      },
      body: JSON.stringify({
        text: text,
        model_id: "eleven_multilingual_v2",
        voice_settings: { stability: 0.5, similarity_boost: 0.75 }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `Provider Error: ${errorText}` }), { status: response.status });
    }

    // Return the audio stream directly
    return new Response(response.body, {
      headers: { 'Content-Type': 'audio/mpeg' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
