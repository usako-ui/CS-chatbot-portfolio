# requirements.md
# CSチャットボット MVP 機能・非機能要件

> このファイルは実装時に参照する要件定義書です。
> 詳細な背景・業務フロー・トレーサビリティは `project-overview.md` を参照してください。

---

## ⚠️ 最重要：スコープ管理ルール

実装前に必ず確認すること。

```
【MVPに含む】 → 実装対象
【Phase 2】   → 絶対に実装しない
【要確認】    → 勝手に仕様確定せず実装前に確認を取る
```

### Phase 2（今回絶対に実装しない）

- Shopify 在庫・配送のリアルタイム照会
- 感情分析
- 分析ダッシュボード・週次レポート
- 返信テンプレート機能
- 商品レコメンド機能
- 高度なUIカスタマイズ（フォント・カラーパレット精緻化）
- FAQ編集・CSV一括インポート（追加・有効/無効切替のみMVP）
- Slack・メール・LINE 外部通知連携
- 会話データの自動削除

---

## 設計決定ログ

> 設計レビューで検出した仕様矛盾3件と、その解決方針。
> 本ファイルの該当箇所はすべてこの決定に沿って改訂済み。

| # | 論点 | 決定 | 主な影響箇所 |
|---|---|---|---|
| 決定① | RLS と Realtime が両立しない（当初の RLS 案は顧客に JWT がなく常に NULL 判定になり、ポリシーが機能しない） | Supabase 匿名サインインで顧客にも JWT を発行し、`auth.uid()` で識別する。`customer_session_id TEXT` を `customer_user_id UUID` に置換。オペレーターと匿名顧客は `is_anonymous` クレームで区別 | DBスキーマ / RLS / Auth / Realtime / 型定義 |
| 決定② | ブランチ戦略 | Git worktree による並列開発。ただしバックエンド（DB・RLS・Server Action・型定義）が完成するまでフロントエンドには着手しない | 開発プロセス |
| 決定③ | 歓迎メッセージの絵文字がコーディング規約と矛盾 | 絵文字を削除し SVG 線アイコンに統一 | FR-CUS-010 / 会話フロー |

**決定①に伴って判明した重大な注意点（実装前に必読）：**

1. **匿名サインインユーザーの Postgres ロールは `anon` ではなく `authenticated`。**
   旧仕様の `auth.role() = 'authenticated'` をオペレーター判定に使うと匿名顧客に全権限が渡る。
   → `is_operator()` ヘルパー関数（`is_anonymous` クレーム判定）を必ず使う。
2. **Server Action は引数の `userId` を信用してはいけない。**
   Cookie の匿名 JWT を `auth.getUser()` で検証して UID を得る。
   → そのためセッション保存先を localStorage ではなく **Cookie** にする（`@supabase/ssr` を使う）。

詳細は「認証・権限要件（AUTH / RLS）」および「Server Action での顧客ID確定方法」を参照。

---

## 技術スタック

| レイヤー | 採用技術 |
|---|---|
| フレームワーク | Next.js 14（App Router） |
| DB / Auth / Realtime / RLS | Supabase |
| AI API（検証環境） | Gemini 2.5 Flash（無料枠） |
| デプロイ | Vercel |
| チャットUI | React コンポーネント（ECサイト埋め込み型） |

> **Gemini APIは今回の検証環境のみ。** 本番移行時はデータ送信ポリシー・コスト・精度を再評価して最終構成を決定する。

---

## 機能要件

### 1. 顧客側チャット機能（FR-CUS）

| 要件ID | 機能名 | 要件内容 |
|---|---|---|
| FR-CUS-001 | ウィジェット起動 | ECサイト右下の固定ボタンをクリックするとチャット画面が表示される |
| FR-CUS-002 | メッセージ送信 | 顧客がテキストを入力して送信できる |
| FR-CUS-003 | AI回答表示 | AIの回答が吹き出し形式で時系列表示される |
| FR-CUS-004 | AI処理中表示 | AI応答待ち中にローディング（タイピングインジケーター等）を表示する |
| FR-CUS-005 | エスカレーション通知 | オペレーター引き継ぎ時に「担当者に引き継ぎました」等のシステムメッセージを表示する |
| FR-CUS-006 | 営業時間外表示 | 時間外は「現在は営業時間外です。翌営業日（10:00以降）に担当者が対応します。」を表示する |
| FR-CUS-007 | 会話履歴表示 | 同セッション内の過去メッセージを表示する |
| FR-CUS-008 | 送信失敗表示 | 送信エラー時に「送信に失敗しました。もう一度お試しください」を表示する |
| FR-CUS-009 | 送信者の視覚的区別 | 顧客・AI・オペレーターのメッセージを色・配置で区別する |
| FR-CUS-010 | 初期メッセージ | ウィジェット起動時にBOTANICAからの歓迎メッセージを自動表示する |
| FR-CUS-011 | 基本ブランドUI | BOTANICAのブランドカラー・ロゴを反映した基本スタイルを適用する |
| FR-CUS-012 | スマートフォン対応 | レスポンシブデザイン。iOS Safari・Android Chromeで正常動作する |

---

### 2. オペレーター管理画面機能（FR-OPS）

| 要件ID | 機能名 | 要件内容 |
|---|---|---|
| FR-OPS-001 | ログイン | Supabase Auth（メール・パスワード）で認証後に管理画面へアクセスできる |
| FR-OPS-002 | ログアウト | セッションを終了できる |
| FR-OPS-003 | 問い合わせ一覧 | 全会話をステータス別（AI対応中・オペレーター待機・対応中・完了）で一覧表示する |
| FR-OPS-004 | 新着・ESC通知 | エスカレーション発生時にリアルタイムで一覧に反映・視覚的通知を表示する |
| FR-OPS-005 | 会話詳細表示 | 選択した会話の全メッセージ（顧客・AI・オペレーター）を時系列で表示する |
| FR-OPS-006 | 返信送信 | テキストを入力して顧客へ返信できる。送信後リアルタイムで顧客画面に反映される |
| FR-OPS-007 | ステータス更新 | 会話ステータスを「対応中（operator_handling）」「完了（closed）」に変更できる |
| FR-OPS-008 | リアルタイム更新 | 顧客の新着メッセージ・エスカレーションが即時反映される（5秒以内） |
| FR-OPS-009 | 2名同時利用 | フルタイム1名・パート1名の2名が同時に管理画面を使用できる |
| FR-OPS-010 | 営業時間設定 | 管理画面の設定ページで営業開始時刻・終了時刻を変更できる |
| FR-OPS-011 | 定休曜日設定 | 管理画面の設定ページで定休曜日（複数選択可）を登録・変更できる |
| FR-OPS-012 | 休日登録 | 管理画面の設定ページで特定日（祝日・年末年始等）を休日として登録・削除できる |
| FR-OPS-013 | 当日対応フラグ | 管理画面のヘッダー等から「本日対応中 / 本日休業」をワンタップで切り替えられる |

