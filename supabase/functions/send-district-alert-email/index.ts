// ─────────────────────────────────────────────────────────────────────────────
// HIBCW — send-district-alert-email  (Supabase Edge Function)
//
// Called by admin.html when a district alert is created or edited.
// Emails all approved members in the target district + all admins/superadmins.
//
// Environment variables required:
//   RESEND_API_KEY        — your Resend API key  (re_…)
//   SUPABASE_URL          — automatically available in Edge Functions
//   SUPABASE_SERVICE_ROLE_KEY — needed to query member_applications & admin_roles
//
// Deploy:
//   supabase functions deploy send-district-alert-email --no-verify-jwt
//   supabase secrets set RESEND_API_KEY=re_YOUR_KEY_HERE
//   supabase secrets set SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_FROM = "HIBCW Alerts <noreply@support.kiaahilo.org>";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const DISTRICT_LABELS: Record<string, string> = {
  "hamakua":      "District 1 — Hāmākua",
  "north-hilo":   "District 2 — North Hilo",
  "south-hilo":   "District 3 — South Hilo",
  "lower-puna":   "District 4 — Lower Puna",
  "upper-puna":   "District 5 — Upper Puna",
  "kau":          "District 6 — Kaʻū",
  "south-kona":   "District 7 — South Kona",
  "north-kona":   "District 8 — North Kona",
  "north-kohala": "District 9 — Kohala",
};

const ALERT_META: Record<string, { icon: string; label: string; color: string }> = {
  emergency: { icon: "⛔", label: "EMERGENCY",      color: "#ff2d2d" },
  bolo:      { icon: "👁", label: "BOLO",           color: "#f97316" },
  amber:     { icon: "🟡", label: "AMBER / MISSING",color: "#f5a623" },
  incident:  { icon: "🚨", label: "INCIDENT ALERT", color: "#e8415a" },
  pattern:   { icon: "🔁", label: "PATTERN ALERT",  color: "#c084fc" },
  scam:      { icon: "💳", label: "SCAM ALERT",     color: "#3b82f6" },
  trespass:  { icon: "🚫", label: "TRESPASS ALERT", color: "#a855f7" },
  welfare:   { icon: "🫶", label: "WELFARE CHECK",  color: "#7a8fa6" },
  allclear:  { icon: "✅", label: "ALL CLEAR",      color: "#00c9a7" },
  info:      { icon: "📋", label: "INFO / ADVISORY",color: "#4a6070" },
};

