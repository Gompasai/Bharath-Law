import { defineTool } from '@copilotkit/runtime/v2';
import { z } from 'zod';
import type { WorkspaceStore } from './workspace.js';
import type { Store } from './store.js';
import type { pageAccess } from './page-tools.js';

/**
 * Curated IPC <-> BNS (Bharatiya Nyaya Sanhita, 2023) mapping dictionary
 */
const IPC_BNS_MAP: Record<
  string,
  {
    bns: string;
    ipc: string;
    offense: string;
    bailable: boolean;
    cognizable: boolean;
    punishment: string;
    keyNotes: string;
  }
> = {
  '420': {
    ipc: '420',
    bns: '318(4)',
    offense: 'Cheating and dishonestly inducing delivery of property',
    bailable: false,
    cognizable: true,
    punishment: 'Imprisonment up to 7 years and fine',
    keyNotes: 'Moved under Section 318 of BNS. Subsection (4) covers aggravated cheating with property inducement.',
  },
  '302': {
    ipc: '302',
    bns: '103(1)',
    offense: 'Punishment for murder',
    bailable: false,
    cognizable: true,
    punishment: 'Death or imprisonment for life, and fine',
    keyNotes: 'Section 103(2) BNS also introduces specific penalties for lynching/mob murder by five or more persons.',
  },
  '307': {
    ipc: '307',
    bns: '109',
    offense: 'Attempt to murder',
    bailable: false,
    cognizable: true,
    punishment: 'Imprisonment up to 10 years, and fine; if hurt caused, life imprisonment',
    keyNotes: 'Retains core elements of IPC 307 under Section 109 BNS.',
  },
  '304': {
    ipc: '304',
    bns: '105',
    offense: 'Culpable homicide not amounting to murder',
    bailable: false,
    cognizable: true,
    punishment: 'Life imprisonment or up to 10 years and fine',
    keyNotes: 'Corresponds to Section 105 BNS.',
  },
  '304A': {
    ipc: '304A',
    bns: '106(1) & 106(2)',
    offense: 'Causing death by rash or negligent act (Hit and Run / Medical / General)',
    bailable: true,
    cognizable: true,
    punishment: '106(1): Up to 5 years and fine. 106(2) Hit & Run: Up to 10 years and fine if driver escapes without reporting',
    keyNotes: 'Section 106(2) introduces enhanced punishment for failing to report vehicle accident to police or magistrate.',
  },
  '304B': {
    ipc: '304B',
    bns: '80',
    offense: 'Dowry death',
    bailable: false,
    cognizable: true,
    punishment: 'Imprisonment not less than 7 years, up to life',
    keyNotes: 'Preserves the 7-year presumption rule under Section 80 BNS.',
  },
  '498A': {
    ipc: '498A',
    bns: '85 & 86',
    offense: 'Husband or relative of husband subjecting woman to cruelty',
    bailable: false,
    cognizable: true,
    punishment: 'Imprisonment up to 3 years and fine',
    keyNotes: 'Split into Section 85 (punishment) and Section 86 (definition of cruelty) in BNS.',
  },
  '376': {
    ipc: '376',
    bns: '64',
    offense: 'Punishment for rape',
    bailable: false,
    cognizable: true,
    punishment: 'Rigorous imprisonment not less than 10 years, up to life, and fine',
    keyNotes: 'Under BNS Chapter V (Offenses against Woman and Child). Gang rape is under Section 70 BNS.',
  },
  '354': {
    ipc: '354',
    bns: '74',
    offense: 'Assault or criminal force to woman with intent to outrage her modesty',
    bailable: false,
    cognizable: true,
    punishment: 'Imprisonment 1 to 5 years and fine',
    keyNotes: 'Relocated to Section 74 BNS.',
  },
  '379': {
    ipc: '379',
    bns: '303(2)',
    offense: 'Punishment for theft',
    bailable: false,
    cognizable: true,
    punishment: 'Imprisonment up to 3 years, or fine, or both. Community service on first conviction if value < ₹5000',
    keyNotes: 'BNS 303 introduces community service as an alternative punishment for petty theft.',
  },
  '384': {
    ipc: '384',
    bns: '308(2)',
    offense: 'Punishment for extortion',
    bailable: false,
    cognizable: true,
    punishment: 'Imprisonment up to 3 years, or fine, or both',
    keyNotes: 'Section 308 BNS covers extortion definitions and punishments.',
  },
  '392': {
    ipc: '392',
    bns: '309',
    offense: 'Punishment for robbery',
    bailable: false,
    cognizable: true,
    punishment: 'Rigorous imprisonment up to 10 years and fine; if on highway, up to 14 years',
    keyNotes: 'Corresponds to Section 309 BNS.',
  },
  '395': {
    ipc: '395',
    bns: '310',
    offense: 'Punishment for dacoity',
    bailable: false,
    cognizable: true,
    punishment: 'Imprisonment for life or rigorous imprisonment up to 10 years, and fine',
    keyNotes: 'Dacoity by five or more persons under Section 310 BNS.',
  },
  '406': {
    ipc: '406',
    bns: '316(2)',
    offense: 'Punishment for criminal breach of trust',
    bailable: false,
    cognizable: true,
    punishment: 'Imprisonment up to 5 years (enhanced from 3 in IPC), or fine, or both',
    keyNotes: 'BNS increased max imprisonment from 3 years to 5 years for basic CBT.',
  },
  '409': {
    ipc: '409',
    bns: '316(5)',
    offense: 'Criminal breach of trust by public servant, banker, merchant, or agent',
    bailable: false,
    cognizable: true,
    punishment: 'Imprisonment for life, or up to 10 years, and fine',
    keyNotes: 'Corresponds to Section 316(5) BNS.',
  },
  '467': {
    ipc: '467',
    bns: '337',
    offense: 'Forgery of valuable security, will, etc.',
    bailable: false,
    cognizable: true,
    punishment: 'Imprisonment for life or up to 10 years, and fine',
    keyNotes: 'Corresponds to Section 337 BNS.',
  },
  '468': {
    ipc: '468',
    bns: '338',
    offense: 'Forgery for purpose of cheating',
    bailable: false,
    cognizable: true,
    punishment: 'Imprisonment up to 7 years and fine',
    keyNotes: 'Corresponds to Section 338 BNS.',
  },
  '471': {
    ipc: '471',
    bns: '340(2)',
    offense: 'Using as genuine a forged document or electronic record',
    bailable: false,
    cognizable: true,
    punishment: 'Same punishment as for forging such document',
    keyNotes: 'Corresponds to Section 340(2) BNS.',
  },
  '323': {
    ipc: '323',
    bns: '115(2)',
    offense: 'Voluntarily causing hurt',
    bailable: true,
    cognizable: false,
    punishment: 'Imprisonment up to 1 year, or fine up to ₹1,000, or both',
    keyNotes: 'Corresponds to Section 115(2) BNS.',
  },
  '325': {
    ipc: '325',
    bns: '117(2)',
    offense: 'Voluntarily causing grievous hurt',
    bailable: true,
    cognizable: true,
    punishment: 'Imprisonment up to 7 years and fine',
    keyNotes: 'Corresponds to Section 117(2) BNS.',
  },
  '506': {
    ipc: '506',
    bns: '351',
    offense: 'Punishment for criminal intimidation',
    bailable: true,
    cognizable: false,
    punishment: 'Imprisonment up to 2 years, or fine, or both; if threat to cause death, up to 7 years',
    keyNotes: 'Section 351(2) and 351(3) BNS.',
  },
  '499': {
    ipc: '499/500',
    bns: '356',
    offense: 'Defamation',
    bailable: true,
    cognizable: false,
    punishment: 'Simple imprisonment up to 2 years, or fine, or both, or community service',
    keyNotes: 'Section 356 BNS introduces community service as a potential sentence.',
  },
  '34': {
    ipc: '34',
    bns: '3(5)',
    offense: 'Acts done by several persons in furtherance of common intention',
    bailable: false,
    cognizable: true,
    punishment: 'Joint liability as if done by each alone',
    keyNotes: 'Relocated to Section 3(5) BNS general principles.',
  },
  '120B': {
    ipc: '120B',
    bns: '61(2)',
    offense: 'Punishment of criminal conspiracy',
    bailable: false,
    cognizable: true,
    punishment: 'Same as abetment of the offense conspired',
    keyNotes: 'Relocated to Section 61(2) BNS.',
  },
};

