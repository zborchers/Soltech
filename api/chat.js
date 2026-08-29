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

      // Read as text first -- a Vercel timeout/error page comes back as
      // HTML/plain text, not JSON, and calling response.json() directly
      // on that throws an unhelpful SyntaxError instead of the real problem.
      const rawText = await response.text();
      let data;
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        console.error(`Non-JSON response from Anthropic API (status ${response.status}):`, rawText.slice(0, 500));
        return res.status(502).json({
          error: `Upstream returned a non-JSON response (status ${response.status}). This usually means the function timed out or crashed before Anthropic replied.`,
          type: 'upstream_non_json',
          status: response.status,
        });
      }

      if (!response.ok) {
        console.error(`Anthropic API error (status ${response.status}):`, JSON.stringify(data));
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
