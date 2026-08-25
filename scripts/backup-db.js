const fs = require("fs");
const path = require("path");

const PROJECT_REF = "ukzqruepeduxpaiqccfg";
const BASE_URL = "https://" + PROJECT_REF + ".supabase.co";
const BUCKET = "backups";
const KEEP_DAYS = 30;

const TABLES = [
  "User", "Classroom", "ClassMember", "Exam", "ExamAssignment",
  "Question", "QuestionBankItem", "Submission", "Report",
  "Flashcard", "StudyTask", "SubjectProgress", "Notification",
  "GuestParticipant", "AiImportLog", "AppLog", "SystemSetting",
];

function loadKey() {
  const envPath = path.join(__dirname, "..", ".env.backup");
  const raw = fs.readFileSync(envPath, "utf-8");
  const m = raw.match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m);
  if (!m) throw new Error("SUPABASE_SERVICE_ROLE_KEY not found in .env.backup");
  return m[1].trim();
}

function escapeVal(v) {
  if (v === null || v === undefined) return "NULL";
  if (typeof v === "number") return String(v);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (v instanceof Date) return "'" + v.toISOString() + "'";
  if (typeof v === "object") return "'" + JSON.stringify(v).replace(/'/g, "''") + "'";
  return "'" + String(v).replace(/'/g, "''") + "'";
}

async function fetchAll(token, table) {
  const rows = [];
  let offset = 0;
  const pageSize = 1000;
  while (true) {
    const url = BASE_URL + "/rest/v1/" + table + "?select=*&offset=" + offset + "&limit=" + pageSize;
    const res = await fetch(url, {
      headers: { apikey: token, Authorization: "Bearer " + token },
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(table + " " + res.status + ": " + err.slice(0, 200));
    }
    const batch = await res.json();
    rows.push.apply(rows, batch);
    if (batch.length < pageSize) break;
    offset += pageSize;
  }
  return rows;
}

async function ensureBucket(token) {
  const res = await fetch(BASE_URL + "/storage/v1/bucket/" + BUCKET, {
    headers: { apikey: token, Authorization: "Bearer " + token },
  });
  if (res.status === 404) {
    const create = await fetch(BASE_URL + "/storage/v1/bucket", {
      method: "POST",
      headers: { apikey: token, Authorization: "Bearer " + token, "Content-Type": "application/json" },
      body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false, fileSizeLimit: 5242880 }),
    });
    if (!create.ok) throw new Error("Create bucket failed: " + (await create.text()));
    console.log('Created bucket "' + BUCKET + '"');
  }
}

async function uploadBackup(token, filename, sqlContent) {
  const path = filename;
  const res = await fetch(BASE_URL + "/storage/v1/object/" + BUCKET + "/" + path, {
    method: "POST",
    headers: {
      apikey: token,
      Authorization: "Bearer " + token,
      "Content-Type": "application/sql",
      "x-upsert": "true",
    },
    body: sqlContent,
  });
  if (!res.ok) throw new Error("Upload failed: " + (await res.text()));
}

async function listBackups(token) {
  const res = await fetch(BASE_URL + "/storage/v1/object/list/" + BUCKET, {
    method: "POST",
    headers: { apikey: token, Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ prefix: "", limit: 5000, sortBy: { column: "created_at", order: "desc" } }),
  });
  if (!res.ok) return [];
  const all = await res.json();
  return all.filter(function(f) { return f.name.startsWith("backup-"); });
}

async function deleteOldBackups(token) {
  const files = await listBackups(token);
  const now = Date.now();
  const toDelete = files.filter(function(f) {
    const created = new Date(f.created_at).getTime();
    return now - created > KEEP_DAYS * 86400000;
  });
  if (toDelete.length === 0) return 0;
  const paths = toDelete.map(function(f) { return f.name; });
  const res = await fetch(BASE_URL + "/storage/v1/object/" + BUCKET, {
    method: "DELETE",
    headers: { apikey: token, Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify(paths),
  });
  if (!res.ok) console.log("Cleanup warning: " + (await res.text()).slice(0, 100));
  return toDelete.length;
}

async function backup() {
  const token = loadKey();
  console.log("=== EduTest DB Backup ===");
  console.log("Project: " + PROJECT_REF);
  console.log("Time: " + new Date().toISOString());

  await ensureBucket(token);

  var totalRows = 0;
  var lines = [];
  lines.push("-- EduTest DB backup: " + new Date().toISOString());
  lines.push("-- Source: Supabase REST API (" + PROJECT_REF + ")");
  lines.push("");

  for (var i = 0; i < TABLES.length; i++) {
    var table = TABLES[i];
    try {
      var rows = await fetchAll(token, table);
      lines.push("");
      lines.push("-- TABLE: " + table + " (" + rows.length + " rows)");
      if (rows.length === 0) { console.log("  " + table + ": 0 rows"); continue; }

      var colNames = Object.keys(rows[0]);
      var colList = colNames.map(function(c) { return '"' + c + '"'; }).join(", ");

      for (var j = 0; j < rows.length; j++) {
        var vals = colNames.map(function(c) { return escapeVal(rows[j][c]); }).join(", ");
        lines.push('INSERT INTO "' + table + '" (' + colList + ") VALUES (" + vals + ");");
      }
      totalRows += rows.length;
      console.log("  " + table + ": " + rows.length + " rows");
    } catch (e) {
      console.log("  " + table + ": SKIP (" + e.message.slice(0, 80) + ")");
    }
  }

  lines.push("");
  lines.push("-- Total: " + totalRows + " rows");

  var sql = lines.join("\n");
  var ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  var filename = "backup-" + ts + ".sql";

  console.log("\nUploading " + filename + " (" + Math.round(sql.length / 1024) + " KB)...");
  await uploadBackup(token, filename, sql);

  var deleted = await deleteOldBackups(token);

  console.log("\n=== DONE ===");
  console.log("File: " + filename);
  console.log("Rows: " + totalRows);
  console.log("Tables: " + TABLES.length);
  if (deleted > 0) console.log("Cleaned: " + deleted + " old backup(s)");
  console.log("View: https://supabase.com/dashboard/project/" + PROJECT_REF + "/storage/buckets/" + BUCKET);
}

backup().catch(function(e) {
  console.error("Backup FAILED:", e.message);
  process.exit(1);
});
