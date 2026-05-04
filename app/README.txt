====================================
  AXIVIA FIELD APP — README
====================================

1. DEPLOY TO GITHUB PAGES (FREE HTTPS HOSTING)
-----------------------------------------------
PWAs require HTTPS. GitHub Pages provides this free.

a) Create a GitHub account at https://github.com if you don't have one.
b) Create a new repository (e.g. "axivia-app"). Set it to Public.
c) Upload all files from this folder (index.html, manifest.json, sw.js,
   icon-192.png, icon-512.png) to the repository root.
d) Go to Settings → Pages → Source → select "main" branch → Save.
e) Your app will be live at: https://<username>.github.io/axivia-app/
   (takes 1-2 minutes to deploy)

Alternative: Any static host works (Netlify, Vercel, Cloudflare Pages, etc.)
Just upload the files — no build step needed.


2. INSTALL ON ANDROID
----------------------
a) Open Chrome on your Android phone.
b) Navigate to your deployed URL (e.g. https://yourname.github.io/axivia-app/).
c) Wait for the page to fully load.
d) Tap the three-dot menu (top right) → "Add to Home Screen" or
   "Install App" (wording varies by Chrome version).
e) Tap "Install" or "Add".
f) The app icon appears on your home screen. It now works offline.


3. CHANGE THE PIN
------------------
Open index.html in any text editor. Near the top of the <script> section,
find this line:

  const APP_PIN = '1234';

Change '1234' to your desired PIN (must be exactly 4 digits). Save the file
and re-deploy.


4. CHANGE THE REPORT EMAIL
----------------------------
Open Axivia_AutoExport_Script.js in a text editor. Near the top, find:

  const REPORT_EMAIL = 'your@email.com';

Replace 'your@email.com' with the email address that should receive reports.


5. SET UP AUTO-EXPORT (GOOGLE APPS SCRIPT TRIGGERS)
-----------------------------------------------------
a) Open your Google Sheet (the one receiving data from the app).
b) Go to Extensions → Apps Script.
c) If you already have code there (the sync/doPost script), create a NEW
   Apps Script project instead:
   - Go to https://script.google.com
   - Click "New Project"
   - This keeps the export script separate from the sync script.
d) Delete any default code and paste the entire contents of
   Axivia_AutoExport_Script.js.
e) Update REPORT_EMAIL and SHEET_ID at the top of the script.
   - SHEET_ID is the long string in your Google Sheet URL between /d/ and /edit
     Example URL: https://docs.google.com/spreadsheets/d/ABC123xyz/edit
     SHEET_ID = "ABC123xyz"
f) Save the project (Ctrl+S).
g) Run weeklyExport() once manually to authorize permissions:
   - Select weeklyExport from the function dropdown
   - Click Run
   - Approve the permissions when prompted
h) Set up automatic triggers:
   - Click the clock icon (Triggers) in the left sidebar
   - Click "+ Add Trigger"
   - For weekly report: Function = weeklyExport, Event = Time-driven,
     Timer type = Week timer, Day = Monday, Time = 8am-9am
   - For daily report: Function = dailyExport, Event = Time-driven,
     Timer type = Day timer, Time = 8am-9am
   - Click Save


6. CHANGE THE GOOGLE SHEET URL
-------------------------------
If you need to point the app to a different Google Sheet:
Open index.html, find this line near the top of <script>:

  const SHEET_URL = "https://script.google.com/macros/s/.../exec";

Replace with your new Apps Script web app URL.


====================================
  TROUBLESHOOTING
====================================

App won't install on Android:
  - Must be served over HTTPS (not file://)
  - Must load fully at least once while online
  - Try clearing Chrome cache and reloading

Sheet sync not working:
  - Check that the Apps Script web app is deployed as "Anyone" access
  - Check the SHEET_URL in index.html matches your deployment URL
  - Open Chrome DevTools (desktop) to check for errors

Offline not working:
  - Service worker only activates after first successful load
  - Close and reopen the app after first visit
  - Check Chrome → chrome://serviceworker-internals for status
