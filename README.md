# Ein Bridge Publisher RC5

Ein Bridge Publisher publishes ChatGPT-generated HTML as stable public URLs.

## Production architecture

```text
GitHub main
  ├─ Cloudflare Workers Builds
  │    └─ ein-bridge-publisher Worker
  │         ├─ Catalog Durable Object
  │         └─ Site Durable Objects
  └─ Cloudflare Pages Git build (root: gateway)
       └─ ein-bridge-publisher-gateway.pages.dev
            ├─ publisher.ein-8.com
            └─ docs.ein-8.com
```

`ein-8.com` remains on Xserver DNS. Only two CNAME records are added at
Xserver. The domain's nameservers, website and mail records are not moved.

## URLs

- Admin: `https://publisher.ein-8.com`
- Public documents: `https://docs.ein-8.com/p/<slug>`
- Temporary Worker test URL:
  `https://ein-bridge-publisher.keimei-kaminaga.workers.dev`

## Authentication

- Google Identity Services ID token login
- Allowed account: `koube201@gmail.com`
- JWT signature, issuer, audience, authorized party, expiry and verified email
  are checked by the Worker
- Session cookie is HttpOnly, Secure and SameSite=Strict
- CSRF token and same-origin checks are enforced

## Publishing

- Maximum HTML size at launch: 5 MB
- Browser upload chunks: 128 KB
- SHA-256 integrity validation
- Static mode blocks scripts
- Interactive mode allows inline scripts but blocks external network access
- Ten revisions retained
- Rollback, delete and 30-day restore

## Deployment

Read `DEPLOY_CHECKLIST.md`. Do not add `ein-8.com` as a Cloudflare DNS zone and
do not change Xserver nameservers.
