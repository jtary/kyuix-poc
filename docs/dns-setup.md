# DNS and Key Setup

The consumer verifies provider responses by resolving a TXT record from the
provider domain and using the published Ed25519 public key to verify the
signature.

## Record convention

- DNS record name: `_kyuix-idp.<provider-domain>`
- TXT value format: `kyuix-idp=v1; alg=Ed25519; publicKey=<base64url-spki>`

Example:

```txt
Host: _kyuix-idp.provider.example.com
Type: TXT
Value: kyuix-idp=v1; alg=Ed25519; publicKey=MCowBQYDK2VwAyEA...
```

## Generate a key pair

Run the helper script from the repository root:

```bash
npm run generate:provider-keys
```

The script prints:

- `PROVIDER_PRIVATE_KEY_PKCS8_BASE64`
- `PROVIDER_PUBLIC_KEY_SPKI_BASE64`
- `DNS_TXT_VALUE`

Use them like this:

1. Put `PROVIDER_PRIVATE_KEY_PKCS8_BASE64` into the provider app environment.
2. Publish `DNS_TXT_VALUE` at `_kyuix-idp.<provider-domain>`.
3. Set `PROVIDER_DOMAIN` to the exact domain that owns the TXT record.

## Environment variables

Provider:

```env
PROVIDER_DOMAIN=provider.example.com
PROVIDER_PRIVATE_KEY_PKCS8_BASE64=<value-from-script>
DEMO_SUBJECT_DOB=1998-04-12
```

Consumer:

```env
CONSUMER_DOMAIN=consumer.localtest.me
```

## Verify the DNS record

Check that DNS is live before testing the end-to-end flow:

```bash
nslookup -type=TXT _kyuix-idp.provider.example.com
```

or:

```bash
dig TXT _kyuix-idp.provider.example.com
```

The consumer app expects at least one TXT record at that host to parse into the
exact `kyuix-idp=v1; alg=Ed25519; publicKey=...` format.

## Notes

- The apps can run locally in Docker while the provider domain points at a real
  public DNS zone.
- The signature only verifies if `PROVIDER_DOMAIN` exactly matches the domain
  used for the TXT record.
- For the POC, the provider signs a yes/no answer derived from the local demo
  subject profile.
