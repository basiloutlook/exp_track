import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  Pressable,
} from 'react-native';
import { deleteExpenseFromGoogleSheet } from '@/utils/googleSheets';
import { useFocusEffect } from '@react-navigation/native';
import { useRouter } from 'expo-router';
import { storageService } from '@/utils/storage';
import { Expense } from '@/types/expense';
import { Filter, Trash2, TrendingUp, Calendar, X, ChevronDown, ChevronUp, ArrowUp, ArrowDown, Pencil } from 'lucide-react-native';
import StatCard from '@/components/StatCard';
import { getExpensesFromGoogleSheet } from '@/utils/googleSheets';
const DateTimePickerModal = require('react-native-modal-datetime-picker').default;
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';
import { SafeAreaView } from 'react-native-safe-area-context';

interface Quarter {
  label: string;
  startDate: Date;
  endDate: Date;
}

// FIXED: Proper quarterly calculation
const calculateQuarters = (currentDate: Date): Quarter[] => {
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();

  const quarters: Quarter[] = [];

  // Calculate 4 complete quarters going backwards from current month
  for (let i = 0; i < 4; i++) {
    // Calculate the end month (last month before current month - i*3)
    const endMonthIndex = currentMonth - 1 - (i * 3);
    
    // Calculate dates
    const endDate = new Date(currentYear, endMonthIndex + 1, 0); // Last day of end month
    const startDate = new Date(currentYear, endMonthIndex - 2, 1); // First day of start month (3 months back)

    const quarterLabel = `${startDate.toLocaleString('default', { month: 'short' })} '${String(startDate.getFullYear()).slice(2)} - ${endDate.toLocaleString('default', { month: 'short' })} '${String(endDate.getFullYear()).slice(2)}`;

    quarters.push({
      label: quarterLabel,
      startDate: startDate,
      endDate: endDate,
    });
  }

  return quarters.reverse(); // Show oldest to newest
};
const styles = StyleSheet.create({
  safeArea: {
  flex: 1,
  backgroundColor: '#f9fafb',
},
scrollView: {
  flex: 1,
},
  container: { 
  flex: 1, 
  backgroundColor: '#f9fafb' 
} ,
  contentContainer: { 
  padding: 20, 
  paddingTop: 0,
  paddingBottom: 40 
},
  header: { 
  backgroundColor: '#ffffff',
  paddingHorizontal: 20,
  paddingVertical: 12,
  borderBottomWidth: 1,
  borderBottomColor: '#e5e7eb',
  flexDirection: 'row', 
  justifyContent: 'space-between', 
  alignItems: 'center'
},
  title: { 
  fontSize: 20,
  fontWeight: '600',
  color: '#111827',
  letterSpacing: -0.3,
},
  filterButton: { backgroundColor: '#2563eb', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  filterButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
  subCategoryContainer: {
    marginLeft: 20,
    marginTop: 8,
    marginBottom: 8,
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: '#60a5fa',
},
subCategoryTitle: {
    fontSize: 13,
    fontWeight: '500',
    color: '#6b7280',
    marginBottom: 6,
},
subCategoryOption: {
    padding: 8,
    borderRadius: 6,
    backgroundColor: '#f9fafb',
    marginBottom: 4,
},
subCategoryOptionSelected: {
    backgroundColor: '#dbeafe',
    borderWidth: 1,
    borderColor: '#60a5fa',
},
subCategoryOptionText: {
    fontSize: 13,
    color: '#374151',
},
  statsGrid: { flexDirection: 'row', gap: 12, marginBottom: 20 },
  section: { backgroundColor: '#ffffff', borderRadius: 12, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#111827', marginBottom: 12 },
  breakdownItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f3f4f6' },
  breakdownLabel: { fontSize: 14, color: '#374151' },
  breakdownAmount: { fontSize: 14, fontWeight: '600', color: '#111827' },
  emptyState: { alignItems: 'center', paddingVertical: 40 },
  emptyStateText: { fontSize: 18, fontWeight: '600', color: '#6b7280' },
  chartContainer: { backgroundColor: 'white', borderRadius: 12, padding: 16, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2 },
  barChartItem: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 },
  drilldownHeader: { marginBottom: 10 },
  backButton: { color: '#2563eb', fontWeight: '600' },
  maGrid: { flexDirection: 'row', justifyContent: 'space-around', flexWrap: 'wrap', gap: 10 },
  maCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: '#f3f4f6',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    position: 'relative',
  },
  maValue: { fontSize: 16, fontWeight: '700', color: '#111827' },
  maLabel: { fontSize: 12, color: '#6b7280', marginTop: 4 },
  maComparison: {
    position: 'absolute',
    top: 6,
    right: 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  maComparisonText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 2,
  },
  redText: {
    color: '#ef4444',
  },
  greenText: {
    color: '#10b981',
  },
  grayText: {
    color: '#9ca3af',
  },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  sidebarContainer: { 
  flex: 1,
  backgroundColor: '#f9fafb', 
  padding: 20, 
  shadowColor: '#000', 
  shadowOffset: { width: -2, height: 0 }, 
  shadowOpacity: 0.1, 
  shadowRadius: 5, 
  elevation: 10 
},
sidebarSafeArea: {
  position: 'absolute',
  right: 0,
  top: 0,
  bottom: 0,
  width: '80%',
  backgroundColor: '#f9fafb',
},
  sidebarHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#e5e7eb', paddingBottom: 12, marginBottom: 16 },
  sidebarTitle: { fontSize: 20, fontWeight: '600' },
  sidebarFooter: { paddingTop: 16, borderTopWidth: 1, borderTopColor: '#e5e7eb', flexDirection: 'row', gap: 12 },
  sidebarButton: { flex: 1, padding: 12, borderRadius: 8, alignItems: 'center' },
  resetButton: { backgroundColor: '#e5e7eb' },
  resetButtonText: { color: '#1f2937', fontWeight: '600' },
  applyButton: { backgroundColor: '#2563eb' },
  applyButtonText: { color: 'white', fontWeight: '600' },
  filterSectionTitle: { fontSize: 16, fontWeight: '600', color: '#374151', marginTop: 10, marginBottom: 8 },
  filterOption: { padding: 10, borderRadius: 6, backgroundColor: '#fff', marginBottom: 6 },
  filterOptionSelected: { backgroundColor: '#dbeafe', borderWidth: 1, borderColor: '#60a5fa' },
  filterOptionText: { color: '#1f2937' },
  emptyText: { color: '#9ca3af', textAlign: 'center' },
  dateFilterContainer: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, marginBottom: 16, },
  dateButton: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e5e7eb' },
  dateLabel: { fontSize: 12, color: '#6b7280', marginBottom: 4, },
  dateValue: { fontSize: 14, fontWeight: '600', color: '#111827' },
  drillDownIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#60a5fa',
    padding: 10,
    borderRadius: 8,
    marginBottom: 16,
  },
  drillDownText: {
    color: 'white',
    fontWeight: '600',
    flexShrink: 1,
    marginRight: 10,
  },
  clearDrillDownButton: {
    padding: 4,
    borderRadius: 10,
    backgroundColor: '#3b82f6',
  },
  paginationControls: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    paddingTop: 8,
  },
  moreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#e0f2fe',
  },
  collapseButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 6,
    borderRadius: 6,
    backgroundColor: '#e0f2fe',
  },
  paginationText: {
    color: '#2563eb',
    fontWeight: '600',
    fontSize: 12,
    marginRight: 4,
  },
  detailContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
    alignSelf: 'stretch',
  },
  detailLeft: {
    justifyContent: 'flex-start',
  },
  detailRight: {
    justifyContent: 'flex-end',
  },
  detailText: {
    fontSize: 11,
    color: '#9ca3af',
    fontStyle: 'italic',
    flexShrink: 1,
  },
  expenseItemContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  expenseItemLeft: {
    flex: 1,
    marginRight: 10,
  },
  expenseItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseItemDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
  },
  expenseItemMeta: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  expenseItemAmount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginRight: 16,
  },
  expenseItemActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionButton: {
    padding: 4,
  },
  comparisonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 8,
  },
  comparisonCard: {
    flex: 1,
    minWidth: '47%',
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  comparisonCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  comparisonLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    flex: 1,
  },
  comparisonBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
  },
  comparisonText: {
    fontSize: 10,
    fontWeight: '700',
    marginLeft: 2,
  },
  comparisonValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  expensesList: {
    marginTop: 8,
  },
  expenseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  expenseLabel: {
    fontSize: 14,
    color: '#374151',
  },
  expenseValueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  expenseValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginRight: 8,
  },
  indicatorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  percentageText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 4,
  },
  // ADD THESE STYLES:
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    flexWrap: 'wrap',
    gap: 8,
  },
  sortControls: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sortButtonActive: {
    backgroundColor: '#dbeafe',
    borderColor: '#60a5fa',
  },
  sortButtonText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  sortButtonTextActive: {
    color: '#2563eb',
    fontWeight: '600',
  },
});

