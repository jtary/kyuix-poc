import { signResponsePayload } from "@kyuix/crypto";
import {
  buildResponsePayload,
  buildSignedResponse,
  decodeRequestToken,
  encodeResponseToken,
  evaluateRequestAgainstSubject,
} from "@kyuix/protocol";
import { NextResponse } from "next/server";
import {
  getDemoSubject,
  getProviderDomain,
  getProviderPrivateKey,
} from "@/lib/demo-subject";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      token?: string;
      consent?: boolean;
    };

    const token = body.token?.trim();

    if (!token) {
      throw new Error("Paste a request token before creating a response.");
    }

    if (body.consent !== true) {
      throw new Error("The user must explicitly consent before a response is signed.");
    }

    const identityRequest = decodeRequestToken(token);
    const subject = getDemoSubject();
    const subjectAnswer = evaluateRequestAgainstSubject(identityRequest, subject);
    const payload = buildResponsePayload({
      request: identityRequest,
      providerDomain: getProviderDomain(),
      subjectAnswer,
    });
    const signature = signResponsePayload(payload, getProviderPrivateKey());
    const response = buildSignedResponse(payload, signature);
    const responseToken = encodeResponseToken(response);

    return NextResponse.json({
      response,
      token: responseToken,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create the signed response.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
