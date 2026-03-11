import { randomUUID } from "node:crypto";

const REQUEST_VERSION = "kyuix.request.v1" as const;
const RESPONSE_VERSION = "kyuix.response.v1" as const;
const SIGNATURE_ALGORITHM = "Ed25519" as const;

export type SubjectDataPath = "subject.dateOfBirth";

export interface BornOnOrBeforeExpression {
  type: "bornOnOrBefore";
  path: SubjectDataPath;
  value: string;
}

export type RequestSubjectExpression = BornOnOrBeforeExpression;

export interface IdentityRequest {
  version: typeof REQUEST_VERSION;
  requestId: string;
  issuerDomain: string;
  createdAt: string;
  subject: RequestSubjectExpression;
  displayText: string;
}

export interface IdentityResponsePayload {
  requestId: string;
  providerDomain: string;
  dnsRecordName: string;
  subjectAnswer: boolean;
  issuedAt: string;
  displayText: string;
}

export interface SignedIdentityResponse extends IdentityResponsePayload {
  version: typeof RESPONSE_VERSION;
  signatureAlgorithm: typeof SIGNATURE_ALGORITHM;
  signature: string;
}

export interface SubjectProfile {
  dateOfBirth: string;
}

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && isoDatePattern.test(value);
}

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function assertString(value: unknown, fieldName: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Expected ${fieldName} to be a non-empty string.`);
  }

  return value;
}

function assertBoolean(value: unknown, fieldName: string): boolean {
  if (typeof value !== "boolean") {
    throw new Error(`Expected ${fieldName} to be a boolean.`);
  }

  return value;
}

function assertDomainLike(value: unknown, fieldName: string): string {
  const domain = assertString(value, fieldName);

  if (/[\s/]/.test(domain)) {
    throw new Error(`Expected ${fieldName} to be a hostname-style value.`);
  }

  return domain;
}

function validateExpression(value: unknown): RequestSubjectExpression {
  if (!isRecord(value)) {
    throw new Error("Expected subject expression to be an object.");
  }

  if (value.type !== "bornOnOrBefore") {
    throw new Error("Unsupported request subject expression type.");
  }

  if (value.path !== "subject.dateOfBirth") {
    throw new Error("Unsupported request subject data path.");
  }

  if (!isIsoDate(value.value)) {
    throw new Error("Expected request subject value to be an ISO date.");
  }

  return {
    type: "bornOnOrBefore",
    path: "subject.dateOfBirth",
    value: value.value,
  };
}

function normalizeJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeJson(entry));
  }

  if (isRecord(value)) {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, JsonValue>>((result, key) => {
        result[key] = normalizeJson(value[key] as JsonValue);
        return result;
      }, {});
  }

  return value;
}

function decodeToken<T>(token: string): T {
  const normalizedToken = token.trim();

  if (!normalizedToken) {
    throw new Error("Expected a non-empty base64url token.");
  }

  try {
    const decoded = Buffer.from(normalizedToken, "base64url").toString("utf8");
    return JSON.parse(decoded) as T;
  } catch {
    throw new Error("Token is not valid base64url-encoded JSON.");
  }
}

export function canonicalizeJson(value: JsonValue): string {
  return JSON.stringify(normalizeJson(value));
}

export function encodeToken(value: JsonValue): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function generateRequestId(): string {
  return randomUUID();
}

export function getRequestVersion() {
  return REQUEST_VERSION;
}

export function getResponseVersion() {
  return RESPONSE_VERSION;
}

export function getSignatureAlgorithm() {
  return SIGNATURE_ALGORITHM;
}

export function getDnsRecordName(providerDomain: string): string {
  const normalizedDomain = providerDomain.trim().toLowerCase();

  return `_kyuix-idp.${normalizedDomain}`;
}

export function createAgeCheckRequest(input: {
  issuerDomain: string;
  minimumAge: number;
  now?: Date;
}): IdentityRequest {
  if (!Number.isInteger(input.minimumAge) || input.minimumAge <= 0) {
    throw new Error("Expected minimumAge to be a positive integer.");
  }

  const now = input.now ?? new Date();
  const cutoffDate = new Date(now);
  cutoffDate.setUTCFullYear(cutoffDate.getUTCFullYear() - input.minimumAge);
  const cutoff = cutoffDate.toISOString().slice(0, 10);

  return {
    version: REQUEST_VERSION,
    requestId: generateRequestId(),
    issuerDomain: assertDomainLike(input.issuerDomain, "issuerDomain"),
    createdAt: now.toISOString(),
    subject: {
      type: "bornOnOrBefore",
      path: "subject.dateOfBirth",
      value: cutoff,
    },
    displayText: `Confirm whether the subject is at least ${input.minimumAge} years old.`,
  };
}

export function encodeRequestToken(request: IdentityRequest): string {
  return encodeToken(request as unknown as JsonValue);
}

export function decodeRequestToken(token: string): IdentityRequest {
  const decoded = decodeToken<unknown>(token);

  if (!isRecord(decoded)) {
    throw new Error("Decoded request must be an object.");
  }

  if (decoded.version !== REQUEST_VERSION) {
    throw new Error("Unsupported request version.");
  }

  const request: IdentityRequest = {
    version: REQUEST_VERSION,
    requestId: assertString(decoded.requestId, "requestId"),
    issuerDomain: assertDomainLike(decoded.issuerDomain, "issuerDomain"),
    createdAt: assertString(decoded.createdAt, "createdAt"),
    subject: validateExpression(decoded.subject),
    displayText: assertString(decoded.displayText, "displayText"),
  };

  if (!isIsoTimestamp(request.createdAt)) {
    throw new Error("Expected createdAt to be an ISO timestamp.");
  }

  return request;
}

export function renderRequestExpression(expression: RequestSubjectExpression): string {
  if (expression.type === "bornOnOrBefore") {
    return `Check whether subject.dateOfBirth is on or before ${expression.value}.`;
  }

  return "Unknown request expression.";
}

export function evaluateRequestAgainstSubject(
  request: IdentityRequest,
  subject: SubjectProfile,
): boolean {
  if (!isIsoDate(subject.dateOfBirth)) {
    throw new Error("Subject profile dateOfBirth must be an ISO date.");
  }

  if (request.subject.type === "bornOnOrBefore") {
    return subject.dateOfBirth <= request.subject.value;
  }

  throw new Error("Unsupported request subject expression.");
}

export function buildResponsePayload(input: {
  request: IdentityRequest;
  providerDomain: string;
  subjectAnswer: boolean;
  issuedAt?: string;
}): IdentityResponsePayload {
  const providerDomain = assertDomainLike(input.providerDomain, "providerDomain");
  const issuedAt = input.issuedAt ?? new Date().toISOString();

  if (!isIsoTimestamp(issuedAt)) {
    throw new Error("Expected issuedAt to be an ISO timestamp.");
  }

  return {
    requestId: input.request.requestId,
    providerDomain,
    dnsRecordName: getDnsRecordName(providerDomain),
    subjectAnswer: input.subjectAnswer,
    issuedAt,
    displayText: input.request.displayText,
  };
}

export function buildSignedResponse(
  payload: IdentityResponsePayload,
  signature: string,
): SignedIdentityResponse {
  return {
    version: RESPONSE_VERSION,
    signatureAlgorithm: SIGNATURE_ALGORITHM,
    signature: assertString(signature, "signature"),
    ...payload,
  };
}

export function getResponsePayloadForSigning(
  response: SignedIdentityResponse | IdentityResponsePayload,
): IdentityResponsePayload {
  return {
    requestId: assertString(response.requestId, "requestId"),
    providerDomain: assertDomainLike(response.providerDomain, "providerDomain"),
    dnsRecordName: assertString(response.dnsRecordName, "dnsRecordName"),
    subjectAnswer: assertBoolean(response.subjectAnswer, "subjectAnswer"),
    issuedAt: assertString(response.issuedAt, "issuedAt"),
    displayText: assertString(response.displayText, "displayText"),
  };
}

export function encodeResponseToken(response: SignedIdentityResponse): string {
  return encodeToken(response as unknown as JsonValue);
}

export function decodeResponseToken(token: string): SignedIdentityResponse {
  const decoded = decodeToken<unknown>(token);

  if (!isRecord(decoded)) {
    throw new Error("Decoded response must be an object.");
  }

  if (decoded.version !== RESPONSE_VERSION) {
    throw new Error("Unsupported response version.");
  }

  if (decoded.signatureAlgorithm !== SIGNATURE_ALGORITHM) {
    throw new Error("Unsupported response signature algorithm.");
  }

  const response: SignedIdentityResponse = {
    version: RESPONSE_VERSION,
    signatureAlgorithm: SIGNATURE_ALGORITHM,
    signature: assertString(decoded.signature, "signature"),
    requestId: assertString(decoded.requestId, "requestId"),
    providerDomain: assertDomainLike(decoded.providerDomain, "providerDomain"),
    dnsRecordName: assertString(decoded.dnsRecordName, "dnsRecordName"),
    subjectAnswer: assertBoolean(decoded.subjectAnswer, "subjectAnswer"),
    issuedAt: assertString(decoded.issuedAt, "issuedAt"),
    displayText: assertString(decoded.displayText, "displayText"),
  };

  if (!isIsoTimestamp(response.issuedAt)) {
    throw new Error("Expected issuedAt to be an ISO timestamp.");
  }

  return response;
}