const ExpenseList = ({ expenses, onEdit, onDelete }: { expenses: Expense[], onEdit: (expense: Expense) => void, onDelete: (id: string) => void }) => {
    return (
        <View>
            {expenses.map((expense) => {
                const expenseDate = new Date(expense.date);
                const formattedDate = expenseDate.toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                });

                const detailsToShow = [];
                const categoryString = expense.category || 'Uncategorized';
                const subCategoryString = expense.subCategory ? ` (${expense.subCategory})` : '';
                const fullCategoryDisplay = `${categoryString}${subCategoryString}`;
                
                detailsToShow.push(fullCategoryDisplay);
                if (expense.shopName) {
                    detailsToShow.push(expense.shopName);
                }
                detailsToShow.push(formattedDate);

                return (
                    <View key={expense.id} style={styles.expenseItemContainer}>
                        <View style={styles.expenseItemLeft}>
                            <Text style={styles.expenseItemDescription}>{expense.item}</Text>
                            {detailsToShow.map((detail, index) => (
                                <Text key={index} style={styles.expenseItemMeta}>{detail}</Text>
                            ))}
                        </View>
                        <View style={styles.expenseItemRight}>
                             <Text style={styles.expenseItemAmount}>{`₹${Number(expense.amount).toFixed(2)}`}</Text>
                             <View style={styles.expenseItemActions}>
                                <TouchableOpacity onPress={() => onEdit(expense)} style={styles.actionButton}>
                                    <Pencil size={18} color="#6b7280" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => onDelete(expense.id)} style={styles.actionButton}>
                                    <Trash2 size={18} color="#ef4444" />
                                </TouchableOpacity>
                             </View>
                        </View>
                    </View>
                );
            })}
        </View>
    );
};

const getDefaultStartDate = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() - 12, 1);
};

const defaultFilters = {
    category: null as string | null,
    subCategory: null as string | null,
    labels: [] as string[],
    startDate: getDefaultStartDate(),
    endDate: new Date(),
};

// Define the structure for quarterly data items
interface QuarterData {
  label: string;
  value: number;
  startDate: Date;
  endDate: Date;
  valueChange: number; // Added valueChange to track increase/decrease
}

// Refactored ComparisonCard to use valueChange instead of comparison
const ComparisonCard = ({ item, onPress }: { item: QuarterData; onPress?: (item: QuarterData) => void }) => {
    const hasPriorData = item.valueChange !== 0;
    const isIncrease = item.valueChange > 0;
    const percentageChange = hasPriorData ? (item.valueChange / (item.value - item.valueChange)) * 100 : 0;

    const color = hasPriorData
        ? (isIncrease ? styles.redText : styles.greenText)
        : styles.grayText;
    const ArrowIcon = isIncrease ? ArrowUp : ArrowDown;
    const percentage = Math.abs(percentageChange).toFixed(0);

    return (
        <TouchableOpacity
            style={styles.comparisonCard}
            onPress={() => onPress?.(item)}
            disabled={!onPress}
        >
            <View style={styles.comparisonCardHeader}>
                <Text style={styles.comparisonLabel}>{item.label}</Text>
                {hasPriorData && (
                    <View style={styles.comparisonBadge}>
                        <ArrowIcon size={10} color={color.color} />
                        <Text style={[styles.comparisonText, color]}>{percentage}%</Text>
                    </View>
                )}
            </View>
            <Text style={styles.comparisonValue}>{`₹${item.value.toFixed(2)}`}</Text>
        </TouchableOpacity>
    );
};

