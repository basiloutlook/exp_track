import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Expense } from '@/types/expense';
import { Trash2 } from 'lucide-react-native';

interface ExpenseListProps {
  expenses: Expense[];
  onDelete: (id: string) => void;
}

export default function ExpenseList({ expenses, onDelete }: ExpenseListProps) {
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (expenses.length === 0) {
    return (
      <Text style={styles.emptyText}>No expenses to display</Text>
    );
  }

  return (
    <View style={styles.container}>
      {expenses.map((expense) => (
        <View key={expense.id} style={styles.expenseItem}>
          <View style={styles.expenseMain}>
            <View style={styles.expenseLeft}>
              <Text style={styles.expenseItem_name}>{expense.item}</Text>
              <Text style={styles.expenseCategory}>{expense.category}</Text>
              <Text style={styles.expenseDate}>{formatDate(expense.date)}</Text>
            </View>
            <View style={styles.expenseRight}>
              <Text style={styles.expenseAmount}>₹{expense.amount.toFixed(2)}</Text>
              <Text style={styles.expensePayment}>{expense.paymentMode}</Text>
            </View>
          </View>
          {expense.shopName && (
            <Text style={styles.expenseShop}>{expense.shopName}</Text>
          )}
          {(expense.labels?.length ?? 0) > 0 && (
            <View style={styles.labelsContainer}>
              {(expense.labels ?? []).map((label) => (
                <View key={label} style={styles.label}>
                  <Text style={styles.labelText}>{label}</Text>
                </View>
              ))}
            </View>
          )}

          <TouchableOpacity
            style={styles.deleteButton}
            onPress={() => onDelete(expense.id)}>
            <Trash2 size={16} color="#ef4444" />
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 12,
  },
  expenseItem: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    position: 'relative',
  },
  expenseMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  expenseLeft: {
    flex: 1,
  },
  expenseRight: {
    alignItems: 'flex-end',
  },
  expenseItem_name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  expenseCategory: {
    fontSize: 13,
    color: '#6b7280',
    marginBottom: 2,
  },
  expenseDate: {
    fontSize: 12,
    color: '#9ca3af',
  },
  expenseAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  expensePayment: {
    fontSize: 12,
    color: '#6b7280',
  },
  expenseShop: {
    fontSize: 13,
    color: '#374151',
    marginTop: 8,
    fontStyle: 'italic',
  },
  labelsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  label: {
    backgroundColor: '#e0e7ff',
    borderRadius: 12,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  labelText: {
    fontSize: 11,
    color: '#3730a3',
  },
  deleteButton: {
    position: 'absolute',
    top: 8,
    right: 8,
    padding: 4,
  },
  emptyText: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
