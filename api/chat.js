export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const maxRetries = 4;
  let lastError = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(req.body),
      });

      // Retry on overloaded (529) and rate-limited (429) responses.
      if ((response.status === 529 || response.status === 429) && attempt < maxRetries) {
        const retryAfterHeader = response.headers.get('retry-after');
        const retryAfterMs = retryAfterHeader
          ? parseFloat(retryAfterHeader) * 1000
          : attempt * 1500;
        console.warn(`Anthropic API returned ${response.status}, retrying in ${retryAfterMs}ms (attempt ${attempt}/${maxRetries})`);
        await new Promise(r => setTimeout(r, retryAfterMs));
        continue;
      }

      const data = await response.json();

      if (!response.ok) {
        // Log the real reason server-side so it shows up in Vercel function logs.
        console.error(`Anthropic API error (status ${response.status}):`, JSON.stringify(data));
        // Pass the real error through to the client instead of masking it.
        return res.status(response.status).json({
          error: data.error?.message || `Anthropic API returned status ${response.status}`,
          type: data.error?.type || 'api_error',
        });
      }

      return res.status(200).json(data);
    } catch (err) {
      lastError = err;
      console.error(`Fetch attempt ${attempt}/${maxRetries} failed:`, err.message);
      if (attempt < maxRetries) {
        await new Promise(r => setTimeout(r, attempt * 1000));
      }
    }
  }

  console.error('All retry attempts exhausted. Last error:', lastError);
  return res.status(500).json({
    error: lastError?.message || 'Failed after retries',
    type: 'network_error',
  });
}
