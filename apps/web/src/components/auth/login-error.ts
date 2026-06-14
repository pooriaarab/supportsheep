/** Map a Better Auth sign-in error to a user-facing message. */
export function magicLinkErrorMessage(
  error: { code?: string; status?: number } | null | undefined,
): string {
  if (
    error?.code === "THIS_EMAIL_DOMAIN_IS_NOT_PERMITTED_TO_SIGN_IN" ||
    error?.status === 403
  ) {
    return "This email isn't permitted to sign in.";
  }
  return "Couldn't send the magic link. Please try again.";
}
