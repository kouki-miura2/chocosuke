// Google Maps for an event's location (docs/spec.md "イベント > 画面 > 詳細"), without an API key.
// The link is a documented Maps URL (https://developers.google.com/maps/documentation/urls) and
// opens the Maps app on a phone. The embed is the keyless `output=embed` form, which Google doesn't
// document (the documented Maps Embed API needs a key): if it stops working, the link still does.
// The location is a place name, an address or `lat,lng`; Google resolves each the same way.

/** The map to show in an iframe, centered on `location`. */
export const mapEmbedUrl = (location: string): string =>
  `https://www.google.com/maps?q=${encodeURIComponent(location)}&output=embed`

/** Opens `location` in Google Maps (the app on a phone). */
export const mapLinkUrl = (location: string): string =>
  `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location)}`
