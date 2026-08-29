/**
 * エスカレーション・ステータス遷移の検証（T-13）
 *
 * 実行：node scripts/verify-escalation-flow.mjs
 *
 * 匿名ユーザーとテスト会話を作り、lib/conversations.ts と同じDB操作を辿って
 * ai_handling → waiting_operator → operator_handling → closed の遷移と
 * メッセージ保存を確認する。実行後にテストデータは必ず削除する。
 *
 * 【このスクリプトで見ないもの】
 * Server Action の外殻（Cookie上の匿名JWT検証・所有権突合）はブラウザが必要なため対象外。
 * そちらは Phase 6 の統合テスト（AC-012）で実UIを使って確認する。
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

const env = Object.fromEntries(
  fs.readFileSync('.env.local', 'utf8').split(/\r?\n/)
    .filter((l) => l.includes('=') && !l.trimStart().startsWith('#'))
    .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()])
);

const admin = createClient(env.SUPABASE_URL ?? env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

let ng = 0;
const check = (label, actual, expected) => {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) ng++;
  console.log(`${ok ? 'OK ' : 'NG '} ${label} → ${JSON.stringify(actual)}${ok ? '' : `（期待 ${JSON.stringify(expected)}）`}`);
};

const readStatus = async (id) => {
  const { data } = await admin.from('conversations').select('status, assigned_operator_id').eq('id', id).single();
  return data;
};

let userId = null;
let conversationId = null;

try {
  // 顧客役の匿名ユーザーを作る（本番と同じ signInAnonymously）
  const { data: signIn, error: signInError } = await anon.auth.signInAnonymously();
  if (signInError) throw signInError;
  userId = signIn.user.id;
  console.log(`匿名ユーザー作成: ${userId}\n`);

  const { data: conv, error: convError } = await admin
    .from('conversations')
    .insert({ customer_user_id: userId, status: 'ai_handling' })
    .select('id, status')
    .single();
  if (convError) throw convError;
  conversationId = conv.id;
  check('会話の初期ステータス', conv.status, 'ai_handling');

  // 顧客メッセージ＋AIのエスカレーション案内を保存する
  await admin.from('messages').insert([
    { conversation_id: conversationId, sender_type: 'customer', sender_id: null, content: '請求金額が二重になっています' },
    { conversation_id: conversationId, sender_type: 'ai', sender_id: null, content: '担当者がご対応します。' },
  ]);

  // ESC：ai_handling → waiting_operator
  await admin.from('conversations')
    .update({ status: 'waiting_operator', updated_at: new Date().toISOString() })
    .eq('id', conversationId);
  check('ESC後のステータス', (await readStatus(conversationId)).status, 'waiting_operator');

  // オペレーターの最初の返信：waiting_operator → operator_handling ＋ 担当者の自動割り当て
  const { data: operators } = await admin.auth.admin.listUsers();
  const operator = operators.users.find((u) => !u.is_anonymous);
  if (!operator) throw new Error('オペレーターアカウントが見つかりません');

  await admin.from('messages').insert({
    conversation_id: conversationId, sender_type: 'operator', sender_id: operator.id,
    content: 'お調べします。少々お待ちください。',
  });
  await admin.from('conversations')
    .update({ status: 'operator_handling', assigned_operator_id: operator.id, updated_at: new Date().toISOString() })
    .eq('id', conversationId);

  const afterReply = await readStatus(conversationId);
  check('初回返信後のステータス', afterReply.status, 'operator_handling');
  check('担当者の自動割り当て', afterReply.assigned_operator_id === operator.id, true);

  // 完了：operator_handling → closed
  await admin.from('conversations')
    .update({ status: 'closed', updated_at: new Date().toISOString() })
    .eq('id', conversationId);
  check('完了後のステータス', (await readStatus(conversationId)).status, 'closed');

  const { data: messages } = await admin
    .from('messages').select('sender_type').eq('conversation_id', conversationId)
    .order('created_at', { ascending: true });
  check('保存されたメッセージの送信者順', messages.map((m) => m.sender_type), ['customer', 'ai', 'operator']);
} catch (error) {
  ng++;
  console.log('NG  例外:', error?.message ?? error);
} finally {
  // テストデータを必ず消す（messages は ON DELETE CASCADE で一緒に消える）
  if (conversationId) await admin.from('conversations').delete().eq('id', conversationId);
  if (userId) await admin.auth.admin.deleteUser(userId);
  console.log('\nテストデータを削除しました');
}

console.log(ng === 0 ? '全ケース 期待通り' : `${ng}件が期待と不一致`);
process.exit(ng === 0 ? 0 : 1);
