const LOGGED_IN_COOKIE = "logged_in";

/**
 * Checks if the non-HttpOnly logged_in cookie indicator exists in the browser.
 */
export function hasLoggedInCookie(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split(";").some((item) => item.trim().startsWith(`${LOGGED_IN_COOKIE}=true`));
}

/**
 * Sets the non-HttpOnly logged_in cookie indicator.
 */
export function setLoggedInCookie(): void {
  if (typeof document === "undefined") return;
  // 7 days expiration matching refresh token timeout
  document.cookie = `${LOGGED_IN_COOKIE}=true; path=/; max-age=604800; SameSite=Lax`;
}

/**
 * Clears the non-HttpOnly logged_in cookie indicator.
 */
export function clearLoggedInCookie(): void {
  if (typeof document === "undefined") return;
  document.cookie = `${LOGGED_IN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}
