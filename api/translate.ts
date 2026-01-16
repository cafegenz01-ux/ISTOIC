
export const config = {
  runtime: 'edge',
};

export async function POST(request: Request) {
  try {
    const { text, target_lang } = await request.json();
    const apiKey = process.env.DEEPL_API_KEY || process.env.VITE_DEEPL_API_KEY;

    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Server configuration error: Missing DeepL API Key" }), { status: 500 });
    }

    if (!text || !target_lang) {
      return new Response(JSON.stringify({ error: "Missing text or target_lang" }), { status: 400 });
    }

    // Determine Endpoint (Free vs Pro)
    // DeepL Free keys always end in ":fx"
    const isFreeTier = apiKey.endsWith(':fx');
    const endpoint = isFreeTier 
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: [text],
        target_lang: target_lang.toUpperCase(),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `DeepL Error: ${errorText}` }), { status: response.status });
    }

    const data = await response.json();
    
    // DeepL returns { translations: [{ detected_source_language: "EN", text: "..." }] }
    const translatedText = data.translations?.[0]?.text;

    if (!translatedText) {
        throw new Error("Invalid response format from DeepL");
    }

    return new Response(JSON.stringify({ text: translatedText }), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
