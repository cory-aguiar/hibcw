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

const RESEND_FROM = "HIBCW <noreply@support.kiaahilo.org>";

const CORS = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

  const {
    email,
    contact_name,
    business_name,
    business_number,
    business_address,
    business_city,
    business_state,
    business_zip,
    district,
  } = body;

  if (!email) {
    return new Response(JSON.stringify({ error: "email is required" }), {
      status: 400, headers: { ...CORS, "Content-Type": "application/json" },
    });
  }

  const contactName  = contact_name  || business_name || "Business Owner";
  const bizName      = business_name || "Your Business";
  const bizId        = business_number || "Pending assignment";
  const addressParts = [business_address, business_city, business_state, business_zip].filter(Boolean);
  const addressLine  = addressParts.join(", ");
  const approvedDate = new Date().toLocaleDateString("en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
  const year = new Date().getFullYear();

  const districtLabel = district
    ? ({
        "hamakua":      "District 1 — Hāmākua",
        "north-hilo":   "District 2 — North Hilo",
        "south-hilo":   "District 3 — South Hilo",
        "lower-puna":   "District 4 — Lower Puna",
        "upper-puna":   "District 5 — Upper Puna",
        "kau":          "District 6 — Kaʻū",
        "south-kona":   "District 7 — South Kona",
        "north-kona":   "District 8 — North Kona",
        "north-kohala": "District 9 — Kohala",
      } as Record<string, string>)[district] ?? district
    : null;

  const htmlBody = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>HIBCW — Registration Approved</title>
</head>
<body style="margin:0;padding:0;background:#0b1524;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0b1524;padding:32px 0;">
    <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0"
           style="max-width:600px;width:100%;border-radius:12px;overflow:hidden;border:1px solid rgba(0,201,167,.18);">

      <!-- HEADER -->
      <tr>
        <td style="background:linear-gradient(135deg,#0b1524 0%,#111e30 100%);padding:32px 32px 24px;text-align:center;border-bottom:1px solid rgba(0,201,167,.15);">
          <div style="width:64px;height:64px;margin:0 auto 14px;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1016.87 972.01" width="64" height="64">
              <path fill="#00c9a7" d="M99.5,416.99l5.75,16.97,21.86,52.91,24.73,51.19,27.9,49.18,30.48,47.74,33.36,45.44,35.95,43.71,38.54,41.41,41.12,39.4,43.13,37.1,45.44,34.8c19.85,14.09,39.69,27.6,60.39,40.55,12.94-8.05,25.31-16.39,37.96-24.73,7.48-5.18,14.95-10.35,22.43-15.82l45.72-34.8,43.43-37.1,40.83-39.4,38.54-41.41,35.95-43.71,33.36-45.44,30.48-47.74,27.9-49.18,24.73-51.19,21.86-52.91,6.04-17.25c-113.31-63.84-241.56-98.35-371.26-103.82-154.71-6.61-311.73,28.18-446.6,104.1Z"/>
              <path fill="#00c9a7" d="M978.91,141.2l-27.9-18.41-28.75-16.97-29.62-15.53-29.91-14.38-30.48-13.23-30.77-12.08-31.63-10.64-31.63-9.49-32.21-8.05-32.5-6.9-32.49-5.75-33.07-4.31-32.79-3.16-33.36-1.73-33.07-.58h-.58l-32.5.58-32.78,1.73-33.07,3.16-33.07,4.31-32.5,5.75-32.5,6.9-32.21,8.05-31.92,9.49-31.63,10.64-30.77,12.08-30.77,13.23-29.91,14.38-29.62,15.53-28.76,16.97-28.18,18.41L0,168.23l4.31,44.29,4.03,31.06,5.18,30.77,5.75,30.19,6.9,30.2,7.77,29.33,8.34,29.33,19.55,56.94,23.01,55.5,25.88,53.78,29.33,51.76,31.92,49.75,35.09,47.74,37.67,45.72,40.26,43.43,42.85,41.41,45.44,38.82,47.45,36.23,49.75,33.94,37.67,23.58,37.67-23.58,25.31-16.68,48.89-35.09,46.3-37.67,44.29-39.97,41.69-42.27,38.83-44.57,36.52-46.88,33.36-48.89,30.77-50.61,27.61-52.91,24.44-54.35,20.99-56.36,18.12-58.09,7.48-29.33,6.9-30.2,5.75-30.19,5.18-30.77,4.02-31.06,4.61-44.29-37.96-27.03ZM508.14,944.68C236.67,781.06,52.63,508.15,24.44,179.16,164.21,75.35,336.46,23.29,508.14,23.01c172.55,0,344.8,52.05,484.28,156.15-28.47,328.98-212.52,601.9-484.28,765.52Z"/>
            </svg>
          </div>
          <p style="margin:0 0 4px;color:#00c9a7;font-size:10px;letter-spacing:3px;text-transform:uppercase;font-weight:700;">
            Hawaiʻi Island Business Crime Watch
          </p>
          <h1 style="margin:6px 0 0;color:#eef3f8;font-size:24px;font-weight:700;letter-spacing:.03em;">
            Registration Approved
          </h1>
          <p style="margin:6px 0 0;color:#00c9a7;font-size:18px;">&#10003;</p>
        </td>
      </tr>

      <!-- GREETING -->
      <tr>
        <td style="background:#111e30;padding:28px 32px 0;">
          <p style="margin:0 0 14px;color:#eef3f8;font-size:15px;line-height:1.6;">
            Dear ${escHtml(contactName)},
          </p>
          <p style="margin:0 0 24px;color:#7a8fa6;font-size:14px;line-height:1.7;">
            We are pleased to inform you that <span style="color:#eef3f8;font-weight:600;">${escHtml(bizName)}</span>
            has been officially approved and registered with the Hawaiʻi Island Business Crime Watch network.
          </p>
        </td>
      </tr>

      <!-- APPROVAL DETAILS -->
      <tr>
        <td style="background:#111e30;padding:0 32px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#18293f;border:1px solid rgba(0,201,167,.2);border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:14px 20px 10px;border-bottom:1px solid rgba(0,201,167,.12);">
                <p style="margin:0;color:#00c9a7;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;font-weight:700;">
                  Business Registration Details
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="color:#7a8fa6;font-size:12px;padding:5px 0;width:38%;font-family:'Courier New',monospace;letter-spacing:.04em;">BUSINESS</td>
                    <td style="color:#eef3f8;font-size:13px;padding:5px 0;font-weight:600;">${escHtml(bizName)}</td>
                  </tr>
                  ${addressLine ? `<tr>
                    <td style="color:#7a8fa6;font-size:12px;padding:5px 0;font-family:'Courier New',monospace;letter-spacing:.04em;">ADDRESS</td>
                    <td style="color:#eef3f8;font-size:13px;padding:5px 0;">${escHtml(addressLine)}</td>
                  </tr>` : ""}
                  ${districtLabel ? `<tr>
                    <td style="color:#7a8fa6;font-size:12px;padding:5px 0;font-family:'Courier New',monospace;letter-spacing:.04em;">DISTRICT</td>
                    <td style="color:#00c9a7;font-size:13px;padding:5px 0;font-weight:600;">${escHtml(districtLabel)}</td>
                  </tr>` : ""}
                  <tr>
                    <td style="color:#7a8fa6;font-size:12px;padding:5px 0;font-family:'Courier New',monospace;letter-spacing:.04em;">BUSINESS ID</td>
                    <td style="color:#f5a623;font-size:13px;padding:5px 0;font-weight:700;font-family:'Courier New',monospace;">${escHtml(bizId)}</td>
                  </tr>
                  <tr>
                    <td style="color:#7a8fa6;font-size:12px;padding:5px 0;font-family:'Courier New',monospace;letter-spacing:.04em;">APPROVED</td>
                    <td style="color:#eef3f8;font-size:13px;padding:5px 0;">${approvedDate}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- PACKET HEADER -->
      <tr>
        <td style="background:#111e30;padding:0 32px 12px;">
          <p style="margin:0 0 4px;color:#00c9a7;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;font-weight:700;font-family:'Courier New',monospace;">
            What to expect
          </p>
          <p style="margin:0;color:#eef3f8;font-size:16px;font-weight:700;">
            Your Member Packet
          </p>
          <p style="margin:4px 0 0;color:#7a8fa6;font-size:13px;line-height:1.6;">
            Once your captain is notified, your packet will be delivered to your business containing:
          </p>
        </td>
      </tr>

      <!-- PACKET GRID -->
      <tr>
        <td style="background:#111e30;padding:0 32px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#18293f;border:1px solid rgba(255,255,255,.07);border-radius:8px;overflow:hidden;">
            <tr>
              <td width="50%" style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.06);border-right:1px solid rgba(255,255,255,.06);">
                <div style="font-size:16px;">&#9993;</div>
                <div style="color:#eef3f8;font-size:12px;font-weight:600;margin-top:4px;">Welcome Letter</div>
                <div style="color:#7a8fa6;font-size:11px;margin-top:2px;line-height:1.4;">From your District Captain</div>
              </td>
              <td width="50%" style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.06);">
                <div style="font-size:16px;">&#127885;</div>
                <div style="color:#eef3f8;font-size:12px;font-weight:600;margin-top:4px;">Membership Certificate</div>
                <div style="color:#7a8fa6;font-size:11px;margin-top:2px;line-height:1.4;">Personalized for your business</div>
              </td>
            </tr>
            <tr>
              <td style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.06);border-right:1px solid rgba(255,255,255,.06);">
                <div style="font-size:16px;">&#128205;</div>
                <div style="color:#eef3f8;font-size:12px;font-weight:600;margin-top:4px;">District Flyer</div>
                <div style="color:#7a8fa6;font-size:11px;margin-top:2px;line-height:1.4;">Color-coded for your district</div>
              </td>
              <td style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.06);">
                <div style="font-size:16px;">&#128203;</div>
                <div style="color:#eef3f8;font-size:12px;font-weight:600;margin-top:4px;">Program Overview</div>
                <div style="color:#7a8fa6;font-size:11px;margin-top:2px;line-height:1.4;">How HIBCW works and how to use it</div>
              </td>
            </tr>
            <tr>
              <td style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.06);border-right:1px solid rgba(255,255,255,.06);">
                <div style="font-size:16px;">&#128680;</div>
                <div style="color:#eef3f8;font-size:12px;font-weight:600;margin-top:4px;">Incident Reporting Guide</div>
                <div style="color:#7a8fa6;font-size:11px;margin-top:2px;line-height:1.4;">Step-by-step how to submit a report</div>
              </td>
              <td style="padding:13px 16px;border-bottom:1px solid rgba(255,255,255,.06);">
                <div style="font-size:16px;">&#9889;</div>
                <div style="color:#eef3f8;font-size:12px;font-weight:600;margin-top:4px;">Quick Reference Guide</div>
                <div style="color:#7a8fa6;font-size:11px;margin-top:2px;line-height:1.4;">What to report, when to call 911</div>
              </td>
            </tr>
            <tr>
              <td style="padding:13px 16px;border-right:1px solid rgba(255,255,255,.06);">
                <div style="font-size:16px;">&#128199;</div>
                <div style="color:#eef3f8;font-size:12px;font-weight:600;margin-top:4px;">Emergency Contact Card</div>
                <div style="color:#7a8fa6;font-size:11px;margin-top:2px;line-height:1.4;">Wallet-size with your Captain's contact</div>
              </td>
              <td style="padding:13px 16px;">
                <div style="font-size:16px;">&#128204;</div>
                <div style="color:#eef3f8;font-size:12px;font-weight:600;margin-top:4px;">Breakroom QR Flyer</div>
                <div style="color:#7a8fa6;font-size:11px;margin-top:2px;line-height:1.4;">For staff to post and scan</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- STAFF CALLOUT -->
      <tr>
        <td style="background:#111e30;padding:0 32px 28px;">
          <table width="100%" cellpadding="0" cellspacing="0"
                 style="background:#18293f;border:1px solid rgba(245,166,35,.2);border-radius:8px;overflow:hidden;">
            <tr>
              <td style="padding:16px 20px 12px;border-bottom:1px solid rgba(255,255,255,.07);">
                <p style="margin:0 0 3px;color:#f5a623;font-size:9px;letter-spacing:2.5px;text-transform:uppercase;font-weight:700;font-family:'Courier New',monospace;">
                  For your staff
                </p>
                <p style="margin:0;color:#eef3f8;font-size:14px;font-weight:700;">
                  Encourage Your Team to Register
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:14px 20px;">
                <p style="margin:0 0 14px;color:#7a8fa6;font-size:13px;line-height:1.6;">
                  Your business is registered — but your employees can each sign up individually
                  as reporting members. The breakroom flyer in your packet makes this easy.
                  Once approved, they earn a verified badge on any incident reports they submit.
                </p>
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="background:rgba(245,166,35,.08);border:1px solid rgba(245,166,35,.25);border-radius:6px;padding:11px 16px;text-align:center;">
                      <a href="https://hibcw.kiaahilo.org/apply.html"
                         style="color:#f5a623;font-size:12px;font-weight:700;text-decoration:none;letter-spacing:.08em;text-transform:uppercase;font-family:'Courier New',monospace;">
                        Share the Member Signup Link with Your Staff
                      </a>
                      <p style="margin:4px 0 0;color:#7a8fa6;font-size:11px;">No cost · Takes 2 minutes</p>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>

      <!-- CLOSING -->
      <tr>
        <td style="background:#111e30;padding:0 32px 28px;">
          <p style="margin:0 0 6px;color:#7a8fa6;font-size:14px;line-height:1.7;">
            If you have any questions, please contact your district captain or reply to this email.
          </p>
          <p style="margin:0;color:#7a8fa6;font-size:14px;line-height:1.7;">
            Mahalo and aloha,<br>
            <span style="color:#eef3f8;font-weight:600;">HIBCW Administration</span><br>
            <span style="color:#00c9a7;font-size:12px;">Hawaiʻi Island Business Crime Watch</span>
          </p>
        </td>
      </tr>

      <!-- FOOTER -->
      <tr>
        <td style="background:#0b1524;border-top:1px solid rgba(0,201,167,.12);padding:18px 32px;text-align:center;">
          <p style="margin:0;color:#4a6070;font-size:11px;line-height:1.7;">
            This is an automated message from the HIBCW system.<br>
            &copy; ${year} Hawaiʻi Island Business Crime Watch &middot; A Program of KIAA &middot; kiaahilo.org
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
${addressLine ? "Address     : " + addressLine + "\n" : ""}${districtLabel ? "District    : " + districtLabel + "\n" : ""}Approved On : ${approvedDate}

As a registered HIBCW member you will now receive crime alerts for your district.
Your district captain will be in touch with your welcome packet and window decal.

Mahalo,
HIBCW Administration
hibcw.kiaahilo.org`;

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
      subject: "Your HIBCW business registration has been approved",
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

function escHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
