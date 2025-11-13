import * as React from "react";
import { Section, Text, Button } from "@react-email/components";

import { BaseLayout } from "@/emails/BaseLayout";

type ConflictDetectedProps = {
  studentName: string;
  lessonWindow: string;
  summary: string;
  manageUrl: string;
};

export function ConflictDetectedEmail({
  studentName,
  lessonWindow,
  summary,
  manageUrl,
}: ConflictDetectedProps) {
  return (
    <BaseLayout
      previewText={`Weather conflict detected for your lesson on ${lessonWindow}.`}
      heading="Weather conflict detected"
    >
      <Section style={styles.content}>
        <Text style={styles.paragraph}>
          Hi {studentName}, we detected weather conditions that fall below the minimums for
          your upcoming lesson scheduled for <strong>{lessonWindow}</strong>.
        </Text>
        <Text style={styles.paragraph}>{summary}</Text>
        <Text style={styles.paragraph}>
          We automatically cancelled the existing booking and started building new options for you. When
          you&apos;re ready, review the suggested times and pick the one that works best.
        </Text>
        <Button href={manageUrl} style={styles.button}>
          Review reschedule options
        </Button>
        <Text style={styles.note}>
          Need a different time? Reply to this email or contact dispatch to coordinate manually.
        </Text>
      </Section>
    </BaseLayout>
  );
}

const styles = {
  content: {
    lineHeight: "1.6",
    color: "#0f172a",
    fontSize: "15px",
  },
  paragraph: {
    marginBottom: "16px",
  },
  button: {
    display: "inline-block",
    backgroundColor: "#2563eb",
    color: "#ffffff",
    padding: "12px 18px",
    borderRadius: "9999px",
    fontWeight: 600,
    textDecoration: "none",
    marginTop: "8px",
  },
  note: {
    fontSize: "13px",
    color: "#64748b",
    marginTop: "20px",
  },
} satisfies Record<string, React.CSSProperties>;
