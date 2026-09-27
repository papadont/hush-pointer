import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const required = [
  'VITE_FIREBASE_API_KEY', 'VITE_FIREBASE_AUTH_DOMAIN', 'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET', 'VITE_FIREBASE_MESSAGING_SENDER_ID', 'VITE_FIREBASE_APP_ID',
];
const allowed = new Set([...required, 'VITE_FIREBASE_MEASUREMENT_ID', 'VITE_FIREBASE_APPCHECK_SITE_KEY']);
try {
  const variables = JSON.parse(execFileSync('gh', ['variable', 'list', '--json', 'name,value'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }));
  const values = new Map(variables.filter(({ name }) => allowed.has(name)).map(({ name, value }) => [name, value]));
  const missing = required.filter(name => !values.get(name)?.trim());
  if (missing.length) throw new Error(`GitHub Variablesに不足: ${missing.join(', ')}`);
  writeFileSync(new URL('../.env.local', import.meta.url), [...values].map(([name, value]) => `${name}=${JSON.stringify(value)}`).join('\n') + '\n', { flag: 'wx', mode: 0o600 });
  console.log('.env.localにFirebase公開設定を復元しました。');
} catch (error) {
  console.error(error.code === 'EEXIST' ? '.env.localが既にあります。上書きせず終了しました。' : '復元失敗。ghのログイン状態とリポジトリのFirebase Variablesを確認してください。');
  process.exitCode = 1;
}
