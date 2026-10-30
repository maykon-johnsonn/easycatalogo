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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      canal_operadores: {
        Row: {
          canal: string
          criado_em: string
          id: string
          identificador_externo: string
          loja_id: string
          nome: string | null
        }
        Insert: {
          canal: string
          criado_em?: string
          id?: string
          identificador_externo: string
          loja_id: string
          nome?: string | null
        }
        Update: {
          canal?: string
          criado_em?: string
          id?: string
          identificador_externo?: string
          loja_id?: string
          nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "canal_operadores_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      conversas: {
        Row: {
          atualizado_em: string
          canal_operador_id: string
          ultimo_produto_id: string | null
        }
        Insert: {
          atualizado_em?: string
          canal_operador_id: string
          ultimo_produto_id?: string | null
        }
        Update: {
          atualizado_em?: string
          canal_operador_id?: string
          ultimo_produto_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "conversas_canal_operador_id_fkey"
            columns: ["canal_operador_id"]
            isOneToOne: true
            referencedRelation: "canal_operadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversas_ultimo_produto_id_fkey"
            columns: ["ultimo_produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      loja_membros: {
        Row: {
          criado_em: string
          loja_id: string
          papel: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          loja_id: string
          papel?: string
          user_id: string
        }
        Update: {
          criado_em?: string
          loja_id?: string
          papel?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loja_membros_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      lojas: {
        Row: {
          ativa: boolean
          atualizado_em: string
          criado_em: string
          id: string
          nome: string
          proximo_numero_produto: number
          slug: string
          telefone_pedidos: string
        }
        Insert: {
          ativa?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome: string
          proximo_numero_produto?: number
          slug: string
          telefone_pedidos: string
        }
        Update: {
          ativa?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string
          proximo_numero_produto?: number
          slug?: string
          telefone_pedidos?: string
        }
        Relationships: []
      }
      mensagens: {
        Row: {
          canal: string
          canal_operador_id: string | null
          conteudo: string | null
          criado_em: string
          direcao: string
          erro: string | null
          id: string
          id_externo: string | null
          loja_id: string | null
          modelo_ia: string | null
          processado_em: string | null
          provedor_ia: string | null
          remetente: string
          status: string
          tipo: string
          tokens_entrada: number | null
          tokens_saida: number | null
          usou_fallback: boolean
        }
        Insert: {
          canal: string
          canal_operador_id?: string | null
          conteudo?: string | null
          criado_em?: string
          direcao: string
          erro?: string | null
          id?: string
          id_externo?: string | null
          loja_id?: string | null
          modelo_ia?: string | null
          processado_em?: string | null
          provedor_ia?: string | null
          remetente: string
          status?: string
          tipo: string
          tokens_entrada?: number | null
          tokens_saida?: number | null
          usou_fallback?: boolean
        }
        Update: {
          canal?: string
          canal_operador_id?: string | null
          conteudo?: string | null
          criado_em?: string
          direcao?: string
          erro?: string | null
          id?: string
          id_externo?: string | null
          loja_id?: string | null
          modelo_ia?: string | null
          processado_em?: string | null
          provedor_ia?: string | null
          remetente?: string
          status?: string
          tipo?: string
          tokens_entrada?: number | null
          tokens_saida?: number | null
          usou_fallback?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_canal_operador_id_fkey"
            columns: ["canal_operador_id"]
            isOneToOne: false
            referencedRelation: "canal_operadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mensagens_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      midias_pendentes: {
        Row: {
          canal_operador_id: string
          chave_storage: string
          consumida_em: string | null
          grupo_externo: string | null
          id: string
          loja_id: string
          recebido_em: string
          url: string
        }
        Insert: {
          canal_operador_id: string
          chave_storage: string
          consumida_em?: string | null
          grupo_externo?: string | null
          id?: string
          loja_id: string
          recebido_em?: string
          url: string
        }
        Update: {
          canal_operador_id?: string
          chave_storage?: string
          consumida_em?: string | null
          grupo_externo?: string | null
          id?: string
          loja_id?: string
          recebido_em?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "midias_pendentes_canal_operador_id_fkey"
            columns: ["canal_operador_id"]
            isOneToOne: false
            referencedRelation: "canal_operadores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "midias_pendentes_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      plataforma_admins: {
        Row: {
          criado_em: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          user_id: string
        }
        Update: {
          criado_em?: string
          user_id?: string
        }
        Relationships: []
      }
      produto_imagens: {
        Row: {
          chave_storage: string
          criado_em: string
          id: string
          loja_id: string
          ordem: number
          produto_id: string
          url: string
        }
        Insert: {
          chave_storage: string
          criado_em?: string
          id?: string
          loja_id: string
          ordem?: number
          produto_id: string
          url: string
        }
        Update: {
          chave_storage?: string
          criado_em?: string
          id?: string
          loja_id?: string
          ordem?: number
          produto_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_imagens_produto_id_loja_id_fkey"
            columns: ["produto_id", "loja_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id", "loja_id"]
          },
        ]
      }
      produtos: {
        Row: {
          ativo: boolean
          atualizado_em: string
          categoria: string | null
          cores: Json
          criado_em: string
          descricao: string | null
          excluido_em: string | null
          id: string
          loja_id: string
          nome: string
          numero: number
          preco_original: number
          preco_promocional: number | null
          tamanhos: Json
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string | null
          cores?: Json
          criado_em?: string
          descricao?: string | null
          excluido_em?: string | null
          id?: string
          loja_id: string
          nome: string
          numero?: number
          preco_original: number
          preco_promocional?: number | null
          tamanhos?: Json
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          categoria?: string | null
          cores?: Json
          criado_em?: string
          descricao?: string | null
          excluido_em?: string | null
          id?: string
          loja_id?: string
          nome?: string
          numero?: number
          preco_original?: number
          preco_promocional?: number | null
          tamanhos?: Json
        }
        Relationships: [
          {
            foreignKeyName: "produtos_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
      vinculos_canal: {
        Row: {
          canal: string
          codigo: string
          criado_em: string
          criado_por: string | null
          expira_em: string
          loja_id: string
          usado_em: string | null
        }
        Insert: {
          canal: string
          codigo: string
          criado_em?: string
          criado_por?: string | null
          expira_em: string
          loja_id: string
          usado_em?: string | null
        }
        Update: {
          canal?: string
          codigo?: string
          criado_em?: string
          criado_por?: string | null
          expira_em?: string
          loja_id?: string
          usado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vinculos_canal_loja_id_fkey"
            columns: ["loja_id"]
            isOneToOne: false
            referencedRelation: "lojas"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      usuario_id_por_email: { Args: { p_email: string }; Returns: string }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
