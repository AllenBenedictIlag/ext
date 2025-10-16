import { getPool } from "@/lib/database";
import type { ThemeChoice, DateRangeChoice, UserSettings } from "@/types/settings";

type StoredPreferencesRow = {
  admin_id: number;
  theme: ThemeChoice;
  default_date_range: DateRangeChoice;
  created_at: string;
  updated_at: string;
};

let ensured = false;

async function ensureTable() {
  if (ensured) return;
  const pool = getPool();
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_settings (
      admin_id INT NOT NULL PRIMARY KEY,
      theme ENUM('LIGHT','DARK','SYSTEM') NOT NULL DEFAULT 'SYSTEM',
      default_date_range ENUM('LAST_7','LAST_30','LAST_90','LAST_365') NOT NULL DEFAULT 'LAST_30',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      CONSTRAINT fk_admin_settings_admin FOREIGN KEY (admin_id) REFERENCES admins (id) ON DELETE CASCADE
    )
  `);
  try {
    await pool.query(`
      ALTER TABLE admin_settings
      MODIFY default_date_range ENUM('LAST_7','LAST_30','LAST_90','LAST_365') NOT NULL DEFAULT 'LAST_30'
    `);
  } catch {
    // ignore if already in desired state
  }
  ensured = true;
}

export async function readPreferences(adminId: number): Promise<UserSettings | null> {
  await ensureTable();
  const pool = getPool();
  const [rows] = await pool.query(
    `
      SELECT admin_id, theme, default_date_range, created_at, updated_at
        FROM admin_settings
       WHERE admin_id = ?
       LIMIT 1
    `,
    [adminId]
  );

  if (!Array.isArray(rows) || !rows[0]) {
    return null;
  }

  const row = rows[0] as StoredPreferencesRow;
  return {
    adminId: row.admin_id,
    theme: row.theme,
    defaultDateRange: row.default_date_range,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function upsertPreferences(
  adminId: number,
  prefs: Pick<UserSettings, "theme" | "defaultDateRange">
) {
  await ensureTable();
  const pool = getPool();
  await pool.execute(
    `
      INSERT INTO admin_settings (admin_id, theme, default_date_range)
      VALUES (?, ?, ?)
      ON DUPLICATE KEY UPDATE
        theme = VALUES(theme),
        default_date_range = VALUES(default_date_range)
    `,
    [adminId, prefs.theme, prefs.defaultDateRange]
  );
}