---

### 3. AI要件（AI）

| 要件ID | 要件内容 | 詳細 |
|---|---|---|
| AI-001 | FAQ検索 | 顧客の質問に対してfaqsテーブルからセマンティック検索またはキーワード検索で関連FAQを取得する |
| AI-002 | FAQ根拠による回答生成 | FAQの内容を根拠として回答を生成する。FAQに記載のない事実は絶対に回答に含めない |
| AI-003 | 回答不能の判定 | FAQ内に根拠がない場合、無理に回答せずエスカレーション判定（escalate: true）を返す |
| AI-004 | クレーム・お怒りトーン検出 | 怒り・不満のトーンを検出し、即時エスカレーション判定を返す |
| AI-005 | ハルシネーション抑制 | システムプロンプトにてFAQ外の事実を生成しないよう明示的に指示する |
| AI-006 | 無関係質問への対応 | BOTANICAと無関係な質問（株価・政治等）には「その質問にはお答えできません」と返す |
| AI-007 | 回答トーン | 丁寧・親切なカスタマーサポートのトーンで回答する |
| AI-008 | 回答の禁止事項 | ①FAQ外の事実の断言 ②競合他社への言及 ③法的・医療的アドバイス ④個人情報への言及 |
| AI-009 | AIエラー時のフォールバック | Gemini APIエラー・タイムアウト時は即時エスカレーションへ切り替える |
| AI-010 | エスカレーション判定の出力形式 | AIレスポンスに `{ "escalate": true/false, "reason": "..." }` を含める形式で実装する |

**AIシステムプロンプトに必ず含める要素：**

```
1. あなたはBOTANICA（自然派スキンケアEC）のカスタマーサポートAIです
2. 以下のFAQのみを根拠として回答してください
3. FAQに根拠がない質問には回答せず、{"escalate": true, "reason": "FAQ外"}を返してください
4. クレーム・お怒り・個別交渉・注文変更・不具合には {"escalate": true, "reason": "人間対応必須"} を返してください
5. FAQ外の事実をでっちあげてはいけません
6. 競合他社・法的・医療的アドバイスは禁止です
```

---

### 4. エスカレーション要件

**エスカレーション条件と動作：**

| 条件 | 即時/判定 | 営業時間内 | 営業時間外 | 顧客表示メッセージ |
|---|---|---|---|---|
| FAQに回答がない | 判定 | 即時オペレーター通知 | 翌営業日対応・ステータス保持 | 「担当者に確認します。しばらくお待ちください」 |
| クレーム・お怒りのトーン | 即時 | 即時オペレーター通知 | 翌営業日対応・ステータス保持 | 「担当者がご対応します」 |
| 個別返品・交換交渉 | 即時 | 即時オペレーター通知 | 翌営業日対応・ステータス保持 | 「担当者がご対応します」 |
| 注文変更・キャンセル | 即時 | 即時オペレーター通知 | 翌営業日対応・ステータス保持 | 「担当者がご対応します」 |
| 商品不具合・破損 | 即時 | 即時オペレーター通知 | 翌営業日対応・ステータス保持 | 「担当者がご対応します」 |
| 個人情報変更 | 即時 | 即時オペレーター通知 | 翌営業日対応・ステータス保持 | 「担当者がご対応します」 |
| AIエラー | 即時 | 即時エスカレーション | 即時エスカレーション | 「担当者に接続しています」 |

**エスカレーション後の状態管理：**

- エスカレーション後はAIの自動回答を停止する（ステータスが `ai_handling` 以外ならAI応答しない）
- オペレーターはエスカレーション前のAIとの会話履歴をすべて確認できる
- 担当オペレーターの割り当て方法：**最初に返信したOPSが自動で担当者になる**（assigned_operator_idに自動セット）

**会話ステータスの遷移：**

```
ai_handling           → AI自動応答中（初期状態）
  ↓ エスカレーション
waiting_operator      → オペレーター待機中
  ↓ オペレーターが対応開始
operator_handling     → オペレーター対応中
  ↓ 対応完了
closed                → 会話終了
```

---

### 5. 営業時間要件（FR-TIME）

| 要件ID | 要件 | 仕様 |
|---|---|---|
| FR-TIME-001 | 営業時間 | DBの営業設定（初期値10:00〜18:00 JST）をサーバー側で参照して判定する |
| FR-TIME-002 | 時間内ESC | オペレーターへ即時通知。conversationステータスを `waiting_operator` に変更 |
| FR-TIME-003 | 時間外・休日ESC | 即時オペレーター通知はしない。ステータスを `waiting_operator` で保持。翌営業日に対応 |
| FR-TIME-004 | 時間外・休日の顧客表示 | 「現在は営業時間外です。翌営業日（10:00以降）に担当者が対応します。」と表示する |
| FR-TIME-005 | 休日・定休日の扱い | 管理画面の営業設定で登録した休日・定休曜日は営業時間外と同一の動作をする |
| FR-TIME-006 | 営業設定のDB管理 | 営業時間（開始・終了）・定休曜日・休日一覧を `business_settings` テーブルで管理する |
| FR-TIME-007 | 当日の対応可否フラグ | オペレーターが当日の対応可否を手動で切り替えられる（臨時休業・早退等に対応） |

---

## データ要件（DR）

### DBスキーマ

#### conversations テーブル

