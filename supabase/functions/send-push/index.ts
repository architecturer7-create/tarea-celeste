import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY = "BLPBdhEX3udtV8W_bW6RAA5Gb5plKlwktA30gavhicLRUVLUOJ1WaqxQ41r70xvoi-Ad5Di-Krzd3NNrdK4WmmY";
const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY")!;
const RAW_SUBJECT = Deno.env.get("VAPID_SUBJECT") ?? "";
// VAPID subject MUST be a mailto: or https:// URL. Fall back if invalid.
const VAPID_SUBJECT = /^(mailto:|https?:\/\/)/i.test(RAW_SUBJECT)
  ? RAW_SUBJECT
  : "mailto:noreply@flowemi.app";

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "No auth" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const senderId = userData.user?.id;
    if (!senderId) {
      return new Response(JSON.stringify({ error: "Invalid user" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { proyecto_id, contenido, autor_nombre, proyecto_nombre, archivo_nombre } = await req.json();
    if (!proyecto_id) {
      return new Response(JSON.stringify({ error: "Missing proyecto_id" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Verify sender is a project member
    const { data: memberCheck } = await supabase
      .from("miembros_proyecto")
      .select("id")
      .eq("proyecto_id", proyecto_id)
      .eq("usuario_id", senderId)
      .maybeSingle();
    if (!memberCheck) {
      return new Response(JSON.stringify({ error: "Not a project member" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get all project members except sender
    const { data: members } = await supabase
      .from("miembros_proyecto")
      .select("usuario_id")
      .eq("proyecto_id", proyecto_id)
      .neq("usuario_id", senderId);

    const recipientIds = (members ?? []).map((m: any) => m.usuario_id);
    if (recipientIds.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .in("user_id", recipientIds);

    const body = archivo_nombre
      ? (contenido ? `📎 ${archivo_nombre} — ${contenido}` : `📎 ${archivo_nombre}`)
      : (contenido ?? "");

    const payload = JSON.stringify({
      title: `${autor_nombre ?? "Mensaje"}${proyecto_nombre ? " · " + proyecto_nombre : ""}`,
      body: body.slice(0, 200),
      url: `/proyecto/${proyecto_id}?tab=connect`,
      tag: `chat-${proyecto_id}`,
    });

    let sent = 0;
    const toRemove: string[] = [];
    await Promise.all((subs ?? []).map(async (s: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (err: any) {
        if (err?.statusCode === 404 || err?.statusCode === 410) {
          toRemove.push(s.id);
        } else {
          console.error("push error", err?.statusCode, err?.body);
        }
      }
    }));

    if (toRemove.length > 0) {
      await supabase.from("push_subscriptions").delete().in("id", toRemove);
    }

    return new Response(JSON.stringify({ sent, removed: toRemove.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push error", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});