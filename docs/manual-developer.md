# 開発者向けクイックスタート

## このシステムは何をするか

ECサイトの顧客問い合わせにAIが自動応答し、対応できない場合だけ人間のオペレーターへ引き継ぐCSチャットボットです。
FAQに根拠がある質問はAIが answer、手続きが要る場合は顧客に選ばせ、クレームやFAQ外は人へ回します。
Next.js 15（App Router）+ Supabase + Gemini API + Vercel で構成しています。

## 本番URL・リポジトリ

- 本番URL：<https://cs-chatbot-portfolio.vercel.app>
- GitHub：<https://github.com/usako-ui/CS-chatbot-portfolio>

---

## ローカル起動手順（5ステップ）

まず手元で動かします。本番へのデプロイは[次の章](#本番セットアップ手順vercel)です。

### 1. クローン・インストール

```bash
git clone https://github.com/usako-ui/CS-chatbot-portfolio.git
cd CS-chatbot-portfolio
npm install
```

Node.js 20 以上が必要です（`node -v` で確認）。

### 2. `.env.local` を作成

```bash
cp .env.example .env.local
```

必要な変数は[下の一覧](#必要な環境変数)のとおりです。**値は `.gitignore` 対象のため別途入手してください。**

### 3. Supabase のセットアップ

Supabase でプロジェクトを作成し、SQL Editor で次を順に実行します。

1. `requirements.md`「DBスキーマ」章の DDL（テーブル4つ・RLSポリシー7つ）
2. `supabase/seed.sql`（FAQ初期データ18件）

あわせてダッシュボードで2つ設定します。

- **Authentication → Providers → Anonymous を有効化**（未設定だと顧客側が422で動きません）
- **Authentication → Users → Add user** でオペレーターを作成
  「Auto Confirm User」にチェック。User Metadata に `{"display_name": "山田 太郎", "role_label": "フルタイム"}` を設定

### 4. Realtime を有効化

```sql
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
```

> ⚠️ **忘れると無言で壊れます。** 購読は成功するのに何も届かず、エラーも警告も出ないまま「返信しても顧客画面に出ない」症状だけが残ります。

### 5. 開発サーバー起動

```bash
npm run dev
```

<http://localhost:3000> を開きます。

**動作確認：** 顧客チャットで「送料はいくらですか」→ 550円と回答／管理画面から返信 → 顧客側に1秒ほどで表示。

---

## 本番セットアップ手順（Vercel）

ローカルが動いたら、同じ構成を本番に用意します。

### 1. Supabase の本番プロジェクトを用意

ローカルと同じ手順（DDL → `seed.sql` → Realtime有効化 → 匿名サインイン有効化 → オペレーター作成）を、本番用のプロジェクトに対して実行します。

> **検証用と本番用は分けることを推奨します。** 同じプロジェクトを使うと、
> 開発中の操作が本番の顧客データに影響します。

### 2. 定期実行を設定（本番のみ）

```
supabase/cron.sql を SQL Editor に貼り付けて実行
```

放置された会話（AIだけで完結し24時間動きがないもの）を自動で完了にします。**設定しないと一覧に会話が溜まり続け、対応が必要な問い合わせが埋もれます。**

### 3. Vercel にリポジトリを接続

<https://vercel.com> で New Project → GitHubリポジトリを選択します。Next.js は自動検出されるため、ビルド設定の変更は不要です。

### 4. Vercel に環境変数を設定

Settings → Environment Variables に[環境変数一覧](#必要な環境変数)の値を登録します。

> ⚠️ **`.env.local` は本番に反映されません。** Git管理外のため、Vercelに別途登録する必要があります。

> ⚠️ **環境変数を変更したら必ず Redeploy してください。**
> すでに動いているデプロイには反映されません。変更しただけでは
> 古い値のまま動き続けます（Deployments → 対象 → Redeploy）。

### 5. デプロイして確認

| # | 確認 | 期待する結果 |
|---|---|---|
| 1 | トップページを開く | 表示される |
| 2 | 管理画面にログイン | 問い合わせ一覧が表示される |
| 3 | 顧客チャットで質問する | AIが回答する |
| 4 | 管理画面から返信する | **顧客側に数秒以内で表示される** |
| 5 | 別ブラウザで顧客チャットを開く | **他の顧客の会話が見えない** |

**4が失敗する場合は手順1のRealtime、3が「担当者に接続しています。」になる場合は `GEMINI_API_KEY` を確認してください。**

### 運用を停止するとき

`LIVE_CHAT_CLOSED=1` を設定して Redeploy すると、顧客チャットが受付終了の案内ページに切り替わります。フラグを外して Redeploy すれば元に戻ります。

---

## よく使うコマンド

| コマンド | 用途 |
|---|---|
| `npx next dev` | 開発サーバー起動 |
| `npx tsc --noEmit` | 型チェック |
| `npx next lint` | ESLint |
| `rm -rf .next && npx next build` | ビルド |

> ⚠️ **`next dev` 起動中に `next build` を実行しないでください。** 同じ `.next` を奪い合って壊れ、ログに何も出ないままページが500や404になります。逆順でも同様です。どちらも `rm -rf .next` してから起動し直してください。

変更したら**型チェック・ESLint・ビルドの3つ**を通してから完了としてください。

---

## 必要な環境変数

キー名のみ記載します。**値は `.gitignore` 対象のため別途入手してください。**

| 変数名 | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ブラウザからSupabaseへ接続するURL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | 管理画面Auth・顧客Realtime用の公開キー |
| `SUPABASE_URL` | サーバー側からの接続URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Action用。**RLSを迂回する。絶対に公開しない** |
| `GEMINI_API_KEY` | Gemini API 呼び出し。**絶対に公開しない** |
| `LIVE_CHAT_CLOSED` | 任意。`1` で顧客チャットを停止し受付終了の案内を表示 |

> **`SUPABASE_SERVICE_ROLE_KEY` と `GEMINI_API_KEY` に `NEXT_PUBLIC_` を付けないでください。**
> 付けた瞬間ブラウザへ配信され、全顧客の会話が誰でも読み書きできる状態になります。

---

## つまずきやすい点

| 症状 | 原因 |
|---|---|
| チャットが開かない・422エラー | 手順3の匿名サインインが未設定 |
| 返信しても顧客画面に出ない | 手順4のRealtimeが未設定 |
| AIが「担当者に接続しています。」しか返さない | `GEMINI_API_KEY` が未設定、または無料枠切れ |
| ログインできない | 手順3の「Auto Confirm User」が未チェック |
| スタイルが当たらない | `tailwind.config.ts` 変更後に dev を再起動していない |

---

## 詳細ドキュメント

詳しい設計・RLS・Realtime・AIモデル変更手順は
[docs/manual-developer-detail.md](manual-developer-detail.md) を参照してください。

- システム構成・エスカレーション判定の分岐（図あり）
- ディレクトリ構成とファイルの責務
- RLSポリシーの意図と検証方法
- Realtime購読と再接続
- AIモデル変更とリグレッションテスト手順
- **触ると壊れる箇所（変更前に必読）**
- 用語集

AIエージェントに引き継ぐ場合は、リポジトリルートの [AGENTS.md](../AGENTS.md) を読ませてください。

## 関連ドキュメント

- [オペレーター向け操作マニュアル](manual-operator.md)
- [FAQ編集者向けマニュアル](manual-faq.md)
- [検証シナリオ](test-scenarios.md)