```sql
CREATE TABLE conversations (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_user_id     UUID NOT NULL REFERENCES auth.users(id),
                                            -- 匿名サインインで発行された auth.uid()
                                            -- RLS の識別キー（旧 customer_session_id を置換）
  status               TEXT NOT NULL DEFAULT 'ai_handling',
                                            -- ai_handling / waiting_operator
                                            -- operator_handling / closed
  assigned_operator_id UUID REFERENCES auth.users(id),  -- NULLは未割当
  category             TEXT,               -- 在庫/配送/返品/商品/その他
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS の customer_user_id = auth.uid() を毎行スキャンさせないためのインデックス（必須）
CREATE INDEX idx_conversations_customer_user_id ON conversations(customer_user_id);
CREATE INDEX idx_conversations_status          ON conversations(status);
```

> **【決定①により変更】** `customer_session_id TEXT` を `customer_user_id UUID` に置換した。
> 顧客は Supabase 匿名サインイン（Anonymous Sign-in）で JWT を取得するため、
> 識別子は `auth.uid()` に一本化する。独自の session_id は廃止。

#### messages テーブル

```sql
CREATE TABLE messages (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id  UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_type      TEXT NOT NULL,          -- customer / ai / operator
  sender_id        UUID,                   -- operatorのみ。customer・aiはNULL
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Realtime購読時のRLSサブクエリと履歴取得で使用（必須）
CREATE INDEX idx_messages_conversation_id_created_at
  ON messages(conversation_id, created_at);
```

#### business_settings テーブル

```sql
CREATE TABLE business_settings (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hours_start         SMALLINT NOT NULL DEFAULT 10,  -- 営業開始時刻（時）
  hours_end           SMALLINT NOT NULL DEFAULT 18,  -- 営業終了時刻（時）
  closed_weekdays     SMALLINT[] NOT NULL DEFAULT '{}',
                                                     -- 定休曜日 0=日〜6=土の配列
                                                     -- 例：[0,6] → 土日定休
  holiday_dates       DATE[] NOT NULL DEFAULT '{}',  -- 特定休日の日付リスト
  is_open_today       BOOLEAN NOT NULL DEFAULT TRUE, -- 当日の手動フラグ（臨時休業等）
  timezone            TEXT NOT NULL DEFAULT 'Asia/Tokyo',
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by          UUID REFERENCES auth.users(id) -- 最後に更新したオペレーター
);

-- 初期データ（1レコードのみ。複数行にしない）
INSERT INTO business_settings (hours_start, hours_end, closed_weekdays)
VALUES (10, 18, '{0}');  -- 初期値：10〜18時・日曜定休
```

> **判定ロジック：** 以下のいずれかに該当する場合を「営業時間外」とする
> 1. 現在時刻が `hours_start` 未満 または `hours_end` 以上
> 2. 現在の曜日が `closed_weekdays` に含まれる
> 3. 現在の日付が `holiday_dates` に含まれる
> 4. `is_open_today` が `FALSE`（手動フラグ）

#### faqs テーブル

```sql
CREATE TABLE faqs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category   TEXT NOT NULL,               -- 在庫/配送/返品/商品/その他
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  is_active  BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## 認証・権限要件（AUTH / RLS）

### Supabase Auth の使い分け

| ユーザー種別 | 認証方式 | Postgres ロール | `is_anonymous` クレーム | 識別子 |
|---|---|---|---|---|
| オペレーター（2名） | Supabase Auth（メール・パスワード） | `authenticated` | `false` | `auth.uid()` |
| 顧客（エンドカスタマー） | **Supabase 匿名サインイン（Anonymous Sign-in）** | **`authenticated`** | **`true`** | `auth.uid()` |

> **⚠️ 最重要（誤りやすい点）：**
> 匿名サインインしたユーザーの Postgres ロールは **`anon` ではなく `authenticated`** になる。
> `anon` ロールは「JWT を一切持たない未サインイン状態」を指す別物。
> したがって **`auth.role() = 'authenticated'` だけでオペレーター判定をしてはいけない。**
> それをすると匿名顧客が全顧客の会話を読み書きできてしまい、AC-012 が即不合格になる。
> オペレーター判定は必ず `is_anonymous` クレームを併用すること。

> **A案採用（確定）：** 顧客にも Supabase 匿名サインインで JWT を発行する。
> これにより RLS が正常に機能し、AC-008（Realtime）と AC-012（RLS）が両立する。
> 匿名ユーザーは `auth.uid()` で識別できるため、独自の Session ID は不要になる。

**必須の事前設定：** Supabase ダッシュボード → Authentication → Providers → **Anonymous を有効化**する。
未設定だと `signInAnonymously()` が 422 エラーを返し、顧客側が一切動作しない。**基盤構築フェーズの最初の手順として実施する。**

### 顧客の匿名サインイン実装方針

```typescript
// ウィジェット起動時に匿名サインインを実行（lib/session.ts）
// 既存セッションがあれば再利用し、なければ新規に匿名サインインする
export async function ensureAnonymousSession(): Promise<string> {
  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) return session.user.id;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user) throw new Error('匿名サインインに失敗しました');
  return data.user.id;
}
// → JWT が発行され auth.uid() が使える状態になる
// → セッションは Supabase SDK が localStorage に自動保存する
//    （キー：sb-<project-ref>-auth-token）。独自の botanica_session_id は廃止
```

- 顧客の UX 上は「認証不要」のまま（ログイン操作は一切発生しない）。
- 顧客の **DB 書き込みは引き続き Server Action（service_role）経由**。
  匿名 JWT は **読み取り（Realtime 購読・履歴取得）専用**として使う。

### RLSポリシー（A案：匿名サインイン前提・確定版）

```sql
-- ============================================================
-- 前提：全テーブルで RLS を有効化する（これを忘れるとポリシーは無意味）
-- ============================================================
ALTER TABLE conversations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages           ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs               ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_settings  ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- ヘルパー関数：オペレーター（＝非匿名の認証済みユーザー）判定
--   匿名顧客と確実に区別するための唯一の判定手段。
--   COALESCE の既定値を TRUE にして、クレーム欠落時は
--   「匿名扱い＝権限なし」に倒す（フェイルセーフ）。
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_operator()
RETURNS BOOLEAN
LANGUAGE SQL STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, TRUE) = FALSE
     AND auth.uid() IS NOT NULL;
