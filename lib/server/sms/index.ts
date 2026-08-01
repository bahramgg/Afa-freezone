import "server-only";
import { env } from "../env";

export type SmsMessage = {
  to: string;
  text: string;
  /** Provider-side template name, when the provider sends OTPs by template. */
  template?: string;
  /** Values substituted into the template, in provider order. */
  tokens?: string[];
};

export interface SmsProvider {
  readonly name: string;
  send(message: SmsMessage): Promise<void>;
}

/**
 * Development provider. Writes the message to the server log so the OTP flow is
 * exercisable end-to-end before an SMS panel is contracted. Refuses to run in
 * production, where a silently-dropped OTP would lock every user out.
 */
class ConsoleSmsProvider implements SmsProvider {
  readonly name = "console";
  async send(message: SmsMessage) {
    if (env().NODE_ENV === "production") {
      throw new Error(
        "SMS_PROVIDER=console is not usable in production — configure a real SMS panel.",
      );
    }
    console.info(`\n[sms:console] → ${message.to}\n${message.text}\n`);
  }
}

/**
 * Kavenegar, SMS.ir and MeliPayamak all expose an HTTP send endpoint with an
 * API key; each implementation differs only in URL and payload shape. They are
 * wired the moment SMS_PROVIDER and SMS_API_KEY are set.
 */
class KavenegarProvider implements SmsProvider {
  readonly name = "kavenegar";
  constructor(private readonly apiKey: string, private readonly sender?: string) {}

  async send(message: SmsMessage) {
    const template = message.template ?? env().SMS_TEMPLATE;
    const url = template
      ? `https://api.kavenegar.com/v1/${this.apiKey}/verify/lookup.json?receptor=${encodeURIComponent(
          message.to,
        )}&token=${encodeURIComponent(message.tokens?.[0] ?? "")}&template=${encodeURIComponent(template)}`
      : `https://api.kavenegar.com/v1/${this.apiKey}/sms/send.json?receptor=${encodeURIComponent(
          message.to,
        )}&message=${encodeURIComponent(message.text)}${
          this.sender ? `&sender=${encodeURIComponent(this.sender)}` : ""
        }`;

    const res = await fetch(url, { method: "POST" });
    if (!res.ok) throw new Error(`kavenegar send failed: ${res.status} ${await res.text()}`);
  }
}

class SmsIrProvider implements SmsProvider {
  readonly name = "smsir";
  constructor(private readonly apiKey: string, private readonly sender?: string) {}

  async send(message: SmsMessage) {
    const res = await fetch("https://api.sms.ir/v1/send/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": this.apiKey },
      body: JSON.stringify({
        lineNumber: this.sender,
        messageText: message.text,
        mobiles: [message.to],
      }),
    });
    if (!res.ok) throw new Error(`sms.ir send failed: ${res.status} ${await res.text()}`);
  }
}

class MeliPayamakProvider implements SmsProvider {
  readonly name = "melipayamak";
  constructor(private readonly apiKey: string, private readonly sender?: string) {}

  async send(message: SmsMessage) {
    const res = await fetch(`https://console.melipayamak.com/api/send/simple/${this.apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ from: this.sender, to: message.to, text: message.text }),
    });
    if (!res.ok) throw new Error(`melipayamak send failed: ${res.status} ${await res.text()}`);
  }
}

let cached: SmsProvider | null = null;

export function smsProvider(): SmsProvider {
  if (cached) return cached;
  const { SMS_PROVIDER, SMS_API_KEY, SMS_SENDER } = env();

  if (SMS_PROVIDER === "console") {
    cached = new ConsoleSmsProvider();
    return cached;
  }
  if (!SMS_API_KEY) {
    throw new Error(`SMS_PROVIDER=${SMS_PROVIDER} requires SMS_API_KEY to be set.`);
  }

  cached =
    SMS_PROVIDER === "kavenegar"
      ? new KavenegarProvider(SMS_API_KEY, SMS_SENDER)
      : SMS_PROVIDER === "smsir"
        ? new SmsIrProvider(SMS_API_KEY, SMS_SENDER)
        : new MeliPayamakProvider(SMS_API_KEY, SMS_SENDER);

  return cached;
}
