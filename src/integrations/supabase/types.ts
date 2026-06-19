export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      actividad_tareas: {
        Row: {
          accion: string
          fecha: string
          id: string
          tarea_id: string
          usuario_id: string
          valor_anterior: string | null
          valor_nuevo: string | null
        }
        Insert: {
          accion: string
          fecha?: string
          id?: string
          tarea_id: string
          usuario_id: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Update: {
          accion?: string
          fecha?: string
          id?: string
          tarea_id?: string
          usuario_id?: string
          valor_anterior?: string | null
          valor_nuevo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "actividad_tareas_tarea_id_fkey"
            columns: ["tarea_id"]
            isOneToOne: false
            referencedRelation: "tareas"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_mensajes: {
        Row: {
          archivo_nombre: string | null
          archivo_path: string | null
          archivo_tamano: number | null
          archivo_tipo: string | null
          autor_id: string
          contenido: string
          fecha: string
          id: string
          menciones: string[]
          proyecto_id: string
        }
        Insert: {
          archivo_nombre?: string | null
          archivo_path?: string | null
          archivo_tamano?: number | null
          archivo_tipo?: string | null
          autor_id: string
          contenido?: string
          fecha?: string
          id?: string
          menciones?: string[]
          proyecto_id: string
        }
        Update: {
          archivo_nombre?: string | null
          archivo_path?: string | null
          archivo_tamano?: number | null
          archivo_tipo?: string | null
          autor_id?: string
          contenido?: string
          fecha?: string
          id?: string
          menciones?: string[]
          proyecto_id?: string
        }
        Relationships: []
      }
      conversaciones: {
        Row: {
          creado_por: string
          fecha_creacion: string
          fecha_ultimo_mensaje: string
          id: string
          nombre: string | null
          tipo: string
        }
        Insert: {
          creado_por: string
          fecha_creacion?: string
          fecha_ultimo_mensaje?: string
          id?: string
          nombre?: string | null
          tipo: string
        }
        Update: {
          creado_por?: string
          fecha_creacion?: string
          fecha_ultimo_mensaje?: string
          id?: string
          nombre?: string | null
          tipo?: string
        }
        Relationships: []
      }
      mensajes_conversacion: {
        Row: {
          archivo_nombre: string | null
          archivo_path: string | null
          archivo_tamano: number | null
          archivo_tipo: string | null
          autor_id: string
          contenido: string | null
          conversacion_id: string
          fecha: string
          id: string
        }
        Insert: {
          archivo_nombre?: string | null
          archivo_path?: string | null
          archivo_tamano?: number | null
          archivo_tipo?: string | null
          autor_id: string
          contenido?: string | null
          conversacion_id: string
          fecha?: string
          id?: string
        }
        Update: {
          archivo_nombre?: string | null
          archivo_path?: string | null
          archivo_tamano?: number | null
          archivo_tipo?: string | null
          autor_id?: string
          contenido?: string | null
          conversacion_id?: string
          fecha?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensajes_conversacion_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      miembros_conversacion: {
        Row: {
          conversacion_id: string
          fecha_ultima_lectura: string
          fecha_union: string
          usuario_id: string
        }
        Insert: {
          conversacion_id: string
          fecha_ultima_lectura?: string
          fecha_union?: string
          usuario_id: string
        }
        Update: {
          conversacion_id?: string
          fecha_ultima_lectura?: string
          fecha_union?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "miembros_conversacion_conversacion_id_fkey"
            columns: ["conversacion_id"]
            isOneToOne: false
            referencedRelation: "conversaciones"
            referencedColumns: ["id"]
          },
        ]
      }
      miembros_proyecto: {
        Row: {
          created_at: string
          id: string
          proyecto_id: string
          rol: Database["public"]["Enums"]["rol_miembro"]
          usuario_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          proyecto_id: string
          rol?: Database["public"]["Enums"]["rol_miembro"]
          usuario_id: string
        }
        Update: {
          created_at?: string
          id?: string
          proyecto_id?: string
          rol?: Database["public"]["Enums"]["rol_miembro"]
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "miembros_proyecto_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      partidas_planos: {
        Row: {
          color: string
          creado_por: string
          fecha_creacion: string
          id: string
          nombre: string
          orden: number
          proyecto_id: string
        }
        Insert: {
          color?: string
          creado_por: string
          fecha_creacion?: string
          id?: string
          nombre: string
          orden?: number
          proyecto_id: string
        }
        Update: {
          color?: string
          creado_por?: string
          fecha_creacion?: string
          id?: string
          nombre?: string
          orden?: number
          proyecto_id?: string
        }
        Relationships: []
      }
      perfiles: {
        Row: {
          avatar_url: string | null
          color_avatar: string
          created_at: string
          email: string
          id: string
          nombre: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          color_avatar?: string
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          color_avatar?: string
          created_at?: string
          email?: string
          id?: string
          nombre?: string
          user_id?: string
        }
        Relationships: []
      }
      planos: {
        Row: {
          codigo: string
          creado_por: string
          entregado: boolean
          fecha_actualizacion: string
          fecha_creacion: string
          fecha_entrega: string | null
          finalizado: boolean
          id: string
          nombre: string
          notas: string | null
          partida_id: string
          pre_entrega: boolean
          proyecto_id: string
          responsable_id: string | null
        }
        Insert: {
          codigo?: string
          creado_por: string
          entregado?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          fecha_entrega?: string | null
          finalizado?: boolean
          id?: string
          nombre: string
          notas?: string | null
          partida_id: string
          pre_entrega?: boolean
          proyecto_id: string
          responsable_id?: string | null
        }
        Update: {
          codigo?: string
          creado_por?: string
          entregado?: boolean
          fecha_actualizacion?: string
          fecha_creacion?: string
          fecha_entrega?: string | null
          finalizado?: boolean
          id?: string
          nombre?: string
          notas?: string | null
          partida_id?: string
          pre_entrega?: boolean
          proyecto_id?: string
          responsable_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "planos_partida_id_fkey"
            columns: ["partida_id"]
            isOneToOne: false
            referencedRelation: "partidas_planos"
            referencedColumns: ["id"]
          },
        ]
      }
      proyecto_miro: {
        Row: {
          actualizado_por: string
          fecha_actualizacion: string
          id: string
          miro_board_id: string
          miro_url: string
          nombre: string
          proyecto_id: string
        }
        Insert: {
          actualizado_por: string
          fecha_actualizacion?: string
          id?: string
          miro_board_id: string
          miro_url: string
          nombre?: string
          proyecto_id: string
        }
        Update: {
          actualizado_por?: string
          fecha_actualizacion?: string
          id?: string
          miro_board_id?: string
          miro_url?: string
          nombre?: string
          proyecto_id?: string
        }
        Relationships: []
      }
      proyectos: {
        Row: {
          color: string
          creado_por: string
          fecha_creacion: string
          id: string
          nombre: string
        }
        Insert: {
          color?: string
          creado_por: string
          fecha_creacion?: string
          id?: string
          nombre: string
        }
        Update: {
          color?: string
          creado_por?: string
          fecha_creacion?: string
          id?: string
          nombre?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          p256dh: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          p256dh: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          p256dh?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: []
      }
      tareas: {
        Row: {
          creado_por: string
          descripcion: string | null
          estado: Database["public"]["Enums"]["estado_tarea"]
          fecha_actualizacion: string
          fecha_creacion: string
          fecha_inicio: string | null
          fecha_limite: string | null
          id: string
          imagen_path: string | null
          prioridad: Database["public"]["Enums"]["prioridad_tarea"]
          proyecto_id: string
          responsable_id: string | null
          seccion: string | null
          titulo: string
        }
        Insert: {
          creado_por: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_tarea"]
          fecha_actualizacion?: string
          fecha_creacion?: string
          fecha_inicio?: string | null
          fecha_limite?: string | null
          id?: string
          imagen_path?: string | null
          prioridad?: Database["public"]["Enums"]["prioridad_tarea"]
          proyecto_id: string
          responsable_id?: string | null
          seccion?: string | null
          titulo: string
        }
        Update: {
          creado_por?: string
          descripcion?: string | null
          estado?: Database["public"]["Enums"]["estado_tarea"]
          fecha_actualizacion?: string
          fecha_creacion?: string
          fecha_inicio?: string | null
          fecha_limite?: string | null
          id?: string
          imagen_path?: string | null
          prioridad?: Database["public"]["Enums"]["prioridad_tarea"]
          proyecto_id?: string
          responsable_id?: string | null
          seccion?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "tareas_proyecto_id_fkey"
            columns: ["proyecto_id"]
            isOneToOne: false
            referencedRelation: "proyectos"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_partidas: {
        Row: {
          creado_por: string
          fecha_actualizacion: string
          fecha_creacion: string
          fecha_fin: string
          fecha_inicio: string
          id: string
          partida_id: string
          proyecto_id: string
          responsable_id: string | null
        }
        Insert: {
          creado_por: string
          fecha_actualizacion?: string
          fecha_creacion?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          partida_id: string
          proyecto_id: string
          responsable_id?: string | null
        }
        Update: {
          creado_por?: string
          fecha_actualizacion?: string
          fecha_creacion?: string
          fecha_fin?: string
          fecha_inicio?: string
          id?: string
          partida_id?: string
          proyecto_id?: string
          responsable_id?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      buscar_usuario_por_email: {
        Args: { _email: string; _proyecto_id: string }
        Returns: string
      }
      crear_chat_directo: {
        Args: { _otro_usuario_id: string }
        Returns: string
      }
      crear_grupo: {
        Args: { _miembros: string[]; _nombre: string }
        Returns: string
      }
      crear_proyecto: {
        Args: { _color: string; _nombre: string }
        Returns: string
      }
      es_miembro_conversacion: {
        Args: { _conv_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_member: {
        Args: { _proyecto_id: string; _user_id: string }
        Returns: boolean
      }
      is_project_owner: {
        Args: { _proyecto_id: string; _user_id: string }
        Returns: boolean
      }
      random_avatar_color: { Args: never; Returns: string }
    }
    Enums: {
      estado_tarea: "pendiente" | "en_progreso" | "bloqueada" | "completada"
      prioridad_tarea: "baja" | "media" | "alta"
      rol_miembro: "propietario" | "miembro"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      estado_tarea: ["pendiente", "en_progreso", "bloqueada", "completada"],
      prioridad_tarea: ["baja", "media", "alta"],
      rol_miembro: ["propietario", "miembro"],
    },
  },
} as const
