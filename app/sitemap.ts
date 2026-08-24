import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://edutest-vn.vercel.app";
  return [
    { url: base, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/dang-nhap`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/dang-ky`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/vao-thi`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/dieu-khoan`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/bao-mat`, changeFrequency: "yearly", priority: 0.3 },
  ];
}
