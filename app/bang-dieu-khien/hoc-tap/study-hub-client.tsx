"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  Flame,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Smile,
  Sparkles,
  Target,
  Trash2,
  X,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { DateField } from "@/components/ui/date-field";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/empty-state";

type Task = {
  id: string;
  title: string;
  subject: string | null;
  dueDate: string | null;
  completed: boolean;
  createdAt: string;
};

type Card = {
  id: string;
  subject: string;
  deck: string;
  front: string;
  back: string;
  easinessFactor: number;
  intervalDays: number;
  repetitions: number;
  nextReviewAt: string;
  createdAt: string;
};

type SubjectProgress = { subject: string; progress: number };

const A01_SUBJECTS = ["Toán", "Vật Lý", "Tiếng Anh", "Ngữ Văn"];

export function StudyHubClient({
  initialExamDate,
  initialTasks,
  initialCards,
  initialDueCount,
  initialProgress,
  initialStreak,
}: {
  initialExamDate: string | null;
  initialTasks: Task[];
  initialCards: Card[];
  initialDueCount: number;
  initialProgress: SubjectProgress[];
  initialStreak: number;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-2">
        <ExamCountdown initialExamDate={initialExamDate} />
        <StreakCard streak={initialStreak} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2 motion-enter-stagger">
        <TaskTracker initialTasks={initialTasks} />
        <SubjectProgressPanel initialProgress={initialProgress} />
      </div>
      <FlashcardPanel initialCards={initialCards} initialDueCount={initialDueCount} />
    </div>
  );
}

