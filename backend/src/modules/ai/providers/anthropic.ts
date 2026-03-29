export async function generateWithAnthropic(apiKey: string, model: string, system: string, prompt: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 600,
        system,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const status = response.status;
      throw new Error(`Anthropic request failed with status ${status}`);
    }

    const data = await response.json() as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((item) => item.type === 'text')?.text?.trim();
    if (!text) throw new Error('Anthropic returned empty content');
    return text;
  } finally {
    clearTimeout(timeout);
  }
}
