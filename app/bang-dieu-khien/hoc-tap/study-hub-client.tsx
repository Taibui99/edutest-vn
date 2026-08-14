"use client";

import { useEffect, useMemo, useState } from "react";
import { Spinner } from "@/app/components/spinner";

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
}: {
  initialExamDate: string | null;
  initialTasks: Task[];
  initialCards: Card[];
  initialDueCount: number;
  initialProgress: SubjectProgress[];
}) {
  return (
    <div className="space-y-8">
      <ExamCountdown initialExamDate={initialExamDate} />
      <div className="grid gap-6 lg:grid-cols-2 motion-enter-stagger">
        <TaskTracker initialTasks={initialTasks} />
        <SubjectProgressPanel initialProgress={initialProgress} />
      </div>
      <FlashcardPanel initialCards={initialCards} initialDueCount={initialDueCount} />
    </div>
  );
}

// ============================================================
// ĐẾM NGƯỢC NGÀY THI
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

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
      {editing ? (
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Ngày thi THPT của bạn</label>
            <input
              type="date"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="h-10 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
          <button
            onClick={saveDate}
            disabled={saving || !inputValue}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            {saving && <Spinner className="h-4 w-4" />}
            Lưu
          </button>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">Còn lại đến ngày thi THPT</p>
            <p className="text-4xl font-bold text-green-600">
              {daysLeft} <span className="text-lg font-medium text-slate-500">ngày</span>
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {examDate && new Date(examDate).toLocaleDateString("vi-VN")}
            </p>
          </div>
          <button
            onClick={() => setEditing(true)}
            className="text-sm font-semibold text-green-700 hover:text-green-800"
          >
            Đổi ngày
          </button>
        </div>
      )}
    </div>
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

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-slate-800">✅ Việc cần làm</h3>
        <span className="text-xs text-slate-500">{pendingCount} việc chưa xong</span>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        <input
          type="text"
          placeholder="Thêm việc cần làm..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTask()}
          className="flex-1 min-w-[140px] h-9 rounded-lg border border-slate-200 px-3 text-sm"
        />
        <input
          type="text"
          placeholder="Môn (tuỳ chọn)"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-28 h-9 rounded-lg border border-slate-200 px-3 text-sm"
        />
        <input
          type="date"
          value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-2 text-sm"
        />
        <button
          onClick={addTask}
          disabled={adding || !title.trim()}
          className="inline-flex h-9 items-center gap-1 rounded-lg bg-green-600 px-3 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
        >
          {adding && <Spinner className="h-3.5 w-3.5" />}
          Thêm
        </button>
      </div>

      <div className="space-y-2 max-h-80 overflow-y-auto">
        {tasks.map((task) => (
          <div
            key={task.id}
            className={`flex items-center gap-3 rounded-lg p-3 ${task.completed ? "bg-slate-50" : "bg-green-50"}`}
          >
            <input
              type="checkbox"
              checked={task.completed}
              onChange={(e) => toggleTask(task.id, e.target.checked)}
              className="h-4 w-4 accent-green-600"
            />
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${task.completed ? "text-slate-400 line-through" : "text-slate-800"}`}>
                {task.title}
              </p>
              {(task.subject || task.dueDate) && (
                <p className="text-xs text-slate-500">
                  {task.subject}
                  {task.subject && task.dueDate && " · "}
                  {task.dueDate && `Hạn: ${new Date(task.dueDate).toLocaleDateString("vi-VN")}`}
                </p>
              )}
            </div>
            <button onClick={() => deleteTask(task.id)} className="text-slate-400 hover:text-red-500 text-sm">
              ✕
            </button>
          </div>
        ))}
        {tasks.length === 0 && (
          <div className="text-sm text-slate-400 text-center py-6">Chưa có việc gì cả, thêm việc đầu tiên đi!</div>
        )}
      </div>
    </div>
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
    <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
      <h3 className="font-semibold text-slate-800 mb-4">📈 Tiến độ ôn tập (khối A01)</h3>
      <div className="space-y-4">
        {A01_SUBJECTS.map((subject) => (
          <div key={subject}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-slate-700">{subject}</span>
              <span className="text-sm font-semibold text-green-600">
                {progress[subject]}%{savingSubject === subject && <Spinner className="inline-block h-3 w-3 ml-1" />}
              </span>
            </div>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={progress[subject]}
              onChange={(e) => saveProgress(subject, Number(e.target.value))}
              onMouseUp={() => commitProgress(subject)}
              onTouchEnd={() => commitProgress(subject)}
              className="w-full accent-green-600"
            />
          </div>
        ))}
      </div>
    </div>
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
  const [mode, setMode] = useState<"list" | "review" | "add">("list");
  const [reviewQueue, setReviewQueue] = useState<Card[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);

  const [newSubject, setNewSubject] = useState("");
  const [newDeck, setNewDeck] = useState("");
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [addingCard, setAddingCard] = useState(false);
  const [deckFilter, setDeckFilter] = useState("Tất cả");

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
    const due = cards.filter((c) => new Date(c.nextReviewAt) <= new Date());
    setReviewQueue(due);
    setCurrentIndex(0);
    setFlipped(false);
    setMode("review");
  };

  const addCard = async () => {
    if (!newSubject.trim() || !newFront.trim() || !newBack.trim()) return;
    setAddingCard(true);
    try {
      const res = await fetch("/api/study/flashcards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject: newSubject, deck: newDeck, front: newFront, back: newBack }),
      });
      const data = await res.json();
      if (res.ok) {
        setCards((prev) => [data.card, ...prev]);
        setDueCount((prev) => prev + 1);
        setNewSubject("");
        setNewDeck("");
        setNewFront("");
        setNewBack("");
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

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h3 className="font-semibold text-slate-800">🗂️ Flashcard ôn tập</h3>
        <div className="flex gap-2">
          {mode !== "add" && (
            <button
              onClick={() => setMode("add")}
              className="inline-flex h-9 items-center rounded-lg border border-green-200 px-3 text-sm font-semibold text-green-700 hover:bg-green-50"
            >
              + Thêm thẻ
            </button>
          )}
          {mode !== "review" && dueCount > 0 && (
            <button
              onClick={startReview}
              className="inline-flex h-9 items-center rounded-lg bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700"
            >
              Ôn ngay ({dueCount} thẻ đến hạn)
            </button>
          )}
        </div>
      </div>

      {mode === "add" && (
        <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50 p-4 mb-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Môn học"
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
            <input
              type="text"
              placeholder="Bộ thẻ (VD: Chương 1, Từ vựng...)"
              value={newDeck}
              onChange={(e) => setNewDeck(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm"
            />
          </div>
          <textarea
            placeholder="Mặt trước (câu hỏi)"
            value={newFront}
            onChange={(e) => setNewFront(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={2}
          />
          <textarea
            placeholder="Mặt sau (đáp án)"
            value={newBack}
            onChange={(e) => setNewBack(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            rows={2}
          />
          <div className="flex gap-2">
            <button
              onClick={addCard}
              disabled={addingCard}
              className="inline-flex h-9 items-center gap-2 rounded-lg bg-green-600 px-4 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
            >
              {addingCard && <Spinner className="h-3.5 w-3.5" />}
              Lưu thẻ
            </button>
            <button
              onClick={() => setMode("list")}
              className="inline-flex h-9 items-center rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-600 hover:bg-slate-100"
            >
              Huỷ
            </button>
          </div>
        </div>
      )}

      {mode === "review" && reviewQueue[currentIndex] && (
        <div className="flex flex-col items-center py-6">
          <p className="text-xs text-slate-400 mb-2">
            Thẻ {currentIndex + 1}/{reviewQueue.length} · {reviewQueue[currentIndex].subject}
          </p>
          <div
            onClick={() => setFlipped(!flipped)}
            className="w-full max-w-md min-h-[160px] flex items-center justify-center rounded-xl border-2 border-green-200 bg-green-50 p-6 text-center cursor-pointer"
          >
            <p className="text-lg font-medium text-slate-800">
              {flipped ? reviewQueue[currentIndex].back : reviewQueue[currentIndex].front}
            </p>
          </div>
          <p className="text-xs text-slate-400 mt-2">Bấm vào thẻ để {flipped ? "xem lại câu hỏi" : "xem đáp án"}</p>

          {flipped && (
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => submitReview(1)}
                className="rounded-lg bg-red-100 px-5 py-2 text-sm font-semibold text-red-700 hover:bg-red-200"
              >
                😵 Quên
              </button>
              <button
                onClick={() => submitReview(3)}
                className="rounded-lg bg-amber-100 px-5 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-200"
              >
                🤔 Khó
              </button>
              <button
                onClick={() => submitReview(5)}
                className="rounded-lg bg-green-100 px-5 py-2 text-sm font-semibold text-green-700 hover:bg-green-200"
              >
                😄 Dễ
              </button>
            </div>
          )}
        </div>
      )}

      {mode === "list" && (
        <>
          {decks.length > 1 && (
            <div className="flex gap-2 mb-3 flex-wrap">
              {decks.map((d) => (
                <button
                  key={d}
                  onClick={() => setDeckFilter(d)}
                  className={`rounded-lg px-3 py-1 text-xs font-semibold transition-colors ${deckFilter === d ? "bg-green-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}
                >
                  {d}
                </button>
              ))}
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            {visibleCards.map((card) => (
              <div key={card.id} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-wrap gap-1.5">
                    <span className="text-xs font-semibold text-green-600">{card.subject}</span>
                    {card.deck && card.deck !== "Mặc định" && (
                      <span className="text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{card.deck}</span>
                    )}
                  </div>
                  <button onClick={() => deleteCard(card.id)} className="text-slate-400 hover:text-red-500 text-xs">
                    ✕
                  </button>
                </div>
                <p className="mt-1 text-sm font-medium text-slate-800 line-clamp-2">{card.front}</p>
                <p className="mt-1 text-xs text-slate-500">
                  Ôn lại: {new Date(card.nextReviewAt).toLocaleDateString("vi-VN")}
                </p>
              </div>
            ))}
            {visibleCards.length === 0 && (
              <div className="col-span-2 text-sm text-slate-400 text-center py-6">
                {deckFilter === "Tất cả"
                  ? "Chưa có thẻ nào, bấm \"+ Thêm thẻ\" để tạo thẻ đầu tiên."
                  : "Bộ thẻ này chưa có thẻ nào."}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
