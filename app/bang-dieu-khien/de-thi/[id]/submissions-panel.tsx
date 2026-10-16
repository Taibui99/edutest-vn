"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, ChevronDown, ChevronRight, Trophy, CheckCircle2, XCircle, MinusCircle, ShieldAlert, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Dropdown } from "@/components/ui/dropdown";
import { NumberInput } from "@/components/ui/number-input";
import { EmptyState } from "@/components/ui/empty-state";
import { Users } from "lucide-react";
import { isQuestionCorrect, isAutoGraded, type AnswerValue } from "@/lib/grading";
import { labelOf, MAX_VIOLATIONS } from "@/lib/integrity";

export type SubRow = {
  id: string;
  studentName: string;
  studentClass: string;
  score: number;
  correctCount: number;
  totalQuestions: number;
  durationSeconds: number;
  submittedAt: string;
  /* Số lần học sinh đã làm bài (điểm lấy theo lượt MỚI NHẤT). 1 = chưa làm lại. */
  attemptCount: number;
  answers: Record<string, AnswerValue>;
  /* GĐ2 — cờ rủi ro do SERVER tính lúc chốt bài (`lib/integrity.ts`).
   * Chỉ để giáo viên xem, không ảnh hưởng điểm. */
  violationCount: number;
  riskScore: number;
  riskLevel: string;
  autoSubmitted: boolean;
  events: { id: string; type: string; severity: string; at: string }[];
  /* GRADE-1: điểm chấm tay {questionId: điểm} cho câu tự luận (null = chưa chấm). */
  manualScores: Record<string, number> | null;
};

export type SubQuestion = {
  id: string;
  type: string;
  text: string;
  options: string[];
  answer: string;
  grading?: unknown;
  order: number;
  points: number;
};

type SortKey = "latest" | "scoreDesc" | "scoreAsc" | "fastest";

/* GRADE-1 — chấm điểm từng câu tự luận ngay trong dòng bài nộp. Lưu là PATCH
 * lên server (tính lại điểm bằng đúng hàm chấm của đường nộp), xong refresh
 * để bảng + stats cùng mới. */
