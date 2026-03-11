import { generateKeyPairSync } from "node:crypto";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");

const privateKeyPkcs8Base64Url = privateKey
  .export({ type: "pkcs8", format: "der" })
  .toString("base64url");

const publicKeySpkiBase64Url = publicKey
  .export({ type: "spki", format: "der" })
  .toString("base64url");

const dnsValue = `kyuix-idp=v1; alg=Ed25519; publicKey=${publicKeySpkiBase64Url}`;

console.log("PROVIDER_PRIVATE_KEY_PKCS8_BASE64=" + privateKeyPkcs8Base64Url);
console.log("PROVIDER_PUBLIC_KEY_SPKI_BASE64=" + publicKeySpkiBase64Url);
console.log("DNS_TXT_VALUE=" + dnsValue);
