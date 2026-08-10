"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Trash2,
  Upload,
  Check,
  FileText,
  Settings,
  Eye,
  Send,
  GripVertical,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/cn";
import { SUBJECTS } from "@/lib/subject";

interface Question {
  question: string;
  options: string[];
  answer: string;
}

const STEPS = [
  { id: 1, label: "Thông tin", icon: <FileText size={16} /> },
  { id: 2, label: "Câu hỏi", icon: <Plus size={16} /> },
  { id: 3, label: "Cấu hình", icon: <Settings size={16} /> },
  { id: 4, label: "Xem trước", icon: <Eye size={16} /> },
  { id: 5, label: "Xuất bản", icon: <Send size={16} /> },
];

const DURATION_OPTIONS = [
  { value: "10", label: "10 phút" },
  { value: "15", label: "15 phút" },
  { value: "30", label: "30 phút" },
  { value: "45", label: "45 phút" },
  { value: "60", label: "60 phút" },
  { value: "90", label: "90 phút" },
  { value: "120", label: "120 phút" },
];

function parseGeminiJson(text: string) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();
  return JSON.parse(cleaned);
}

export default function TaoDeThiPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("45");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [uploading, setUploading] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState("");

  const addQuestion = () => {
    setQuestions([...questions, { question: "", options: ["A. ", "B. ", "C. ", "D. "], answer: "A" }]);
  };

  const updateQuestion = (i: number, field: string, value: string) => {
    const q = [...questions];
    if (field === "question") q[i].question = value;
    if (field === "answer") q[i].answer = value;
    setQuestions(q);
  };

  const updateOption = (qi: number, oi: number, value: string) => {
    const q = [...questions];
    q[qi].options[oi] = value;
    setQuestions(q);
  };

  const removeQuestion = (i: number) => setQuestions(questions.filter((_, idx) => idx !== i));

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/gemini", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Lỗi đọc file");
      const parsed = parseGeminiJson(data.result);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.questions) setQuestions(parsed.questions);
      setStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi đọc file");
    } finally {
      setUploading(false);
    }
  };

  const publishExam = async () => {
    setPublishing(true);
    setError("");
    try {
      const res = await fetch("/api/exams", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, subject, durationMinutes: Number(duration), questions }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Không thể xuất bản");
      router.push(`/bang-dieu-khien?created=${data.exam.joinCode}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xuất bản");
      setPublishing(false);
    }
  };

  const canNext = () => {
    if (step === 1) return title.trim() && subject;
    if (step === 2) return questions.length > 0;
    return true;
  };

  return (
    <div className="p-5 lg:p-8 max-w-3xl mx-auto animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/bang-dieu-khien/de-thi">
          <button className="p-1.5 rounded-lg text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#0F172A] transition-colors">
            <ChevronLeft size={20} />
          </button>
        </Link>
        <h1 className="text-lg font-bold text-[#0F172A]">Tạo đề thi mới</h1>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-0 mb-8 overflow-x-auto pb-2">
        {STEPS.map((s, idx) => {
          const done = step > s.id;
          const active = step === s.id;
          return (
            <div key={s.id} className="flex items-center">
              <div className="flex flex-col items-center gap-1">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
                  done ? "bg-[#22C55E] text-white" : active ? "bg-[#2563EB] text-white" : "bg-[#F1F5F9] text-[#94A3B8]"
                )}>
                  {done ? <Check size={14} /> : s.id}
                </div>
                <span className={cn("text-xs whitespace-nowrap", active ? "text-[#2563EB] font-semibold" : "text-[#94A3B8]")}>
                  {s.label}
                </span>
              </div>
              {idx < STEPS.length - 1 && (
                <div className={cn("h-0.5 w-8 lg:w-14 mx-1 mb-4 transition-all", done ? "bg-[#22C55E]" : "bg-[#E2E8F0]")} />
              )}
            </div>
          );
        })}
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-[#FEF2F2] border border-[#FECACA] text-sm text-[#DC2626]">
          {error}
        </div>
      )}

      {/* Step 1: Info */}
      {step === 1 && (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-[#0F172A] mb-5">Thông tin đề thi</h2>
          <div className="flex flex-col gap-4">
            <Input
              label="Tên đề thi"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="VD: Kiểm tra Toán — Giải tích chương 1"
            />
            <Select
              label="Môn học"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              options={SUBJECTS.map((s) => ({ value: s, label: s }))}
              placeholder="Chọn môn học"
            />
            <Select
              label="Thời gian làm bài"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              options={DURATION_OPTIONS}
            />

            <div className="pt-2 border-t border-[#F1F5F9]">
              <p className="text-sm font-medium text-[#334155] mb-3">Import câu hỏi từ file (tùy chọn)</p>
              <label className={cn(
                "flex flex-col items-center justify-center p-8 rounded-xl border-2 border-dashed border-[#E2E8F0] cursor-pointer",
                "hover:border-[#2563EB] hover:bg-[#EFF6FF] transition-colors",
                uploading && "opacity-60 pointer-events-none"
              )}>
                {uploading ? (
                  <><Spinner className="mb-2" /><p className="text-sm text-[#2563EB]">AI đang đọc file...</p></>
                ) : (
                  <>
                    <Upload size={24} className="text-[#CBD5E1] mb-2" />
                    <p className="text-sm font-medium text-[#334155]">Upload PDF hoặc Word</p>
                    <p className="text-xs text-[#94A3B8] mt-1">AI sẽ tự động tạo câu hỏi</p>
                  </>
                )}
                <input type="file" accept=".pdf,.docx" onChange={handleFileUpload} className="hidden" disabled={uploading} />
              </label>
            </div>
          </div>
        </Card>
      )}

      {/* Step 2: Questions */}
      {step === 2 && (
        <div className="flex flex-col gap-4">
          {questions.map((q, qi) => (
            <Card key={qi} className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <GripVertical size={16} className="text-[#CBD5E1]" />
                  <span className="text-xs font-semibold text-[#2563EB] bg-[#EFF6FF] px-2 py-0.5 rounded-md">
                    Câu {qi + 1}
                  </span>
                </div>
                <button onClick={() => removeQuestion(qi)} className="p-1.5 rounded-lg text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors">
                  <Trash2 size={15} />
                </button>
              </div>

              <textarea
                value={q.question}
                onChange={(e) => updateQuestion(qi, "question", e.target.value)}
                placeholder="Nhập nội dung câu hỏi..."
                rows={2}
                className="w-full border border-[#E2E8F0] rounded-lg px-3 py-2 text-sm text-[#0F172A] placeholder:text-[#94A3B8] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] resize-none mb-3 transition-colors"
              />

              <div className="grid grid-cols-2 gap-2 mb-3">
                {q.options.map((opt, oi) => (
                  <div key={oi} className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-[#94A3B8]">
                      {String.fromCharCode(65 + oi)}.
                    </span>
                    <input
                      type="text"
                      value={opt.replace(/^[A-D]\.\s?/, "")}
                      onChange={(e) => updateOption(qi, oi, `${String.fromCharCode(65 + oi)}. ${e.target.value}`)}
                      placeholder={`Đáp án ${String.fromCharCode(65 + oi)}`}
                      className="w-full border border-[#E2E8F0] rounded-lg pl-6 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30 focus:border-[#2563EB] transition-colors"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-[#64748B] font-medium">Đáp án đúng:</span>
                {["A", "B", "C", "D"].map((letter) => (
                  <button
                    key={letter}
                    onClick={() => updateQuestion(qi, "answer", letter)}
                    className={cn(
                      "w-7 h-7 rounded-full text-xs font-bold transition-all",
                      q.answer === letter
                        ? "bg-[#22C55E] text-white"
                        : "bg-[#F1F5F9] text-[#64748B] hover:bg-[#E2E8F0]"
                    )}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </Card>
          ))}

          <button
            onClick={addQuestion}
            className="flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-[#E2E8F0] text-sm font-medium text-[#2563EB] hover:border-[#2563EB] hover:bg-[#EFF6FF] transition-colors"
          >
            <Plus size={16} /> Thêm câu hỏi
          </button>
        </div>
      )}

      {/* Step 3: Config */}
      {step === 3 && (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-[#0F172A] mb-5">Cấu hình đề thi</h2>
          <div className="flex flex-col gap-4">
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
              <h3 className="text-sm font-semibold text-[#334155] mb-3">Tóm tắt đề thi</h3>
              <div className="flex flex-col gap-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Tên đề</span>
                  <span className="font-medium text-[#0F172A]">{title}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Môn học</span>
                  <span className="font-medium text-[#0F172A]">{subject}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Thời gian</span>
                  <span className="font-medium text-[#0F172A]">{duration} phút</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-[#64748B]">Số câu hỏi</span>
                  <span className="font-medium text-[#0F172A]">{questions.length} câu</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-[#94A3B8]">
              Sau khi xuất bản, học sinh có thể vào thi bằng mã tham gia được tạo tự động.
            </p>
          </div>
        </Card>
      )}

      {/* Step 4: Preview */}
      {step === 4 && (
        <Card className="p-6">
          <h2 className="text-base font-semibold text-[#0F172A] mb-2">Xem trước đề thi</h2>
          <p className="text-xs text-[#94A3B8] mb-5">Giao diện học sinh sẽ thấy khi làm bài</p>

          <div className="border border-[#E2E8F0] rounded-xl overflow-hidden">
            <div className="bg-[#0F172A] px-4 py-3 flex items-center justify-between">
              <span className="text-white font-semibold text-sm">{title}</span>
              <span className="text-[#94A3B8] text-xs font-mono">{duration}:00</span>
            </div>
            <div className="p-4 flex flex-col gap-4 max-h-80 overflow-y-auto">
              {questions.slice(0, 3).map((q, qi) => (
                <div key={qi} className="pb-4 border-b border-[#F1F5F9] last:border-0">
                  <p className="text-sm font-medium text-[#0F172A] mb-3">
                    <span className="text-[#2563EB] mr-1.5">Câu {qi + 1}.</span>
                    {q.question || "(Chưa nhập câu hỏi)"}
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {q.options.map((opt, oi) => (
                      <div key={oi} className="p-2.5 border border-[#E2E8F0] rounded-lg text-xs text-[#334155]">
                        {opt || `Đáp án ${String.fromCharCode(65 + oi)}`}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {questions.length > 3 && (
                <p className="text-xs text-[#94A3B8] text-center">... và {questions.length - 3} câu nữa</p>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Step 5: Publish */}
      {step === 5 && (
        <Card className="p-6 text-center">
          <div className="w-16 h-16 rounded-full bg-[#EFF6FF] flex items-center justify-center mx-auto mb-4">
            <Send size={28} className="text-[#2563EB]" />
          </div>
          <h2 className="text-lg font-bold text-[#0F172A] mb-2">Sẵn sàng xuất bản!</h2>
          <p className="text-sm text-[#64748B] mb-6">
            Đề thi <strong>{title}</strong> với {questions.length} câu hỏi sẽ được xuất bản và học sinh có thể vào thi ngay.
          </p>
          <Button
            onClick={publishExam}
            loading={publishing}
            className="w-full"
            icon={<Send size={16} />}
          >
            {publishing ? "Đang xuất bản..." : "Xuất bản đề thi"}
          </Button>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <Button
          variant="outline"
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 1}
          icon={<ChevronLeft size={16} />}
        >
          Quay lại
        </Button>

        {step < 5 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
          >
            Tiếp theo <ChevronRight size={16} />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
