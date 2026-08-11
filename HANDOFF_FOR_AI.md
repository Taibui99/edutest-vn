# EduTest v2 — AI Handoff Document
> Dùng file này để bàn giao cho ChatGPT hoặc AI khác tiếp tục phát triển.
> Cập nhật lần cuối: EduTest v1.9.0

---

## 1. THÔNG TIN DỰ ÁN

- **Tên:** EduTest.vn — Nền tảng học tập và kiểm tra trực tuyến cho học sinh/giáo viên Việt Nam
- **Live URL:** https://edutest-vn.vercel.app
- **GitHub:** https://github.com/Taibui99/edutest-vn
- **Branch đang làm:** `feature/edutest-v2`
- **Supabase project ID:** `ukzqruepeduxpaiqccfg`

---

## 2. TECH STACK

```
Framework:    Next.js 16 (App Router, Server Components)
Language:     TypeScript (strict mode)
Database:     Supabase PostgreSQL
ORM:          Prisma 6.19
Auth:         NextAuth v5 (beta) — credentials provider, JWT
AI:           Google Gemini (@google/generative-ai)
Styling:      Tailwind CSS + CSS variables design system
Deploy:       Vercel
File parsing: mammoth (Word), Gemini (PDF)
Password:     bcryptjs (12 rounds)
```

---

## 3. DESIGN SYSTEM (CSS Variables — `app/globals.css`)

```css
--primary:        #6C63FF   /* Indigo chủ đạo */
--primary-light:  #EEEFFE
--primary-muted:  #D4CFFC
--coral:          #FF6B6B   /* Accent đỏ cam */
--mint:           #06D6A0   /* Xanh mint (đúng) */
--warning:        #FFD166   /* Vàng (cảnh báo) */
--danger:         #EF4444
--surface-card:   #FFFFFF (light) / #1E1E2E (dark)
--surface-border: #E8E4FF (light) / #2D2B45 (dark)
--text-primary:   #1A1523 (light) / #F0EFFE (dark)
--gray-100:       #F5F3FF
--gray-200:       #EAE8F5
Font:             Nunito (display) + Inter (body)
Border-radius:    14px cards, 10px buttons, 50% avatars
```

**Subject → Color mapping** (`lib/subject.ts`):
```ts
Toán → { bg: "#EEEFFE", text: "#6C63FF" }
Ngữ Văn → { bg: "#FFECEC", text: "#FF6B6B" }
Tiếng Anh → { bg: "#E1F5EE", text: "#06D6A0" }
Vật Lý → { bg: "#FFF8E1", text: "#C49A00" }
Hóa Học → { bg: "#E8F4FD", text: "#4EA8DE" }
Sinh Học → { bg: "#E6FFE6", text: "#22C55E" }
Lịch Sử → { bg: "#FFF0E6", text: "#F97316" }
Địa Lý → { bg: "#F0FFF0", text: "#16A34A" }
```

---

## 4. CẤU TRÚC FILE QUAN TRỌNG

