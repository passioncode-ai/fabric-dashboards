// #region bug-store — docs: docs/BUGS.md#the-journal
import os from 'node:os';
import { readBugs, record, writeBugs, type Bug, type BugInput } from '../core/bugs';

/** FD-263: the journal in the app's data folder: in memory, written at once for a new bug and within a second for a
 *  repeat. A write keeps the `issue` an MCP server recorded meanwhile. Never throws: a journal that cannot be written
 *  must not take the app down with the bug it records. */
export class BugStore {
  private bugs: Bug[];
  private timer: NodeJS.Timeout | null = null;
  constructor(private readonly dir: string, private readonly version: string, private readonly log: (line: string) => void, private readonly now: () => Date = () => new Date()) {
    this.bugs = readBugs(dir);
  }

  add(input: BugInput): Bug | null {
    try {
      const r = record(this.bugs, input, { now: this.now().toISOString(), version: this.version, home: os.homedir(), user: os.userInfo().username });
      this.bugs = r.bugs;
      if (r.isNew) { this.log(`bugs: new ${r.bug.fp} ${r.bug.where} ${r.bug.kind} ${r.bug.name}`); this.flush(); } else this.later();
      return r.bug;
    } catch (error) {
      this.log(`bugs: not recorded: ${(error as Error).message}`);
      return null;
    }
  }

  list(): Bug[] {
    return [...this.bugs].sort((a, b) => (a.lastSeen < b.lastSeen ? 1 : -1));
  }

  private later(): void {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 1000);
    this.timer.unref?.();
  }

  flush(): void {
    try {
      const issues = new Map(readBugs(this.dir).filter((b) => b.issue).map((b) => [b.fp, b.issue!]));
      this.bugs = this.bugs.map((b) => (b.issue || !issues.has(b.fp) ? b : { ...b, issue: issues.get(b.fp) }));
      writeBugs(this.dir, this.bugs);
    } catch (error) {
      this.log(`bugs: not written: ${(error as Error).message}`);
    }
  }
}
// #endregion bug-store
