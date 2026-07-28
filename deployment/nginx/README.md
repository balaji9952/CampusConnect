# CampusConnect -- Windows Deployment Guide

## Architecture

```
Browser
   |
   v
Nginx for Windows (port 80)
   |-- /           --> C:/CampusConnect/admin-portal   (static files from disk)
   |-- /api/*      --> http://localhost:3019            (Node.js backend)
   |-- /uploads/*  --> http://localhost:3019            (backend file store)
   |-- /scan/*     --> http://localhost:3019            (QR redirect page)
   |-- /health     --> http://localhost:3019            (health check)
   |-- /api-docs/* --> http://localhost:3019            (Swagger UI)
   `-- /socket.io/--> http://localhost:3019            (Socket.IO WebSocket)
```

---

## Prerequisites

| Software | Version | Download |
|---|---|---|
| Node.js | 20 LTS or later | https://nodejs.org/en/download |
| Nginx for Windows | 1.26 stable | https://nginx.org/en/download.html |
| PM2 (optional) | Latest | `npm install -g pm2` |

> **Note:** Run all commands in an **Administrator PowerShell** or **Administrator Command Prompt**
> unless stated otherwise.

---

## Assumed Folder Structure on the Server

```
C:\
`-- CampusConnect\
    |-- admin-portal\           (admin portal static files)
    |-- backend-api\            (Node.js backend)
    |   |-- dist\               (compiled TypeScript output)
    |   |-- uploads\            (ticket photos + QR images)
    |   `-- .env
    `-- nginx\                  (Nginx installation folder)
        |-- conf\
        |   `-- nginx.conf      (our config, copied here)
        `-- logs\
```

You may use any drive or path. If you change the root, update
`C:/CampusConnect/admin-portal` inside `nginx.conf` to match.

---

## Step 1 -- Install Node.js

1. Download the Windows installer from https://nodejs.org/en/download
2. Run the installer. Accept all defaults.
3. Open a new PowerShell window and verify:

```powershell
node --version
npm --version
```

Expected output: `v20.x.x` and `10.x.x` (or later).

---

## Step 2 -- Install Nginx for Windows

1. Download the latest **stable** Windows ZIP from https://nginx.org/en/download.html
   (e.g. `nginx-1.26.x.zip`)
2. Extract to `C:\nginx`
3. Verify:

```powershell
C:\nginx\nginx.exe -v
```

Expected: `nginx version: nginx/1.26.x`

> Nginx for Windows does NOT install as a Windows Service automatically.
> See **Step 6** for how to run it as a Service using NSSM.

---

## Step 3 -- Deploy the Backend

### 3a. Copy Files

```powershell
# Create the destination folder
New-Item -ItemType Directory -Force -Path "C:\CampusConnect\backend-api"

# Copy the backend-api folder contents to the server
# (from your source, USB, or shared folder)
Copy-Item -Recurse -Force ".\backend-api\*" "C:\CampusConnect\backend-api\"
```

### 3b. Install Dependencies and Build

```powershell
cd C:\CampusConnect\backend-api

npm install --omit=dev

npm run build
```

> `npm run build` compiles TypeScript to `C:\CampusConnect\backend-api\dist\`.
> The backend is started from `dist\index.js`.

### 3c. Configure Environment Variables

```powershell
# Copy the template
Copy-Item .env.example .env

# Open in Notepad to edit
notepad .env
```

Minimum required values in `.env`:

```env
NODE_ENV=production
PORT=3019
DATABASE_URL=sqlserver://HOST;database=DBNAME;user=USER;password=PASSWORD;...
JWT_SECRET=your-at-least-32-character-secret-here
CORS_ORIGIN=
```

> **CORS_ORIGIN**: Leave empty when Nginx serves the frontend on the same
> host -- the browser makes same-origin requests so CORS is not triggered.
> Set it to your domain if the frontend is on a different host.

### 3d. Start the Backend

**Option A -- Direct Node.js (quick test)**

```powershell
cd C:\CampusConnect\backend-api
node dist\index.js
```

Leave this window open. The startup banner confirms the server is running:

```
+----------------------------------------------+
|        CampusConnect API -- Started           |
+----------------------------------------------+
|  Check Environment  : production             |
|  Check Port         : 3019                   |
|  Check CORS Origins : * (all)                |
|  Check Upload Folder: Ready                  |
|  Check Swagger Docs : /api-docs              |
|  Check Health Check : /health                |
+----------------------------------------------+
```

**Option B -- PM2 (recommended for production)**

PM2 is a process manager that keeps Node.js running after you close the window
and restarts it automatically after a crash or server reboot.

```powershell
# Install PM2 globally (only once)
npm install -g pm2

