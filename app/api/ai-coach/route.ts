import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

const MODEL = process.env.GEMINI_AGENT_MODEL || "gemini-3.6-flash";
const MAX_ROUNDS = 6;
type Role = "teacher" | "student";
type Args = Record<string, unknown>;

const str = (a: Args, k: string) => typeof a[k] === "string" ? a[k].trim() : "";
const int = (a: Args, k: string) => Number.isInteger(Number(a[k])) ? Number(a[k]) : 0;
const bool = (a: Args, k: string) => typeof a[k] === "boolean" ? a[k] : false;
const arr = (a: Args, k: string) => Array.isArray(a[k]) ? a[k].filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];

const tools = [
  { type: "function", name: "get_dashboard", description: "Lấy dữ liệu tổng quan thật của tài khoản hiện tại.", parameters: { type: "object", properties: {}, required: [] } },
  { type: "function", name: "list_exams", description: "Liệt kê đề thi của giáo viên hoặc đề được giao cho học sinh.", parameters: { type: "object", properties: {}, required: [] } },
  { type: "function", name: "get_exam", description: "Xem chi tiết một đề thi có quyền truy cập.", parameters: { type: "object", properties: { exam_id: { type: "string" } }, required: ["exam_id"] } },
  { type: "function", name: "create_exam", description: "Tạo đề thi thật trong database. Chỉ gọi khi giáo viên yêu cầu tạo đề.", parameters: { type: "object", properties: { title: { type: "string" }, subject: { type: "string" }, duration_minutes: { type: "integer" }, questions: { type: "array", items: { type: "object", properties: { text: { type: "string" }, options: { type: "array", items: { type: "string" } }, answer: { type: "string" }, explanation: { type: "string" } }, required: ["text", "options", "answer"] } } }, required: ["title", "subject", "duration_minutes", "questions"] } },
  { type: "function", name: "set_exam_status", description: "Xuất bản hoặc chuyển đề về bản nháp.", parameters: { type: "object", properties: { exam_id: { type: "string" }, status: { type: "string", enum: ["published", "draft"] } }, required: ["exam_id", "status"] } },
  { type: "function", name: "delete_exam", description: "Xóa vĩnh viễn đề của giáo viên. Chỉ gọi khi được yêu cầu rõ ràng.", parameters: { type: "object", properties: { exam_id: { type: "string" } }, required: ["exam_id"] } },
  { type: "function", name: "list_classrooms", description: "Liệt kê lớp học hiện tại.", parameters: { type: "object", properties: {}, required: [] } },
  { type: "function", name: "get_classroom", description: "Xem thành viên và đề đã giao của một lớp.", parameters: { type: "object", properties: { classroom_id: { type: "string" } }, required: ["classroom_id"] } },
  { type: "function", name: "create_classroom", description: "Tạo lớp học thật. Chỉ gọi khi giáo viên yêu cầu.", parameters: { type: "object", properties: { name: { type: "string" }, description: { type: "string" }, subject: { type: "string" }, grade: { type: "string" } }, required: ["name"] } },
  { type: "function", name: "update_classroom", description: "Cập nhật lớp học của giáo viên.", parameters: { type: "object", properties: { classroom_id: { type: "string" }, name: { type: "string" }, description: { type: "string" }, subject: { type: "string" }, grade: { type: "string" }, archived: { type: "boolean" } }, required: ["classroom_id"] } },
  { type: "function", name: "delete_classroom", description: "Xóa lớp. Chỉ gọi khi được yêu cầu rõ ràng.", parameters: { type: "object", properties: { classroom_id: { type: "string" } }, required: ["classroom_id"] } },
  { type: "function", name: "assign_exam", description: "Giao đề thật vào lớp và thông báo học sinh.", parameters: { type: "object", properties: { classroom_id: { type: "string" }, exam_id: { type: "string" }, due_date: { type: "string" } }, required: ["classroom_id", "exam_id"] } },
  { type: "function", name: "unassign_exam", description: "Gỡ đề khỏi lớp.", parameters: { type: "object", properties: { classroom_id: { type: "string" }, exam_id: { type: "string" } }, required: ["classroom_id", "exam_id"] } },
  { type: "function", name: "remove_student", description: "Xóa học sinh khỏi lớp. Chỉ gọi khi được yêu cầu rõ ràng.", parameters: { type: "object", properties: { classroom_id: { type: "string" }, student_id: { type: "string" } }, required: ["classroom_id", "student_id"] } },
  { type: "function", name: "get_analytics", description: "Lấy thống kê thật của giáo viên.", parameters: { type: "object", properties: {}, required: [] } },
  { type: "function", name: "get_submissions", description: "Lấy bài nộp của một đề mà giáo viên sở hữu hoặc bài của chính học sinh.", parameters: { type: "object", properties: { exam_id: { type: "string" } }, required: ["exam_id"] } },
  { type: "function", name: "create_study_task", description: "Tạo nhiệm vụ học tập cho học sinh hiện tại.", parameters: { type: "object", properties: { title: { type: "string" }, subject: { type: "string" }, due_date: { type: "string" } }, required: ["title"] } },
  { type: "function", name: "complete_study_task", description: "Đánh dấu nhiệm vụ học tập hoàn thành hoặc chưa hoàn thành.", parameters: { type: "object", properties: { task_id: { type: "string" }, completed: { type: "boolean" } }, required: ["task_id", "completed"] } },
  { type: "function", name: "delete_study_task", description: "Xóa nhiệm vụ học tập của học sinh.", parameters: { type: "object", properties: { task_id: { type: "string" } }, required: ["task_id"] } },
  { type: "function", name: "create_flashcard", description: "Tạo flashcard thật cho học sinh.", parameters: { type: "object", properties: { subject: { type: "string" }, front: { type: "string" }, back: { type: "string" } }, required: ["subject", "front", "back"] } },
  { type: "function", name: "list_due_flashcards", description: "Lấy flashcard đến hạn ôn.", parameters: { type: "object", properties: {}, required: [] } },
  { type: "function", name: "update_progress", description: "Cập nhật tiến độ một môn học.", parameters: { type: "object", properties: { subject: { type: "string" }, progress: { type: "integer" } }, required: ["subject", "progress"] } },
  { type: "function", name: "set_exam_date", description: "Đặt ngày thi THPT của học sinh.", parameters: { type: "object", properties: { exam_date: { type: "string" } }, required: ["exam_date"] } },
] as const;

