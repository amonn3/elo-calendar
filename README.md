<p align="center">
  <img src="docs/assets/elo-logo.svg" width="560" alt="elo — your calendars, together" />
</p>

<p align="center">
  <strong>Connect your calendars. See your day. Make room for what matters.</strong>
</p>

<p align="center">
  <a href="https://elo-calendar.vercel.app"><img src="https://img.shields.io/badge/open-elo-7556df?logo=vercel&logoColor=white" alt="Open elo" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-4f7cff" alt="MIT license" /></a>
  <img src="https://img.shields.io/badge/Next.js-React-000000?logo=nextdotjs&logoColor=white" alt="Next.js and React" />
  <img src="https://img.shields.io/badge/React-TypeScript-3178c6?logo=typescript&logoColor=white" alt="React and TypeScript" />
</p>

---

elo is a unified calendar for your Google and Microsoft accounts. Bring personal and work schedules into one place, see where meetings overlap, and manage events in their original calendars.

It focuses on a clear view of your time, with **day, week, month, and agenda** views, a daily summary, and account colors that help you recognize each schedule. The interface is currently in **Portuguese**, with light and dark themes and a responsive layout.

## Features

- **Multiple calendar accounts.** Connect Google and Microsoft accounts individually through OAuth and choose which calendars stay visible.
- **One view of your schedule.** Browse day, week, month, and agenda views, search events, and follow the selected day's timeline.
- **Readable event cards.** Hover over a calendar event or focus it with the keyboard to expand its full title, without moving neighboring events.
- **Conflict detection.** Spot overlapping meetings across accounts and see warnings before saving a new commitment. All-day entries, including holidays, remain visible without triggering conflicts or adding to occupied hours.
- **Event management.** Create, edit, and delete events in the selected source calendar, respecting its write permissions.
- **Recurring events.** Provider queries expand recurring instances and follow pagination when loading schedules.
- **Explicit refresh.** Reload calendars with the refresh button; navigation and saved changes also fetch updated events.
- **Personal accounts and sessions.** Register with email and password, sign in, and revoke your session by signing out.
- **Light and dark themes.** Your theme preference is saved in your browser when storage is available.

## Try it now

