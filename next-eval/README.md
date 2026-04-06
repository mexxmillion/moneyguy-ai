# MoneyGuy 2.0 Next Eval

Parallel Next.js evaluation app.

## Goal

Keep the current Vite app as the source of truth for:
- screens
- workflows
- backend integrations
- tools/features

Use the imported Stitch zip as the design language layer:
- layout
- spacing
- visual hierarchy
- component styling

## Current status

- Running in a separate app at port 3003
- API requests proxy to existing backend at port 3002
- Vite app remains untouched
- Stitch assets imported under `../design/stitch/imported/stitch/`
- Dashboard has first-pass data wiring + Stitch-inspired shell
- Other pages are scaffolded for incremental porting

## Next porting order

1. Accounts
2. Transactions
3. Upload
4. Budgets
5. Trends
6. AI