```
edutest-vn/
├── prisma/schema.prisma          ← Database schema (xem mục 5)
├── auth.ts                       ← NextAuth config
├── auth.config.ts                ← JWT callbacks, role injection
├── proxy.ts                      ← Middleware (bảo vệ routes)
├── lib/
│   ├── prisma.ts                 ← Prisma client singleton
│   ├── nanoid.ts                 ← Sinh join code 6 ký tự
│   ├── subject.ts                ← Subject → color mapping
│   ├── spaced-repetition.ts      ← SM-2 algorithm
│   └── cn.ts                     ← clsx utility
├── components/
│   ├── ui/                       ← Button, Card, Input, Select, Spinner, Badge,
│   │                                Avatar, EmptyState, Progress, NotificationBell
│   └── layout/
│       ├── sidebar.tsx           ← Desktop sidebar (student/teacher nav khác nhau)
│       └── mobile-nav.tsx        ← Mobile bottom nav + topbar
├── app/
│   ├── layout.tsx                ← Root layout (fonts, theme)
│   ├── page.tsx                  ← Landing page
│   ├── globals.css               ← Design system CSS variables
│   ├── (auth)/
│   │   ├── dang-nhap/page.tsx    ← Login
│   │   └── dang-ky/page.tsx      ← Register (chọn student/teacher)
│   ├── vao-thi/page.tsx          ← Nhập join code để vào thi
│   ├── thi/[code]/
│   │   ├── page.tsx              ← Server: load exam, check auth
│   │   └── exam-taking-client.tsx ← Client: timer, answers, submit
│   ├── bang-dieu-khien/
│   │   ├── layout.tsx            ← Dashboard layout (sidebar + mobile nav)
│   │   ├── page.tsx              ← Dashboard (StudentDashboard | TeacherDashboard)
│   │   ├── de-thi/
│   │   │   ├── page.tsx          ← Exam list (teacher: grid đề | student: bài đã nộp)
│   │   │   └── [id]/
│   │   │       ├── page.tsx      ← Exam detail + submissions + analytics (teacher only)
│   │   │       └── exam-actions.tsx ← Nút đóng/mở đề, xóa (client component)
│   │   ├── tao-de-thi/page.tsx   ← 5-step exam creator (teacher only)
│   │   ├── hoc-tap/
│   │   │   ├── page.tsx          ← Study hub (server)
│   │   │   └── study-hub-client.tsx ← Flashcards, tasks, progress (client)
│   │   ├── lop-hoc/
│   │   │   ├── page.tsx          ← Classroom list (teacher tạo | student join)
│   │   │   └── [id]/page.tsx     ← Classroom detail (members + exams tabs)
│   │   ├── ket-qua/[id]/page.tsx ← Result page sau khi nộp bài
│   │   ├── ai/page.tsx           ← AI Study Coach chat
│   │   ├── thong-ke/page.tsx     ← Teacher analytics
│   │   ├── ho-so/page.tsx        ← Profile + đổi mật khẩu
│   │   └── ngan-hang/page.tsx    ← Question bank (UI placeholder, chưa có backend)
│   └── api/
│       ├── auth/register/route.ts
│       ├── exams/route.ts        ← GET list, POST create
│       ├── exams/[id]/route.ts   ← GET, PATCH, DELETE
│       ├── submissions/route.ts  ← POST submit + tính điểm + notification
│       ├── submissions/[id]/route.ts ← GET submission detail
│       ├── classrooms/route.ts   ← GET list, POST create
│       ├── classrooms/[id]/route.ts ← GET, PATCH, DELETE
│       ├── classrooms/[id]/members/route.ts ← DELETE member
│       ├── classrooms/[id]/assignments/route.ts ← POST giao đề, GET list
│       ├── classrooms/join/route.ts ← POST join by code
│       ├── notifications/route.ts ← GET list+count, PATCH mark read
│       ├── profile/route.ts      ← GET, PATCH (info + password)
│       ├── analytics/route.ts    ← GET teacher stats
│       ├── ai-coach/route.ts     ← POST chat với Gemini (context-aware)
│       ├── gemini/route.ts       ← POST extract questions từ PDF/Word
│       ├── study/flashcards/...  ← CRUD flashcards + SM-2 review
│       ├── study/tasks/...       ← CRUD study tasks
│       ├── study/progress/route.ts ← PATCH subject progress
│       └── study/exam-date/route.ts ← PUT exam date
```

---

## 5. DATABASE SCHEMA ĐẦY ĐỦ

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  password      String   // bcrypt hash
  name          String
  role          String   // "student" | "teacher"
  avatarUrl     String?
  school        String?
  grade         String?
  bio           String?
  examDate      DateTime?
  streak        Int      @default(0)
  lastStudyDate DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt
  // Relations: exams, submissions, studyTasks, flashcards,
  //            subjectProgress, notifications,
  //            classroomsAsTeacher, classroomsAsMember
}

