// Shopify's CDN serves the original upload (often 1-2MB) unless asked to resize.
// jumpseller/wixstatic/WordPress URLs are left untouched — no reliable resize param to guess.
export function cdnResize(url, width) {
  if (!url) return url
  if (!/cdn\.shopify\.com|\/cdn\/shop\//.test(url)) return url
  const sep = url.includes('?') ? '&' : '?'
  return `${url}${sep}width=${width}`
}
