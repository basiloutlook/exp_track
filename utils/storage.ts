import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense } from '@/types/expense';

const EXPENSES_KEY = '@expenses';
const USER_EMAIL_KEY = '@user_email';

export const storageService = {
  async setExpenses(expenses: Expense[]): Promise<void> {
    try {
      await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
    } catch (error) {
      console.error('Error setting expenses:', error);
      throw error;
    }
  },

  /**
   * Import expenses from a CSV URL (for example a Google Sheet published as CSV).
   * The CSV is expected to have the following headers in order:
   * Email,Date,Category,Item,Shop/Site/Person Name,Amount,Mode of Payment,Labels
   */
  async importFromCSVUrl(csvUrl: string, overwrite = true): Promise<void> {
    try {
      const res = await fetch(csvUrl);
      if (!res.ok) throw new Error(`Failed to fetch CSV: ${res.status}`);
      const text = await res.text();

      // Basic CSV parser that handles quoted fields with commas
      const parseCSV = (data: string) => {
        const rows: string[][] = [];
        let cur = '';
        let row: string[] = [];
        let inQuotes = false;

        for (let i = 0; i < data.length; i++) {
          const ch = data[i];
          if (ch === '"') {
            if (inQuotes && data[i + 1] === '"') {
              cur += '"'; // escaped quote
              i++; // skip next
            } else {
              inQuotes = !inQuotes;
            }
          } else if (ch === ',' && !inQuotes) {
            row.push(cur);
            cur = '';
          } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
            // handle CRLF and LF
            if (cur !== '' || row.length > 0) {
              row.push(cur);
              rows.push(row);
              row = [];
              cur = '';
            }
            // skip potential LF after CR
            if (ch === '\r' && data[i + 1] === '\n') i++;
          } else {
            cur += ch;
          }
        }
        if (cur !== '' || row.length > 0) {
          row.push(cur);
          rows.push(row);
        }
        return rows;
      };

      const rows = parseCSV(text).filter(r => r.length > 0);
      if (rows.length <= 1) return; // nothing to import

      const headers = rows[0].map(h => h.trim());
      const dataRows = rows.slice(1);

      const mapped: Expense[] = dataRows.map((cols) => {
        const rowObj: any = {};
        // map by header names (best-effort)
        headers.forEach((h, idx) => (rowObj[h] = cols[idx] ? cols[idx].trim() : ''));

        const labelsField = rowObj['Labels'] || rowObj['labels'] || '';
        const amountField = rowObj['Amount'] || rowObj['amount'] || '0';

        const expense: Expense = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          email: rowObj['Email'] || rowObj['email'] || '',
          date: rowObj['Date'] || rowObj['date'] || new Date().toISOString(),
          category: rowObj['Category'] || rowObj['category'] || '',
          item: rowObj['Item'] || rowObj['item'] || '',
          shopName: rowObj['Shop/Site/Person Name'] || rowObj['Shop'] || rowObj['shopName'] || '',
          amount: parseFloat(amountField) || 0,
          paymentMode: rowObj['Mode of Payment'] || rowObj['paymentMode'] || '',
          labels: labelsField ? labelsField.split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          createdAt: new Date().toISOString(),
        };

        return expense;
      });

      if (overwrite) {
        await this.setExpenses(mapped);
      } else {
        const existing = await this.getExpenses();
        await this.setExpenses(existing.concat(mapped));
      }
    } catch (error) {
      console.error('Error importing CSV:', error);
      throw error;
    }
  },

  /**
   * Import expenses from a JSON endpoint (for example an Apps Script Web App returning JSON).
   * The endpoint should return an array of objects with keys matching the sheet column names.
   * Expected keys (best-effort): Timestamp, Date, Category, Item, Amount, Email Address,
   * Place, Shop/Site/Person name, Mode of payment, Needfulness, Type
   */
  async importFromJsonUrl(jsonUrl: string, overwrite = true): Promise<void> {
    try {
      const res = await fetch(jsonUrl);
      if (!res.ok) throw new Error(`Failed to fetch JSON: ${res.status}`);
      const data = await res.json();
      if (!Array.isArray(data)) throw new Error('Expected JSON array');

      const mapped: Expense[] = data.map((row: any) => {
        const labelsField = row['Needfulness'] || row['Type'] || '';
        const amountField = row['Amount'] || row['amount'] || '0';

        const expense: Expense = {
          id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
          email: row['Email Address'] || row['Email'] || row['email'] || '',
          date: row['Date'] || row['date'] || new Date().toISOString(),
          category: row['Category'] || row['category'] || '',
          item: row['Item'] || row['item'] || '',
          shopName: row['Shop/Site/Person name'] || row['Shop'] || row['shopName'] || '',
          amount: parseFloat(String(amountField)) || 0,
          paymentMode: row['Mode of payment'] || row['Mode of payment'] || row['paymentMode'] || '',
          labels: labelsField ? String(labelsField).split(',').map((s: string) => s.trim()).filter(Boolean) : [],
          createdAt: new Date().toISOString(),
        };

        return expense;
      });

      if (overwrite) {
        await this.setExpenses(mapped);
      } else {
        const existing = await this.getExpenses();
        await this.setExpenses(existing.concat(mapped));
      }
    } catch (error) {
      console.error('Error importing JSON:', error);
      throw error;
    }
  },
  async saveExpense(expense: Expense): Promise<void> {
    try {
      const expenses = await this.getExpenses();
      expenses.push(expense);
      await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses));
    } catch (error) {
      console.error('Error saving expense:', error);
      throw error;
    }
  },

  async getExpenses(): Promise<Expense[]> {
    try {
      const data = await AsyncStorage.getItem(EXPENSES_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting expenses:', error);
      return [];
    }
  },

  async deleteExpense(id: string): Promise<void> {
    try {
      const expenses = await this.getExpenses();
      const filtered = expenses.filter(exp => exp.id !== id);
      await AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(filtered));
    } catch (error) {
      console.error('Error deleting expense:', error);
      throw error;
    }
  },

  async saveUserEmail(email: string): Promise<void> {
    try {
      await AsyncStorage.setItem(USER_EMAIL_KEY, email);
    } catch (error) {
      console.error('Error saving user email:', error);
      throw error;
    }
  },

  async getUserEmail(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(USER_EMAIL_KEY);
    } catch (error) {
      console.error('Error getting user email:', error);
      return null;
    }
  },

  async exportToCSV(): Promise<string> {
    try {
      const expenses = await this.getExpenses();
      const headers = 'Email,Date,Category,Item,Shop/Site/Person Name,Amount,Mode of Payment,Labels\n';
      const rows = expenses.map(exp =>
        `${exp.email},${exp.date},${exp.category},${exp.item},${exp.shopName},${exp.amount},${exp.paymentMode},"${exp.labels.join(', ')}"`
      ).join('\n');
      return headers + rows;
    } catch (error) {
      console.error('Error exporting to CSV:', error);
      throw error;
    }
  },
};
