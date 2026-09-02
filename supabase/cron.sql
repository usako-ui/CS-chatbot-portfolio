-- ============================================================
-- 放置された会話の自動クローズ（定期実行）
--
-- AIだけで完結した会話（ai_handling）は、顧客が黙って離脱しても
-- 誰も閉じないため一覧に残り続ける。一覧が埋まると
-- 本当に対応が必要な問い合わせが埋もれる。
--
-- 【waiting_operator を対象にしない理由】
-- 人間の対応待ちを機械的に閉じると、対応漏れが「無かったこと」になる。
-- 放置は自動クローズではなく、管理画面の色分けとバッジで気づかせる。
--
-- 【選択待ち（pending_handoff）に猶予を与える理由】
-- 「担当者へつなぐ／続けて質問する」の選択肢を出したまま24時間で閉じると、
-- 顧客が戻ってきたときに選択肢ごと消えている。72時間まで待つ。
-- ただし期限なしで除外すると永久に滞留するため打ち切りは設ける。
--
-- 実行方法：Supabase の SQL Editor にこのファイルを貼り付けて実行する。
-- 本番環境でのみ必要。ローカル開発では設定しなくても動く。
-- ============================================================

-- pg_cron 拡張（Supabase では Dashboard > Database > Extensions からでも有効化できる）
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- ------------------------------------------------------------
-- 自動クローズ本体
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION private.close_stale_ai_conversations()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  closed_count INTEGER;
BEGIN
  WITH stale AS (
    SELECT c.id
    FROM public.conversations c
    -- 最終メッセージの時刻を基準にする。
    -- conversations.updated_at はステータス変更でも動くため、
    -- 「会話が止まってから何時間」を正しく測れない。
    CROSS JOIN LATERAL (
      SELECT COALESCE(
               (SELECT max(m.created_at) FROM public.messages m
                 WHERE m.conversation_id = c.id),
               c.created_at
             ) AS last_activity
    ) a
    WHERE c.status = 'ai_handling'
      AND a.last_activity < NOW() - INTERVAL '24 hours'
      -- 顧客の選択待ちは猶予を延ばす（選択肢ごと消えるのを防ぐため）。
      -- ただし期限なしで除外すると永久に滞留するので 72 時間で打ち切る。
      AND (
        c.pending_handoff = FALSE
        OR a.last_activity < NOW() - INTERVAL '72 hours'
      )
  )
  UPDATE public.conversations c
     SET status = 'closed',
         -- 選択待ちのまま閉じる場合があるのでフラグも落とす
         pending_handoff = FALSE
    FROM stale
   WHERE c.id = stale.id;

  GET DIAGNOSTICS closed_count = ROW_COUNT;
  RETURN closed_count;
END;
$function$;

-- ------------------------------------------------------------
-- 毎時0分に実行する
-- ------------------------------------------------------------
SELECT cron.schedule(
  'close-stale-ai-conversations',
  '0 * * * *',
  $$SELECT private.close_stale_ai_conversations()$$
);

-- ------------------------------------------------------------
-- 確認：登録されたか
-- ------------------------------------------------------------
-- SELECT jobname, schedule, command, active FROM cron.job;

-- 解除する場合
-- SELECT cron.unschedule('close-stale-ai-conversations');
