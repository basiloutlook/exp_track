# Google Sheets Setup Instructions

## Required Changes to Google Sheets

Your expense tracking app now requires the following changes to work properly with update and delete operations:

### 1. Update Column Structure

Your Google Sheet named "Form Responses 1" needs to have the following columns **in this exact order**:

| Column | Name | Description |
|--------|------|-------------|
| A | ID | Unique identifier for each expense |
| B | Timestamp | Auto-generated timestamp |
| C | Date | Expense date |
| D | Category | Expense category |
| E | Sub Category | Expense sub-category |
| F | Item | Item description |
| G | Amount | Expense amount |
| H | Email Address | User email |
| I | Shop/Site/Person name | Vendor name |
| J | Mode of payment | Payment method |
| K | Labels | Comma-separated labels |

### 2. Deploy Updated App Script

1. Open your Google Sheet
2. Go to **Extensions > Apps Script**
3. Delete all existing code
4. Copy and paste the entire content from `/utils/Appscript` file in your project
5. Click **Save** (💾 icon)
6. Click **Deploy > New deployment**
7. Choose **Web app** as the deployment type
8. Set:
   - Description: "Expense Tracker API v2"
   - Execute as: "Me"
   - Who has access: "Anyone"
9. Click **Deploy**
10. Copy the new **Web app URL**
11. **IMPORTANT**: Update the `GOOGLE_SHEET_URL` in `/utils/googleSheets.ts` with your new deployment URL

### 3. What Changed in the App Script

The updated App Script now supports:

- ✅ **ADD operation**: Adds new expenses with ID column
- ✅ **UPDATE operation**: Updates existing expenses by ID (no duplicates)
- ✅ **DELETE operation**: Deletes expenses by ID
- ✅ **GET operation**: Fetches all expenses including ID and shopName fields
- ✅ **Field mapping**: Correctly maps `shopName` field (was previously `shop`)

### 4. Migration Steps for Existing Data

If you already have data in your sheet:

1. **Backup your data first!** (File > Make a copy)
2. Insert a new column A for "ID"
3. Add header "ID" in cell A1
4. For each existing row (starting from row 2), generate a unique ID:
   - Option 1: Use formula: `=TEXT(B2,"yyyyMMddHHmmss")&ROW()` (where B is timestamp column)
   - Option 2: Manually assign sequential IDs: 1, 2, 3, etc.
5. Ensure all column headers match exactly as shown in the table above

### 5. Testing the Setup

After deployment:

1. Try adding a new expense - verify ID is populated in column A
2. Try editing an expense - verify it updates the same row (no duplicate)
3. Try deleting an expense - verify the row is removed
4. Check that shopName field is saved and displayed correctly

### Troubleshooting

**Issue**: Expenses are duplicated on update
- **Solution**: Make sure you deployed the new App Script and updated the URL

**Issue**: shopName not saving
- **Solution**: Verify column I header is exactly "Shop/Site/Person name"

**Issue**: Delete not working
- **Solution**: Ensure ID column exists and is populated for all rows

**Issue**: "Expense ID not found" error
- **Solution**: Check that the ID in column A matches the ID being sent from the app
