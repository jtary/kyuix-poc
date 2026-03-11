"use client";

import { useEffect, useState } from "react";

interface IssuedRequestRecord {
  requestId: string;
  token: string;
  issuerDomain: string;
  displayText: string;
  createdAt: string;
}

interface VerifiedResponseRecord {
  requestId: string;
  token: string;
  providerDomain: string;
  dnsRecordName: string;
  subjectAnswer: boolean;
  issuedAt: string;
  verifiedAt: string;
}

interface AuditStore {
  issuedRequests: IssuedRequestRecord[];
  verifiedResponses: VerifiedResponseRecord[];
}

interface CreatedRequestResult {
  request: {
    requestId: string;
    issuerDomain: string;
    createdAt: string;
    displayText: string;
  };
  token: string;
  explanation: string;
}

interface VerificationResult {
  verified: boolean;
  response: {
    requestId: string;
    providerDomain: string;
    dnsRecordName: string;
    subjectAnswer: boolean;
    issuedAt: string;
    displayText: string;
  };
  dnsRecord: {
    recordName: string;
    rawRecord: string;
  };
  issuedRequest: IssuedRequestRecord;
}

const buttonClassName =
  "rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:bg-slate-500";

async function copyText(value: string) {
  await navigator.clipboard.writeText(value);
}