function toolsFor(role: Role) {
  const teacherOnly = new Set(["create_exam", "set_exam_status", "delete_exam", "create_classroom", "update_classroom", "delete_classroom", "assign_exam", "unassign_exam", "remove_student", "get_analytics"]);
  const studentOnly = new Set(["create_study_task", "complete_study_task", "delete_study_task", "create_flashcard", "list_due_flashcards", "update_progress", "set_exam_date"]);
  return tools.filter((tool) => role === "teacher" ? !studentOnly.has(tool.name) : !teacherOnly.has(tool.name));
}

async function examCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 10; i += 1) {
    const code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join("");
    if (!(await prisma.exam.findUnique({ where: { joinCode: code } }))) return code;
  }
  throw new Error("Không tạo được mã đề");
}

async function classCode() {
  for (let i = 0; i < 10; i += 1) {
    const code = Math.random().toString(36).slice(2, 8).toUpperCase();
    if (!(await prisma.classroom.findUnique({ where: { joinCode: code } }))) return code;
  }
  throw new Error("Không tạo được mã lớp");
}

async function runTool(name: string, a: Args, userId: string, role: Role): Promise<Record<string, unknown>> {
  if (name === "get_dashboard") {
    if (role === "teacher") {
      const [exams, submissions, classes] = await Promise.all([prisma.exam.count({ where: { teacherId: userId } }), prisma.submission.count({ where: { exam: { teacherId: userId } } }), prisma.classroom.count({ where: { teacherId: userId, archived: false } })]);
      return { success: true, exams, submissions, classes };
    }
    const [user, submissions, tasks, due] = await Promise.all([prisma.user.findUnique({ where: { id: userId }, select: { name: true, examDate: true, streak: true } }), prisma.submission.findMany({ where: { studentId: userId }, select: { score: true }, take: 20 }), prisma.studyTask.count({ where: { studentId: userId, completed: false } }), prisma.flashcard.count({ where: { studentId: userId, nextReviewAt: { lte: new Date() } } })]);
    const avg = submissions.length ? submissions.reduce((s, x) => s + x.score, 0) / submissions.length : null;
    return { success: true, user, averageScore: avg, openTasks: tasks, dueFlashcards: due };
  }

  if (name === "list_exams") {
    if (role === "teacher") return { success: true, exams: await prisma.exam.findMany({ where: { teacherId: userId }, include: { _count: { select: { questions: true, submissions: true, assignments: true } } }, orderBy: { createdAt: "desc" } }) };
    const rows = await prisma.examAssignment.findMany({ where: { classroom: { members: { some: { studentId: userId } } }, exam: { status: "published" } }, include: { exam: { include: { _count: { select: { questions: true, submissions: true } } } } }, orderBy: { assignedAt: "desc" } });
    return { success: true, exams: rows.map((r) => ({ ...r.exam, classroomId: r.classroomId, dueDate: r.dueDate })) };
  }

  if (name === "get_exam") {
    const id = str(a, "exam_id");
    const exam = role === "teacher" ? await prisma.exam.findFirst({ where: { id, teacherId: userId }, include: { questions: { orderBy: { order: "asc" } }, _count: { select: { submissions: true, assignments: true } } } }) : await prisma.exam.findFirst({ where: { id, status: "published", assignments: { some: { classroom: { members: { some: { studentId: userId } } } } } }, include: { questions: { orderBy: { order: "asc" }, select: { id: true, text: true, options: true, explanation: true, order: true } } } });
    return exam ? { success: true, exam } : { success: false, error: "Không tìm thấy đề hoặc không có quyền" };
  }

  if (name === "create_exam") {
    if (role !== "teacher") return { success: false, error: "Chỉ giáo viên được tạo đề" };
    const title = str(a, "title"), subject = str(a, "subject"), duration = int(a, "duration_minutes");
    const raw = Array.isArray(a.questions) ? a.questions : [];
    const questions = raw.map((x, i) => { const q = typeof x === "object" && x !== null ? x as Args : {}; return { text: str(q, "text"), options: arr(q, "options"), answer: str(q, "answer").toUpperCase().charAt(0), explanation: str(q, "explanation") || null, order: i + 1 }; });
    const invalid = questions.some((q) => !q.text || q.options.length < 2 || q.options.length > 4 || !["A", "B", "C", "D"].includes(q.answer) || q.answer.charCodeAt(0) - 65 >= q.options.length || new Set(q.options.map((o) => o.toLowerCase())).size !== q.options.length);
    if (!title || !subject || duration < 1 || !questions.length || invalid) return { success: false, error: "Thông tin đề hoặc câu hỏi không hợp lệ" };
    const exam = await prisma.exam.create({ data: { title, subject, durationMinutes: duration, joinCode: await examCode(), teacherId: userId, questions: { create: questions } }, include: { questions: true } });
    return { success: true, action: "created", exam };
  }

  if (name === "set_exam_status") {
    if (role !== "teacher") return { success: false, error: "Không có quyền" };
    const id = str(a, "exam_id"), status = str(a, "status");
    if (!["published", "draft"].includes(status)) return { success: false, error: "Trạng thái không hợp lệ" };
    const exam = await prisma.exam.findFirst({ where: { id, teacherId: userId } });
    if (!exam) return { success: false, error: "Không tìm thấy đề" };
    return { success: true, action: status === "published" ? "published" : "draft", exam: await prisma.exam.update({ where: { id }, data: { status } }) };
  }

  if (name === "delete_exam") {
    if (role !== "teacher") return { success: false, error: "Không có quyền" };
    const id = str(a, "exam_id"), exam = await prisma.exam.findFirst({ where: { id, teacherId: userId } });
    if (!exam) return { success: false, error: "Không tìm thấy đề" };
    await prisma.exam.delete({ where: { id } });
    return { success: true, action: "deleted", exam_id: id, title: exam.title };
  }

  if (name === "list_classrooms") {
    if (role === "teacher") return { success: true, classrooms: await prisma.classroom.findMany({ where: { teacherId: userId }, include: { _count: { select: { members: true, assignments: true } } }, orderBy: { createdAt: "desc" } }) };
    const rows = await prisma.classMember.findMany({ where: { studentId: userId }, include: { classroom: { include: { teacher: { select: { name: true } }, _count: { select: { members: true, assignments: true } } } } }, orderBy: { joinedAt: "desc" } });
    return { success: true, classrooms: rows.map((r) => r.classroom) };
  }

  if (name === "get_classroom") {
    const id = str(a, "classroom_id");
    const c = await prisma.classroom.findUnique({ where: { id }, include: { teacher: { select: { id: true, name: true, email: true } }, members: { include: { student: { select: { id: true, name: true, email: true } } }, orderBy: { joinedAt: "asc" } }, assignments: { include: { exam: { select: { id: true, title: true, subject: true, status: true, joinCode: true, durationMinutes: true, _count: { select: { questions: true, submissions: true } } } } }, orderBy: { assignedAt: "desc" } } } });
    if (!c) return { success: false, error: "Không tìm thấy lớp" };
    if (c.teacherId !== userId && !c.members.some((m) => m.studentId === userId)) return { success: false, error: "Không có quyền" };
    return { success: true, classroom: c };
  }

  if (name === "create_classroom") {
    if (role !== "teacher") return { success: false, error: "Chỉ giáo viên được tạo lớp" };
    const name = str(a, "name");
    if (!name) return { success: false, error: "Tên lớp không được trống" };
    const classroom = await prisma.classroom.create({ data: { name, description: str(a, "description") || null, subject: str(a, "subject") || null, grade: str(a, "grade") || null, joinCode: await classCode(), teacherId: userId } });
    return { success: true, action: "created", classroom };
  }

  if (name === "update_classroom") {
    if (role !== "teacher") return { success: false, error: "Không có quyền" };
    const id = str(a, "classroom_id"), c = await prisma.classroom.findFirst({ where: { id, teacherId: userId } });
    if (!c) return { success: false, error: "Không tìm thấy lớp" };
    const data = { name: str(a, "name") || c.name, description: a.description === undefined ? c.description : str(a, "description") || null, subject: a.subject === undefined ? c.subject : str(a, "subject") || null, grade: a.grade === undefined ? c.grade : str(a, "grade") || null, archived: a.archived === undefined ? c.archived : bool(a, "archived") };
    return { success: true, action: "updated", classroom: await prisma.classroom.update({ where: { id }, data }) };
  }

  if (name === "delete_classroom") {
    if (role !== "teacher") return { success: false, error: "Không có quyền" };
    const id = str(a, "classroom_id"), c = await prisma.classroom.findFirst({ where: { id, teacherId: userId } });
    if (!c) return { success: false, error: "Không tìm thấy lớp" };
    await prisma.classroom.delete({ where: { id } });
    return { success: true, action: "deleted", classroom_id: id, name: c.name };
  }

  if (name === "assign_exam") {
    if (role !== "teacher") return { success: false, error: "Chỉ giáo viên được giao đề" };
    const classroomId = str(a, "classroom_id"), examId = str(a, "exam_id");
    const [c, exam] = await Promise.all([prisma.classroom.findFirst({ where: { id: classroomId, teacherId: userId } }), prisma.exam.findFirst({ where: { id: examId, teacherId: userId } })]);
    if (!c || !exam) return { success: false, error: "Không tìm thấy lớp hoặc đề" };
    const due = str(a, "due_date");
    const dueDate = due ? new Date(due) : null;
    if (due && Number.isNaN(dueDate.getTime())) return { success: false, error: "Hạn nộp không hợp lệ" };
    const assignment = await prisma.examAssignment.upsert({ where: { classroomId_examId: { classroomId, examId } }, create: { classroomId, examId, dueDate }, update: { dueDate } });
    const members = await prisma.classMember.findMany({ where: { classroomId }, select: { studentId: true } });
    if (members.length) await prisma.notification.createMany({ data: members.map((m) => ({ userId: m.studentId, type: "new_exam", title: "Giáo viên vừa giao đề thi mới", message: `Đề "${exam.title}" đã được giao trong lớp ${c.name}`, link: "/vao-thi" })) });
    return { success: true, action: "assigned", assignment, exam: { id: exam.id, title: exam.title, joinCode: exam.joinCode }, notifiedStudents: members.length };
  }

  if (name === "unassign_exam") {
    if (role !== "teacher") return { success: false, error: "Không có quyền" };
    const classroomId = str(a, "classroom_id"), examId = str(a, "exam_id");
    if (!(await prisma.classroom.findFirst({ where: { id: classroomId, teacherId: userId } })) || !(await prisma.exam.findFirst({ where: { id: examId, teacherId: userId } }))) return { success: false, error: "Không tìm thấy lớp hoặc đề" };
    const result = await prisma.examAssignment.deleteMany({ where: { classroomId, examId } });
    return { success: true, action: "unassigned", removed: result.count };
  }

  if (name === "remove_student") {
    if (role !== "teacher") return { success: false, error: "Không có quyền" };
    const classroomId = str(a, "classroom_id"), studentId = str(a, "student_id");
    if (!(await prisma.classroom.findFirst({ where: { id: classroomId, teacherId: userId } }))) return { success: false, error: "Không tìm thấy lớp" };
    const result = await prisma.classMember.deleteMany({ where: { classroomId, studentId } });
    return { success: true, action: "removed", removed: result.count };
  }

  if (name === "get_analytics") {
    if (role !== "teacher") return { success: false, error: "Chỉ giáo viên được xem thống kê" };
    const [exams, subs] = await Promise.all([prisma.exam.findMany({ where: { teacherId: userId }, include: { _count: { select: { questions: true, submissions: true } }, submissions: { select: { score: true } } }, orderBy: { createdAt: "desc" } }), prisma.submission.findMany({ where: { exam: { teacherId: userId } }, select: { score: true, durationSeconds: true, submittedAt: true } })]);
    const avg = subs.length ? subs.reduce((s, x) => s + x.score, 0) / subs.length : 0;
    return { success: true, summary: { totalExams: exams.length, totalSubmissions: subs.length, averageScore: avg, activeExams: exams.filter((e) => e.status === "published").length }, exams: exams.map((e) => ({ id: e.id, title: e.title, subject: e.subject, questions: e._count.questions, submissions: e._count.submissions, averageScore: e.submissions.length ? e.submissions.reduce((s, x) => s + x.score, 0) / e.submissions.length : null })) };
  }

  if (name === "get_submissions") {
    const examId = str(a, "exam_id");
    if (role === "teacher") {
      if (!(await prisma.exam.findFirst({ where: { id: examId, teacherId: userId } }))) return { success: false, error: "Không tìm thấy đề" };
      return { success: true, submissions: await prisma.submission.findMany({ where: { examId }, include: { student: { select: { id: true, name: true, email: true } } }, orderBy: { submittedAt: "desc" } }) };
    }
    return { success: true, submissions: await prisma.submission.findMany({ where: { examId, studentId: userId }, include: { exam: { select: { title: true, subject: true } } } }) };
  }

  if (name === "create_study_task") {
    if (role !== "student") return { success: false, error: "Chỉ học sinh được tạo nhiệm vụ" };
    const title = str(a, "title"); if (!title) return { success: false, error: "Thiếu tiêu đề" };
    const due = str(a, "due_date"), dueDate = due ? new Date(due) : null;
    if (due && Number.isNaN(dueDate.getTime())) return { success: false, error: "Ngày hạn không hợp lệ" };
    return { success: true, action: "created", task: await prisma.studyTask.create({ data: { studentId: userId, title, subject: str(a, "subject") || null, dueDate } }) };
  }

  if (name === "complete_study_task") {
    if (role !== "student") return { success: false, error: "Không có quyền" };
    const id = str(a, "task_id"), task = await prisma.studyTask.findFirst({ where: { id, studentId: userId } });
    if (!task) return { success: false, error: "Không tìm thấy nhiệm vụ" };
    return { success: true, action: "updated", task: await prisma.studyTask.update({ where: { id }, data: { completed: bool(a, "completed") } }) };
  }

  if (name === "delete_study_task") {
    if (role !== "student") return { success: false, error: "Không có quyền" };
    const id = str(a, "task_id"), task = await prisma.studyTask.findFirst({ where: { id, studentId: userId } });
    if (!task) return { success: false, error: "Không tìm thấy nhiệm vụ" };
    await prisma.studyTask.delete({ where: { id } }); return { success: true, action: "deleted", task_id: id };
  }

  if (name === "create_flashcard") {
    if (role !== "student") return { success: false, error: "Không có quyền" };
    const subject = str(a, "subject"), front = str(a, "front"), back = str(a, "back");
    if (!subject || !front || !back) return { success: false, error: "Thiếu thông tin flashcard" };
    return { success: true, action: "created", flashcard: await prisma.flashcard.create({ data: { studentId: userId, subject, front, back } }) };
  }

  if (name === "list_due_flashcards") {
    if (role !== "student") return { success: false, error: "Không có quyền" };
    return { success: true, flashcards: await prisma.flashcard.findMany({ where: { studentId: userId, nextReviewAt: { lte: new Date() } }, orderBy: { nextReviewAt: "asc" }, take: 50 }) };
  }

  if (name === "update_progress") {
    if (role !== "student") return { success: false, error: "Không có quyền" };
    const subject = str(a, "subject"), progress = Math.max(0, Math.min(100, int(a, "progress")));
    if (!subject) return { success: false, error: "Thiếu môn học" };
    return { success: true, action: "updated", progress: await prisma.subjectProgress.upsert({ where: { studentId_subject: { studentId: userId, subject } }, create: { studentId: userId, subject, progress }, update: { progress } }) };
  }

  if (name === "set_exam_date") {
    if (role !== "student") return { success: false, error: "Không có quyền" };
    const value = str(a, "exam_date"), date = value ? new Date(value) : null;
    if (value && Number.isNaN(date.getTime())) return { success: false, error: "Ngày thi không hợp lệ" };
    return { success: true, action: "updated", user: await prisma.user.update({ where: { id: userId }, data: { examDate: date } }) };
  }

  return { success: false, error: `Tool không tồn tại: ${name}` };
}

