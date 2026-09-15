import { AdminLoginForm } from './login-form';
import { getRecaptchaSiteKey, RECAPTCHA_ADMIN } from '@/lib/recaptcha';
import '../admin.css';

/**
 * Admin login page.
 *
 * The site key is read on the server, so the form itself stays a dumb island
 * and the page loads Google's script only when both reCAPTCHA keys are filled
 * in Настройки.
 */
export const dynamic = 'force-dynamic';

export default function AdminLoginPage() {
  const siteKey = getRecaptchaSiteKey(RECAPTCHA_ADMIN);
  return (
    <>
      <AdminLoginForm siteKey={siteKey} />
      {siteKey === '' ? null : (
        <script
          async
          defer
          src={`https://www.google.com/recaptcha/api.js?render=${encodeURIComponent(siteKey)}`}
        />
      )}
    </>
  );
}
