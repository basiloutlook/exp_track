# Fixes Applied to Expense Tracker

## Issues Fixed

### 1. ✅ Duplicate Records on Update
**Problem**: When updating a transaction, 2 records were being added instead of updating the existing one.

**Root Cause**:
- Google Sheets App Script didn't have update/delete operations
- No ID column to uniquely identify transactions
- Client was calling wrong storage methods

**Solution**:
- Updated App Script to support `add`, `update`, and `delete` actions
- Added ID column (Column A) to track transactions uniquely
- Fixed client code to use `updateExpenseOnly()` instead of `saveExpense()`

### 2. ✅ ShopName Not Prefilled During Edit
**Problem**: When clicking edit, shopName field was empty even though it existed in the data.

**Root Cause**:
- App Script was using `shop` field name instead of `shopName`
- Field mapping mismatch between client and server

**Solution**:
- Updated App Script to use consistent `shopName` field
- Updated doGet() to return `shopName` (Column I)
- Ensured client properly sets shopName from expense data

### 3. ✅ ShopName Not Saved to Google Sheet
**Problem**: ShopName filled during edit wasn't being saved back to Google Sheet.

**Root Cause**:
- App Script had field name mismatch (`shop` vs `shopName`)
- Column mapping was incorrect

**Solution**:
- Fixed App Script to properly map `shopName` to Column I
- Updated both `add` and `update` operations to include shopName
- Ensured doPost() correctly handles shopName field

### 4. ✅ Form Not Clearing After Successful Update
**Problem**: After updating a transaction and returning to Add Expense page, the previously edited values were still prefilled.

**Root Cause**:
- Router params were persisting across navigation
- Using `router.push()` instead of `router.replace()`
- Params not being cleared on form reset

**Solution**:
- Changed navigation to use `router.replace('/(tabs)/dashboard')` instead of `router.push('/dashboard')`
- Proper path format for tab navigation
- Form resets when no expense param is present

### 5. ✅ Delete Button Not Working
**Problem**: Delete button just reloaded the dashboard with no change in Google Sheet.

**Root Cause**:
- App Script didn't have delete operation implemented
- No ID-based deletion logic

**Solution**:
- Implemented `delete` action in App Script
- Finds row by ID and uses `sheet.deleteRow()`
- Proper error handling for "ID not found"

## Changes Made to Files

### 1. `/utils/Appscript` (Google Apps Script)
- **Complete rewrite** to support CRUD operations
- Added ID column handling (Column A)
- Implemented `action` parameter: 'add', 'update', 'delete'
- Fixed column mapping to match client expectations
- Changed `shop` to `shopName` throughout
- Added error handling for missing IDs

### 2. `/utils/googleSheets.ts`
- Fixed field mapping in `getExpensesFromGoogleSheet()`
- Ensured `shopName` is properly read from response
- No changes needed to add/update/delete functions (already correct)

### 3. `/app/(tabs)/index.tsx`
- Fixed navigation paths to use `/(tabs)/dashboard` format
- Changed `router.push()` to `router.replace()` for proper param clearing
- Removed `expenseId` from dependency array to prevent re-renders
- Ensured form resets properly after discard/save

### 4. `/app/(tabs)/dashboard.tsx`
- Updated `handleEditExpense` to use correct pathname: `/(tabs)/`
- No other changes needed

### 5. `/types/expense.ts`
- Removed optional marker from `subCategory` (now required)
- All other fields remain the same

## Required Setup Steps

⚠️ **IMPORTANT**: You must update your Google Sheets setup for these fixes to work!

1. **Add ID Column**:
   - Insert new Column A with header "ID"
   - For existing data, populate IDs (see GOOGLE_SHEETS_SETUP.md)

2. **Update App Script**:
   - Copy content from `/utils/Appscript`
   - Deploy as new version
   - Update `GOOGLE_SHEET_URL` in `/utils/googleSheets.ts`

3. **Verify Column Order**:
   ```
   A: ID
   B: Timestamp
   C: Date
   D: Category
   E: Sub Category
   F: Item
   G: Amount
   H: Email Address
   I: Shop/Site/Person name  (was previously "Shop")
   J: Mode of payment
   K: Labels
   ```

## Testing Checklist

After deploying changes:

- [ ] Add new expense → Verify ID is auto-populated
- [ ] Edit expense → Verify all fields including shopName are prefilled
- [ ] Update expense with changes → Verify same row is updated (no duplicate)
- [ ] Update expense without changes → Verify "No Changes" prompt appears
- [ ] Delete expense → Verify row is removed from sheet
- [ ] Navigate back to Add Expense → Verify form is empty
- [ ] Test back button during edit → Verify "Keep Editing/Discard" prompt appears

## Technical Details

### Update Flow
1. User clicks Edit → Navigate to `/(tabs)/` with expense param
2. Form loads with all fields prefilled from param
3. User modifies fields → Changes tracked against original
4. User clicks "Update Expense":
   - If no changes: Show prompt, return to dashboard
   - If changes exist: Call `updateExpenseInGoogleSheet()`
5. App Script finds row by ID and updates in place
6. Success alert shown → Navigate to dashboard with `router.replace()`
7. Form state is reset, params are cleared

### Delete Flow
1. User clicks Delete → Confirmation alert appears
2. On confirm: Call `deleteExpenseFromGoogleSheet(id)`
3. App Script finds row by ID and deletes it
4. Local storage updated
5. Dashboard refreshes from Google Sheet
6. Expense is removed from UI

### Navigation Flow
- Edit: `dashboard` → `/(tabs)/` (with params)
- Save/Discard: `/(tabs)/` → `/(tabs)/dashboard` (replace, clears params)
- Fresh Add: Navigate to `/(tabs)/` → No params → Empty form
