import "server-only";
import type { EmailMessage } from "./index";

/**
 * Inline styles only, and a table-based frame — mail clients strip stylesheets
 * and most ignore flexbox. `dir="rtl"` is set on the body so Persian text is
 * laid out correctly even in clients that default to LTR.
 */
function frame(bodyHtml: string) {
  return `<!doctype html>
<html lang="fa" dir="rtl">
  <body style="margin:0;padding:24px;background:#f6f7f9;font-family:Tahoma,Arial,sans-serif;">
    <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e6e8ec;border-radius:12px;">
      <tr>
        <td style="padding:24px 28px;border-bottom:1px solid #e6e8ec;">
          <div style="font-size:15px;font-weight:bold;color:#1c1f2b;">سامانه پرداخت ارزی</div>
          <div style="font-size:12px;color:#6b7280;margin-top:4px;">سازمان منطقه آزاد</div>
        </td>
      </tr>
      <tr><td style="padding:28px;">${bodyHtml}</td></tr>
      <tr>
        <td style="padding:16px 28px;border-top:1px solid #e6e8ec;font-size:11px;color:#9ca3af;line-height:1.9;">
          این پیام به‌صورت خودکار ارسال شده است؛ لطفاً به آن پاسخ ندهید.
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function otpEmail(code: string, ttlMinutes: number): Omit<EmailMessage, "to"> {
  return {
    subject: `کد ورود شما: ${code}`,
    text: [
      "کد ورود شما به سامانه پرداخت ارزی:",
      "",
      code,
      "",
      `این کد تا ${ttlMinutes} دقیقه معتبر است.`,
      "اگر شما درخواست ورود نداده‌اید، این پیام را نادیده بگیرید.",
    ].join("\n"),
    html: frame(`
      <p style="margin:0 0 16px;font-size:14px;color:#1c1f2b;line-height:2;">
        کد ورود شما به سامانه:
      </p>
      <div style="margin:0 0 16px;padding:16px;background:#f3f4f6;border-radius:8px;text-align:center;
                  font-size:30px;font-weight:bold;letter-spacing:8px;color:#1c1f2b;direction:ltr;">
        ${code}
      </div>
      <p style="margin:0 0 8px;font-size:13px;color:#4b5563;line-height:2;">
        این کد تا ${ttlMinutes} دقیقه معتبر است.
      </p>
      <p style="margin:0;font-size:12px;color:#9ca3af;line-height:2;">
        اگر شما درخواست ورود نداده‌اید، این پیام را نادیده بگیرید و رمز حساب خود را تغییر ندهید.
      </p>
    `),
  };
}
