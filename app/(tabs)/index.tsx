import { useState, useEffect, useCallback } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { storageService } from '@/utils/storage';
import { PAYMENT_MODES, Expense } from '@/types/expense';
import { CATEGORIES, CATEGORY_MAP } from '@/constants/categories';
import DatePicker from '@/components/DatePicker';
import Dropdown from '@/components/Dropdown';
import LabelSelector from '@/components/LabelSelector';
import {
  addExpenseToGoogleSheet,
  updateExpenseInGoogleSheet,
  deleteExpenseFromGoogleSheet as deleteExpenseFromGoogleSheetApi,
} from '@/utils/googleSheets';

export default function AddExpense() {
  const params = useLocalSearchParams<{ expense?: string }>();
  const router = useRouter();

  const [expenseId, setExpenseId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [date, setDate] = useState(new Date());
  const [category, setCategory] = useState('');
  const [subCategory, setSubCategory] = useState('');
  const [item, setItem] = useState('');
  const [shopName, setShopName] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentMode, setPaymentMode] = useState('');
  const [labels, setLabels] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [originalExpense, setOriginalExpense] = useState<Expense | null>(null);

  const subCategoryOptions = category ? CATEGORY_MAP[category] || [] : [];
  const isEditMode = !!expenseId;

  // ✅ Reset form fields
  const resetForm = () => {
    setExpenseId(null);
    setCategory('');
    setSubCategory('');
    setItem('');
    setShopName('');
    setAmount('');
    setPaymentMode('');
    setLabels([]);
    setDate(new Date());
    setOriginalExpense(null);
  };

  // ✅ Load stored user email
  const loadUserEmail = async () => {
    const savedEmail = await storageService.getUserEmail();
    if (savedEmail) setEmail(savedEmail);
  };

  // ✅ Check if form data has changed
  const hasChanges = useCallback(() => {
    if (!originalExpense) return false;

    const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString()
      .split('T')[0];

    return (
      email.trim() !== originalExpense.email ||
      localDate !== originalExpense.date ||
      category !== originalExpense.category ||
      subCategory !== originalExpense.subCategory ||
      item.trim() !== originalExpense.item ||
      shopName.trim() !== (originalExpense.shopName || '') ||
      Number(amount) !== originalExpense.amount ||
      paymentMode !== originalExpense.paymentMode ||
      JSON.stringify(labels.sort()) !== JSON.stringify((originalExpense.labels || []).sort())
    );
  }, [email, date, category, subCategory, item, shopName, amount, paymentMode, labels, originalExpense]);

  // ✅ Handle screen focus
  useFocusEffect(
    useCallback(() => {
      if (params.expense) {
        try {
          const expenseToEdit = JSON.parse(params.expense);
          setExpenseId(expenseToEdit.id);
          setEmail(expenseToEdit.email);
          setDate(new Date(expenseToEdit.date));
          setCategory(expenseToEdit.category);
          setSubCategory(expenseToEdit.subCategory);
          setItem(expenseToEdit.item);
          setShopName(expenseToEdit.shopName || '');
          setAmount(String(expenseToEdit.amount));
          setPaymentMode(expenseToEdit.paymentMode);
          setLabels(expenseToEdit.labels || []);
          setOriginalExpense(expenseToEdit);
        } catch (error) {
          console.error('Error parsing expense:', error);
          resetForm();
          loadUserEmail();
        }
      } else {
        resetForm();
        loadUserEmail();
      }

      const backAction = () => {
        if (expenseId) {
          handleCancel();
          return true;
        }
        return false;
      };

      const backHandler = BackHandler.addEventListener('hardwareBackPress', backAction);
      return () => backHandler.remove();
    }, [params.expense])
  );

  // ✅ Confirm cancel
  const handleCancel = useCallback(() => {
    Alert.alert('', 'Do you want to keep editing or discard changes?', [
      { text: 'Keep Editing', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          resetForm();
          router.replace('/(tabs)/dashboard');
        },
      },
    ]);
  }, [router]);

  // ✅ Add or update expense
  const handleSubmit = async () => {
    if (
      !email.trim() ||
      !category ||
      !subCategory ||
      !item.trim() ||
      !amount.trim() ||
      isNaN(Number(amount)) ||
      !paymentMode
    ) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    if (isEditMode && !hasChanges()) {
      Alert.alert('No Changes', 'No changes were made to this transaction.');
      return;
    }

    setIsSubmitting(true);

    try {
      await storageService.saveUserEmail(email);

      const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
        .toISOString()
        .split('T')[0];

      const expenseData: Omit<Expense, 'id' | 'timestamp'> = {
        email: email.trim(),
        date: localDate,
        category,
        subCategory,
        item: item.trim(),
        shopName: shopName.trim(),
        amount: Number(amount),
        paymentMode,
        labels,
      };

      if (expenseId) {
        // ✅ Update existing expense
        const updatedExpense: Expense = {
          ...expenseData,
          id: expenseId,
          timestamp: originalExpense?.timestamp || new Date().toISOString(),
        };

        await updateExpenseInGoogleSheet(updatedExpense);
        await storageService.updateExpenseOnly(updatedExpense);

        Alert.alert('Success', 'Transaction updated successfully!');
        resetForm(); // ✅ Stay on same screen
      } else {
        // ✅ Add new expense
        const newExpense: Expense = {
          ...expenseData,
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
        };

        await addExpenseToGoogleSheet(newExpense);
        await storageService.addExpenseOnly(newExpense);

        Alert.alert('Success', 'Expense added successfully!');
        resetForm(); // ✅ Stay on same screen
      }
    } catch (error) {
      console.error('❌ Error saving expense:', error);
      Alert.alert('Error', `Failed to ${expenseId ? 'update' : 'save'} expense.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        {/* Fixed Header */}
        <View style={styles.header}>
          <Text style={styles.title}>{isEditMode ? 'Edit Expense' : 'Add Expense'}</Text>
        </View>

        {/* Scrollable Content */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.formGroup}>
            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="your.email@example.com"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Date *</Text>
            <DatePicker value={date} onChange={setDate} />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Category *</Text>
            <Dropdown
              value={category}
              onChange={(value) => {
                setCategory(value);
                setSubCategory('');
              }}
              options={CATEGORIES}
              placeholder="Select category"
            />
          </View>

          {subCategoryOptions.length > 0 && (
            <View style={styles.formGroup}>
              <Text style={styles.label}>Sub-Category *</Text>
              <Dropdown
                value={subCategory}
                onChange={setSubCategory}
                options={subCategoryOptions}
                placeholder="Select sub-category"
              />
            </View>
          )}

          <View style={styles.formGroup}>
            <Text style={styles.label}>Item *</Text>
            <TextInput
              style={styles.input}
              value={item}
              onChangeText={setItem}
              placeholder="What did you spend on?"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Shop/Site/Person Name</Text>
            <TextInput
              style={styles.input}
              value={shopName}
              onChangeText={setShopName}
              placeholder="Vendor name"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Amount *</Text>
            <TextInput
              style={styles.input}
              value={amount}
              onChangeText={setAmount}
              placeholder="0.00"
              keyboardType="numeric"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Mode of Payment *</Text>
            <Dropdown
              value={paymentMode}
              onChange={setPaymentMode}
              options={PAYMENT_MODES}
              placeholder="Select payment mode"
            />
          </View>

          <View style={styles.formGroup}>
            <Text style={styles.label}>Labels</Text>
            <LabelSelector value={labels} onChange={setLabels} />
          </View>

          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.submitButtonText}>
              {isSubmitting ? 'Saving...' : isEditMode ? 'Update Expense' : 'Add Expense'}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    letterSpacing: -0.3,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  submitButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 12,
  },
  submitButtonDisabled: {
    backgroundColor: '#93c5fd',
  },
  submitButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});

// ✅ Delete Expense function (optional)
const GOOGLE_SHEET_URL =
  'https://script.google.com/macros/s/AKfycby0W_NemJENrAyV_U3W7sqVAozLqXLRyUm_TTn1te4aWGi4ZN8AJz8VuPavfN8KxD4C/exec';

export async function deleteExpenseFromGoogleSheetLocal(id: string): Promise<void> {
  try {
    const payload = { action: 'delete', id };
    console.log('📤 Sending DELETE request to Google Sheet:', payload);

    const response = await fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const result = await response.json();
    if (!result.success) throw new Error(result.message || 'Failed to delete expense');
    console.log('🗑️ Deleted expense from Google Sheet:', id);
  } catch (error) {
    console.error('❌ Error deleting expense from Google Sheet:', error);
    throw error;
  }
}