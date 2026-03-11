import { resolveProviderDnsRecord, verifySignedResponse } from "@kyuix/crypto";
import { decodeResponseToken, getDnsRecordName } from "@kyuix/protocol";
import { NextResponse } from "next/server";
import { getIssuedRequest, saveVerifiedResponse } from "@/lib/audit-store";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim();

    if (!token) {
      throw new Error("Paste a signed response token before verifying.");
    }

    const response = decodeResponseToken(token);
    const issuedRequest = await getIssuedRequest(response.requestId);

    if (!issuedRequest) {
      throw new Error("This response references an unknown requestId.");
    }

    if (response.displayText !== issuedRequest.displayText) {
      throw new Error("The signed response does not match the stored request text.");
    }

    const expectedDnsRecordName = getDnsRecordName(response.providerDomain);

    if (response.dnsRecordName !== expectedDnsRecordName) {
      throw new Error("The response dnsRecordName does not match the providerDomain.");
    }

    const dnsRecord = await resolveProviderDnsRecord(response.providerDomain);
    const signatureValid = verifySignedResponse(
      response,
      dnsRecord.publicKeyBase64Url,
    );

    if (!signatureValid) {
      throw new Error("The response signature did not validate against the DNS key.");
    }

    await saveVerifiedResponse(response, token);

    return NextResponse.json({
      verified: true,
      response,
      dnsRecord,
      issuedRequest,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to verify the response token.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
