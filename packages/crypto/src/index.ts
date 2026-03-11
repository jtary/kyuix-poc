import {
  canonicalizeJson,
  getDnsRecordName,
  getResponsePayloadForSigning,
  type IdentityResponsePayload,
  type SignedIdentityResponse,
} from "@kyuix/protocol";
import { createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { resolveTxt } from "node:dns/promises";

const DNS_RECORD_PREFIX = "kyuix-idp=v1";
const DNS_ALGORITHM_VALUE = "Ed25519";

export interface ProviderDnsRecord {
  recordName: string;
  algorithm: string;
  publicKeyBase64Url: string;
  rawRecord: string;
}

function toCanonicalBuffer(value: object): Buffer {
  return Buffer.from(canonicalizeJson(value as any), "utf8");
}

function importPrivateKey(privateKeyPkcs8Base64Url: string) {
  return createPrivateKey({
    key: Buffer.from(privateKeyPkcs8Base64Url, "base64url"),
    format: "der",
    type: "pkcs8",
  });
}

function importPublicKey(publicKeySpkiBase64Url: string) {
  return createPublicKey({
    key: Buffer.from(publicKeySpkiBase64Url, "base64url"),
    format: "der",
    type: "spki",
  });
}

export function createDnsTxtRecordValue(publicKeySpkiBase64Url: string): string {
  return `${DNS_RECORD_PREFIX}; alg=${DNS_ALGORITHM_VALUE}; publicKey=${publicKeySpkiBase64Url}`;
}

export function parseDnsTxtRecord(recordName: string, rawRecord: string): ProviderDnsRecord {
  const sections = rawRecord.split(";").map((section) => section.trim());

  if (sections[0] !== DNS_RECORD_PREFIX) {
    throw new Error("TXT record does not match the expected kyuix format.");
  }

  const fields = new Map<string, string>();

  for (const section of sections.slice(1)) {
    const [key, value] = section.split("=", 2);

    if (key && value) {
      fields.set(key.trim(), value.trim());
    }
  }

  const algorithm = fields.get("alg");
  const publicKeyBase64Url = fields.get("publicKey");

  if (algorithm !== DNS_ALGORITHM_VALUE) {
    throw new Error("TXT record does not declare the expected Ed25519 algorithm.");
  }

  if (!publicKeyBase64Url) {
    throw new Error("TXT record does not include a publicKey value.");
  }

  return {
    recordName,
    algorithm,
    publicKeyBase64Url,
    rawRecord,
  };
}

export async function resolveProviderDnsRecord(
  providerDomain: string,
): Promise<ProviderDnsRecord> {
  const recordName = getDnsRecordName(providerDomain);
  const records = await resolveTxt(recordName);

  for (const recordChunks of records) {
    const rawRecord = recordChunks.join("");

    try {
      return parseDnsTxtRecord(recordName, rawRecord);
    } catch {
      continue;
    }
  }

  throw new Error(`No matching kyuix TXT record was found at ${recordName}.`);
}

export function signResponsePayload(
  payload: IdentityResponsePayload,
  privateKeyPkcs8Base64Url: string,
): string {
  const signature = sign(
    null,
    toCanonicalBuffer(getResponsePayloadForSigning(payload)),
    importPrivateKey(privateKeyPkcs8Base64Url),
  );

  return signature.toString("base64url");
}

export function verifySignedResponse(
  response: SignedIdentityResponse,
  publicKeySpkiBase64Url: string,
): boolean {
  return verify(
    null,
    toCanonicalBuffer(getResponsePayloadForSigning(response)),
    importPublicKey(publicKeySpkiBase64Url),
    Buffer.from(response.signature, "base64url"),
  );
}
