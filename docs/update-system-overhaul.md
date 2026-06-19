# Update System Overhaul

## Bugs Found

| ID | Bug | File:Line | Fix |
|----|-----|-----------|-----|
| B1 | `isForceRunAfter=false` → app never restarts after install | `electron/updater.js:62` | `quitAndInstall(true, true)` |
| B2 | Full-screen black overlay blocks app during entire download (minutes) | `UpdatesPage.jsx:642-703` | Only overlay for `installing` phase (1-2s) |
| B3 | `useBlocker` traps user on page during download | `UpdatesPage.jsx:96-106` | Remove entirely |
| B4 | `beforeunload` blocks tab close during download | `UpdatesPage.jsx:109-118` | Remove entirely |
| B5 | Auto-install triggers 1.5s after download without user consent | `UpdatesPage.jsx:127-136` | Remove auto-timer |
| B6 | 1.5s artificial animation delay before `quitAndInstall` | `UpdatesPage.jsx:186-188` | Remove delay |
| B7 | 30s safety timer races with success, silently overrides state | `UpdatesPage.jsx:142-144` | Fire error instead of silent reset |

## Phases

### Phase 1 — Fix Critical Bugs
Files: `electron/updater.js`, `client/src/pages/updates/UpdatesPage.jsx`, `client/src/stores/updateStore.js`

### Phase 2 — Add Manual Download Inside App
Files: `electron/updater.js`, `electron/ipcHandlers.js`, `electron/preload.js`, `client/src/stores/updateStore.js`, `client/src/pages/updates/UpdatesPage.jsx`

### Phase 3 — Global Listeners
Files: `client/src/App.jsx`

### Phase 4 — Verify
Run lint + typecheck + tests
