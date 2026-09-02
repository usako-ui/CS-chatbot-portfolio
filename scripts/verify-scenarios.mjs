/**
 * 検証シナリオ実行スクリプト（docs/test-scenarios.md の8件）
 *
 * 実行：node scripts/verify-scenarios.mjs        全8件
 *       node scripts/verify-scenarios.mjs 4 6    番号を指定して個別実行
 *
 * lib/prompt.ts の実プロンプトと Supabase 上の実FAQを使い、
 * エスカレーション判定が期待どおりか確認する。
 * 認証・所有権チェックは Server Action の外殻のため、ここではAI判定部分のみを見る。
 *
 * 【注意】Gemini 無料枠は 5リクエスト/分。
 * 連続実行すると 429 になるため、リクエスト間に待機を入れてある。
 * プロンプトを変更したら必ず全8件を流し直すこと。
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { GoogleGenAI, Type } from '@google/genai';
import { buildSystemInstruction, getEscalationMessage } from '../lib/prompt.ts';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: faqs } = await supabase
  .from('faqs').select('id, category, question, answer, is_active')
  .eq('is_active', true).order('category', { ascending: true });

// lib/faq.ts の buildFaqPromptText と同じ整形
const faqText = faqs
  .map((f, i) => `[FAQ ${i + 1}]（${f.category}）\nQ: ${f.question}\nA: ${f.answer}`)
  .join('\n\n');
const systemInstruction = buildSystemInstruction(faqText);
console.log(`FAQ ${faqs.length}件 / プロンプト ${systemInstruction.length}文字\n`);

const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });

const SCHEMA = {
  type: Type.OBJECT,
  properties: {
    answer: { type: Type.STRING },
    escalate: { type: Type.BOOLEAN },
    reason: { type: Type.STRING },
  },
  required: ['answer', 'escalate', 'reason'],
  propertyOrdering: ['answer', 'escalate', 'reason'],
};

const ALL = [
  [1, '在庫切れの商品はいつ再入荷しますか？', false],
  [2, '送料はいくらですか？', false],
  [3, '届いた商品が壊れていました', false],
  [4, '先週注文した商品の請求金額が二重になっているようなので調べてほしい', true],
  [5, '対応が遅すぎる。責任者を出してください', true],
  [6, '御社の株価は今いくらですか？', true],
  [7, '返品したいのですが', false],
  [8, '定期購入の解約方法と、ポイントの有効期限を教えて', false],
];
// 無料枠は 5リクエスト/分。引数で対象シナリオを絞れるようにする
const only = process.argv.slice(2).map(Number);
const scenarios = only.length ? ALL.filter(([no]) => only.includes(no)) : ALL;

/** 無料枠5RPMに収めるための待機（ミリ秒） */
const REQUEST_INTERVAL_MS = 13_000;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

let ng = 0;
for (const [index, [no, message, expectEscalate]] of scenarios.entries()) {
  if (index > 0) await sleep(REQUEST_INTERVAL_MS);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  const started = Date.now();
  try {
    const res = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: message,
      config: {
        systemInstruction,
        responseMimeType: 'application/json',
        responseSchema: SCHEMA,
        maxOutputTokens: 1024,
        temperature: 0.2,
        thinkingConfig: { thinkingBudget: 0 },
        abortSignal: controller.signal,
      },
    });
    const r = JSON.parse(res.text);
    const ok = r.escalate === expectEscalate;
    if (!ok) ng++;
    const shown = r.escalate ? getEscalationMessage(r.reason) : r.answer;
    console.log(`#${no} ${ok ? 'OK ' : 'NG '} escalate=${r.escalate}（期待 ${expectEscalate}） reason=${r.reason || '-'} ${Date.now() - started}ms`);
    console.log(`    ${shown.replace(/\n/g, ' ')}\n`);
  } catch (e) {
    ng++;
    console.log(`#${no} NG  例外: ${e?.message ?? e}\n`);
  } finally {
    clearTimeout(timer);
  }
}
console.log(ng === 0 ? '全シナリオ 期待通り' : `${ng}件が期待と不一致`);
