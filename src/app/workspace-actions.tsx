"use client";

import { LockKeyhole, LogOut, Pause, Play, Power } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { AccountStatus } from "@/lib/trading/types";

export function SignOutButton() {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function signOut() {
    setIsPending(true);
    await fetch("/api/session", { method: "DELETE" });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={signOut}
      disabled={isPending}
      className="inline-flex h-10 items-center gap-2 rounded-md border border-white/10 bg-white/[0.03] px-3 text-sm font-medium text-slate-300 transition hover:bg-white/[0.07] disabled:opacity-60"
    >
      <LogOut size={15} aria-hidden="true" />
      Sign out
    </button>
  );
}

export function CopierRuleToggle({ ruleId, enabled }: { ruleId: string; enabled: boolean }) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function toggleRule() {
    setIsPending(true);
    await fetch(`/api/copier-rules/${ruleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enabled: !enabled }),
    });
    setIsPending(false);
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggleRule}
      disabled={isPending}
      className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition disabled:opacity-60 ${
        enabled
          ? "bg-emerald-400/10 text-emerald-200 hover:bg-emerald-400/15"
          : "bg-amber-400/10 text-amber-200 hover:bg-amber-400/15"
      }`}
    >
      <Power size={15} aria-hidden="true" />
      {enabled ? "Copier on" : "Copier off"}
    </button>
  );
}

export function AccountControls({
  accountId,
  copyEnabled,
  status,
  isLeader,
}: {
  accountId: string;
  copyEnabled: boolean;
  status: AccountStatus;
  isLeader: boolean;
}) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);
  const isLocked = status === "locked";

  async function patchAccount(updates: { copyEnabled?: boolean; status?: "online" | "paused" }) {
    setIsPending(true);
    await fetch(`/api/accounts/${accountId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    setIsPending(false);
    router.refresh();
  }

  if (isLocked) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-rose-400/10 px-3 text-xs font-semibold uppercase tracking-[0.12em] text-rose-300 opacity-80"
      >
        <LockKeyhole size={14} aria-hidden="true" />
        locked
      </button>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {!isLeader ? (
        <button
          type="button"
          onClick={() => patchAccount({ copyEnabled: !copyEnabled })}
          disabled={isPending}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-white/[0.04] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-60"
        >
          {copyEnabled ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
          {copyEnabled ? "disarm" : "arm"}
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => patchAccount({ status: status === "online" ? "paused" : "online" })}
        disabled={isPending}
        className="inline-flex h-9 items-center gap-2 rounded-md bg-white/[0.04] px-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-300 transition hover:bg-white/[0.08] disabled:opacity-60"
      >
        {status === "online" ? <Pause size={14} aria-hidden="true" /> : <Play size={14} aria-hidden="true" />}
        {status === "online" ? "pause" : "resume"}
      </button>
    </div>
  );
}
