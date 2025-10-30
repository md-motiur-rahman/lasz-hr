import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServerComponentClient } from "@supabase/auth-helpers-nextjs";
import nodemailer from "nodemailer"
import { jsPDF } from "jspdf";
import "jspdf-autotable";

function icsDate(d: Date) {
  return d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function extractEmail(addr: string | undefined | null): string | null {
  if (!addr) return null;
  const m = String(addr).match(/<([^>]+)>/);
  if (m) return m[1];
  if (/^[^@]+@[^@]+\.[^@]+$/.test(String(addr))) return String(addr);
  return null;
}

function buildICS(
  company: string,
  employeeName: string,
  attendeeEmail: string,
  organizerName: string,
  organizerEmail: string,
  events: { id: string; start_time: string; end_time: string; department?: string | null; role?: string | null }[]
) {
  const now = new Date();
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LASZ HR//Rota//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
  ];
  for (const e of events) {
    const s = new Date(e.start_time);
    const end = new Date(e.end_time);
    const summary = `${employeeName} — Shift`;
    const descParts = [
      `Company: ${company}`,
      e.department ? `Department: ${e.department}` : undefined,
      e.role ? `Role: ${e.role}` : undefined,
    ].filter(Boolean);
    const desc = descParts.join("\\n");
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@lasz-hr`,
      `SEQUENCE:0`,
      `DTSTAMP:${icsDate(now)}`,
      `DTSTART:${icsDate(s)}`,
      `DTEND:${icsDate(end)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${desc}`,
      `ORGANIZER;CN=${organizerName}:mailto:${organizerEmail}`,
      `ATTENDEE;CN=${employeeName};ROLE=REQ-PARTICIPANT;PARTSTAT=NEEDS-ACTION;RSVP=FALSE:mailto:${attendeeEmail}`,
      `STATUS:CONFIRMED`,
      `TRANSP:OPAQUE`,
      "END:VEVENT"
    );
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function humanDuration(start: Date, end: Date) {
  const mins = Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
  const hh = String(Math.floor(mins / 60)).padStart(2, "0");
  const mm = String(mins % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function buildPdf(
  company: string,
  employee: string,
  department: string,
  rangeStart: Date,
  rangeEnd: Date,
  events: { start_time: string; end_time: string; department?: string | null; role?: string | null; break_minutes?: number | null }[]
) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const rangeText = `${rangeStart.toLocaleDateString()} — ${rangeEnd.toLocaleDateString()}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.text(company || "Company", 14, 16);

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(`Employee: ${employee}`, 14, 24);
  doc.text(`Department: ${department || "—"}`, 14, 30);
  doc.text(`Range: ${rangeText}`, 14, 36);

  doc.setDrawColor(60);
  doc.line(14, 40, 196, 40);

  const body = events.map((r) => {
    const d = new Date(r.start_time);
    const s = new Date(r.start_time);
    const e = new Date(r.end_time);
    const dayName = d.toLocaleDateString(undefined, { weekday: "short" });
    // compute duration minus break
    let mins = Math.max(0, Math.round((e.getTime() - s.getTime()) / 60000));
    const bm = (r as any).break_minutes ?? 0;
    mins = Math.max(0, mins - (typeof bm === "number" ? bm : Number(bm) || 0));
    const hh = String(Math.floor(mins / 60)).padStart(2, "0");
    const mm = String(mins % 60).padStart(2, "0");
    return [
      d.toLocaleDateString(),
      dayName,
      s.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      e.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      `${hh}:${mm}`,
      r.department || "",
      r.role || "",
    ];
  });

  if (body.length === 0) {
    doc.setFontSize(11);
    doc.text("No shifts in selected range.", 14, 48);
  } else {
    (doc as any).autoTable({
      startY: 46,
      head: [["Date", "Day", "Start", "End", "Duration", "Department", "Role"]],
      body,
      theme: "grid",
      styles: { fontSize: 10, cellPadding: 2 },
      headStyles: { fillColor: [79, 70, 229], textColor: 255 },
      alternateRowStyles: { fillColor: [245, 247, 255] },
      margin: { left: 14, right: 14 },
    });
  }

  const arr = doc.output("arraybuffer");
  return Buffer.from(arr);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { employeeId, rangeStart, rangeEnd } = body as { employeeId: string; rangeStart: string; rangeEnd: string };
    if (!employeeId || !rangeStart || !rangeEnd) return NextResponse.json({ error: "Missing params" }, { status: 400 });

    const cookieStore = await cookies();
    const supabase = createServerComponentClient(
      { cookies: () => cookieStore },
      { supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!, supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Verify admin (company owner)
    const { data: company } = await supabase
      .from("companies")
      .select("id, company_name")
      .eq("owner_user_id", user.id)
      .maybeSingle();

    if (!company) return NextResponse.json({ error: "Company not found or not owner" }, { status: 403 });

    // Fetch employee and shifts
    const { data: emp } = await supabase
      .from("employees")
      .select("id, full_name, email, department")
      .eq("id", employeeId)
      .eq("company_id", company.id)
      .maybeSingle();

    if (!emp || !emp.email) return NextResponse.json({ error: "Employee email not found" }, { status: 404 });

    const { data: shifts } = await supabase
      .from("shifts")
      .select("id, start_time, end_time, department, role, break_minutes")
      .eq("company_id", company.id)
      .eq("employee_id", employeeId)
      .gte("start_time", new Date(rangeStart).toISOString())
      .lte("start_time", new Date(rangeEnd).toISOString())
      .order("start_time", { ascending: true });

    const events = (shifts || []).map((s) => ({ id: s.id, start_time: s.start_time, end_time: s.end_time, department: s.department, role: s.role, break_minutes: (s as any).break_minutes ?? 0 }));

    const organizerName = company.company_name || "Company";
    const organizerEmail = extractEmail(process.env.EMAIL_FROM) || process.env.SMTP_USER || "";
    const attendeeEmail = emp.email as string;
    const ics = buildICS(
      organizerName,
      emp.full_name || "Employee",
      attendeeEmail,
      organizerName,
      organizerEmail,
      events
    );

    const pdfBuffer = buildPdf(
      organizerName,
      emp.full_name || "Employee",
      emp.department || "—",
      new Date(rangeStart),
      new Date(rangeEnd),
      events
    );

    // SMTP transport
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: String(process.env.SMTP_PORT || 587) === "465",
      auth: process.env.SMTP_USER && process.env.SMTP_PASS ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    });

    const rangeText = `${new Date(rangeStart).toLocaleDateString()} — ${new Date(rangeEnd).toLocaleDateString()}`;

    await transporter.sendMail({
      from: process.env.EMAIL_FROM!,
      to: emp.email,
      subject: `Rota: ${emp.full_name} (${rangeText})`,
      text: `Hi ${emp.full_name},\n\nYour rota for ${rangeText} is attached as a calendar invite (ICS) and as a PDF summary.\nYou can add it to your calendar by opening the invite, or view the PDF.\n\nThanks,\n${company.company_name}`,
      icalEvent: {
        filename: `rota_${emp.full_name?.replace(/\s+/g, "_")}_${rangeStart}.ics`,
        method: 'request',
        content: ics,
      } as any,
      attachments: [
        {
          filename: `rota_${emp.full_name?.replace(/\s+/g, "_")}_${rangeStart}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Failed to email rota" }, { status: 500 });
  }
}
