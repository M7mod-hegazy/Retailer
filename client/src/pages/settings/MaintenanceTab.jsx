import React from "react";
import BackupSettingsTab from "./BackupSettingsTab";

// The data/backup hub. Auto-backup, manual backup, restore, export and
// database-empty all live in BackupSettingsTab, which manages its own state
// via the /api/backup endpoints.
export default function MaintenanceTab() {
  return <BackupSettingsTab />;
}
