
export const config = {
  runtime: 'edge',
};

export async function POST(request: Request) {
  try {
    const { prompt, modelId } = await request.json();
    const token = process.env.HF_TOKEN;

    if (!token) {
      return new Response(JSON.stringify({ error: "Server configuration error: Missing HF Token" }), { status: 500 });
    }

    const response = await fetch(`https://api-inference.huggingface.co/models/${modelId}`, {
      headers: { 
          Authorization: `Bearer ${token}`, 
          "Content-Type": "application/json" 
      },
      method: "POST",
      body: JSON.stringify({ inputs: prompt }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(JSON.stringify({ error: `Provider Error: ${errorText}` }), { status: response.status });
    }

    // Return the image blob directly
    return new Response(response.body, {
      headers: { 'Content-Type': 'image/jpeg' }
    });

  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
}
