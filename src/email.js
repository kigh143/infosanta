// Sends the drawer their result by email through EmailJS (https://www.emailjs.com).
// Neither the email address nor the match is saved anywhere by this app.
//
// The EmailJS template can use: {{to_email}}, {{giver_name}}, {{match_name}}, {{exchange_date}}.
// Set the template's "To Email" field to {{to_email}}.
import emailjs from "@emailjs/browser";

const SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID;
const TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
const PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

export const emailConfigured = !!(SERVICE_ID && TEMPLATE_ID && PUBLIC_KEY);

export const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || "").trim());

export function sendResult({ to, giver, match }) {
  if (!emailConfigured) return Promise.reject(new Error("not-configured"));
  return emailjs.send(
    SERVICE_ID,
    TEMPLATE_ID,
    {
      to_email: to.trim(),
      giver_name: giver,
      match_name: match,
      exchange_date: "Thursday 17 December",
    },
    { publicKey: PUBLIC_KEY }
  );
}
