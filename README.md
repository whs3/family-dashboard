# Family Dashboard

A self-hosted dashboard showing your shared Google Calendar, Google Tasks,
news headlines, and local weather. Runs on one machine on your home network
and is viewable from any browser on that network (desktop, tablet, or phone).

## Requirements

- Node.js 18 or newer
- A Google account with a shared family calendar/task list
- A machine on your home network that can stay running (e.g. an old laptop,
  a Raspberry Pi, a NAS, or just a desktop that's usually on)

## 1. Install dependencies

```
npm install
```

## 2. Create Google OAuth credentials

The dashboard needs permission to read your Google Calendar and Google Tasks.
This requires a free Google Cloud project and an OAuth client — a one-time,
~10 minute setup.

1. Go to https://console.cloud.google.com/ and create a new project (any
   name, e.g. "Family Dashboard").
2. In **APIs & Services → Library**, enable:
   - **Google Calendar API**
   - **Google Tasks API**
3. In **APIs & Services → OAuth consent screen**:
   - User type: **External** (or **Internal** if you use Google Workspace).
   - Fill in the required app name/support email fields.
   - Under **Test users**, add the Google account(s) that will use the
     dashboard. (While the app is in "Testing" mode, only test users can
     authorize it — that's fine for personal/family use and avoids Google's
     app review process.)
4. In **APIs & Services → Credentials**, click **Create Credentials → OAuth
   client ID**:
   - Application type: **Web application**
   - Authorized redirect URIs: add
     `http://localhost:3000/auth/google/callback`

     Google no longer allows plain LAN IP addresses (like `192.168.1.50`)
     here — `localhost`/`127.0.0.1` is the one HTTP exception it always
     allows. That's fine: only the *one-time* authorization step needs this
     redirect to work. Every other device just views the already-connected
     dashboard, with no Google redirect involved. See step 5 below.
   - Click **Create** and copy the **Client ID** and **Client Secret**.

## 3. Configure the app

```
cp .env.example .env
```

Edit `.env`:

```
PORT=3000
BASE_URL=http://localhost:3000
GOOGLE_CLIENT_ID=<your client id>
GOOGLE_CLIENT_SECRET=<your client secret>
```

`BASE_URL` must exactly match the redirect URI you registered above
(including `http://`, no trailing slash) — leave it as `localhost` even
though the dashboard itself will be viewed at the server's LAN IP from
other devices (see step 5).

## 4. Run it

```
npm start
```

You should see:

```
Family dashboard running on http://0.0.0.0:3000
```

News (RSS) and Weather (Open-Meteo) require no setup or API keys and work
immediately.

## 5. Connect Google (one-time, done on the server itself)

Because the redirect URI is `localhost`, the "Connect Google" step must be
clicked from a browser running **on the server machine** — not from a
phone or another computer on the network:

- **Server has a desktop/monitor**: open a browser on it and go to
  `http://localhost:3000`, then click **Connect Google Calendar** (or
  **Tasks**). Sign in with the shared family Google account and grant
  access.
- **Server is headless (e.g. a Raspberry Pi with no monitor)**: from your
  own laptop, open an SSH tunnel to it first:

  ```
  ssh -L 3000:localhost:3000 <user>@<server-LAN-IP>
  ```

  Then, while that tunnel is open, visit `http://localhost:3000` **in your
  laptop's own browser** and click Connect there — your laptop's
  `localhost:3000` is being forwarded to the server, so Google's redirect
  back to `localhost` lands correctly on your end of the tunnel, and the
  resulting token is saved on the server. You only need to do this once;
  the tunnel isn't needed again afterward.

Once connected, the refresh token is saved in `server/data/token.json` on
the server, and the dashboard works from **any** device on your network —
phones, tablets, other computers — by visiting:

```
http://<the-server's-LAN-IP-or-hostname>:3000
```

No further Google sign-in is needed on those devices; they're just viewing
data the server already fetched.

## Optional: a friendlier name than an IP address

The `localhost` requirement above is only for the Google OAuth redirect —
it has no bearing on how you access the dashboard day-to-day. If typing an
IP address to view the dashboard is annoying, the easiest fix is **mDNS**
(the `.local` hostnames used by AirPlay/Chromecast-style device discovery),
which needs no router configuration or domain registration:

- **Linux**: install `avahi-daemon` (often preinstalled on Raspberry Pi OS)
  and the machine is reachable at `http://<hostname>.local:3000`.
- **Windows**: install Bonjour (bundled with iTunes/some HP software) or
  just use the IP; Windows doesn't advertise `.local` names itself.
- **Most phones/tablets and modern browsers** resolve `.local` names
  natively.

This is unrelated to the OAuth setup above — keep `BASE_URL` and the
Google redirect URI as `localhost` regardless of what hostname you use to
*view* the dashboard.

## Adjusting settings

Click the gear icon in the top right of the dashboard to:

- Change the refresh interval (default 15 minutes, 1–1440 minutes allowed).
  This updates both how often the server re-fetches data and how often the
  browser polls it, and takes effect immediately.
- See Google connection status, or disconnect the account.

To change the weather location, news sources, or how many calendar
events/tasks are shown, edit `server/data/config.json` directly and restart
the app (or wait for the next scheduled refresh for news feed changes,
which don't require a restart — only `refreshIntervalMinutes` is editable
live via the UI).

`server/data/config.json` is git-ignored (it holds your home location), so
on a fresh clone copy the example to create it first:

```bash
cp server/data/config.example.json server/data/config.json
```

## Keeping it running (Linux, systemd)

To have the dashboard start on boot and restart if it crashes, create
`/etc/systemd/system/family-dashboard.service`:

```ini
[Unit]
Description=Family Dashboard
After=network.target

[Service]
Type=simple
User=<your-username>
WorkingDirectory=/path/to/family-dashboard
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
EnvironmentFile=/path/to/family-dashboard/.env

[Install]
WantedBy=multi-user.target
```

Then:

```
sudo systemctl daemon-reload
sudo systemctl enable --now family-dashboard
```

## Notes

- This app is designed to run on a trusted home network with no built-in
  login — anyone on the network can view it and, once write features are
  added later, edit it. Don't expose the port to the internet without adding
  authentication first.
- The Google refresh token is stored unencrypted in
  `server/data/token.json` (git-ignored). Treat that file like a password.
- If a widget shows an error, the others keep working — each data source
  (Calendar, Tasks, News, Weather) fails independently and the footer
  reports which one had trouble on the last refresh.
- Display-only for now. Adding/editing calendar events and tasks from the
  UI is planned as a future enhancement; the OAuth scopes are currently
  read-only, so that later step will require re-authorizing with broader
  scopes.
