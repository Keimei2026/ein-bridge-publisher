# RC5 deployment checklist

## Already complete

- [x] GitHub repository connected to Cloudflare Workers Builds
- [x] Worker deployed as `ein-bridge-publisher`
- [x] Durable Objects created
- [x] Google OAuth Web Client created
- [x] `koube201@gmail.com` added as a test user
- [x] `https://publisher.ein-8.com` added as an authorized JavaScript origin

## Next human actions

1. Upload all RC5 files to the GitHub repository root and commit.
2. Confirm the existing Worker build succeeds automatically.
3. Create a Cloudflare Pages project from the same GitHub repository:
   - Project name: `ein-bridge-publisher-gateway`
   - Production branch: `main`
   - Root directory: `gateway`
   - Build command: leave blank
   - Build output directory: `public`
4. Confirm the Pages deployment succeeds and the Service Binding named
   `PUBLISHER` points to Worker `ein-bridge-publisher`.
5. In the Pages project, add these custom domains:
   - `publisher.ein-8.com`
   - `docs.ein-8.com`
6. In Xserver DNS, add exactly these records:
   - CNAME `publisher` -> `ein-bridge-publisher-gateway.pages.dev`
   - CNAME `docs` -> `ein-bridge-publisher-gateway.pages.dev`
7. Wait for TLS activation, then test Google login and publish a sample HTML file.
