/**
 * api/extract.js — Vercel serverless function
 * Proxies requests to the Anthropic API server-side.
 * Keeps the API key out of the browser and resolves CORS issues.
 *
 * POST /api/extract
 * Body: { messages: [...], max_tokens?: number }
 * Returns: Anthropic API response
 */

export default async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' })
  }

  try {
    const { messages, max_tokens = 1000, system } = req.body

    const body = {
      model:      'claude-sonnet-5',
      max_tokens,
      messages,
    }
    if (system) body.system = system

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    if (!response.ok) {
      return res.status(response.status).json({ error: data?.error?.message || 'Anthropic API error' })
    }

    return res.status(200).json(data)
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Internal server error' })
  }
}
