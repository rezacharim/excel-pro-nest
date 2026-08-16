import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

const BRAND_RED = '#E43125';
const BRAND_NAVY = '#020022';
const ACADEMY_NAME = 'Excel Pro Soccer Academy';
const ACADEMY_PHONE = '+1 647-703-7821';
const ACADEMY_EMAIL = 'excelprosocceracademy@gmail.com';
const ETRANSFER_EMAIL = 'Excelpro.Etransfer@gmail.com';

/**
 * Membership pricing, in one place. These three numbers appear in several
 * emails; keeping them here means a price change is a one-line edit and the
 * welcome email can never drift out of step with the renewal reminder again.
 *
 * A first-time family pays the 2-month fee PLUS the one-time uniform. A family
 * that is renewing already owns a uniform, so they pay the 2-month fee only.
 */
const FEE_TWO_MONTHS = 380;
const FEE_UNIFORM = 75;
const FEE_FIRST_TIME = FEE_TWO_MONTHS + FEE_UNIFORM; // 455

export interface AdminDigestRow {
  fullname: string;
  parent_name?: string;
  email?: string;
  phone_number?: string;
  activePlan?: string;
  currentSubscriptionEndDate?: Date | null;
  daysRemaining?: number | null;
}

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter | null = null;
  private readonly from: string;
  private readonly adminEmails: string[];

  constructor() {
    const host = process.env.SMTP_HOST;
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;
    const port = parseInt(process.env.SMTP_PORT || '587', 10);
    const secure = process.env.SMTP_SECURE === 'true';

    this.from =
      process.env.MAIL_FROM ||
      `${ACADEMY_NAME} <${ACADEMY_EMAIL}>`;

    this.adminEmails = (process.env.ADMIN_EMAILS || '')
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    if (!host || !user || !pass) {
      this.logger.warn(
        'SMTP configuration missing (SMTP_HOST/SMTP_USER/SMTP_PASS). Email sending is disabled (no-op).',
      );
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
      });
    } catch (error) {
      this.logger.error(
        `Failed to create SMTP transporter: ${error.message}. Email sending is disabled.`,
      );
      this.transporter = null;
    }
  }

  get isEnabled(): boolean {
    return this.transporter !== null;
  }

  /**
   * Low-level send. Never throws — logs and swallows all errors so email
   * failures can never break a request or a cron run.
   */
  private async send(
    to: string | string[],
    subject: string,
    html: string,
  ): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(
        `Email not sent (SMTP disabled): "${subject}" to ${Array.isArray(to) ? to.join(', ') : to}`,
      );
      return false;
    }

    const recipients = Array.isArray(to) ? to.filter(Boolean) : [to];
    if (recipients.length === 0 || !recipients[0]) {
      this.logger.warn(`Email not sent (no recipient): "${subject}"`);
      return false;
    }

    try {
      await this.transporter.sendMail({
        from: this.from,
        to: recipients.join(', '),
        subject,
        html,
      });
      this.logger.log(`Email sent: "${subject}" to ${recipients.join(', ')}`);
      return true;
    } catch (error) {
      this.logger.error(
        `Failed to send email "${subject}" to ${recipients.join(', ')}: ${error.message}`,
      );
      return false;
    }
  }

  private formatDate(date: Date | string | null | undefined): string {
    if (!date) return 'N/A';
    const d = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(d.getTime())) return 'N/A';
    return d.toLocaleDateString('en-CA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  }

  /** Shared branded HTML layout. */
  private layout(title: string, bodyHtml: string): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f7;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:24px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:8px;overflow:hidden;border:1px solid #e5e5ea;">
          <tr>
            <td style="background-color:${BRAND_NAVY};padding:24px 32px;text-align:center;">
              <div style="font-size:22px;font-weight:bold;color:#ffffff;letter-spacing:0.5px;">
                Excel <span style="color:${BRAND_RED};">Pro</span> Soccer Academy
              </div>
              <div style="height:4px;width:64px;background-color:${BRAND_RED};margin:12px auto 0;border-radius:2px;"></div>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;color:#333333;font-size:15px;line-height:1.6;">
              ${bodyHtml}
            </td>
          </tr>
          <tr>
            <td style="background-color:${BRAND_NAVY};padding:20px 32px;text-align:center;color:#9a9ab0;font-size:12px;line-height:1.8;">
              <div style="color:#ffffff;font-weight:bold;font-size:13px;">${ACADEMY_NAME}</div>
              <div>Toronto / Markham, Ontario, Canada</div>
              <div>
                Phone: <a href="tel:+16477037821" style="color:${BRAND_RED};text-decoration:none;">${ACADEMY_PHONE}</a>
                &nbsp;|&nbsp;
                Email: <a href="mailto:${ACADEMY_EMAIL}" style="color:${BRAND_RED};text-decoration:none;">${ACADEMY_EMAIL}</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  }

  private heading(text: string): string {
    return `<h1 style="margin:0 0 16px;font-size:20px;color:${BRAND_NAVY};">${text}</h1>`;
  }

  /**
   * The e-transfer "how to pay" box.
   *
   * @param mode 'joining'  - brand-new family: 2 months + the one-time uniform
   *             'renewal'  - family that already owns a uniform: 2 months only
   *             { amount } - an exact figure the caller already knows (league
   *                          installments, for example). Never fall back to the
   *                          membership price in that case: the box sits
   *                          directly under the real amount and a mismatch
   *                          tells the parent to send the wrong money.
   */
  private etransferInstructions(
    mode: 'joining' | 'renewal' | { amount: number; forWhat: string } = 'renewal',
  ): string {
    const exact = typeof mode === 'object' ? mode : null;
    const amount = exact
      ? Number(exact.amount).toFixed(2)
      : String(mode === 'joining' ? FEE_FIRST_TIME : FEE_TWO_MONTHS);
    const forWhat = exact
      ? exact.forWhat
      : mode === 'joining'
        ? `for your first 2 months of membership <strong>plus the one-time $${FEE_UNIFORM} uniform</strong>`
        : 'for 2 months of membership';
    const breakdown =
      mode === 'joining'
        ? `<br />
            <span style="display:inline-block;margin-top:10px;color:#555555;font-size:13px;line-height:1.7;">
              $${FEE_TWO_MONTHS} &mdash; first 2 months of membership<br />
              $${FEE_UNIFORM} &mdash; full uniform, one time only. Yours to keep; we hand it to you at the first practice.<br />
              <strong style="color:${BRAND_NAVY};">$${FEE_FIRST_TIME} CAD total</strong>
            </span>`
        : '';
    return `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background-color:#fdf1f0;border-left:4px solid ${BRAND_RED};border-radius:4px;">
        <tr>
          <td style="padding:16px 20px;font-size:14px;color:#333333;line-height:1.7;">
            <strong style="color:${BRAND_NAVY};">How to pay by Interac e-Transfer:</strong><br />
            1. Send your e-Transfer to <a href="mailto:${ETRANSFER_EMAIL}" style="color:${BRAND_RED};font-weight:bold;text-decoration:none;">${ETRANSFER_EMAIL}</a><br />
            2. Include your player's <strong>full name</strong> in the transfer message<br />
            3. Amount: <strong>$${amount} CAD</strong> ${forWhat}${breakdown}
          </td>
        </tr>
      </table>`;
  }

  async sendVerificationCode(email: string, code: string): Promise<boolean> {
    try {
      const body = `
        ${this.heading('Verify your email address')}
        <p>Use the verification code below to continue your registration with <strong>${ACADEMY_NAME}</strong>.</p>
        <div style="text-align:center;margin:28px 0;">
          <div style="display:inline-block;background-color:#fdf1f0;border:2px dashed ${BRAND_RED};border-radius:8px;padding:18px 36px;">
            <span style="font-size:34px;font-weight:bold;letter-spacing:10px;color:${BRAND_RED};font-family:Arial,Helvetica,sans-serif;">${code}</span>
          </div>
        </div>
        <p style="text-align:center;color:#555555;">This code <strong>expires in 10 minutes</strong>.</p>
        <p>For your security, do not share this code with anyone. ${ACADEMY_NAME} staff will never ask you for it.</p>
        <p>If you did not request this code, you can safely ignore this email.</p>`;
      return await this.send(
        email,
        'Your Excel Pro verification code',
        this.layout('Your Excel Pro verification code', body),
      );
    } catch (error) {
      this.logger.error(`sendVerificationCode failed: ${error.message}`);
      return false;
    }
  }

  async sendPaymentReminder(
    to: string,
    playerName: string,
    dueDate: Date,
  ): Promise<boolean> {
    try {
      const body = `
        ${this.heading('Membership Renewal Reminder')}
        <p>Dear parent/guardian of <strong>${playerName}</strong>,</p>
        <p>This is a friendly reminder that the membership renewal for <strong>${playerName}</strong> is due in <strong style="color:${BRAND_RED};">2 days</strong>, on <strong>${this.formatDate(dueDate)}</strong>.</p>
        <p>To keep your player on the field without interruption, please renew before the due date.</p>
        ${this.etransferInstructions()}
        <p>If you have already sent your payment, please disregard this message. Thank you for being part of the Excel Pro family!</p>`;
      return await this.send(
        to,
        `Membership renewal due in 2 days - ${playerName}`,
        this.layout('Membership Renewal Reminder', body),
      );
    } catch (error) {
      this.logger.error(`sendPaymentReminder failed: ${error.message}`);
      return false;
    }
  }

  async sendOverdueNotice(
    to: string,
    playerName: string,
    dueDate: Date,
  ): Promise<boolean> {
    try {
      const body = `
        ${this.heading('Membership Payment Overdue')}
        <p>Dear parent/guardian of <strong>${playerName}</strong>,</p>
        <p>Our records show that the membership for <strong>${playerName}</strong> expired on <strong style="color:${BRAND_RED};">${this.formatDate(dueDate)}</strong> and the renewal payment has not yet been received.</p>
        <p>Please renew as soon as possible so ${playerName} can continue training with the academy.</p>
        ${this.etransferInstructions()}
        <p>If you have already sent your payment, or if you would like to discuss your membership, please contact us — we are happy to help.</p>`;
      return await this.send(
        to,
        `Membership payment overdue - ${playerName}`,
        this.layout('Membership Payment Overdue', body),
      );
    } catch (error) {
      this.logger.error(`sendOverdueNotice failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Invitation to an existing family to start using the website.
   *
   * Written for parents who have been with the academy for years and have
   * never seen an online account: it explains what they get, and that there
   * is no password to remember.
   */
  async sendParentInvitation(
    to: string,
    playerName: string,
    parentName: string | null,
    renewalDate: Date | null,
  ): Promise<boolean> {
    try {
      const greeting = parentName ? `Hi ${parentName},` : 'Hi,';
      const renewalLine = renewalDate
        ? `<p>Right now our records show <strong>${playerName}</strong>'s membership running to <strong>${this.formatDate(renewalDate)}</strong>. If that does not look right, just reply to this email and we will fix it.</p>`
        : `<p>Once you sign in you will see <strong>${playerName}</strong>'s membership details. If anything looks wrong, reply to this email and we will fix it.</p>`;

      const body = `
        ${this.heading('Your Excel Pro account is ready')}
        <p>${greeting}</p>
        <p>We have moved Excel Pro Soccer Academy onto a proper online system, and your family already has an account waiting — nothing to set up.</p>
        <p>With it you can:</p>
        <ul style="padding-left:20px;color:#333333;line-height:1.9;">
          <li>See when ${playerName}'s membership renews</li>
          <li>Renew and pay by e-transfer in a couple of taps</li>
          <li>Download receipts and a yearly statement for your records</li>
          <li>Ask us to pause the membership for a holiday</li>
          <li>Add another child without filling in your details again</li>
        </ul>
        ${renewalLine}
        <div style="text-align:center;margin:28px 0;">
          <a href="https://www.excelproso.com/account" style="display:inline-block;background-color:${BRAND_RED};color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 32px;border-radius:6px;font-size:16px;">Open my account</a>
        </div>
        <p style="color:#555555;font-size:14px;text-align:center;">
          There is <strong>no password</strong>. Enter this email address and we send you a 6-digit code to sign in.
        </p>
        <p>If you have any trouble at all, just reply to this email — we are happy to walk you through it.</p>`;
      return await this.send(
        to,
        `Your Excel Pro account is ready - ${playerName}`,
        this.layout('Your Account Is Ready', body),
      );
    } catch (error) {
      this.logger.error(`sendParentInvitation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Sent the moment a parent starts an e-transfer payment, so the details are
   * in their inbox while they are in their banking app. This replaces the old
   * SMS with the same information.
   */
  async sendPaymentInstructions(
    to: string,
    playerName: string,
    amount: number,
    isFirstTime: boolean,
  ): Promise<boolean> {
    try {
      const breakdown = isFirstTime
        ? `<p style="color:#555555;font-size:14px;">This is $${FEE_TWO_MONTHS} for the first 2 months plus the one-time $${FEE_UNIFORM} uniform fee. The uniform is yours to keep and we hand it to you at the first practice.</p>`
        : '';
      const body = `
        ${this.heading('How to send your payment')}
        <p>Dear parent/guardian of <strong>${playerName}</strong>,</p>
        <p>Here are the details for your Interac e-Transfer:</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background-color:#fdf1f0;border-left:4px solid ${BRAND_RED};border-radius:4px;">
          <tr>
            <td style="padding:16px 20px;font-size:15px;color:#333333;line-height:1.9;">
              <strong style="color:${BRAND_NAVY};">Send to:</strong>
              <a href="mailto:${ETRANSFER_EMAIL}" style="color:${BRAND_RED};font-weight:bold;text-decoration:none;">${ETRANSFER_EMAIL}</a><br />
              <strong style="color:${BRAND_NAVY};">Amount:</strong> $${amount.toFixed(2)} CAD<br />
              <strong style="color:${BRAND_NAVY};">Message:</strong> ${playerName}
            </td>
          </tr>
        </table>
        ${breakdown}
        <p>Please put <strong>${playerName}</strong>'s name in the e-transfer message so we can match your payment to the right player.</p>
        <p>Once you have sent it, return to the website and press <strong>"I have sent the e-transfer"</strong>. We usually confirm within 1&ndash;2 business days.</p>`;
      return await this.send(
        to,
        `Payment details for ${playerName} - $${amount.toFixed(2)} CAD`,
        this.layout('Payment Instructions', body),
      );
    } catch (error) {
      this.logger.error(`sendPaymentInstructions failed: ${error.message}`);
      return false;
    }
  }

  /** Sent when an admin could not verify a payment. */
  async sendPaymentRejected(
    to: string,
    playerName: string,
    amount: number,
    reason: string,
  ): Promise<boolean> {
    try {
      const body = `
        ${this.heading('We could not confirm your payment')}
        <p>Dear parent/guardian of <strong>${playerName}</strong>,</p>
        <p>We were not able to verify the payment of <strong>$${amount.toFixed(2)} CAD</strong> for ${playerName}.</p>
        <p style="background-color:#fdf1f0;border-left:4px solid ${BRAND_RED};padding:12px 16px;border-radius:4px;"><strong>Reason:</strong> ${reason}</p>
        <p>This is usually just a mix-up — a missing name in the transfer message, or a transfer that has not landed yet. Please reply to this email and we will sort it out with you.</p>`;
      return await this.send(
        to,
        `Payment could not be confirmed - ${playerName}`,
        this.layout('Payment Not Confirmed', body),
      );
    } catch (error) {
      this.logger.error(`sendPaymentRejected failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Told to a parent when the academy suspends the player's spot.
   *
   * The wording deliberately stays neutral and points them at a conversation
   * rather than spelling out internal details — the private note the admin
   * wrote is never included.
   */
  async sendSuspensionNotice(
    to: string,
    playerName: string,
    reason: string,
  ): Promise<boolean> {
    try {
      const reasonLine =
        reason === 'late_payment'
          ? 'an outstanding membership payment'
          : reason === 'paperwork'
            ? 'missing registration paperwork'
            : reason === 'medical'
              ? 'a medical clearance we still need'
              : reason === 'discipline'
                ? 'a team conduct matter we would like to discuss with you'
                : 'an account matter we would like to discuss with you';

      const payBlock =
        reason === 'late_payment' ? this.etransferInstructions() : '';

      const body = `
        ${this.heading('Membership temporarily suspended')}
        <p>Dear parent/guardian of <strong>${playerName}</strong>,</p>
        <p>We are writing to let you know that ${playerName}'s membership has been <strong style="color:${BRAND_RED};">temporarily suspended</strong> due to ${reasonLine}.</p>
        <p>A suspension is not a cancellation — your player's place and record with us are kept, and the account is reactivated as soon as the matter is resolved.</p>
        ${payBlock}
        <p>Please reply to this email or call us so we can sort this out quickly and get ${playerName} back on the field.</p>`;
      return await this.send(
        to,
        `Membership suspended - ${playerName}`,
        this.layout('Membership Suspended', body),
      );
    } catch (error) {
      this.logger.error(`sendSuspensionNotice failed: ${error.message}`);
      return false;
    }
  }

  /** Good news email: the suspension has been lifted. */
  async sendSuspensionLifted(
    to: string,
    playerName: string,
  ): Promise<boolean> {
    try {
      const body = `
        ${this.heading('Welcome back!')}
        <p>Dear parent/guardian of <strong>${playerName}</strong>,</p>
        <p>Good news — the suspension on ${playerName}'s membership has been lifted and the account is <strong style="color:#0a7a2f;">active again</strong>.</p>
        <p>We look forward to seeing ${playerName} at the next session. Thank you for sorting this out with us.</p>`;
      return await this.send(
        to,
        `Membership reactivated - ${playerName}`,
        this.layout('Membership Reactivated', body),
      );
    } catch (error) {
      this.logger.error(`sendSuspensionLifted failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Chasing email sent from the Collections screen. Unlike sendOverdueNotice
   * (fired by the cron with fixed wording), this one states the exact amount
   * owed and the e-transfer address configured in Settings, because an admin
   * is following up on a specific unpaid balance.
   */
  async sendCollectionsReminder(
    to: string,
    playerName: string,
    endDate: Date | null,
    amountDue: number,
    daysOverdue: number,
    etransferEmail: string,
  ): Promise<boolean> {
    try {
      const target = etransferEmail || ETRANSFER_EMAIL;
      const amountText = `$${Number(amountDue).toFixed(2)} CAD`;
      const overdueLine =
        daysOverdue > 0
          ? `<p>The membership for <strong>${playerName}</strong> expired on <strong style="color:${BRAND_RED};">${this.formatDate(endDate)}</strong> — that is <strong style="color:${BRAND_RED};">${daysOverdue} day${daysOverdue === 1 ? '' : 's'}</strong> ago — and we have not yet received the renewal payment.</p>`
          : `<p>We have not yet received the outstanding membership payment for <strong>${playerName}</strong>.</p>`;

      const body = `
        ${this.heading('Outstanding Membership Payment')}
        <p>Dear parent/guardian of <strong>${playerName}</strong>,</p>
        ${overdueLine}
        <p>Amount outstanding: <strong style="color:${BRAND_RED};">${amountText}</strong></p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background-color:#fdf1f0;border-left:4px solid ${BRAND_RED};border-radius:4px;">
          <tr>
            <td style="padding:16px 20px;font-size:14px;color:#333333;line-height:1.7;">
              <strong style="color:${BRAND_NAVY};">How to pay by Interac e-Transfer:</strong><br />
              1. Send your e-Transfer to <a href="mailto:${target}" style="color:${BRAND_RED};font-weight:bold;text-decoration:none;">${target}</a><br />
              2. Include your player's <strong>full name</strong> (${playerName}) in the transfer message<br />
              3. Amount: <strong>${amountText}</strong>
            </td>
          </tr>
        </table>
        <p>Please settle the balance as soon as possible so ${playerName} can keep training without interruption.</p>
        <p>If you have already sent your payment, or if you would like to arrange an installment plan, please contact us — we are happy to help.</p>`;

      return await this.send(
        to,
        `Outstanding membership payment - ${playerName}`,
        this.layout('Outstanding Membership Payment', body),
      );
    } catch (error) {
      this.logger.error(`sendCollectionsReminder failed: ${error.message}`);
      return false;
    }
  }

  async sendPaymentReceived(
    to: string,
    playerName: string,
    amount: number,
    newEndDate: Date | null,
    options?: { type?: string; periodLabel?: string | null },
  ): Promise<boolean> {
    try {
      const type = options?.type ?? 'membership';
      const periodLabel = options?.periodLabel ?? null;

      const isLeague = type === 'league';
      const paymentLine = isLeague
        ? `<p>We have received your payment of <strong style="color:${BRAND_RED};">$${Number(amount).toFixed(2)} CAD</strong> for the <strong>league fee</strong>${periodLabel ? ` (<strong>${periodLabel}</strong>)` : ''}. Thank you!</p>`
        : `<p>We have received your payment of <strong style="color:${BRAND_RED};">$${Number(amount).toFixed(2)} CAD</strong>${periodLabel ? ` for <strong>${periodLabel}</strong>` : ''}. Thank you!</p>`;
      const statusLine = isLeague
        ? `<p>This payment covers the league fee for <strong>${playerName}</strong>${periodLabel ? ` (${periodLabel})` : ''}. It does not change the regular membership period.</p>`
        : `<p>The membership for <strong>${playerName}</strong> is now active until <strong>${this.formatDate(newEndDate)}</strong>.</p>`;

      const body = `
        ${this.heading('Payment Received - Thank You!')}
        <p>Dear parent/guardian of <strong>${playerName}</strong>,</p>
        ${paymentLine}
        ${statusLine}
        <p>We look forward to seeing ${playerName} on the field. Thank you for choosing ${ACADEMY_NAME}!</p>`;
      return await this.send(
        to,
        `Payment received - ${playerName}`,
        this.layout('Payment Received', body),
      );
    } catch (error) {
      this.logger.error(`sendPaymentReceived failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Notify the academy admins that a parent submitted a request from the
   * parent portal (membership hold or installment plan).
   */
  async sendAdminRequestNotice(
    kind: 'hold' | 'installment' | string,
    playerName: string,
    details: Record<string, string | null | undefined>,
  ): Promise<boolean> {
    try {
      if (this.adminEmails.length === 0) {
        this.logger.warn('sendAdminRequestNotice skipped: ADMIN_EMAILS not set');
        return false;
      }

      const label =
        kind === 'hold'
          ? 'Membership Hold Request'
          : kind === 'installment'
            ? 'Installment Plan Request'
            : kind === 'renewal payment started'
              ? 'Renewal Payment Started'
              : `${kind.charAt(0).toUpperCase()}${kind.slice(1)}`;

      const rows = Object.entries(details)
        .map(
          ([key, value]) => `
            <tr>
              <td style="padding:8px 12px;border:1px solid #e5e5ea;font-weight:bold;color:${BRAND_NAVY};white-space:nowrap;">${key}</td>
              <td style="padding:8px 12px;border:1px solid #e5e5ea;">${value ?? '-'}</td>
            </tr>`,
        )
        .join('');

      const body = `
        ${this.heading(`New ${label}`)}
        <p>A parent has submitted a <strong style="color:${BRAND_RED};">${label.toLowerCase()}</strong> for <strong>${playerName}</strong> through the parent portal.</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:14px;margin:16px 0;">
          <tr>
            <td style="padding:8px 12px;border:1px solid #e5e5ea;font-weight:bold;color:${BRAND_NAVY};white-space:nowrap;">Player</td>
            <td style="padding:8px 12px;border:1px solid #e5e5ea;">${playerName}</td>
          </tr>
          ${rows}
        </table>
        <p>Please review this request in the admin dashboard and follow up with the parent.</p>`;

      return await this.send(
        this.adminEmails,
        `Parent portal: ${label} - ${playerName}`,
        this.layout(label, body),
      );
    } catch (error) {
      this.logger.error(`sendAdminRequestNotice failed: ${error.message}`);
      return false;
    }
  }

  async sendWelcome(
    to: string,
    playerName: string,
    planName: string,
  ): Promise<boolean> {
    try {
      const body = `
        ${this.heading(`Welcome to ${ACADEMY_NAME}!`)}
        <p>Dear parent/guardian of <strong>${playerName}</strong>,</p>
        <p>Welcome to the Excel Pro family! We are thrilled to have <strong>${playerName}</strong> join us${planName ? ` in the <strong style="color:${BRAND_RED};">${planName}</strong> program` : ''}.</p>
        <p>Our coaching staff is committed to helping every player develop their skills, confidence, and love for the game.</p>
        ${this.etransferInstructions('joining')}
        <p>If you have any questions about schedules, equipment, or anything else, don't hesitate to reach out.</p>
        <p>See you on the field!</p>`;
      return await this.send(
        to,
        `Welcome to ${ACADEMY_NAME}, ${playerName}!`,
        this.layout('Welcome', body),
      );
    } catch (error) {
      this.logger.error(`sendWelcome failed: ${error.message}`);
      return false;
    }
  }

  async sendHoldConfirmation(
    to: string,
    playerName: string,
    resumeDate: Date | null,
  ): Promise<boolean> {
    try {
      const resumeText = resumeDate
        ? `The membership is scheduled to automatically resume on <strong>${this.formatDate(resumeDate)}</strong>. Any time spent on hold will be credited back to your membership period.`
        : `The membership is on hold indefinitely. When you are ready to return, contact us and we will resume the membership — any time spent on hold will be credited back to your membership period.`;
      const body = `
        ${this.heading('Membership On Hold')}
        <p>Dear parent/guardian of <strong>${playerName}</strong>,</p>
        <p>This confirms that the membership for <strong>${playerName}</strong> has been placed <strong style="color:${BRAND_RED};">on hold</strong>.</p>
        <p>${resumeText}</p>
        <p>If anything about this is unexpected, please contact us right away.</p>`;
      return await this.send(
        to,
        `Membership on hold - ${playerName}`,
        this.layout('Membership On Hold', body),
      );
    } catch (error) {
      this.logger.error(`sendHoldConfirmation failed: ${error.message}`);
      return false;
    }
  }

  async sendAdminDigest(
    dueSoonList: AdminDigestRow[],
    overdueList: AdminDigestRow[],
  ): Promise<boolean> {
    try {
      if (this.adminEmails.length === 0) {
        this.logger.warn('sendAdminDigest skipped: ADMIN_EMAILS not set');
        return false;
      }

      const renderTable = (rows: AdminDigestRow[]): string => {
        if (rows.length === 0) {
          return `<p style="color:#777;">None</p>`;
        }
        const trs = rows
          .map(
            (r) => `
            <tr>
              <td style="padding:8px;border:1px solid #e5e5ea;">${r.fullname || ''}</td>
              <td style="padding:8px;border:1px solid #e5e5ea;">${r.parent_name || ''}</td>
              <td style="padding:8px;border:1px solid #e5e5ea;">${r.phone_number || ''}</td>
              <td style="padding:8px;border:1px solid #e5e5ea;">${r.email || ''}</td>
              <td style="padding:8px;border:1px solid #e5e5ea;">${r.activePlan || ''}</td>
              <td style="padding:8px;border:1px solid #e5e5ea;">${this.formatDate(r.currentSubscriptionEndDate)}</td>
              <td style="padding:8px;border:1px solid #e5e5ea;text-align:center;">${r.daysRemaining ?? ''}</td>
            </tr>`,
          )
          .join('');
        return `
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;font-size:13px;margin:8px 0 20px;">
            <tr style="background-color:${BRAND_NAVY};color:#ffffff;">
              <th style="padding:8px;border:1px solid ${BRAND_NAVY};text-align:left;">Player</th>
              <th style="padding:8px;border:1px solid ${BRAND_NAVY};text-align:left;">Parent</th>
              <th style="padding:8px;border:1px solid ${BRAND_NAVY};text-align:left;">Phone</th>
              <th style="padding:8px;border:1px solid ${BRAND_NAVY};text-align:left;">Email</th>
              <th style="padding:8px;border:1px solid ${BRAND_NAVY};text-align:left;">Plan</th>
              <th style="padding:8px;border:1px solid ${BRAND_NAVY};text-align:left;">End Date</th>
              <th style="padding:8px;border:1px solid ${BRAND_NAVY};text-align:center;">Days Left</th>
            </tr>
            ${trs}
          </table>`;
      };

      const body = `
        ${this.heading('Daily Membership Digest')}
        <p>Summary of memberships needing attention as of ${this.formatDate(new Date())}:</p>
        <h2 style="font-size:16px;color:${BRAND_NAVY};margin:20px 0 4px;">Due within 3 days (${dueSoonList.length})</h2>
        ${renderTable(dueSoonList)}
        <h2 style="font-size:16px;color:${BRAND_RED};margin:20px 0 4px;">Overdue (${overdueList.length})</h2>
        ${renderTable(overdueList)}`;

      return await this.send(
        this.adminEmails,
        `Membership digest: ${dueSoonList.length} due soon, ${overdueList.length} overdue`,
        this.layout('Daily Membership Digest', body),
      );
    } catch (error) {
      this.logger.error(`sendAdminDigest failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Sent the moment a league registration is submitted.
   *
   * This email is the whole reason the academy can stop sending registration
   * links by hand: it carries the payment instructions, the exact amount and
   * the deadline, so a parent never has to ask what to do next.
   */
  async sendLeagueRegistrationReceived(
    to: string,
    playerName: string,
    details: {
      seasonName: string;
      ageGroup: string;
      waitlisted: boolean;
      feeTotal: number;
      firstAmount: number;
      firstDueDate: string | null;
      secondAmount: number;
      secondDueDate: string | null;
      isLate: boolean;
      payInFull: boolean;
    },
  ): Promise<boolean> {
    try {
      const money = (n: number) => `$${Number(n).toFixed(2)} CAD`;

      const scheduleRows = details.payInFull
        ? `<tr><td style="padding:6px 0;">Full payment</td><td style="padding:6px 0;text-align:right;"><strong>${money(details.firstAmount)}</strong> by ${this.formatDate(details.firstDueDate)}</td></tr>`
        : `<tr><td style="padding:6px 0;">1st payment</td><td style="padding:6px 0;text-align:right;"><strong>${money(details.firstAmount)}</strong> by ${this.formatDate(details.firstDueDate)}</td></tr>
           <tr><td style="padding:6px 0;">2nd payment</td><td style="padding:6px 0;text-align:right;"><strong>${money(details.secondAmount)}</strong> by ${this.formatDate(details.secondDueDate)}</td></tr>`;

      const waitlistNote = details.waitlisted
        ? `<p style="background-color:#fff8e6;border-left:4px solid #f59e0b;padding:12px 16px;border-radius:4px;"><strong>${details.ageGroup} is currently full.</strong> ${playerName} is on the waiting list. Please do not send payment yet &mdash; we will contact you as soon as a spot opens.</p>`
        : '';

      const lateNote = details.isLate
        ? `<p style="color:#555555;font-size:14px;">This registration was received after the deadline, so the late registration fee applies.</p>`
        : '';

      const payBlock = details.waitlisted
        ? ''
        : `
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background-color:#fdf1f0;border-left:4px solid ${BRAND_RED};border-radius:4px;">
          <tr>
            <td style="padding:16px 20px;font-size:15px;color:#333333;line-height:1.9;">
              <strong style="color:${BRAND_NAVY};">Send your e-Transfer to:</strong>
              <a href="mailto:${ETRANSFER_EMAIL}" style="color:${BRAND_RED};font-weight:bold;text-decoration:none;">${ETRANSFER_EMAIL}</a><br />
              <strong style="color:${BRAND_NAVY};">Amount now:</strong> ${money(details.firstAmount)}<br />
              <strong style="color:${BRAND_NAVY};">Message:</strong> ${playerName} &ndash; ${details.ageGroup}
            </td>
          </tr>
        </table>
        <p style="font-size:14px;color:#555555;">Please put the player's name and age group in the transfer message so we can match the payment to the right roster spot.</p>`;

      const body = `
        ${this.heading('Registration received')}
        <p>Dear parent/guardian of <strong>${playerName}</strong>,</p>
        <p>We have received the registration for <strong>${playerName}</strong> in <strong>${details.ageGroup}</strong> for the <strong>${details.seasonName}</strong>.</p>
        ${waitlistNote}
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;font-size:15px;color:#333333;">
          ${scheduleRows}
          <tr><td style="padding:10px 0 0;border-top:1px solid #e5e5e5;">Total</td><td style="padding:10px 0 0;border-top:1px solid #e5e5e5;text-align:right;"><strong>${money(details.feeTotal)}</strong></td></tr>
        </table>
        ${lateNote}
        ${payBlock}
        <p><strong>Your child's roster spot is confirmed once the first payment is received</strong> &mdash; not when this form is submitted. Spots in each age group are limited.</p>
        <div style="text-align:center;margin:28px 0;">
          <a href="https://www.excelproso.com/account" style="display:inline-block;background-color:${BRAND_RED};color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 32px;border-radius:6px;font-size:16px;">View my account</a>
        </div>
        <p>Thank you for your continued support of ${ACADEMY_NAME}.</p>`;

      return await this.send(
        to,
        `Registration received - ${playerName} (${details.ageGroup}, ${details.seasonName})`,
        this.layout('Registration received', body),
      );
    } catch (error) {
      this.logger.error(`sendLeagueRegistrationReceived failed: ${error.message}`);
      return false;
    }
  }

  /** Sent when a family books a trial from the website. */
  async sendTrialRequestReceived(
    to: string,
    playerName: string,
    ageGroup: string,
  ): Promise<boolean> {
    try {
      const body = `
        ${this.heading('Trial request received')}
        <p>Dear parent/guardian of <strong>${playerName}</strong>,</p>
        <p>Thank you for your interest in ${ACADEMY_NAME}. We have received the trial request for <strong>${playerName}</strong> (<strong>${ageGroup}</strong>).</p>
        <p>One of our coaches will contact you to confirm a date and time. Places at each session are limited so every player gets proper attention.</p>
        <p><strong>What to bring:</strong> cleats, shin guards and water.</p>
        <p>If anything changes, reply to this email or call us on <a href="tel:+16477037821" style="color:${BRAND_RED};text-decoration:none;">${ACADEMY_PHONE}</a>.</p>`;

      return await this.send(
        to,
        `Trial request received - ${playerName} (${ageGroup})`,
        this.layout('Trial request received', body),
      );
    } catch (error) {
      this.logger.error(`sendTrialRequestReceived failed: ${error.message}`);
      return false;
    }
  }

  /** Reminder that a league installment is due or overdue. */
  async sendLeagueInstallmentReminder(
    to: string,
    playerName: string,
    details: {
      installment: number;
      amount: number;
      dueDate: string | null;
      daysOverdue: number | null;
      seasonName: string;
    },
  ): Promise<boolean> {
    try {
      const overdue = (details.daysOverdue ?? 0) > 0;
      const lead = overdue
        ? `<p>Our records show the <strong>${details.installment === 1 ? 'first' : 'second'} league payment</strong> for <strong>${playerName}</strong> was due on <strong style="color:${BRAND_RED};">${this.formatDate(details.dueDate)}</strong> and has not yet been received.</p>`
        : `<p>This is a friendly reminder that the <strong>${details.installment === 1 ? 'first' : 'second'} league payment</strong> for <strong>${playerName}</strong> is due on <strong>${this.formatDate(details.dueDate)}</strong>.</p>`;

      const body = `
        ${this.heading(overdue ? 'League payment overdue' : 'League payment due')}
        <p>Dear parent/guardian of <strong>${playerName}</strong>,</p>
        ${lead}
        <p>Amount outstanding: <strong style="color:${BRAND_RED};">$${Number(details.amount).toFixed(2)} CAD</strong> (${details.seasonName})</p>
        ${this.etransferInstructions({
          amount: Number(details.amount),
          forWhat: `&mdash; ${details.installment === 1 ? 'first' : 'second'} league payment for ${details.seasonName}`,
        })}
        <p>Rosters are filed with the league in advance and we can only include fully paid players. If you need a short extension, please contact us &mdash; we would much rather arrange something than lose the spot.</p>`;

      return await this.send(
        to,
        overdue
          ? `Overdue: league payment for ${playerName}`
          : `Reminder: league payment for ${playerName}`,
        this.layout('League payment', body),
      );
    } catch (error) {
      this.logger.error(`sendLeagueInstallmentReminder failed: ${error.message}`);
      return false;
    }
  }
}