async function context(userId: string, role: Role) {
  if (role === "teacher") {
    const [exams, submissions, classes] = await Promise.all([prisma.exam.count({ where: { teacherId: userId } }), prisma.submission.count({ where: { exam: { teacherId: userId } } }), prisma.classroom.count({ where: { teacherId: userId, archived: false } })]);
    return `Dữ liệu nhanh: ${exams} đề, ${submissions} bài nộp, ${classes} lớp đang hoạt động.`;
  }
  const [user, tasks, due] = await Promise.all([prisma.user.findUnique({ where: { id: userId }, select: { name: true, examDate: true, streak: true } }), prisma.studyTask.count({ where: { studentId: userId, completed: false } }), prisma.flashcard.count({ where: { studentId: userId, nextReviewAt: { lte: new Date() } } })]);
  return `Học sinh: ${user?.name ?? ""}. Nhiệm vụ mở: ${tasks}. Flashcard đến hạn: ${due}. Streak: ${user?.streak ?? 0}.`;
}

function system(role: Role, ctx: string) {
  return role === "teacher" ? `Bạn là AI Agent của EduTest.vn dành cho giáo viên. Bạn có thể đọc và thao tác hệ thống bằng tools. QUY TẮC: Chỉ xác nhận thao tác khi tool trả success=true; tuyệt đối không bịa ID, mã đề, mã lớp, link, số liệu hay trạng thái. Nếu người dùng yêu cầu tạo/xuất bản/giao/xóa/cập nhật, hãy dùng tool và báo đúng kết quả thật. Không xóa nếu chưa được yêu cầu rõ ràng. Nếu thiếu thông tin, hỏi lại. Trả lời tiếng Việt, ngắn gọn. ${ctx}` : `Bạn là AI Study Coach của EduTest.vn. Bạn có thể đọc dữ liệu học tập và thực hiện các thao tác học tập bằng tools. Chỉ xác nhận thao tác khi tool trả success=true; không bịa dữ liệu. Trả lời tiếng Việt thân thiện, ngắn gọn. ${ctx}`;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "AI chưa được cấu hình" }, { status: 500 });
  const body = await req.json() as { message?: unknown; history?: unknown };
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) return NextResponse.json({ error: "Tin nhắn trống" }, { status: 400 });
  const role: Role = session.user.role === "teacher" ? "teacher" : "student";
  const history = Array.isArray(body.history) ? body.history.filter((x): x is { role: string; content: string } => typeof x === "object" && x !== null && typeof (x as { role?: unknown }).role === "string" && typeof (x as { content?: unknown }).content === "string").slice(-10) : [];
  const transcript = history.map((m) => `${m.role === "user" ? "Giáo viên/Học sinh" : "AI"}: ${m.content}`).join("\n");
  const input = transcript ? `Lịch sử gần đây:\n${transcript}\n\nTin nhắn mới:\n${message}` : message;
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const roleTools = toolsFor(role);
  try {
    let interaction = await ai.interactions.create({ model: MODEL, system_instruction: system(role, await context(session.user.id!, role)), input, tools: roleTools });
    for (let round = 0; round < MAX_ROUNDS; round += 1) {
      const calls = (interaction.steps ?? []).filter((step) => step.type === "function_call");
      if (!calls.length) break;
      const results = [];
      for (const call of calls) {
        let result: Record<string, unknown>;
        try { result = await runTool(call.name, (call.arguments && typeof call.arguments === "object" ? call.arguments : {}) as Args, session.user.id!, role); } catch (error) { console.error(`AI tool ${call.name} failed`, error); result = { success: false, error: "Không thể hoàn tất thao tác trên EduTest." }; }
        results.push({ type: "function_result" as const, name: call.name, call_id: call.id, result: [{ type: "text" as const, text: JSON.stringify(result) }] });
      }
      interaction = await ai.interactions.create({ model: MODEL, previous_interaction_id: interaction.id, input: results, tools: roleTools });
    }
    return NextResponse.json({ reply: interaction.output_text || "Đã xử lý xong.", interactionId: interaction.id });
  } catch (error) {
    console.error("AI agent error:", error);
    return NextResponse.json({ error: "AI đang bận hoặc model chưa khả dụng. Thử lại sau nhé!" }, { status: 500 });
  }
}
