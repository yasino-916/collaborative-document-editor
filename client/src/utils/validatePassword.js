/**
 * Validates password strength.
 * Returns an error string if validation fails, or null if valid.
 */
export const validatePassword = (password) => {
  if (!password || password.length < 8)
    return 'Password must be at least 8 characters long.';
  if (!/[A-Z]/.test(password))
    return 'Password must include at least one uppercase letter.';
  if (!/[a-z]/.test(password))
    return 'Password must include at least one lowercase letter.';
  if (!/[0-9]/.test(password))
    return 'Password must include at least one number.';
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password))
    return 'Password must include at least one special character (!@#$%^&*).';
  return null;
};
