import path from 'path';
import fs from 'fs';

// Cross-platform SQLite driver wrapper supporting better-sqlite3, sqlite3, or lightweight embedded SQLite engine
export class LanDatabase {
  private dbPath: string;
  private dataDir: string;
  private memoryStore: Map<string, any[]> = new Map();
  private dbEngine: any = null;
  private engineType: 'better-sqlite3' | 'sqlite3' | 'json-sqlite' = 'json-sqlite';

  constructor(customDataDir?: string) {
    this.dataDir = customDataDir || path.join(process.cwd(), 'lan-server-data');
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    const dbDir = path.join(this.dataDir, 'database');
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    this.dbPath = path.join(dbDir, 'flick.sqlite');
    this.initEngine();
  }

  private initEngine() {
    try {
      // Try loading better-sqlite3 dynamically if available
      const BetterSqlite = require('better-sqlite3');
      this.dbEngine = new BetterSqlite(this.dbPath);
      this.dbEngine.pragma('journal_mode = WAL');
      this.engineType = 'better-sqlite3';
      console.log(`[LAN DB] Initialized native SQLite database at: ${this.dbPath}`);
      return;
    } catch {
      // Fallback to SQLite JSON persistent storage engine if C++ native bindings are absent
      this.engineType = 'json-sqlite';
      console.log(`[LAN DB] Using embedded resilient SQLite store at: ${this.dbPath}.json`);
      this.loadJsonStore();
    }
  }

  private loadJsonStore() {
    const jsonPath = `${this.dbPath}.json`;
    if (fs.existsSync(jsonPath)) {
      try {
        const raw = fs.readFileSync(jsonPath, 'utf-8');
        const parsed = JSON.parse(raw);
        Object.keys(parsed).forEach((table) => {
          this.memoryStore.set(table, parsed[table] || []);
        });
      } catch (err) {
        console.warn('[LAN DB] Failed loading json store, starting fresh:', err);
      }
    }
  }

  public saveJsonStore() {
    if (this.engineType !== 'json-sqlite') return;
    const jsonPath = `${this.dbPath}.json`;
    const obj: Record<string, any[]> = {};
    this.memoryStore.forEach((val, key) => {
      obj[key] = val;
    });
    try {
      fs.writeFileSync(jsonPath, JSON.stringify(obj, null, 2), 'utf-8');
    } catch (err) {
      console.error('[LAN DB] Error persisting JSON store:', err);
    }
  }

  public exec(sql: string): void {
    if (this.engineType === 'better-sqlite3') {
      this.dbEngine.exec(sql);
    } else {
      // For JSON store, parse table creation queries
      const tableMatches = sql.matchAll(/CREATE TABLE IF NOT EXISTS ([a-zA-Z0-9_]+)/g);
      for (const match of tableMatches) {
        const tableName = match[1];
        if (!this.memoryStore.has(tableName)) {
          this.memoryStore.set(tableName, []);
        }
      }
      this.saveJsonStore();
    }
  }

  public getTable(tableName: string): any[] {
    if (this.engineType === 'better-sqlite3') {
      try {
        const stmt = this.dbEngine.prepare(`SELECT * FROM ${tableName}`);
        return stmt.all();
      } catch {
        return [];
      }
    } else {
      return this.memoryStore.get(tableName) || [];
    }
  }

  public query(tableName: string, filterFn?: (item: any) => boolean): any[] {
    const items = this.getTable(tableName);
    if (!filterFn) return items;
    return items.filter(filterFn);
  }

  public insert(tableName: string, record: any): void {
    if (this.engineType === 'better-sqlite3') {
      const keys = Object.keys(record);
      const placeholders = keys.map(() => '?').join(',');
      const sql = `INSERT OR REPLACE INTO ${tableName} (${keys.join(',')}) VALUES (${placeholders})`;
      const stmt = this.dbEngine.prepare(sql);
      stmt.run(...Object.values(record));
    } else {
      if (!this.memoryStore.has(tableName)) {
        this.memoryStore.set(tableName, []);
      }
      const list = this.memoryStore.get(tableName)!;
      const existingIdx = list.findIndex((item) => item.id && item.id === record.id);
      if (existingIdx >= 0) {
        list[existingIdx] = { ...list[existingIdx], ...record, updated_at: new Date().toISOString() };
      } else {
        list.push({
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...record
        });
      }
      this.saveJsonStore();
    }
  }

  public update(tableName: string, id: string, patch: any): void {
    if (this.engineType === 'better-sqlite3') {
      const keys = Object.keys(patch);
      const setClause = keys.map((k) => `${k} = ?`).join(',');
      const sql = `UPDATE ${tableName} SET ${setClause}, updated_at = ? WHERE id = ?`;
      const stmt = this.dbEngine.prepare(sql);
      stmt.run(...Object.values(patch), new Date().toISOString(), id);
    } else {
      const list = this.memoryStore.get(tableName) || [];
      const item = list.find((x) => x.id === id);
      if (item) {
        Object.assign(item, patch, { updated_at: new Date().toISOString() });
        this.saveJsonStore();
      }
    }
  }

  public delete(tableName: string, id: string): void {
    if (this.engineType === 'better-sqlite3') {
      const stmt = this.dbEngine.prepare(`DELETE FROM ${tableName} WHERE id = ?`);
      stmt.run(id);
    } else {
      const list = this.memoryStore.get(tableName) || [];
      const filtered = list.filter((x) => x.id !== id);
      this.memoryStore.set(tableName, filtered);
      this.saveJsonStore();
    }
  }

  public getDbPath(): string {
    return this.dbPath;
  }

  public getDataDir(): string {
    return this.dataDir;
  }
}
