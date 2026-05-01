import { AppShell } from "./app-shell";
import { OperatorLogin } from "./operator-login";
import { getCurrentUser } from "@/lib/auth/session";
import { getWorkspaceForUser } from "@/lib/data/store";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getCurrentUser();

  if (!user) {
    return <OperatorLogin />;
  }

  const workspace = await getWorkspaceForUser(user.id);

  if (!workspace) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#070c0a] px-4 text-slate-100">
        <div className="rounded-lg border border-white/10 bg-[#1a1f1c] p-6 text-sm text-slate-300">
          Workspace not found for {user.email}.
        </div>
      </main>
    );
  }

  return (
    <AppShell
      workspace={workspace}
      tradovateOAuthConfigured={Boolean(
        process.env.TRADOVATE_OAUTH_CLIENT_ID && process.env.TRADOVATE_OAUTH_CLIENT_SECRET,
      )}
    />
  );
}