Deno.serve(async (req: Request): Promise<Response> => {

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  let body: {
    district: string;
    message: string;
    alert_type?: string;
    sent_by_name?: string;
    is_edited?: boolean;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { district, message, alert_type = "incident", sent_by_name, is_edited = false } = body;

  if (!district || !message) {
    return new Response(JSON.stringify({ error: "district and message are required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const resendKey     = Deno.env.get("RESEND_API_KEY");
  const supabaseUrl   = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!resendKey || !supabaseUrl || !serviceRoleKey) {
    console.error("Missing required environment variables");
    return new Response(JSON.stringify({ error: "Server configuration missing" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── Fetch district members & admins via Supabase JS client ─────────────
  // Using the JS client avoids PostgREST query string encoding pitfalls
  const sbAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: membersData, error: membersError } = await sbAdmin
    .from("member_applications")
    .select("email, full_name")
    .eq("status", "approved")
    .eq("district", district)
    .not("email", "is", null);

  if (membersError) {
    console.error("Failed to fetch members:", membersError.message);
    return new Response(JSON.stringify({ error: "Failed to fetch district members" }), {
      status: 502, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const members: { email: string; full_name: string | null }[] = membersData ?? [];

  const { data: adminsData, error: adminsError } = await sbAdmin
    .from("admin_roles")
    .select("email, full_name")
    .in("role", ["admin", "superadmin"])
    .not("email", "is", null);

  if (adminsError) {
    console.error("Failed to fetch admins:", adminsError.message);
    return new Response(JSON.stringify({ error: "Failed to fetch admins" }), {
      status: 502, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const admins: { email: string; full_name: string | null }[] = adminsData ?? [];

  // ── Deduplicate recipients (admins who are also district members) ─────────
  const seen = new Set<string>();
  const recipients: { email: string; full_name: string | null; isAdmin: boolean }[] = [];

  for (const m of members) {
    const key = m.email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      recipients.push({ ...m, isAdmin: false });
    }
  }
  for (const a of admins) {
    const key = a.email.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      recipients.push({ ...a, isAdmin: true });
    }
  }

  if (recipients.length === 0) {
    return new Response(JSON.stringify({ ok: true, sent: 0, message: "No recipients found" }), {
      status: 200, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── Build email content ───────────────────────────────────────────────────
  const districtLabel = DISTRICT_LABELS[district] ?? district;
  const meta          = ALERT_META[alert_type] ?? ALERT_META["incident"];
  const sentDate      = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  const sentTime      = new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  const year          = new Date().getFullYear();
  const subject       = is_edited
    ? `[UPDATED] ${meta.icon} ${meta.label} — ${districtLabel}`
    : `${meta.icon} ${meta.label} — ${districtLabel}`;

  // ── Send emails ───────────────────────────────────────────────────────────
  let sent = 0;
  const errors: string[] = [];

  // Use Resend batch sending — send individually so each recipient gets their name
  // For large districts, batch in groups of 10 to avoid rate limits
  const BATCH_SIZE = 10;
  for (let i = 0; i < recipients.length; i += BATCH_SIZE) {
    const batch = recipients.slice(i, i + BATCH_SIZE);

    await Promise.all(batch.map(async (r) => {
      const recipientName = r.full_name || "HIBCW Member";
      const htmlBody = buildHtml({
        recipientName,
        districtLabel,
        message,
        meta,
        sentDate,
        sentTime,
        sentByName: sent_by_name,
        isEdited: is_edited,
        isAdmin: r.isAdmin,
        year,
      });
      const textBody = buildText({
        recipientName,
        districtLabel,
        message,
        meta,
        sentDate,
        sentTime,
        sentByName: sent_by_name,
        isEdited: is_edited,
      });

      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type":  "application/json",
          "Authorization": `Bearer ${resendKey}`,
        },
        body: JSON.stringify({
          from:    RESEND_FROM,
          to:      [r.email],
          subject,
          html:    htmlBody,
          text:    textBody,
        }),
      });

      if (resendRes.ok) {
        sent++;
      } else {
        const err = await resendRes.json().catch(() => ({}));
        console.error(`Failed to send to ${r.email}:`, err);
        errors.push(r.email);
      }
    }));
  }

  return new Response(JSON.stringify({ ok: true, sent, failed: errors.length, errors }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
});

// ── HTML email builder ────────────────────────────────────────────────────────
function buildHtml(p: {
  recipientName: string;
  districtLabel: string;
  message: string;
  meta: { icon: string; label: string; color: string };
  sentDate: string;
  sentTime: string;
  sentByName?: string;
  isEdited: boolean;
  isAdmin: boolean;
  year: number;
}): string {
  const { recipientName, districtLabel, message, meta, sentDate, sentTime, sentByName, isEdited, isAdmin, year } = p;
  const borderColor  = meta.color;
  const headerBorder = `rgba(${hexToRgb(borderColor)}, 0.25)`;
  const badgeBg      = `rgba(${hexToRgb(borderColor)}, 0.12)`;
  const badgeBorder  = `rgba(${hexToRgb(borderColor)}, 0.4)`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>HIBCW — ${escHtml(meta.label)}</title>
</head>
<body style="margin:0;padding:0;background:#0b1524;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b1524;padding:32px 0;">
    <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;border:1px solid ${headerBorder};">

      <!-- HEADER -->
      <tr>
        <td style="background:linear-gradient(135deg,#0b1524 0%,#111e30 100%);padding:28px 32px 20px;text-align:center;border-bottom:1px solid ${headerBorder};">
          <div style="width:56px;height:56px;margin:0 auto 12px;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1016.87 972.01" width="56" height="56">
              <path fill="${meta.color}" d="M99.5,416.99l5.75,16.97,21.86,52.91,24.73,51.19,27.9,49.18,30.48,47.74,33.36,45.44,35.95,43.71,38.54,41.41,41.12,39.4,43.13,37.1,45.44,34.8c19.85,14.09,39.69,27.6,60.39,40.55,12.94-8.05,25.31-16.39,37.96-24.73,7.48-5.18,14.95-10.35,22.43-15.82l45.72-34.8,43.43-37.1,40.83-39.4,38.54-41.41,35.95-43.71,33.36-45.44,30.48-47.74,27.9-49.18,24.73-51.19,21.86-52.91,6.04-17.25c-113.31-63.84-241.56-98.35-371.26-103.82-154.71-6.61-311.73,28.18-446.6,104.1Z"/>
              <path fill="${meta.color}" d="M978.91,141.2l-27.9-18.41-28.75-16.97-29.62-15.53-29.91-14.38-30.48-13.23-30.77-12.08-31.63-10.64-31.63-9.49-32.21-8.05-32.5-6.9-32.49-5.75-33.07-4.31-32.79-3.16-33.36-1.73-33.07-.58h-.58l-32.5.58-32.78,1.73-33.07,3.16-33.07,4.31-32.5,5.75-32.5,6.9-32.21,8.05-31.92,9.49-31.63,10.64-30.77,12.08-30.77,13.23-29.91,14.38-29.62,15.53-28.76,16.97-28.18,18.41L0,168.23l4.31,44.29,4.03,31.06,5.18,30.77,5.75,30.19,6.9,30.2,7.77,29.33,8.34,29.33,19.55,56.94,23.01,55.5,25.88,53.78,29.33,51.76,31.92,49.75,35.09,47.74,37.67,45.72,40.26,43.43,42.85,41.41,45.44,38.82,47.45,36.23,49.75,33.94,37.67,23.58,37.67-23.58,25.31-16.68,48.89-35.09,46.3-37.67,44.29-39.97,41.69-42.27,38.83-44.57,36.52-46.88,33.36-48.89,30.77-50.61,27.61-52.91,24.44-54.35,20.99-56.36,18.12-58.09,7.48-29.33,6.9-30.2,5.75-30.19,5.18-30.77,4.02-31.06,4.61-44.29-37.96-27.03ZM508.14,944.68C236.67,781.06,52.63,508.15,24.44,179.16,164.21,75.35,336.46,23.29,508.14,23.01c172.55,0,344.8,52.05,484.28,156.15-28.47,328.98-212.52,601.9-484.28,765.52Z"/>
            </svg>
          </div>
          <p style="margin:0 0 6px;color:${meta.color};font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:700;">
            Hawaiʻi Island Business Crime Watch
          </p>
          <!-- ALERT TYPE BADGE -->
          <div style="display:inline-block;margin:4px 0 8px;background:${badgeBg};border:1px solid ${badgeBorder};border-radius:4px;padding:4px 14px;">
            <span style="font-family:'Courier New',monospace;font-size:11px;font-weight:700;letter-spacing:.1em;text-transform:uppercase;color:${meta.color};">
              ${meta.icon} ${escHtml(meta.label)}
            </span>
          </div>
          ${isEdited ? `<div style="margin-top:4px;"><span style="font-family:'Courier New',monospace;font-size:9px;letter-spacing:.08em;text-transform:uppercase;color:#7a8fa6;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:3px;padding:2px 8px;">✏️ UPDATED</span></div>` : ""}
          <p style="margin:8px 0 0;color:#eef3f8;font-size:15px;font-weight:700;">
            ${escHtml(districtLabel)}
          </p>
        </td>
      </tr>

      <!-- GREETING -->
      <tr>
        <td style="background:#111e30;padding:24px 32px 0;">
          <p style="margin:0 0 16px;color:#eef3f8;font-size:14px;line-height:1.6;">
            Dear ${escHtml(recipientName)},
          </p>
          <p style="margin:0 0 20px;color:#7a8fa6;font-size:13px;line-height:1.6;">
            ${isAdmin
              ? `The following alert has been issued for <span style="color:#eef3f8;font-weight:600;">${escHtml(districtLabel)}</span>. You are receiving this as an admin.`
              : `A new alert has been issued for your district — <span style="color:#eef3f8;font-weight:600;">${escHtml(districtLabel)}</span>.`
            }
          </p>
        </td>
      </tr>

      <!-- ALERT MESSAGE BOX -->
      <tr>
        <td style="background:#111e30;padding:0 32px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#18293f;border:1px solid ${headerBorder};border-left:3px solid ${meta.color};border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:18px 20px;">
                <p style="margin:0;color:#eef3f8;font-size:14px;line-height:1.75;white-space:pre-wrap;">${escHtml(message)}</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- ALERT META -->
      <tr>
        <td style="background:#111e30;padding:0 32px 24px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#18293f;border:1px solid rgba(255,255,255,.07);border-radius:8px;">
            <tr>
              <td style="padding:14px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#7a8fa6;font-size:11px;padding:4px 0;width:38%;font-family:'Courier New',monospace;letter-spacing:.04em;">DISTRICT</td>
                    <td style="color:#eef3f8;font-size:12px;padding:4px 0;font-weight:600;">${escHtml(districtLabel)}</td>
                  </tr>
                  <tr>
                    <td style="color:#7a8fa6;font-size:11px;padding:4px 0;font-family:'Courier New',monospace;letter-spacing:.04em;">ALERT TYPE</td>
                    <td style="color:${meta.color};font-size:12px;padding:4px 0;font-weight:700;font-family:'Courier New',monospace;">${meta.icon} ${escHtml(meta.label)}</td>
                  </tr>
                  ${sentByName ? `<tr>
                    <td style="color:#7a8fa6;font-size:11px;padding:4px 0;font-family:'Courier New',monospace;letter-spacing:.04em;">ISSUED BY</td>
                    <td style="color:#eef3f8;font-size:12px;padding:4px 0;">${escHtml(sentByName)}</td>
                  </tr>` : ""}
                  <tr>
                    <td style="color:#7a8fa6;font-size:11px;padding:4px 0;font-family:'Courier New',monospace;letter-spacing:.04em;">${isEdited ? "UPDATED" : "ISSUED"}</td>
                    <td style="color:#eef3f8;font-size:12px;padding:4px 0;">${sentDate} · ${sentTime}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CTA -->
      <tr>
        <td style="background:#111e30;padding:0 32px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="background:rgba(0,201,167,.08);border:1px solid rgba(0,201,167,.25);border-radius:6px;padding:11px 16px;text-align:center;">
                <a href="https://hibcw.kiaahilo.org"
                   style="color:#00c9a7;font-size:12px;font-weight:700;text-decoration:none;letter-spacing:.08em;text-transform:uppercase;font-family:'Courier New',monospace;">
                  View Map &amp; Report an Incident
                </a>
                <p style="margin:4px 0 0;color:#7a8fa6;font-size:11px;">hibcw.kiaahilo.org</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CLOSING -->
      <tr>
        <td style="background:#111e30;padding:0 32px 28px;">
          <p style="margin:0;color:#7a8fa6;font-size:13px;line-height:1.7;">
            Stay alert and stay safe.<br>
            <span style="color:#eef3f8;font-weight:600;">HIBCW District Operations</span><br>
            <span style="color:#00c9a7;font-size:12px;">Hawaiʻi Island Business Crime Watch</span>
          </p>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#0b1524;border-top:1px solid rgba(0,201,167,.1);padding:18px 32px;text-align:center;">
          <p style="margin:0;color:#4a6070;font-size:11px;line-height:1.7;">
            You are receiving this because you are a verified HIBCW member in ${escHtml(districtLabel)}.<br>
            &copy; ${year} Hawaiʻi Island Business Crime Watch &middot; A Program of KIAA &middot; kiaahilo.org
          </p>
        </td>
      </tr>

    </table>
    </td></tr>
  </table>
</body>
</html>`;
}

// ── Plain-text email builder ──────────────────────────────────────────────────
function buildText(p: {
  recipientName: string;
  districtLabel: string;
  message: string;
  meta: { icon: string; label: string; color: string };
  sentDate: string;
  sentTime: string;
  sentByName?: string;
  isEdited: boolean;
}): string {
  const { recipientName, districtLabel, message, meta, sentDate, sentTime, sentByName, isEdited } = p;
  return `Dear ${recipientName},

${isEdited ? "[UPDATED] " : ""}${meta.icon} ${meta.label} — ${districtLabel}

─────────────────────────────────────
${message}
─────────────────────────────────────

District   : ${districtLabel}
Alert Type : ${meta.label}${sentByName ? `\nIssued By  : ${sentByName}` : ""}
${isEdited ? "Updated" : "Issued"}    : ${sentDate} · ${sentTime}

View the map and report incidents at:
https://hibcw.kiaahilo.org

Stay alert and stay safe.
HIBCW District Operations
Hawaiʻi Island Business Crime Watch`;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function hexToRgb(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return "0,201,167";
  return `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`;
}