const BarChart = ({ title, data, onItemPress, detailText = '', detailPosition = 'right' }: {
    title: string;
    data: QuarterData[];
    onItemPress?: (data: QuarterData) => void;
    detailText?: string;
    detailPosition?: 'left' | 'right';
}) => {
  const items = Array.isArray(data) ? data.slice() : [];

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.sectionTitle}>{String(title)}</Text>
      <View style={styles.comparisonGrid}>
        {items.map(item => (
          <ComparisonCard key={String(item.label)} item={item} onPress={onItemPress} />
        ))}
      </View>
      {detailText ? (
        <View style={[styles.detailContainer, detailPosition === 'right' ? styles.detailRight : styles.detailLeft]}>
            <Text style={styles.detailText}>{detailText}</Text>
        </View>
      ) : null}
    </View>
  );
};

const PieChart = ({ title, data, onSlicePress, noContainerStyle = false, showCount, onShowMore, onCollapse, detailText = '', detailPosition = 'right' }: {
    title: string;
    data: { name: string; value: number }[] | any;
    onSlicePress?: (name: string) => void;
    noContainerStyle?: boolean;
    showCount?: number;
    onShowMore?: () => void;
    onCollapse?: () => void;
    detailText?: string;
    detailPosition?: 'left' | 'right';
}) => {
  const items = Array.isArray(data)
    ? data.slice().map((it: any) => ({
        name: String(it?.name ?? ''),
        value: Number(it?.value ?? 0),
      }))
    : [];

  const sorted = items.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0));
  const visibleItems = showCount !== undefined ? sorted.slice(0, showCount) : sorted;
  const totalItems = sorted.length;
  const canShowMore = showCount !== undefined && totalItems > showCount;
  const canCollapse = showCount !== undefined && showCount > 5;

  return (
    <View style={noContainerStyle ? {} : styles.chartContainer}>
      <Text style={styles.sectionTitle}>{String(title)}</Text>
      {visibleItems.length > 0 ? visibleItems.map(item => (
        <TouchableOpacity
          key={String(item.name)}
          style={styles.breakdownItem}
          onPress={() => onSlicePress?.(String(item.name))}
        >
          <Text style={styles.breakdownLabel}>{String(item.name)}</Text>
          <Text style={styles.breakdownAmount}>{`₹${Number(item.value).toFixed(2)}`}</Text>
        </TouchableOpacity>
      )) : <Text style={styles.emptyText}>No data for this period</Text>}

      {showCount !== undefined && (canShowMore || canCollapse) && (
          <View style={styles.paginationControls}>
              {canCollapse && (
                  <TouchableOpacity style={styles.collapseButton} onPress={onCollapse}>
                      <Text style={styles.paginationText}>Collapse</Text>
                      <ChevronUp size={16} color="#2563eb" />
                  </TouchableOpacity>
              )}
              {canShowMore && (
                  <TouchableOpacity style={styles.moreButton} onPress={onShowMore}>
                      <Text style={styles.paginationText}>More ({totalItems - showCount} left)</Text>
                      <ChevronDown size={16} color="#2563eb" />
                  </TouchableOpacity>
              )}
          </View>
      )}

      {detailText ? (
        <View style={[styles.detailContainer, detailPosition === 'right' ? styles.detailRight : styles.detailLeft]}>
            <Text style={styles.detailText}>{detailText}</Text>
        </View>
      ) : null}
    </View>
  );
};

