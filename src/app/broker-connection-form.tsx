"use client";

import { KeyRound, LogIn, PlugZap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const brokerPlatforms = ["Tradovate", "Rithmic", "ProjectX"] as const;

export function BrokerConnectionForm({
  tradovateOAuthConfigured,
}: {
  tradovateOAuthConfigured: boolean;
}) {
  const router = useRouter();
  const [platform, setPlatform] = useState<(typeof brokerPlatforms)[number]>("Tradovate");
  const [mode] = useState<"live">("live");
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
  const [showAdvancedDirect, setShowAdvancedDirect] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [brokerConnectStatus] = useState(() =>
    typeof window === "undefined"
      ? ""
      : new URLSearchParams(window.location.search).get("brokerConnect") ?? "",
  );
  const showManualSave = mode !== "live" || platform !== "Tradovate" || showAdvancedDirect;
  const brokerConnectMessage =
    brokerConnectStatus === "tradovate-oauth-connected"
      ? "Tradovate login connected and accounts were discovered."
      : brokerConnectStatus === "tradovate-oauth-connected-no-accounts"
        ? "Tradovate login connected, but no accounts were discovered yet."
        : brokerConnectStatus === "tradovate-oauth-missing-env"
          ? "Tradovate OAuth needs TRADOVATE_OAUTH_CLIENT_ID and TRADOVATE_OAUTH_CLIENT_SECRET in env."
          : brokerConnectStatus === "tradovate-oauth-state-error"
            ? "Tradovate login expired or failed state validation. Start the login again."
            : brokerConnectStatus === "tradovate-oauth-denied"
              ? "Tradovate login was canceled or denied."
              : "";

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

  function startTradovateOAuth() {
    setMessage("");
    setError("");

    if (!tradovateOAuthConfigured) {
      setError("Tradovate OAuth is not configured yet. Register the app in Tradovate, run npm.cmd run tradovate:oauth, then restart Trade Pilot.");
      return;
    }

    const params = new URLSearchParams({
      environment,
      ...(name.trim() ? { name: name.trim() } : {}),
    });
    window.location.assign(`/api/broker-connections/oauth/tradovate/start?${params.toString()}`);
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
            placeholder={`${platform} live`}
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

          <div className="grid gap-1 text-sm">
            <span className="text-slate-400">Connection type</span>
            <div className="flex h-10 items-center rounded-md border border-white/10 bg-[#071016] px-3 text-slate-100">
              Live broker
            </div>
          </div>
        </div>

        {mode === "live" ? (
          <div className="grid gap-3 rounded-md border border-amber-300/15 bg-amber-300/5 p-3">
            <p className="text-sm leading-6 text-amber-100">
              Live credentials are encrypted. Tradovate should be connected through broker login;
              Rithmic and ProjectX use a broker bridge URL with validate, accounts, reconcile,
              orders, and flatten endpoints.
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
              {platform === "Tradovate" ? (
                <div className="grid gap-3 rounded-md border border-cyan-300/20 bg-cyan-300/5 p-3 sm:col-span-2">
                  {!tradovateOAuthConfigured ? (
                    <div className="rounded-md border border-amber-300/30 bg-amber-300/10 p-3 text-sm text-amber-100">
                      <p className="font-semibold">Tradovate login is not ready on this machine.</p>
                      <p className="mt-2 leading-6">
                        Create an OAuth Registration in Tradovate with redirect URI
                        {" "}
                        <span className="font-mono text-amber-50">
                          http://localhost:3000/api/broker-connections/oauth/tradovate/callback
                        </span>
                        , then run <span className="font-mono text-amber-50">npm.cmd run tradovate:oauth</span>
                        {" "}and restart the app.
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-md border border-emerald-300/25 bg-emerald-300/10 p-3 text-sm text-emerald-100">
                      Tradovate OAuth is configured. The login button can open Tradovate now.
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={startTradovateOAuth}
                    disabled={!tradovateOAuthConfigured}
                    className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <LogIn size={16} aria-hidden="true" />
                    {tradovateOAuthConfigured ? "Log in with Tradovate" : "Tradovate setup required"}
                  </button>
                  <p className="text-xs leading-5 text-slate-400">
                    This works like Tradecopia after you register this app in Tradovate API Access.
                    Use redirect URI http://localhost:3000/api/broker-connections/oauth/tradovate/callback.
                  </p>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedDirect((value) => !value)}
                    className="justify-self-start text-xs font-semibold text-cyan-200 underline underline-offset-4"
                  >
                    {showAdvancedDirect ? "Hide direct API credentials" : "Advanced direct API credentials"}
                  </button>
                </div>
              ) : null}
              {platform === "Tradovate" && !showAdvancedDirect ? null : (
                <>
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
                </>
              )}
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
            {(platform === "Tradovate" && showAdvancedDirect) || bridgeUrl ? (
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
                {platform === "Tradovate"
                  ? "Use the Tradovate login button for the normal broker connection flow."
                  : `Add a bridge URL to validate ${platform} credentials.`}
              </p>
            )}
          </div>
        ) : null}

        {showManualSave ? (
          <button
            type="button"
            onClick={saveConnection}
            disabled={isSaving}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-cyan-300 px-4 text-sm font-semibold text-slate-950 transition hover:bg-cyan-200 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <PlugZap size={16} aria-hidden="true" />
            {isSaving ? "Saving connection" : "Save broker connection"}
          </button>
        ) : null}

        {brokerConnectMessage ? <p className="text-sm text-cyan-200">{brokerConnectMessage}</p> : null}
        {message ? <p className="text-sm text-emerald-300">{message}</p> : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    </div>
  );
}
