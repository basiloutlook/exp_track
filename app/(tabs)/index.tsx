import { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { storageService } from '@/utils/storage';
import { PAYMENT_MODES, Expense } from '@/types/expense';
import { CATEGORIES, CATEGORY_MAP } from '@/constants/categories';
import DatePicker from '@/components/DatePicker';
import Dropdown from '@/components/Dropdown';
import LabelSelector from '@/components/LabelSelector';

export default function AddExpense() {
  const { expense: expenseString } = useLocalSearchParams<{ expense?: string }>();
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

  const subCategoryOptions = category ? CATEGORY_MAP[category] || [] : [];

  useEffect(() => {
    if (expenseString) {
      const expenseToEdit = JSON.parse(expenseString);
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
    } else {
      loadUserEmail();
    }
  }, [expenseString]);

  const loadUserEmail = async () => {
    const savedEmail = await storageService.getUserEmail();
    if (savedEmail) {
      setEmail(savedEmail);
    }
  };

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
    // Do not reset email
  };

  const handleSubmit = async () => {
    if (!email.trim() || !category || !subCategory || !item.trim() || !amount.trim() || isNaN(Number(amount)) || !paymentMode) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      await storageService.saveUserEmail(email);

      const expenseData: Omit<Expense, 'id' | 'timestamp'> = {
        email: email.trim(),
        date: date.toISOString().split('T')[0],
        category,
        subCategory,
        item: item.trim(),
        shopName: shopName.trim(),
        amount: Number(amount),
        paymentMode,
        labels,
      };

      if (expenseId) {
        // Update existing expense
        const updatedExpense: Expense = { ...expenseData, id: expenseId, timestamp: new Date().toISOString() };
        await storageService.updateExpense(updatedExpense);
        Alert.alert('Success', 'Expense updated successfully!');
        router.push('/dashboard');
      } else {
        // Add new expense
        const newExpense: Expense = {
          ...expenseData,
          id: Date.now().toString(),
          timestamp: new Date().toISOString(),
        };
        await storageService.saveExpense(newExpense);
        Alert.alert('Success', 'Expense added successfully!');
        resetForm();
      }
    } catch (error) {
      Alert.alert('Error', `Failed to ${expenseId ? 'update' : 'save'} expense. Please try again.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = () => {
    Alert.alert(
      'Discard Changes?',
      'Are you sure you want to discard your changes? This action cannot be undone.',
      [
        { text: 'Keep Editing', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => router.push('/dashboard'),
        },
      ]
    );
  };

  const isEditMode = !!expenseId;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>{isEditMode ? 'Edit Expense' : 'Add Expense'}</Text>

      {isEditMode && (
        <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      )}

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
          placeholder="Select a category"
        />
      </View>

      {subCategoryOptions.length > 0 && (
        <View style={styles.formGroup}>
          <Text style={styles.label}>Sub-Category *</Text>
          <Dropdown
            value={subCategory}
            onChange={setSubCategory}
            options={subCategoryOptions}
            placeholder="Select a sub-category"
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
        disabled={isSubmitting}>
        <Text style={styles.submitButtonText}>
          {isSubmitting ? 'Saving...' : (isEditMode ? 'Update Expense' : 'Add Expense')}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  cancelButton: {
    position: 'absolute',
    top: 28,
    right: 20,
    padding: 8,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  cancelButtonText: {
    color: '#ef4444',
    fontWeight: '600',
  },
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 24,
    marginTop: 20,
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