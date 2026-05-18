import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const fromAddr = process.env.EMAIL_FROM ?? 'Praxis <invites@example.invalid>';
const baseUrl = process.env.APP_BASE_URL ?? 'http://localhost:5173';

const client = apiKey ? new Resend(apiKey) : null;

export interface InviteEmail {
  to: string;
  trainerName: string;
  studentName: string;
  token: string;
}

export async function sendInviteEmail({ to, trainerName, studentName, token }: InviteEmail): Promise<void> {
  const url = `${baseUrl}/invite/${token}`;
  const subject = `${trainerName} invited you to Praxis`;
  const text =
    `Hi ${studentName},\n\n` +
    `${trainerName} has invited you to study chess with them on Praxis.\n\n` +
    `Accept your invite: ${url}\n\n` +
    `This link is valid for 14 days.`;

  if (!client) {
    console.log(`[email/dev] would send to ${to}: ${subject}\n  ${url}`);
    return;
  }
  await client.emails.send({ from: fromAddr, to, subject, text });
}

export { baseUrl };
