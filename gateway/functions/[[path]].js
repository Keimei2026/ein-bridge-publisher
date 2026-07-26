/**
 * Cloudflare Pages gateway.
 *
 * Both publisher.ein-8.com and docs.ein-8.com point to this Pages project.
 * Every request is forwarded privately to the existing Worker through a
 * Cloudflare Service Binding, preserving the original URL, method, headers,
 * cookies and request body.
 */
export async function onRequest(context) {
  return context.env.PUBLISHER.fetch(context.request);
}
