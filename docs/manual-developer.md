# 開発者向け引き継ぎドキュメント

このシステムを引き継いで開発を続ける方向けの技術資料です。

---

## プロジェクト概要

自然派スキンケアEC「BOTANICA」（架空）向けのCSチャットボット。ECサイトの右下に埋め込むチャットウィジェットで、顧客の問い合わせにまずGemini APIが自動応答し、FAQに根拠がない質問・個別対応が必要な案件だけを人間のオペレーターへ引き継ぐ。Next.js 15（App Router）+ Supabase + Vercel の構成で、顧客側は匿名サインイン、オペレーター側はメール認証で認証を分離している。

| 項目 | 値 |
|---|---|
| 本番URL | <https://cs-chatbot-portfolio.vercel.app> |
| リポジトリ | <https://github.com/usako-ui/CS-chatbot-portfolio> |
| フレームワーク | Next.js 15.5（App Router） |
| DB / Auth / Realtime | Supabase（PostgreSQL） |
| AI | Gemini 2.5 Flash |
| デプロイ | Vercel |

---

## ディレクトリ構成と各ファイルの責務

### ページ（`app/`）

Route Group で3系統に分けている。Route Group 名（カッコ書きの階層）はURLに現れない。

```
app/
├── page.tsx                          ランディング（紹介ページ）
├── layout.tsx                        全ページ共通のルートレイアウト
├── (client-ec)/                      クライアントのECサイトに埋め込む
│                                     ウィジェットのデモページ
│                                     （匿名サインイン・DB保存あり）
├── (demo-ec)/demo-ec/page.tsx        体験用デモ（体験者のAPIキー・DB保存なし）
└── (operator)/
    ├── layout.tsx                    管理画面共通レイアウト（認証ガード）
    ├── login/page.tsx                ログイン
    ├── dashboard/page.tsx            問い合わせ一覧
    ├── dashboard/[id]/page.tsx       会話詳細・返信
    ├── faq/page.tsx                  FAQ管理
    └── settings/page.tsx             営業時間設定
```

`/chat` は `next.config.mjs` の `redirects()` でウィジェット埋め込みページへ307転送している。転送先の実際のパスは `next.config.mjs` を参照すること。middleware ではなくここで処理しているのは、middleware の matcher に足すと匿名サインイン前のアクセスにも Auth 問い合わせが走るため。静的なリダイレクトに認証は不要。

### Server Actions（`actions/`）

| ファイル | 責務 |
|---|---|
| `chat.ts` | 顧客チャットの1往復。メッセージ保存 → AI応答 → エスカレーション判定 |
| `operator.ts` | オペレーターの返信・会話の完了 |
| `dashboard.ts` | 一覧取得・FAQ操作・営業設定 |
| `demo.ts` | デモ用。体験者のAPIキーでAIを呼ぶ。DBには一切書かない |

**すべての Server Action は `service_role` で動くため RLS が効かない。** 顧客IDは必ず `requireCustomerId()` で Cookie 上のJWTを検証して確定させ、`conversationId` は必ず `requireOwnedConversation()` で所有権を突合する。引数で渡された userId を信用した時点でセキュリティが崩れる。

### ドメインロジック（`lib/`）

| ファイル | 責務 |
|---|---|
| `gemini.ts` | Gemini API 接続層。**業務ロジックを持ち込まない** |
| `prompt.ts` | システムプロンプト組み立て。`server-only` |
| `messages.ts` | 顧客に見せる固定文言・エスカレーション理由コード |
| `aiReply.ts` | AI応答の中核。**例外を投げない**（失敗時もエスカレーションを返す） |
| `conversations.ts` | 会話の所有権チェック・メッセージ操作 |
| `faq.ts` | FAQ取得・プロンプト用テキスト生成 |
| `businessHours.ts` / `businessHoursRules.ts` | 営業時間判定（判定ロジックとDB取得を分離） |
| `validation.ts` | 入力検証 |
| `env.ts` | 環境変数の取得（未設定時に原因の分かるエラーを出す） |
| `session.ts` | 匿名サインイン・セッション再作成 |
| `currentOperator.ts` / `operatorData.ts` | オペレーター情報 |
| `supabase/admin.ts` | `service_role` クライアント（サーバー専用） |
| `supabase/server.ts` | Cookie からJWTを読むサーバークライアント・本人確認 |
| `supabase/client.ts` / `anon.ts` | ブラウザ用の anon クライアント |

