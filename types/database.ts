/**
 * Supabase スキーマから自動生成した型定義
 *
 * 生成コマンド（Supabase MCP）：generate_typescript_types
 * DBスキーマを変更したら必ず再生成すること。手で編集しない。
 *
 * この型を Supabase クライアントのジェネリクスに渡すことで、
 * .from('faqs').select() の戻り値に列の型が付き、
 * 列名のタイプミスや型の取り違えがビルド時に落ちるようになる。
 *
 * 業務ロジック用の型（FAQ / Conversation など）は /types/index.ts が正。
 * こちらはDBの生の形をそのまま写したもの。
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.5';
  };
  public: {
    Tables: {
      business_settings: {
        Row: {
          closed_weekdays: number[];
          holiday_dates: string[];
          hours_end: number;
          hours_start: number;
          id: string;
          is_open_today: boolean;
          timezone: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          closed_weekdays?: number[];
          holiday_dates?: string[];
          hours_end?: number;
          hours_start?: number;
          id?: string;
          is_open_today?: boolean;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          closed_weekdays?: number[];
          holiday_dates?: string[];
          hours_end?: number;
          hours_start?: number;
          id?: string;
          is_open_today?: boolean;
          timezone?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          assigned_operator_id: string | null;
          category: string | null;
          created_at: string;
          customer_user_id: string;
          id: string;
          pending_handoff: boolean;
          status: string;
          updated_at: string;
        };
        Insert: {
          assigned_operator_id?: string | null;
          category?: string | null;
          created_at?: string;
          customer_user_id: string;
          id?: string;
          pending_handoff?: boolean;
          status?: string;
          updated_at?: string;
        };
        Update: {
          assigned_operator_id?: string | null;
          category?: string | null;
          created_at?: string;
          customer_user_id?: string;
          id?: string;
          pending_handoff?: boolean;
          status?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      faqs: {
        Row: {
          answer: string;
          category: string;
          created_at: string;
          id: string;
          is_active: boolean;
          question: string;
          updated_at: string;
        };
        Insert: {
          answer: string;
          category: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          question: string;
          updated_at?: string;
        };
        Update: {
          answer?: string;
          category?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          question?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          content: string;
          conversation_id: string;
          created_at: string;
          id: string;
          sender_id: string | null;
          sender_type: string;
        };
        Insert: {
          content: string;
          conversation_id: string;
          created_at?: string;
          id?: string;
          sender_id?: string | null;
          sender_type: string;
        };
        Update: {
          content?: string;
          conversation_id?: string;
          created_at?: string;
          id?: string;
          sender_id?: string | null;
          sender_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'messages_conversation_id_fkey';
            columns: ['conversation_id'];
            isOneToOne: false;
            referencedRelation: 'conversations';
            referencedColumns: ['id'];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
