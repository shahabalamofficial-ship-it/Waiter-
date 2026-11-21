# Yasmine Palace Training Academy

GitHub Pages-ready hospitality training app, based on the supplied `Repo.html`.

## Included in this build

- Preserves the original 30-day course, restaurant menu dataset, quizzes, sequence of service, duty-hours log, study timer, theme and local photo workflow.
- Adds a separate **Account, My Lessons & Cloud** workspace from the **More** tab.
- Email verification-code sign-in using Supabase Auth.
- Personal lessons, dishes and notes, stored locally when offline/not signed in and stored per-account in Supabase when signed in.
- Private multi-photo upload for personal dishes (8 MB per file) using Supabase Storage.
- Structured JSON backup and restore for progress, duty hours, personal lessons, dishes and notes. Photo binaries are not included in this JSON export.
- Search links for Wikimedia Commons and Google Images. Check image licences and attribution before reusing an image.
- PWA manifest and a service worker for app-shell caching.

## Important limitations — read before launch

1. **No Supabase project is connected yet.** The app works locally, but cloud sign-in, cloud records and private cloud photo upload remain disabled until configured below.
2. The original built-in course/menu are retained as the baseline. Personal content is stored separately. This first build does not yet include an in-app editor for the protected baseline or a server-side baseline revision/restore console.
3. The cloud snapshot sync saves a merged progress backup. Duty-hour and local progress data are not a full conflict-free multi-device sync engine. Review the backup after syncing from multiple devices.
4. The JSON backup does not include image files. Cloud photos remain in the private Supabase Storage bucket and are not bundled into the JSON export.
5. Online image search opens third-party search pages; the app does not scrape images or verify copyright automatically.
6. The existing dish photo feature in the original Menu tab saves photos in this browser's IndexedDB. Cloud photo upload in this build is available for dishes created in **My Menu Dishes**.
7. Supabase's email template must send a numeric OTP code (not only a magic link) for the code-entry flow.

## 1. Create Supabase backend

1. Create a project at [Supabase](https://supabase.com/).
2. Open **SQL Editor** and run `supabase/schema.sql` completely.
3. Open **Authentication → Providers → Email** and enable email sign-in. Configure the email template to include the OTP token/code, such as `{{ .Token }}`. Test delivery before sharing the app.
4. Open **Project Settings → API**. Copy the Project URL and the publishable/anon public key.
5. Put those values in `config.js`:

```js
window.YP_CONFIG = {
  supabaseUrl: "https://YOUR-PROJECT.supabase.co",
  supabaseAnonKey: "YOUR_PUBLIC_ANON_OR_PUBLISHABLE_KEY"
};
```

Only the public anon/publishable key belongs in the browser. **Never paste a `service_role` key, database password, or secret key into `config.js` or GitHub.** Row Level Security is enabled by the SQL schema; do not disable it.

## 2. Publish to GitHub Pages

1. Download/extract this project folder.
2. In your GitHub repository, upload the *contents* of this folder to the repository root (not the enclosing folder).
3. Commit the files. Ensure `index.html` is at the root.
4. In **Settings → Pages**, choose **Deploy from a branch**, select your default branch and `/ (root)`, then save.
5. Wait for the deployment and open the published Pages URL.
6. In Supabase **Authentication → URL Configuration**, add the exact GitHub Pages URL to **Site URL** and **Redirect URLs** (include the project path if the app is hosted under a repository subpath).
7. Test on iPhone Safari: sign in, create a personal lesson, create a personal dish, upload two photos, reload, sign out/in, export a backup, and test local mode.

## 3. Safety checklist before real use

- Confirm RLS is active on all five public tables.
- Confirm `dish-photos` is a **private** bucket.
- Test with two separate accounts and verify neither can read the other's records or photos.
- Test email delivery and rate limits.
- Download an export and retain it outside the phone.
- Test app updates and service-worker refresh after every deployment.
- Do not upload guest faces, guest details, confidential restaurant documents, or workplace photos without permission.

## Project structure

```text
index.html                 Original training app + cloud entry points
config.js                  Supabase public project configuration (fill in locally)
js/cloud.js                OTP auth, personal content, backup, cloud photo upload
css/cloud.css              Cloud workspace styles
supabase/schema.sql        Tables, RLS policies and private photo bucket
manifest.webmanifest       Installable app metadata
sw.js                      App-shell service worker
```

## What this does not do

This creates a GitHub-ready project package. It does **not** push files to your GitHub account, create a Supabase project, configure email delivery, or publish the website automatically. Those actions require your account access and project-specific settings.
