"use client";

import { useState } from "react";
import Link from "next/link";

interface HealthResult {
  ok: boolean;
  status?: number;
  error?: string;
}

interface SiteRiskResult {
  domain?: string;
  normalizedUrl?: string;
  riskScore?: number;
  reasons?: string[];
  cached?: boolean;
  error?: string;
}

export default function BackendTestPage() {
  const [health, setHealth] = useState<HealthResult | null>(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [forceRefresh, setForceRefresh] = useState(false);
  const [siteRisk, setSiteRisk] = useState<SiteRiskResult | null>(null);
  const [siteRiskLoading, setSiteRiskLoading] = useState(false);

  const checkHealth = async () => {
    setHealthLoading(true);
    setHealth(null);
    try {
      const res = await fetch("/api/backend/health");
      const data = await res.json();
      setHealth({
        ok: res.ok && data.ok,
        status: res.status,
        ...(data.error && { error: data.error }),
      });
    } catch (e) {
      setHealth({ ok: false, error: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setHealthLoading(false);
    }
  };

  const checkSiteRisk = async () => {
    if (!url.trim()) return;
    setSiteRiskLoading(true);
    setSiteRisk(null);
    try {
      const res = await fetch("/api/backend/site-risk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim(), forceRefresh }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSiteRisk({ error: data.error ?? `HTTP ${res.status}` });
      } else {
        setSiteRisk({
          domain: data.domain,
          normalizedUrl: data.normalizedUrl,
          riskScore: data.riskScore,
          reasons: data.reasons,
          cached: data.cached,
        });
      }
    } catch (e) {
      setSiteRisk({ error: e instanceof Error ? e.message : "Request failed" });
    } finally {
      setSiteRiskLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-[#1d1d1f] p-6 flex flex-col">
      <div className="max-w-2xl mx-auto flex-1 w-full">
        <header className="mb-8">
          <Link
            href="/"
            className="text-sm text-[#6e6e73] hover:text-accent mb-2 inline-block"
          >
            ← Back to dashboard
          </Link>
          <h1 className="text-2xl font-semibold tracking-tight">Backend Tester</h1>
          <p className="text-[#6e6e73] text-sm mt-1">
            Test the backend API (health and site risk) through the dashboard. Ensure the backend is running on the configured URL (e.g. <code className="bg-[#f5f5f7] px-1 rounded">localhost:4000</code>).
          </p>
        </header>

        <section className="mb-8">
          <h2 className="text-lg font-medium text-[#1d1d1f] mb-3">Health check</h2>
          <div className="flex items-center gap-3">
            <button
              onClick={checkHealth}
              disabled={healthLoading}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-60"
            >
              {healthLoading ? "Checking…" : "Check health"}
            </button>
            {health && (
              <span
                className={`text-sm font-medium ${health.ok ? "text-green-600" : "text-[var(--danger)]"}`}
              >
                {health.ok ? "Backend is up" : health.error ?? `Error (${health.status})`}
              </span>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-medium text-[#1d1d1f] mb-3">Site risk</h2>
          <p className="text-[#6e6e73] text-sm mb-4">
            POST <code className="bg-[#f5f5f7] px-1 rounded">/api/site-risk</code> with a URL to get risk score and reasons.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <input
              type="url"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && checkSiteRisk()}
              className="flex-1 min-w-0 rounded-lg border border-[#e5e5e7] px-3 py-2 text-sm text-[#1d1d1f] focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <label className="flex items-center gap-2 text-sm text-[#6e6e73] shrink-0">
              <input
                type="checkbox"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
              />
              Force refresh
            </label>
            <button
              onClick={checkSiteRisk}
              disabled={siteRiskLoading || !url.trim()}
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:opacity-90 disabled:opacity-60 shrink-0"
            >
              {siteRiskLoading ? "Checking…" : "Check risk"}
            </button>
          </div>
          {siteRisk && (
            <div className="rounded-xl border border-[#e5e5e7] bg-[#f5f5f7] p-4 text-sm">
              {siteRisk.error ? (
                <p className="text-[var(--danger)]">{siteRisk.error}</p>
              ) : (
                <>
                  <p className="text-[#6e6e73] mb-1">
                    <strong className="text-[#1d1d1f]">Domain:</strong> {siteRisk.domain}
                  </p>
                  {siteRisk.normalizedUrl && (
                    <p className="text-[#6e6e73] mb-1">
                      <strong className="text-[#1d1d1f]">Normalized URL:</strong> {siteRisk.normalizedUrl}
                    </p>
                  )}
                  <p className="text-[#6e6e73] mb-1">
                    <strong className="text-[#1d1d1f]">Risk score:</strong> {siteRisk.riskScore}
                    {siteRisk.cached && (
                      <span className="ml-2 text-[#6e6e73]">(cached)</span>
                    )}
                  </p>
                  {siteRisk.reasons?.length ? (
                    <div className="mt-2">
                      <strong className="text-[#1d1d1f]">Reasons:</strong>
                      <ul className="list-disc list-inside text-[#6e6e73] mt-1">
                        {siteRisk.reasons.map((r, i) => (
                          <li key={i}>{r}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