**[Open elo →](https://elo-calendar.vercel.app)**

1. Select **Criar conta** to register, or sign in with your existing elo account.
2. Click **Conectar conta** and choose Google or Microsoft when the provider is available.
3. Authorize a calendar account and repeat for any other accounts you want to connect.
4. Toggle calendar visibility, choose a view, or search for an event.
5. Click a time slot to create an event, or select an existing event to view its details and available actions.

The public version follows `main` through Vercel's Git integration. Registration and login are available; calendar connections require the corresponding provider's OAuth credentials to be configured by the deployment owner.

## How it works

```text
Google Calendar ──┐
                 ├──► elo server ──► Unified calendar
Microsoft Graph ─┘         │                │
                           │                └──► Event changes
                           │                         │
                           └──── Source calendar ◄───┘
```

The Next.js server authenticates each request and queries the calendars authorized by the signed-in user. Events are read from the providers rather than stored in browser localStorage. Event changes are sent back to the calendar that owns them.

Provider credentials are encrypted on the server with **AES-256-GCM**. Passwords use **scrypt** with individual salts. The browser receives an **HttpOnly session cookie**, while provider tokens remain on the server. OAuth uses PKCE and replay protection.

Local development uses SQLite; production uses PostgreSQL. Calendar times are displayed in **Fortaleza time (GMT−3)**.

For configuration, OAuth callbacks, and deployment details, see the [setup guide](docs/SETUP.md) (in Portuguese).

## Run locally

You need **Node.js 22.13 or later within the supported 22–24 releases** and npm. Production uses Node.js 24.x; the supported range is declared in [`package.json`](package.json).

```bash
git clone https://github.com/amonn3/elo-calendar.git
cd elo-calendar
npm ci
cp .env.example .env.local
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

Save the generated value as `TOKEN_ENCRYPTION_KEY` in `.env.local`, then start the app:

```bash
npm run dev
```

Open **http://127.0.0.1:5173** and create your own account. SQLite is created automatically at `.data/elo.sqlite`. No user is created in advance and there is no default password.

Registration, login, and logout work locally without external services. Google and Microsoft connections become available after you configure their OAuth credentials in `.env.local`. Keep the encryption key unchanged to preserve access to previously connected accounts.

```bash
npm test              # regression tests
npm run typecheck     # TypeScript validation
npm run lint          # ESLint checks
npm run build         # production build
npm run start         # run the production build locally
```

With a local server running and Chrome installed, you can also run:

```bash
npm test -- --browser
```

The optional browser test creates a temporary QA user, checks registration, login, the empty calendar, theme persistence, logout, and mobile layout, then removes that user. Screenshots are saved in `outputs/`, outside Git. Set `ELO_CHROME_PATH` to use a different Chrome executable.

## Deploy to Vercel

The production app is hosted at **https://elo-calendar.vercel.app**, backed by Neon PostgreSQL. Vercel's native Git integration deploys updates from `main`.

For your own deployment, configure a PostgreSQL database, `APP_URL`, and `TOKEN_ENCRYPTION_KEY`. Add Google and Microsoft OAuth credentials to enable those connections. The full variable list and callback URLs are in the [setup guide](docs/SETUP.md); [`.env.example`](.env.example) documents the local configuration.

With the target database configured in your environment, apply the schema before serving production requests:

```bash
npm run db:migrate
```

Production requires PostgreSQL; the development SQLite file is not used on Vercel. `.env.local`, `.data/`, and `.vercel/` are excluded from version control.

The [CI template](docs/workflows/ci.yml) and [deployment template](docs/workflows/deploy.yml) are reference files under `docs/workflows/`, not active GitHub Actions workflows. The current production deployment uses the native Vercel integration.

## Known limitations

- **Portuguese interface.** English interface translations are not available in this version.
- **Fixed display time zone.** Times are shown in Fortaleza time (GMT−3).
- **All-day and multi-day editing.** These events are displayed, but must be changed in the source provider. All-day entries are excluded from meeting conflicts and occupied hours.
- **Read-only calendars.** Calendars without write permission can be viewed but cannot be edited through elo.
- **Original calendar ownership.** Existing events stay in their source calendar. To move one, recreate it in the destination calendar.
- **Refresh-based updates.** Calendar updates happen on navigation, saved changes, or manual refresh. There is no real-time webhook synchronization.
- **No email verification or password recovery.** These email flows are not implemented yet.
- **Provider validation.** Automated provider tests use simulated responses. Real-account OAuth consent and synchronization need validation after external credentials are configured.
- **Existing lint failures.** The repository currently has lint errors involving React effects and browser-test types; the lint command is not a passing validation gate yet.

## Documentation

The setup guide is currently in Portuguese.

| Document | Contents |
| --- | --- |
| [Setup and deployment](docs/SETUP.md) | Local accounts, PostgreSQL, OAuth, and Vercel configuration |
| [Environment example](.env.example) | Local configuration and provider variables |
| [CI template](docs/workflows/ci.yml) | Reference validation workflow |
| [Deployment template](docs/workflows/deploy.yml) | Reference Vercel deployment workflow |
| [Privacy policy](https://elo-calendar.vercel.app/privacidade) | How the app handles account and calendar data |

## Contributing

[Issues](https://github.com/amonn3/elo-calendar/issues) and pull requests are welcome. For calendar problems, include the view, provider, event duration, and steps to reproduce. Remove private event titles, email addresses, and access credentials from examples and screenshots.

Before submitting a change, run `npm test`, `npm run typecheck`, and `npm run build`. Check `npm run lint` and distinguish existing findings from new ones. Calendar behavior changes should include a regression case that reproduces the issue. Keep unrelated changes in separate, focused commits.

## Author and license

Created by **[amonn3](https://github.com/amonn3)**.

**[MIT](LICENSE)** — you may use, modify, and distribute the code, including commercially, while preserving copyright and license notices. The software is provided without warranty.