$$;

-- ============================================================
-- conversations
-- ============================================================
-- 顧客（匿名）：自分の会話のみ閲覧可（SELECT限定）
--   書き込みは Server Action（service_role）経由なので INSERT/UPDATE ポリシーは作らない
CREATE POLICY "customer_select_own_conversation" ON conversations
  FOR SELECT TO authenticated
  USING (customer_user_id = (SELECT auth.uid()));

-- オペレーター：全件 閲覧・追加・更新・削除 可
CREATE POLICY "operator_all_conversations" ON conversations
  FOR ALL TO authenticated
  USING      (public.is_operator())
  WITH CHECK (public.is_operator());

-- ============================================================
-- messages
-- ============================================================
-- 顧客（匿名）：自分の会話のメッセージのみ閲覧可（Realtime購読の可否もこれで決まる）
CREATE POLICY "customer_select_own_messages" ON messages
  FOR SELECT TO authenticated
  USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE customer_user_id = (SELECT auth.uid())
    )
  );

-- オペレーター：全件 閲覧・追加・更新・削除 可
CREATE POLICY "operator_all_messages" ON messages
  FOR ALL TO authenticated
  USING      (public.is_operator())
  WITH CHECK (public.is_operator());

-- ============================================================
-- faqs：有効なFAQのみ全員読み取り可
--   （AIは service_role 経由で読むため RLS をバイパスする）
-- ============================================================
CREATE POLICY "faq_read_active" ON faqs
  FOR SELECT TO anon, authenticated
  USING (is_active = TRUE);

-- FAQの追加・有効/無効切替はオペレーターのみ
CREATE POLICY "operator_write_faqs" ON faqs
  FOR ALL TO authenticated
  USING      (public.is_operator())
  WITH CHECK (public.is_operator());

-- ============================================================
-- business_settings：オペレーターのみ全操作可。顧客は読めない
--   （営業時間判定は Server Action が service_role で行うため顧客の読み取りは不要）
-- ============================================================
CREATE POLICY "operator_all_business_settings" ON business_settings
  FOR ALL TO authenticated
  USING      (public.is_operator())
  WITH CHECK (public.is_operator());
```

**設計上のポイント（なぜこうするか）：**

1. **顧客向けポリシーは SELECT のみ。** INSERT / UPDATE ポリシーは作らない。
   理由：顧客の書き込みはすべて Server Action（service_role）経由で RLS をバイパスするため不要。
   ポリシーを作らない＝書き込み経路が1本に絞られ、攻撃面が最小になる。
2. **`(SELECT auth.uid())` とサブクエリで囲む。** PostgreSQL が行ごとに再評価せず
   1回だけ評価して定数化するため、インデックスが効き、行数が増えても遅くならない。
3. **`is_operator()` は `SECURITY DEFINER` + `SET search_path = ''`。**
   検索パス乗っ取り（悪意あるスキーマに同名関数を差し込む攻撃）を防ぐため。
4. **RLS ポリシーは OR 結合（permissive）。** 顧客用とオペレーター用が併存しても、
   どちらか片方を満たせば通る。「オペレーターは全件・顧客は自分の分だけ」が同時に成立する。

### Realtime の有効化（忘れると購読しても何も届かない）

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
```

> **⚠️ セキュリティ必須事項：**
> - Supabase ダッシュボードで「匿名サインイン（Anonymous Sign-in）」を有効化すること
> - RLS を **全テーブルで** 有効化すること（`get_advisors` で警告ゼロを確認）
> - 別ブラウザ（別の匿名ユーザー）で他顧客の会話が見えないことをテストで確認すること（AC-012）
> - オペレーターと匿名顧客を `is_operator()`（＝`is_anonymous` クレーム）で区別すること
> - **AC-012 の追加検証：** 匿名 JWT で `conversations` を全件 SELECT しても
>   自分の会話しか返らないこと（＝`is_operator()` を突破できないこと）を必ず確認する

---

## Realtime要件（FR-RT）

Supabase Realtime を使用。以下をリアルタイム購読する：

| 対象テーブル | イベント | 購読元 | 反映先 | 発火条件 |
|---|---|---|---|---|
| messages | INSERT | Realtimeサブスクリプション | 顧客チャットUI | 顧客・AI・オペレーターがメッセージを送信 |
| messages | INSERT | Realtimeサブスクリプション | オペレーター管理画面 | 顧客がメッセージを送信 |
| conversations | UPDATE | Realtimeサブスクリプション | オペレーター管理画面 | ステータス変更（エスカレーション等） |

**購読フィルター：**
- 顧客側：`conversation_id=eq.{自分のconversation_id}` でフィルター
- オペレーター側：全件購読（ステータス `waiting_operator` / `operator_handling` のもの）

---

## エラー・例外処理要件

| エラー種別 | 顧客への表示 | システム処理 |
|---|---|---|
| Gemini APIエラー | 「担当者に接続しています」 | 即時エスカレーション（waiting_operator） |
| AI回答タイムアウト | 「担当者に接続しています」 | 即時エスカレーション |
| DBエラー（保存失敗） | 「送信に失敗しました。もう一度お試しください」 | エラーログ記録・再送信可 |
| Realtime接続エラー | 「接続が切れました。再接続しています」 | 自動再接続を試みる |
| FAQ検索失敗 | 顧客には非表示 | エスカレーションへフォールバック |
| 営業時間判定エラー | 表示なし | 営業時間外として扱う（安全側）・ログ記録 |

---

## 非機能要件（NFR）

| 要件ID | カテゴリ | 要件内容 | 目標値 |
|---|---|---|---|
| NFR-001 | 応答速度 | AI回答の応答時間 | 平均10秒以内（Gemini API依存） |
| NFR-002 | 応答速度 | Realtime更新の遅延 | 5秒以内 |
| NFR-003 | 応答速度 | 管理画面の初期ロード | 3秒以内 |
| NFR-004 | 可用性 | システム稼働率 | 99%以上（Supabase・Vercel SLAに準拠） |
| NFR-005 | セキュリティ | APIキー管理 | 環境変数（`.env`）管理。ソースコードへの直書き禁止 |
| NFR-006 | セキュリティ | HTTPS通信 | 全通信をHTTPS化（Vercelデフォルト） |
| NFR-007 | 保守性 | コードコメント | 主要処理に日本語コメントを付与 |
| NFR-008 | 互換性 | ブラウザ対応 | Chrome・Safari最新版で正常動作 |
| NFR-009 | 互換性 | モバイル対応 | iOS Safari・Android Chromeで正常動作 |
| NFR-010 | 同時利用 | オペレーター2名同時利用 | 2名が同時に管理画面を使用しても正常動作 |