model Classroom {
  id          String   @id @default(cuid())
  name        String
  description String?
  subject     String?
  grade       String?
  joinCode    String   @unique
  teacherId   String
  archived    Boolean  @default(false)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model ClassMember {
  classroomId String
  studentId   String
  joinedAt    DateTime @default(now())
  @@unique([classroomId, studentId])
}

model ExamAssignment {
  classroomId String
  examId      String
  dueDate     DateTime?
  assignedAt  DateTime  @default(now())
  @@unique([classroomId, examId])
}

model Exam {
  id               String   @id @default(cuid())
  title            String
  subject          String
  description      String?
  durationMinutes  Int
  joinCode         String   @unique
  status           String   @default("published") // "published" | "draft"
  shuffleQuestions Boolean  @default(false)
  shuffleAnswers   Boolean  @default(false)
  maxAttempts      Int      @default(1)
  showAnswers      Boolean  @default(true)
  teacherId        String
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model Question {
  id          String   @id @default(cuid())
  examId      String
  text        String
  options     String[] // ["A. ...", "B. ...", "C. ...", "D. ..."]
  answer      String   // "A" | "B" | "C" | "D"
  explanation String?
  points      Float    @default(1)
  order       Int
}

model Submission {
  id              String   @id @default(cuid())
  examId          String
  studentId       String
  answers         Json     // { [questionId]: "A" | "B" | "C" | "D" }
  score           Float    // 0-10
  correctCount    Int
  totalQuestions  Int
  durationSeconds Int
  submittedAt     DateTime @default(now())
  @@unique([examId, studentId])  // 1 học sinh chỉ nộp 1 lần
}

model StudyTask {
  id        String    @id @default(cuid())
  studentId String
  title     String
  subject   String?
  dueDate   DateTime?
  completed Boolean   @default(false)
  createdAt DateTime  @default(now())
}

model Flashcard {
  id             String   @id @default(cuid())
  studentId      String
  subject        String
  front          String
  back           String
  easinessFactor Float    @default(2.5)  // SM-2
  intervalDays   Int      @default(1)    // SM-2
  repetitions    Int      @default(0)    // SM-2
  nextReviewAt   DateTime @default(now())
  createdAt      DateTime @default(now())
}

model SubjectProgress {
  studentId String
  subject   String
  progress  Int      @default(0) // 0-100
  @@unique([studentId, subject])
}

model Notification {
  id        String   @id @default(cuid())
  userId    String
  type      String   // "exam_result" | "class_join" | "new_exam" | "reminder" | "system"
  title     String
  message   String
  link      String?
  read      Boolean  @default(false)
  createdAt DateTime @default(now())
}
```

---

## 6. AUTH & PHÂN QUYỀN

- **NextAuth v5** với Credentials provider
- Role (`student` | `teacher`) được lưu trong JWT token
- **Middleware** (`proxy.ts`): chặn tất cả routes `/bang-dieu-khien/*` và `/api/*` nếu chưa login
- **Server-side check** mọi API: `const session = await auth(); if (!session?.user) return 401`
- **Role check**: các API teacher-only kiểm tra `session.user.role !== "teacher"`
- **KHÔNG BAO GIỜ** tin role từ client, luôn verify từ session

---

## 7. CONVENTION QUAN TRỌNG

### Routing (tiếng Việt)
```
/bang-dieu-khien          → Dashboard
/bang-dieu-khien/de-thi   → Exams
/bang-dieu-khien/tao-de-thi → Create exam
/bang-dieu-khien/hoc-tap  → Study hub
/bang-dieu-khien/lop-hoc  → Classrooms
/bang-dieu-khien/ai       → AI Coach
/bang-dieu-khien/thong-ke → Statistics
/bang-dieu-khien/ho-so    → Profile
/bang-dieu-khien/ngan-hang → Question bank
/bang-dieu-khien/ket-qua/[id] → Result page
/vao-thi                  → Enter join code
/thi/[code]               → Take exam
```

### Components
- **Server Component mặc định** — chỉ thêm `"use client"` khi cần state/effect
- **`params` phải `await`**: `const { id } = await params;`
- **Không dùng `any`** — TypeScript strict
- **Import từ `@/`** — không dùng relative paths dài

### API Response format
```ts
// Success
return NextResponse.json(data, { status: 200 | 201 })

// Error
return NextResponse.json({ error: "Message" }, { status: 400 | 401 | 403 | 404 })
```

### Scoring logic (trong `api/submissions/route.ts`)
```ts
// Mỗi câu đúng = 1 điểm, tổng quy về thang 10
const correctCount = answers đúng
const score = (correctCount / totalQuestions) * 10
// Làm tròn 1 chữ số: Math.round(score * 10) / 10
```

### Notification trigger
Mỗi khi có sự kiện quan trọng, gọi:
```ts
await prisma.notification.create({
  data: {
    userId: "id người nhận",
    type: "exam_result" | "class_join" | "new_exam" | "reminder",
    title: "Tiêu đề ngắn",
    message: "Nội dung chi tiết",
    link: "/bang-dieu-khien/...",  // optional
  }
})
```

---

## 8. TRẠNG THÁI HIỆN TẠI — v1.9.0

### ✅ HOẠT ĐỘNG ĐẦY ĐỦ
- Đăng ký / đăng nhập / đăng xuất + phân quyền role
- Dashboard student (điểm TB, tasks, flashcards due, tiến độ môn, THPT countdown)
- Dashboard teacher (tổng đề, bài nộp, điểm TB, đề đang mở)
- Tạo đề thi 5 bước + import PDF/Word qua Gemini
- Vào thi bằng join code
- Làm bài thi (timer, navigator, auto-submit)
- Nộp bài → redirect trang kết quả chi tiết
- Trang kết quả (score gauge, review đáp án, giải thích)
- Chi tiết đề thi cho teacher (danh sách bài nộp + analytics)
- Hệ thống lớp học (tạo, join, xem thành viên, kick, giao đề)
- Thông báo real-time (bell, unread count, mark read)
- Flashcards + SM-2 spaced repetition
- Study tasks (CRUD)
- AI Study Coach (chat với Gemini, context từ dữ liệu thật)
- Thống kê teacher (phân bố điểm, hoạt động 7 ngày, per-exam stats)
- Hồ sơ + đổi mật khẩu
- Responsive mobile (bottom nav, topbar, breakpoints)

### ⚠️ MỘT PHẦN / CÓ BUG
| Vấn đề | Chi tiết |
|---|---|
| Ngân hàng câu hỏi | Có file `ngan-hang/page.tsx` nhưng chỉ là placeholder, không có backend |
| Sửa đề thi | Không có trang edit, không có `PUT /api/exams/[id]` |
| Nút đóng/mở đề | API có (`PATCH status`) nhưng cần verify UI trong `exam-actions.tsx` |
| Autosave bài thi | Answers mất khi refresh (chưa dùng localStorage/sessionStorage) |
| Streak học tập | Schema có cột `streak` nhưng không bao giờ cập nhật |
| `maxAttempts` | Schema có nhưng logic submission chỉ enforce 1 lần (@@unique) |
| Landing page | Dùng design cũ, chưa cập nhật theo v2 |
| `/bang-dieu-khien/hoc-sinh` | Sidebar teacher có link nhưng trang không tồn tại (404) |

### ❌ CHƯA LÀM
- Question bank thật (CRUD độc lập với exam)
- Edit exam sau khi tạo
- Search/filter trong danh sách đề
- Schedule exam (thời gian mở/đóng tự động)
- Anti-cheat (tab detection, fullscreen)
- Mark for review trong bài thi
- Forgot password
- Avatar upload
- Analytics theo học sinh cụ thể
- Student analytics page
- Notification khi có đề mới
- AI generate flashcard
- Flashcard deck/bộ thẻ
- Landing page v2

---

## 9. DANH SÁCH VIỆC CẦN LÀM TIẾP (ƯU TIÊN CAO → THẤP)

### 🔴 P0 — Fix bugs nghiêm trọng
1. **Fix 404 `/bang-dieu-khien/hoc-sinh`** — Tạo trang danh sách học sinh cho teacher
2. **Xác nhận `exam-actions.tsx` hoạt động** — Nút đóng/mở/xóa đề trong exam detail

### 🟠 P1 — Tính năng còn thiếu quan trọng
3. **Trang sửa đề thi** — `/bang-dieu-khien/de-thi/[id]/sua` + `PUT /api/exams/[id]`
4. **Ngân hàng câu hỏi thật** — `GET/POST /api/questions` với schema Question độc lập
5. **Autosave bài thi** — Lưu answers vào `sessionStorage` mỗi 10 giây
6. **Search đề thi** — Filter client-side theo tên, môn, trạng thái

### 🟡 P2 — Cải thiện
7. **Student analytics** — Trang `/bang-dieu-khien/tien-do` với biểu đồ điểm theo thời gian
8. **Streak tracking** — Cập nhật `streak` + `lastStudyDate` mỗi khi học sinh hoạt động
9. **Notification: đề mới** — Trigger notification khi teacher tạo đề + giao vào lớp
10. **Mark for review** — Đánh dấu câu cần xem lại trong bài thi

### 🟢 P3 — Nice to have
11. **Landing page v2** — Redesign theo design system màu sắc mới
12. **Avatar upload** — Dùng Supabase Storage
13. **Edit flashcard** — Hiện chỉ có tạo và xóa
14. **AI generate flashcard** — AI tạo thẻ → lưu vào DB

---

## 10. ENV VARS CẦN THIẾT

```env
DATABASE_URL=postgresql://...@...supabase.co:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://...@...supabase.co:5432/postgres
NEXTAUTH_SECRET=random-secret-string
NEXTAUTH_URL=https://edutest-vn.vercel.app
GEMINI_API_KEY=AIza...
GEMINI_MODEL=gemini-2.5-flash
```

---

## 11. LỆNH CẦN BIẾT

```bash
npm run dev          # Dev server
npm run build        # prisma generate + prisma db push + next build
npm run lint         # ESLint
npx tsc --noEmit     # TypeScript check

# Khi thêm model mới vào schema.prisma:
npx prisma db push --accept-data-loss  # Push schema lên Supabase (không xóa data)
npx prisma generate                     # Sinh lại Prisma client types

# Git workflow (Windows PowerShell):
git add .
git commit -m "feat: ..."
git push origin feature/edutest-v2
# Nếu bị reject: git pull origin main --no-rebase → resolve conflict → push lại
```

---

## 12. PROMPT MẪU ĐỂ GIAO CHO AI KHÁC

Copy đoạn sau và paste vào ChatGPT / AI khác:

---

```
Bạn đang tiếp quản dự án EduTest.vn - một nền tảng EdTech Việt Nam xây dựng với Next.js 16, TypeScript, Prisma, Supabase PostgreSQL, NextAuth v5, Gemini AI, Tailwind CSS.

Toàn bộ context dự án nằm trong file HANDOFF_FOR_AI.md tôi sẽ paste bên dưới.

TRẠNG THÁI: Vừa hoàn thành v1.9.0. Code đã pass TypeScript (0 errors) và ESLint (0 errors, 0 warnings).

NHIỆM VỤ TIẾP THEO (làm theo thứ tự):
1. Tạo trang /bang-dieu-khien/hoc-sinh cho teacher (danh sách học sinh từ tất cả lớp)
2. Tạo trang sửa đề thi /bang-dieu-khien/de-thi/[id]/sua + API PUT /api/exams/[id]
3. Thêm autosave answers vào sessionStorage trong exam-taking-client.tsx
4. Xây dựng ngân hàng câu hỏi thật (CRUD riêng, không gắn với exam cụ thể)

QUY TẮC BẮT BUỘC:
- Sau mỗi thay đổi: chạy `npx tsc --noEmit` và `npm run lint`, fix hết errors
- KHÔNG dùng mock data — phải kết nối DB thật qua Prisma
- KHÔNG xóa/rewrite working features
- KHÔNG reset database
- Server Components by default, chỉ "use client" khi cần
- Params trong Next.js 15+ phải `await`: const { id } = await params
- Mọi API phải verify auth: const session = await auth(); if (!session?.user) return 401

[PASTE NỘI DUNG HANDOFF_FOR_AI.md VÀO ĐÂY]
```

---

*File này được tạo tự động. Cập nhật lại sau mỗi phiên làm việc.*
