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
import { alertEngine } from '@/utils/alertEngine';
import { enqueueSync, initAutoSync  } from '@/utils/syncService';

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

    // ✅ Auto-sync retry initialization
  useEffect(() => {
    initAutoSync();
  }, []);

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
          Alert.alert('Success', isEditMode ? 'Expense updated successfully!' : 'Expense added successfully!');
        },
      },
    ]);
  }, [router]);

  // ✅ Add or update expense
  const handleSubmit = async () => {
  if (!email.trim() || !category || !subCategory || !item.trim() || !amount.trim() || !paymentMode) {
    Alert.alert('Error', 'Please fill all required fields.');
    return;
  }

  setIsSubmitting(true);
  await storageService.saveUserEmail(email);

  const formattedDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString().split('T')[0];

  const expData: Expense = {
    id: expenseId || Date.now().toString(),
    timestamp: new Date().toISOString(),
    email,
    date: formattedDate,
    category,
    subCategory,
    item,
    shopName,
    amount: Number(amount),
    paymentMode,
    labels,
  };

  // ✅ 1. Optimistic Local Save (instant feedback)
  if (expenseId) {
    await storageService.updateExpenseOnly(expData);
    Alert.alert('Success', 'Expense updated (syncing in background...)');
    enqueueSync({ action: 'update', ...expData });
 // background sync
  } else {
    await storageService.addExpenseOnly(expData);
    Alert.alert('Success', 'Expense added (syncing in background...)');
    enqueueSync({ action: 'add', ...expData }); // background sync
  }

  // ✅ 2. Optional: trigger alerts if you use alertEngine
  const all = await storageService.getExpenses();
  await alertEngine.triggerImmediateNotification(all || [], expData);

  // ✅ 3. Cleanup and navigate back
  resetForm();
  setIsSubmitting(false);
  Alert.alert('Success', isEditMode ? 'Expense updated successfully!' : 'Expense added successfully!');
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
  'https://script.google.com/macros/s/AKfycbwXdK1Bh9DrFsOKdMlOpQZEWTQ7AONBhtuneRXY-S8ooD8Uem44eLObwgRl2loLaYMk/exec';

// ✅ Add this helper function after imports or constants
const sendToGoogle = async (payload: any) => {
  try {
    await fetch(GOOGLE_SHEET_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.warn('Background sync failed:', err);
  }
};

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