---

## スコープ外（Phase 2）

以下は今回のMVPで絶対に実装しないこと：

```
❌ Shopify在庫リアルタイム照会
❌ Shopify配送状況リアルタイム照会
❌ 感情分析
❌ 分析ダッシュボード
❌ 週次分析レポート
❌ 返信テンプレート機能
❌ 商品レコメンド機能
❌ 高度なUIアニメーション
❌ フォント・カラーパレット等の高度なブランドカスタマイズ
❌ FAQ管理画面（要確認Q-004）
❌ Slack/メール通知（要確認Q-008）
```

---

## 未確定事項（実装前に確認が必要）

実装中にこれらに関連する実装が必要になった場合は、勝手に仕様を決めずに確認を取ること。

| No. | 確認事項 | 影響箇所 |
|---|---|---|
| Q-001 | ✅ **確定**：最初に返信を送信したオペレーターが自動で担当者になる（assigned_operator_id に自動セット）。管理画面の一覧・詳細に担当者名を表示し、未割当・担当中を区別して表示する | FR-OPS, DB |
| Q-002 | ✅ **確定**：担当者が決まっても他のオペレーターも返信可能（ロックしない）。管理画面に「○○対応中」を常時表示し、担当者の変更ボタンも設ける。お互いにフォローできる柔軟な体制を前提とした設計にする | FR-OPS |
| Q-003 | ✅ **確定**：MVPでは保存期間を設けない。全会話・メッセージを無期限保存する。削除機能はPhase 2以降で検討。（模擬案件のため・Supabase容量は当面問題なし） | DR |
| Q-004 | ✅ **確定**：FAQ管理画面をMVPに含める。機能は「追加・有効/無効の切り替え」のみ。削除はせず is_active=false で非表示化。編集・CSV一括インポートはPhase 2。初期18件は seed.sql で投入 | FR, UI |
| Q-005 | 祝日・定休日の営業時間外扱い | FR-TIME |
| Q-006 | ✅ **確定**：①管理画面の一覧に未対応件数バッジ表示 ＋ ②ログイン時に「未対応○件あります」モーダル通知。外部通知（Slack・メール）は不要 | FR-TIME, UI-OPS |
| Q-007 | ✅ **確定**：メッセージ本文はそのまま保存（オペレーターが対応に使える）。初期メッセージに「クレジットカード番号・パスワード等の機密情報は入力しないでください。注文番号はお伝えいただけます」の注意書きを表示。AIは個人情報を回答に含めない（AI-008で確定済み） | DR, セキュリティ |
| Q-008 | ✅ **確定**：外部通知（Slack・メール・LINE）は不要。管理画面内の通知（バッジ＋ログイン時モーダル）で対応する | FR |
| Q-009 | ✅ **確定**：①顧客からの終了ボタンは不要（ウィジェットを閉じるだけ）②AIのみで解決した会話（ai_handling）は最後のメッセージから24時間後に自動でclosedにする③waiting_operatorの放置会話は自動クローズしない（管理画面で色分け・バッジ表示して気づかせる） | FR-OPS, DR |
| Q-010 | ✅ **確定**：カラーパレット＝メイン#2D6A4F・サブ#40916C・アクセント#B7E4C7・テキスト#1B4332・サンド#FAF7F2・サイドバー#3D7A65。ロゴ＝「BOTANICA」テキストロゴ。アイコン＝SVG線アイコン統一（絵文字禁止）。サイドバー構成＝問い合わせ一覧/対応中/新規/完了/すべての会話/FAQ管理/設定/ログアウト/オペレーターオンライン表示。後から差し替えられる設計にする | UI-CUS |
| Q-011 | 顧客からの複数回問い合わせの扱い（新規会話 or 継続） | DR, UI-CUS |

---

## 受入条件（AC）

**これがすべて通ればMVP完成。**

| AC-ID | 受入条件 | 対応要件ID |
|---|---|---|
| AC-001 | FAQにある質問に対して、AIが適切な回答を返す | FR-AI-001, AI-002 |
| AC-002 | FAQにない質問に対して、AIは回答せずオペレーターへ引き継ぐ | FR-AI-002, AI-003 |
| AC-003 | クレーム・お怒りのメッセージでエスカレーションが発生する | AI-004, AI-007 |
| AC-004 | BOTANICAと無関係な質問でハルシネーションが起きない | AI-005, AI-006 |
| AC-005 | ECサイトにチャットウィジェットが表示され、クリックで起動する | FR-CUS-001 |
| AC-006 | 18:00以降に接続すると時間外メッセージと翌営業日案内が表示される | FR-TIME-001〜004 |
| AC-007 | オペレーター管理画面で問い合わせ一覧・会話詳細・返信機能が動作する | FR-OPS-003〜007 |
| AC-008 | オペレーターが返信するとリアルタイムで顧客チャットに反映される（5秒以内） | FR-RT, NFR-002 |
| AC-009 | 全メッセージがDBに保存され、会話履歴として確認できる | DR |
| AC-010 | BOTANICAの基本カラー・ロゴがチャットUIに反映されている | FR-CUS-011 |
| AC-011 | オペレーター認証が機能し、未認証アクセスは管理画面に入れない | FR-OPS-001, AUTH |
| AC-012 | 顧客Aは顧客Bの会話内容を閲覧できない（RLS確認：別ブラウザで実施） | AUTH, RLS |
| AC-013 | AIからオペレーターへの引き継ぎ後、過去のAI会話履歴をオペレーターが確認できる | FR-OPS-005 |
| AC-014 | AI→人間の切替が発生しても顧客画面の会話履歴が保持される | FR-RT-004 |
| AC-015 | 管理画面の設定ページで営業時間・定休曜日・休日を変更でき、即時反映される | FR-OPS-010〜012, FR-TIME-006 |
| AC-016 | 「本日休業」フラグをONにすると時間内でも営業時間外と同一の動作になる | FR-OPS-013, FR-TIME-007 |
| AC-017 | 設定で登録した休日当日は、時間外エスカレーション時と同じ顧客メッセージが表示される | FR-TIME-005 |

