/**
 * api/get-ip.js — returns the caller's IP address
 * GET /api/get-ip
 */
export default function handler(req, res) {
  const ip =
    req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'Unknown'
  res.status(200).json({ ip })
}