export default function Home() {
  const [minimumAge, setMinimumAge] = useState(18);
  const [requestToken, setRequestToken] = useState("");
  const [responseToken, setResponseToken] = useState("");
  const [createdRequest, setCreatedRequest] = useState<CreatedRequestResult | null>(null);
  const [verificationResult, setVerificationResult] =
    useState<VerificationResult | null>(null);
  const [audit, setAudit] = useState<AuditStore>({
    issuedRequests: [],
    verifiedResponses: [],
  });
  const [requestError, setRequestError] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [creating, setCreating] = useState(false);
  const [verifying, setVerifying] = useState(false);

  async function loadAudit() {
    const response = await fetch("/api/audit");
    const payload = (await response.json()) as AuditStore;
    setAudit(payload);
  }

  useEffect(() => {
    void loadAudit();
  }, []);

  async function handleCreateRequest() {
    setCreating(true);
    setRequestError("");

    try {
      const response = await fetch("/api/requests", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ minimumAge }),
      });
      const payload = (await response.json()) as CreatedRequestResult & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to create request.");
      }

      setCreatedRequest(payload);
      setRequestToken(payload.token);
      await loadAudit();
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : "Failed to create request.");
    } finally {
      setCreating(false);
    }
  }

  async function handleVerifyResponse() {
    setVerifying(true);
    setVerifyError("");

    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: responseToken }),
      });
      const payload = (await response.json()) as VerificationResult & { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to verify response.");
      }

      setVerificationResult(payload);
      await loadAudit();
    } catch (error) {
      setVerifyError(error instanceof Error ? error.message : "Failed to verify response.");
    } finally {
      setVerifying(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-950 px-6 py-10 text-slate-100">
      <div className="mx-auto flex max-w-6xl flex-col gap-8">
        <header className="space-y-3">
          <p className="text-sm uppercase tracking-[0.2em] text-sky-300">
            Identity Consumer
          </p>
          <h1 className="text-4xl font-semibold">Age verification request console</h1>
          <p className="max-w-3xl text-sm text-slate-300">
            Create a signed-data request, copy the resulting base64url token to the
            provider, then paste the signed response back here for DNS-backed
            verification.
          </p>
        </header>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">1. Create identity request</h2>
            <p className="mt-2 text-sm text-slate-300">
              The POC currently issues a single atomic question: whether the subject is
              at least the chosen age threshold.
            </p>
            <label className="mt-5 block text-sm font-medium text-slate-200">
              Minimum age
            </label>
            <input
              type="number"
              min={1}
              value={minimumAge}
              onChange={(event) => setMinimumAge(Number(event.target.value))}
              className="mt-2 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={handleCreateRequest}
              disabled={creating}
              className={`${buttonClassName} mt-4`}
            >
              {creating ? "Creating..." : "Create request"}
            </button>
            {requestError ? (
              <p className="mt-3 text-sm text-rose-300">{requestError}</p>
            ) : null}
            {createdRequest ? (
              <div className="mt-5 space-y-3 rounded-xl border border-sky-900 bg-sky-950/40 p-4">
                <p className="text-sm text-sky-100">{createdRequest.request.displayText}</p>
                <p className="text-xs text-slate-300">{createdRequest.explanation}</p>
                <textarea
                  readOnly
                  value={requestToken}
                  className="min-h-36 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
                />
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={() => copyText(requestToken)}
                    className={buttonClassName}
                  >
                    Copy request token
                  </button>
                  <span className="text-xs text-slate-400">
                    Request ID: {createdRequest.request.requestId}
                  </span>
                </div>
              </div>
            ) : null}
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">2. Verify signed response</h2>
            <p className="mt-2 text-sm text-slate-300">
              Verification checks the request ID, resolves the provider public key from
              DNS TXT, and validates the Ed25519 signature.
            </p>
            <label className="mt-5 block text-sm font-medium text-slate-200">
              Signed response token
            </label>
            <textarea
              value={responseToken}
              onChange={(event) => setResponseToken(event.target.value)}
              className="mt-2 min-h-40 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs"
            />
            <button
              type="button"
              onClick={handleVerifyResponse}
              disabled={verifying}
              className={`${buttonClassName} mt-4`}
            >
              {verifying ? "Verifying..." : "Verify response"}
            </button>
            {verifyError ? (
              <p className="mt-3 text-sm text-rose-300">{verifyError}</p>
            ) : null}
            {verificationResult ? (
              <div className="mt-5 space-y-2 rounded-xl border border-emerald-900 bg-emerald-950/30 p-4 text-sm">
                <p className="font-medium text-emerald-200">
                  Verified: {verificationResult.response.subjectAnswer ? "yes" : "no"}
                </p>
                <p className="text-slate-200">{verificationResult.response.displayText}</p>
                <p className="text-xs text-slate-400">
                  Provider domain: {verificationResult.response.providerDomain}
                </p>
                <p className="text-xs text-slate-400">
                  DNS record: {verificationResult.dnsRecord.recordName}
                </p>
                <p className="text-xs text-slate-400">
                  TXT payload: {verificationResult.dnsRecord.rawRecord}
                </p>
              </div>
            ) : null}
          </article>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Issued requests</h2>
            <div className="mt-4 space-y-3">
              {audit.issuedRequests.length === 0 ? (
                <p className="text-sm text-slate-400">No requests issued yet.</p>
              ) : (
                audit.issuedRequests.map((entry) => (
                  <div
                    key={entry.requestId}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <p className="text-sm text-slate-100">{entry.displayText}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      {entry.requestId} · {entry.issuerDomain}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{entry.createdAt}</p>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="rounded-2xl border border-slate-800 bg-slate-900 p-6">
            <h2 className="text-xl font-semibold">Verified responses</h2>
            <div className="mt-4 space-y-3">
              {audit.verifiedResponses.length === 0 ? (
                <p className="text-sm text-slate-400">No verified responses yet.</p>
              ) : (
                audit.verifiedResponses.map((entry) => (
                  <div
                    key={`${entry.requestId}-${entry.verifiedAt}`}
                    className="rounded-xl border border-slate-800 bg-slate-950 p-4"
                  >
                    <p className="text-sm text-slate-100">
                      {entry.subjectAnswer ? "Approved" : "Rejected"}
                    </p>
                    <p className="mt-1 text-xs text-slate-400">
                      {entry.providerDomain} · {entry.dnsRecordName}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">{entry.verifiedAt}</p>
                  </div>
                ))
              )}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}
