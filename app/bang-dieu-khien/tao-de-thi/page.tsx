"use client";

import { useState } from "react";
import Link from "next/link";
import { Logo } from "@/app/components/logo";

interface Question {
  question: string;
  options: string[];
  answer: string;
}

function parseGeminiJson(text: string) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  return JSON.parse(cleaned);
}

export default function TaoDeThiPage() {
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [duration, setDuration] = useState("45");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [uploading, setUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"manual" | "import">("manual");

  const addQuestion = () => {
    setQuestions([...questions, {
      question: "",
      options: ["A. ", "B. ", "C. ", "D. "],
      answer: "A",
    }]);
  };

  const updateQuestion = (index: number, field: string, value: string) => {
    const updated = [...questions];
    if (field === "question") updated[index].question = value;
    if (field === "answer") updated[index].answer = value;
    setQuestions(updated);
  };

  const updateOption = (qIndex: number, oIndex: number, value: string) => {
    const updated = [...questions];
    updated[qIndex].options[oIndex] = value;
    setQuestions(updated);
  };

  const removeQuestion = (index: number) => {
    setQuestions(questions.filter((_, i) => i !== index));
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/gemini", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Lỗi đọc file");
      }

      const parsed = parseGeminiJson(data.result);
      if (parsed.title) setTitle(parsed.title);
      if (parsed.questions) setQuestions(parsed.questions);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Lỗi đọc file";
      alert(`${message}, thử lại nhé!`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-blue-100 bg-white sticky top-0 z-10">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Logo />
          <Link href="/bang-dieu-khien" className="text-sm text-slate-500 hover:text-slate-700">
            ← Quay lại dashboard
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">📝 Tạo đề thi mới</h1>

        {/* Thông tin đề thi */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
          <h2 className="font-semibold text-slate-800 mb-4">Thông tin đề thi</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Tên đề thi</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="VD: Kiểm tra Toán 15 phút"
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Môn học</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Chọn môn học</option>
                <option>Toán</option>
                <option>Ngữ Văn</option>
                <option>Tiếng Anh</option>
                <option>Vật lý</option>
                <option>Hóa học</option>
                <option>Sinh học</option>
                <option>Lịch sử</option>
                <option>Địa lý</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 block mb-1">Thời gian làm bài</label>
              <select
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="15">15 phút</option>
                <option value="30">30 phút</option>
                <option value="45">45 phút</option>
                <option value="60">60 phút</option>
                <option value="90">90 phút</option>
              </select>
            </div>
          </div>
        </div>

        {/* Tab chọn cách thêm câu hỏi */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 mb-6">
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setActiveTab("manual")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "manual" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              ✏️ Nhập tay
            </button>
            <button
              onClick={() => setActiveTab("import")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "import" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
            >
              📄 Import từ PDF/Word
            </button>
          </div>

          {activeTab === "import" && (
            <div className="border-2 border-dashed border-blue-200 rounded-xl p-8 text-center">
              <div className="text-4xl mb-3">📄</div>
              <p className="text-slate-600 text-sm mb-4">Upload file PDF hoặc Word có sẵn đề thi, AI sẽ tự đọc và tạo câu hỏi</p>
              <label className="cursor-pointer">
                <span className="bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
                  {uploading ? "⏳ Đang đọc file..." : "Chọn file PDF/Word"}
                </span>
                <input
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleFileUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
              {uploading && <p className="text-blue-600 text-sm mt-3 animate-pulse">AI đang đọc và phân tích đề thi...</p>}
            </div>
          )}
        </div>

        {/* Danh sách câu hỏi */}
        <div className="space-y-4 mb-6">
          {questions.map((q, qIndex) => (
            <div key={qIndex} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-semibold text-blue-600">Câu {qIndex + 1}</span>
                <button onClick={() => removeQuestion(qIndex)} className="text-red-400 hover:text-red-600 text-sm">🗑️ Xóa</button>
              </div>
              <input
                type="text"
                value={q.question}
                onChange={(e) => updateQuestion(qIndex, "question", e.target.value)}
                placeholder="Nhập nội dung câu hỏi..."
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="grid grid-cols-2 gap-2 mb-3">
                {q.options.map((opt, oIndex) => (
                  <input
                    key={oIndex}
                    type="text"
                    value={opt}
                    onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                    className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-slate-600">Đáp án đúng:</span>
                {["A", "B", "C", "D"].map((letter) => (
                  <button
                    key={letter}
                    onClick={() => updateQuestion(qIndex, "answer", letter)}
                    className={`w-8 h-8 rounded-full text-sm font-semibold transition-all ${q.answer === letter ? "bg-green-500 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}
                  >
                    {letter}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={addQuestion}
            className="flex-1 border-2 border-dashed border-blue-300 text-blue-600 rounded-xl py-3 text-sm font-medium hover:bg-blue-50 transition-colors"
          >
            + Thêm câu hỏi
          </button>
          {questions.length > 0 && (
            <button className="bg-blue-600 text-white px-8 py-3 rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors">
              🚀 Xuất bản đề thi
            </button>
          )}
        </div>
      </main>
    </div>
  );
}
