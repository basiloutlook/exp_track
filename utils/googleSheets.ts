import { Expense } from '@/types/expense';

const GOOGLE_SHEET_URL =
  'https://script.google.com/macros/s/AKfycby0W_NemJENrAyV_U3W7sqVAozLqXLRyUm_TTn1te4aWGi4ZN8AJz8VuPavfN8KxD4C/exec';

/**
 * Fetch expenses from Google Sheets (via Apps Script Web App)
 */
export async function getExpensesFromGoogleSheet(): Promise<Expense[]> {
  try {
    const response = await fetch(GOOGLE_SHEET_URL);
    const data = await response.json();

    if (!Array.isArray(data)) {
      console.warn('⚠️ Invalid response format from Google Sheets');
      return [];
    }

    const expenses: Expense[] = data.map((row: any, index: number) => ({
      id: `sheet-${index + 1}`,
      date: row.date || row.Date || '',
      category: row.category || row.Category || '',
      subCategory: row.subCategory || row['Sub Category'] || '', // ✅ corrected key name
      item: row.item || row.Item || '',
      amount: parseFloat(row.amount || row.Amount || 0),
      email: row.email || row['Email Address'] || '',
      shopName: row.shop || row['Shop/Site/Person name'] || '',
      paymentMode: row.paymentMode || row['Mode of payment'] || '',
      labels:
        typeof row.labels === 'string'
          ? row.labels.split(',').map((l: string) => l.trim()).filter(Boolean)
          : Array.isArray(row.labels)
          ? row.labels
          : [],
      timestamp: row.timestamp || row.Timestamp || '',
    }));

    return expenses;
  } catch (error) {
    console.error('❌ Error fetching Google Sheet data:', error);
    return [];
  }
}

/**
 * Add an expense to Google Sheets (via POST)
 */
export async function addExpenseToGoogleSheet(
  expense: Omit<Expense, 'id' | 'timestamp'>
): Promise<void> {
  try {
    const response = await fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: expense.date,
        category: expense.category,
        subCategory: expense.subCategory ?? '', // ✅ ensure field always exists
        item: expense.item,
        amount: expense.amount,
        email: expense.email,
        shop: expense.shopName ?? '',
        paymentMode: expense.paymentMode,
        labels: Array.isArray(expense.labels)
          ? expense.labels.join(', ')
          : expense.labels || '',
      }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to add expense');
    }
    console.log('✅ Added to Google Sheets:', result.message);
  } catch (error) {
    console.error('❌ Error adding expense to Google Sheets:', error);
  }
}

/**
 * Update an expense in Google Sheets (via POST with an 'update' action)
 */
export async function updateExpenseInGoogleSheet(expense: Expense): Promise<void> {
  try {
    const response = await fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'update', // Specify the action
        id: expense.id,     // Include the ID to find the row
        date: expense.date,
        category: expense.category,
        subCategory: expense.subCategory ?? '',
        item: expense.item,
        amount: expense.amount,
        email: expense.email,
        shop: expense.shopName ?? '',
        paymentMode: expense.paymentMode,
        labels: Array.isArray(expense.labels)
          ? expense.labels.join(', ')
          : expense.labels || '',
      }),
    });

    const result = await response.json();
    if (!result.success) {
      throw new Error(result.message || 'Failed to update expense in Google Sheet');
    }
    console.log('✅ Updated in Google Sheets:', result.message);
  } catch (error) {
    console.error('❌ Error updating expense in Google Sheets:', error);
  }
}