/**
 * Curated CrPC <-> BNSS (Bharatiya Nagarik Suraksha Sanhita, 2023) mapping
 */
const CRPC_BNSS_MAP: Record<
  string,
  {
    crpc: string;
    bnss: string;
    topic: string;
    keyChange: string;
  }
> = {
  '41A': {
    crpc: '41A',
    bnss: '35(3)',
    topic: 'Notice of appearance before police officer prior to arrest',
    keyChange:
      'Mandatory prior permission of DSP rank officer required before arresting person infirm or aged above 60 for offenses punishable under 3 years.',
  },
  '437': {
    crpc: '437',
    bnss: '480',
    topic: 'When bail may be taken in case of non-bailable offense by Magistrate',
    keyChange: 'Provisions for bail before Magistrates relocated to Section 480 BNSS.',
  },
  '438': {
    crpc: '438',
    bnss: '482',
    topic: 'Direction for grant of bail to person apprehending arrest (Anticipatory Bail)',
    keyChange:
      'Sessions Court & High Court power for anticipatory bail retained under Section 482 BNSS.',
  },
  '439': {
    crpc: '439',
    bnss: '483',
    topic: 'Special powers of High Court or Court of Session regarding regular bail',
    keyChange: 'Relocated to Section 483 BNSS. Mandates notice to Public Prosecutor.',
  },
  '482': {
    crpc: '482',
    bnss: '528',
    topic: 'Saving of inherent powers of High Court (FIR Quashing / Precenting abuse of process)',
    keyChange:
      'Inherent powers of the High Court to quash FIRs and prevent abuse of process preserved verbatim in Section 528 BNSS.',
  },
  '154': {
    crpc: '154',
    bnss: '173',
    topic: 'Information in cognizable cases (First Information Report / FIR)',
    keyChange:
      'Formalizes Zero FIR across India and electronic communication (e-FIR) signed within 3 days.',
  },
  '156(3)': {
    crpc: '156(3)',
    bnss: '175(3)',
    topic: 'Magistrate power to order investigation of cognizable offense',
    keyChange:
      'Requires prior affidavit and demonstration that Section 173(4) (superintendent representation) was complied with.',
  },
  '167': {
    crpc: '167',
    bnss: '187',
    topic: 'Procedure when investigation cannot be completed in 24 hours (Police Remand & Default Bail)',
    keyChange:
      'Police custody of 15 days can now be taken in whole or parts across the first 40 or 60 days of the 60/90 day custody period.',
  },
  '173': {
    crpc: '173',
    bnss: '193',
    topic: 'Report of police officer on completion of investigation (Chargesheet)',
    keyChange:
      'Mandates police submit investigation progress report to victim within 90 days, electronic filing permissible.',
  },
  '200': {
    crpc: '200',
    bnss: '223',
    topic: 'Examination of complainant in private complaints',
    keyChange:
      'Crucial safeguard: Magistrate shall not take cognizance without giving the accused an opportunity of being heard.',
  },
  '436A': {
    crpc: '436A',
    bnss: '479',
    topic: 'Maximum period for which an undertrial prisoner can be detained',
    keyChange:
      'First-time offenders (never convicted previously) must be released on personal bond after serving one-third of the maximum sentence.',
  },
};