// ============================================================
// ĐẾM NGƯỢC NGÀY THI (ring)
// ============================================================
function ExamCountdown({ initialExamDate }: { initialExamDate: string | null }) {
  const [examDate, setExamDate] = useState(initialExamDate);
  const [editing, setEditing] = useState(!initialExamDate);
  const [inputValue, setInputValue] = useState(initialExamDate ? initialExamDate.slice(0, 10) : "");
  const [saving, setSaving] = useState(false);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000 * 60);
    return () => clearInterval(timer);
  }, []);

  const daysLeft = useMemo(() => {
    if (!examDate) return null;
    const diff = new Date(examDate).getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [examDate, now]);

  const saveDate = async () => {
    if (!inputValue) return;
    setSaving(true);
    try {
      const res = await fetch("/api/study/exam-date", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ examDate: inputValue }),
      });
      const data = await res.json();
      if (res.ok) {
        setExamDate(data.examDate);
        setEditing(false);
      }
    } finally {
      setSaving(false);
    }
  };

  const pct = daysLeft === null ? 0 : Math.min(100, Math.round((daysLeft / 365) * 100));
  const R = 52;
  const C = 2 * Math.PI * R;

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Target className="h-4 w-4 text-[var(--primary)]" />
          Ngày thi THPT
        </CardTitle>
      </CardHeader>

      {editing ? (
        <div className="space-y-3">
          <DateField type="date" value={inputValue} onChange={(e) => setInputValue(e.target.value)} className="h-10" />
          <div className="flex gap-2">
<Button size="md" loading={saving} disabled={!inputValue} onClick={saveDate}>
            Lưu ngày thi
          </Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-6">
          <div className="relative h-32 w-32 shrink-0">
            <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
              <circle cx="60" cy="60" r={R} fill="none" stroke="var(--surface-border)" strokeWidth="10" />
              <circle
                cx="60"
                cy="60"
                r={R}
                fill="none"
                stroke="url(#countdownGradient)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C - (C * pct) / 100}
                style={{ transition: "stroke-dashoffset 0.6s ease" }}
              />
              <defs>
                <linearGradient id="countdownGradient" x1="0" y1="0" x2="1" y2="1">
                  <stop offset="0%" stopColor="#6C63FF" />
                  <stop offset="100%" stopColor="#06D6A0" />
                </linearGradient>
              </defs>
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-[var(--text-primary)]">{daysLeft}</span>
              <span className="text-xs font-medium text-[var(--text-muted)]">ngày</span>
            </div>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-[var(--text-secondary)]">Còn lại đến ngày thi THPT</p>
            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-[var(--text-primary)]">
              <CalendarDays className="h-4 w-4 text-[var(--primary)]" />
              {examDate && new Date(examDate).toLocaleDateString("vi-VN", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}
            </p>
            <p className="mt-1 text-xs text-[var(--text-muted)]">
              {pct > 0 ? `Đã dùng ${100 - pct}% quỹ thời gian 1 năm` : "Chưa đặt ngày thi"}
            </p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => setEditing(true)} icon={<Pencil className="h-3.5 w-3.5" />}>
              Đổi ngày
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ============================================================
// STREAK
// ============================================================
function StreakCard({ streak }: { streak: number }) {
  const [count, setCount] = useState(streak);
  const [saving, setSaving] = useState(false);

  const ping = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/study/streak", { method: "POST" });
      const data = await res.json();
      if (res.ok && typeof data.streak === "number") setCount(data.streak);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card padding="lg" className="relative overflow-hidden">
      <div
        className="absolute inset-0 opacity-60 dark:opacity-30"
        style={{ background: "linear-gradient(135deg, var(--coral-light), var(--warning-light))" }}
      />
      <div className="relative flex h-full items-center justify-between gap-4">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Flame className="h-4 w-4 text-[var(--coral)]" />
            Chuỗi ngày học
          </CardTitle>
          <p className="mt-2 text-4xl font-extrabold text-[var(--text-primary)]">
            {count} <span className="text-base font-semibold text-[var(--text-secondary)]">ngày liên tiếp</span>
          </p>
          <p className="mt-1 text-xs text-[var(--text-muted)]">
            Học đều mỗi ngày để giữ lửa, hôm nay đã học chưa?
          </p>
        </div>
        <Button variant="coral" loading={saving} onClick={ping} icon={<Flame className="h-4 w-4" />}>
          Điểm danh hôm nay
        </Button>
      </div>
    </Card>
  );
}

// ============================================================
// TASK TRACKER
// ============================================================
function TaskTracker({ initialTasks }: { initialTasks: Task[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [adding, setAdding] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const addTask = async () => {
    if (!title.trim()) return;
    setAdding(true);
    try {
      const res = await fetch("/api/study/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subject: subject || null, dueDate: dueDate || null }),
      });
      const data = await res.json();
      if (res.ok) {
        setTasks((prev) => [...prev, data.task]);
        setTitle("");
        setSubject("");
        setDueDate("");
      }
    } finally {
      setAdding(false);
    }
  };

  const toggleTask = async (id: string, completed: boolean) => {
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed } : t)));
    await fetch(`/api/study/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed }),
    });
  };

  const deleteTask = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    await fetch(`/api/study/tasks/${id}`, { method: "DELETE" });
  };

  const pendingCount = tasks.filter((t) => !t.completed).length;
  const doneCount = tasks.length - pendingCount;

  return (
    <Card padding="lg">
      <CardHeader className="flex flex-wrap items-center justify-between gap-2">
        <CardTitle className="flex items-center gap-2">
          <CheckSquare className="h-4 w-4 text-[var(--primary)]" />
          Việc cần làm
        </CardTitle>
        <div className="flex gap-1.5">
          <Badge variant="primary">{pendingCount} chưa xong</Badge>
          {doneCount > 0 && <Badge variant="success">{doneCount} xong</Badge>}
        </div>
      </CardHeader>

      <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <Input
          ref={titleRef}
          type="text"
          placeholder="Thêm việc cần làm..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
        />
        <Input
          type="text"
          placeholder="Môn (tuỳ chọn)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-28"
        />
        <DateField type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-36 h-9" />
        <Button onClick={addTask} loading={adding} disabled={!title.trim()} icon={<Plus className="h-4 w-4" />}>
          Thêm
        </Button>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-center gap-3 rounded-xl border p-3 transition-colors ${
              task.completed
                ? "border-[var(--surface-border)] bg-[var(--gray-100)]"
                : "border-[var(--primary-muted)] bg-[var(--primary-light)]/40 dark:bg-[var(--primary-light)]/15"
            }`}
          >
            <Checkbox checked={task.completed} onChange={(v) => toggleTask(task.id, v)} />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${task.completed ? "text-[var(--text-muted)] line-through" : "text-[var(--text-primary)]"}`}>
                {task.title}
              </p>
              {(task.subject || task.dueDate) && (
                <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-[var(--text-muted)]">
                  {task.subject && <Badge variant="secondary">{task.subject}</Badge>}
                  {task.dueDate && (
                    <span className="inline-flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {new Date(task.dueDate).toLocaleDateString("vi-VN")}
                    </span>
                  )}
                </p>
              )}
            </div>
            <button
              onClick={() => deleteTask(task.id)}
              aria-label="Xoá việc"
              className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--danger-light)] hover:text-[var(--danger)] transition-colors"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {tasks.length === 0 && (
          <EmptyState
            icon={<CheckCircle2 />}
            title="Chưa có việc gì"
            description="Thêm việc đầu tiên để bắt đầu lên kế hoạch ôn thi hiệu quả."
            action={
              <Button variant="outline" size="sm" onClick={() => titleRef.current?.focus()} icon={<Plus className="h-3.5 w-3.5" />}>
                Thêm việc đầu tiên
              </Button>
            }
          />
        )}
      </div>
    </Card>
  );
}

// ============================================================
// TIẾN ĐỘ THEO MÔN
// ============================================================
function SubjectProgressPanel({ initialProgress }: { initialProgress: SubjectProgress[] }) {
  const [progress, setProgress] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    A01_SUBJECTS.forEach((s) => (map[s] = 0));
    initialProgress.forEach((p) => (map[p.subject] = p.progress));
    return map;
  });
  const [savingSubject, setSavingSubject] = useState<string | null>(null);

  const saveProgress = async (subject: string, value: number) => {
    setProgress((prev) => ({ ...prev, [subject]: value }));
  };

  const commitProgress = async (subject: string) => {
    setSavingSubject(subject);
    try {
      await fetch("/api/study/progress", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, progress: progress[subject] }),
      });
    } finally {
      setSavingSubject(null);
    }
  };

  return (
    <Card padding="lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-[var(--primary)]" />
          Tiến độ ôn tập (khối A01)
        </CardTitle>
      </CardHeader>
      <div className="space-y-5">
        {A01_SUBJECTS.map((subject) => (
          <div key={subject}>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-sm font-medium text-[var(--text-secondary)]">{subject}</span>
              <span className="flex items-center gap-1.5 text-sm font-bold text-[var(--primary)]">
                {progress[subject]}%
              </span>
            </div>
            <Slider
              value={progress[subject]}
              onChange={(v) => saveProgress(subject, v)}
              onCommit={() => commitProgress(subject)}
              min={0}
              max={100}
              step={5}
            />
          </div>
        ))}
      </div>
    </Card>
  );
}

// ============================================================
// FLASHCARD - ÔN TẬP THEO SM-2
// ============================================================
function FlashcardPanel({
  initialCards,
  initialDueCount,
}: {
  initialCards: Card[];
  initialDueCount: number;
}) {
  const [cards, setCards] = useState(initialCards);
  const [dueCount, setDueCount] = useState(initialDueCount);
  const [mode, setMode] = useState<"list" | "review" | "add" | "ai">("list");
  const [reviewQueue, setReviewQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const [newSubject, setNewSubject] = useState("");
  const [newDeck, setNewDeck] = useState("");
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [addingCard, setAddingCard] = useState(false);
  const [editing, setEditing] = useState<Card | null>(null);
  const [deckFilter, setDeckFilter] = useState("Tất cả");
  const [aiSubject, setAiSubject] = useState("");
  const [aiTopic, setAiTopic] = useState("");
  const [generating, setGenerating] = useState(false);
  const [aiError, setAiError] = useState("");

  const generateCards = async () => {
    if (!aiSubject.trim()) { setAiError("Nhập môn học trước khi tạo"); return; }
    setGenerating(true); setAiError("");
    try {
      const res = await fetch("/api/study/flashcards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: aiSubject, topic: aiTopic }),
      });
      const data = await res.json();
      if (res.ok && Array.isArray(data.cards) && data.cards.length) {
        setCards((prev) => [...data.cards, ...prev]);
        setDueCount((prev) => prev + data.cards.length);
        setAiSubject("");
        setAiTopic("");
        setMode("list");
      } else {
        setAiError(data.error || "Không tạo được thẻ, thử lại sau");
      }
    } catch {
      setAiError("Lỗi kết nối, thử lại sau");
    } finally {
      setGenerating(false);
    }
  };

  const decks = useMemo(() => {
    const set = new Set<string>(["Tất cả"]);
    cards.forEach((c) => set.add(c.deck || "Mặc định"));
    return Array.from(set);
  }, [cards]);

  const visibleCards = useMemo(
    () => (deckFilter === "Tất cả" ? cards : cards.filter((c) => (c.deck || "Mặc định") === deckFilter)),
    [cards, deckFilter],
  );

  const startReview = () => {
    const due = cards.filter((c) => new Date(c.nextReviewAt).getTime() <= Date.now() + 60_000);
    if (due.length === 0) {
      setMode("list");
      return;
    }
    setReviewQueue(due);
    setCurrentIndex(0);
    setFlipped(false);
    setMode("review");
  };

  const resetForm = () => {
    setNewSubject("");
    setNewDeck("");
    setNewFront("");
    setNewBack("");
    setEditing(null);
  };

  const startAdd = () => {
    resetForm();
    setMode("add");
  };

  const startEdit = (card: Card) => {
    setEditing(card);
    setNewSubject(card.subject);
    setNewDeck(card.deck);
    setNewFront(card.front);
    setNewBack(card.back);
    setMode("add");
  };

  const saveCard = async () => {
    if (!newSubject.trim() || !newFront.trim() || !newBack.trim()) return;
    setAddingCard(true);
    try {
      const res = await fetch(editing ? `/api/study/flashcards/${editing.id}` : "/api/study/flashcards", {
        method: editing ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: newSubject, deck: newDeck, front: newFront, back: newBack }),
      });
      const data = await res.json();
      if (res.ok) {
        if (editing) {
          setCards((prev) => prev.map((c) => (c.id === editing.id ? data.card : c)));
        } else {
          setCards((prev) => [data.card, ...prev]);
          setDueCount((prev) => prev + 1);
        }
        resetForm();
        setMode("list");
      }
    } finally {
      setAddingCard(false);
    }
  };

  const deleteCard = async (id: string) => {
    setCards((prev) => prev.filter((c) => c.id !== id));
    await fetch(`/api/study/flashcards/${id}`, { method: "DELETE" });
  };

  const submitReview = async (quality: 1 | 3 | 5) => {
    const card = reviewQueue[currentIndex];
    if (!card) return;

    const res = await fetch(`/api/study/flashcards/${card.id}/review`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ quality }),
    });
    const data = await res.json();
    if (res.ok) {
      setCards((prev) => prev.map((c) => (c.id === card.id ? data.card : c)));
    }
    setDueCount((prev) => Math.max(0, prev - 1));

    if (currentIndex + 1 < reviewQueue.length) {
      setCurrentIndex((i) => i + 1);
      setFlipped(false);
    } else {
      setMode("list");
    }
  };

  const reviewCard = reviewQueue[currentIndex];

  return (
    <Card padding="lg">
      <CardHeader className="flex flex-wrap items-center justify-between gap-3">
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-[var(--primary)]" />
          Flashcard ôn tập
          {dueCount > 0 && <Badge variant="danger">{dueCount} đến hạn</Badge>}
        </CardTitle>
        <div className="flex flex-wrap gap-2">
          {mode !== "add" && mode !== "ai" && (
            <Button variant="outline" size="sm" onClick={() => setMode("ai")} icon={<Sparkles className="h-3.5 w-3.5" />} className="border-[var(--primary-muted)] text-[var(--primary)] hover:bg-[var(--primary-light)]">
              Tạo bằng AI
            </Button>
          )}
          {mode !== "add" && mode !== "ai" && (
            <Button variant="outline" size="sm" onClick={startAdd} icon={<Plus className="h-3.5 w-3.5" />}>
              Thêm thẻ
            </Button>
          )}
          {mode !== "review" && dueCount > 0 && (
            <Button variant="gradient" size="sm" onClick={startReview}>
              Ôn ngay ({dueCount} thẻ)
            </Button>
          )}
        </div>
      </CardHeader>

      {mode === "add" && (
        <div className="mb-4 space-y-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-hover)] p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-[var(--text-primary)]">
              {editing ? "Sửa thẻ" : "Thêm thẻ mới"}
            </p>
            {editing && (
              <Button variant="ghost" size="sm" onClick={() => { resetForm(); setMode("list"); }}>
                Huỷ sửa
              </Button>
            )}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input type="text" placeholder="Môn học" value={newSubject} onChange={(e) => setNewSubject(e.target.value)} />
            <Input type="text" placeholder="Bộ thẻ (VD: Chương 1, Từ vựng...)" value={newDeck} onChange={(e) => setNewDeck(e.target.value)} />
          </div>
          <Input
            type="text"
            placeholder="Mặt trước (câu hỏi)"
            value={newFront}
            onChange={(e) => setNewFront(e.target.value)}
          />
          <Input
            type="text"
            placeholder="Mặt sau (đáp án)"
            value={newBack}
            onChange={(e) => setNewBack(e.target.value)}
          />
          <div className="flex gap-2">
            <Button onClick={saveCard} loading={addingCard} disabled={!newSubject.trim() || !newFront.trim() || !newBack.trim()}>
              {editing ? "Lưu thay đổi" : "Lưu thẻ"}
            </Button>
            <Button variant="outline" onClick={() => { resetForm(); setMode("list"); }}>
              Huỷ
            </Button>
          </div>
        </div>
      )}

      {mode === "ai" && (
        <div className="mb-4 space-y-3 rounded-2xl border border-[var(--primary-muted)] bg-[var(--primary-light)]/40 p-4 dark:bg-[var(--primary-light)]/15">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-2 text-sm font-bold text-[var(--primary)]">
              <Sparkles className="h-4 w-4" />
              Tạo thẻ học bằng AI
            </p>
            <Button variant="ghost" size="sm" onClick={() => { setAiError(""); setMode("list"); }}>
              Đóng
            </Button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              type="text"
              placeholder="Môn học (bắt buộc)"
              value={aiSubject}
              onChange={(e) => setAiSubject(e.target.value)}
            />
            <Input
              type="text"
              placeholder="Chủ đề (VD: Từ vựng Unit 1, Định luật Newton...)"
              value={aiTopic}
              onChange={(e) => setAiTopic(e.target.value)}
            />
          </div>
          {aiError && <p className="text-xs font-semibold text-[var(--danger)]">{aiError}</p>}
          <div className="flex gap-2">
            <Button variant="gradient" onClick={generateCards} loading={generating} icon={<Sparkles className="h-4 w-4" />}>
              {generating ? "AI đang tạo..." : "Tạo thẻ"}
            </Button>
            <Button variant="outline" onClick={() => { setAiError(""); setMode("list"); }}>
              Huỷ
            </Button>
          </div>
          <p className="text-xs text-[var(--text-muted)]">AI tạo tối đa 8 thẻ cho chủ đề bạn nhập. Kiểm tra lại nội dung trước khi học.</p>
        </div>
      )}

      {mode === "review" && reviewCard && (
        <div className="flex flex-col items-center py-6">
          <div className="flex items-center gap-2 text-xs text-[var(--text-muted)] mb-4">
            <Badge variant="primary">{reviewCard.subject}</Badge>
            <span>Thẻ {currentIndex + 1}/{reviewQueue.length}</span>
          </div>

          <div className="w-full max-w-md" style={{ perspective: "1200px" }}>
            <div
              onClick={() => setFlipped(!flipped)}
              className="relative h-56 w-full cursor-pointer"
              style={{ transformStyle: "preserve-3d", transition: "transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1)", transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
            >
              <div
                className="absolute inset-0 flex items-center justify-center rounded-2xl border-2 p-6 text-center"
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  background: "linear-gradient(135deg, var(--primary-light), var(--surface-hover))",
                  borderColor: "var(--primary-muted)",
                }}
              >
                <p className="text-lg font-semibold text-[var(--text-primary)]">{reviewCard.front}</p>
              </div>
              <div
                className="absolute inset-0 flex items-center justify-center rounded-2xl border-2 p-6 text-center"
                style={{
                  backfaceVisibility: "hidden",
                  WebkitBackfaceVisibility: "hidden",
                  transform: "rotateY(180deg)",
                  background: "linear-gradient(135deg, var(--mint-light), var(--surface-hover))",
                  borderColor: "var(--mint)",
                }}
              >
                <p className="text-lg font-semibold text-[var(--text-primary)]">{reviewCard.back}</p>
              </div>
            </div>
          </div>

          <p className="mt-3 text-xs text-[var(--text-muted)]">
            Bấm vào thẻ để {flipped ? "xem lại câu hỏi" : "xem đáp án"}
          </p>

          {flipped && (
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <Button variant="coral" onClick={() => submitReview(1)} icon={<X className="h-4 w-4" />}>
                Quên
              </Button>
              <Button variant="outline" onClick={() => submitReview(3)} icon={<RotateCcw className="h-4 w-4" />}>
                Khó
              </Button>
              <Button variant="mint" onClick={() => submitReview(5)} icon={<Smile className="h-4 w-4" />}>
                Dễ
              </Button>
            </div>
          )}
        </div>
      )}

      {mode === "list" && (
        <>
          {decks.length > 1 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {decks.map((d) => (
                <button
                  key={d}
                  onClick={() => setDeckFilter(d)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${
                    deckFilter === d
                      ? "bg-[var(--gradient-brand)] text-white shadow-sm"
                      : "bg-[var(--gray-100)] text-[var(--text-muted)] hover:bg-[var(--gray-200)]"
                  }`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleCards.map((card) => (
              <div key={card.id} className="group rounded-xl border border-[var(--surface-border)] bg-[var(--surface-hover)] p-3 transition-colors hover:border-[var(--primary-muted)]">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <Badge variant="primary">{card.subject}</Badge>
                    {card.deck && card.deck !== "Mặc định" && <Badge>{card.deck}</Badge>}
                  </div>
                  <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => startEdit(card)}
                      aria-label="Sửa thẻ"
                      className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--primary-light)] hover:text-[var(--primary)] transition-colors"
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => deleteCard(card.id)}
                      aria-label="Xoá thẻ"
                      className="rounded-lg p-1.5 text-[var(--text-muted)] hover:bg-[var(--danger-light)] hover:text-[var(--danger)] transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="mt-2 text-sm font-semibold text-[var(--text-primary)] line-clamp-2">{card.front}</p>
                <p className="mt-1.5 flex items-center gap-1 text-xs text-[var(--text-muted)]">
                  <RotateCcw className="h-3 w-3" />
                  Ôn lại: {new Date(card.nextReviewAt).toLocaleDateString("vi-VN")}
                </p>
              </div>
            ))}
            {visibleCards.length === 0 && (
              <div className="col-span-2">
                <EmptyState
                  icon={<Layers />}
                  title={deckFilter === "Tất cả" ? "Chưa có thẻ nào" : "Bộ thẻ này chưa có thẻ nào"}
                  description="Tạo thẻ học để ôn tập thông minh theo thuật toán SM-2, hoặc để AI soạn giúp bạn."
                  action={
                    <div className="flex gap-2">
                      <Button size="sm" onClick={startAdd} icon={<Plus className="h-3.5 w-3.5" />}>
                        Thêm thẻ
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setMode("ai")} icon={<Sparkles className="h-3.5 w-3.5" />}>
                        Tạo bằng AI
                      </Button>
                    </div>
                  }
                />
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
