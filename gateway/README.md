# Ein Bridge Publisher Gateway

This Cloudflare Pages project is the public entry point for:

- `https://publisher.ein-8.com`
- `https://docs.ein-8.com`

The authoritative DNS for `ein-8.com` remains at Xserver. Both subdomains use
CNAME records targeting `ein-bridge-publisher-gateway.pages.dev`.

The catch-all Pages Function forwards requests to the existing
`ein-bridge-publisher` Worker through the `PUBLISHER` Service Binding. The
Worker continues to own authentication, routing and Durable Objects.
