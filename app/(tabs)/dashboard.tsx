import { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Share,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { storageService } from '@/utils/storage';
import { Expense } from '@/types/expense';
import { Download, Trash2, TrendingUp, Calendar, CreditCard } from 'lucide-react-native';
import ExpenseList from '@/components/ExpenseList';
import StatCard from '@/components/StatCard';
import { getExpensesFromGoogleSheet } from '@/utils/googleSheets';


export default function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadExpenses();
    }, [])
  );

  const loadExpenses = async () => {
  setIsLoading(true);
  try {
    // Try fetching from Google Sheets first
    const sheetExpenses = await getExpensesFromGoogleSheet();
    const hasSheetData = Array.isArray(sheetExpenses) && sheetExpenses.length > 0;

    if (hasSheetData) {
      console.log("✅ Loaded from Google Sheet:", sheetExpenses.length);
      setExpenses(sheetExpenses.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
    } else {
      // Fallback to local storage
      console.log("⚠️ Falling back to local storage");
      const localData = await storageService.getExpenses();
      const safeLocal = Array.isArray(localData) ? localData : [];
      setExpenses(safeLocal.sort((a, b) =>
        new Date(b.date).getTime() - new Date(a.date).getTime()
      ));
    }
  } catch (error) {
    console.error("loadExpenses error:", error);
    Alert.alert('Error', 'Failed to load expenses');
  } finally {
    setIsLoading(false);
  }
};


  const handleDeleteExpense = async (id: string) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await storageService.deleteExpense(id);
              await loadExpenses();
              Alert.alert('Success', 'Expense deleted successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to delete expense');
            }
          },
        },
      ]
    );
  };

  const handleExport = async () => {
    try {
      const csv = await storageService.exportToCSV();
      if (csv) {
        await Share.share({
          message: csv,
          title: 'Expense Report',
        });
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to export data');
    }
  };

  const calculateStats = () => {
    const total = expenses.reduce((sum, exp) => sum + exp.amount, 0);
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    const monthlyExpenses = expenses.filter(exp => {
      const expDate = new Date(exp.date);
      return expDate.getMonth() === currentMonth && expDate.getFullYear() === currentYear;
    });

    const monthlyTotal = monthlyExpenses.reduce((sum, exp) => sum + exp.amount, 0);

    const categoryTotals: { [key: string]: number } = {};
    expenses.forEach(exp => {
      categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    });

    const topCategory = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)[0];

    const paymentModeTotals: { [key: string]: number } = {};
    expenses.forEach(exp => {
      paymentModeTotals[exp.paymentMode] = (paymentModeTotals[exp.paymentMode] || 0) + exp.amount;
    });

    return {
      total,
      monthlyTotal,
      topCategory: topCategory ? { name: topCategory[0], amount: topCategory[1] } : null,
      categoryTotals,
      paymentModeTotals,
      count: expenses.length,
      monthlyCount: monthlyExpenses.length,
    };
  };

  const stats = calculateStats();

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <TouchableOpacity
          style={styles.exportButton}
          onPress={handleExport}
          disabled={expenses.length === 0}>
          <Download size={20} color="#ffffff" />
          <Text style={styles.exportButtonText}>Export</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <StatCard
          icon={<TrendingUp size={24} color="#2563eb" />}
          title="Total Expenses"
          value={`₹${stats.total.toFixed(2)}`}
          subtitle={`${stats.count} transactions`}
        />
        <StatCard
          icon={<Calendar size={24} color="#10b981" />}
          title="This Month"
          value={`₹${stats.monthlyTotal.toFixed(2)}`}
          subtitle={`${stats.monthlyCount} transactions`}
        />
      </View>

      {stats.topCategory && (
        <View style={styles.topCategoryCard}>
          <Text style={styles.sectionTitle}>Top Category</Text>
          <View style={styles.topCategoryContent}>
            <Text style={styles.topCategoryName}>{stats.topCategory.name}</Text>
            <Text style={styles.topCategoryAmount}>
              ₹{stats.topCategory.amount.toFixed(2)}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Category Breakdown</Text>
        {Object.entries(stats.categoryTotals)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 5)
          .map(([category, amount]) => (
            <View key={category} style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>{category}</Text>
              <Text style={styles.breakdownAmount}>₹{amount.toFixed(2)}</Text>
            </View>
          ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Mode Breakdown</Text>
        {Object.entries(stats.paymentModeTotals)
          .sort(([, a], [, b]) => b - a)
          .map(([mode, amount]) => (
            <View key={mode} style={styles.breakdownItem}>
              <Text style={styles.breakdownLabel}>{mode}</Text>
              <Text style={styles.breakdownAmount}>₹{amount.toFixed(2)}</Text>
            </View>
          ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recent Expenses</Text>
        <ExpenseList
          expenses={expenses.slice(0, 10)}
          onDelete={handleDeleteExpense}
        />
      </View>

      {expenses.length === 0 && !isLoading && (
        <View style={styles.emptyState}>
          <Text style={styles.emptyStateText}>No expenses yet</Text>
          <Text style={styles.emptyStateSubtext}>
            Start by adding your first expense
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  exportButton: {
    backgroundColor: '#2563eb',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  topCategoryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  topCategoryContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  topCategoryName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  topCategoryAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2563eb',
  },
  section: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  breakdownItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  breakdownLabel: {
    fontSize: 14,
    color: '#374151',
  },
  breakdownAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  emptyStateText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 14,
    color: '#9ca3af',
  },
});