**`lib/prompt.ts` と `lib/messages.ts` の分離が重要。** 固定文言はクライアントコンポーネントも参照するため、`prompt.ts` に置いたままだと文言を1つ import しただけでシステムプロンプト本体がクライアントの依存に入る。依存の向きを `messages.ts ← prompt.ts` の一方向に固定し、`prompt.ts` には `server-only` を付けてある。

### コンポーネント（`components/`）

```
chat/       顧客ウィジェット（ChatWidget → ChatPanel → MessageBubble / HandoffChoice / Notices）
            useConversationMessages.ts が Realtime 購読を担当
demo/       デモ用ウィジェット（DemoChatWidget）
operator/   管理画面（Sidebar・ConversationList・ConversationDetailClient ほか）
            useOperatorRealtime.ts が管理側の Realtime 購読
landing/    ランディング専用（モックUI含む）
store/      StoreFront.tsx をウィジェット埋め込みページとデモページで共有
icons/      SVG線アイコン（外部アイコンライブラリ・絵文字は使わない方針）
```

---

## 環境変数一覧

値は `.env.local`（Git管理外）と Vercel のプロジェクト設定にある。ここには **キー名と用途のみ** 記載する。

| キー名 | 用途 | 公開範囲 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ブラウザからSupabaseへ接続するURL | ブラウザに配信される |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 管理画面Auth・顧客Realtime用の公開キー | ブラウザに配信される |
| `SUPABASE_URL` | サーバー側からの接続URL | サーバー専用 |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Action用。**RLSを迂回する** | **サーバー専用・絶対に公開しない** |
| `GEMINI_API_KEY` | Gemini API 呼び出し | **サーバー専用・絶対に公開しない** |

> **`SUPABASE_SERVICE_ROLE_KEY` と `GEMINI_API_KEY` に `NEXT_PUBLIC_` を付けてはいけない。**
> 付けた瞬間にブラウザへ配信され、全顧客の会話データが誰でも読み書きできる状態になる。
> RLSはこのキーを迂回するため、ポリシーでは守れない。
> 万一配信した場合は変数を消すだけでは不十分で、Supabase側でキーのローテートが必要。

環境変数を追加したら `.env.example` を必ず同期更新すること。

### 配信物の検証方法

```bash
rm -rf .next && npx next build
grep -rl "<キーの値>" .next/static   # 何も出なければOK
```

本番に対しては、HTMLとJSチャンクを取得して全文検索する。2026-09-01 時点で秘密情報・システムプロンプトとも0件を確認済み。

---

## RLSポリシーの意図と検証方法

### 設計の考え方

顧客にも **Supabase匿名サインイン** でJWTを発行し、`auth.uid()` で識別する。当初案の `customer_session_id`（クライアントが自由に名乗れる文字列）はRLSの識別子として機能しないため廃止した。

**最重要の注意点：匿名サインインしたユーザーの Postgres ロールは `anon` ではなく `authenticated` になる。** そのため `auth.role() = 'authenticated'` をオペレーター判定に使うと、匿名顧客全員に全権限が渡る。必ず `private.is_operator()` を通すこと。

```sql
CREATE OR REPLACE FUNCTION private.is_operator()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $$
  SELECT COALESCE((auth.jwt() ->> 'is_anonymous')::boolean, TRUE) = FALSE
     AND auth.uid() IS NOT NULL;
$$;
```

`COALESCE(..., TRUE)` は安全側の設計。`is_anonymous` クレームが欠けた場合は匿名扱いに倒れ、false を返す。逆にすると、JWTの形が変わった瞬間に全権限が漏れる。

`public` ではなく `private` スキーマに置いているのは、PostgREST 経由で外部から呼べないようにするため（`anon` にはスキーマの USAGE 権限も無い）。

### ポリシー一覧（全4テーブル・7ポリシー）

| テーブル | ポリシー | 操作 | USING |
|---|---|---|---|
| conversations | `customer_select_own_conversation` | SELECT | `customer_user_id = (SELECT auth.uid())` |
| conversations | `operator_all_conversations` | ALL | `private.is_operator()` |
| messages | `customer_select_own_messages` | SELECT | 自分の会話に属するもののみ |
| messages | `operator_all_messages` | ALL | `private.is_operator()` |
| faqs | `faq_read_active` | SELECT | `is_active = true`（anon含む） |
| faqs | `operator_all_faqs` | ALL | `private.is_operator()` |
| business_settings | `operator_all_business_settings` | ALL | `private.is_operator()` |

