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

export interface LinkedEmail {
  to: string;
  studentName: string;
  trainerName: string;
}

export async function sendStudentLinkedEmail({ to, studentName, trainerName }: LinkedEmail): Promise<void> {
  const url = `${baseUrl}/student`;
  const subject = `${trainerName} added you as their student on Praxis`;
  const text =
    `Hi ${studentName},\n\n` +
    `${trainerName} added you as their student on Praxis. Studies they assign to ` +
    `you will appear on your dashboard:\n  ${url}\n`;
  if (!client) {
    console.log(`[email/dev] would send to ${to}: ${subject}\n  ${url}`);
    return;
  }
  await client.emails.send({ from: fromAddr, to, subject, text });
}

export interface AssignmentEmail {
  to: string;
  studentName: string;
  trainerName: string;
  studyName: string;
  studyKind: 'opening' | 'game' | 'tactic';
  studyId: number;
}

export async function sendAssignmentEmail({
  to,
  studentName,
  trainerName,
  studyName,
  studyKind,
  studyId,
}: AssignmentEmail): Promise<void> {
  const url = `${baseUrl}/student/studies/${studyKind}/${studyId}`;
  const subject = `${trainerName} assigned you a new study: ${studyName}`;
  const text =
    `Hi ${studentName},\n\n` +
    `${trainerName} has assigned a new ${studyKind} study to you on Praxis:\n  ${studyName}\n\n` +
    `Open it here: ${url}\n`;

  if (!client) {
    console.log(`[email/dev] would send to ${to}: ${subject}\n  ${url}`);
    return;
  }
  await client.emails.send({ from: fromAddr, to, subject, text });
}

export { baseUrl };
