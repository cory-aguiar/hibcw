// ─────────────────────────────────────────────────────────────────────────────
// HIBCW — send-approval-email  (Supabase Edge Function)
//
// Called by admin.html when a business registration is approved.
// Keeps the Resend API key server-side so it is never exposed to the browser.
//
// Environment variables required (set via Supabase Dashboard or CLI):
//   RESEND_API_KEY   — your Resend API key  (re_…)
//
// Deploy:
//   supabase functions deploy send-approval-email --no-verify-jwt
//   supabase secrets set RESEND_API_KEY=re_YOUR_KEY_HERE
// ─────────────────────────────────────────────────────────────────────────────

const RESEND_FROM = "HIBCW <noreply@hibcw.kiaahilo.org>";

// ── CORS headers ─────────────────────────────────────────────────────────────
// admin.html is served from a different origin than *.supabase.co, so we must
// return CORS headers on every response, including the pre-flight OPTIONS.
const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

Deno.serve(async (req: Request): Promise<Response> => {

  // Handle CORS pre-flight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── Parse request body ──────────────────────────────────────────────────
  let body: {
    email: string;
    contact_name?: string;
    business_name?: string;
    business_address?: string;
    business_city?: string;
    business_state?: string;
    business_zip?: string;
    business_number?: string;
    district?: string;
  };

  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const { email, contact_name, business_name, business_number,
          business_address, business_city, business_state, business_zip } = body;

  if (!email) {
    return new Response(JSON.stringify({ error: "email is required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  // ── Build email content ─────────────────────────────────────────────────
  const contactName  = contact_name  || business_name || "Business Owner";
  const bizName      = business_name || "Your Business";
  const bizId        = business_number || "Pending assignment";
  const addressParts = [business_address, business_city, business_state, business_zip].filter(Boolean);
  const addressLine  = addressParts.join(", ");
  const approvedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const year = new Date().getFullYear();

  const addressRow = addressLine
    ? `<tr>
         <td style="color:#6b7280;font-size:13px;padding:4px 0;width:40%;">Address</td>
         <td style="color:#111827;font-size:13px;padding:4px 0;">${escHtml(addressLine)}</td>
       </tr>`
    : "";

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0"
             style="max-width:600px;background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,.08);">

        <!-- Header -->
        <tr>
          <td style="background:#0d1b2a;padding:28px 32px;text-align:center;">
            <p style="margin:0;color:#00c9a7;font-size:11px;letter-spacing:3px;text-transform:uppercase;font-weight:700;">
              Hawaiʻi Island Business Crime Watch
            </p>
            <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;">
              Registration Approved ✅
            </h1>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 16px;color:#374151;font-size:16px;">Dear ${escHtml(contactName)},</p>
            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
              We are pleased to inform you that <strong>${escHtml(bizName)}</strong> has been officially
              approved and registered with the Hawaiʻi Island Business Crime Watch (HIBCW) network.
            </p>

            <!-- Approval details box -->
            <table width="100%" cellpadding="0" cellspacing="0"
                   style="background:#f0fdf9;border:1px solid #a7f3d0;border-radius:6px;margin:24px 0;">
              <tr>
                <td style="padding:20px 24px;">
                  <p style="margin:0 0 6px;color:#065f46;font-size:11px;letter-spacing:2px;
                            text-transform:uppercase;font-weight:700;">Business Registration Details</p>
                  <table cellpadding="0" cellspacing="0" style="width:100%;margin-top:12px;">
                    <tr>
                      <td style="color:#6b7280;font-size:13px;padding:4px 0;width:40%;">Business Name</td>
                      <td style="color:#111827;font-size:13px;padding:4px 0;font-weight:600;">${escHtml(bizName)}</td>
                    </tr>
                    ${addressRow}
                    <tr>
                      <td style="color:#6b7280;font-size:13px;padding:4px 0;">Business ID</td>
                      <td style="color:#111827;font-size:13px;padding:4px 0;font-weight:600;">${escHtml(bizId)}</td>
                    </tr>
                    <tr>
                      <td style="color:#6b7280;font-size:13px;padding:4px 0;">Approved On</td>
                      <td style="color:#111827;font-size:13px;padding:4px 0;">${approvedDate}</td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
              As a registered HIBCW member, you will now receive timely crime alerts and safety notices
              for your district. Your district captain will be in touch with your welcome packet and
              window decal.
            </p>
            <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
              If you have any questions, please contact your district captain or reply to this email.
            </p>
            <p style="margin:0;color:#374151;font-size:15px;">
              Mahalo and aloha,<br>
              <strong>HIBCW Administration</strong><br>
              <span style="color:#6b7280;font-size:13px;">Hawaiʻi Island Business Crime Watch</span>
            </p>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="background:#f9fafb;border-top:1px solid #e5e7eb;padding:20px 32px;text-align:center;">
            <p style="margin:0;color:#9ca3af;font-size:12px;line-height:1.6;">
              This is an automated message from the HIBCW system.<br>
              © ${year} Hawaiʻi Island Business Crime Watch · hibcw.kiaahilo.org
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;

  const textBody =
`Dear ${contactName},

Your business "${bizName}" has been approved and registered with the Hawaiʻi Island Business Crime Watch (HIBCW) network.

Business ID : ${bizId}
${addressLine ? "Address     : " + addressLine + "\n" : ""}Approved On : ${approvedDate}

As a registered HIBCW member you will now receive crime alerts for your district.
Your district captain will be in touch with your welcome packet and window decal.

Mahalo,
HIBCW Administration
hibcw.kiaahilo.org`;

  // ── Send via Resend ─────────────────────────────────────────────────────
  const resendKey = Deno.env.get("RESEND_API_KEY");
  if (!resendKey) {
    console.error("RESEND_API_KEY env var is not set");
    return new Response(JSON.stringify({ error: "Server email configuration missing" }), {
      status: 500, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const resendRes = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${resendKey}`,
    },
    body: JSON.stringify({
      from:    RESEND_FROM,
      to:      [email],
      subject: "✅ Your HIBCW business registration has been approved",
      html:    htmlBody,
      text:    textBody,
    }),
  });

  if (!resendRes.ok) {
    const err = await resendRes.json().catch(() => ({}));
    console.error("Resend error:", err);
    return new Response(JSON.stringify({ error: "Email delivery failed", detail: err }), {
      status: 502, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const result = await resendRes.json();
  return new Response(JSON.stringify({ ok: true, id: result.id }), {
    status: 200, headers: { ...CORS, "Content-Type": "application/json" },
  });
});

// ── Helpers ───────────────────────────────────────────────────────────────────
function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
