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
import { storageService } from '@/utils/storage';
import { PAYMENT_MODES, Expense } from '@/types/expense';
import { CATEGORIES, CATEGORY_MAP } from '@/constants/categories';
import DatePicker from '@/components/DatePicker';
import Dropdown from '@/components/Dropdown';
import LabelSelector from '@/components/LabelSelector';

export default function AddExpense() {
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
    loadUserEmail();
  }, []);

  const loadUserEmail = async () => {
    const savedEmail = await storageService.getUserEmail();
    if (savedEmail) {
      setEmail(savedEmail);
    }
  };

  const handleSubmit = async () => {
    if (!email.trim()) {
      Alert.alert('Error', 'Please enter your email');
      return;
    }

    if (!category) {
      Alert.alert('Error', 'Please select a category');
      return;
    }

    if (!subCategory) {
      Alert.alert('Error', 'Please select a sub-category');
      return;
    }

    if (!item.trim()) {
      Alert.alert('Error', 'Please enter an item');
      return;
    }

    if (!amount.trim() || isNaN(Number(amount))) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!paymentMode) {
      Alert.alert('Error', 'Please select a payment mode');
      return;
    }

    setIsSubmitting(true);

    try {
      await storageService.saveUserEmail(email);

      const expense: Expense = {
        id: Date.now().toString(),
        email: email.trim(),
        date: date.toISOString().split('T')[0],
        category,
        subCategory, // ✅ new
        item: item.trim(),
        shopName: shopName.trim(),
        amount: Number(amount),
        paymentMode,
        labels,
        timestamp: new Date().toISOString(),
      };

      await storageService.saveExpense(expense);

      Alert.alert('Success', 'Expense added successfully!');

      setCategory('');
      setSubCategory('');
      setItem('');
      setShopName('');
      setAmount('');
      setPaymentMode('');
      setLabels([]);
      setDate(new Date());
    } catch (error) {
      Alert.alert('Error', 'Failed to save expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      <Text style={styles.title}>Add Expense</Text>

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
          {isSubmitting ? 'Saving...' : 'Add Expense'}
        </Text>
      </TouchableOpacity>
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
