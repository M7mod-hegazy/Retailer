<!--
SYNC IMPACT REPORT
- Version change: [NEW] 1.0.0
- Modified principles:
  - I. Offline-First & Data Reliability
  - II. Financial Data Integrity
  - III. Arabic-First RTL Interface
  - IV. Functional Modern Frontend
  - V. Intentional & Safe UX
- Added sections: Technology Stack & Constraints, Backup Strategy
- Removed sections: N/A
- Templates requiring updates: ✅ None required for basic setup
- Follow-up TODOs: None
-->

# ElHegazi Retailer Constitution

## Core Principles

### I. Offline-First & Data Reliability
The application MUST work 100% without an internet connection. SQLite WAL (Write-Ahead Logging) mode MUST always be enabled to ensure instant, reliable writes and prevent data corruption.

### II. Financial Data Integrity
All monetary values MUST be stored and computed as integers (representing the smallest currency unit: halala or piastre). NEVER use floating-point numbers for currency to prevent precision loss. An incontrovertible audit log MUST be generated on every mutation of financial data.

### III. Arabic-First RTL Interface
The application UI MUST be Arabic-first and Right-To-Left (RTL). All labels, messages, placeholder text, and system defaults MUST be in Arabic by default. Styling should natively support RTL layouts utilizing Tailwind CSS RTL capabilities.

### IV. Functional Modern Frontend
The React frontend MUST be implemented strictly using functional components and hooks. No class components and absolutely no jQuery are permitted.

### V. Intentional & Safe UX
Every destructive action (e.g., delete, void transaction) MUST require a clear confirmation dialog before execution. This ensures user mistakes are mitigated in a high-stakes retail environment.

## Technology Stack & Constraints

The system MUST adhere to the following technological boundaries:
- **Core Platform**: Electron v29, Node.js v20, Express v4.
- **Frontend**: React v18, Tailwind CSS configured for RTL.
- **Database**: SQLite using the `better-sqlite3` driver.
- **Minimum Target OS**: Windows 10 (64-bit).

## Backup Strategy

Database backups MUST strictly follow a hierarchical chronological structure utilizing `year/month/day/` folders, with exactly one `.db` file per backup instance to ensure clear historical snapshots and easy recovery.

## Governance

This Constitution supersedes all other documentation and dictates all technical implementations for ElHegazi Retailer. Any deviations require formal amendments to this document and corresponding upgrades to related specs. All PRs and code modifications must be reviewed against these non-negotiable principles.

**Version**: 1.0.0 | **Ratified**: 2026-04-19 | **Last Amended**: 2026-04-19
