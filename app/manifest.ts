import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "EduTest — Tạo đề thi & kiểm tra trực tuyến",
    short_name: "EduTest",
    description: "Tạo đề thi siêu tốc, chấm bài tự động, theo dõi tiến độ học tập cho giáo viên và học sinh Việt Nam.",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F7FB",
    theme_color: "#0369A1",
    lang: "vi",
  };
}
