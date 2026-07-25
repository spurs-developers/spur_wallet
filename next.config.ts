import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: 'standalone',
  env: {
    APP_URL: process.env.APP_URL ?? "https://wallet.spurs.com.ng",
    SPURS_ISSUER: process.env.SPURS_ISSUER ?? "https://accounts.spurs.com.ng",
    SPURS_SESSION_SECRET: process.env.SPURS_SESSION_SECRET,
  },
};

export default nextConfig;
