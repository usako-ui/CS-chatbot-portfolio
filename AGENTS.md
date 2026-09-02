# AGENTS.md

AIコーディングエージェント向けの作業ルールです。人が読む資料は
[`docs/manual-developer.md`](docs/manual-developer.md) にあります。

このファイルは「引き継いだAIが最初に読む1枚」として置いています。
Claude Code の場合は、起動後に次のように指示すれば読み込めます。

```
AGENTS.md と docs/manual-developer.md を読んで、現状を把握してから作業してください。
```

---

## このプロジェクトは何か

自然派スキンケアEC「BOTANICA」（架空）のCSチャットボット。
顧客の問い合わせにまずAIが答え、**FAQに根拠が無い質問・個別対応が必要な案件だけを
人間のオペレーターへ引き継ぐ**。引き継ぎ判定がこのシステムの中心機能。

| レイヤー | 技術 |
|---|---|
| フレームワーク | Next.js 15（App Router） |
| DB / Auth / Realtime | Supabase（PostgreSQL・RLS有効） |
| AI | Gemini 2.5 Flash |
| デプロイ | Vercel |
| 言語 / スタイル | TypeScript / Tailwind CSS |

---

## 作業を始める前に読むもの

| 目的 | ファイル |
|---|---|
| 全体像・設計意図・図 | `docs/manual-developer.md` |
| 機能要件・DBスキーマ・受入条件（AC-001〜AC-017） | `requirements.md` |
| AI判定の検証シナリオと期待値 | `docs/test-scenarios.md` |
| 型定義（`any` を使わずここを参照する） | `types/index.ts` |

**`docs/manual-developer.md` の「9. 触ると壊れる箇所」は変更前に必ず読むこと。**
過去に実際に踏んだ不具合が8件挙がっている。

---

## 絶対に守ること

これを破ると、動いているように見えて壊れる。

### セキュリティ

- **顧客のDB書き込みは必ず Server Action 経由。** ブラウザから Supabase を直接叩かない
- **Server Action は `service_role` で動くのでRLSが効かない。**
  顧客IDは `requireCustomerId()` で Cookie 上のJWTから確定させ、
  `conversationId` は `requireOwnedConversation()` で所有権を突合する。
  **引数で渡された userId を信用しない**
- `SUPABASE_SERVICE_ROLE_KEY` と `GEMINI_API_KEY` に **`NEXT_PUBLIC_` を付けない**
  （付けた瞬間ブラウザに配信され、全顧客の会話が読み書きできる状態になる）
- **`lib/prompt.ts` をクライアントコンポーネントから import しない。**
  エスカレーション判定ルールごと公開JSに載る。`server-only` で防いでいる
- オペレーター判定に `auth.role() = 'authenticated'` を使わない。
  **匿名サインインした顧客も `authenticated` になる。** 必ず `private.is_operator()` を通す

### 設計

- 固定文言は `lib/messages.ts` に集約する。コンポーネントに直書きしない
- AI接続は `lib/gemini.ts` に閉じる。業務判断を持ち込まない
- `lib/aiReply.ts` は**例外を投げない**。失敗時もエスカレーション結果を返す
- 体験デモ（`/demo-ec`）は **Supabase を参照しない**。FAQは `lib/demoFaq.ts` を使う

### コード

- `any` 型を使わない。型は `types/index.ts` を参照する
- コメントは日本語。**「何をしているか」ではなく「なぜそうしたか」を書く**
- エラーハンドリングを省略しない（try-catch・フォールバック必須）
- デバッグ用の `console.log` は消す（`console.error` は残してよい）
- 絵文字をコードに含めない。アイコンは `components/icons/` のSVGを使う

---

## 変更したら必ず実行する

```bash
npx tsc --noEmit                  # 型チェック
npx next lint                     # ESLint
rm -rf .next && npx next build    # ビルド
```

**3つとも通ってから完了とすること。**

AIの判定に関わる変更（`lib/prompt.ts`・`lib/gemini.ts`・`lib/messages.ts`）を
した場合は、`docs/manual-developer.md` の
「8. AIモデル変更とリグレッションテスト」の手順も実行する。

---

## 環境の注意

- **`npx next dev` 起動中に `npx next build` を実行しない。**
  同じ `.next` を奪い合って壊れ、ログに何も出ないままページが500や404になる。
  逆順（build後にdev）でも壊れる。どちらも `rm -rf .next` してから起動し直す
- `tailwind.config.ts` を変更したら dev を再起動する
  （起動中のプロセスは古い設定を持ち続け、エラーにならず「スタイルが当たらない」形で出る）
- **Gemini は無料枠。** 日次20リクエスト・分次5リクエスト、リセットは日本時間16:00。
  検証で何リクエスト消費するかを見積もってから実行する
- 枠切れ時は「担当者に接続しています。」が出る。
  **これはAIの回答ではなくAPIエラーのフォールバック。**「AIの精度が悪い」と誤診しやすい

---

## リポジトリに含まれないもの

次のファイルは `.gitignore` 対象で、クローンしただけでは手に入らない。
**必要な場合は依頼者に共有を求めること。**

| ファイル | 内容 |
|---|---|
| `.env.local` | 環境変数の実値 |
| `_verify.local/` | Playwright ベースの検証スクリプト |
| `_operator-credentials.local.md` | オペレーターのログイン情報 |
| `CLAUDE.md` / `tasks.md` / `progress.md` | 制作時の内部資料 |

---

## 作業の進め方

1. **変更前に、何をどう変えるかを説明する。** いきなり書き換えない
2. 影響範囲を確認する（特に上の「絶対に守ること」に触れるか）
3. 実装する
4. 型チェック・Lint・ビルドを通す
5. 動作を確認する。確認できていないことを「できた」と書かない
