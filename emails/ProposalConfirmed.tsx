import * as React from "react";
import { Section, Text } from "@react-email/components";

import { BaseLayout } from "@/emails/BaseLayout";

type ProposalConfirmedProps = {
  studentName: string;
  newWindow: string;
  acknowledgement?: string;
};

export function ProposalConfirmedEmail({
  studentName,
  newWindow,
  acknowledgement = "See you at the new lesson time!",
}: ProposalConfirmedProps) {
  return (
    <BaseLayout
      previewText={`Your lesson has been rescheduled to ${newWindow}.`}
      heading="Lesson rescheduled"
    >
      <Section style={styles.content}>
        <Text style={styles.paragraph}>Hi {studentName},</Text>
        <Text style={styles.paragraph}>
          Thanks for confirming your new lesson time. We&apos;ve rescheduled the flight for <strong>{newWindow}</strong>.
          Your instructor and dispatch have been notified.
        </Text>
        <Text style={styles.paragraph}>{acknowledgement}</Text>
        <Text style={styles.note}>
          Weather can still change quickly. We&apos;ll keep monitoring the corridor and notify you if conditions shift again.
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
  note: {
    fontSize: "13px",
    color: "#64748b",
    marginTop: "20px",
  },
} satisfies Record<string, React.CSSProperties>;
