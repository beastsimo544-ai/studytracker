import type { MetadataRoute } from "next";

export const dynamic = "force-static";

const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://studytracker-e2vs.vercel.app"
).replace(/\/+$/, "");

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/timer", "/download", "/login", "/register", "/privacy"],
        disallow: [
          "/dashboard",
          "/history",
          "/subject",
          "/friends",
          "/settings",
          "/reset-password",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