const FilterSidebar = ({ visible, onClose, onApply, initialFilters, options }: any) => {
      const makeInitial = (): any => {
        const src = initialFilters || defaultFilters;
        return {
          category: src.category ?? null,
          subCategory: src.subCategory ?? null,
          labels: Array.isArray(src.labels) ? [...src.labels] : [],
          startDate: src.startDate instanceof Date ? new Date(src.startDate) : new Date(defaultFilters.startDate),
          endDate: src.endDate instanceof Date ? new Date(src.endDate) : new Date(defaultFilters.endDate),
        };
      };

      const [localFilters, setLocalFilters] = useState(makeInitial);
      const [isDatePickerVisible, setDatePickerVisible] = useState(false);
      const [datePickerTarget, setDatePickerTarget] = useState<'startDate' | 'endDate'>('startDate');

      useEffect(() => {
        if(visible) {
            setLocalFilters(makeInitial());
        }
      }, [initialFilters, visible]);

      const handleApply = () => {
        onApply({
          ...localFilters,
          startDate: new Date(localFilters.startDate),
          endDate: new Date(localFilters.endDate),
          labels: Array.isArray(localFilters.labels) ? [...localFilters.labels] : [],
        });
      };

      const handleReset = () => {
        const resetState = {
            category: null,
            subCategory: null,
            labels: [] as string[],
            startDate: new Date(defaultFilters.startDate),
            endDate: new Date(defaultFilters.endDate),
        };
        setLocalFilters(resetState);
      };

      const showDatePicker = (target: 'startDate' | 'endDate') => {
        setDatePickerTarget(target);
        setDatePickerVisible(true);
      };

      const handleConfirmDate = (date: Date) => {
        setLocalFilters((prev: any) => ({ ...prev, [datePickerTarget]: date }));
        setDatePickerVisible(false);
      };

      const toggleLabel = (label: string) => {
        setLocalFilters((prev: any) => {
            const newLabels = prev.labels.includes(label)
                ? prev.labels.filter((l: string) => l !== label)
                : [...prev.labels, label];
            return { ...prev, labels: newLabels };
        });
      };

      const selectCategory = (cat: string) => {
        setLocalFilters((prev: any) => ({
            ...prev,
            category: prev.category === cat ? null : cat,
            subCategory: prev.category === cat ? null : prev.subCategory,
        }));
      };

      const selectSubCategory = (subCat: string) => {
        setLocalFilters((prev: any) => ({
            ...prev,
            subCategory: prev.subCategory === subCat ? null : subCat,
        }));
      };

      const currentCategory = localFilters.category;
      const currentSubCategory = localFilters.subCategory;
      const currentLabels = localFilters.labels;

      return (
  <Modal visible={visible} transparent={true} animationType="slide" onRequestClose={onClose}>
    <Pressable style={styles.modalBackdrop} onPress={onClose} />
    <SafeAreaView style={styles.sidebarSafeArea} edges={['top', 'bottom']}>
      <View style={styles.sidebarContainer}>
            <DateTimePickerModal
                isVisible={isDatePickerVisible}
                mode="date"
                onConfirm={handleConfirmDate}
                onCancel={() => setDatePickerVisible(false)}
                date={localFilters?.[datePickerTarget] instanceof Date ? localFilters[datePickerTarget] : new Date()}
            />
            <View style={styles.sidebarHeader}>
                <Text style={styles.sidebarTitle}>Filters</Text>
                <TouchableOpacity onPress={onClose}><X size={24} color="#6b7280" /></TouchableOpacity>
            </View>

            <ScrollView>
                <Text style={styles.filterSectionTitle}>Date Range</Text>
                <View style={styles.dateFilterContainer}>
                    <TouchableOpacity style={styles.dateButton} onPress={() => showDatePicker('startDate')}>
                        <Text style={styles.dateLabel}>From</Text>
                        <Text style={styles.dateValue}>{localFilters.startDate instanceof Date ? localFilters.startDate.toLocaleDateString() : '—'}</Text>
                    </TouchableOpacity>
                     <TouchableOpacity style={styles.dateButton} onPress={() => showDatePicker('endDate')}>
                        <Text style={styles.dateLabel}>To</Text>
                        <Text style={styles.dateValue}>{localFilters.endDate instanceof Date ? localFilters.endDate.toLocaleDateString() : '—'}</Text>
                    </TouchableOpacity>
                </View>
<Text style={styles.filterSectionTitle}>Labels</Text>
                {(options?.labels || []).map((l: string) =>
                    <TouchableOpacity key={l} onPress={() => toggleLabel(l)} style={[styles.filterOption, currentLabels.includes(l) && styles.filterOptionSelected]}>
                        <Text style={styles.filterOptionText}>{l}</Text>
                    </TouchableOpacity>
                )}

                <Text style={styles.filterSectionTitle}>Category</Text>
{(options?.categories || []).map((c: string) => (
    <View key={c}>
        <TouchableOpacity 
            onPress={() => selectCategory(c)} 
            style={[styles.filterOption, currentCategory === c && styles.filterOptionSelected]}
        >
            <Text style={styles.filterOptionText}>{c}</Text>
        </TouchableOpacity>
        
        {currentCategory === c && (
            <View style={styles.subCategoryContainer}>
                {(options?.categoryMap?.[c] || []).map((sc: string) => (
                    <TouchableOpacity 
                        key={sc} 
                        onPress={() => selectSubCategory(sc)} 
                        style={[styles.subCategoryOption, currentSubCategory === sc && styles.subCategoryOptionSelected]}
                    >
                        <Text style={styles.subCategoryOptionText}>{sc}</Text>
                    </TouchableOpacity>
                ))}
            </View>
        )}
    </View>
))}

                
            </ScrollView>

            <View style={styles.sidebarFooter}>
                <TouchableOpacity style={[styles.sidebarButton, styles.resetButton]} onPress={handleReset}>
                    <Text style={styles.resetButtonText}>Reset</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sidebarButton, styles.applyButton]} onPress={handleApply}>
                    <Text style={styles.applyButtonText}>Apply</Text>
                </TouchableOpacity>
            </View>
      </View>
    </SafeAreaView>
  </Modal>
);

};

const MovingAverageCard = ({ title, maValue, comparison }: {
    title: string;
    maValue: number;
    comparison: {
        percentageChange: number;
        isIncrease: boolean;
        hasPriorData: boolean;
    }
}) => {
    const { percentageChange, isIncrease, hasPriorData } = comparison;
    const color = hasPriorData
        ? (isIncrease ? styles.redText : styles.greenText)
        : styles.grayText;
    const ArrowIcon = isIncrease ? ArrowUp : ArrowDown;
    const percentage = Math.abs(percentageChange).toFixed(0);

    return (
        <View style={styles.maCard}>
            {hasPriorData && (
                <View style={styles.maComparison}>
                    <ArrowIcon size={12} color={color.color} />
                    <Text style={[styles.maComparisonText, color]}>{percentage}%</Text>
                </View>
            )}
            <Text style={styles.maValue}>₹{maValue.toFixed(0)}</Text>
            <Text style={styles.maLabel}>{title}</Text>
        </View>
    );
};

const ITEMS_PER_LOAD = 5;

type SortBy = 'date' | 'amount';
type SortOrder = 'asc' | 'desc';