**顧客向けは SELECT のみで、INSERT/UPDATE/DELETE のポリシーが存在しない。** 顧客の書き込みはすべて Server Action 経由という設計。ポリシーが無い＝拒否なので、ブラウザから直接書き込む経路はない。

`(SELECT auth.uid())` とサブクエリで囲んでいるのは、PostgreSQL が行ごとに再評価するのを防ぐため。

### 検証方法

**「0件返る」ことではなく「自分の1件だけ返る」ことを確認すること。** 全拒否で壊れている状態を「安全」と誤読しないため。

```bash
# 顧客側（匿名JWT 2人ぶんで相互に見えないことを確認）
NODE_PATH="$(pwd)/node_modules" node _verify.local/pentest-operator.js
NODE_PATH="$(pwd)/node_modules" node _verify.local/pentest-serveraction.js
```

2026-09-01 の監査では顧客側7件・オペレーター側5件すべてPASS。Supabase のセキュリティアドバイザーが出す `auth_allow_anonymous_sign_ins` は、ポリシーの対象ロールが `authenticated` であるだけで機械的に発火するルールで、この構成では必ず出る。実際のガードは `private.is_operator()` 側にある。

---

## Realtime の再接続ロジック

顧客側は `components/chat/useConversationMessages.ts`、管理側は `components/operator/useOperatorRealtime.ts` が担当する。

### 押さえるべき4点

**1. 購読前にセッションを確定させる**

`createClient()` の直後に購読すると匿名として接続し、RLSで弾かれて1件も配信されない。購読自体は成功するのでエラーが出ず、切り分けが難しい。`ChatPanel` は `ensureAnonymousSession()` を待ってから `conversationId` を state に入れ、それを依存に購読を開始する。

**2. 購読確立後のイベントしか届かない**

`postgres_changes` は購読が確立した後のINSERTしか配信しない。ウィジェットを開いた直後に送信されると取りこぼす。そのため `SUBSCRIBED` を受けた時点でサーバーから取り直す。

```ts
.subscribe((status) => {
  if (status === 'SUBSCRIBED') {
    setConnection('connected');
    // 購読確立前に入ったメッセージを取り戻す。
    // 再接続時もここを通るので、切断中の分もまとめて回収できる
    void syncRef.current(conversationId);
  } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
    setConnection('reconnecting');
  }
});
```

**再接続時も `SUBSCRIBED` を通るため、切断中に届いた分はここで自動的に埋まる。** 独自の再接続処理は書いていない（Supabaseクライアントが自動で再試行する）。このフックは接続状態を画面に見せることだけを担当する。

**3. クリーンアップを必ず書く**

`return () => supabase.removeChannel(channel)` を忘れると、再レンダーのたびに購読が積み上がり、1件の受信で同じメッセージが何度も処理される。

**4. コールバックは ref 経由で呼ぶ**

`appendMessage` を依存配列に入れると、関数の再生成のたびに再購読が走ってチャンネルが張り直される。`appendRef.current` 経由で呼んで依存を `conversationId` だけに保つ。

### 検証時の注意

検証スクリプトでウィジェットを開いた直後に管理側からINSERTすると、購読確立前で届かない。**開いてから5秒ほど待ってから投入すること。**

---

## AIモデル変更時の手順

AI呼び出しは `lib/gemini.ts` に閉じている。プロンプト組み立ては `lib/prompt.ts`、業務判断は `lib/aiReply.ts`。**この3層の分離を保てば、モデル差し替えの影響は `gemini.ts` に収まる。**

### 同じGeminiで別モデルにする場合

`lib/gemini.ts` の定数を変えるだけ。

```ts
export const GEMINI_MODEL = 'gemini-2.5-flash';
```

### 別のAIサービス（Claude API等）に替える場合

1. `lib/gemini.ts` と同じシグネチャの接続層を作る
   ```ts
   generateAIResponse(systemInstruction, userMessage, history, apiKey?): Promise<AIResponse>
   ```
2. 以下の契約を必ず守る
   - 戻り値は `AIResponse`（`action` は `'answer' | 'handoff_offer' | 'escalate'`）
   - 失敗時は `GeminiError` 相当の例外を投げる（握りつぶさない）
   - JSON強制（Geminiの `responseSchema` に相当する仕組みを使う）
   - タイムアウト30秒で打ち切る
