# CSV expense import

The app accepts **one file at a time**: a UTF-8 **CSV** (comma-separated) or similar text export. Parsing is done in the browser with **[Papa Parse](https://www.papaparse.com/)** (MIT license).

Imports are **expense-only**: rows that represent **money coming in** (salary, deposits, bank credits) are **excluded** from the batch so spending totals stay accurate.

## Required columns

Your file must have a **header row**. Column names are matched case-insensitively; spaces become underscores (e.g. `Payment Method` → `payment_method`).

| Column    | Required | Description |
|-----------|----------|-------------|
| `amount`  | Yes*     | Positive number for an **expense** (money out). Currency symbols (`₹`, `$`, etc.) and commas are stripped. **Negative amounts** in a single amount column are treated as **credit/income** and the row is **excluded** (not imported as spending). |
| `date`    | Yes      | Prefer `YYYY-MM-DD`. `DD/MM/YYYY` and some other formats are supported; ambiguous dates assume **day/month** when both parts are ≤ 12. |
| `category`| Yes      | Must match a **category name** from your app catalog (Firestore `config/app` or your saved settings). Matching is case-insensitive; partial matches are allowed when unambiguous. |

\*Or use **bank-style** debit/credit columns instead of one amount column (see below).

## Bank statements: debit vs credit

If your export has **separate columns** for money out vs money in:

- **Debit / withdrawal** columns (e.g. `Debit`, `Debit Amount`, `Withdrawal`, `Paid Out`) → used as the expense amount.
- **Credit / deposit** columns (e.g. `Credit`, `Deposit`, `Paid In`) → if a row **only** has a value here and no debit, the row is **excluded** (income, not spending).

Optional **flow** columns (`flow`, `entry_type`, `transaction_type`, `txn_type`, `dr_cr`) with values like `Credit` / `Debit` also mark income rows for exclusion.

## Optional columns

| Column    | Description |
|-----------|-------------|
| `payment` | Must match a **payment method** from your catalog if present. If omitted, the first payment method in the catalog is used. |
| `notes`   | Free text (also accepts `description`, `memo`, `merchant`, `payee`, etc.). |
| `tags`    | Comma- or semicolon-separated labels. |

### Aliases (recognized header names)

- **Amount (single column):** `amount`, `amt`, `total`, `value`, `sum`
- **Debit (money out):** `withdrawal`, `debit_amount`, `debit`, `dr_amount`, `dr`, `paid_out`, `outflow`, …
- **Credit (money in):** `deposit`, `credit_amount`, `credit`, `cr_amount`, `cr`, `paid_in`, `inflow`, …
- **Date:** `date`, `txn_date`, `transaction_date`, `posted`, `posted_date`, `when`
- **Category:** `category`, `cat`, `type`, `expense_category`, `merchant_category`
- **Payment:** `payment`, `pay`, `method`, `payment_method`, `account`
- **Notes:** `notes`, `description`, `memo`, `merchant`, `payee`, `details`, `narration`
- **Tags:** `tags`, `tag`, `labels`

## Excluded rows

Rows marked as **credit / income** are listed in the preview with **Excluded: credit / income (not counted as expense)** and are **not** saved when you confirm import.

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
- This path is for **structured CSV**. For photos or PDFs, use **Scan receipt** or statement tools in the app.
