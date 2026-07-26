# RC5 architecture review

## Fixed production design

- Cloudflare Free plan
- Xserver remains authoritative DNS for `ein-8.com`
- Existing website and mail DNS records remain untouched
- Two Xserver CNAME records point only the Publisher subdomains to Pages
- Cloudflare Pages accepts the two external-DNS custom subdomains
- Pages Function forwards requests privately through a Service Binding
- Existing Worker owns authentication, application routing and Durable Objects
- GitHub automatically deploys the Worker and Pages projects

## Why this design

A Worker Custom Domain requires an active Cloudflare DNS zone. Cloudflare's
partial/CNAME zone setup, which would keep another authoritative DNS provider,
is not available on the Free plan. Cloudflare Pages explicitly supports custom
subdomains using an external DNS provider through a CNAME to the project's
`pages.dev` hostname. Pages Service Bindings can call an existing Worker without
sending the request over the public Internet.

## Risk controls

- No nameserver migration
- No MX/SPF/DKIM changes
- Original request URL and hostname reach the Worker, preserving host routing,
  Origin validation, cookies and CSRF protections
- Worker remains independently reachable through `workers.dev` for diagnosis
- RC4 is superseded and must not be deployed