export default function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<any>({ ...defaultFilters });
  const [selectedCategoryForDrill, setSelectedCategoryForDrill] = useState<string | null>(null);
  const [selectedSubCategoryForDrill, setSelectedSubCategoryForDrill] = useState<string | null>(null);
  const [categoryShowCount, setCategoryShowCount] = useState(ITEMS_PER_LOAD);
  const [transactionShowCount, setTransactionShowCount] = useState(ITEMS_PER_LOAD);
  const [quarters, setQuarters] = useState<Quarter[]>([]);
  const [drillDownDateFilter, setDrillDownDateFilter] = useState<{ startDate: Date, endDate: Date } | null>(null);
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const router = useRouter();

  const loadExpenses = useCallback(async () => {
    setIsLoading(true);
    try {
      const sheetExpenses = await getExpensesFromGoogleSheet();
      const hasSheetData = Array.isArray(sheetExpenses) && sheetExpenses.length > 0;
      const data = hasSheetData ? sheetExpenses : (await storageService.getExpenses() || []);
      setExpenses(data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
    } catch (error) {
      console.error("loadExpenses error:", error);
      Alert.alert('Error', 'Failed to load expenses');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadExpenses();
    }, [loadExpenses])
  );

  useEffect(() => {
    const currentDate = new Date();
    setQuarters(calculateQuarters(currentDate));
  }, []);

  const handleDeleteExpense = async (id: string) => {
    Alert.alert(
      'Delete Expense',
      'Are you sure you want to delete this expense? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteExpenseFromGoogleSheet(id);
              await storageService.deleteExpense(id);
              await loadExpenses();
              Alert.alert('Success', 'Expense deleted successfully!');
            } catch (error) {
              console.error('Error deleting expense:', error);
              Alert.alert('Error', 'Failed to delete expense. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleEditExpense = (expense: Expense) => {
    router.push({
      pathname: '/update-expense',
      params: { expense: JSON.stringify(expense) },
    });
  };

  const handleApplyFilters = (newFilters: any) => {
    setDrillDownDateFilter(null);
    setSelectedCategoryForDrill(null);
    setSelectedSubCategoryForDrill(null);
    setCategoryShowCount(ITEMS_PER_LOAD);
    setFilters({
      ...newFilters,
      startDate: newFilters.startDate ? new Date(newFilters.startDate) : new Date(defaultFilters.startDate),
      endDate: newFilters.endDate ? new Date(newFilters.endDate) : new Date(defaultFilters.endDate),
      labels: Array.isArray(newFilters.labels) ? [...newFilters.labels] : [],
    });
    setFilterOpen(false);
  };

  const handleClearDrillDown = () => {
    setDrillDownDateFilter(null);
    setSelectedCategoryForDrill(null);
    setSelectedSubCategoryForDrill(null);
  };

  const handleQuarterlyDrillDown = (item: QuarterData) => {
    setDrillDownDateFilter({
        startDate: item.startDate,
        endDate: new Date(item.endDate.getFullYear(), item.endDate.getMonth(), item.endDate.getDate(), 23, 59, 59, 999)
    });
    setSelectedCategoryForDrill(null);
    setSelectedSubCategoryForDrill(null);
  };

  const handleMonthDrillDown = (item: QuarterData) => {
    setDrillDownDateFilter({
        startDate: item.startDate,
        endDate: new Date(item.endDate.getFullYear(), item.endDate.getMonth(), item.endDate.getDate(), 23, 59, 59, 999)
    });
    setSelectedCategoryForDrill(null);
    setSelectedSubCategoryForDrill(null);
  };

  const handleCategoryDrillDown = (category: string) => {
    setSelectedCategoryForDrill(category);
    setSelectedSubCategoryForDrill(null);
  };

  const handleSubCategoryDrillDown = (subCategory: string) => {
    setSelectedSubCategoryForDrill(subCategory);
  };

  const handleShowMoreCategories = useCallback(() => {
      setCategoryShowCount(prev => prev + ITEMS_PER_LOAD);
  }, []);

  const handleCollapseCategories = useCallback(() => {
      setCategoryShowCount(prev => Math.max(ITEMS_PER_LOAD, prev - ITEMS_PER_LOAD));
  }, []);

  const handleShowMoreTransactions = useCallback(() => {
    setTransactionShowCount(prev => prev + ITEMS_PER_LOAD);
  }, []);

  const handleCollapseTransactions = useCallback(() => {
    setTransactionShowCount(prev => Math.max(ITEMS_PER_LOAD, prev - ITEMS_PER_LOAD));
  }, []);

  const handleCurrentMonthDrillDown = () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  
  setDrillDownDateFilter({
    startDate: startOfMonth,
    endDate: endOfMonth
  });
  setSelectedCategoryForDrill(null);
  setSelectedSubCategoryForDrill(null);
};

  // NEW: Comprehensive filtering logic
const { 
  allExpenses,
  allExpensesForCharts,
  currentMonthExpenses, 
  filteredExpensesForDisplay,
  filterOptions 
} = useMemo(() => {
  const categories = new Set<string>();
  const subCategories = new Set<string>();
  const labels = new Set<string>();
  expenses.forEach(e => {
    categories.add(e.category);
    if(e.subCategory) subCategories.add(e.subCategory);
    e.labels?.forEach(l => labels.add(l));
  });

  const now = new Date();

  // Step 1: Apply only category/subcategory/label filters from sidebar (NOT date)
  const categoryLabelFiltered = expenses.filter(e => {
      if (filters.category && e.category !== filters.category) return false;
      if (filters.subCategory && e.subCategory !== filters.subCategory) return false;
      if (filters.labels.length > 0 && !filters.labels.every((l: string) => (e.labels || []).includes(l))) return false;
      return true;
  });

  // Step 2: Apply CATEGORY drill-downs (for charts and current month)
  let categoryDrillFiltered = categoryLabelFiltered;
  
  if (selectedCategoryForDrill) {
      categoryDrillFiltered = categoryDrillFiltered.filter(e => e.category === selectedCategoryForDrill);
  }
  
  if (selectedSubCategoryForDrill) {
      categoryDrillFiltered = categoryDrillFiltered.filter(e => e.subCategory === selectedSubCategoryForDrill);
  }

  // Step 3: Apply ALL drill-downs (including date) for breakdown sections
  let fullDrillDownFiltered = categoryLabelFiltered;

  // Date drill-down (from clicking quarters/months)
  if (drillDownDateFilter) {
      fullDrillDownFiltered = fullDrillDownFiltered.filter(e => {
          const expenseDate = new Date(e.date);
          const startDate = new Date(drillDownDateFilter.startDate);
          startDate.setHours(0, 0, 0, 0);
          const endDate = new Date(drillDownDateFilter.endDate);
          endDate.setHours(23, 59, 59, 999);
          return expenseDate >= startDate && expenseDate <= endDate;
      });
  }

  // Category drill-down
  if (selectedCategoryForDrill) {
      fullDrillDownFiltered = fullDrillDownFiltered.filter(e => e.category === selectedCategoryForDrill);
  }

  // Sub-category drill-down
  if (selectedSubCategoryForDrill) {
      fullDrillDownFiltered = fullDrillDownFiltered.filter(e => e.subCategory === selectedSubCategoryForDrill);
  }

  // Step 4: For display list only - apply sidebar date filter
  const dateFiltered = fullDrillDownFiltered.filter(e => {
      const expenseDate = new Date(e.date);
      const startDate = new Date(filters.startDate);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(filters.endDate);
      endDate.setHours(23, 59, 59, 999);
      return expenseDate >= startDate && expenseDate <= endDate;
  });

  // Current month expenses - uses category/label filters + category drill-downs, NOT date drill-downs
  const currentMonth = categoryDrillFiltered.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  return {
      allExpenses: fullDrillDownFiltered, // Category Breakdown & Total Expense (includes ALL drill-downs)
      allExpensesForCharts: categoryDrillFiltered, // Quarterly/Past 3 Months/Moving Averages (includes category drill-downs, NO date drill-downs)
      currentMonthExpenses: currentMonth, // Current month with category drill-downs
      filteredExpensesForDisplay: dateFiltered, // Transaction list
      filterOptions: {
    categories: Array.from(categories).sort(),
    subCategories: Array.from(subCategories).sort(),
    labels: Array.from(labels).sort(),
    categoryMap: (() => {
        const map: { [key: string]: string[] } = {};
        expenses.forEach(e => {
            if (!map[e.category]) {
                map[e.category] = [];
            }
            if (e.subCategory && !map[e.category].includes(e.subCategory)) {
                map[e.category].push(e.subCategory);
            }
        });
        // Sort sub-categories for each category
        Object.keys(map).forEach(cat => {
            map[cat].sort();
        });
        return map;
    })(),
}
  };
}, [expenses, filters, drillDownDateFilter, selectedCategoryForDrill, selectedSubCategoryForDrill]);

// Chart calculations
const {
  totalExpense,
  currentMonthTotal,
  quarterlyData,
  past3MonthsData,
} = useMemo(() => {
  const now = new Date();
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  // Quarterly data with comparisons
  const quarters = calculateQuarters(now);

  // Calculate Q0 (the quarter immediately before Q1) for comparison
  const q0StartDate = new Date(quarters[0].startDate);
  q0StartDate.setMonth(q0StartDate.getMonth() - 3);
  const q0EndDate = new Date(quarters[0].startDate);
  q0EndDate.setDate(q0EndDate.getDate() - 1);

  const q0Value = allExpensesForCharts
    .filter(e => {
      const d = new Date(e.date);
      return d >= q0StartDate && d <= q0EndDate;
    })
    .reduce((sum, e) => sum + e.amount, 0);

  const quarterlyData: QuarterData[] = quarters.map((q, index) => {
    const value = allExpensesForCharts
      .filter(e => {
        const d = new Date(e.date);
        return d >= q.startDate && d <= q.endDate;
      })
      .reduce((sum, e) => sum + e.amount, 0);

    // Get previous quarter value for comparison
    let previousQuarterValue = 0;
    if (index === 0) {
      // Q1 compares with Q0 (calculated above)
      previousQuarterValue = q0Value;
    } else {
      // Q2, Q3, Q4 compare with the previous quarter in the array
      const prevQuarter = quarters[index - 1];
      previousQuarterValue = allExpensesForCharts
        .filter(e => {
          const d = new Date(e.date);
          return d >= prevQuarter.startDate && d <= prevQuarter.endDate;
        })
        .reduce((sum, e) => sum + e.amount, 0);
    }

    return {
      label: q.label,
      value: value,
      startDate: q.startDate,
      endDate: q.endDate,
      valueChange: value - previousQuarterValue,
    };
  });
  quarterlyData.reverse();

  // Past 3 months data with comparisons
  const past3MonthsData: QuarterData[] = [1, 2, 3].map(i => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = monthKey(d);

    const start = new Date(d.getFullYear(), d.getMonth(), 1);
    const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);

    const value = allExpensesForCharts
      .filter(e => monthKey(new Date(e.date)) === key)
      .reduce((s, e) => s + e.amount, 0);

    // Compare with the month BEFORE this one
    const prevMonth = new Date(d.getFullYear(), d.getMonth() - 1, 1);
    const previousMonthValue = allExpensesForCharts
      .filter(e => {
        return monthKey(new Date(e.date)) === monthKey(prevMonth);
      })
      .reduce((s, e) => s + e.amount, 0);

    return {
      label: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
      value: value,
      startDate: start,
      endDate: end,
      valueChange: value - previousMonthValue,
    };
  });
  past3MonthsData; // Show newest to oldest (Sep, Aug, Jul)

  const totalExpense = filteredExpensesForDisplay.reduce((s, e) => s + e.amount, 0);
  const currentMonthTotal = currentMonthExpenses.reduce((s, e) => s + e.amount, 0);

  return {
    totalExpense,
    currentMonthTotal,
    quarterlyData,
    past3MonthsData,
  };
}, [allExpensesForCharts, currentMonthExpenses, filteredExpensesForDisplay]);

