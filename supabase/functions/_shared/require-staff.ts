// ─────────────────────────────────────────────────────────────────────────────
// HIBCW — shared staff check for Edge Functions
//
// These functions are deployed with --no-verify-jwt (so the browser's CORS
// pre-flight works), which means Supabase does NOT check who is calling.
// This helper does: the request must carry the access token of a signed-in
// account listed in admin_roles. The admin pages already send it.
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided to every Edge
// Function automatically; nothing new to configure.
// ─────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

export type Staff = {
  user_id: string;
  email: string;
  role: string;            // superadmin | admin | captain
  district: string | null; // set for captains
};

type Result = { staff: Staff; denied?: undefined } | { staff?: undefined; denied: Response };

export async function requireStaff(
  req: Request,
  cors: Record<string, string>,
): Promise<Result> {
  const deny = (status: number, error: string): Result => ({
    denied: new Response(JSON.stringify({ error }), {
      status,
      headers: { ...cors, "Content-Type": "application/json" },
    }),
  });

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !serviceKey) return deny(500, "Server configuration missing");
  if (!token) return deny(401, "Sign in to the HIBCW admin to do this.");

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });

  // Validates the token's signature and expiry; the public anon key fails here.
  const { data: userData, error: userErr } = await admin.auth.getUser(token);
  if (userErr || !userData?.user) return deny(401, "Your session has expired. Please sign in again.");

  const { data: role, error: roleErr } = await admin
    .from("admin_roles")
    .select("email, role, district")
    .eq("user_id", userData.user.id)
    .maybeSingle();
  if (roleErr) return deny(500, "Could not check staff access");
  if (!role) return deny(403, "Only HIBCW staff can do this.");

  return {
    staff: {
      user_id: userData.user.id,
      email: role.email,
      role: role.role,
      district: role.district ?? null,
    },
  };
}
