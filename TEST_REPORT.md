# RC5 test report

Test date: 2026-07-26

## Executed successfully in the build workspace

- TypeScript syntax/transpile parse for every Worker source file
- Worker static security and architecture audit: 17/17
- Pages gateway configuration audit: 6/6
- Pages gateway JavaScript syntax check
- Gateway forwarding unit test:
  - original URL and hostname preserved
  - HTTP method preserved
  - Origin and Cookie headers preserved
  - request body stream forwarded
  - downstream response status, headers and body returned
- JSON parsing of both Wrangler files and `package.json`

## Previously confirmed in the live Cloudflare account

- GitHub repository checkout
- dependency installation
- Worker build
- Worker deployment
- SQLite Durable Object migrations
- `workers.dev` health endpoint

## Requires the next live deployment

- Pages Git build using root directory `gateway`
- automatic application of the Pages Service Binding
- external-DNS custom-domain activation
- Xserver CNAME propagation
- Google login on `publisher.ein-8.com`
- real 1 MB, 3 MB and 5 MB uploads
- iPhone/iPad/Android browser checks

No live-only item is marked as completed before it is actually tested.