3. `lib/aiReply.ts` の import 先を差し替える
4. `actions/demo.ts` も同様に差し替える（デモは体験者のキーを使う）

### 変更後に必ず実行する検証

プロンプトやモデルを変えたら、判定が変わっていないか確認する。

```bash
# AIシナリオ8件＋時間外（Geminiを9消費・25秒間隔）
NODE_PATH="$(pwd)/node_modules" node _verify.local/verify-ai-scenarios.js

# 判定ぶれの確認（#3を3回連続＋#4回帰・4消費）
NODE_PATH="$(pwd)/node_modules" node _verify.local/verify-scenario3.js
```

### 現在の設定と本番移行時の判断

`temperature: 0.1` は判定のぶれ対策（0.2では同じ質問でエスカレーション判定が割れた）。`thinkingConfig: { thinkingBudget: 0 }` は2.5 Flashの思考トークンを止めて制限時間内に収めるため。

**Gemini無料枠は日次20リクエスト・分次5リクエストの2段構え。** 本番運用には足りないため、有料プランへの切り替えを検討すること。日次枠のリセットは日本時間16:00。枠切れ時は「担当者に接続しています。」というフォールバック文言が出る（AIは動いていない）。

---

## ソフトエスカレーション（パターンB）の設計意図

### 解決した問題

当初は「AIで完結」か「即人間へ引き継ぎ」の2択しかなく、**FAQで案内はできるが個別手続きも必要な案件**（商品破損・返品手続きなど）の受け皿が無かった。AIが一方的に人へ回すと案内を読めば済む人まで待たせ、AIだけで終わらせると手続きしたい人が行き止まりになる。

### 3値化した出力契約

`escalate: boolean` を `action: 'answer' | 'handoff_offer' | 'escalate'` に置換した。

| action | 挙動 | ステータス |
|---|---|---|
| `answer` | AIが回答して終了 | `ai_handling` のまま |
| `handoff_offer` | FAQ案内＋謝罪を出し、顧客が選択肢を選ぶ | `ai_handling` のまま（`pending_handoff = true`） |
| `escalate` | 固定文のみ・即引き継ぎ | `waiting_operator` |

### 触ると壊れる箇所

**1. 本文を空にするのは `escalate` のときだけ**（`lib/gemini.ts` の正規化）

`handoff_offer` でここを捨てると、謝罪もFAQ案内も顧客に届かず引き継ぎ文だけが表示され、この設計を入れた意味が消える。逆に `handoff_offer` で本文が空だった場合は安全側（`escalate`）へ倒す。

**2. 選択待ちフラグはサーバー側で持つ**（`conversations.pending_handoff`）

React の state だけだとリロードで選択肢が消え、「担当者へつなぐ」を押せないまま会話が宙に浮く（AC-014に抵触）。

**3. AI応答の前後で status は変わりうる**

`resolveAiReply` は最大30秒かかる。その間に顧客が「担当者へつなぐ」を押すと会話は `waiting_operator` になっている。冒頭で読んだ status を信じて書くと、引き継ぎ案内の直後にAIの回答が差し込まれる。`actions/chat.ts` は書き込む前に `requireOwnedConversation()` で status を取り直している。**この再確認を消すと再発する。**

**4. `setConversationStatus` は `pending_handoff` も必ず false にする**

選択待ちは `ai_handling` のときだけ意味がある状態。ここから外す処理を1箇所に集約しているので、呼び出し側で個別に落とす必要はない。

**5. pg_cron の自動クローズは選択待ちに72時間の猶予を与える**

`private.close_stale_ai_conversations()` が毎時0分に実行され、最終メッセージから24時間経った `ai_handling` を `closed` にする。選択待ちだけは72時間まで猶予する（選択肢ごと消えるのを防ぐため）。期限なしで除外すると永久に滞留する。

### プロンプト側の要点

`lib/prompt.ts` の【対応方針の判定】が A/B/C を決める。規則11「FAQに回答が存在する質問を escalate にしてはいけない」と、規則4・7（個別照会・クレームは必ず escalate）の優先順位を明記している。**この優先順位を崩すとAC-002・AC-003が落ちる。**

---

## Claude Code での開発継続方法

