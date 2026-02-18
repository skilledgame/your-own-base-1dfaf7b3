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
      active_searches: {
        Row: {
          created_at: string
          display_name: string | null
          game_type: string
          id: string
          user_id: string
          wager: number
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          game_type?: string
          id?: string
          user_id: string
          wager: number
        }
        Update: {
          created_at?: string
          display_name?: string | null
          game_type?: string
          id?: string
          user_id?: string
          wager?: number
        }
        Relationships: []
      }
      active_visitors: {
        Row: {
          id: string
          last_seen_at: string
          page_path: string | null
          session_id: string
          user_id: string | null
        }
        Insert: {
          id?: string
          last_seen_at?: string
          page_path?: string | null
          session_id: string
          user_id?: string | null
        }
        Update: {
          id?: string
          last_seen_at?: string
          page_path?: string | null
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      clan_members: {
        Row: {
          clan_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          clan_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          clan_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clan_members_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      clans: {
        Row: {
          badge_url: string | null
          created_at: string
          description: string | null
          id: string
          leader_id: string
          member_count: number
          name: string
          total_trophies: number
        }
        Insert: {
          badge_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          leader_id: string
          member_count?: number
          name: string
          total_trophies?: number
        }
        Update: {
          badge_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          leader_id?: string
          member_count?: number
          name?: string
          total_trophies?: number
        }
        Relationships: []
      }
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
      friend_requests: {
        Row: {
          created_at: string
          id: string
          receiver_id: string
          sender_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          receiver_id: string
          sender_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          receiver_id?: string
          sender_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      friendships: {
        Row: {
          created_at: string
          friend_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          id?: string
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
          settlement_id: string | null
          settlement_tx_id: string | null
          status: string
          updated_at: string
          wager: number
          wager_locked_at: string | null
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
          settlement_id?: string | null
          settlement_tx_id?: string | null
          status?: string
          updated_at?: string
          wager: number
          wager_locked_at?: string | null
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
          settlement_id?: string | null
          settlement_tx_id?: string | null
          status?: string
          updated_at?: string
          wager?: number
          wager_locked_at?: string | null
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
      messages: {
        Row: {
          channel_id: string
          channel_type: string
          content: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          channel_id: string
          channel_type: string
          content: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          channel_id?: string
          channel_type?: string
          content?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          action_taken: boolean
          created_at: string
          id: string
          message: string
          metadata: Json | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          action_taken?: boolean
          created_at?: string
          id?: string
          message: string
          metadata?: Json | null
          read?: boolean
          title: string
          type?: string
          user_id: string
        }
        Update: {
          action_taken?: boolean
          created_at?: string
          id?: string
          message?: string
          metadata?: Json | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      page_views: {
        Row: {
          created_at: string
          id: string
          page_path: string
          session_id: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          page_path: string
          session_id: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          page_path?: string
          session_id?: string
          user_id?: string | null
        }
        Relationships: []
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
      preorders: {
        Row: {
          amount_usd: number
          bonus_credits: number
          created_at: string
          credited_at: string | null
          crypto_currency: string
          email: string
          id: string
          order_id: string | null
          payment_id: string | null
          status: string | null
        }
        Insert: {
          amount_usd: number
          bonus_credits: number
          created_at?: string
          credited_at?: string | null
          crypto_currency: string
          email: string
          id?: string
          order_id?: string | null
          payment_id?: string | null
          status?: string | null
        }
        Update: {
          amount_usd?: number
          bonus_credits?: number
          created_at?: string
          credited_at?: string | null
          crypto_currency?: string
          email?: string
          id?: string
          order_id?: string | null
          payment_id?: string | null
          status?: string | null
        }
        Relationships: []
      }
      private_rooms: {
        Row: {
          code: string
          created_at: string
          creator_id: string
          creator_ready: boolean
          currency: string
          expires_at: string
          game_id: string | null
          id: string
          joiner_id: string | null
          joiner_ready: boolean
          status: string
          wager: number
        }
        Insert: {
          code: string
          created_at?: string
          creator_id: string
          creator_ready?: boolean
          currency?: string
          expires_at?: string
          game_id?: string | null
          id?: string
          joiner_id?: string | null
          joiner_ready?: boolean
          status?: string
          wager: number
        }
        Update: {
          code?: string
          created_at?: string
          creator_id?: string
          creator_ready?: boolean
          currency?: string
          expires_at?: string
          game_id?: string | null
          id?: string
          joiner_id?: string | null
          joiner_ready?: boolean
          status?: string
          wager?: number
        }
        Relationships: [
          {
            foreignKeyName: "private_rooms_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          chess_elo: number
          clan_id: string | null
          created_at: string
          daily_play_streak: number
          display_name: string | null
          display_name_changed_at: string | null
          email: string | null
          id: string
          last_played_date: string | null
          skilled_coins: number
          skin_color: string
          skin_icon: string
          total_wagered_sc: number
          updated_at: string
          user_id: string
        }
        Insert: {
          chess_elo?: number
          clan_id?: string | null
          created_at?: string
          daily_play_streak?: number
          display_name?: string | null
          display_name_changed_at?: string | null
          email?: string | null
          id?: string
          last_played_date?: string | null
          skilled_coins?: number
          skin_color?: string
          skin_icon?: string
          total_wagered_sc?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          chess_elo?: number
          clan_id?: string | null
          created_at?: string
          daily_play_streak?: number
          display_name?: string | null
          display_name_changed_at?: string | null
          email?: string | null
          id?: string
          last_played_date?: string | null
          skilled_coins?: number
          skin_color?: string
          skin_icon?: string
          total_wagered_sc?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_clan_id_fkey"
            columns: ["clan_id"]
            isOneToOne: false
            referencedRelation: "clans"
            referencedColumns: ["id"]
          },
        ]
      }
      rank_config: {
        Row: {
          display_name: string
          id: string
          perks: string[]
          rakeback_percentage: number
          sort_order: number
          threshold: number
          tier_name: string
          updated_at: string | null
        }
        Insert: {
          display_name: string
          id?: string
          perks?: string[]
          rakeback_percentage?: number
          sort_order?: number
          threshold?: number
          tier_name: string
          updated_at?: string | null
        }
        Update: {
          display_name?: string
          id?: string
          perks?: string[]
          rakeback_percentage?: number
          sort_order?: number
          threshold?: number
          tier_name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      site_content: {
        Row: {
          content: string
          id: string
          slug: string
          title: string
          updated_at: string | null
          updated_by: string | null
        }
        Insert: {
          content?: string
          id?: string
          slug: string
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Update: {
          content?: string
          id?: string
          slug?: string
          title?: string
          updated_at?: string | null
          updated_by?: string | null
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge: string
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          badge: string
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          badge?: string
          created_at?: string
          id?: string
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
      wagers: {
        Row: {
          created_at: string
          game_id: string
          id: string
          user_id: string
          wager_amount: number
          wager_locked_at: string
        }
        Insert: {
          created_at?: string
          game_id: string
          id?: string
          user_id: string
          wager_amount: number
          wager_locked_at?: string
        }
        Update: {
          created_at?: string
          game_id?: string
          id?: string
          user_id?: string
          wager_amount?: number
          wager_locked_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "wagers_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
      waitlist: {
        Row: {
          created_at: string
          email: string
          id: string
          notified: boolean | null
          source: string | null
          verified: boolean | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          notified?: boolean | null
          source?: string | null
          verified?: boolean | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          notified?: boolean | null
          source?: string | null
          verified?: boolean | null
        }
        Relationships: []
      }
      withdrawals: {
        Row: {
          admin_note: string | null
          amount_sc: number
          amount_usd: number
          created_at: string
          crypto_currency: string
          id: string
          payout_hash: string | null
          payout_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: string
          updated_at: string
          user_id: string
          wallet_address: string
        }
        Insert: {
          admin_note?: string | null
          amount_sc: number
          amount_usd: number
          created_at?: string
          crypto_currency: string
          id?: string
          payout_hash?: string | null
          payout_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id: string
          wallet_address: string
        }
        Update: {
          admin_note?: string | null
          amount_sc?: number
          amount_usd?: number
          created_at?: string
          crypto_currency?: string
          id?: string
          payout_hash?: string | null
          payout_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          wallet_address?: string
        }
        Relationships: []
      }
    }
    Views: {
      user_wager_history: {
        Row: {
          created_at: string | null
          game_id: string | null
          game_status: string | null
          id: string | null
          result: string | null
          user_id: string | null
          wager_amount: number | null
          wager_locked_at: string | null
          winner_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "games_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "players"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "wagers_game_id_fkey"
            columns: ["game_id"]
            isOneToOne: false
            referencedRelation: "games"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_friend_request: {
        Args: { request_id: string }
        Returns: undefined
      }
      cancel_private_room: { Args: { p_room_id: string }; Returns: Json }
      clean_stale_queue_entries: { Args: never; Returns: undefined }
      clean_stale_searches: { Args: never; Returns: undefined }
      clean_stale_visitors: { Args: never; Returns: undefined }
      create_clan: {
        Args: { p_description?: string; p_name: string }
        Returns: string
      }
      create_private_room: { Args: { p_wager: number }; Returns: Json }
      decline_friend_request: {
        Args: { request_id: string }
        Returns: undefined
      }
      end_game_and_transfer_credits: {
        Args: { p_game_id: string; p_reason: string; p_winner_id: string }
        Returns: undefined
      }
      get_clan_leaderboard: {
        Args: never
        Returns: {
          clan_id: string
          clan_name: string
          description: string
          leader_name: string
          member_count: number
          rank: number
          total_trophies: number
        }[]
      }
      get_display_name_from_player_id: {
        Args: { p_player_id: string }
        Returns: string
      }
      get_friends_list: {
        Args: never
        Returns: {
          chess_elo: number
          clan_name: string
          display_name: string
          friend_user_id: string
        }[]
      }
      get_opponent_name: { Args: { p_player_id: string }; Returns: string }
      get_opponent_profile: {
        Args: { p_game_id: string }
        Returns: {
          chess_elo: number
          daily_play_streak: number
          display_name: string
          opponent_user_id: string
          total_wagered_sc: number
        }[]
      }
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
      get_room_details: { Args: { p_room_id: string }; Returns: Json }
      get_user_badges: { Args: { p_user_id: string }; Returns: string[] }
      get_user_role: { Args: { _user_id: string }; Returns: string }
      get_waitlist_count: { Args: never; Returns: number }
      get_waitlist_emails: {
        Args: { filter_type?: string }
        Returns: {
          email: string
          id: string
        }[]
      }
      get_weekly_leaderboard: {
        Args: never
        Returns: {
          games_won: number
          player_name: string
          rank: number
          total_won: number
          user_id: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invite_friend_to_game: {
        Args: { friend_user_id: string; game_id: string }
        Returns: undefined
      }
      is_game_participant: {
        Args: { _game_id: string; _user_id: string }
        Returns: boolean
      }
      is_privileged_user: { Args: { _user_id: string }; Returns: boolean }
      join_clan: { Args: { p_clan_id: string }; Returns: undefined }
      join_private_room: { Args: { p_code: string }; Returns: Json }
      join_waitlist: { Args: { user_email: string }; Returns: Json }
      leave_clan: { Args: never; Returns: undefined }
      lock_wager: { Args: { p_game_id: string }; Returns: Json }
      mark_waitlist_notified: {
        Args: { entry_ids: string[] }
        Returns: undefined
      }
      record_preorder:
        | {
            Args: {
              p_amount_usd: number
              p_bonus_credits: number
              p_crypto_currency: string
              p_email: string
              p_payment_id?: string
            }
            Returns: Json
          }
        | {
            Args: {
              p_amount_usd: number
              p_bonus_credits: number
              p_crypto_currency: string
              p_email: string
              p_order_id?: string
              p_payment_id?: string
            }
            Returns: Json
          }
      remove_friend: { Args: { target_user_id: string }; Returns: undefined }
      resolve_player_user_id: { Args: { p_player_id: string }; Returns: string }
      search_users: {
        Args: { query: string }
        Returns: {
          chess_elo: number
          clan_name: string
          display_name: string
          user_id: string
        }[]
      }
      send_friend_request: { Args: { target_user_id: string }; Returns: string }
      settle_game: {
        Args: { p_game_id: string; p_reason: string; p_winner_id: string }
        Returns: Json
      }
      settle_match: {
        Args: { p_game_id: string; p_winner_user_id: string }
        Returns: Json
      }
      start_private_game: { Args: { p_room_id: string }; Returns: Json }
      toggle_ready: { Args: { p_room_id: string }; Returns: Json }
      update_clan_trophies: { Args: never; Returns: undefined }
      update_elo_after_game: {
        Args: { p_game_id: string; p_winner_user_id?: string }
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
