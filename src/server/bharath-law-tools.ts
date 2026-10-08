import { defineTool } from '@copilotkit/runtime/v2';
import { z } from 'zod';
import type { WorkspaceStore } from './workspace.js';
import type { Store } from './store.js';

export function bharathLawTools(
  workspace: WorkspaceStore,
  store: Store,
  dotId: string,
) {
  return [
    defineTool({
      name: 'bharath_law_chambers_info',
      description:
        'Retrieve official information, jurisdiction standards, and accredited bench guidance for Bharath Law Chambers.',
      parameters: z.object({}).passthrough(),
      execute: async () => {
        const dot = workspace.dot(dotId);
        return {
          chambers: 'Bharath Law Chambers',
          jurisdiction: 'Republic of India — Supreme Court, High Courts, District Courts, NCLT, NCLAT, RERA, DRT',
          active_counsel: dot?.name || 'Bharath Law',
          specialization: dot?.instructions || 'Indian Jurisprudence and Litigation',
          standards: 'Advocates Act 1961, Bar Council of India Rules, Supreme Court Rules 2013',
          new_criminal_statutes: [
            'Bharatiya Nyaya Sanhita, 2023 (BNS)',
            'Bharatiya Nagarik Suraksha Sanhita, 2023 (BNSS)',
            'Bharatiya Sakshya Adhiniyam, 2023 (BSA)',
          ],
        };
      },
    }),

    defineTool({
      name: 'bharath_law_limitation_calculator',
      description:
        'Calculate statutory limitation periods under the Limitation Act, 1963, Section 138 NI Act, or Arbitration & Conciliation Act 1996 for Indian civil and commercial proceedings.',
      parameters: z
        .object({
          cause_of_action: z
            .string()
            .describe(
              'Type of suit/application: cheque_bounce, money_recovery, breach_of_contract, specific_performance, appeal_high_court, appeal_supreme_court, arbitration_section_34',
            ),
          event_date: z
            .string()
            .optional()
            .describe('Date of accrual of cause of action (YYYY-MM-DD)'),
        })
        .passthrough(),
      execute: async ({ cause_of_action, event_date }) => {
        const rules: Record<string, { period: string; section: string; note: string }> = {
          cheque_bounce: {
            period: '30 days to issue notice, 15 days cure, 30 days to file complaint',
            section: 'Section 138 & 142 of Negotiable Instruments Act, 1881',
            note: 'Cause of action arises on 16th day after receipt of demand notice. Strict 30-day filing limitation unless delay condoned u/s 142(b).',
          },
          money_recovery: {
            period: '3 Years',
            section: 'Article 19 & 22 of Limitation Act, 1963',
            note: 'Limitation runs from when loan is made or debt becomes due. Acknowledgment in writing u/s 18 renews limitation.',
          },
          breach_of_contract: {
            period: '3 Years',
            section: 'Article 55 of Limitation Act, 1963',
            note: 'Calculated from the date the contract is broken or specified date for performance passes.',
          },
          specific_performance: {
            period: '3 Years',
            section: 'Article 54 of Limitation Act, 1963',
            note: 'Calculated from the date fixed for performance, or if no such date is fixed, when plaintiff has notice that performance is refused.',
          },
          appeal_high_court: {
            period: '90 Days (from decree/order of subordinate court)',
            section: 'Article 116(a) of Limitation Act, 1963',
            note: 'Time required for obtaining certified copy of judgment/decree excluded under Section 12.',
          },
          appeal_supreme_court: {
            period: '60 to 90 Days',
            section: 'Article 136 of Constitution & Supreme Court Rules 2013',
            note: 'Special Leave Petition (SLP) against High Court judgment without certificate: 90 days from judgment date.',
          },
          arbitration_section_34: {
            period: '3 Months (+ 30 days discretionary condonation)',
            section: 'Section 34(3) of Arbitration and Conciliation Act, 1996',
            note: 'Strict limitation: Court has NO power to condone delay beyond 30 additional days (Union of India v. Popular Construction).',
          },
        };

        const rule = rules[cause_of_action] || {
          period: '3 Years (general limitation for suits not specifically provided)',
          section: 'Article 113 of Limitation Act, 1963',
          note: 'From the date when the right to sue accrues.',
        };

        return {
          cause_of_action,
          event_date: event_date || 'Date of Cause of Action',
          statutory_limitation: rule.period,
          governing_section: rule.section,
          judicial_notes: rule.note,
        };
      },
    }),
  ];
}
