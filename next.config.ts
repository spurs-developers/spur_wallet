import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev is opened on both localhost:3200 and 127.0.0.1:3200 (shared-cookie SSO
  // across the Spurs apps), so allow HMR/dev resources from these hosts.
  allowedDevOrigins: ["127.0.0.1", "localhost"],
};

export default nextConfig;
