// ─────────────────────────────────────────────────────────────
// HIBCW Configuration
// Replace both values  below with your Supabase project credentials.
// Supabase Dashboard → Your Project → Settings → API
// ─────────────────────────────────────────────────────────────
const SUPABASE_URL      = "https://pyiwxjdzztqdnaljkwsc.supabase.co";       // e.g. https://abcdefgh.supabase.co
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB5aXd4amR6enRxZG5hbGprd3NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMxNjA4NzUsImV4cCI6MjA4ODczNjg3NX0.-4PiNOu9iIGkUed4SSWGOmaL8sPNnr2IVzRYygKmo6U";  // starts with eyJ...

// ─────────────────────────────────────────────────────────────
// Email — approval emails are sent via the Supabase Edge Function
// "send-approval-email".  No key needed here; it lives as a
// Supabase secret (RESEND_API_KEY) set with the CLI:
//   supabase secrets set RESEND_API_KEY=re_…
// ─────────────────────────────────────────────────────────────
