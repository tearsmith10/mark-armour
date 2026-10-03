import NextAuth, { CredentialsSignin } from "next-auth";
import type { Provider } from "next-auth/providers/index";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { config } from "./config";
import { findOrCreateUser } from "./orders";
import { hashIdNumber, markEmailVerified, verifyPassword } from "./accounts";
import { initDb } from "./db";

function resolveSecret() {
  const s = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (s) return s;
  if (process.env.NODE_ENV === "production") {
    console.warn("[auth] AUTH_SECRET is not set — using fallback secret. Set AUTH_SECRET in production!");
  }
  return "ironclad-armory-dev-secret-change-me";
}

/**
 * Thrown from `authorize` when the password is right but the address was
 * never confirmed. Auth.js surfaces it as `?error=CredentialsSignin&code=verify_email`
 * (and as `code` in the JSON returned to `signIn(..., { redirect: false })`),
 * so the login UI can explain the failure instead of showing a generic one.
 */
class VerifyEmailSignin extends CredentialsSignin {
  code = "verify_email";
}

const providers: Provider[] = [];

// Google OAuth — configured through Google Cloud Console credentials.
if (config.hasGoogle) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      allowDangerousEmailAccountLinking: true,
    }),
  );
}

// Yahoo OAuth — wired up as soon as YAHOO_CLIENT_ID/SECRET are present.
// next-auth has no built-in Yahoo provider, so this is a custom OAuth 2.0
// provider pointed at Yahoo's OIDC-flavoured endpoints.
if (config.hasYahoo) {
  providers.push({
    id: "yahoo",
    name: "Yahoo",
    type: "oauth",
    clientId: process.env.YAHOO_CLIENT_ID!,
    clientSecret: process.env.YAHOO_CLIENT_SECRET!,
    authorization: {
      url: "https://api.login.yahoo.com/oauth2/request_auth",
      params: { scope: "openid profile email", prompt: "login" },
    },
    token: "https://api.login.yahoo.com/oauth2/token",
    userinfo: "https://api.login.yahoo.com/openid/v1/userinfo",
    checks: ["pkce", "state"],
    allowDangerousEmailAccountLinking: true,
    profile(p) {
      return {
        id: p.sub ?? p.id ?? "",
        name: p.name ?? null,
        email: p.email ?? null,
        image: typeof p.picture === "string" ? p.picture : null,
      };
    },
  });
}

// Email + password sign-in (accounts created through /signup).
providers.push(
  Credentials({
    id: "credentials",
    name: "Email and password",
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(creds) {
      const email = String(creds?.email ?? "").trim().toLowerCase();
      const password = String(creds?.password ?? "");
      if (!email || !password) return null;

      const db = await initDb();
      const { rows } = await db.query<{
        id: string;
        email: string;
        name: string | null;
        password_hash: string | null;
        email_verified_at: string | null;
      }>(
        "SELECT id, email, name, password_hash, email_verified_at FROM users WHERE LOWER(email) = $1",
        [email],
      );
      const user = rows[0];
      // No account, OAuth-only account or wrong password → generic failure.
      if (!user?.password_hash) return null;
      if (!(await verifyPassword(password, user.password_hash))) return null;
      // Right password but unconfirmed address → explain, don't just fail.
      if (!user.email_verified_at) throw new VerifyEmailSignin();
      return { id: user.id, email: user.email, name: user.name ?? null };
    },
  }),
);

// Identity sign-in (SSN / national ID captured & hashed at checkout).
providers.push(
  Credentials({
    id: "identity",
    name: "Identity document",
    credentials: {
      fullName: { label: "Full name", type: "text" },
      idType: { label: "Document type", type: "text" },
      idNumber: { label: "Document number", type: "text" },
    },
    async authorize(creds) {
      const fullName = String(creds?.fullName ?? "").trim();
      const idType = String(creds?.idType ?? "").trim();
      const idNumber = String(creds?.idNumber ?? "").trim();
      if (!fullName || !idNumber) return null;
      if (idType !== "ssn" && idType !== "national_id") return null;

      const db = await initDb();
      const { rows } = await db.query<{ id: string; email: string; name: string | null }>(
        `SELECT id, email, name FROM users
          WHERE id_hash = $1 AND id_type = $2 AND LOWER(name) = LOWER($3)`,
        [hashIdNumber(idNumber), idType, fullName],
      );
      const user = rows[0];
      if (!user) return null;
      return { id: user.id, email: user.email, name: user.name ?? fullName };
    },
  }),
);

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  session: { strategy: "jwt" },
  secret: resolveSecret(),
  trustHost: true,
  // Both the sign-in and the error page land on /login so failures
  // (including `?error=Configuration`) surface in our own UI.
  pages: { signIn: "/login", error: "/login" },
  callbacks: {
    async signIn({ user, account, profile }) {
      const provider = account?.provider;
      if ((provider === "google" || provider === "yahoo") && profile?.email) {
        const p = profile as { sub?: string; picture?: string };
        const dbUser = await findOrCreateUser({
          email: profile.email.toLowerCase(),
          name: profile.name ?? user.name,
          image: p.picture ?? user.image,
          googleId: provider === "google" ? p.sub : undefined,
        });
        user.id = dbUser.id;
        // OAuth providers vouch for the address — treat it as confirmed.
        await markEmailVerified(dbUser.id);
        return true;
      }
      if (provider === "google" || provider === "yahoo") {
        // No e-mail claim → we cannot map the session to a user row.
        return false;
      }
      // credentials ("credentials" + "identity") already resolved user.id.
      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    async session({ session, token }) {
      if (token.id && session.user) session.user.id = token.id as string;
      return session;
    },
  },
});

/** Server-side helper: current user or null. */
export async function currentUser() {
  const session = await auth();
  const u = session?.user;
  if (!u?.id) return null;
  return { id: u.id, email: u.email ?? "", name: u.name ?? null, image: u.image ?? null };
}
