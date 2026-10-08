import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "A6Class Edu — Tạo đề thi & kiểm tra trực tuyến",
    short_name: "A6Class Edu",
    description: "Tạo đề thi siêu tốc, chấm bài tự động, theo dõi tiến độ học tập cho giáo viên và học sinh Việt Nam.",
    start_url: "/",
    display: "standalone",
    background_color: "#F4F7FA",
    theme_color: "#0F4C81",
    lang: "vi",
  };
}