const movingAverages = useMemo(() => {
  // Moving averages use allExpensesForCharts (includes category drill-downs, no date filters/drill-downs)
  const expensesToAverage = allExpensesForCharts;

  const now = new Date();
  const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

  const monthlyMap: { [k: string]: number } = {};
  expensesToAverage.forEach(e => {
      const k = monthKey(new Date(e.date));
      monthlyMap[k] = (monthlyMap[k] || 0) + e.amount;
  });

  const calculateMAData = (months: number) => {
      const currentPeriodValues = Array.from({ length: months }, (_, i) => {
          const d = new Date(now.getFullYear(), now.getMonth() - (i + 1), 1);
          return monthlyMap[monthKey(d)] || 0;
      });
      const currentPeriodTotal = currentPeriodValues.reduce((s, v) => s + v, 0);
      const maValue = currentPeriodTotal / months;

      const priorPeriodValues = Array.from({ length: months }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - months - (i + 1), 1);
    return monthlyMap[monthKey(d)] || 0;
});
      const priorPeriodTotal = priorPeriodValues.reduce((s, v) => s + v, 0);

      let percentageChange = 0;
      let isIncrease = false;
      let hasPriorData = false;

      if (priorPeriodTotal > 0) {
          percentageChange = ((currentPeriodTotal - priorPeriodTotal) / priorPeriodTotal) * 100;
          isIncrease = percentageChange > 0.01;
          hasPriorData = true;
      } else if (currentPeriodTotal > 0) {
          percentageChange = 100;
          isIncrease = true;
          hasPriorData = true;
      }

      return {
          maValue,
          comparison: {
              percentageChange,
              isIncrease,
              hasPriorData,
          }
      };
  };

  return {
      ma3: calculateMAData(3),
      ma6: calculateMAData(6),
      ma12: calculateMAData(12),
      ma36: calculateMAData(36),
  };
}, [allExpensesForCharts]);

