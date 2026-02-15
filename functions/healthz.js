// ─── Health check endpoint ──────────────────────────────────────────────────
// GET /healthz — verifies R2 and AI bindings are accessible.

export async function onRequestGet(context) {
  const checks = {};
  let healthy = true;

  // Check R2 binding
  try {
    const bucket = context.env.REPORTS_BUCKET;
    if (!bucket) {
      checks.r2 = { status: "error", message: "REPORTS_BUCKET binding missing" };
      healthy = false;
    } else {
      // Lightweight HEAD on a known prefix to verify connectivity
      const listed = await bucket.list({ prefix: "reports/", limit: 1 });
      checks.r2 = { status: "ok", objects: listed?.objects?.length ?? 0 };
    }
  } catch (err) {
    checks.r2 = { status: "error", message: err instanceof Error ? err.message : String(err) };
    healthy = false;
  }

  // Check AI binding (existence only — don't run inference)
  try {
    const ai = context.env.AI;
    checks.ai = ai ? { status: "ok" } : { status: "error", message: "AI binding missing" };
    if (!ai) healthy = false;
  } catch (err) {
    checks.ai = { status: "error", message: err instanceof Error ? err.message : String(err) };
    healthy = false;
  }

  // Check Vectorize binding (existence only)
  try {
    const vi = context.env.VECTORIZE_INDEX;
    checks.vectorize = vi ? { status: "ok" } : { status: "warn", message: "VECTORIZE_INDEX binding missing (optional)" };
  } catch (err) {
    checks.vectorize = { status: "warn", message: err instanceof Error ? err.message : String(err) };
  }

  // Optional: check FinBERT service if configured (FINBERT_URL)
  try {
    const finbertUrl = String(context.env.FINBERT_URL || "").trim();
    if (!finbertUrl) {
      checks.finbert = { status: "warn", message: "FINBERT_URL not set (optional)" };
    } else {
      const controller = new AbortController();
      const t = setTimeout(() => controller.abort(), 2_500);
      try {
        const res = await fetch(`${finbertUrl.replace(/\/$/, "")}/health`, {
          method: "GET",
          signal: controller.signal,
        });

        if (!res.ok) {
          checks.finbert = { status: "error", http: res.status };
          healthy = false;
        } else {
          const json = await res.json().catch(() => null);
          checks.finbert = { status: "ok", ...(json && typeof json === "object" ? json : {}) };
        }
      } finally {
        clearTimeout(t);
      }
    }
  } catch (err) {
    checks.finbert = { status: "error", message: err instanceof Error ? err.message : String(err) };
    healthy = false;
  }

  const status = healthy ? 200 : 503;
  const body = {
    status: healthy ? "healthy" : "degraded",
    timestamp: new Date().toISOString(),
    checks,
  };

  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-cache, no-store",
    },
  });
}
