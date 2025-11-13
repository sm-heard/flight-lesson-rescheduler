import * as React from "react";
import { render } from "@react-email/render";

import { ConflictDetectedEmail } from "@/emails/ConflictDetected";
import { ProposalsReadyEmail } from "@/emails/ProposalsReady";
import { ProposalConfirmedEmail } from "@/emails/ProposalConfirmed";

export type TemplateParams =
  | {
      kind: "conflict_detected";
      studentName: string;
      lessonWindow: string;
      summary: string;
      manageUrl: string;
    }
  | {
      kind: "proposals_ready";
      studentName: string;
      lessonWindow: string;
      proposals: Array<{ label: string; rationale: string }>;
      manageUrl: string;
    }
  | {
      kind: "proposal_confirmed";
      studentName: string;
      newWindow: string;
    };

export type RenderedTemplate = {
  subject: string;
  html: string;
  text: string;
};

export async function renderNotificationTemplate(params: TemplateParams): Promise<RenderedTemplate> {
  switch (params.kind) {
    case "conflict_detected": {
      const subject = `Weather conflict for your lesson (${params.lessonWindow})`;
      const component = (
        <ConflictDetectedEmail
          studentName={params.studentName}
          lessonWindow={params.lessonWindow}
          summary={params.summary}
          manageUrl={params.manageUrl}
        />
      );
      const html = await render(component, { pretty: false });
      const text = await render(component, { plainText: true });
      return { subject, html, text };
    }
    case "proposals_ready": {
      const subject = `Reschedule options ready (${params.lessonWindow})`;
      const component = (
        <ProposalsReadyEmail
          studentName={params.studentName}
          lessonWindow={params.lessonWindow}
          proposals={params.proposals}
          manageUrl={params.manageUrl}
        />
      );
      const html = await render(component, { pretty: false });
      const text = await render(component, { plainText: true });
      return { subject, html, text };
    }
    case "proposal_confirmed": {
      const subject = `Lesson rescheduled (${params.newWindow})`;
      const component = (
        <ProposalConfirmedEmail
          studentName={params.studentName}
          newWindow={params.newWindow}
        />
      );
      const html = await render(component, { pretty: false });
      const text = await render(component, { plainText: true });
      return { subject, html, text };
    }
    default: {
      const exhaustiveCheck: never = params;
      throw new Error(`Unhandled template kind: ${(exhaustiveCheck as TemplateParams).kind}`);
    }
  }
}
