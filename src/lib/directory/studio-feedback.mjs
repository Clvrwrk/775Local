/** @param {string} code */
export function studioFeedback(code) {
  switch (code) {
    case "listing_changed_since_proposal":
      return "This listing changed. Reload Studio to review the latest details before submitting again.";
    case "authentication_required":
    case "reauth_required":
      return "Sign in again to refresh your session, then reopen Studio.";
    case "authorization_forbidden":
    case "listing_access_forbidden":
    case "review_forbidden":
      return "Your account does not have the required listing permission. Contact Local775 to review your access.";
    case "invalid_listing_proposal":
    case "invalid_studio_command":
      return "Check the business name, description, US phone number and HTTPS website.";
    case "idempotency_conflict":
      return "This request conflicts with an earlier submission. Reload Studio and review its status before making another change.";
    case "outside_pilot":
      return "Studio is available for Reno pilot listings only.";
    default:
      return "Changes could not be confirmed. Retry safely; the same submission will not be duplicated.";
  }
}
