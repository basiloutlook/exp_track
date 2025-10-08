import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense } from '@/types/expense';

const EXPENSES_KEY = '@expenses';
const USER_EMAIL_KEY = '@user_email';

export const storageService = {
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
