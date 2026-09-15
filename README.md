# Turing

A dark, single-page product site for **Turing**, a conversational AI. Zero runtime dependencies — plain Node.js.

## Run

```bash
node server.js          # http://localhost:3000
PORT=8080 node server.js
```

## Pages

| Route | What |
|---|---|
| `/` | Full-screen hero: copy + product video, with a "Frequently asked questions" section below |
| `/research` | Research notes (all dated 14/09/2026) with animated "load more" |
| `/docs` | Working documentation; API access marked "Coming soon" |
| `/pricing` | Free (live) + Maker / Expert / Core / Enterprise (coming soon) |
| `/status` | Live service status with editable 90-day history |
| `/support` | Contact form → lands in the admin panel |
| `/login` `/register` `/reset` `/recovery` | Full auth flow with Resend email |
| `/privacy` `/terms` | Legal pages |
| `/admin1042024` | Admin panel (no link anywhere) |
| anything else | Animated 404 |

## Admin

- URL: `/admin1042024` (intentionally unlinked)
- User: `genisguixa` — password: `2011824` (hashed with scrypt in `data/db.json`)
- Manage support inbox (reply by email when Resend is configured), edit all 90 days of status history per service, publish a site-wide announcement, and flip: maintenance mode, block logins, block registrations.

## Email (Resend)

Put your key in `config.json`:

```json
{
  "resend_api_key": "re_xxx",
  "resend_from": "Turing <you@yourdomain.com>"
}
```

- **Register** → welcome email
- **Reset password** → link to `/recovery?token=…` (24 h validity)
- **Admin support reply** → emailed to the user

Without a key the site still works; reset tells you delivery isn't configured yet.

## Files

- `server.js` — HTTP server, JSON API, sessions (scrypt + cookie), Resend
- `config.json` — email config (not served publicly)
- `data/content.js` — research posts + docs content
- `data/db.json` — created on first run (users, support, status, site flags, sessions)
- `public/` — SPA (`index.html`, `app.css`, `app.js`) and admin (`admin.html`, `admin.css`, `admin.js`)
