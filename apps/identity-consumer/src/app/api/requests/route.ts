import {
  createAgeCheckRequest,
  encodeRequestToken,
  renderRequestExpression,
} from "@kyuix/protocol";
import { NextResponse } from "next/server";
import { saveIssuedRequest } from "@/lib/audit-store";

export const runtime = "nodejs";

function getConsumerDomain() {
  return process.env.CONSUMER_DOMAIN ?? process.env.APP_DOMAIN ?? "consumer.localtest.me";
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { minimumAge?: number };
    const minimumAge =
      typeof body.minimumAge === "number" && Number.isInteger(body.minimumAge)
        ? body.minimumAge
        : 18;
    const identityRequest = createAgeCheckRequest({
      issuerDomain: getConsumerDomain(),
      minimumAge,
    });
    const token = encodeRequestToken(identityRequest);

    await saveIssuedRequest(identityRequest, token);

    return NextResponse.json({
      request: identityRequest,
      token,
      explanation: renderRequestExpression(identityRequest.subject),
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to create identity request.";

    return NextResponse.json({ error: message }, { status: 400 });
  }
}
