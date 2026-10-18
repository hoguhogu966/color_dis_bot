import { DatabaseSync } from "node:sqlite";
import { config } from "./config.js";

export interface PanelRole {
  label: string;
  roleId: string;
}

interface PanelRoleRow {
  label: string;
  role_id: string;
}

const db = new DatabaseSync(config.dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS panel_roles (
    message_id TEXT NOT NULL,
    label      TEXT NOT NULL,
    role_id    TEXT NOT NULL,
    PRIMARY KEY (message_id, role_id)
  )
`);

export function getPanelRoles(messageId: string): PanelRole[] {
  const rows = db
    .prepare("SELECT label, role_id FROM panel_roles WHERE message_id = ?")
    .all(messageId) as unknown as PanelRoleRow[];

  return rows.map((row) => ({ label: row.label, roleId: row.role_id }));
}

export function addPanelRole(messageId: string, role: PanelRole): void {
  db.prepare(
    "INSERT OR REPLACE INTO panel_roles (message_id, label, role_id) VALUES (?, ?, ?)",
  ).run(messageId, role.label, role.roleId);
}

export function setPanelRoles(messageId: string, roles: PanelRole[]): void {
  deletePanel(messageId);
  for (const role of roles) {
    addPanelRole(messageId, role);
  }
}

export function deletePanel(messageId: string): void {
  db.prepare("DELETE FROM panel_roles WHERE message_id = ?").run(messageId);
}