# Install pm2-windows-startup (enables PM2 to survive reboots)
npm install -g pm2-windows-startup
pm2-startup install

# Start the backend via PM2
cd C:\CampusConnect\backend-api
pm2 start ecosystem.config.js --env production

# Save the process list so it restarts on reboot
pm2 save
```

Useful PM2 commands:

```powershell
pm2 list                          # show all processes
pm2 logs campus-connect-api       # live log tail
pm2 restart campus-connect-api    # restart
pm2 stop campus-connect-api       # stop
pm2 delete campus-connect-api     # remove from PM2
```

### 3e. Verify the Backend is Running

```powershell
# Using PowerShell (built-in, no curl needed)
Invoke-WebRequest -Uri http://localhost:3019/health | Select-Object -ExpandProperty Content
```

Expected response:

```json
{"status":"healthy","timestamp":"2026-01-01T00:00:00.000Z","version":"1.0.0"}
```

---

## Step 4 -- Deploy the Admin Portal

```powershell
# Create destination folder
New-Item -ItemType Directory -Force -Path "C:\CampusConnect\admin-portal"

# Copy static files
Copy-Item -Recurse -Force ".\admin-portal\*" "C:\CampusConnect\admin-portal\"
```

No build step is needed. The admin portal is pure static HTML/CSS/JS.

---

## Step 5 -- Configure Nginx

### 5a. Copy the Config File

```powershell
# Replace the default config with ours
Copy-Item -Force ".\deployment\nginx\nginx.conf" "C:\nginx\conf\nginx.conf"
```

### 5b. Edit the Admin Portal Path (if different from default)

Open `C:\nginx\conf\nginx.conf` in Notepad:

```powershell
notepad C:\nginx\conf\nginx.conf
```

Find this line and update the path to match where you put the admin portal:

```nginx
root   C:/CampusConnect/admin-portal;   # <-- UPDATE THIS PATH
```

> Remember: use forward slashes (`/`) not backslashes (`\`).

### 5c. Create the Logs Folder

```powershell
New-Item -ItemType Directory -Force -Path "C:\nginx\logs"
```

### 5d. Test the Configuration

```powershell
cd C:\nginx
.\nginx.exe -t
```

Expected output:

```
nginx: the configuration file C:/nginx/conf/nginx.conf syntax is ok
nginx: configuration file C:/nginx/conf/nginx.conf test is successful
```

If you see errors, fix them before proceeding.

---

## Step 6 -- Start Nginx

### Start

```powershell
cd C:\nginx
.\nginx.exe
```

> Nginx starts in the background. The command returns immediately.
> Check `C:\nginx\logs\error.log` if something seems wrong.

### Test Configuration (without restarting)

```powershell
cd C:\nginx
.\nginx.exe -t
```

### Reload Configuration (apply changes without dropping connections)

```powershell
cd C:\nginx
.\nginx.exe -s reload
```

### Stop Gracefully (finish current requests then stop)

```powershell
cd C:\nginx
.\nginx.exe -s quit
```

### Stop Immediately

```powershell
cd C:\nginx
.\nginx.exe -s stop
```

### Check Whether Nginx is Running

```powershell
Get-Process nginx -ErrorAction SilentlyContinue
```

### Optional -- Run Nginx as a Windows Service using NSSM

NSSM (Non-Sucking Service Manager) lets Nginx run as a proper Windows Service
that starts automatically on boot and restarts on failure.

```powershell
# Download NSSM from https://nssm.cc/download
# Extract nssm.exe to C:\Tools\nssm.exe

# Install Nginx as a service (run once, as Administrator)
C:\Tools\nssm.exe install nginx-campus-connect C:\nginx\nginx.exe

# Start the service
Start-Service nginx-campus-connect

# Set to start automatically on boot
Set-Service nginx-campus-connect -StartupType Automatic
```

To manage the service later:

```powershell
Start-Service   nginx-campus-connect
Stop-Service    nginx-campus-connect
Restart-Service nginx-campus-connect
```

---

## Step 7 -- Configure Backend .env for Production

```env
NODE_ENV=production
PORT=3019