const { categoryPieData, subCategoryPieData } = useMemo(() => {
  const categoryTotals: { [k: string]: { value: number, name: string } } = {};
  filteredExpensesForDisplay.forEach(e => {
    if (!categoryTotals[e.category]) categoryTotals[e.category] = { value: 0, name: e.category };
    categoryTotals[e.category].value += Number(e.amount) || 0;
  });

  const subCategoryTotals: { [k: string]: { value: number, name: string } } = {};
  if (selectedCategoryForDrill) {
    filteredExpensesForDisplay.forEach(e => {
      if (e.category === selectedCategoryForDrill) {
        const key = e.subCategory || 'Uncategorized';
        if (!subCategoryTotals[key]) subCategoryTotals[key] = { value: 0, name: key };
        subCategoryTotals[key].value += Number(e.amount) || 0;
      }
    });
  }
  return {
    categoryPieData: Object.values(categoryTotals),
    subCategoryPieData: Object.values(subCategoryTotals),
  };
}, [filteredExpensesForDisplay, selectedCategoryForDrill]);

const sortedTransactions = useMemo(() => {
  const sorted = [...filteredExpensesForDisplay];
  
  if (sortBy === 'date') {
    sorted.sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
    });
  } else if (sortBy === 'amount') {
    sorted.sort((a, b) => {
      return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
    });
  }
  
  return sorted;
}, [filteredExpensesForDisplay, sortBy, sortOrder]);

const getMainFilterDetail = () => {
  let detail = '';
  if (filters.category) {
      detail += `Category: ${filters.category}`;
      if (filters.subCategory) {
          detail += ` / ${filters.subCategory}`;
      }
      detail += ' | ';
  } else if (filters.subCategory) {
       detail += `Sub-Category: ${filters.subCategory} | `;
  }

  if (filters.labels.length > 0) {
      detail += `Labels: ${filters.labels.join(', ')} | `;
  }

  const startDateStr = filters.startDate.toLocaleDateString();
  const endDateStr = filters.endDate.toLocaleDateString();
  detail += `Date: ${startDateStr} - ${endDateStr}`;

  return detail.trim();
};

const getActiveDrillDownText = () => {
  const parts = [];
  
  if (drillDownDateFilter) {
      const now = new Date();
      const isCurrentMonth = 
          drillDownDateFilter.startDate.getMonth() === now.getMonth() &&
          drillDownDateFilter.startDate.getFullYear() === now.getFullYear() &&
          drillDownDateFilter.endDate.getMonth() === now.getMonth() &&
          drillDownDateFilter.endDate.getFullYear() === now.getFullYear();
      
      if (isCurrentMonth) {
          parts.push(`Current Month (${new Date(drillDownDateFilter.startDate).toLocaleDateString('default', { month: 'short', year: 'numeric' })})`);
      } else {
          parts.push(`Date: ${new Date(drillDownDateFilter.startDate).toLocaleDateString()} to ${new Date(drillDownDateFilter.endDate).toLocaleDateString()}`);
      }
  }
  
  if (selectedCategoryForDrill) {
      parts.push(`Category: ${selectedCategoryForDrill}`);
  }
  
  if (selectedSubCategoryForDrill) {
      parts.push(`Sub-Category: ${selectedSubCategoryForDrill}`);
  }
  
  return parts.length > 0 ? parts.join(' | ') : '';
};

