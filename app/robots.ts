import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/bang-dieu-khien", "/thi/", "/api/", "/doi-mat-khau"],
      },
    ],
  };
}
