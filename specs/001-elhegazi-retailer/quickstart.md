# Quickstart: ElHegazi Retailer V1

## Prerequisites

- **Node.js** 20.x LTS
- **Windows 10** 64-bit (for Electron development)
- **Git** installed
- **npm** or **yarn**

## Development Setup

### 1. Clone & Install

```bash
git clone <repository-url>
cd elhegazi

# Install root dependencies (Electron)
npm install

# Install server dependencies
cd server && npm install && cd ..

# Install client dependencies
cd client && npm install && cd ..

# Rebuild native modules for Electron
npx electron-rebuild
```

### 2. Environment Setup

```bash
# Server
cp server/.env.example server/.env
# Edit server/.env:
#   NODE_ENV=development
#   PORT=5000
#   HOST=127.0.0.1
#   JWT_SECRET=<generate-random-64-chars>

# Client
cp client/.env.example client/.env
# Edit client/.env:
#   VITE_API_URL=http://127.0.0.1:5000
```

### 3. Run in Development

```bash
# Terminal 1: Start Express server (auto-restarts on changes)
cd server && npm run dev

# Terminal 2: Start Vite dev server (HMR)
cd client && npm run dev

# Terminal 3: Start Electron (connects to Vite dev server)
npm run electron:dev
```

Or use the combined script:
```bash
npm run dev  # Runs all three concurrently
```

### 4. Database

SQLite database is created automatically on first run at:
- **Dev**: `./data/elhegazi.db`
- **Production**: `%APPDATA%/ElHegazi/elhegazi.db`

Migrations run automatically on startup via `dbManager.js`.

### 5. First Run

1. App opens to Setup Wizard
2. Complete 5 steps: License → Company → Invoices → Admin Account → Defaults
3. Log in with admin credentials
4. Start using POS

## Build for Production

```bash
# Build React client
cd client && npm run build

# Build Electron installer (NSIS)
npm run build:win
# Output: dist/ElHegazi Retailer Setup.exe
```

## Key Development Commands

| Command | Description |
|---------|-------------|
| `npm run dev` | Start all (Express + Vite + Electron) |
| `npm run dev:server` | Express only |
| `npm run dev:client` | Vite only |
| `npm run electron:dev` | Electron only |
| `npm run build:win` | Build Windows installer |
| `npm run test` | Run all tests |
| `npm run test:unit` | Unit tests (Jest) |
| `npm run test:e2e` | E2E tests (Playwright) |
| `npm run lint` | ESLint + Prettier check |
| `npm run seed` | Seed development data |

## Currency Convention

All monetary values in the codebase are **integers in the smallest unit**:
- `5000` = 50.00 SAR (halala)
- `12550` = 125.50 SAR

Use `currencyMath.js` for all arithmetic. Use `CurrencyDisplay` component for rendering.

## RTL Convention

- `document.documentElement.dir = 'rtl'` is set globally
- Use Tailwind logical properties: `ms-*` (margin-start), `me-*` (margin-end), `ps-*`, `pe-*`
- Arabic is the primary language — `ar.json` is always loaded first
- All new UI text must have Arabic translation before English
