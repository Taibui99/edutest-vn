"use client";

import { useState, useRef, useEffect } from "react";
import { Send, Sparkles, RotateCcw, Bot, User } from "lucide-react";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";

interface Message {
  role: "user" | "assistant";
  content: string;
}

const STUDENT_PROMPTS = [
  "Tôi nên học gì hôm nay?",
  "Phân tích điểm yếu của tôi",
  "Tạo 5 câu hỏi Toán luyện tập",
  "Lập kế hoạch ôn thi THPT",
  "Giải thích Hàm số cho tôi",
];

const TEACHER_PROMPTS = [
  "Tạo 5 câu hỏi Toán lớp 12",
  "Phân tích kết quả lớp tôi",
  "Đề xuất chủ đề ôn tập",
  "Tạo câu hỏi Tiếng Anh Grammar",
  "Viết câu hỏi Vật lý Điện từ",
];

function MessageBubble({ msg }: { msg: Message }) {
  const isUser = msg.role === "user";
  return (
    <div className={cn("flex gap-2.5 items-end", isUser && "flex-row-reverse")}>
      <div className={cn(
        "w-7 h-7 rounded-full flex items-center justify-center shrink-0 mb-0.5",
        isUser ? "bg-gradient-to-br from-[var(--primary)] to-[var(--coral)]" : "bg-[var(--primary-light)]"
      )}>
        {isUser
          ? <User size={14} className="text-white" />
          : <Bot size={14} className="text-[var(--primary)]" />
        }
      </div>
      <div className={cn(
        "max-w-[80%] px-4 py-2.5 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap",
        isUser
          ? "bg-[var(--primary)] text-white rounded-br-sm"
          : "bg-[var(--surface-card)] border border-[var(--surface-border)] text-[var(--text-primary)] rounded-bl-sm"
      )}>
        {msg.content}
      </div>
    </div>
  );
}

export default function AICoachPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Xin chào! Tôi là AI Study Coach của EduTest 👋\n\nTôi có thể giúp bạn:\n• Phân tích điểm yếu và đề xuất ôn tập\n• Giải thích kiến thức, tạo câu hỏi luyện tập\n• Lập kế hoạch học tập cá nhân\n\nBạn muốn bắt đầu từ đâu?",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"student" | "teacher">("student");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((s) => { if (s?.user?.role) setRole(s.user.role); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text?: string) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    const userMsg: Message = { role: "user", content };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/ai-coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: content,
          history: messages.slice(-10),
        }),
      });
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || data.error || "Có lỗi xảy ra" },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Xin lỗi, AI đang bận. Thử lại sau nhé!" },
      ]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const reset = () => {
    setMessages([{
      role: "assistant",
      content: "Cuộc trò chuyện mới bắt đầu! Tôi có thể giúp gì cho bạn?",
    }]);
  };

  const quickPrompts = role === "teacher" ? TEACHER_PROMPTS : STUDENT_PROMPTS;

  return (
    <div className="flex flex-col h-[calc(100vh-61px)] lg:h-screen">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 bg-[var(--surface-card)] border-b border-[var(--surface-border)] shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-[var(--primary-light)] flex items-center justify-center">
            <Sparkles size={16} className="text-[var(--primary)]" />
          </div>
          <div>
            <h1 className="text-sm font-black text-[var(--text-primary)]">
              {role === "teacher" ? "AI Tạo Đề" : "AI Study Coach"}
            </h1>
            <p className="text-xs text-[var(--text-muted)]">Powered by Gemini AI</p>
          </div>
        </div>
        <button
          onClick={reset}
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--primary)] transition-colors px-2 py-1.5 rounded-lg hover:bg-[var(--gray-100)]"
        >
          <RotateCcw size={13} /> Cuộc trò chuyện mới
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-5 flex flex-col gap-4">
        {messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} />
        ))}
        {loading && (
          <div className="flex gap-2.5 items-end">
            <div className="w-7 h-7 rounded-full bg-[var(--primary-light)] flex items-center justify-center shrink-0">
              <Bot size={14} className="text-[var(--primary)]" />
            </div>
            <div className="bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1 items-center">
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce" style={{ animationDelay: "0ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce" style={{ animationDelay: "150ms" }} />
                <div className="w-1.5 h-1.5 rounded-full bg-[var(--primary)] animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick prompts */}
      {messages.length <= 2 && (
        <div className="px-4 pb-3 flex gap-2 overflow-x-auto scrollbar-hide shrink-0">
          {quickPrompts.map((p) => (
            <button
              key={p}
              onClick={() => send(p)}
              disabled={loading}
              className="shrink-0 text-xs font-semibold px-3 py-2 rounded-xl border border-[var(--primary-muted)] text-[var(--primary)] bg-[var(--primary-light)] hover:bg-[var(--primary-muted)] transition-colors whitespace-nowrap disabled:opacity-50"
            >
              {p}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 lg:pb-5 shrink-0">
        <div className="flex gap-2 bg-[var(--surface-card)] border border-[var(--surface-border)] rounded-2xl p-2 focus-within:border-[var(--primary)] transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            placeholder="Hỏi AI Study Coach..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] outline-none px-2 py-1.5 max-h-32 overflow-y-auto"
            style={{ scrollbarWidth: "none" }}
          />
          <button
            onClick={() => send()}
            disabled={!input.trim() || loading}
            className="w-9 h-9 rounded-xl bg-[var(--primary)] text-white flex items-center justify-center shrink-0 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[var(--primary-hover)] transition-colors self-end"
          >
            {loading ? <Spinner size="sm" color="white" /> : <Send size={15} />}
          </button>
        </div>
        <p className="text-center text-[10px] text-[var(--text-muted)] mt-2">
          AI có thể mắc lỗi. Kiểm tra thông tin quan trọng từ nguồn đáng tin cậy.
        </p>
      </div>
    </div>
  );
}
