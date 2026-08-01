import "server-only";
import { env } from "../env";

export type EmailMessage = {
  to: string;
  subject: string;
  /** Always provided; clients that refuse HTML still get a readable message. */
  text: string;
  html?: string;
};

export interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<void>;
}

/**
 * Development provider. Writes the message to the server log so the OTP flow is
 * exercisable before a mail service is configured. Refuses to run in
 * production, where a silently-dropped code would lock every user out.
 */
class ConsoleEmailProvider implements EmailProvider {
  readonly name = "console";
  async send(message: EmailMessage) {
    if (env().NODE_ENV === "production") {
      throw new Error(
        "EMAIL_PROVIDER=console is not usable in production — configure smtp or resend.",
      );
    }
    console.info(`\n[email:console] → ${message.to}\n${message.subject}\n${message.text}\n`);
  }
}

/** Standard SMTP — works with any mail server the organisation already runs. */
class SmtpEmailProvider implements EmailProvider {
  readonly name = "smtp";
  // Imported lazily so the dependency is not pulled in when it is not used.
  private transport: import("nodemailer").Transporter | null = null;

  private async getTransport() {
    if (this.transport) return this.transport;
    const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASSWORD } = env();
    if (!SMTP_HOST) throw new Error("EMAIL_PROVIDER=smtp requires SMTP_HOST.");

    const nodemailer = await import("nodemailer");
    this.transport = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT ?? (SMTP_SECURE ? 465 : 587),
      secure: SMTP_SECURE,
      auth: SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASSWORD } : undefined,
    });
    return this.transport;
  }

  async send(message: EmailMessage) {
    const transport = await this.getTransport();
    await transport.sendMail({
      from: env().EMAIL_FROM,
      to: message.to,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });
  }
}

/** Resend's HTTP API, for deployments without an SMTP relay. */
class ResendEmailProvider implements EmailProvider {
  readonly name = "resend";
  constructor(private readonly apiKey: string) {}

  async send(message: EmailMessage) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        from: env().EMAIL_FROM,
        to: [message.to],
        subject: message.subject,
        text: message.text,
        html: message.html,
      }),
    });
    if (!response.ok) {
      throw new Error(`resend send failed: ${response.status} ${await response.text()}`);
    }
  }
}

let cached: EmailProvider | null = null;

export function emailProvider(): EmailProvider {
  if (cached) return cached;
  const { EMAIL_PROVIDER, RESEND_API_KEY } = env();

  if (EMAIL_PROVIDER === "smtp") {
    cached = new SmtpEmailProvider();
  } else if (EMAIL_PROVIDER === "resend") {
    if (!RESEND_API_KEY) throw new Error("EMAIL_PROVIDER=resend requires RESEND_API_KEY.");
    cached = new ResendEmailProvider(RESEND_API_KEY);
  } else {
    cached = new ConsoleEmailProvider();
  }
  return cached;
}