# CORS: empty = allow all origins.
# When Nginx serves the frontend on the same host, CORS is not triggered.
# Set to a domain only if the frontend lives on a different server.
CORS_ORIGIN=

# SQL Server connection string (Prisma format)
DATABASE_URL="sqlserver://HOST;database=DBNAME;user=USER;password=PASS;trustServerCertificate=true"

JWT_SECRET=minimum-32-character-random-string
JWT_ISSUER=CampusConnect
JWT_AUDIENCE=CampusConnectApp
JWT_EXPIRES_IN=24h

APP_NAME="Campus Connect"
COLLEGE_NAME="Your College Name"
COLLEGE_LOGO_URL=file://./assets/college-logo.png
QR_IMAGE_BASE_URL=

GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_ANDROID_CLIENT_ID=your-android-client-id
GOOGLE_ALLOWED_DOMAIN=yourcollegedomain.ac.in
GOOGLE_LOGIN_MODE=popup
```

---

## Adding SSL Later

SSL is **not configured now**. When you are ready:

1. Obtain a certificate using **win-acme** (https://www.win-acme.com/)
   or another Windows-compatible ACME client.
2. Place the certificate files in `C:\nginx\ssl\`:
   - `C:/nginx/ssl/fullchain.pem`
   - `C:/nginx/ssl/privkey.pem`
3. Follow the instructions inside `nginx.conf` under the
   `# Adding SSL Later` comment block.
4. Test and reload:
   ```powershell
   cd C:\nginx
   .\nginx.exe -t
   .\nginx.exe -s reload
   ```

---

## Verification Checklist

Run these checks after completing all steps above.

| # | Check | How to Test | Expected Result |
|---|---|---|---|
| 1 | Backend health | `Invoke-WebRequest http://localhost:3019/health` | `{"status":"healthy"}` |
| 2 | Nginx config valid | `cd C:\nginx && .\nginx.exe -t` | `syntax is ok` |
| 3 | Nginx running | `Get-Process nginx` | Process listed |
| 4 | Admin portal loads | Open `http://localhost` in browser | Login page renders |
| 5 | Admin portal login | Enter credentials and submit | Redirects to dashboard |
| 6 | API routed correctly | Open browser DevTools (F12) > Network; log in; check XHR | Requests go to `/api/auth/login` (not `localhost:3019` directly) |
| 7 | Health via Nginx | Open `http://localhost/health` in browser | `{"status":"healthy"}` |
| 8 | Swagger docs | Open `http://localhost/api-docs` | Swagger UI loads |
| 9 | Uploads work | Upload a ticket photo; open the ticket | Photo renders (via `/uploads/`) |
| 10 | QR scan page | Open `http://localhost/scan/QR-001` | "Use the Campus Connect App" page |
| 11 | Socket.IO | Open admin portal; open DevTools > Network > WS | Entry with `101 Switching Protocols` |
| 12 | Login page direct | Open `http://localhost/login.html` | Login page renders |
| 13 | Blocked extensions | Try `http://localhost/backend-api/.env` | 403 or 404 (blocked by Nginx) |

---

## Rollback Procedure

The only deployment-layer files changed were:

- `deployment/nginx/nginx.conf`
- `deployment/nginx/README.md`

No application source code was modified.

### If you need to stop the new deployment

```powershell
# Stop Nginx
cd C:\nginx
.\nginx.exe -s stop

# Stop PM2 backend (if using PM2)
pm2 stop campus-connect-api

# OR stop Node.js directly
Stop-Process -Name node -Force
```

### If you need to restore a previous Nginx config

```powershell
# Restore from Git
git checkout -- deployment/nginx/nginx.conf

# Copy the old config back to Nginx
Copy-Item -Force "deployment\nginx\nginx.conf" "C:\nginx\conf\nginx.conf"

# Restart Nginx
cd C:\nginx
.\nginx.exe -s stop
.\nginx.exe
```

### If you need to restore application code (backend or frontend)

Application code was NOT modified in this deployment task.
If earlier code changes need to be undone:

```powershell
# Restore specific files
git checkout -- backend-api/src/index.ts
git checkout -- backend-api/src/services/socket.service.ts
git checkout -- admin-portal/api/api.js
git checkout -- admin-portal/api/config.js

# Rebuild backend
cd backend-api
npm run build

# Restart
pm2 restart campus-connect-api
```

Total rollback time: ~2 minutes.
