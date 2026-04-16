# CSV expense import

The app accepts **one file at a time**: a UTF-8 **CSV** (comma-separated) or similar text export. Parsing is done in the browser with **[Papa Parse](https://www.papaparse.com/)** (MIT license).

## Required columns

Your file must have a **header row**. Column names are matched case-insensitively; spaces become underscores (e.g. `Payment Method` → `payment_method`).

| Column    | Required | Description |
|-----------|----------|-------------|
| `amount`  | Yes      | Positive number. Currency symbols (`₹`, `$`, etc.) and commas are stripped. Debits may be negative; the app uses the absolute value. |
| `date`    | Yes      | Prefer `YYYY-MM-DD`. `DD/MM/YYYY` and some other formats are supported; ambiguous dates assume **day/month** when both parts are ≤ 12. |
| `category`| Yes      | Must match a **category name** from your app catalog (Firestore `config/app` or your saved settings). Matching is case-insensitive; partial matches are allowed when unambiguous. |

## Optional columns

| Column    | Description |
|-----------|-------------|
| `payment` | Must match a **payment method** from your catalog if present. If omitted, the first payment method in the catalog is used. |
| `notes`   | Free text (also accepts `description`, `memo`, `merchant`, `payee`, etc.). |
| `tags`    | Comma- or semicolon-separated labels. |

### Aliases (recognized header names)

- **Amount:** `amount`, `amt`, `debit`, `credit`, `total`, `value`, `sum`
- **Date:** `date`, `txn_date`, `transaction_date`, `posted`, `posted_date`, `when`
- **Category:** `category`, `cat`, `type`, `expense_category`
- **Payment:** `payment`, `pay`, `method`, `payment_method`, `account`
- **Notes:** `notes`, `description`, `memo`, `merchant`, `payee`, `details`, `narration`
- **Tags:** `tags`, `tag`, `labels`

## Example

```csv
amount,date,category,payment,notes
1200,2026-04-01,Food & Dining,UPI,Lunch
450.50,2026-04-02,Transport,Card,Uber
```

## Invalid rows

Rows with bad amounts, unknown categories, or unparseable dates are **listed in the preview** and **skipped** when you tap **Add N expenses**. Fix the file and upload again if needed.

## Limits

- Imports are written to Firestore in batches (hundreds of rows per batch). Very large files may take a few seconds.
- This path is for **structured CSV**. For photos or PDFs, use **Scan receipt** or **Upload statement** (AI) in the app.
