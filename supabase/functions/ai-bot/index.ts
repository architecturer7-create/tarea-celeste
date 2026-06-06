import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return j({ error: "No auth" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    const userId = userData.user?.id;
    if (!userId) return j({ error: "Invalid user" }, 401);

    const { proyecto_id, messages } = await req.json();
    if (!proyecto_id || !Array.isArray(messages)) return j({ error: "Missing fields" }, 400);

    // Verify membership
    const { data: member } = await supabase
      .from("miembros_proyecto").select("id").eq("proyecto_id", proyecto_id).eq("usuario_id", userId).maybeSingle();
    if (!member) return j({ error: "Not a member" }, 403);

    // Load context
    const [proyectoRes, perfilesRes, tareasRes, chatRes] = await Promise.all([
      supabase.from("proyectos").select("nombre").eq("id", proyecto_id).maybeSingle(),
      supabase.from("miembros_proyecto")
        .select("usuario_id, perfiles!inner(user_id, nombre, email)")
        .eq("proyecto_id", proyecto_id),
      supabase.from("tareas").select("titulo, estado, prioridad, fecha_limite, seccion, responsable_id").eq("proyecto_id", proyecto_id).order("fecha_creacion", { ascending: false }).limit(50),
      supabase.from("chat_mensajes").select("autor_id, contenido, fecha").eq("proyecto_id", proyecto_id).order("fecha", { ascending: false }).limit(40),
    ]);

    const proyecto = proyectoRes.data;
    const miembros = (perfilesRes.data ?? []).map((m: any) => ({ user_id: m.perfiles.user_id, nombre: m.perfiles.nombre, email: m.perfiles.email }));
    const nombreById = new Map(miembros.map((m) => [m.user_id, m.nombre]));
    const tareas = tareasRes.data ?? [];
    const chat = (chatRes.data ?? []).reverse();

    const conteoEstados = tareas.reduce((acc: any, t: any) => { acc[t.estado] = (acc[t.estado] ?? 0) + 1; return acc; }, {});
    const proximas = tareas.filter((t: any) => t.fecha_limite && t.estado !== "completada").slice(0, 10);

    const systemContext = [
      `Eres el asistente IA del proyecto "${proyecto?.nombre ?? "(sin nombre)"}" en la app Flowemi.`,
      `Respondes en español, breve y al grano. Usas markdown.`,
      `Miembros del proyecto: ${miembros.map((m) => `${m.nombre} (${m.email})`).join(", ") || "ninguno"}.`,
      `Conteo de tareas por estado: ${JSON.stringify(conteoEstados)}.`,
      `Tareas (máx 50 recientes):\n${tareas.map((t: any) => `- [${t.estado}|${t.prioridad}] ${t.titulo}${t.fecha_limite ? ` (vence ${t.fecha_limite})` : ""}${t.responsable_id ? ` → ${nombreById.get(t.responsable_id) ?? "?"}` : ""}`).join("\n") || "(sin tareas)"}`,
      `Próximas con fecha límite: ${proximas.map((t: any) => `${t.titulo} → ${t.fecha_limite}`).join("; ") || "ninguna"}`,
      `Últimos mensajes del chat (orden cronológico):\n${chat.map((c: any) => `- ${nombreById.get(c.autor_id) ?? "?"}: ${c.contenido}`).join("\n") || "(sin mensajes)"}`,
      `Cuando el usuario te pida crear una tarea, usa la herramienta crear_tarea. Si no especifica datos, usa valores razonables (prioridad media, sección "General", sin responsable).`,
      `Para resúmenes: agrupa por estado, destaca tareas urgentes (vencidas o por vencer en 7 días) y bloqueadas.`,
    ].join("\n\n");

    const tools = [{
      type: "function",
      function: {
        name: "crear_tarea",
        description: "Crea una tarea en el proyecto actual.",
        parameters: {
          type: "object",
          properties: {
            titulo: { type: "string", description: "Título corto de la tarea" },
            descripcion: { type: "string" },
            prioridad: { type: "string", enum: ["baja", "media", "alta"] },
            estado: { type: "string", enum: ["pendiente", "en_progreso", "bloqueada", "completada"] },
            seccion: { type: "string", description: "Sección o categoría" },
            fecha_limite: { type: "string", description: "Formato YYYY-MM-DD" },
            responsable_email: { type: "string", description: "Email exacto de un miembro del proyecto" },
          },
          required: ["titulo"],
          additionalProperties: false,
        },
      },
    }];

    const apiMessages = [
      { role: "system", content: systemContext },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: apiMessages,
        tools,
        tool_choice: "auto",
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return j({ error: "Demasiadas peticiones, intenta en un momento." }, 429);
      if (aiRes.status === 402) return j({ error: "Sin créditos de IA. Añade créditos en tu workspace." }, 402);
      const t = await aiRes.text();
      console.error("AI error", aiRes.status, t);
      return j({ error: "Error del modelo de IA" }, 500);
    }

    const aiJson = await aiRes.json();
    const msg = aiJson.choices?.[0]?.message;
    let texto: string = msg?.content ?? "";
    const tareasCreadas: any[] = [];

    const toolCalls = msg?.tool_calls ?? [];
    for (const tc of toolCalls) {
      if (tc.function?.name !== "crear_tarea") continue;
      try {
        const args = JSON.parse(tc.function.arguments ?? "{}");
        let responsable_id: string | null = null;
        if (args.responsable_email) {
          const found = miembros.find((m) => m.email?.toLowerCase() === String(args.responsable_email).toLowerCase());
          responsable_id = found?.user_id ?? null;
        }
        const { data: nueva, error: insErr } = await supabase.from("tareas").insert({
          proyecto_id,
          titulo: args.titulo,
          descripcion: args.descripcion ?? null,
          prioridad: args.prioridad ?? "media",
          estado: args.estado ?? "pendiente",
          seccion: args.seccion ?? "General",
          fecha_limite: args.fecha_limite ?? null,
          responsable_id,
          creado_por: userId,
        }).select("id, titulo").single();
        if (insErr) {
          console.error("insert tarea err", insErr);
          texto += `\n\n⚠️ No pude crear "${args.titulo}": ${insErr.message}`;
        } else {
          tareasCreadas.push(nueva);
        }
      } catch (e) {
        console.error("tool parse err", e);
      }
    }

    if (tareasCreadas.length > 0 && !texto) {
      texto = `✅ Creé ${tareasCreadas.length} tarea${tareasCreadas.length > 1 ? "s" : ""}: ${tareasCreadas.map((t) => `**${t.titulo}**`).join(", ")}`;
    } else if (tareasCreadas.length > 0) {
      texto += `\n\n✅ Creé: ${tareasCreadas.map((t) => `**${t.titulo}**`).join(", ")}`;
    }

    return j({ reply: texto || "(sin respuesta)", tareasCreadas });
  } catch (e) {
    console.error("ai-bot error", e);
    return j({ error: String(e) }, 500);
  }
});

function j(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}