// Roda um comando com os emuladores do Firebase num projeto "demo-" (nada fala com a produção).
// Uso: node tools/with-emulators.mjs <serviços> "<comando>"   ex.: node tools/with-emulators.mjs database "node --test"
// No Windows o `emulators:exec` encerra sem matar o Java do emulador do Realtime Database, e a porta 9000
// fica presa para a próxima execução; por isso a limpeza antes e depois.
import { spawnSync } from 'node:child_process';

const [services, command] = process.argv.slice(2);
if (!services || !command) {
  console.error('Uso: node tools/with-emulators.mjs <serviços> "<comando>"');
  process.exit(2);
}

const DATABASE_PORT = 9000;

function stopLeftoverDatabaseEmulator() {
  if (process.platform !== 'win32' || !services.includes('database')) return;
  // Só encerra o processo que escuta na porta se for o jar do emulador
  const ps = `Get-NetTCPConnection -LocalPort ${DATABASE_PORT} -State Listen -ErrorAction SilentlyContinue | ForEach-Object { $p = Get-CimInstance Win32_Process -Filter "ProcessId=$($_.OwningProcess)"; if ($p.CommandLine -like '*firebase-database-emulator*') { Stop-Process -Id $p.ProcessId -Force } }`;
  spawnSync('powershell', ['-NoProfile', '-NonInteractive', '-Command', ps], { stdio: 'ignore' });
}

stopLeftoverDatabaseEmulator();
const result = spawnSync(
  `npx --no-install firebase emulators:exec --only ${services} --project demo-rodizio "${command}"`,
  { stdio: 'inherit', shell: true }
);
stopLeftoverDatabaseEmulator();
process.exit(result.status ?? 1);
