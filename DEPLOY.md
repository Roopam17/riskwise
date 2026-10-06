# Putting RiskWise online (step by step)

Everything in the project works on your laptop already. This guide is only the steps that need **your own accounts**, which Claude is not allowed to create or fill in for you. All four services have free plans. Allow about an hour, plus waiting time.

## The picture

```
GitHub repo ──(code)──► Vercel  = the website everyone visits
     │
     ├─ GitHub Actions (runs every weekday evening by itself)
     │        fetches prices, makes forecasts, saves data files
     │        └──► "data" branch of the same repo (just files)
     │                    ▲
     └─(code)──► Render = the backend; reads the data files and answers the website
                         
Supabase = logins and saved watchlists (the website talks to it directly)
```

## Before you start: what you need

| Account | What it is for | Cost |
|---|---|---|
| **GitHub** | stores the code, runs the nightly job | free |
| **Supabase** | email + password logins, watchlists | free |
| **Render** | runs the backend | free (sleeps when idle, so the first visit after a quiet spell takes about 30 seconds) |
| **Vercel** | hosts the website | free |

**Two keys you will copy, and one you must never copy:**
- Supabase **Project URL** and **anon public key**: these go into Vercel. The anon key is designed to be public; the database rules in `supabase/schema.sql` are what keep each person's watchlist private.
- Supabase **service_role key**: **never paste this anywhere.** It bypasses all the rules.

## Step 1: put the code on GitHub

1. On github.com, create a new **public** repository (for example `riskwise`). It has to be public so the backend can read the nightly data files from it for free. (There is nothing secret in the repo: no keys, only code and model files.)
2. In the project folder, in Terminal:
   ```bash
   git init
   git add .
   git commit -m "RiskWise first version"
   git branch -M main
   git remote add origin https://github.com/YOUR-NAME/riskwise.git
   git push -u origin main
   ```
3. Check on GitHub that the `models` folder (about 9 MB) is there. The big folders `data/prices`, `data/garch` and `app_data` are deliberately not uploaded (see `.gitignore`).

## Step 2: Supabase (logins and watchlists)

1. At supabase.com, **New project**. Choose a region near you (for example Mumbai) and write the database password in a safe place. You will not need it again.
2. **SQL Editor, New query:** paste the whole of `supabase/schema.sql` and press **Run**. This creates the watchlist table, locks it so people only see their own rows, caps it at 50 stocks, and adds the "Delete my account" function.
3. **Authentication, Providers:** check that **Email** is enabled and **Confirm email** is **on**. That is what sends the verification email.
4. **Authentication, URL Configuration:** you will fill these in after Step 5, once you know your website address: **Site URL** = your Vercel address, and under **Redirect URLs** add `https://YOUR-SITE.vercel.app/**`.
5. **Project Settings, API:** copy the **Project URL** and the **anon public** key. Keep them for Step 5.

> **Email limit:** Supabase's built-in email sender is very limited on the free plan (a handful of emails per hour). It is fine for testing. Before real users arrive, add your own email service under **Authentication, SMTP Settings**.

## Step 3: publish the first data

1. On GitHub, open the **Actions** tab. If asked, allow workflows.
2. Choose **nightly-forecasts**, **Run workflow**. It takes roughly 10 to 20 minutes. When it ends, your repo has a new branch called **data** containing the forecast files.
3. Then run **weekly-company-facts** the same way (about 30 to 60 minutes). It fills in market cap, P/E, sector and so on.
4. After that, both run by themselves: the forecasts every weekday evening, the facts every Sunday.

Your data address is: `https://raw.githubusercontent.com/YOUR-NAME/riskwise/data` (note the final `/data`).

## Step 4: Render (the backend)

1. At render.com: **New, Blueprint**, connect your GitHub repo. Render reads `render.yaml`.
2. When it asks for the two settings:
   - `DATA_BASE_URL` = the data address from Step 3
   - `ALLOWED_ORIGINS` = your website address (you will know it after Step 5; you can leave it for now and edit it afterwards)
3. When it finishes, open `https://YOUR-API.onrender.com/api/health`. You should see `"ok": true` and a date. Copy that address for Step 5.

## Step 5: Vercel (the website)

