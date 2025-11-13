import { Resend } from "resend";

let cachedResend: Resend | null = null;

export function getResendClient() {
  if (cachedResend) {
    return cachedResend;
  }
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return null;
  }
  cachedResend = new Resend(apiKey);
  return cachedResend;
}
