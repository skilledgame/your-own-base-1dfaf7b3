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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      crypto_transactions: {
        Row: {
          amount_crypto: number | null
          amount_usd: number
          confirmed_at: string | null
          created_at: string
          crypto_currency: string
          expires_at: string | null
          id: string
          order_id: string
          payment_id: string
          payment_status: string | null
          skilled_coins_credited: number
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_crypto?: number | null
          amount_usd: number
          confirmed_at?: string | null
          created_at?: string
          crypto_currency: string
          expires_at?: string | null
          id?: string
          order_id: string
          payment_id: string
          payment_status?: string | null
          skilled_coins_credited?: number
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_crypto?: number | null
          amount_usd?: number
          confirmed_at?: string | null
          created_at?: string
          crypto_currency?: string
          expires_at?: string | null
          id?: string
          order_id?: string
          payment_id?: string
          payment_status?: string | null
          skilled_coins_credited?: number
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      free_plays: {
        Row: {
          created_at: string
          game_slug: string
          id: string
          plays_remaining: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          game_slug: string
          id?: string
          plays_remaining?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          game_slug?: string
          id?: string
          plays_remaining?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      game_ledger: {
        Row: {
          amount: number
          created_at: string
          game_id: string
          id: string
          player_id: string
          type: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          game_id: string
          id?: string
          player_id: string
          type: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          game_id?: string
          id?: string
          player_id?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "game_ledger_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "game_ledger_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      games: {
        Row: {
          black_player_id: string
          black_time: number
          created_at: string
          current_turn: string
          fen: string
          game_type: string
          id: string
          settled_at: string | null
          settlement_tx_id: string | null
          status: string
          updated_at: string
          wager: number
          white_player_id: string
          white_time: number
          winner_id: string | null
        }
        Insert: {
          black_player_id: string
          black_time?: number
          created_at?: string
          current_turn?: string
          fen?: string
          game_type?: string
          id?: string
          settled_at?: string | null
          settlement_tx_id?: string | null
          status?: string
          updated_at?: string
          wager: number
          white_player_id: string
          white_time?: number
          winner_id?: string | null
        }
        Update: {
          black_player_id?: string
          black_time?: number
          created_at?: string
          current_turn?: string
          fen?: string
          game_type?: string
          id?: string
          settled_at?: string | null
          settlement_tx_id?: string | null
          status?: string
          updated_at?: string
          wager?: number
          white_player_id?: string
          white_time?: number
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_black_player_id_fkey"
            columns: ["black_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_white_player_id_fkey"
            columns: ["white_player_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "games_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      matchmaking_queue: {
        Row: {
          created_at: string
          game_type: string
          id: string
          player_id: string
          wager: number
        }
        Insert: {
          created_at?: string
          game_type?: string
          id?: string
          player_id: string
          wager: number
        }
        Update: {
          created_at?: string
          game_type?: string
          id?: string
          player_id?: string
          wager?: number
        }
        Relationships: [
          {
            foreignKeyName: "matchmaking_queue_player_id_fkey"
            columns: ["player_id"]
            isOneToOne: true
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_internals: {
        Row: {
          created_at: string
          id: string
          ipn_callback_url: string | null
          order_id: string
          pay_address: string | null
          payment_id: string
          transaction_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          ipn_callback_url?: string | null
          order_id: string
          pay_address?: string | null
          payment_id: string
          transaction_id: string
        }
        Update: {
          created_at?: string
          id?: string
          ipn_callback_url?: string | null
          order_id?: string
          pay_address?: string | null
          payment_id?: string
          transaction_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_internals_transaction_id_fkey"
            columns: ["transaction_id"]
            isOneToOne: false
            referencedRelation: "crypto_transactions"
            referencedColumns: ["id"]
          },
        ]
      }
      players: {
        Row: {
          created_at: string
          credits: number
          id: string
          last_active: string
          name: string
          user_id: string
        }
        Insert: {
          created_at?: string
          credits?: number
          id?: string
          last_active?: string
          name: string
          user_id: string
        }
        Update: {
          created_at?: string
          credits?: number
          id?: string
          last_active?: string
          name?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          display_name: string | null
          email: string | null
          id: string
          skilled_coins: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          skilled_coins?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string | null
          id?: string
          skilled_coins?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      clean_stale_queue_entries: { Args: never; Returns: undefined }
      end_game_and_transfer_credits: {
        Args: { p_game_id: string; p_reason: string; p_winner_id: string }
        Returns: undefined
      }
      get_opponent_name: { Args: { p_player_id: string }; Returns: string }
      get_or_create_free_plays: {
        Args: { p_game_slug: string; p_user_id: string }
        Returns: number
      }
      get_player_for_game: {
        Args: { p_player_id: string }
        Returns: {
          credits: number
          id: string
          name: string
        }[]
      }
      get_player_id_for_user: { Args: { _user_id: string }; Returns: string }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_game_participant: {
        Args: { _game_id: string; _user_id: string }
        Returns: boolean
      }
      is_privileged_user: { Args: { _user_id: string }; Returns: boolean }
      settle_game: {
        Args: { p_game_id: string; p_reason: string; p_winner_id: string }
        Returns: Json
      }
      update_player_credits: {
        Args: { p_credit_change: number; p_player_id: string }
        Returns: undefined
      }
      use_free_play: {
        Args: { p_game_slug: string; p_user_id: string }
        Returns: {
          message: string
          plays_remaining: number
          success: boolean
        }[]
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
