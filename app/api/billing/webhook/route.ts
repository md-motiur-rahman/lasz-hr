import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import nodemailer from "nodemailer";
import { createClient } from "@supabase/supabase-js";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const config = { api: { bodyParser: false } } as any;

async function resolveCompanyIdByStripeIds(stripeCustomerId?: string | null, stripeSubscriptionId?: string | null) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return undefined;
  try {
    const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    // Prefer matching by subscription id first (more specific)
    if (stripeSubscriptionId) {
      const { data } = await admin.from("companies").select("id").eq("stripe_subscription_id", stripeSubscriptionId).maybeSingle();
      if (data?.id) return data.id as string;
    }
    if (stripeCustomerId) {
      const { data } = await admin.from("companies").select("id").eq("stripe_customer_id", stripeCustomerId).maybeSingle();
      if (data?.id) return data.id as string;
    }
  } catch {
    // ignore
  }
  return undefined;
}

export async function POST(req: NextRequest) {
  const sig = req.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  if (!sig || !secret) return NextResponse.json({ error: "Missing webhook secret" }, { status: 400 });

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2024-06-20" });

  const buf = Buffer.from(await req.arrayBuffer());
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, secret);
  } catch (err: any) {
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const session = event.data.object as Stripe.Checkout.Session;
      const companyId = session.metadata?.company_id || session.client_reference_id || undefined;
      const stripeCustomerId = session.customer && typeof session.customer === "string" ? session.customer : (session.customer as any)?.id;
      const stripeSubscriptionId = session.subscription && typeof session.subscription === "string" ? session.subscription : (session.subscription as any)?.id;
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;
      if (companyId) {
        await fetch(`${siteUrl}/api/internal/billing/update-subscription`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, status: "active", stripeCustomerId, stripeSubscriptionId }),
        });
      } else {
        const cid = await resolveCompanyIdByStripeIds(stripeCustomerId, stripeSubscriptionId);
        if (cid) {
          await fetch(`${siteUrl}/api/internal/billing/update-subscription`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyId: cid, status: "active", stripeCustomerId, stripeSubscriptionId }),
          });
        }
      }

      // Proactively send a receipt/confirmation email after successful checkout completion
      // This complements invoice.payment_succeeded (which may be delayed or missing in edge cases)
      if (process.env.SMTP_HOST && process.env.EMAIL_FROM) {
        try {
          let toEmail: string | undefined = (session.customer_details as any)?.email || (session as any)?.customer_email || undefined;
          // Fallback: fetch Stripe customer email if absent
          if (!toEmail && stripeCustomerId) {
            try {
              const customer = await stripe.customers.retrieve(String(stripeCustomerId));
              if (typeof (customer as any)?.email === "string") toEmail = (customer as any).email as string;
            } catch {}
          }
          if (toEmail) {
            // Retrieve full session and latest invoice to include invoice details/PDF
            let latestInvoice: any | undefined;
            try {
              const fullSession = await stripe.checkout.sessions.retrieve(String(session.id), { expand: ["subscription.latest_invoice"] });
              const subs: any = (fullSession as any)?.subscription;
              latestInvoice = subs?.latest_invoice;
            } catch {}

            const amount = latestInvoice ? (((latestInvoice.amount_paid ?? latestInvoice.amount_due ?? 0) as number) / 100) : undefined;
            const currency = latestInvoice ? String(latestInvoice.currency || "").toUpperCase() : undefined;
            const hostedUrl = latestInvoice?.hosted_invoice_url || undefined;
            let invoicePdfUrl = latestInvoice?.invoice_pdf as string | undefined;
            const invoiceNumber = latestInvoice?.number as string | undefined;
            const createdAt = latestInvoice?.created ? new Date(latestInvoice.created * 1000) : new Date();
            const customerName = (session.customer_details as any)?.name || (latestInvoice?.customer_name as string | undefined) || undefined;

            if (!invoicePdfUrl && latestInvoice?.id) {
              try {
                const refreshed = await stripe.invoices.retrieve(String(latestInvoice.id));
                if ((refreshed as any)?.invoice_pdf) invoicePdfUrl = (refreshed as any).invoice_pdf as string;
              } catch {}
            }

            const transporter = nodemailer.createTransport({
              host: process.env.SMTP_HOST,
              port: Number(process.env.SMTP_PORT || 587),
              secure: String(process.env.SMTP_PORT || 587) === "465",
              auth: process.env.SMTP_USER && process.env.SMTP_PASS ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
              dkim: process.env.EMAIL_DKIM_DOMAIN && process.env.EMAIL_DKIM_SELECTOR && process.env.EMAIL_DKIM_PRIVATE_KEY
                ? {
                    domainName: process.env.EMAIL_DKIM_DOMAIN,
                    keySelector: process.env.EMAIL_DKIM_SELECTOR,
                    privateKey: process.env.EMAIL_DKIM_PRIVATE_KEY,
                  }
                : undefined,
            });

            const fromHeader = process.env.EMAIL_FROM_NAME ? `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>` : process.env.EMAIL_FROM;
            const headers: Record<string, string> = {};
            if (process.env.EMAIL_LIST_UNSUBSCRIBE) {
              headers["List-Unsubscribe"] = process.env.EMAIL_LIST_UNSUBSCRIBE;
              headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
            }

            // Build HTML invoice email for checkout
            let html = `
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; color: #111;">
    <div style="max-width:600px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:8px;">
      <h2 style="margin:0 0 16px;">LASZ HR Pro Subscription Confirmed</h2>
      <p style="margin:0 0 4px;">Hello${customerName ? ` ${customerName}` : ""},</p>
      <p style="margin:0 0 12px;">Thank you for your subscription. ${invoiceNumber ? `Invoice #${invoiceNumber} is attached.` : "Your invoice is attached."}</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr>
          <td style="padding:8px 0;color:#555;">Date</td>
          <td style="padding:8px 0;text-align:right;">${createdAt.toLocaleDateString()}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#555;">Plan</td>
          <td style="padding:8px 0;text-align:right;">LASZ HR Pro</td>
        </tr>
        ${amount && currency ? `<tr><td style=\"padding:8px 0;color:#555;\">Amount</td><td style=\"padding:8px 0;text-align:right;\">${amount.toFixed(2)} ${currency}</td></tr>` : ""}
      </table>
      ${hostedUrl ? `<p style=\"margin:12px 0;\">View invoice online: <a href=\"${hostedUrl}\">${hostedUrl}</a></p>` : ""}
      ${session.url ? `<p style=\"margin:12px 0;\">Manage subscription: <a href=\"${session.url}\">${session.url}</a></p>` : ""}
      <p style="margin:16px 0 0;">— LASZ HR</p>
    </div>
  </body>
 </html>`;

            // Attach generated PDF and Stripe PDF if present
            const attachments: Array<{ filename: string; path?: string; content?: Buffer; contentType?: string }> = [];
            try {
              const doc = new jsPDF();
              const title = `LASZ HR Pro - Invoice${invoiceNumber ? ` #${invoiceNumber}` : ""}`;
              doc.setFontSize(16);
              doc.text(title, 14, 18);
              doc.setFontSize(11);
              doc.text(`Date: ${createdAt.toLocaleDateString()}`, 14, 28);
              if (customerName) doc.text(`Billed to: ${customerName}`, 14, 34);
              autoTable(doc, {
                startY: 40,
                head: [["Description", "Plan", "Amount"]],
                body: [["Subscription", "LASZ HR Pro", `${amount && currency ? `${amount.toFixed(2)} ${currency}` : "-"}`]],
                styles: { fontSize: 11 },
                headStyles: { fillColor: [17, 24, 39] },
              });
              const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 60;
              if (hostedUrl) doc.text(`View online: ${hostedUrl}`, 14, finalY + 10);
              doc.text(`Thank you for your business.`, 14, finalY + 20);
              const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
              attachments.push({ filename: `LASZ-HR-Pro-Invoice${invoiceNumber ? `-${invoiceNumber}` : ""}.pdf`, content: pdfBuffer, contentType: "application/pdf" });
            } catch {}
            if (invoicePdfUrl) attachments.push({ filename: `Stripe-Invoice${invoiceNumber ? `-${invoiceNumber}` : ""}.pdf`, path: invoicePdfUrl, contentType: "application/pdf" });

            await transporter.sendMail({
              from: fromHeader,
              to: toEmail,
              subject: `LASZ HR Pro: Subscription confirmed${invoiceNumber ? ` — Invoice #${invoiceNumber}` : ""}`,
              text: `Your LASZ HR Pro subscription is confirmed.${amount && currency ? ` Amount: ${amount.toFixed(2)} ${currency}` : ""}${hostedUrl ? `\nInvoice: ${hostedUrl}` : ""}`,
              html,
              attachments: attachments.length ? attachments : undefined,
              headers,
            });
          }
        } catch (e) {
          console.warn("Failed to send checkout confirmation email:", (e as any)?.message || e);
        }
      }
    } else if (event.type === "invoice.payment_succeeded" || event.type === "invoice.payment_failed") {
      const invoice = event.data.object as Stripe.Invoice;
      let companyId = (invoice?.subscription_details as any)?.metadata?.company_id || invoice?.metadata?.company_id || undefined;
      const stripeCustomerId = typeof invoice.customer === "string" ? invoice.customer : (invoice.customer as any)?.id;
      const stripeSubscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : (invoice.subscription as any)?.id;
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

      if (!companyId) {
        companyId = await resolveCompanyIdByStripeIds(stripeCustomerId, stripeSubscriptionId);
      }

      const status = event.type === "invoice.payment_succeeded" ? "active" : "past_due";
      if (companyId) {
        await fetch(`${siteUrl}/api/internal/billing/update-subscription`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, status, stripeCustomerId, stripeSubscriptionId }),
        });
      }

      if (event.type === "invoice.payment_succeeded") {
        // Send invoice email via SMTP; try multiple fallbacks for recipient and attach PDF if possible
        if (process.env.SMTP_HOST && process.env.EMAIL_FROM) {
          try {
            let toEmail: string | undefined = invoice.customer_email || undefined;
            // Fallback 1: Stripe Customer email
            if (!toEmail && stripeCustomerId) {
              try {
                const customer = await stripe.customers.retrieve(String(stripeCustomerId));
                if (typeof (customer as any)?.email === "string") toEmail = (customer as any).email as string;
              } catch {}
            }
            // Fallback 1.1: Attempt to pull email from invoice.customer if present as object
            if (!toEmail && typeof invoice.customer !== "string" && invoice.customer) {
              try {
                const c = invoice.customer as any;
                if (typeof c.email === "string") toEmail = c.email as string;
              } catch {}
            }
            // Fallback 2: Company email from DB (service role only)
            if (!toEmail && companyId) {
              try {
                const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
                const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
                if (serviceKey) {
                  const admin = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
                  const { data } = await admin.from("companies").select("company_email").eq("id", companyId).maybeSingle();
                  if (data?.company_email) toEmail = data.company_email as string;
                }
              } catch {}
            }

            if (toEmail) {
              const transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: Number(process.env.SMTP_PORT || 587),
                secure: String(process.env.SMTP_PORT || 587) === "465",
                auth: process.env.SMTP_USER && process.env.SMTP_PASS ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
                dkim: process.env.EMAIL_DKIM_DOMAIN && process.env.EMAIL_DKIM_SELECTOR && process.env.EMAIL_DKIM_PRIVATE_KEY
                  ? {
                      domainName: process.env.EMAIL_DKIM_DOMAIN,
                      keySelector: process.env.EMAIL_DKIM_SELECTOR,
                      privateKey: process.env.EMAIL_DKIM_PRIVATE_KEY,
                    }
                  : undefined,
              });

              const amount = (invoice.amount_paid ?? invoice.amount_due ?? 0) / 100;
              const currency = String(invoice.currency || "").toUpperCase();
              const hostedUrl = invoice.hosted_invoice_url || undefined;
              let invoicePdfUrl = (invoice as any)?.invoice_pdf as string | undefined;
              const invoiceNumber = (invoice as any)?.number as string | undefined;
              const createdAt = invoice.created ? new Date(invoice.created * 1000) : new Date();
              const customerName = (invoice as any)?.customer_name || (invoice as any)?.customer_email || undefined;

              // If PDF link missing, retrieve fresh invoice from Stripe (sometimes webhooks omit invoice_pdf)
              if (!invoicePdfUrl && invoice.id) {
                try {
                  const latestInvoice = await stripe.invoices.retrieve(String(invoice.id));
                  if ((latestInvoice as any)?.invoice_pdf) {
                    invoicePdfUrl = (latestInvoice as any).invoice_pdf as string;
                  }
                } catch {}
              }

              let html = `
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans', 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol'; color: #111;">
    <div style="max-width:600px;margin:0 auto;padding:24px;border:1px solid #eee;border-radius:8px;">
      <h2 style="margin:0 0 16px;">Invoice${invoiceNumber ? ` #${invoiceNumber}` : ""}</h2>
      <p style="margin:0 0 4px;">Hello${customerName ? ` ${customerName}` : ""},</p>
      <p style="margin:0 0 12px;">Thank you for your payment. Your subscription invoice is attached.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0;">
        <tr>
          <td style="padding:8px 0;color:#555;">Date</td>
          <td style="padding:8px 0;text-align:right;">${createdAt.toLocaleDateString()}</td>
        </tr>
        <tr>
          <td style="padding:8px 0;color:#555;">Amount</td>
          <td style="padding:8px 0;text-align:right;">${amount.toFixed(2)} ${currency}</td>
        </tr>
      </table>
      ${hostedUrl ? `<p style=\"margin:12px 0;\">View online: <a href=\"${hostedUrl}\">${hostedUrl}</a></p>` : ""}
      ${invoicePdfUrl ? `<p style=\"margin:12px 0;\">PDF Link: <a href=\"${invoicePdfUrl}\">${invoicePdfUrl}</a></p>` : ""}
      <p style="margin:16px 0 0;">— LASZ HR</p>
    </div>
  </body>
 </html>`;

              const attachments: Array<{ filename: string; path?: string; content?: Buffer; contentType?: string }> = [];
              // Always generate a PDF receipt (LASZ HR Pro) and attach
              try {
                const doc = new jsPDF();
                const title = `LASZ HR Pro - Invoice${invoiceNumber ? ` #${invoiceNumber}` : ""}`;
                doc.setFontSize(16);
                doc.text(title, 14, 18);
                doc.setFontSize(11);
                doc.text(`Date: ${createdAt.toLocaleDateString()}`, 14, 28);
                if (customerName) doc.text(`Billed to: ${customerName}`, 14, 34);
                // Table with summary
                autoTable(doc, {
                  startY: 40,
                  head: [["Description", "Plan", "Amount"]],
                  body: [["Subscription", "LASZ HR Pro", `${amount.toFixed(2)} ${currency}`]],
                  styles: { fontSize: 11 },
                  headStyles: { fillColor: [17, 24, 39] },
                });
                const finalY = (doc as any).lastAutoTable ? (doc as any).lastAutoTable.finalY : 60;
                if (hostedUrl) doc.text(`View online: ${hostedUrl}`, 14, finalY + 10);
                if (invoicePdfUrl) doc.text(`Stripe PDF: ${invoicePdfUrl}`, 14, finalY + 16);
                doc.text(`Thank you for your business.`, 14, finalY + 26);
                const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
                attachments.push({ filename: `LASZ-HR-Pro-Invoice${invoiceNumber ? `-${invoiceNumber}` : ""}.pdf`, content: pdfBuffer, contentType: "application/pdf" });
              } catch {}
              // Additionally attach Stripe-hosted PDF if available
              if (invoicePdfUrl) {
                attachments.push({ filename: `Stripe-Invoice${invoiceNumber ? `-${invoiceNumber}` : ""}.pdf`, path: invoicePdfUrl, contentType: "application/pdf" });
              }

              const fromHeader = process.env.EMAIL_FROM_NAME ? `${process.env.EMAIL_FROM_NAME} <${process.env.EMAIL_FROM}>` : process.env.EMAIL_FROM;
              const headers: Record<string, string> = {};
              if (process.env.EMAIL_LIST_UNSUBSCRIBE) {
                headers["List-Unsubscribe"] = process.env.EMAIL_LIST_UNSUBSCRIBE;
                headers["List-Unsubscribe-Post"] = "List-Unsubscribe=One-Click";
              }
              await transporter.sendMail({
                from: fromHeader,
                to: toEmail,
                subject: `LASZ HR Pro: Invoice${invoiceNumber ? ` #${invoiceNumber}` : ""}`,
                text: `Your LASZ HR Pro payment was successful. Amount: ${amount.toFixed(2)} ${currency}${hostedUrl ? `\nInvoice: ${hostedUrl}` : ""}`,
                html,
                attachments: attachments.length ? attachments : undefined,
                headers,
              });
            }
          } catch (e) {
            console.warn("Failed to send receipt email:", (e as any)?.message || e);
          }
        }
      }
    } else if (event.type === "customer.subscription.updated") {
      const sub = event.data.object as Stripe.Subscription;
      let companyId = sub.metadata?.company_id || undefined;
      const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id;
      const stripeSubscriptionId = typeof sub.id === "string" ? sub.id : (sub as any)?.id;
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

      if (!companyId) {
        companyId = await resolveCompanyIdByStripeIds(stripeCustomerId, stripeSubscriptionId);
      }

      if (companyId) {
        // Map Stripe status to our enum; treat trialing as active to unblock access
        let status: "active" | "past_due" | "canceled" | undefined;
        if (sub.status === "active" || sub.status === "trialing") status = "active";
        else if (sub.status === "past_due") status = "past_due";
        else if (sub.status === "canceled") status = "canceled";
        if (status) {
          await fetch(`${siteUrl}/api/internal/billing/update-subscription`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ companyId, status, stripeCustomerId, stripeSubscriptionId }),
          });
        }
      }
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object as Stripe.Subscription;
      let companyId = sub.metadata?.company_id || undefined;
      const stripeCustomerId = typeof sub.customer === "string" ? sub.customer : (sub.customer as any)?.id;
      const stripeSubscriptionId = typeof sub.id === "string" ? sub.id : (sub as any)?.id;
      const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(req.url).origin;

      if (!companyId) {
        companyId = await resolveCompanyIdByStripeIds(stripeCustomerId, stripeSubscriptionId);
      }

      if (companyId) {
        await fetch(`${siteUrl}/api/internal/billing/update-subscription`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ companyId, status: "canceled", stripeCustomerId, stripeSubscriptionId }),
        });
      }
    }
  } catch (e: any) {
    return NextResponse.json({ received: true, error: e.message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
