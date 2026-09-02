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
