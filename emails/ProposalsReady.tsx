import * as React from "react";
import { Section, Text, Button } from "@react-email/components";

import { BaseLayout } from "@/emails/BaseLayout";

type ProposalItem = {
  label: string;
  rationale: string;
};

type ProposalsReadyProps = {
  studentName: string;
  lessonWindow: string;
  proposals: ProposalItem[];
  manageUrl: string;
};

export function ProposalsReadyEmail({
  studentName,
  lessonWindow,
  proposals,
  manageUrl,
}: ProposalsReadyProps) {
  return (
    <BaseLayout
      previewText={`We have new schedule options for your lesson on ${lessonWindow}.`}
      heading="Choose a new lesson time"
    >
      <Section style={styles.content}>
        <Text style={styles.paragraph}>
          Hi {studentName}, here are the top options for rescheduling your lesson originally set for
          <strong> {lessonWindow}</strong>. Each option considers weather and your recent flying cadence.
        </Text>
        <ul style={styles.list}>
          {proposals.map((proposal, index) => (
            <li key={proposal.label} style={styles.listItem}>
              <Text style={styles.optionTitle}>
                Option {index + 1}: {proposal.label}
              </Text>
              <Text style={styles.optionRationale}>{proposal.rationale}</Text>
            </li>
          ))}
        </ul>
        <Button href={manageUrl} style={styles.button}>
          Pick a new time
        </Button>
        <Text style={styles.note}>
          If none of these work, reply to this email and we&apos;ll coordinate another slot manually.
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
  list: {
    paddingLeft: "20px",
    marginBottom: "16px",
  },
  listItem: {
    marginBottom: "12px",
  },
  optionTitle: {
    fontWeight: 600,
  },
  optionRationale: {
    color: "#475569",
    marginTop: "4px",
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
