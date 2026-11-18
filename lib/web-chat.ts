/**
 * The public Web Chat widget.
 *
 * One module owns the URL the widget lives at and the snippet a business pastes
 * into its site, so the Channels hub and `/settings/web-chat` cannot drift and
 * produce two different embed codes for the same tenant.
 */

/** Where the public widget is served from. */
export const WEB_CHAT_ORIGIN = "https://colly.com.ng";

/** The public chat link for one business: `{origin}/chat/{businessId}`. */
export function webChatLink(businessId: string): string {
  return `${WEB_CHAT_ORIGIN}/chat/${businessId}`;
}

/**
 * The `<iframe>` snippet a business pastes into its website.
 *
 * Kept as one inline style block (no external stylesheet) because a site builder
 * that accepts HTML may not accept a `<link>`.
 */
export function webChatEmbedCode(businessId: string): string {
  return `<iframe src="${webChatLink(
    businessId,
  )}" width="100%" height="600px" style="border:none; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.1);"></iframe>`;
}
