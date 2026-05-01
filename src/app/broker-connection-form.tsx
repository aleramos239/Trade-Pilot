"use client";

import { KeyRound, PlugZap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const brokerPlatforms = ["Tradovate", "Rithmic", "ProjectX"] as const;

export function BrokerConnectionForm() {
  const router = useRouter();
  const [platform, setPlatform] = useState<(typeof brokerPlatforms)[number]>("Tradovate");
  const [mode, setMode] = useState<"simulation" | "live">("simulation");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [bridgeUrl, setBridgeUrl] = useState("");
  const [appId, setAppId] = useState("");
  const [appVersion, setAppVersion] = useState("1.0");
  const [cid, setCid] = useState("0");
  const [deviceId, setDeviceId] = useState("");
  const [environment, setEnvironment] = useState<"demo" | "live">("demo");
  const [validateNow, setValidateNow] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function saveConnection() {
    setMessage("");
    setError("");
    setIsSaving(true);

    try {
      const response = await fetch("/api/broker-connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          platform,
          mode,
          username,
          password,
          apiKey,
          apiSecret,
          bridgeUrl,
          appId,
          appVersion,
          cid,
          deviceId,
          environment,
          validateNow,
        }),
      });
      const body = await response.json();

      if (!response.ok) {
        setError(body.error ?? "Could not save broker connection.");
        return;
      }

      setMessage(
        body.credentialStored
          ? "Credentials encrypted and live adapter created."
          : "Simulation broker connection created.",
      );
      setName("");
      setUsername("");
      setPassword("");
      setApiKey("");
      setApiSecret("");
      setBridgeUrl("");
      setDeviceId("");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-white/10 bg-[#0d151d] p-5 shadow-2xl shadow-black/20">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300">
            Broker setup
          </p>
          <h2 className="mt-2 text-xl font-semibold text-white">Connect broker</h2>
        </div>
        <KeyRound className="text-cyan-300" size={22} aria-hidden="true" />
      </div>

      <div className="mt-5 grid gap-3">
        <label className="grid gap-1 text-sm">
          <span className="text-slate-400">Connection name</span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder={`${platform} ${mode === "simulation" ? "simulator" : "live stub"}`}
            className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Platform</span>
            <select
              value={platform}
              onChange={(event) => setPlatform(event.target.value as (typeof brokerPlatforms)[number])}
              className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-cyan-300"
            >
              {brokerPlatforms.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label className="grid gap-1 text-sm">
            <span className="text-slate-400">Mode</span>
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as "simulation" | "live")}
              className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-cyan-300"
            >
              <option value="simulation">Simulation</option>
              <option value="live">Live stub</option>
            </select>
          </label>
        </div>

        {mode === "live" ? (
          <div className="grid gap-3 rounded-md border border-amber-300/15 bg-amber-300/5 p-3">
            <p className="text-sm leading-6 text-amber-100">
              Live credentials are encrypted. Tradovate uses its native API; Rithmic and ProjectX use
              a broker bridge URL with validate, accounts, reconcile, orders, and flatten endpoints.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1 text-sm">
                <span className="text-slate-400">Environment</span>
                <select
                  value={environment}
                  onChange={(event) => setEnvironment(event.target.value as "demo" | "live")}
                  className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-cyan-300"
                >
                  <option value="demo">Demo</option>
                  <option value="live">Live</option>
                </select>
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-400">Username</span>
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-cyan-300"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-400">Password</span>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  type="password"
                  className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-cyan-300"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-400">App ID</span>
                <input
                  value={appId}
                  onChange={(event) => setAppId(event.target.value)}
                  className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-cyan-300"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-400">App version</span>
                <input
                  value={appVersion}
                  onChange={(event) => setAppVersion(event.target.value)}
                  className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-cyan-300"
                />
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span className="text-slate-400">API secret</span>
                <input
                  value={apiSecret}
                  onChange={(event) => setApiSecret(event.target.value)}
                  type="password"
                  className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-cyan-300"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-400">CID</span>
                <input
                  value={cid}
                  onChange={(event) => setCid(event.target.value)}
                  className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-cyan-300"
                />
              </label>
              <label className="grid gap-1 text-sm">
                <span className="text-slate-400">Device ID</span>
                <input
                  value={deviceId}
                  onChange={(event) => setDeviceId(event.target.value)}
                  className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-cyan-300"
                />
              </label>
              <label className="grid gap-1 text-sm sm:col-span-2">
                <span className="text-slate-400">API key label</span>
                <input
                  value={apiKey}
                  onChange={(event) => setApiKey(event.target.value)}
                  className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition focus:border-cyan-300"
                />
              </label>
              {platform !== "Tradovate" ? (
                <label className="grid gap-1 text-sm sm:col-span-2">
                  <span className="text-slate-400">Bridge URL</span>
                  <input
                    value={bridgeUrl}
                    onChange={(event) => setBridgeUrl(event.target.value)}
                    placeholder="https://your-broker-bridge.example.com"
                    className="h-10 rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100 outline-none transition placeholder:text-slate-600 focus:border-cyan-300"
                  />
                </label>
              ) : null}
            </div>
            {platform === "Tradovate" || bridgeUrl ? (
              <label className="flex items-center gap-3 text-sm text-slate-300">
                <input
                  type="checkbox"
                  checked={validateNow}
                  onChange={(event) => setValidateNow(event.target.checked)}
                  className="h-4 w-4 accent-cyan-300"
                />
                Validate credentials now
              </label>
            ) : (
              <p className="text-sm text-slate-400">
                Add a bridge URL to validate {platform} credentials.
              </p>
            )}
          </div>
        ) : null}

        <button
          type="button"
          onClick={saveConnection}
          disabled={isSaving}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <PlugZap size={16} aria-hidden="true" />
          {isSaving ? "Saving connection" : "Save broker connection"}
        </button>

        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    </div>
  );
}
