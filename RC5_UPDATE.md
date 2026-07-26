# RC5 update

RC5 fixes the deployment architecture without changing the existing Xserver
nameservers.

## Final architecture

- Xserver remains the authoritative DNS provider for `ein-8.com`.
- The existing `ein-bridge-publisher` Worker remains the application and
  Durable Objects backend.
- A small Cloudflare Pages gateway is added under `gateway/`.
- `publisher.ein-8.com` and `docs.ein-8.com` are attached to the Pages project.
- Xserver receives only two CNAME records, both pointing to
  `ein-bridge-publisher-gateway.pages.dev`.
- GitHub automatically deploys both the Worker project and the Pages project.

## Do not do

- Do not add `ein-8.com` as a Cloudflare DNS zone.
- Do not change Xserver nameservers.
- Do not use Cloudflare partial/CNAME zone setup.
- Do not deploy RC4.