1. At vercel.com: **Add New, Project**, pick your repo.
2. Set **Root Directory** to `frontend`. Vercel detects Vite by itself.
3. **Environment Variables** (paste each):
   | Name | Value |
   |---|---|
   | `VITE_API_BASE` | your Render address, for example `https://riskwise-api.onrender.com` (no slash at the end) |
   | `VITE_SUPABASE_URL` | Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon public key |
   | `VITE_CONTACT_EMAIL` | the address people can send feedback to |
4. Press **Deploy**.
5. Go back and fill in the two addresses that needed your Vercel URL: Render's `ALLOWED_ORIGINS` (then it redeploys) and Supabase's **Site URL** and **Redirect URLs** (Step 2, item 4).
6. Test: open the site, sign up with a real email, click the verification link, log in, add a stock to your watchlist, log out and back in, and check the stock is still there.

## Step 6 (optional, later): "Log in with Google"

1. Google Cloud Console: create a project, set up the **OAuth consent screen** (app name RiskWise, your email), then **Credentials, Create OAuth client ID, Web application**. As the **Authorized redirect URI** paste the callback address that Supabase shows under **Authentication, Providers, Google**.
2. Copy the **Client ID** and **Client secret** into that same Supabase Google page, and switch it on.
3. In Vercel add `VITE_ENABLE_GOOGLE` = `true` and redeploy. A Google button appears on the login page.

## Before you tell anyone about it

- [ ] **The photo.** `frontend/public/hero.jpg` came from you. Confirm you have the right to use it publicly, or replace it with one you own or a free-licence one (for example from Pexels or Unsplash).
- [ ] **The name.** "RiskWise" is a generic name. Search the web, app stores and a domain registrar for clashes before you promote it. Fallback ideas: RiskWise India, Stormcast, Calmcast.
- [ ] **Read the About page** (`frontend/src/pages/About.jsx`) and make sure you are comfortable with every sentence. It says the site is educational and not investment advice. If you ever add anything that looks like a recommendation, talk to a qualified person first.
- [ ] **The data licence.** Prices come from Yahoo Finance through an unofficial route. That is fine for a small educational project, but check Yahoo's terms and be ready to switch the data source if it is blocked.
- [ ] **Contact address** is set (`VITE_CONTACT_EMAIL`).

## Keeping it healthy

| How often | What | How |
|---|---|---|
| Every weekday | forecasts refresh | automatic (GitHub Actions) |
| Every Sunday | company facts refresh | automatic |
| **About monthly** | retrain the models on the latest history | On your laptop: `.venv/bin/python pipeline/download_prices.py --refresh`, then `.venv/bin/python pipeline/features.py`, then `.venv/bin/python pipeline/train_final.py`, then commit and push the `models` folder |
| **About yearly** | re-check the Low / Medium / High cut-offs and the scoreboard | Re-run notebooks 04 to 08 in order, then commit `models/risk_bands.json` and the `data/scoreboard*.csv` files |

## If something looks wrong

| What you see | Likely reason | What to do |
|---|---|---|
| The site takes 30 seconds the first time | Render's free plan was asleep | Normal. It wakes up. |
| "We could not reach the server" | `VITE_API_BASE` is wrong, or `ALLOWED_ORIGINS` on Render does not match your website address | Check both, with no trailing slash. |
| Stocks open but no risk levels, or "Data files are not available" | The `data` branch does not exist yet, or `DATA_BASE_URL` is wrong | Run the nightly workflow (Step 3) and check the address. |
| Verification email never arrives | Supabase's free email limit, or it went to spam | Wait, check spam, or set up your own SMTP. |
| "Logins are not connected yet" on the login page | The two `VITE_SUPABASE_...` values are missing in Vercel | Add them and redeploy. |
| A stock says "price jump: possible stock split" | The safety check caught a huge one-day move | Normal and temporary. Next night's data usually fixes it. |

## What is not covered yet

- **BSE-only stocks.** Only NSE-listed stocks are searchable. BSE's own list cannot be downloaded by a program. To add them later: on bseindia.com open the list of scrips, click **Download**, save it into the `data` folder, then ask Claude to extend the download scripts.
- **ROE** (return on equity) is available for only about 6% of stocks from the free data source, so it shows "Not available" for most.