export function legalTools(
  workspace: WorkspaceStore,
  store: Store,
  dotId: string,
  pages?: ReturnType<typeof pageAccess>,
) {
  return [
    defineTool({
      name: 'ipc_to_bns_converter',
      description:
        'Convert between Indian Penal Code (IPC 1860) and the new Bharatiya Nyaya Sanhita (BNS 2023) sections with offenses, bailability, cognizable status, and punishments.',
      parameters: z
        .object({
          section: z
            .string()
            .describe(
              'Section number (e.g. "420", "302", "307", "498A", "376", "318", "103")',
            ),
          direction: z
            .enum(['ipc_to_bns', 'bns_to_ipc'])
            .optional()
            .describe('Conversion direction. Defaults to ipc_to_bns.'),
        })
        .passthrough(),
      execute: async ({ section, direction = 'ipc_to_bns' }) => {
        const clean = section.trim().toUpperCase().replace(/^SEC(TION)?\.?\s*/i, '');

        if (direction === 'ipc_to_bns') {
          const direct = IPC_BNS_MAP[clean];
          if (direct) {
            return {
              status: 'found',
              ipc_section: direct.ipc,
              bns_section: direct.bns,
              offense: direct.offense,
              bailable: direct.bailable ? 'Bailable' : 'Non-Bailable',
              cognizable: direct.cognizable ? 'Cognizable' : 'Non-Cognizable',
              punishment: direct.punishment,
              notes: direct.keyNotes,
            };
          }

          // Search in values
          const matchedKey = Object.keys(IPC_BNS_MAP).find((k) => k.includes(clean));
          if (matchedKey) {
            const hit = IPC_BNS_MAP[matchedKey];
            return {
              status: 'found_partial',
              ipc_section: hit.ipc,
              bns_section: hit.bns,
              offense: hit.offense,
              bailable: hit.bailable ? 'Bailable' : 'Non-Bailable',
              cognizable: hit.cognizable ? 'Cognizable' : 'Non-Cognizable',
              punishment: hit.punishment,
              notes: hit.keyNotes,
            };
          }
        } else {
          // BNS to IPC
          const found = Object.values(IPC_BNS_MAP).find((entry) =>
            entry.bns.toUpperCase().includes(clean),
          );
          if (found) {
            return {
              status: 'found',
              bns_section: found.bns,
              ipc_section: found.ipc,
              offense: found.offense,
              bailable: found.bailable ? 'Bailable' : 'Non-Bailable',
              cognizable: found.cognizable ? 'Cognizable' : 'Non-Cognizable',
              punishment: found.punishment,
              notes: found.keyNotes,
            };
          }
        }

        return {
          status: 'not_in_quick_cache',
          query: section,
          guidance: `Section ${section} was not found in the primary quick-cache. In BNS 2023, offenses against the human body are in Chapter VI (Sections 100-146), offenses against property are in Chapter XVIII (Sections 303-334), offenses against women & children are in Chapter V (Sections 63-99). Use bare_act_search or web search for complex sections.`,
        };
      },
    }),

    defineTool({
      name: 'crpc_to_bnss_converter',
      description:
        'Convert between the Code of Criminal Procedure (CrPC 1973) and the new Bharatiya Nagarik Suraksha Sanhita (BNSS 2023) procedural provisions (bail, remand, FIR, inherent powers).',
      parameters: z
        .object({
          section: z
            .string()
            .describe(
              'CrPC or BNSS section number (e.g. "438", "482", "41A", "167", "154", "482")',
            ),
        })
        .passthrough(),
      execute: async ({ section }) => {
        const clean = section.trim().toUpperCase().replace(/^SEC(TION)?\.?\s*/i, '');
        const direct = CRPC_BNSS_MAP[clean];
        if (direct) {
          return {
            status: 'found',
            crpc_section: direct.crpc,
            bnss_section: direct.bnss,
            subject: direct.topic,
            key_reforms_and_safeguards: direct.keyChange,
          };
        }

        const rev = Object.values(CRPC_BNSS_MAP).find((entry) =>
          entry.bnss.toUpperCase().includes(clean),
        );
        if (rev) {
          return {
            status: 'found',
            bnss_section: rev.bnss,
            crpc_section: rev.crpc,
            subject: rev.topic,
            key_reforms_and_safeguards: rev.keyChange,
          };
        }

        return {
          status: 'not_in_quick_cache',
          query: section,
          guidance: `Section ${section} procedural query. Anticipatory bail is Sec 482 BNSS; Regular bail is Sec 480 & 483 BNSS; FIR Quashing / Inherent powers is Sec 528 BNSS; Police remand is Sec 187 BNSS.`,
        };
      },
    }),

    defineTool({
      name: 'legal_document_template',
      description:
        'Generate standard Indian courtroom pleading templates, notices, and applications formatted with High Court and Supreme Court conventions.',
      parameters: z
        .object({
          doc_type: z
            .enum([
              'anticipatory_bail_bnss',
              'regular_bail_bnss',
              'section_138_ni_act_notice',
              'section_80_cpc_notice',
              'vakalatnama',
              'caveat_petition_cpc',
              'affidavit_general',
              'writ_petition_art226',
            ])
            .describe('Type of legal document template needed'),
          case_details: z
            .string()
            .optional()
            .describe('Parties names, FIR details, court name, or cheque details to pre-populate'),
        })
        .passthrough(),
      execute: async ({ doc_type, case_details = '' }) => {
        switch (doc_type) {
          case 'anticipatory_bail_bnss':
            return {
              title: 'Application for Anticipatory Bail under Section 482 BNSS, 2023',
              court_format: `IN THE COURT OF THE SESSIONS JUDGE / HON'BLE HIGH COURT OF [STATE] AT [BENCH]
CRIMINAL MISCELLANEOUS (ANTICIPATORY BAIL) APPLICATION NO. _____ OF 202_

IN THE MATTER OF:
[Applicant Name], S/o [Father Name],
R/o [Address]                                                    ...APPLICANT / PETITIONER

                                     VERSUS

STATE OF [STATE NAME]
(Through SHO, Police Station: [PS Name], Crime No: [FIR No]/202_
under Sections [BNS Sections])                                   ...RESPONDENT

APPLICATION UNDER SECTION 482 OF THE BHARATIYA NAGARIK SURAKSHA SANHITA, 2023 FOR GRANT OF ANTICIPATORY BAIL

MOST RESPECTFULLY SHOWETH:
1. That the Applicant is a law-abiding citizen of India with deep roots in society and no criminal antecedents.
2. That the present FIR No. [FIR No] has been registered on [Date] at Police Station [PS Name] under Sections [BNS Sections] on concocted and politically motivated allegations.
3. [BRIEF FACTS OF THE CASE]
4. GROUNDS FOR ANTICIPATORY BAIL:
   A. Because the allegations in the FIR do not prima facie disclose any cognizable offense against the Applicant.
   B. Because the custodial interrogation of the Applicant is wholly unwarranted in the facts and circumstances of the case.
   C. Because the Applicant undertakes to join investigation as and when directed under Section 35(3) BNSS, 2023.
   D. Because the Applicant undertakes not to tamper with prosecution witnesses or evidence.
   E. Because the Applicant is ready to furnish solvent sureties to the satisfaction of this Hon'ble Court.

PRAYER:
It is therefore respectfully prayed that this Hon'ble Court may graciously be pleased to:
a) Direct that in the event of arrest of the Applicant in connection with FIR No. [FIR No] registered at P.S. [PS Name], the Applicant be released on bail on such terms and conditions as this Hon'ble Court deems fit;
b) Pass any other or further orders as this Hon'ble Court may deem fit and proper in the interest of justice.

PLACE: [City]
DATED: [Date]                                                 ADVOCATE FOR APPLICANT`,
            };

          case 'section_138_ni_act_notice':
            return {
              title: 'Statutory Legal Demand Notice under Section 138 Negotiable Instruments Act, 1881',
              court_format: `REGISTERED A.D. / SPEED POST / LEGAL NOTICE

Date: [Date]

TO,
[Debtor / Drawer Name]
[Address]

SUBJECT: STATUTORY LEGAL NOTICE UNDER SECTION 138 READ WITH SECTION 142 OF THE NEGOTIABLE INSTRUMENTS ACT, 1881 FOR DISHONOUR OF CHEQUE NO. [Cheque No] DATED [Cheque Date] FOR ₹[Amount]/-

Sir / Madam,

Under instructions from and on behalf of my client [Client / Payee Name], residing at [Client Address], I hereby serve upon you the following Statutory Legal Demand Notice:

1. That you, the Addressee, approached my client for [State Transaction / Loan / Supply of Goods] and towards lawful discharge of your legally enforceable debt/liability, you issued Cheque No. [Cheque No], dated [Date], drawn on [Bank Name], [Branch], for an amount of ₹[Amount]/- (Rupees [Amount in Words] only).

2. That on presentation of the aforesaid cheque by my client through their banker [Client Bank], the said cheque was returned dishonoured and unpaid with the bank memo dated [Memo Date] with remarks "[Funds Insufficient / Account Closed / Stop Payment]".

3. That the dishonour of the said cheque clearly establishes your dishonest and fraudulent intention to cheat my client.

4. In light of the above statutory mandate, you are hereby called upon to pay the entire cheque amount of ₹[Amount]/- within FIFTEEN (15) DAYS from the date of receipt of this notice, failing which my client shall be constrained to initiate criminal proceedings against you under Section 138 of the Negotiable Instruments Act, 1881, as well as Section 318(4) of the Bharatiya Nyaya Sanhita, 2023 for cheating, entirely at your risk, cost, and consequence.

Copy kept in my office for record and further legal proceedings.

[Advocate Name]
Advocate, [Bar Association / Court]
Enrolment No: [Enrolment No]`,
            };

          case 'vakalatnama':
            return {
              title: 'Standard Indian Court Vakalatnama',
              court_format: `IN THE COURT OF [HON'BLE COURT NAME] AT [CITY/BENCH]
SUIT / PETITION / APPEAL / CASE NO. _______ OF 202_

IN THE MATTER OF:
[Petitioner / Plaintiff / Appellant Name]                          ...PLAINTIFF / PETITIONER
                                  VERSUS
[Respondent / Defendant Name]                                     ...DEFENDANT / RESPONDENT

                                     VAKALATNAMA

I/We, the undersigned above-named [Plaintiff/Defendant/Petitioner/Respondent], do hereby appoint, nominate and constitute:
[Advocate Name(s)]
Advocates, [High Court / Bar Council Enrolment No.]
Office: [Advocate Chamber Address / Contact]

to be my/our lawful Advocate(s) to appear, plead, act, compromise, withdraw, file documents, and argue in the above-captioned matter on my/our behalf.

Dated this [Date] day of [Month], 202_.

ACCEPTED:                                                       CLIENT / EXECUTANT
[Advocate Signature]                                            [Client Signature]`,
            };

          default:
            return {
              title: `Court Pleading Skeleton for ${doc_type}`,
              guidance:
                'Use standard High Court Cause Title, Index, Synopsis, List of Dates, Grounds, Verification Affidavit, and Prayer Clause.',
            };
        }
      },
    }),

    defineTool({
      name: 'save_legal_draft_to_page',
      description:
        'Save a generated legal brief, pleading, bail application, or notice directly into a Workspace Page so the lawyer can view, edit, and print it.',
      parameters: z
        .object({
          title: z.string().describe('Title of the legal document / brief'),
          content_markdown: z
            .string()
            .describe('Complete legal brief formatted in Markdown with cause title, grounds, and prayers'),
        })
        .passthrough(),
      execute: async ({ title, content_markdown }) => {
        if (!pages) {
          return {
            status: 'unavailable',
            message: 'Page access is not available in the current context.',
          };
        }

        const page = pages.create({
          title,
          content: content_markdown,
        });

        return {
          status: 'saved',
          page_id: page.id,
          page_title: page.title,
          url: page.url,
          message: `Legal draft '${title}' successfully created in your workspace! You can click and edit it directly in the editor.`,
        };
      },
    }),

    defineTool({
      name: 'analyze_case_document',
      description:
        'Analyze uploaded case-related legal documents (FIR, Chargesheet, Bail Application, Legal Notice, Agreement, Contract, Writ Petition, Order) to extract key facts, dates, involved parties, alleged offenses, statutory sections (IPC/BNS, CrPC/BNSS), liabilities, and defense strategies.',
      parameters: z
        .object({
          document_type: z
            .enum([
              'fir_or_chargesheet',
              'bail_petition',
              'legal_notice',
              'agreement_or_contract',
              'writ_petition',
              'court_order',
              'general_case_document',
            ])
            .describe('Category of the uploaded case document'),
          case_summary: z
            .string()
            .describe('Summary of the key allegations or contractual terms identified in the document'),
          relevant_sections: z
            .array(z.string())
            .optional()
            .describe('Statutory sections mentioned (e.g. ["IPC 420", "BNS 318(4)", "Sec 138 NI Act"])'),
          actionable_legal_strategy: z
            .string()
            .describe('Recommended courtroom or drafting strategy for the advocate'),
        })
        .passthrough(),
      execute: async ({ document_type, case_summary, relevant_sections = [], actionable_legal_strategy }) => {
        return {
          status: 'analyzed',
          document_type,
          summary: case_summary,
          sections_identified: relevant_sections,
          counsel_strategy: actionable_legal_strategy,
          guidance:
            'Use ipc_to_bns_converter or crpc_to_bnss_converter to verify penalties, or legal_document_template to prepare the corresponding pleading.',
        };
      },
    }),
  ];
}
