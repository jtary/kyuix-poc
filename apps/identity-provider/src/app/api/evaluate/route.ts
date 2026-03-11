import {
  decodeRequestToken,
  evaluateRequestAgainstSubject,
  getDnsRecordName,
  renderRequestExpression,
} from "@kyuix/protocol";
import { NextResponse } from "next/server";
import { getDemoSubject, getProviderDomain } from "@/lib/demo-subject";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { token?: string };
    const token = body.token?.trim();

    if (!token) {
      throw new Error("Paste a request token before evaluating it.");
    }

    const identityRequest = decodeRequestToken(token);
    const subject = getDemoSubject();
    const answer = evaluateRequestAgainstSubject(identityRequest, subject);
    const providerDomain = getProviderDomain();

    return NextResponse.json({
      request: identityRequest,
      requestText: renderRequestExpression(identityRequest.subject),
      answer,
      subject,
      providerDomain,
      dnsRecordName: getDnsRecordName(providerDomain),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to evaluate the request.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
