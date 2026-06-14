export function generateInterviewIcs({
  token,
  topic,
  scheduledAt,
  durationSec,
  baseUrl,
}: {
  token: string;
  topic?: string | null;
  scheduledAt: string;
  durationSec: number;
  baseUrl: string;
}): string {
  const start = new Date(scheduledAt);
  const end = new Date(start.getTime() + durationSec * 1000);
  const now = new Date();

  const formatIcalDate = (d: Date) =>
    d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  const escapeText = (str: string) => {
    return str
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  };

  const cleanTopic = topic ? escapeText(topic) : "Your Interview";
  const url = `${baseUrl}/i/${token}`;
  const description = escapeText(`Your Supportsheep AI interview is scheduled.\n\nJoin here: ${url}`);

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Supportsheep//Interview Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:interview-token-${token}@supportsheep.com`,
    `DTSTAMP:${formatIcalDate(now)}`,
    `DTSTART:${formatIcalDate(start)}`,
    `DTEND:${formatIcalDate(end)}`,
    `SUMMARY:Supportsheep AI Interview: ${cleanTopic}`,
    `URL:${url}`,
    `DESCRIPTION:${description}`,
    "STATUS:CONFIRMED",
    "SEQUENCE:0",
    "TRANSP:OPAQUE",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}
