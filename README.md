# Budget Tracker

A personal budget tracker built as a static web app, so it can be hosted on GitHub Pages and opened from any device.

## What it tracks

- Twice-a-month income with editable paydays, defaulting to the 5th and 20th.
- Monthly gross salary with automatic Philippine payroll deductions.
- Net monthly salary and net per-paycheck salary.
- Monthly bills and expenses with due dates.
- How much to set aside every paycheck for bills, subscriptions, and savings.
- Daily spending against the current paycheck allowance.
- Monthly subscriptions and renewal dates.
- Transpo estimates with customizable daily/monthly multipliers.
- JSON backup export and import.
- Optional GitHub Gist sync for the latest budget data across devices.

## Use it locally

Open `index.html` in a browser, or run a small local server from this folder:

```bash
python3 -m http.server 4173
```

Then open `http://localhost:4173`.

## Upload to GitHub Pages

1. Create a new GitHub repository.
2. Upload these files to the repository root.
3. In GitHub, open `Settings` -> `Pages`.
4. Set the source to `Deploy from a branch`.
5. Choose the `main` branch and `/root`.
6. Save, then open the Pages URL GitHub gives you.

## Turn on sync

The app works offline on each device through browser storage. To keep one live copy everywhere:

1. Create a GitHub personal access token with Gist access.
2. Open the tracker and go to `Sync`.
3. Paste the token.
4. Leave `Gist ID` blank the first time and choose `Push to GitHub`.
5. Save the generated Gist ID somewhere private.
6. On another device, open the same tracker, paste the token and Gist ID, then choose `Pull from GitHub`.

The token is stored only in that browser. Do not commit it to the repository.

## Payroll assumptions

The Income page estimates Philippine private-sector payroll deductions in the same spirit as Sweldong Pinoy:

- SSS employee share from the monthly salary credit.
- PhilHealth employee share at the employee half of the premium.
- Pag-IBIG employee share capped by the monthly fund salary.
- Monthly withholding tax using the post-2023 graduated compensation table.

The calculator is meant for personal planning. Actual payroll can differ because of company-specific timing, bonuses, absences, taxable benefits, previous employer records, or payroll rounding.