このリポジトリは Claude Code での開発を前提に整理してある。

```bash
cd "<リポジトリのパス>"
claude
```

起動後、**`CLAUDE.md` を読ませるだけで再開できる。** `CLAUDE.md` にプロジェクトのルール・技術スタック・禁止事項・サブエージェントの担当範囲が書かれており、そこから `requirements.md`（受入条件 AC-001〜AC-017）・`tasks.md`（タスク一覧と進行状態）へ辿れる。

```
CLAUDE.md と tasks.md を読んで現在の進行状況を確認してください。
```

### 主要な参照ファイル

| ファイル | 内容 | Git管理 |
|---|---|---|
| `CLAUDE.md` | ルール・技術スタック・禁止事項 | 対象外（ローカル） |
| `requirements.md` | 機能要件・DBスキーマ・受入条件 | 対象 |
| `tasks.md` | タスク一覧・進行状態・引き継ぎ事項 | 対象外（ローカル） |
| `progress.md` | 作業ログ・環境情報・「忘れると壊す」決定事項 | 対象外（ローカル） |
| `docs/test-scenarios.md` | AI判定の検証シナリオ | 対象 |

`CLAUDE.md`・`tasks.md`・`progress.md` は内部資料のため `.gitignore` 対象。**引き継ぎ時は別途共有すること。**

### 検証スクリプト

`_verify.local/` に Playwright ベースの検証スクリプトが22本ある（`.gitignore` 対象）。実行手順と各スクリプトのGemini消費量は `_verify.local/README.md` を参照。

```bash
npm install -D playwright     # 検証のたびに入れる
npx next dev
NODE_PATH="$(pwd)/node_modules" node _verify.local/<script>.js
npm uninstall playwright      # 終わったら外す
```

### 開発時の注意

- **`npx next dev` 起動中に `npx next build` を実行しない。** 同じ `.next` を奪い合って壊れ、ログに何も出ないままページが500や404になる。逆順（build後にdev）でも壊れる。どちらの場合も `rm -rf .next` してから起動し直す。
- **`tailwind.config.ts` を変更したら dev を再起動する。** 起動中のプロセスは古い設定を持ち続け、追加した色やアニメーションのクラスが生成されない。エラーにならず「なぜかスタイルが当たらない」形で出る。
- **検証後はDBを初期状態に戻す**（会話0件・営業設定10-18時）。

---

## 本番移行時の残作業

1. **Supabase の漏洩パスワード保護を有効化**
   Dashboard → Authentication → Sign In / Providers → Password Security →
   "Leaked password protection"。オペレーターはメール＋パスワードでログインするため、
   流出した使い回しパスワードで侵入されると全顧客の会話が読まれる。
   既存ユーザーがログインできなくなることはない。
2. **Gemini の有料プランへの切り替え**（無料枠は本番運用を想定していない）
3. **`framer-motion` の要否判断**
   新着メッセージのフェードイン（0.25秒）のみに使っており、First Load JS が
   ウィジェット埋め込みページで 182→222kB 増えている。
   CSSの `@keyframes` でも同じ見た目を作れる。
4. **対応完了の取り消し機能**（改善提案）
   現在は `closeConversation()` が `operator_handling` → `closed` の一方向のみを許可し、
   戻す手段がない。完了にした会話は顧客側で新しい問い合わせとして始まるため、
   **顧客が未読の返信は読めなくなる。**
   誤操作防止として確認ダイアログは追加済み（`ConversationDetailClient.tsx`）だが、
   押してしまった後は戻せない。
   - 「対応中に戻す」ボタンの追加（`closed` → `operator_handling` の逆方向遷移）
   - 顧客がチャットを開く前であれば、返信を読める状態に復元できる
   - **顧客がすでに新しい会話を開いた後は復元不可**（設計上の制約）。
     `findOrCreateOpenConversation()` が「未完了の会話のうち最新の1件」を拾うため、
     戻した古い会話より後から作られた新しい会話が優先される
   - 完全に塞ぐには顧客側の会話取得ロジックまで変更範囲が及び、
     **AC-014・Q-009 の確定仕様に影響する**ため要件定義の見直しが必要

---

## 関連ドキュメント

- [オペレーター向け操作マニュアル](manual-operator.md)
- [FAQ編集者向けマニュアル](manual-faq.md)
- [検証シナリオ](test-scenarios.md)