function EssayGrader({ subId, questionId, maxPoints, initialValue, onSaved }: {
  subId: string;
  questionId: string;
  maxPoints: number;
  initialValue: number | null;
  onSaved: () => void;
}) {
  const [val, setVal] = useState<number>(initialValue ?? 0);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      const res = await fetch(`/api/submissions/${subId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ manualScores: { [questionId]: val } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Không lưu được điểm");
      setMsg(`Đã lưu — tổng điểm bài này: ${data.submission.score}/10`);
      onSaved();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Không lưu được điểm");
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="mt-2 rounded-lg bg-[var(--warning-light)]/50 border border-[var(--warning-border)] p-2.5 flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-bold text-[var(--warning-dark)]">
        {initialValue != null ? `Đã chấm ${initialValue}/${maxPoints}đ` : `Chấm tay (tối đa ${maxPoints}đ):`}
      </span>
      <NumberInput value={val} onChange={setVal} min={0} max={maxPoints} step={0.25} className="w-24" />
      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="h-8 px-3 rounded-lg bg-[var(--primary)] text-xs font-bold text-white disabled:opacity-50 hover:bg-[var(--primary-hover)]"
      >
        {saving ? "Đang lưu..." : "Lưu điểm"}
      </button>
      {msg && <span className="text-[11px] font-semibold text-[var(--text-secondary)]">{msg}</span>}
    </div>
  );
}

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: "latest", label: "Mới nhất" },
  { key: "scoreDesc", label: "Điểm cao → thấp" },
  { key: "scoreAsc", label: "Điểm thấp → cao" },
  { key: "fastest", label: "Nộp nhanh nhất" },
];

function scoreColor(score: number) {
  if (score >= 8) return { text: "var(--success)", bg: "var(--success-light)" };
  if (score >= 6.5) return { text: "var(--warning)", bg: "var(--warning-light)" };
  return { text: "var(--danger)", bg: "var(--danger-light)" };
}

const RISK_STYLES: Record<string, { text: string; bg: string; label: string }> = {
  low: { text: "var(--blue)", bg: "var(--blue-light)", label: "Thấp" },
  medium: { text: "var(--warning)", bg: "var(--warning-light)", label: "Vừa" },
  high: { text: "var(--danger)", bg: "var(--danger-light)", label: "Cao" },
};

function riskStyle(level: string) {
  return RISK_STYLES[level] ?? { text: "var(--text-muted)", bg: "var(--gray-100)", label: level };
}

const SEVERITY_DOT: Record<string, string> = {
  low: "var(--blue)",
  medium: "var(--warning)",
  high: "var(--danger)",
};

/* Chồng cờ chỉ hiện khi THẬT SỰ có vi phạm — bài sạch không cần thêm chi tiết. */
function RiskChip({ sub }: { sub: SubRow }) {
  if (sub.riskLevel === "none") return null;
  const r = riskStyle(sub.riskLevel);
  return (
    <span
      className="inline-flex shrink-0 items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-black"
      style={{ background: r.bg, color: r.text }}
      title={sub.autoSubmitted ? `Đã chạm ngưỡng ${MAX_VIOLATIONS} lần vi phạm — giáo viên xem lại` : "Có nhật ký vi phạm — giáo viên tự quyết định cách xử lý"}
    >
      <ShieldAlert size={10} />
      {r.label} · {sub.riskScore}
      {sub.autoSubmitted ? " · chạm ngưỡng" : ""}
    </span>
  );
}

function renderAnswer(q: SubQuestion, selected: AnswerValue | undefined) {
  if (selected === undefined || selected === null) return null;
  if (q.type === "mcq" && typeof selected === "string") {
    const idx = selected.charCodeAt(0) - 65;
    return (
      <span>
        <strong>{selected}.</strong> {q.options[idx] ?? "—"}
      </span>
    );
  }
  if (q.type === "true_false") {
    const map = selected as Record<string, boolean>;
    return (
      <div className="flex flex-wrap gap-1.5">
        {Object.keys(map).sort((a, b) => Number(a) - Number(b)).map((k) => (
          <span key={k} className="rounded-md bg-[var(--gray-100)] px-2 py-0.5 text-xs">
            {String.fromCharCode(97 + Number(k))}) {map[k] ? "Đúng" : "Sai"}
          </span>
        ))}
      </div>
    );
  }
  if (q.type === "short_answer" && typeof selected === "string") return <span>“{selected}”</span>;
  if (q.type === "essay" && typeof selected === "string") {
    return selected.trim() ? <span className="whitespace-pre-wrap line-clamp-3">“{selected}”</span> : null;
  }
  return <span className="text-[var(--text-muted)]">(dữ liệu không khớp)</span>;
}

function renderCorrect(q: SubQuestion) {
  if (q.type === "mcq") {
    const idx = (q.answer || "A").charCodeAt(0) - 65;
    return (
      <span>
        <strong>{q.answer}.</strong> {q.options[idx] ?? "—"}
      </span>
    );
  }
  if (q.type === "true_false") {
    const statements = ((q.grading as { statements?: Array<{ answer?: boolean }> } | null)?.statements || []).map((s) => Boolean(s.answer));
    return (
      <div className="flex flex-wrap gap-1.5">
        {statements.map((val, i) => (
          <span key={i} className="rounded-md bg-[var(--mint-light)] px-2 py-0.5 text-xs text-[var(--mint)]">
            {String.fromCharCode(97 + i)}) {val ? "Đúng" : "Sai"}
          </span>
        ))}
      </div>
    );
  }
  if (q.type === "short_answer") {
    const accepted = (q.grading as { acceptedAnswers?: string[] } | null)?.acceptedAnswers || [];
    return <span>{accepted.join(", ") || "—"}</span>;
  }
  return null;
}

function formatDur(s: number) {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export function SubmissionsPanel({ subs, questions }: { subs: SubRow[]; questions: SubQuestion[] }) {
  const router = useRouter();
  const [sort, setSort] = useState<SortKey>("latest");
  // GĐ2 — lọc nhanh bài có cờ để giáo viên soi từng nhóm thay vì cuộn hết bảng.
  const [riskFilter, setRiskFilter] = useState<"all" | "flagged">("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date>(() => new Date());
  const [refreshing, setRefreshing] = useState(false);

  /* RT-1 — tự tải lại danh sách mỗi 30s để GV coi thi thấy bài mới nộp mà
   * không cần F5. router.refresh() render lại phần server (bảng + stats +
   * phân bố) nhưng giữ nguyên filter/sort/dòng đang mở (state client).
   * Chỉ chạy khi tab đang hiển thị; tab ẩn thì trình duyệt đã tự giãn timer. */
  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setRefreshing(true);
      setUpdatedAt(new Date());
      router.refresh();
    }, 30_000);
    return () => window.clearInterval(id);
  }, [router]);

  // Dừng xoay khi dữ liệu mới về (subs đổi tham chiếu); quá 20s chưa về thì
  // coi như mạng chậm, dừng để không xoay vô hạn.
  const subsRef = useRef(subs);
  useEffect(() => {
    if (subsRef.current !== subs) {
      subsRef.current = subs;
      setRefreshing(false);
    } else {
      const t = window.setTimeout(() => setRefreshing(false), 20_000);
      return () => window.clearTimeout(t);
    }
  }, [subs, refreshing]);

  const manualRefresh = () => {
    setRefreshing(true);
    setUpdatedAt(new Date());
    router.refresh();
  };

  const flaggedCount = useMemo(() => subs.filter((s) => s.riskLevel !== "none").length, [subs]);

  const sorted = useMemo(() => {
    const arr = subs.filter((s) => riskFilter === "all" || s.riskLevel !== "none");
    if (sort === "scoreDesc") arr.sort((a, b) => b.score - a.score);
    else if (sort === "scoreAsc") arr.sort((a, b) => a.score - b.score);
    else if (sort === "fastest") arr.sort((a, b) => a.durationSeconds - b.durationSeconds);
    else arr.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());
    return arr;
  }, [subs, sort, riskFilter]);

  const exportCsv = () => {
    const header = ["STT", "Tên", "Lớp", "Điểm", "Số lần làm", "Đúng", "Tổng câu", "Thời gian", "Ngày nộp", "Cờ rủi ro", "Số lần vi phạm"];
    const rows = sorted.map((s, i) => [
      i + 1,
      s.studentName,
      s.studentClass,
      s.score,
      s.attemptCount,
      s.correctCount,
      s.totalQuestions,
      formatDur(s.durationSeconds),
      new Date(s.submittedAt).toLocaleString("vi-VN"),
      s.riskLevel === "none" ? "—" : `${riskStyle(s.riskLevel).label} (${s.riskScore})`,
      s.violationCount,
    ]);
    const csv = [header, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ket-qua-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (subs.length === 0) {
    return (
      <Card padding="none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--surface-border)]">
          <h2 className="text-sm font-black text-[var(--text-primary)]">Danh sách bài nộp</h2>
          <span className="text-xs text-[var(--text-muted)]">0 học sinh</span>
        </div>
        <EmptyState icon={<Users />} title="Chưa có bài nộp" description="Chia sẻ đề để học sinh tham gia" className="py-12" />
      </Card>
    );
  }

  return (
    <Card padding="none">
      <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b border-[var(--surface-border)]">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-black text-[var(--text-primary)]">Danh sách bài nộp</h2>
          <span className="text-xs text-[var(--text-muted)]">{subs.length} học sinh</span>
          {flaggedCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-md bg-[var(--warning-light)] px-1.5 py-0.5 text-[10px] font-black text-[var(--warning)]">
              <ShieldAlert size={10} /> {flaggedCount} bài có cờ
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Dropdown
            value={riskFilter}
            onChange={(v) => setRiskFilter(v as "all" | "flagged")}
            options={[
              { value: "all", label: "Tất cả bài nộp" },
              { value: "flagged", label: "Chỉ bài có cờ" },
            ]}
            size="sm"
            ariaLabel="Lọc bài nộp"
          />
          <Dropdown
            value={sort}
            onChange={(v) => setSort(v as SortKey)}
            options={SORT_OPTIONS.map((o) => ({ value: o.key, label: o.label }))}
            size="sm"
            ariaLabel="Sắp xếp bài nộp"
          />
          <span className="hidden text-[11px] text-[var(--text-muted)] sm:inline" title="Tự tải lại mỗi 30 giây">
            Cập nhật {updatedAt.toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
          </span>
          <button
            type="button"
            onClick={manualRefresh}
            title="Tải lại danh sách ngay"
            aria-label="Tải lại danh sách bài nộp"
            className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--surface-border)] text-[var(--text-secondary)] transition hover:bg-[var(--gray-100)] hover:text-[var(--text-primary)]"
          >
            <RefreshCw size={13} className={refreshing ? "animate-spin" : undefined} />
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[var(--primary)]/20 bg-[var(--primary-light)] px-3 text-xs font-bold text-[var(--primary)] transition hover:opacity-80"
          >
            <Download size={13} /> Xuất CSV
          </button>
        </div>
      </div>

      <div className="divide-y divide-[var(--surface-border)]">
        {sorted.length === 0 && (
          <p className="px-5 py-8 text-center text-xs text-[var(--text-muted)]">Không có bài nào khớp bộ lọc.</p>
        )}
        {sorted.map((sub, i) => {
          const sc = scoreColor(sub.score);
          const open = expanded === sub.id;
          const badge = i === 0 ? "bg-[var(--warning-light)] text-[var(--warning)]" : null;
          return (
            <div key={sub.id}>
              <button
                type="button"
                onClick={() => setExpanded(open ? null : sub.id)}
                className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-[var(--gray-100)] transition-colors text-left"
              >
                {/* Hạng bài nộp (badge chỉ đổi màu nền, nội dung luôn là số). */}
                <span className={`w-5 shrink-0 text-center text-xs font-black rounded-md py-0.5 ${badge ?? "text-[var(--text-muted)]"}`}>
                  {i + 1}
                </span>
                <div className="w-8 h-8 rounded-full bg-[var(--primary-light)] flex items-center justify-center shrink-0">
                  <span className="text-xs font-black text-[var(--primary)]">{sub.studentName.charAt(0).toUpperCase()}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[var(--text-primary)] truncate flex items-center gap-1.5">
                    {sub.studentName}
                    {sub.studentClass && <span className="text-[11px] font-medium text-[var(--text-muted)]">· {sub.studentClass}</span>}
                    {sub.attemptCount > 1 && (
                      <span
                        className="shrink-0 rounded-md bg-[var(--blue-light)] px-1.5 py-0.5 text-[10px] font-black text-[var(--blue)]"
                        title={`Học sinh đã làm ${sub.attemptCount} lần — điểm lấy theo lượt mới nhất`}
                      >
                        {sub.attemptCount} lần làm
                      </span>
                    )}
                    <RiskChip sub={sub} />
                  </p>
                  <p className="text-xs text-[var(--text-muted)]">
                    {sub.correctCount}/{sub.totalQuestions} đúng · {formatDur(sub.durationSeconds)} phút
                  </p>
                </div>
                <div className="shrink-0 text-right">
                  <span className="text-sm font-black px-3 py-1 rounded-xl" style={{ background: sc.bg, color: sc.text }}>
                    {sub.score}/10
                  </span>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {new Date(sub.submittedAt).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                {open ? <ChevronDown size={16} className="shrink-0 text-[var(--text-muted)]" /> : <ChevronRight size={16} className="shrink-0 text-[var(--text-muted)]" />}
              </button>

              {open && (
                <div className="bg-[var(--gray-50)]/60 px-5 py-4 border-t border-[var(--surface-border)]">
                  {/* GĐ2 — timeline vi phạm. CHỈ gợi ý cho giáo viên: không trừ
                      điểm, không ràng buộc cách xử lý. */}
                  <div className="mb-4">
                    <p className="mb-2 flex flex-wrap items-center gap-1.5 text-xs font-black text-[var(--text-primary)]">
                      <ShieldAlert size={13} className="text-[var(--warning)]" /> Nhật ký vi phạm
                      <span className="font-semibold text-[var(--text-muted)]">
                        · {sub.events.length} sự kiện · điểm rủi ro {sub.riskScore}/100
                      </span>
                    </p>
                    {sub.events.length === 0 ? (
                      <p className="text-xs text-[var(--text-muted)]">Không ghi nhận vi phạm nào trong lần làm bài này.</p>
                    ) : (
                      <ol className="flex flex-col gap-1.5">
                        {sub.events.map((e) => (
                          <li key={e.id} className="flex items-center gap-2 text-xs">
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: SEVERITY_DOT[e.severity] ?? "var(--gray-400)" }} />
                            <span className="font-semibold text-[var(--text-secondary)]">{labelOf(e.type)}</span>
                            <span className="text-[var(--text-muted)]">· mức {e.severity}</span>
                            <span className="ml-auto shrink-0 tabular-nums text-[var(--text-muted)]">
                              {new Date(e.at).toLocaleTimeString("vi-VN")}
                            </span>
                          </li>
                        ))}
                      </ol>
                    )}
                    {sub.autoSubmitted && (
                      <p className="mt-2 rounded-lg bg-[var(--danger-light)] px-3 py-2 text-[11px] font-bold text-[var(--danger)]">
                        Đã chạm ngưỡng {MAX_VIOLATIONS} lần vi phạm. Hệ thống KHÔNG tự nộp — giáo viên xem nhật ký và tự quyết định cách xử lý.
                      </p>
                    )}
                    <p className="mt-2 text-[11px] text-[var(--text-muted)]">
                      Cờ này chỉ để tham khảo — điểm bài làm không bị thay đổi.
                    </p>
                  </div>

                  <p className="mb-3 flex items-center gap-1.5 text-xs font-black text-[var(--text-primary)]">
                    <Trophy size={13} className="text-[var(--warning)]" /> Chi tiết đáp án
                  </p>
                  <div className="flex flex-col gap-2.5">
                    {questions.map((q) => {
                      const selected = sub.answers[q.id];
                      const correct = isQuestionCorrect(q, selected);
                      const auto = isAutoGraded(q);
                      const answered = selected !== undefined && selected !== null;
                      const Icon = !answered ? MinusCircle : correct ? CheckCircle2 : XCircle;
                      const iconColor = !answered ? "var(--gray-400)" : correct ? "var(--success)" : "var(--danger)";
                      return (
                        <div key={q.id} className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] p-3">
                          <div className="flex items-start gap-2.5">
                            <Icon size={15} style={{ color: iconColor }} className="shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-[var(--text-primary)] leading-relaxed">
                                Câu {q.order + 1}. {q.text}
                              </p>
                              <div className="mt-1.5 text-xs text-[var(--text-secondary)]">
                                {answered ? (
                                  <>
                                    <span className="font-bold text-[var(--text-muted)]">Trả lời: </span>
                                    {renderAnswer(q, selected)}
                                  </>
                                ) : (
                                  <span className="text-[var(--text-muted)]">Chưa trả lời</span>
                                )}
                              </div>
                              {answered && !auto && (
                                <EssayGrader
                                  key={`${sub.id}-${q.id}-${sub.manualScores?.[q.id] ?? "-"}`}
                                  subId={sub.id}
                                  questionId={q.id}
                                  maxPoints={q.points > 0 ? q.points : 1}
                                  initialValue={sub.manualScores?.[q.id] ?? null}
                                  onSaved={() => router.refresh()}
                                />
                              )}
                              {answered && auto && !correct && (
                                <div className="mt-1.5 text-xs">
                                  <span className="font-bold text-[var(--text-muted)]">Đáp án đúng: </span>
                                  {renderCorrect(q)}
                                </div>
                              )}
                            </div>
                            <span
                              className="shrink-0 text-[11px] font-black px-2 py-0.5 rounded-md"
                              style={{
                                background: !answered ? "var(--surface-border)" : correct ? "var(--success-light)" : "var(--danger-light)",
                                color: !answered ? "var(--text-muted)" : correct ? "var(--success)" : "var(--danger)",
                              }}
                            >
                              {!answered ? "Bỏ trống" : correct ? "Đúng" : "Sai"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}