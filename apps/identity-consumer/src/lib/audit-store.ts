import type { IdentityRequest, SignedIdentityResponse } from "@kyuix/protocol";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface IssuedRequestRecord {
  requestId: string;
  token: string;
  issuerDomain: string;
  displayText: string;
  createdAt: string;
}

export interface VerifiedResponseRecord {
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

const auditFilePath = path.join(process.cwd(), "data", "audit.json");

async function ensureAuditFile() {
  await mkdir(path.dirname(auditFilePath), { recursive: true });

  try {
    await readFile(auditFilePath, "utf8");
  } catch {
    await writeFile(
      auditFilePath,
      JSON.stringify({ issuedRequests: [], verifiedResponses: [] }, null, 2),
      "utf8",
    );
  }
}

async function readAuditStore(): Promise<AuditStore> {
  await ensureAuditFile();
  const raw = await readFile(auditFilePath, "utf8");

  return JSON.parse(raw) as AuditStore;
}

async function writeAuditStore(store: AuditStore) {
  await writeFile(auditFilePath, JSON.stringify(store, null, 2), "utf8");
}

export async function saveIssuedRequest(request: IdentityRequest, token: string) {
  const store = await readAuditStore();

  store.issuedRequests = [
    {
      requestId: request.requestId,
      token,
      issuerDomain: request.issuerDomain,
      displayText: request.displayText,
      createdAt: request.createdAt,
    },
    ...store.issuedRequests.filter((entry) => entry.requestId !== request.requestId),
  ].slice(0, 20);

  await writeAuditStore(store);
}

export async function getIssuedRequest(requestId: string) {
  const store = await readAuditStore();

  return store.issuedRequests.find((entry) => entry.requestId === requestId) ?? null;
}

export async function saveVerifiedResponse(
  response: SignedIdentityResponse,
  token: string,
) {
  const store = await readAuditStore();

  store.verifiedResponses = [
    {
      requestId: response.requestId,
      token,
      providerDomain: response.providerDomain,
      dnsRecordName: response.dnsRecordName,
      subjectAnswer: response.subjectAnswer,
      issuedAt: response.issuedAt,
      verifiedAt: new Date().toISOString(),
    },
    ...store.verifiedResponses.filter((entry) => entry.requestId !== response.requestId),
  ].slice(0, 20);

  await writeAuditStore(store);
}

export async function getAuditStore() {
  return readAuditStore();
}
