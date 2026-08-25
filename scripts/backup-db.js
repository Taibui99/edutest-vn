const fs = require("fs");
const path = require("path");

const BACKUP_DIR = path.join(__dirname, "..", "backups");
const KEEP_DAYS = 30;
const PROJECT_REF = "ukzqruepeduxpaiqccfg";
const BASE = `https://api.supabase.com/v1/projects/${PROJECT_REF}`;

function loadToken() {
  const envPath = path.join(__dirname, "..", ".env.backup");
  const raw = fs.readFileSync(envPath, "utf-8");
  const m = raw.match(/^SUPABASE_ACCESS_TOKEN=(.+)$/m);
  if (!m) throw new Error("SUPABASE_ACCESS_TOKEN not found in .env.backup — tạo token tại https://supabase.com/account/tokens");
  return m[1].trim();
}

async function api(token, method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`API ${res.status}: ${text.slice(0, 300)}`);
  return JSON.parse(text);
}

function escapeVal(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return `'${v.toISOString()}'`;
  if (typeof v === "object") return `'${JSON.stringify(v).replace(/'/g, "''")}'`;
  const s = String(v).replace(/'/g, "''");
  return `'${s}'`;
}

async function backup() {
  const token = loadToken();
  console.log(`Backup Supabase project ${PROJECT_REF}...`);

  const tables = await api(token, "POST", "/database/query", {
    query: "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  });
  console.log(`Found ${tables.length} tables`);

  const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const filePath = path.join(BACKUP_DIR, `backup-${ts}.sql`);

  if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });

  const ws = fs.createWriteStream(filePath);
  ws.write(`-- EduTest DB backup: ${new Date().toISOString()}\n`);
  ws.write(`-- Source: Supabase (${PROJECT_REF})\n\n`);

  let totalRows = 0;

  for (const { tablename } of tables) {
    const cols = await api(token, "POST", "/database/query", {
      query: `SELECT column_name FROM information_schema.columns WHERE table_schema='public' AND table_name='${tablename}' ORDER BY ordinal_position`,
    });
    const colNames = cols.map((c) => c.column_name);
    if (colNames.length === 0) continue;

    const data = await api(token, "POST", "/database/query", {
      query: `SELECT * FROM "${tablename}"`,
    });

    ws.write(`\n-- TABLE: ${tablename} (${data.length} rows)\n`);
    if (data.length === 0) continue;

    const colList = colNames.map((c) => `"${c}"`).join(", ");
    for (const row of data) {
      const vals = colNames.map((c) => escapeVal(row[c])).join(", ");
      ws.write(`INSERT INTO "${tablename}" (${colList}) VALUES (${vals});\n`);
    }
    totalRows += data.length;
    console.log(`  ${tablename}: ${data.length} rows`);
  }

  ws.write(`\n-- Total: ${totalRows} rows\n`);
  ws.end();

  console.log(`\nBackup saved: ${filePath}`);
  console.log(`Total: ${totalRows} rows`);

  // Xóa backup cũ
  const now = Date.now();
  const files = fs.readdirSync(BACKUP_DIR).filter((f) => f.startsWith("backup-") && f.endsWith(".sql"));
  let deleted = 0;
  for (const f of files) {
    const fp = path.join(BACKUP_DIR, f);
    const stat = fs.statSync(fp);
    if (now - stat.mtimeMs > KEEP_DAYS * 86400_000) {
      fs.unlinkSync(fp);
      deleted++;
    }
  }
  if (deleted > 0) console.log(`Cleaned ${deleted} old backup(s)`);
}

backup().catch((e) => {
  console.error("Backup failed:", e.message);
  process.exit(1);
});
