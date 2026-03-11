import type { SubjectProfile } from "@kyuix/protocol";

export function getDemoSubject(): SubjectProfile {
  return {
    dateOfBirth: process.env.DEMO_SUBJECT_DOB ?? "1998-04-12",
  };
}

export function getProviderDomain() {
  return process.env.PROVIDER_DOMAIN ?? process.env.APP_DOMAIN ?? "provider.example.com";
}

export function getProviderPrivateKey() {
  const privateKey = process.env.PROVIDER_PRIVATE_KEY_PKCS8_BASE64;

  if (!privateKey) {
    throw new Error(
      "PROVIDER_PRIVATE_KEY_PKCS8_BASE64 is not configured for the provider app.",
    );
  }

  return privateKey;
}