---

## 実装詳細仕様

> 以下は実装中に迷わないよう、要件を実装レベルまで詳細化したものです。
> 提案書に沿って判断を確定しています。

---

### 顧客セッション管理（A案：匿名サインイン採用）

```
確定仕様：
  - ウィジェット起動時に supabase.auth.signInAnonymously() を実行する
    → JWT が発行され auth.uid() で顧客を識別できる
    → Supabase がセッションを localStorage に自動保存する（独自のbotanica_session_idは不要）
    → 既に匿名サインイン済みの場合は既存セッションを継続（会話の継続が自然に実現）

  - 顧客のRealtime購読は NEXT_PUBLIC_SUPABASE_ANON_KEY + 匿名JWT で行う
    → RLS が auth.uid() = customer_user_id で正常にフィルターする
    → AC-008（Realtime）と AC-012（RLS）が両立する

  - 顧客のDB書き込み（メッセージ送信等）は Server Action 経由
    SUPABASE_SERVICE_ROLE_KEY は Server Action のみで使用

  - NEXT_PUBLIC_SUPABASE_ANON_KEY の用途：
    ① 顧客側：匿名サインイン + Realtime購読（読み取り）
    ② 管理画面：オペレーターの通常Auth

  - 「1回のウィジェット起動 = 1つの会話（conversation）」の定義は変わらない
    ただし会話の継続判定は customer_user_id（auth.uid()）で行う
```

### 【必読】Server Action での顧客ID確定方法（A案の最大の落とし穴）

> **絶対にやってはいけない実装：**
> ```typescript
> // NG：クライアントから渡された userId をそのまま信用する
> export async function sendMessage(userId: string, text: string) { ... }
> ```
> Server Action の引数は **クライアントが自由に改ざんできる**。
> 他人の `customer_user_id` を渡されると、Server Action は service_role で動くため
> **RLS をバイパスして他人の会話に書き込め、読み出せてしまう**（AC-012 不合格）。
> RLS を正しく書いても、この1点でセキュリティが崩壊する。

**正しい実装：Cookie に載った匿名 JWT をサーバー側で検証して `auth.uid()` を得る。**

そのために `@supabase/ssr` を使い、**セッションの保存先を localStorage ではなく Cookie にする**。
`@supabase/supabase-js` の `createClient` は localStorage に保存するため Server Action から読めない。
必ず `@supabase/ssr` の `createBrowserClient` / `createServerClient` を使うこと。

```typescript
// /actions/chat.ts
'use server';

import { createServerClient } from '@supabase/ssr';   // Cookie からJWTを読む（検証用）
import { supabaseAdmin } from '@/lib/supabase';       // service_role（DB操作用）

/** 匿名JWTを検証して顧客のUIDを返す。全ての顧客向けServer Actionの先頭で呼ぶ */
async function requireCustomerId(): Promise<string> {
  const supabase = createServerClient(/* cookies() を渡す */);
  // getSession() ではなく getUser() を使う。getUser() はAuthサーバーに問い合わせて
  // JWTの署名を検証するため、偽造トークンを弾ける
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) throw new Error('セッションが無効です');
  return user.id;
}

export async function sendMessage(conversationId: string, text: string) {
  const customerUserId = await requireCustomerId();   // ① 本人確認

  // ② 所有権の確認：この会話が本当にこの顧客のものか突合する
  const { data: conv } = await supabaseAdmin
    .from('conversations')
    .select('id, status, customer_user_id')
    .eq('id', conversationId)
    .single();
  if (!conv || conv.customer_user_id !== customerUserId) {
    throw new Error('この会話にアクセスする権限がありません');
  }

  // ③ ここで初めて service_role による書き込みを行う
}
```

**実装規約（backend 必須遵守）：**

1. 顧客向け Server Action は **例外なく `requireCustomerId()` を先頭で呼ぶ**。
2. `conversation_id` を引数に取る関数は **必ず所有権の突合**を行う。
3. `getSession()` ではなく **`getUser()`** を使う（署名検証の有無が違う）。
4. `userId` / `sessionId` を **引数として受け取らない**。受け取る設計にした時点で脆弱。

### AI処理（Gemini API）

```
確定仕様：
  - Gemini API は Server Action 経由のみで呼び出す（APIキーをクライアントに露出させない）
  - responseMimeType: "application/json" + responseSchema を使い JSON を強制する
  - レスポンスの型：
      { "answer": string, "escalate": boolean, "reason": string }
  - FAQ は全件（is_active=TRUE のもの）をプロンプトに含める（MVP はシンプル実装優先）
  - タイムアウト：15秒。AbortController で制御し、タイムアウト時は即エスカレーション

システムプロンプト（確定版）：
  あなたはBOTANICA（自然派スキンケアECブランド）のカスタマーサポートAIです。

  【回答ルール】
  1. 以下のFAQリストのみを根拠として回答してください
  2. FAQに記載のない事実をでっちあげて回答してはいけません
  3. FAQに根拠がない場合は escalate: true を返してください
  4. 以下のいずれかに該当する場合は必ず escalate: true を返してください：
     - クレーム・お怒り・不満のトーン
     - 個別の返品・交換・注文変更・キャンセルの交渉
     - 商品の不具合・破損の報告
     - 個人情報（住所・名前など）の変更依頼
     - BOTANICAと無関係な質問（株価・政治・他社商品など）
  5. 競合他社への言及・法的アドバイス・医療的アドバイスは禁止です
  6. 丁寧・親切なカスタマーサポートのトーンで回答してください

  【FAQリスト】
  {faqText}

  【出力形式】必ずJSON形式のみで返してください：
  - FAQ根拠あり  → {"answer":"回答テキスト","escalate":false,"reason":""}
  - ESC必要      → {"answer":"","escalate":true,"reason":"理由"}
```

