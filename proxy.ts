import { createSpursProxy } from "@spurs-cloud/accounts/next";

// Gate the wallet behind the shared Spurs session. The landing, login bounce,
// SSO handlers, the private service API and provider webhooks stay public.
// (Next 16 renamed the `middleware` convention to `proxy`.)
export const proxy = createSpursProxy({
  publicPaths: ["/", "/login", "/auth/", "/api/private/", "/api/webhooks/"],
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
