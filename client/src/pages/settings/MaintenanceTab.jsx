import React from "react";
import BackupSettingsTab from "./BackupSettingsTab";
import DatabaseHealthSection from "./DatabaseHealthSection";
import SystemDiagnosticsSection from "./SystemDiagnosticsSection";

export default function MaintenanceTab() {
  return (
    <div className="space-y-6">
      <BackupSettingsTab />
      <SystemDiagnosticsSection />
      <DatabaseHealthSection />
    </div>
  );
}
