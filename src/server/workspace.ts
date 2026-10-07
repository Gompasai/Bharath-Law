import { ComputerStore } from './computer-store.js';
import { Pages } from './pages.js';
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
import { validateLearningSettings } from '../shared/learning.js';
import type { CallReceipt, Conversation, Dot, Space } from '../shared/types.js';
export class WorkspaceStore {
  private db: DatabaseSync;
  readonly pages: Pages;
  readonly computers: ComputerStore;
  constructor(
    path: string,
    readonly ownerId: string,
  ) {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS spaces(id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, createdAt INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS dots(id TEXT PRIMARY KEY, spaceId TEXT NOT NULL, name TEXT NOT NULL, instructions TEXT NOT NULL, researchAllowed INTEGER NOT NULL, memoryAllowed INTEGER NOT NULL, createdAt INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS thread_bindings(id TEXT PRIMARY KEY, dotId TEXT NOT NULL, ownerId TEXT NOT NULL, title TEXT NOT NULL, createdAt INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS thread_messages(id TEXT PRIMARY KEY, threadId TEXT NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, createdAt INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS task_threads(taskId TEXT PRIMARY KEY, threadId TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS calls(id TEXT PRIMARY KEY, threadId TEXT NOT NULL, startedAt INTEGER NOT NULL, endedAt INTEGER, status TEXT NOT NULL, transcript TEXT NOT NULL, error TEXT);
      CREATE TABLE IF NOT EXISTS captures(threadId TEXT PRIMARY KEY, value TEXT NOT NULL);`);
    for (const [table, column, definition] of [
      ['dots', 'learningContainerId', 'TEXT'],
      ['dots', 'skillDeliveryEnabled', 'INTEGER NOT NULL DEFAULT 0'],
      ['thread_bindings', 'learningContainerId', 'TEXT'],
    ]) {
      if (
        !this.db
          .prepare(`PRAGMA table_info(${table})`)
          .all()
          .some((field) => field.name === column)
      )
        this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
    // Migrate only once: restarting must never restore a revoked grant.
    if (
      !this.db
        .prepare(
          "SELECT name FROM sqlite_master WHERE type='table' AND name='dot_spaces'",
        )
        .get()
    ) {
      this.db.exec(`BEGIN;
        CREATE TABLE dot_spaces(dotId TEXT NOT NULL, spaceId TEXT NOT NULL, PRIMARY KEY(dotId, spaceId));
        INSERT INTO dot_spaces SELECT id, spaceId FROM dots;
        COMMIT;`);
    }
    this.computers = new ComputerStore(this.db);
    this.pages = new Pages(this.db, (id) =>
      this.spaces().some((space) => space.id === id),
    );
    if (
      !this.db
        .prepare('PRAGMA table_info(calls)')
        .all()
        .some((column) => column.name === 'anchorMessageId')
    )
      this.db.exec('ALTER TABLE calls ADD COLUMN anchorMessageId TEXT');
    this.db.exec("UPDATE spaces SET name='Bharath Law Chambers', description='Premier Indian Legal AI workspace for litigation, research, and drafting.' WHERE name IN ('Midearth Labs', 'Everyday')");
    this.db.exec(`
      UPDATE dots SET 
        name='Bharath Law', 
        instructions='You are Bharath Law, Senior Advocate and Chief Legal Counsel in Bharath Law Chambers. Master of Indian Jurisprudence, Constitution of India, Supreme Court of India precedents, and statutory enactments. Advise advocates, corporate counsels, and litigants on case strategy, forum selection, issue framing, legal second opinions, and case merit assessments following the Advocates Act 1961 and Bar Council of India standards.'
      WHERE name IN ('Midearth Labs', 'Dot');

      UPDATE dots SET 
        name='Bharath Sanhita Specialist', 
        instructions='You are Bharath Sanhita Specialist, authority on Indian Criminal Law in Bharath Law Chambers. Master of the new criminal laws: Bharatiya Nyaya Sanhita (BNS 2023) vs IPC 1860, Bharatiya Nagarik Suraksha Sanhita (BNSS 2023) vs CrPC 1973, and Bharatiya Sakshya Adhiniyam (BSA 2023) vs Evidence Act. Advise on FIR analysis, Section 35 BNSS arrest notices, remand, regular bail (Sec 480 BNSS), anticipatory bail (Sec 482 BNSS), FIR quashing (Sec 528 BNSS / Art 226), electronic evidence u/s 63 BSA, PMLA, NDPS, and POCSO.'
      WHERE name='Midearth Coder';

      UPDATE dots SET 
        name='Bharath Civil & Constitutional Litigator', 
        instructions='You are Bharath Civil & Constitutional Litigator in Bharath Law Chambers. Specialist in Constitutional Law, Supreme Court of India and High Court extraordinary writ jurisdiction under Article 32 and Article 226 (Habeas Corpus, Mandamus, Certiorari, Prohibition, Quo Warranto), Code of Civil Procedure (CPC 1908), Injunctions (Order 39), Indian Contract Act 1872, Specific Relief Act, Transfer of Property Act, Limitation Act, and Matrimonial Laws.'
      WHERE name='Midearth Deep Research';

      UPDATE dots SET 
        name='Bharath Legal Drafter', 
        instructions='You are Bharath Legal Drafter in Bharath Law Chambers. Expert in drafting court-ready Indian legal documents: Anticipatory Bail applications under Section 482 BNSS, Section 138 NI Act statutory demand notices, Section 80 CPC notices, Vakalatnama, Plaints, Written Statements, Affidavits, Caveat petitions under Sec 148A CPC, and Special Leave Petitions (SLP under Art 136). Ensure accurate cause titles, grounds, verification affidavits, and prayer clauses.'
      WHERE name='Midearth Creative Writer';
    `);

    const existingSpaces = this.spaces();
    if (existingSpaces.length > 0) {
      const spaceId = existingSpaces[0].id;
      const corpExists = this.db
        .prepare("SELECT id FROM dots WHERE name='Bharath Corporate & IBC Specialist'")
        .get();
      if (!corpExists) {
        this.createDot(
          spaceId,
          'Bharath Corporate & IBC Specialist',
          'You are Bharath Corporate & IBC Specialist in Bharath Law Chambers. Specialist in Indian corporate and commercial law: Insolvency and Bankruptcy Code (IBC 2016) before NCLT/NCLAT (Section 7, 9, 10 CIRP applications, moratorium u/s 14), Companies Act 2013 (Oppression & Mismanagement u/s 241/242), Arbitration and Conciliation Act 1996 (Section 9 interim measures, Section 11 arbitrator appointments, Section 34 challenges), SEBI regulations, and tax litigation.',
          true,
          true,
        );
      }
    }

    if (!this.spaces().length) {
      const space = this.createSpace(
        'Bharath Law Chambers',
        'Premier Indian Legal AI workspace for litigation, research, and drafting.',
      );
      this.createDot(
        space.id,
        'Bharath Law',
        'You are Bharath Law, Senior Advocate and Chief Legal Counsel in Bharath Law Chambers. Master of Indian Jurisprudence, Constitution of India, Supreme Court of India precedents, and statutory enactments. Advise advocates, corporate counsels, and litigants on case strategy, forum selection, issue framing, legal second opinions, and case merit assessments following the Advocates Act 1961 and Bar Council of India standards.',
        true,
        true,
      );
      this.createDot(
        space.id,
        'Bharath Sanhita Specialist',
        'You are Bharath Sanhita Specialist, authority on Indian Criminal Law in Bharath Law Chambers. Master of the new criminal laws: Bharatiya Nyaya Sanhita (BNS 2023) vs IPC 1860, Bharatiya Nagarik Suraksha Sanhita (BNSS 2023) vs CrPC 1973, and Bharatiya Sakshya Adhiniyam (BSA 2023) vs Evidence Act. Advise on FIR analysis, Section 35 BNSS arrest notices, remand, regular bail (Sec 480 BNSS), anticipatory bail (Sec 482 BNSS), FIR quashing (Sec 528 BNSS / Art 226), electronic evidence u/s 63 BSA, PMLA, NDPS, and POCSO.',
        true,
        true,
      );
      this.createDot(
        space.id,
        'Bharath Civil & Constitutional Litigator',
        'You are Bharath Civil & Constitutional Litigator in Bharath Law Chambers. Specialist in Constitutional Law, Supreme Court of India and High Court extraordinary writ jurisdiction under Article 32 and Article 226 (Habeas Corpus, Mandamus, Certiorari, Prohibition, Quo Warranto), Code of Civil Procedure (CPC 1908), Injunctions (Order 39), Indian Contract Act 1872, Specific Relief Act, Transfer of Property Act, Limitation Act, and Matrimonial Laws.',
        true,
        true,
      );
      this.createDot(
        space.id,
        'Bharath Legal Drafter',
        'You are Bharath Legal Drafter in Bharath Law Chambers. Expert in drafting court-ready Indian legal documents: Anticipatory Bail applications under Section 482 BNSS, Section 138 NI Act statutory demand notices, Section 80 CPC notices, Vakalatnama, Plaints, Written Statements, Affidavits, Caveat petitions under Sec 148A CPC, and Special Leave Petitions (SLP under Art 136). Ensure accurate cause titles, grounds, verification affidavits, and prayer clauses.',
        true,
        true,
      );
      this.createDot(
        space.id,
        'Bharath Corporate & IBC Specialist',
        'You are Bharath Corporate & IBC Specialist in Bharath Law Chambers. Specialist in Indian corporate and commercial law: Insolvency and Bankruptcy Code (IBC 2016) before NCLT/NCLAT (Section 7, 9, 10 CIRP applications, moratorium u/s 14), Companies Act 2013 (Oppression & Mismanagement u/s 241/242), Arbitration and Conciliation Act 1996 (Section 9 interim measures, Section 11 arbitrator appointments, Section 34 challenges), SEBI regulations, and tax litigation.',
        true,
        true,
      );
    }
  }
  close() {
    this.db.close();
  }
  spaces(): Space[] {
    return this.db
      .prepare('SELECT * FROM spaces ORDER BY createdAt')
      .all() as unknown as Space[];
  }
  createSpace(name: string, description: string): Space {
    const space = {
      id: randomUUID(),
      name,
      description,
      createdAt: Date.now(),
    };
    this.db
      .prepare('INSERT INTO spaces VALUES (?, ?, ?, ?)')
      .run(space.id, name, description, space.createdAt);
    return space;
  }
  dots(): Dot[] {
    return this.db
      .prepare('SELECT * FROM dots ORDER BY createdAt')
      .all()
      .map((row) => ({
        ...row,
        spaceIds: this.db
          .prepare(
            'SELECT spaceId FROM dot_spaces WHERE dotId=? ORDER BY spaceId',
          )
          .all(String(row.id))
          .map((grant) => String(grant.spaceId)),
        researchAllowed: !!row.researchAllowed,
        memoryAllowed: !!row.memoryAllowed,
        skillDeliveryEnabled: !!row.skillDeliveryEnabled,
      })) as unknown as Dot[];
  }
  dot(id: string) {
    return this.dots().find((dot) => dot.id === id);
  }
  createDot(
    spaceId: string,
    name: string,
    instructions: string,
    researchAllowed: boolean,
    memoryAllowed: boolean,
    spaceIds: string[] = [spaceId],
    learningContainerId: string | null = null,
    skillDeliveryEnabled = false,
  ): Dot {
    this.validateSpaceAccess(spaceId, spaceIds);
    validateLearningSettings(learningContainerId, skillDeliveryEnabled);
    const dot: Dot = {
      id: randomUUID(),
      spaceId,
      spaceIds: [...new Set(spaceIds)].sort(),
      name,
      instructions,
      researchAllowed,
      memoryAllowed,
      learningContainerId,
      skillDeliveryEnabled,
      createdAt: Date.now(),
    };
    this.db.exec('BEGIN');
    try {
      this.db
        .prepare(
          'INSERT INTO dots (id, spaceId, name, instructions, researchAllowed, memoryAllowed, createdAt, learningContainerId, skillDeliveryEnabled) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          dot.id,
          spaceId,
          name,
          instructions,
          +researchAllowed,
          +memoryAllowed,
          dot.createdAt,
          learningContainerId,
          +skillDeliveryEnabled,
        );
      for (const id of dot.spaceIds)
        this.db.prepare('INSERT INTO dot_spaces VALUES (?, ?)').run(dot.id, id);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return dot;
  }
  canAccessSpace(dotId: string, spaceId: string) {
    return !!this.db
      .prepare('SELECT 1 FROM dot_spaces WHERE dotId=? AND spaceId=?')
      .get(dotId, spaceId);
  }
  private validateSpaceAccess(defaultSpace: string, spaceIds: string[]) {
    if (
      !spaceIds.includes(defaultSpace) ||
      spaceIds.some((id) => !this.spaces().some((space) => space.id === id))
    )
      throw new Error('Space access must include a valid default destination.');
  }
  updateDot(
    id: string,
    patch: Pick<
      Dot,
      'name' | 'instructions' | 'researchAllowed' | 'memoryAllowed'
    > & {
      spaceId?: string;
      spaceIds?: string[];
      learningContainerId?: string | null;
      skillDeliveryEnabled?: boolean;
    },
  ): Dot {
    const current = this.dot(id);
    if (!current) throw new Error('Dot not found.');
    const defaultSpace = patch.spaceId ?? current.spaceId;
    const spaceIds = patch.spaceIds ?? current.spaceIds;
    this.validateSpaceAccess(defaultSpace, spaceIds);
    const learningContainerId =
      patch.learningContainerId === undefined
        ? (current.learningContainerId ?? null)
        : patch.learningContainerId;
    const skillDeliveryEnabled =
      patch.skillDeliveryEnabled ?? current.skillDeliveryEnabled ?? false;
    validateLearningSettings(learningContainerId, skillDeliveryEnabled);
    this.db.exec('BEGIN');
    try {
      this.db
        .prepare(
          'UPDATE dots SET name=?, instructions=?, researchAllowed=?, memoryAllowed=?, learningContainerId=?, skillDeliveryEnabled=? WHERE id=?',
        )
        .run(
          patch.name,
          patch.instructions,
          +patch.researchAllowed,
          +patch.memoryAllowed,
          learningContainerId,
          +skillDeliveryEnabled,
          id,
        );
      this.db
        .prepare('UPDATE dots SET spaceId=? WHERE id=?')
        .run(defaultSpace, id);
      this.db.prepare('DELETE FROM dot_spaces WHERE dotId=?').run(id);
      for (const space of new Set(spaceIds))
        this.db.prepare('INSERT INTO dot_spaces VALUES (?, ?)').run(id, space);
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return this.dot(id)!;
  }
  conversations(): Conversation[] {
    return this.db
      .prepare(
        'SELECT * FROM thread_bindings WHERE ownerId=? ORDER BY createdAt DESC',
      )
      .all(this.ownerId) as unknown as Conversation[];
  }
  bindThread(id: string, dotId: string, title: string): Conversation {
    const dot = this.dot(dotId);
    if (!dot) throw new Error('Dot not found.');
    const value: Conversation = {
      id,
      dotId,
      ownerId: this.ownerId,
      title,
      createdAt: Date.now(),
      learningContainerId: dot.learningContainerId ?? null,
    };
    this.db
      .prepare(
        'INSERT INTO thread_bindings (id, dotId, ownerId, title, createdAt, learningContainerId) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        id,
        dotId,
        this.ownerId,
        title,
        value.createdAt,
        value.learningContainerId ?? null,
      );
    return value;
  }
  addMessage(threadId: string, role: string, content: string) {
    const id = randomUUID();
    this.db
      .prepare('INSERT INTO thread_messages VALUES (?, ?, ?, ?, ?)')
      .run(id, threadId, role, content, Date.now());
    return { id, threadId, role, content };
  }
  threadMessages(threadId: string): Array<{ role: string; content: string }> {
    return (
      (this.db
        .prepare(
          'SELECT role, content FROM thread_messages WHERE threadId=? ORDER BY createdAt ASC',
        )
        .all(threadId) as unknown as Array<{ role: string; content: string }>) || []
    );
  }
  requireThread(id: string, dotId?: string): Conversation {
    const thread = this.conversations().find((thread) => thread.id === id);
    if (!thread || (dotId && thread.dotId !== dotId))
      throw new Error('Conversation does not belong to this Dot and owner.');
    return thread;
  }
  bindTask(taskId: string, threadId: string) {
    this.requireThread(threadId);
    this.db
      .prepare('INSERT INTO task_threads VALUES (?, ?)')
      .run(taskId, threadId);
  }
  taskThread(taskId: string): string | undefined {
    const row = this.db
      .prepare('SELECT threadId FROM task_threads WHERE taskId=?')
      .get(taskId);
    return typeof row?.threadId === 'string' ? row.threadId : undefined;
  }
  calls(threadId?: string): CallReceipt[] {
    if (threadId) this.requireThread(threadId);
    return this.db
      .prepare(
        `SELECT * FROM calls ${threadId ? 'WHERE threadId=?' : ''} ORDER BY startedAt DESC`,
      )
      .all(...(threadId ? [threadId] : [])) as unknown as CallReceipt[];
  }
  createCall(threadId: string): CallReceipt {
    this.requireThread(threadId);
    const call: CallReceipt = {
      id: randomUUID(),
      threadId,
      startedAt: Date.now(),
      endedAt: null,
      status: 'connecting',
      transcript: '',
      error: null,
    };
    this.db
      .prepare(
        'INSERT INTO calls(id, threadId, startedAt, endedAt, status, transcript, error) VALUES (?, ?, ?, NULL, ?, ?, NULL)',
      )
      .run(call.id, threadId, call.startedAt, call.status, '');
    return call;
  }
  call(id: string): CallReceipt {
    const call = this.calls().find((call) => call.id === id);
    if (!call) throw new Error('Call not found.');
    this.requireThread(call.threadId);
    return call;
  }
  setCall(
    id: string,
    status: CallReceipt['status'],
    transcript: string,
    error: string | null = null,
  ) {
    const call = this.call(id);
    if (call.endedAt) return call;
    this.db
      .prepare(
        'UPDATE calls SET status=?, transcript=?, error=?, endedAt=? WHERE id=?',
      )
      .run(
        status,
        transcript,
        error,
        status === 'ended' || status === 'failed' ? Date.now() : null,
        id,
      );
    return this.call(id);
  }
  saveLateTranscript(id: string, transcript: string) {
    this.call(id);
    return (
      this.db
        .prepare(
          "UPDATE calls SET transcript=? WHERE id=? AND transcript='' AND endedAt IS NOT NULL",
        )
        .run(transcript, id).changes > 0
    );
  }
  anchorCall(id: string, anchor: string | undefined) {
    this.call(id);
    this.db
      .prepare('UPDATE calls SET anchorMessageId=? WHERE id=?')
      .run(anchor ?? null, id);
  }
  setCallError(id: string, error: string | null) {
    this.call(id);
    this.db.prepare('UPDATE calls SET error=? WHERE id=?').run(error, id);
  }
  saveCapture(threadId: string, value: unknown) {
    this.requireThread(threadId);
    this.db
      .prepare(
        'INSERT INTO captures VALUES (?, ?) ON CONFLICT(threadId) DO UPDATE SET value=excluded.value',
      )
      .run(threadId, JSON.stringify(value));
  }
  capture(threadId: string): unknown {
    this.requireThread(threadId);
    const row = this.db
      .prepare('SELECT value FROM captures WHERE threadId=?')
      .get(threadId);
    return typeof row?.value === 'string' ? JSON.parse(row.value) : null;
  }
}
