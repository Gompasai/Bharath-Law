# ⚖️ Bharath Law Chambers

<div align="center">

### Autonomous Indian Legal AI Intelligence Platform
**Courtroom-Grade Litigation Strategy · Statutory Dual-Mapping (BNS / BNSS / BSA) · Case Docket Analysis · Pleadings & Petition Drafting**

[![Platform: Bharath Law](https://img.shields.io/badge/Platform-Bharath%20Law-0f213d.svg)](https://github.com/Gompasai/Bharath-Law)
[![Jurisdiction: Republic of India](https://img.shields.io/badge/Jurisdiction-Republic%20of%20India-d4af37.svg)](https://main.sci.gov.in/)
[![Statutory: BNS / BNSS / BSA 2023](https://img.shields.io/badge/Statutes-BNS%20%7C%20BNSS%20%7C%20BSA%202023-16a34a.svg)](https://www.mha.gov.in/)
[![Deployment: Live on Render](https://img.shields.io/badge/Deployment-Live%20on%20Render-blue.svg)](https://bharath-law.onrender.com)

**Confidential, Self-Hosted Digital Chambers Designed Exclusively for Advocates, Corporate Legal Teams, and Litigants.**

</div>

---

## 🏛️ Executive Overview

**Bharath Law Chambers** is a purpose-built legal intelligence operating system engineered for Indian jurisprudence. Unlike generic consumer chatbots that confuse foreign common law with Indian practice, Bharath Law is grounded entirely in the **Constitution of India**, **Supreme Court of India precedents**, and the **2023 Criminal Law Codes (Bharatiya Nyaya Sanhita, Bharatiya Nagarik Suraksha Sanhita, and Bharatiya Sakshya Adhiniyam)**.

The platform provides a virtual law chambers with specialized autonomous counsel, instant statutory section mapping, real case docket ingestion, and persistent document drafting workspaces.

---

## ⚖️ Specialized Chambers Bench

Instead of a single generalist bot, Bharath Law provides a bench of specialized autonomous counsels:

```
                              ┌─────────────────────────────────────────┐
                              │          BHARATH LAW CHAMBERS           │
                              │        Virtual Executive Counsel        │
                              └────────────────────┬────────────────────┘
                                                   │
         ┌────────────────────────┬────────────────┼────────────────────────┬────────────────────────┐
         │                        │                │                        │                        │
         ▼                        ▼                ▼                        ▼                        ▼
┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐    ┌──────────────────┐
│   BHARATH LAW    │    │ BHARATH SANHITA  │    │  BHARATH CIVIL & │    │  BHARATH LEGAL   │    │ BHARATH CORP. &  │
│ Senior Advocate  │    │    SPECIALIST    │    │  CONSTITUTIONAL  │    │     DRAFTER      │    │  IBC SPECIALIST  │
│  & Chief Counsel │    │ Criminal & Bail  │    │ Writs & CPC 1908 │    │ Petitions & NI138│    │ NCLT / CIRP / Arb│
└──────────────────┘    └──────────────────┘    └──────────────────┘    └──────────────────┘    └──────────────────┘
```

1. **Bharath Law (Senior Advocate & Chief Legal Counsel):**
   * High-level case evaluation, forum selection, issue framing, legal second opinions, and appellate strategy following Bar Council of India standards.
2. **Bharath Sanhita Specialist (Indian Criminal Law Authority):**
   * Authority on the new criminal codes: **BNS 2023** (vs IPC 1860), **BNSS 2023** (vs CrPC 1973), and **BSA 2023** (vs Indian Evidence Act).
   * Evaluates Section 35(3) BNSS arrest notices, custody limits (Section 187 BNSS), Regular Bail (Sec 480 BNSS), Anticipatory Bail (Sec 482 BNSS), FIR Quashing (Sec 528 BNSS / Art 226), and Electronic Certificate compliance under Section 63 BSA 2023.
3. **Bharath Civil & Constitutional Litigator:**
   * Extraordinary writ jurisdiction before the Supreme Court (Article 32) and High Courts (Article 226).
   * Code of Civil Procedure (CPC 1908), Territorial Jurisdiction (Section 20 CPC & Section 28 Contract Act under *ABC Laminart* standards), Interim Injunctions (Order 39), Specific Relief, and Property disputes.
4. **Bharath Legal Drafter:**
   * Generates court-ready Indian legal documents: Anticipatory Bail Petitions, Section 138 NI Act Statutory Demand Notices, Section 80 CPC Notices, Plaints, Written Statements, Caveat Petitions (Sec 148A CPC), and Special Leave Petitions (Art 136).
5. **Bharath Corporate & IBC Specialist:**
   * Insolvency and Bankruptcy Code (IBC 2016) before NCLT/NCLAT (Section 7, 9, 10 CIRP applications, Section 14 moratoriums), Companies Act 2013 (Oppression & Mismanagement u/s 241/242), and Arbitration & Conciliation Act 1996 (Sections 9, 11, and 34).

---

## 🚀 Key Capabilities

### 1. Statutory Dual-Mapping Engine (IPC ➔ BNS / CrPC ➔ BNSS)
India's transition to new criminal laws requires simultaneous comprehension of old and new sections. Bharath Law includes hard-coded conversion tools that instantly cross-reference offenses, changes in bailability, compoundability, minimum sentences, and procedural steps.

### 2. Real Case Docket Processing (FIR, Petitions, Contracts)
Upload case documents (PDF, DOCX, TXT) directly into the chat:
* Automatic text extraction with OCR preview cards.
* Extracts critical facts, dates, accused/respondent particulars, and charges.
* Collapsible docket interface inside the chat transcript.

### 3. Courtroom-Grade Pleadings & Notices
Produces structured Indian pleadings with:
* Formal court cause titles and jurisdiction clauses.
* Itemized facts, grounds of challenge, and factual matrices.
* Formal prayer clauses, verification affidavits, and counsel attestations.

### 4. Persistent Law Office Workspace (Spaces & Pages)
Bharath Law isn't just a chat; it's a living law office:
* **Spaces:** Organize research by client or case docket.
* **Pages:** Saved legal briefs, draft petitions, and case notes stored in a persistent SQLite database.
* **Autosave & Document Revisions:** Full rich-text document editing with Markdown export.

### 5. Attorney-Client Privilege & Strict Privacy
Under the **Advocates Act, 1961** and **Section 132 BSA 2023** (formerly Section 126 Indian Evidence Act), advocate-client confidentiality is absolute:
* **Self-Hosted Data Sovereignty:** All files and case histories stay in your private container.
* **Owner Access Token Protection:** Secured by an encrypted master password with permanent `localStorage` browser authentication and 1-click token URL access.
* **No Third-Party Model Training:** Client case data is never used to train public models.

---

## 🛠️ Technology Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 19, TypeScript, Vite, Vanilla CSS Design System, Lucide Icons, TipTap Document Editor, React-Markdown with GFM & Rehype-Raw |
| **Backend** | Node.js (v24), Hono Framework, CopilotKit Runtime v2, TanStack AI, RxJS |
| **Database** | SQLite with WAL mode, persistent storage |
| **Document Engine** | `pdf-parse` text extractor, docket processor |
| **Container & Ops** | Multi-stage Docker, Render Blueprint (`render.yaml`), Railway configuration (`railway.json`) |

---

## 💻 Local Setup & Development

### Prerequisites
* **Node.js** (v20 or v24 recommended)
* **npm** (v10+)
* A valid Groq or OpenAI API key

### 1. Clone & Install
```bash
git clone https://github.com/Gompasai/Bharath-Law.git
cd Bharath-Law
npm install
```

### 2. Configure Environment (`.env`)
Create a `.env` file in the root directory:
```env
NODE_ENV=development
HOST=127.0.0.1
PORT=4310
DATABASE_PATH=data/opendots.sqlite

# Groq (Recommended for lightning-fast legal reasoning)
OPENAI_BASE_URL=https://api.groq.com/openai/v1
OPENAI_MODEL=openai/gpt-oss-120b
OPENAI_API_KEY=your_groq_api_key_here

# Chambers Authentication
INTELLIGENCE_API_KEY=local
OWNER_TOKEN=bharath-law-chambers-secret-token-2024
```

### 3. Run Locally
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## ☁️ Cloud Deployment

### Deploy on Render
Bharath Law is pre-configured with `render.yaml` for instant deployment:

1. Push your changes to your GitHub repository.
2. In [Render Dashboard](https://dashboard.render.com), click **+ New** ➔ **Blueprint**.
3. Select your `Bharath-Law` repository.
4. Provide your `OPENAI_API_KEY` when prompted.
5. Click **Apply** — Render builds the Docker container and launches your live HTTPS site (`https://bharath-law.onrender.com`).

### Deploy with Docker
```bash
docker build -t bharath-law:latest .
docker run -d -p 4310:10000 \
  -e NODE_ENV=production \
  -e OPENAI_API_KEY=your_api_key \
  -e OPENAI_BASE_URL=https://api.groq.com/openai/v1 \
  -e OPENAI_MODEL=openai/gpt-oss-120b \
  -e OWNER_TOKEN=your_secure_24_char_token \
  -v $(pwd)/data:/data \
  bharath-law:latest
```

---

## 📜 Chambers Compliance & Ethical Standards

Bharath Law is built in strict adherence to:
1. **The Advocates Act, 1961** and the **Bar Council of India Rules**.
2. **Bharatiya Sakshya Adhiniyam, 2023 (BSA):** Sections 63 (Electronic Records) and 132 (Privileged Professional Communications).
3. **Supreme Court of India Practice & Procedure Rules, 2013**.

*Disclaimer: Bharath Law Chambers is an AI-augmented decision support and legal research platform intended to assist legal practitioners, corporate counsels, and scholars. It operates as an autonomous associate counsel and should be verified by enrolled advocates before court filings.*

---

<div align="center">

**Bharath Law Chambers — Empowering Indian Legal Practice with Sovereign Artificial Intelligence.**

</div>