const hasActiveDrillDown = drillDownDateFilter || selectedCategoryForDrill || selectedSubCategoryForDrill;
return (
  <SafeAreaView style={styles.safeArea} edges={['top']}>
    <FilterSidebar
      visible={filterOpen}
      onClose={() => setFilterOpen(false)}
      onApply={handleApplyFilters}
      initialFilters={filters}
      options={filterOptions}
    />
    <View style={styles.container}>
      {/* Fixed Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Dashboard</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setFilterOpen(true)}
          disabled={expenses.length === 0}>
          <Filter size={18} color="#ffffff" />
          <Text style={styles.filterButtonText}>Filter</Text>
        </TouchableOpacity>
      </View>

      {/* Scrollable Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {hasActiveDrillDown && (
          <View style={styles.drillDownIndicator}>
                <Text style={styles.drillDownText}>
                    <Text style={{fontWeight: 'bold'}}>Active Drill-Down:</Text>
                    {' '}{getActiveDrillDownText()}
                </Text>
                <TouchableOpacity onPress={handleClearDrillDown} style={styles.clearDrillDownButton}>
                    <X size={16} color="#ffffff" />
                </TouchableOpacity>
            </View>
        )}

        {isLoading ? <Text>Loading...</Text> : (
            expenses.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>No expenses yet</Text>
                </View>
            ) : (
                <>
                <View style={styles.statsGrid}>
    <StatCard 
        icon={<TrendingUp size={24} color="#2563eb" />} 
        title="Total Expense" 
        value={`₹${totalExpense.toFixed(2)}`} 
        subtitle=""
    />
    <TouchableOpacity 
        onPress={handleCurrentMonthDrillDown}
        activeOpacity={0.7}
    >
        <StatCard 
            icon={<Calendar size={24} color="#10b981" />} 
            title="Current Month" 
            value={`₹${currentMonthTotal.toFixed(2)}`} 
            subtitle="Tap to drill down"
        />
    </TouchableOpacity>
</View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Quarterly Expenses (Past Year)</Text>
                    <View style={styles.expensesList}>
                      {quarterlyData.map((quarter, index) => {
                        const percentageChange = quarter.valueChange !== 0
                          ? (quarter.valueChange / (quarter.value - quarter.valueChange)) * 100
                          : 0;

                        return (
                          <TouchableOpacity 
                              key={index} 
                              style={styles.expenseRow}
                              onPress={() => handleQuarterlyDrillDown(quarter)}
                              activeOpacity={0.7}
                            >
                            <Text style={styles.expenseLabel}>{quarter.label}</Text>
                            <View style={styles.expenseValueContainer}>
                              <Text style={styles.expenseValue}>{`₹${quarter.value.toFixed(2)}`}</Text>
                              {quarter.valueChange > 0 ? (
                                <View style={styles.indicatorContainer}>
                                  <ArrowUp size={12} color="red" />
                                  <Text style={styles.percentageText}>{`${Math.abs(percentageChange).toFixed(0)}%`}</Text>
                                </View>
                              ) : (
                                <View style={styles.indicatorContainer}>
                                  <ArrowDown size={12} color="green" />
                                  <Text style={styles.percentageText}>{`${Math.abs(percentageChange).toFixed(0)}%`}</Text>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Past 3 Months Expenses</Text>
                    <View style={styles.expensesList}>
                      {past3MonthsData.map((month, index) => {
                        const percentageChange = month.valueChange !== 0
                          ? (month.valueChange / (month.value - month.valueChange)) * 100
                          : 0;

                        return (
                          <TouchableOpacity 
                                key={index} 
                                style={styles.expenseRow}
                                onPress={() => handleMonthDrillDown(month)}
                                activeOpacity={0.7}
                              >
                            <Text style={styles.expenseLabel}>{month.label}</Text>
                            <View style={styles.expenseValueContainer}>
                              <Text style={styles.expenseValue}>{`₹${month.value.toFixed(2)}`}</Text>
                              {month.valueChange > 0 ? (
                                <View style={styles.indicatorContainer}>
                                  <ArrowUp size={12} color="red" />
                                  <Text style={styles.percentageText}>{`${Math.abs(percentageChange).toFixed(0)}%`}</Text>
                                </View>
                              ) : (
                                <View style={styles.indicatorContainer}>
                                  <ArrowDown size={12} color="green" />
                                  <Text style={styles.percentageText}>{`${Math.abs(percentageChange).toFixed(0)}%`}</Text>
                                </View>
                              )}
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                </View>

                <View style={styles.section}>
                    {selectedCategoryForDrill ? (
                        <>
                            <TouchableOpacity onPress={() => {
                                setSelectedCategoryForDrill(null);
                                setSelectedSubCategoryForDrill(null);
                            }} style={styles.drilldownHeader}>
                                <Text style={styles.backButton}>← Back to Categories</Text>
                            </TouchableOpacity>
                           <PieChart
                                title={`Sub-categories of ${selectedCategoryForDrill}`}
                                data={subCategoryPieData}
                                onSlicePress={handleSubCategoryDrillDown}
                                noContainerStyle={true}
                                detailText="Click to drill down by sub-category"
                                detailPosition='left'
                            />
                        </>
                    ) : (
                        <PieChart
                            title="Category Breakdown"
                            data={categoryPieData}
                            onSlicePress={handleCategoryDrillDown}
                            noContainerStyle={true}
                            showCount={categoryShowCount}
                            onShowMore={handleShowMoreCategories}
                            onCollapse={handleCollapseCategories}
                            detailText="Click to drill down by category"
                            detailPosition='left'
                        />
                    )}
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Moving Averages</Text>
                    <View style={styles.maGrid}>
                        <MovingAverageCard title="3-Month" maValue={movingAverages.ma3.maValue} comparison={movingAverages.ma3.comparison} />
                        <MovingAverageCard title="6-Month" maValue={movingAverages.ma6.maValue} comparison={movingAverages.ma6.comparison} />
                        <MovingAverageCard title="12-Month" maValue={movingAverages.ma12.maValue} comparison={movingAverages.ma12.comparison} />
                        <MovingAverageCard title="3-Year" maValue={movingAverages.ma36.maValue} comparison={movingAverages.ma36.comparison} />
                    </View>
                    <View style={[styles.detailContainer, styles.detailLeft, { marginTop: 12, borderTopWidth: 0, paddingBottom: 0, paddingTop: 0 }]}>
                        <Text style={styles.detailText}>Filtered by: {getMainFilterDetail()}</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.transactionHeader}>
                        <Text style={styles.sectionTitle}>Recent Transactions</Text>
                        <View style={styles.sortControls}>
                            <TouchableOpacity 
                                style={[styles.sortButton, sortBy === 'date' && styles.sortButtonActive]}
                                onPress={() => {
                                    if (sortBy === 'date') {
                                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                    } else {
                                        setSortBy('date');
                                        setSortOrder('desc');
                                    }
                                }}
                            >
                                <Calendar size={14} color={sortBy === 'date' ? '#2563eb' : '#6b7280'} />
                                <Text style={[styles.sortButtonText, sortBy === 'date' && styles.sortButtonTextActive]}>
                                    Date {sortBy === 'date' && (sortOrder === 'asc' ? '(A-Z)' : '(Z-A)')}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity 
                                style={[styles.sortButton, sortBy === 'amount' && styles.sortButtonActive]}
                                onPress={() => {
                                    if (sortBy === 'amount') {
                                        setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
                                    } else {
                                        setSortBy('amount');
                                        setSortOrder('desc');
                                    }
                                }}
                            >
                                <TrendingUp size={14} color={sortBy === 'amount' ? '#2563eb' : '#6b7280'} />
                                <Text style={[styles.sortButtonText, sortBy === 'amount' && styles.sortButtonTextActive]}>
                                    Amount {sortBy === 'amount' && (sortOrder === 'asc' ? '(A-Z)' : '(Z-A)')}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                    <ExpenseList
                        expenses={sortedTransactions.slice(0, transactionShowCount)}
                        onDelete={handleDeleteExpense}
                        onEdit={handleEditExpense}
                    />

                    {filteredExpensesForDisplay.length > ITEMS_PER_LOAD && (
                      <View style={styles.paginationControls}>
                        {transactionShowCount > ITEMS_PER_LOAD && (
                          <TouchableOpacity style={styles.collapseButton} onPress={handleCollapseTransactions}>
                            <Text style={styles.paginationText}>Collapse</Text>
                            <ChevronUp size={16} color="#2563eb" />
                          </TouchableOpacity>
                        )}
                        {filteredExpensesForDisplay.length > transactionShowCount && (
                           <TouchableOpacity style={styles.moreButton} onPress={handleShowMoreTransactions}>
                            <Text style={styles.paginationText}>More ({filteredExpensesForDisplay.length - transactionShowCount} left)</Text>
                            <ChevronDown size={16} color="#2563eb" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                </View>
                </>
            )
        )}
      </ScrollView>
    </View>
  </SafeAreaView>
  );
}


if (__DEV__) {
  activateKeepAwake(); // Only activate in development mode
}