### 会話フロー（A案に伴い改訂）

```
会話開始フロー：
  1. ウィジェットを開く
  2. ensureAnonymousSession() を実行
       既存セッションがあれば再利用／なければ supabase.auth.signInAnonymously()
       → 匿名JWTがCookieに保存され、auth.uid() が確定する
  3. Server Action: createOrGetConversation() を呼ぶ（引数なし）
       サーバー側で auth.getUser() から customer_user_id を取得する
       closed 以外の会話があれば継続・なければ新規作成（Q-011）
  4. conversation_id をフロントエンドで保持（useState）
  5. Realtime購読を開始（この conversation_id のみフィルター）
  6. 歓迎メッセージをフロントで表示（DBには保存しない）

歓迎メッセージ（確定）：
  「BOTANICAのカスタマーサポートへようこそ。
   在庫確認・配送・返品などのご質問をどうぞ。
   AIがお答えします。人間のサポートが必要な場合は自動でつなぎます。」

ステータス変更のタイミング：
  - ai_handling → waiting_operator：AI がエスカレーション判定したとき
  - waiting_operator → operator_handling：オペレーターが最初の返信を送信したとき（自動）
  - operator_handling → closed：管理画面の「対応完了」ボタン（手動）
  - closed に変更できるのは operator_handling の会話のみ
```

### Realtime 実装方針

```
共通の前提（A案）：
  - messages / conversations を supabase_realtime パブリケーションに追加済みであること
      ALTER PUBLICATION supabase_realtime ADD TABLE messages;
      ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
  - Realtime（postgres_changes）は RLS を尊重する。
    RLS で SELECT できない行は購読していても配信されない。
    → 顧客が匿名JWTを持っていることが必須（未サインイン状態では何も届かない）

顧客側：
  - @supabase/ssr の createBrowserClient（NEXT_PUBLIC_SUPABASE_ANON_KEY）で作成
  - 匿名サインイン完了後に購読を開始する（JWT取得前に購読すると何も届かない）
  - conversation_id でフィルターして messages テーブルの INSERT を購読
      filter: `conversation_id=eq.${conversationId}`
  - 二重防御：RLS が auth.uid() = customer_user_id で絞り、
    さらに filter が conversation_id で絞る
  - useEffect のクリーンアップで必ず supabase.removeChannel(channel) を呼ぶ
  - 自分が送信したメッセージも INSERT イベントで返ってくる。
    楽観的更新（送信直後にUIへ追加）をする場合は message.id で重複排除する

管理画面側：
  - オペレーター Auth 済みクライアントで購読（is_operator() を満たすため全件見える）
  - 一覧：messages テーブル全体 + conversations テーブル UPDATE を購読
  - 詳細：conversation_id でフィルターして messages INSERT を購読

接続断のハンドリング：
  - channel.subscribe((status) => ...) で 'CHANNEL_ERROR' / 'TIMED_OUT' を検知
  - 顧客側は「接続が切れました。再接続しています」を表示し自動再接続を試みる
```

### 営業時間判定

```
確定仕様：
  - 判定場所：サーバー側（Server Action 内）
  - 設定ソース：business_settings テーブルから取得（環境変数は使わない）
  - タイムゾーン：business_settings.timezone（初期値 Asia/Tokyo）

「営業時間外」と判定する条件（いずれか1つでも該当すれば時間外）：
  1. 現在時刻が hours_start 未満 または hours_end 以上
  2. 現在の曜日が closed_weekdays に含まれる（0=日〜6=土）
  3. 現在の日付が holiday_dates に含まれる
  4. is_open_today が FALSE（オペレーターの手動フラグ）

実装イメージ（lib/businessHoursRules.ts）：
  // 【重要】タイムゾーンの変換に Date の再パースと toISOString() を使ってはいけない。
  //   NG例： const jst = new Date(now.toLocaleString('ja-JP', { timeZone }));
  //          const dateStr = jst.toISOString().split('T')[0];
  //   toISOString() はUTCに戻すため、JSTの朝の時刻が「前日の日付」になる。
  //   その結果、登録した休日を営業日と誤判定する（AC-017 が落ちる）。
  //   本番の Vercel はUTCで動くため、この差は必ず表面化する。
  //   Intl.DateTimeFormat.formatToParts なら指定タイムゾーンの値を直接取り出せる。

  /** 指定タイムゾーンでの「年月日・曜日・時」を取り出す */
  function getZonedParts(date: Date, timeZone: string) {
    const parts = new Map(
      new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', hour12: false, weekday: 'short',
      }).formatToParts(date).map((p) => [p.type, p.value])
    );
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return {
      dateString: `${parts.get('year')}-${parts.get('month')}-${parts.get('day')}`,
      weekday: labels.indexOf(parts.get('weekday') ?? ''),  // 0=日〜6=土
      hour: Number(parts.get('hour')) % 24,                 // 深夜0時が '24' の環境に備える
    };
  }

  /** 判定は純粋関数にする。時刻を引数で渡せるとテストで固定できる */
  export function evaluateBusinessHours(
    settings: BusinessSettings,
    now: Date = new Date()
  ): { isOpen: boolean; hoursStart: number } {
    const hoursStart = settings.hours_start;
    if (!settings.is_open_today) return { isOpen: false, hoursStart };   // 手動フラグ

    const { dateString, weekday, hour } = getZonedParts(now, settings.timezone);
    if (settings.closed_weekdays.includes(weekday)) return { isOpen: false, hoursStart };
    if (settings.holiday_dates.some((d) => d.slice(0, 10) === dateString))
      return { isOpen: false, hoursStart };

    // hours_end ちょうどは営業時間外（18:00 は終了済み）
    return { isOpen: hour >= settings.hours_start && hour < settings.hours_end, hoursStart };
  }

  // DBからの取得と失敗時のフォールバックは lib/businessHours.ts が担当する。
  // 判定に失敗した場合は例外を投げず「営業時間外」を返すこと（安全側）。
  // 営業時間内と誤判定すると、誰もいない時間に即対応を約束して放置することになる。

時間外・休日メッセージ（確定・全箇所でこの1文に統一する）：
  ウィジェット起動時・エスカレーション時とも共通：
    「現在は営業時間外です。翌営業日（10:00以降）に担当者が対応します。」

  ※ 文面を1つに統一する理由：
    起動時とエスカレーション時で言い回しが違うと、顧客は
    「状況が変わったのか」と受け取る。伝えるべき事実は
    「今は時間外」「翌営業日に人間が対応する」の2点だけで
    どちらの場面でも同じなので、文面も揃える。
  ※ 10:00 の部分は business_settings.hours_start を参照して動的に出す
    （設定変更が文面に反映されないと案内が嘘になるため）。
```

