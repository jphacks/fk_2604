import { createClient } from "npm:@supabase/supabase-js@2.118.0";
import { cleanupRoomFiles, flushFileNotifications } from "../_shared/file-jobs.ts";

const runtime = globalThis.Deno;
runtime.serve(async (req) => {
  const secret = runtime.env.get("FILE_MAINTENANCE_SECRET");
  // verify_jwt is disabled only because this service-to-service endpoint uses its
  // own secret. Missing configuration fails closed; ordinary user JWTs never pass.
  const expected = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret ?? ""));
  const supplied = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(req.headers.get("x-file-maintenance-secret") ?? ""));
  const a = new Uint8Array(expected), b = new Uint8Array(supplied);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  if (!secret || secret.length < 32 || difference !== 0) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (req.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  try {
    const admin = createClient(runtime.env.get("SUPABASE_URL"), runtime.env.get("SUPABASE_SERVICE_ROLE_KEY"), {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(10_000) }) },
    });
    const cleanup = await cleanupRoomFiles(admin);
    // Redis outages must never prevent expiration cleanup.
    let notifications;
    try {
      notifications = await flushFileNotifications(admin, {
        url: runtime.env.get("UPSTASH_REDIS_REST_URL"), token: runtime.env.get("UPSTASH_REDIS_REST_TOKEN"),
      });
    } catch { notifications = { notified: 0, failed: 1 }; }
    return Response.json({ cleanup, notifications }, { status: cleanup.failed || notifications.failed ? 503 : 200 });
  } catch { return Response.json({ error: "maintenance_failed" }, { status: 503 }); }
});
