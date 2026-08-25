const fs = require("fs");
const path = require("path");

const PROJECT_REF = "ukzqruepeduxpaiqccfg";
const BASE_URL = "https://" + PROJECT_REF + ".supabase.co";
const BUCKET = "backups";
const LOCAL_DIR = path.join(__dirname, "..", "backups");

function loadKey() {
  const envPath = path.join(__dirname, "..", ".env.backup");
  const raw = fs.readFileSync(envPath, "utf-8");
  const m = raw.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
  if (!m) throw new Error("SUPABASE_SERVICE_ROLE_KEY not found in .env.backup");
  return m[1].trim();
}

async function listBackups(token) {
  const res = await fetch(BASE_URL + "/storage/v1/object/list/" + BUCKET, {
    method: "POST",
    headers: { apikey: token, Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 100, sortBy: { column: "created_at", order: "desc" } }),
  });
  if (!res.ok) throw new Error("List failed: " + (await res.text()));
  const all = await res.json();
  return all.filter(function(f) { return f.name.startsWith("backup-"); });
}

async function downloadBackup(token, filename) {
  const res = await fetch(BASE_URL + "/storage/v1/object/" + BUCKET + "/" + filename, {
    headers: { apikey: token, Authorization: "Bearer " + token },
  });
  if (!res.ok) throw new Error("Download failed: " + (await res.text()));
  return await res.text();
}

async function restore() {
  const token = loadKey();
  const filename = process.argv[2];

  if (!filename) {
    console.log("=== Available backups ===\n");
    const files = await listBackups(token);
    if (files.length === 0) { console.log("No backups found."); return; }
    files.forEach(function(f, i) {
      const date = new Date(f.created_at).toLocaleString("vi-VN");
      const size = f.metadata ? Math.round(f.metadata.size / 1024) + " KB" : "?";
      console.log("  " + (i + 1) + ". " + f.name + "  (" + date + ", " + size + ")");
    });
    console.log("\nUsage: npm run restore -- <filename>");
    console.log("Example: npm run restore -- " + files[0].name);
    return;
  }

  console.log("Downloading " + filename + "...");
  const sql = await downloadBackup(token, filename);

  if (!fs.existsSync(LOCAL_DIR)) fs.mkdirSync(LOCAL_DIR, { recursive: true });
  const localPath = path.join(LOCAL_DIR, filename);
  fs.writeFileSync(localPath, sql, "utf-8");

  console.log("Saved: " + localPath);
  console.log("Size: " + Math.round(sql.length / 1024) + " KB");
  console.log("\n=== Restore instructions ===");
  console.log("1. Open: https://supabase.com/dashboard/project/" + PROJECT_REF + "/sql/new");
  console.log("2. Copy content from: " + localPath);
  console.log("3. Paste into SQL Editor");
  console.log("4. Click 'Run'");
  console.log("\nDone! All tables will be truncated + restored from backup.");
}

restore().catch(function(e) {
  console.error("Restore failed:", e.message);
  process.exit(1);
});