### ディレクトリ構成（確定）

```
/app
  /(customer)/chat/page.tsx          ← 顧客チャットUI
  /(operator)/login/page.tsx         ← ログイン画面
  /(operator)/dashboard/page.tsx     ← 問い合わせ一覧
  /(operator)/dashboard/[id]/page.tsx ← 会話詳細
  /(operator)/settings/page.tsx      ← 営業設定（時間・定休・休日・当日フラグ）
  /(operator)/faq/page.tsx           ← FAQ管理（追加・有効/無効切替）
/components
  /chat/                             ← 顧客チャット用
  /operator/                         ← 管理画面用
  /icons/                            ← SVG線アイコン集約（絵文字禁止のため自前定義）
/lib
  supabase.ts                        ← Supabaseクライアント定義（下記3種を分離）
                                        browser  : createBrowserClient（anon・Cookie保存）
                                        server   : createServerClient（anon・JWT検証用）
                                        admin    : service_role（'server-only' を import）
  gemini.ts                          ← Gemini API接続
  session.ts                         ← 匿名サインイン管理（ensureAnonymousSession）
  businessHours.ts                   ← 営業時間判定（DB取得・失敗時のフォールバック）
  businessHoursRules.ts              ← 営業時間の判定ルール（純粋関数・テスト対象）
/types/index.ts                      ← 型定義
/actions
  chat.ts                            ← 顧客向け Server Actions
  operator.ts                        ← 管理画面向け Server Actions
  ai.ts                              ← AI処理 Server Actions
/supabase/seed.sql                   ← FAQ初期データ（18件）
middleware.ts                        ← /operator 配下の認証保護
```

### 環境変数（確定）

```bash
# Supabase（ブラウザ参照可）
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=      # 管理画面 Auth・顧客 Realtime 読み取り用

# Supabase（サーバー専用。絶対に NEXT_PUBLIC にしない）
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=          # Server Action での全 DB 操作用

# Gemini API（サーバー専用）
GEMINI_API_KEY=                     # Server Action 経由のみで使用

# 営業時間・休日設定はDBの business_settings テーブルで管理する（環境変数不要）
```

### TypeScript 型定義（確定）

```typescript
// /types/index.ts

export type ConversationStatus =
  | 'ai_handling'
  | 'waiting_operator'
  | 'operator_handling'
  | 'closed';

export type SenderType = 'customer' | 'ai' | 'operator';

export type FAQCategory = '在庫' | '配送' | '返品' | '商品' | 'その他';

export interface Conversation {
  id: string;
  customer_user_id: string;   // 匿名サインインの auth.uid()（旧 customer_session_id）
  status: ConversationStatus;
  assigned_operator_id: string | null;
  category: FAQCategory | null;
  created_at: string;
  updated_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_id: string | null;
  content: string;
  created_at: string;
}

export interface FAQ {
  id: string;
  category: FAQCategory;
  question: string;
  answer: string;
  is_active: boolean;
}

export interface AIResponse {
  answer: string;
  escalate: boolean;
  reason: string;
}

export interface BusinessSettings {
  id: string;
  hours_start: number;        // 営業開始時刻（時）例：10
  hours_end: number;          // 営業終了時刻（時）例：18
  closed_weekdays: number[];  // 定休曜日 0=日〜6=土 例：[0,6]
  holiday_dates: string[];    // 特定休日 YYYY-MM-DD 形式 例：["2025-01-01"]
  is_open_today: boolean;     // 当日の手動対応フラグ（false=本日休業）
  timezone: string;           // タイムゾーン 例："Asia/Tokyo"
  updated_at: string;
  updated_by: string | null;
}

export interface ActionResult<T = void> {
  success: boolean;
  data?: T;
  error?: string;
}
```

### FAQ 初期データ方針

```
- /supabase/seed.sql として管理する
- 18件の内訳（ヒアリング比率に合わせる）：
    在庫関連   6件
    配送関連   4件
    返品・交換  3件
    商品質問   4件
    その他     1件
- クライアントから正式なFAQデータが提供されるまでは上記の暫定データで進める
```

### Gemini API 読み替え表

> 参考実装が Claude API 前提で書かれているため、Gemini API への対応表を残す。
> 本番移行時に AI プロバイダを再評価する際の逆引きにも使える。

```
参考実装の記述        → このプロジェクトでの実装
Claude API          → Gemini API（Gemini 2.5 Flash・無料枠）
claude-sonnet-4-6   → gemini-2.5-flash
Anthropic SDK       → @google/generative-ai
messages.create()   → model.generateContent()
response.content    → response.response.text() または JSON パース
system prompt       → systemInstruction パラメータ
```

### 未確定事項の暫定対応（実装をブロックしないための判断）

| Q番号 | 暫定実装方針 |
|---|---|
| Q-001（OPS割り当て） | ✅ **確定済み**：最初に返信したオペレーターを `assigned_operator_id` に自動セットする（上記Q-001参照。「割り当てなし」は旧記述のため無効） |
| Q-002（OPS競合） | ✅ **確定済み**：ロックしない。最後に送信した返信が反映される（Realtime で自然解決）。詳細画面に「○○対応中」を常時表示する |
| Q-005（祝日） | ✅ **確定済み**：管理画面の営業設定（holiday_dates）で登録。営業時間外と同一動作 |
| Q-009（終了条件） | operator_handling のみ closed に変更可 |
| Q-010（ブランドカラー） | ✅ **確定済み**：上記Q-010参照 |
| Q-011（複数回問い合わせ） | ✅ **確定済み**：closed以外の未完了会話があれば継続・なければ新規作成 |