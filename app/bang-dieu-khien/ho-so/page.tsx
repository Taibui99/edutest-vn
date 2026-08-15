"use client";

import { useState, useEffect, useRef } from "react";
import { User, Mail, School, BookOpen, Lock, CheckCircle2, AlertCircle, Camera, Trash2, ShieldCheck, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

interface Profile {
  id: string;
  name: string;
  email: string;
  role: string;
  school?: string;
  grade?: string;
  bio?: string;
  avatarUrl?: string | null;
  createdAt: string;
}

function Alert({ type, msg }: { type: "success" | "error"; msg: string }) {
  return (
    <div className={`flex items-center gap-2 p-3 rounded-xl text-sm font-medium ${
      type === "success" ? "bg-[var(--mint-light)] text-[#064E3B]" : "bg-[var(--coral-light)] text-[#7F1D1D]"
    }`}>
      {type === "success" ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
      {msg}
    </div>
  );
}

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [pwFeedback, setPwFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const [name, setName] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [bio, setBio] = useState("");

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [avatarFeedback, setAvatarFeedback] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((p) => {
        setProfile(p);
        setName(p.name || "");
        setSchool(p.school || "");
        setGrade(p.grade || "");
        setBio(p.bio || "");
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const saveProfile = async () => {
    setSaving(true); setFeedback(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, school, grade, bio }),
    });
    const data = await res.json();
    if (res.ok) {
      setProfile((prev) => prev ? { ...prev, ...data } : data);
      setFeedback({ type: "success", msg: "Đã lưu thay đổi!" });
    } else {
      setFeedback({ type: "error", msg: data.error || "Lỗi khi lưu" });
    }
    setSaving(false);
    setTimeout(() => setFeedback(null), 3000);
  };

  const changePassword = async () => {
    if (newPw !== confirmPw) { setPwFeedback({ type: "error", msg: "Mật khẩu mới không khớp" }); return; }
    if (newPw.length < 6) { setPwFeedback({ type: "error", msg: "Mật khẩu mới phải từ 6 ký tự" }); return; }
    setChangingPw(true); setPwFeedback(null);
    const res = await fetch("/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
    });
    const data = await res.json();
    if (res.ok) {
      setPwFeedback({ type: "success", msg: "Đã đổi mật khẩu thành công!" });
      setCurrentPw(""); setNewPw(""); setConfirmPw("");
    } else {
      setPwFeedback({ type: "error", msg: data.error || "Lỗi đổi mật khẩu" });
    }
    setChangingPw(false);
    setTimeout(() => setPwFeedback(null), 3000);
  };

  const uploadAvatar = async (file: File) => {
    setUploading(true); setAvatarFeedback(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/profile/avatar", { method: "POST", body: fd });
      const data = await res.json();
      if (res.ok) {
        setProfile((prev) => prev ? { ...prev, avatarUrl: data.avatarUrl } : prev);
        setAvatarFeedback({ type: "success", msg: "Đã cập nhật ảnh đại diện!" });
      } else {
        setAvatarFeedback({ type: "error", msg: data.error || "Lỗi upload ảnh" });
      }
    } catch {
      setAvatarFeedback({ type: "error", msg: "Lỗi upload ảnh" });
    }
    setUploading(false);
    setTimeout(() => setAvatarFeedback(null), 3000);
  };

  const removeAvatar = async () => {
    setUploading(true); setAvatarFeedback(null);
    try {
      const res = await fetch("/api/profile/avatar", { method: "DELETE" });
      if (res.ok) {
        setProfile((prev) => prev ? { ...prev, avatarUrl: null } : prev);
        setAvatarFeedback({ type: "success", msg: "Đã xoá ảnh đại diện" });
      } else {
        setAvatarFeedback({ type: "error", msg: "Lỗi xoá ảnh" });
      }
    } catch {
      setAvatarFeedback({ type: "error", msg: "Lỗi xoá ảnh" });
    }
    setUploading(false);
    setTimeout(() => setAvatarFeedback(null), 3000);
  };

  if (loading) return (
    <div className="flex items-center justify-center py-32"><Spinner /></div>
  );
  if (!profile) return null;

  return (
    <div className="p-4 lg:p-8 max-w-2xl mx-auto animate-fade-in">
      <h1 className="text-xl font-black text-[var(--text-primary)] mb-6">Hồ sơ cá nhân</h1>

      {/* Avatar + basic info */}
      <div className="flex items-center gap-4 mb-6 p-5 bg-[var(--surface-card)] rounded-2xl border border-[var(--surface-border)]">
        <div className="relative shrink-0">
          {profile.avatarUrl ? (
            <img
              src={profile.avatarUrl}
              alt={`Ảnh đại diện của ${profile.name}`}
              className="w-16 h-16 rounded-2xl object-cover border border-[var(--surface-border)]"
            />
          ) : (
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--primary)] to-[var(--coral)] flex items-center justify-center text-white text-2xl font-black">
              {profile.name.charAt(0).toUpperCase()}
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            aria-label="Đổi ảnh đại diện"
            className="absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-[var(--primary)] text-white flex items-center justify-center shadow-md hover:bg-[var(--primary-hover)] disabled:opacity-50 transition-colors"
          >
            <Camera size={13} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadAvatar(f);
              e.target.value = "";
            }}
          />
        </div>
        <div className="min-w-0">
          <h2 className="font-black text-[var(--text-primary)] text-lg truncate">{profile.name}</h2>
          <p className="text-sm text-[var(--text-muted)] truncate">{profile.email}</p>
          <span className={`inline-block mt-1 text-xs font-bold px-2.5 py-0.5 rounded-full ${
            profile.role === "teacher" ? "bg-[#E8F4FD] text-[#4EA8DE]" : "bg-[#E1F5EE] text-[#06D6A0]"
          }`}>
            {profile.role === "teacher" ? "Giáo viên" : "Học sinh"}
          </span>
        </div>
        {profile.avatarUrl && (
          <button
            onClick={removeAvatar}
            disabled={uploading}
            aria-label="Xoá ảnh đại diện"
            className="ml-auto flex items-center gap-1.5 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors"
          >
            <Trash2 size={13} /> Xoá ảnh
          </button>
        )}
      </div>
      {avatarFeedback && <div className="mb-5"><Alert type={avatarFeedback.type} msg={avatarFeedback.msg} /></div>}

      {/* Edit profile */}
      <Card className="mb-5">
        <h2 className="font-black text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <User size={16} className="text-[var(--primary)]" /> Thông tin cá nhân
        </h2>
        <div className="flex flex-col gap-3">
          <Input
            label="Họ và tên"
            value={name}
            onChange={(e) => setName(e.target.value)}
            icon={<User size={15} />}
          />
          <Input
            label="Email"
            value={profile.email}
            disabled
            icon={<Mail size={15} />}
          />
          <Input
            label={profile.role === "teacher" ? "Trường công tác" : "Trường học"}
            placeholder="VD: THPT Nguyễn Trãi"
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            icon={<School size={15} />}
          />
          <Input
            label={profile.role === "teacher" ? "Môn dạy" : "Lớp"}
            placeholder={profile.role === "teacher" ? "VD: Toán học" : "VD: 12A1"}
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            icon={<BookOpen size={15} />}
          />
          <div>
            <label className="block text-sm font-semibold text-[var(--text-secondary)] mb-1.5">
              Giới thiệu
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Vài dòng giới thiệu về bạn..."
              rows={3}
              className="w-full px-3 py-2.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-card)] text-sm text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--primary)] resize-none"
            />
          </div>
          {feedback && <Alert type={feedback.type} msg={feedback.msg} />}
          <Button onClick={saveProfile} disabled={saving} className="self-end">
            {saving ? <Spinner size="sm" /> : "Lưu thay đổi"}
          </Button>
        </div>
      </Card>

      {/* Change password */}
      <Card>
        <h2 className="font-black text-[var(--text-primary)] mb-4 flex items-center gap-2">
          <Lock size={16} className="text-[var(--primary)]" /> Đổi mật khẩu
        </h2>
        <div className="flex flex-col gap-3">
          <Input
            label="Mật khẩu hiện tại"
            type="password"
            value={currentPw}
            onChange={(e) => setCurrentPw(e.target.value)}
            placeholder="••••••••"
          />
          <Input
            label="Mật khẩu mới"
            type="password"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="Ít nhất 6 ký tự"
          />
          <Input
            label="Xác nhận mật khẩu mới"
            type="password"
            value={confirmPw}
            onChange={(e) => setConfirmPw(e.target.value)}
            placeholder="Nhập lại mật khẩu mới"
          />
          {pwFeedback && <Alert type={pwFeedback.type} msg={pwFeedback.msg} />}
          <Button onClick={changePassword} disabled={changingPw || !currentPw || !newPw} className="self-end" variant="outline">
            {changingPw ? <Spinner size="sm" /> : "Đổi mật khẩu"}
          </Button>
        </div>
      </Card>

      {profile.role === "admin" && (
        <Link href="/admin">
          <div className="flex items-center gap-4 p-5 bg-gradient-to-r from-[#EEEFFE] to-[#F6F5FF] dark:from-[#1A1740] dark:to-[#241F5C] rounded-2xl border border-[#6C63FF]/30 hover:border-[#6C63FF] transition-all cursor-pointer">
            <span className="w-10 h-10 rounded-xl bg-[#6C63FF] text-white flex items-center justify-center shrink-0">
              <ShieldCheck size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-[var(--text-primary)]">Khu vực quản trị</p>
              <p className="text-xs text-[var(--text-muted)]">Quản lý người dùng, đề thi, báo cáo hệ thống</p>
            </div>
            <ArrowRight size={16} className="text-[#6C63FF] shrink-0" />
          </div>
        </Link>
      )}
    </div>
  );
}
