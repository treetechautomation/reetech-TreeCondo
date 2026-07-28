export const DEFAULT_RESERVATION_OFFER_DURATION_MINUTES = 2 * 60;

export function isOfferExpired(offerExpiresAt: any): boolean {
  if (offerExpiresAt == null) return false;
  try {
    let ms: number;
    if (typeof offerExpiresAt === "number") {
      ms = offerExpiresAt;
    } else if (typeof offerExpiresAt?.toMillis === "function") {
      ms = offerExpiresAt.toMillis();
    } else if (typeof offerExpiresAt?.toDate === "function") {
      ms = offerExpiresAt.toDate().getTime();
    } else if (offerExpiresAt?._seconds != null) {
      ms = Number(offerExpiresAt._seconds) * 1000;
    } else {
      ms = new Date(offerExpiresAt).getTime();
    }
    if (!Number.isFinite(ms)) return false;
    return Date.now() > ms;
  } catch {
    return false;
  }
}
