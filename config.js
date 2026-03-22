// ─────────────────────────────────────────────────────────────
// HIBCW Configuration
// Replace both values  below with your Supabase project credentials.
// Supabase Dashboard → Your Project → Settings → API
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL      = "https://pyiwxjdzztqdnaljkwsc.supabase.co";       // e.g. https://abcdefgh.supabase.co
const SUPABASE_ANON_KEY = "sb_publishable_jCfqmvs2XV0hgF0CNnlqfw_UEkQhStD";  // starts with eyJ...

// ─────────────────────────────────────────────────────────────
// Email — approval emails are sent via the Supabase Edge Function
// "send-approval-email".  No key needed here; it lives as a
// Supabase secret (RESEND_API_KEY) set with the CLI:
//   supabase secrets set RESEND_API_KEY=re_…
// ─────────────────────────────────────────────────────────────
