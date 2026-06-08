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

    // Load context (full project snapshot)
    const [
      proyectoRes, perfilesRes, tareasRes, chatRes,
      partidasRes, planosRes, timelineRes, miroRes,
    ] = await Promise.all([
      supabase.from("proyectos").select("nombre, fecha_creacion").eq("id", proyecto_id).maybeSingle(),
      supabase.from("miembros_proyecto")
        .select("usuario_id, rol, perfiles!inner(user_id, nombre, email)")
        .eq("proyecto_id", proyecto_id),
      supabase.from("tareas")
        .select("titulo, descripcion, estado, prioridad, fecha_inicio, fecha_limite, fecha_creacion, fecha_actualizacion, seccion, responsable_id")
        .eq("proyecto_id", proyecto_id)
        .order("fecha_actualizacion", { ascending: false })
        .limit(120),
      supabase.from("chat_mensajes")
        .select("autor_id, contenido, fecha, archivo_nombre")
        .eq("proyecto_id", proyecto_id)
        .order("fecha", { ascending: false })
        .limit(80),
      supabase.from("partidas_planos")
        .select("id, nombre, color, orden")
        .eq("proyecto_id", proyecto_id)
        .order("orden"),
      supabase.from("planos")
        .select("codigo, nombre, notas, partida_id, responsable_id, fecha_entrega, fecha_actualizacion, pre_entrega, entregado, finalizado")
        .eq("proyecto_id", proyecto_id)
        .order("fecha_actualizacion", { ascending: false })
        .limit(200),
      supabase.from("timeline_partidas")
        .select("partida_id, fecha_inicio, fecha_fin, responsable_id")
        .eq("proyecto_id", proyecto_id),
      supabase.from("proyecto_miro")
        .select("nombre, miro_url, fecha_actualizacion")
        .eq("proyecto_id", proyecto_id)
        .order("fecha_actualizacion", { ascending: false })
        .limit(10),
    ]);

    const proyecto = proyectoRes.data;
    const miembros = (perfilesRes.data ?? []).map((m: any) => ({
      user_id: m.perfiles.user_id, nombre: m.perfiles.nombre, email: m.perfiles.email, rol: m.rol,
    }));
    const nombreById = new Map(miembros.map((m) => [m.user_id, m.nombre]));
    const tareas = tareasRes.data ?? [];
    const chat = (chatRes.data ?? []).reverse();
    const partidas = partidasRes.data ?? [];
    const partidaNameById = new Map(partidas.map((p: any) => [p.id, p.nombre]));
    const planos = planosRes.data ?? [];
    const timeline = timelineRes.data ?? [];
    const miro = miroRes.data ?? [];

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const weekAhead = new Date(now.getTime() + 7 * 86400000);
    const iso = (d: Date) => d.toISOString().slice(0, 10);

    const conteoEstados = tareas.reduce((acc: any, t: any) => { acc[t.estado] = (acc[t.estado] ?? 0) + 1; return acc; }, {});
    const vencidas = tareas.filter((t: any) => t.fecha_limite && t.estado !== "completada" && t.fecha_limite < iso(now));
    const proximas = tareas.filter((t: any) => t.fecha_limite && t.estado !== "completada" && t.fecha_limite >= iso(now) && t.fecha_limite <= iso(weekAhead));
    const completadasSemana = tareas.filter((t: any) => t.estado === "completada" && t.fecha_actualizacion >= weekAgo.toISOString());
    const tareasActualizadasSemana = tareas.filter((t: any) => t.fecha_actualizacion >= weekAgo.toISOString());
    const planosSemana = planos.filter((p: any) => p.fecha_actualizacion >= weekAgo.toISOString());
    const conteoPlanos = planos.reduce((acc: any, p: any) => {
      const k = p.finalizado ? "finalizado" : p.entregado ? "entregado" : p.pre_entrega ? "pre_entrega" : "pendiente";
      acc[k] = (acc[k] ?? 0) + 1; return acc;
    }, {});
    const mensajesSemana = chat.filter((c: any) => c.fecha >= weekAgo.toISOString());

    const planosPorPartida = partidas.map((p: any) => {
      const items = planos.filter((pl: any) => pl.partida_id === p.id);
      return { partida: p.nombre, total: items.length, items: items.slice(0, 20) };
    });

    const systemContext = [
      `Eres el asistente IA del proyecto "${proyecto?.nombre ?? "(sin nombre)"}" en la app Flowemi.`,
      `Hoy es ${iso(now)}. Respondes SIEMPRE en español, claro y al grano, usando markdown (títulos cortos, listas con viñetas, **negritas** para datos clave).`,
      `Tienes acceso COMPLETO al estado del proyecto: miembros, tareas, sheets/planos por partida, timeline, mensajes del chat y tableros Miro. Cuando el usuario pregunte por cualquiera de esas secciones (p.ej. "dame un resumen de sheets", "cómo va el timeline", "qué se habló esta semana"), respóndele con los datos reales que aparecen abajo.`,
      `Para un "resumen semanal" o "estatus del proyecto": estructura la respuesta en secciones con estos encabezados en este orden, omitiendo los que no apliquen: **Resumen ejecutivo**, **Tareas** (completadas en la semana, en curso, bloqueadas, vencidas, próximas 7 días), **Sheets / Planos** (avance por partida y entregas recientes), **Timeline** (partidas activas esta semana o próximas), **Chat** (temas clave de los últimos mensajes), **Riesgos y siguientes pasos**.`,
      `Cuando el usuario pida crear una tarea, usa la herramienta crear_tarea (prioridad media y sección "General" por defecto si no se especifica).`,
      ``,
      `## Miembros (${miembros.length})`,
      miembros.map((m: any) => `- ${m.nombre} <${m.email}> [${m.rol}]`).join("\n") || "(ninguno)",
      ``,
      `## Tareas — conteo por estado`,
      JSON.stringify(conteoEstados),
      `Vencidas (${vencidas.length}): ${vencidas.slice(0, 15).map((t: any) => `${t.titulo} (venció ${t.fecha_limite})`).join("; ") || "ninguna"}`,
      `Próximas 7 días (${proximas.length}): ${proximas.slice(0, 15).map((t: any) => `${t.titulo} → ${t.fecha_limite}${t.responsable_id ? ` (${nombreById.get(t.responsable_id) ?? "?"})` : ""}`).join("; ") || "ninguna"}`,
      `Completadas última semana (${completadasSemana.length}): ${completadasSemana.slice(0, 20).map((t: any) => t.titulo).join("; ") || "ninguna"}`,
      `Tareas actualizadas última semana (${tareasActualizadasSemana.length}):`,
      tareasActualizadasSemana.slice(0, 40).map((t: any) => `- [${t.estado}|${t.prioridad}] ${t.titulo}${t.seccion ? ` · ${t.seccion}` : ""}${t.fecha_limite ? ` · vence ${t.fecha_limite}` : ""}${t.responsable_id ? ` · ${nombreById.get(t.responsable_id) ?? "?"}` : ""}`).join("\n") || "(sin cambios)",
      ``,
      `## Sheets / Planos — conteo por estado: ${JSON.stringify(conteoPlanos)} (total ${planos.length})`,
      `Partidas (${partidas.length}):`,
      planosPorPartida.map((g) => {
        const lines = g.items.map((pl: any) => {
          const estado = pl.finalizado ? "finalizado" : pl.entregado ? "entregado" : pl.pre_entrega ? "pre-entrega" : "pendiente";
          return `  · ${pl.codigo || "—"} ${pl.nombre} [${estado}]${pl.fecha_entrega ? ` entrega ${pl.fecha_entrega}` : ""}${pl.responsable_id ? ` · ${nombreById.get(pl.responsable_id) ?? "?"}` : ""}`;
        }).join("\n");
        return `- ${g.partida} (${g.total})${lines ? `\n${lines}` : ""}`;
      }).join("\n") || "(sin partidas)",
      `Planos actualizados última semana (${planosSemana.length}): ${planosSemana.slice(0, 15).map((p: any) => `${p.codigo || ""} ${p.nombre}`.trim()).join("; ") || "ninguno"}`,
      ``,
      `## Timeline (${timeline.length} bloques)`,
      timeline.slice(0, 60).map((b: any) => `- ${partidaNameById.get(b.partida_id) ?? "(partida)"} ${b.fecha_inicio} → ${b.fecha_fin}${b.responsable_id ? ` · ${nombreById.get(b.responsable_id) ?? "?"}` : ""}`).join("\n") || "(sin bloques)",
      ``,
      `## Miro`,
      miro.map((m: any) => `- ${m.nombre}: ${m.miro_url}`).join("\n") || "(sin tableros)",
      ``,
      `## Chat — últimos ${chat.length} mensajes (cronológico), ${mensajesSemana.length} en la última semana`,
      chat.slice(-50).map((c: any) => `- [${c.fecha?.slice(0, 16).replace("T", " ")}] ${nombreById.get(c.autor_id) ?? "?"}: ${c.contenido}${c.archivo_nombre ? ` 📎 ${c.archivo_nombre}` : ""}`).join("\n") || "(sin mensajes)",
    ].join("\n");

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