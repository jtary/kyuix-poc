"use client";

import { useState } from "react";

interface EvaluationResult {
  request: {
    requestId: string;
    displayText: string;
  };
  requestText: string;
  answer: boolean;
  subject: {
    dateOfBirth: string;
  };
  providerDomain: string;
  dnsRecordName: string;
}

interface ResponseResult {
  response: {
    requestId: string;
    providerDomain: string;
    subjectAnswer: boolean;
    dnsRecordName: string;
    displayText: string;
  };
  token: string;
}

const buttonClassName =
  "rounded-md bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:cursor-not-allowed disabled:bg-slate-500";

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export default function Home() {
  const [requestToken, setRequestToken] = useState("");
  const [consent, setConsent] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState("");
  const [evaluation, setEvaluation] = useState<EvaluationResult | null>(null);
  const [responseResult, setResponseResult] = useState<ResponseResult | null>(null);

  async function handleEvaluate() {
    setEvaluating(true);
    setError("");
    setResponseResult(null);

    try {
      const response = await fetch("/api/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: requestToken }),
      });
      const payload = (await response.json()) as EvaluationResult & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to evaluate request.");
      }

      setEvaluation(payload);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error ? caughtError.message : "Failed to evaluate request.",
      );
    } finally {
      setEvaluating(false);
    }
  }

  async function handleSign() {
    setSigning(true);
    setError("");

    try {
      const response = await fetch("/api/respond", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: requestToken, consent }),
      });
      const payload = (await response.json()) as ResponseResult & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to sign response.");
      }

      setResponseResult(payload);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Failed to sign.");
    } finally {
      setSigning(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-violet-300">
            Identity Provider
          </p>
          <h1 className="text-4xl font-semibold">Consent and response signing console</h1>
          <p className="max-w-3xl text-sm text-slate-300">
            Paste an identity request token, inspect what is being asked, review the
            computed answer against the local demo subject, and sign a response if the
            user consents.
          </p>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <h2 className="text-xl font-semibold">1. Paste request token</h2>
          <textarea
            value={requestToken}
            onChange={(event) => setRequestToken(event.target.value)}
            className="mt-4 min-h-44 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
          />
          <button
            type="button"
            onClick={handleEvaluate}
            disabled={evaluating}
            className={`${buttonClassName} mt-4`}
          >
            {evaluating ? "Evaluating..." : "Evaluate request"}
          </button>
          {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        </section>

        {evaluation ? (
          <section className="grid gap-6 lg:grid-cols-2">
            <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">2. Review what is being asked</h2>
              <div className="mt-4 space-y-3 text-sm text-slate-200">
                <p>{evaluation.request.displayText}</p>
                <p className="text-slate-400">{evaluation.requestText}</p>
                <p>Demo subject DOB: {evaluation.subject.dateOfBirth}</p>
                <p>Computed answer: {evaluation.answer ? "yes" : "no"}</p>
                <p>Provider domain: {evaluation.providerDomain}</p>
                <p>Expected DNS TXT record: {evaluation.dnsRecordName}</p>
              </div>
            </article>

            <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
              <h2 className="text-xl font-semibold">3. Confirm consent and sign</h2>
              <label className="mt-4 flex items-start gap-3 text-sm text-slate-200">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(event) => setConsent(event.target.checked)}
                  className="mt-1"
                />
                <span>
                  I confirm the subject approves disclosing this yes/no result to the
                  requesting site.
                </span>
              </label>
              <button
                type="button"
                onClick={handleSign}
                disabled={signing}
                className={`${buttonClassName} mt-4`}
              >
                {signing ? "Signing..." : "Create signed response"}
              </button>
              {responseResult ? (
                <div className="mt-5 space-y-3 rounded-xl border border-violet-900 bg-violet-950/30 p-4">
                  <p className="text-sm text-violet-100">
                    Signed answer:{" "}
                    {responseResult.response.subjectAnswer ? "yes" : "no"}
                  </p>
                  <textarea
                    readOnly
                    value={responseResult.token}
                    className="min-h-40 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => copyText(responseResult.token)}
                    className={buttonClassName}
                  >
                    Copy response token
                  </button>
                </div>
              ) : null}
            </article>
          </section>
        ) : null}
      </div>
    </main>
  );
}
