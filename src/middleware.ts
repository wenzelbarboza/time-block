import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    // Protect all pages and APIs, excluding public endpoints, Next.js internals (_next), and auth pages.
    "/((?!api/auth|login|register|_next|logo.svg|favicon.ico).*)",
  ],
};
