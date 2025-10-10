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
// We are defining ExpenseList in this file to match your design
import StatCard from '@/components/StatCard';
import { getExpensesFromGoogleSheet } from '@/utils/googleSheets';
import DateTimePickerModal from "react-native-modal-datetime-picker";

// --- NEW ExpenseList Component (Improved Logic) ---
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

                // Dynamically build the list of details to show
                const detailsToShow = [];

                // --- MODIFICATION 1: Explicitly include Category (Sub Category) ---
                const categoryString = expense.category || 'Uncategorized';
                const subCategoryString = expense.subCategory ? ` (${expense.subCategory})` : '';
                const fullCategoryDisplay = `${categoryString}${subCategoryString}`;
                
                // Pushing the formatted category display as a separate line
                detailsToShow.push(fullCategoryDisplay);

                // Add the shop name if it exists
                if (expense.shopName) {
                    detailsToShow.push(expense.shopName);
                }
                
                // Add the date (moved after shopName for better flow or keep it where you want)
                detailsToShow.push(formattedDate);
                // --- END MODIFICATION 1 ---

                return (
                    <View key={expense.id} style={styles.expenseItemContainer}>
                        <View style={styles.expenseItemLeft}>
                            <Text style={styles.expenseItemDescription}>{expense.item}</Text>
                            {/* Map through the details that actually exist for this item */}
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


// --- Filter Default Logic ---

const getDefaultStartDate = () => {
    const now = new Date();
    // Setting to 12 months ago, day 1
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
}

// --- MODIFIED Placeholder Components ---

const BarChart = ({ title, data, onItemPress, detailText = '', detailPosition = 'right' }: {
    title: string;
    data: QuarterData[];
    onItemPress?: (data: QuarterData) => void;
    detailText?: string;
    detailPosition?: 'left' | 'right';
}) => {
  // Defensive: ensure data is an array and don't mutate the incoming array
  const items = Array.isArray(data) ? data.slice().map(d => ({
    label: String((d as any).label ?? ''),
    value: Number((d as any).value ?? 0),
    startDate: (d as any).startDate instanceof Date ? d.startDate : new Date(),
    endDate: (d as any).endDate instanceof Date ? d.endDate : new Date(),
  })) : [];

  return (
    <View style={styles.chartContainer}>
      <Text style={styles.sectionTitle}>{String(title)}</Text>
      {items.map(item => (
        <TouchableOpacity
          key={String(item.label)}
          style={styles.barChartItem}
          onPress={() => onItemPress?.(item)}
          disabled={!onItemPress}
        >
          <Text style={styles.breakdownLabel}>{String(item.label)}</Text>
          <Text style={styles.breakdownAmount}>{`₹${Number(item.value).toFixed(2)}`}</Text>
        </TouchableOpacity>
      ))}
      {detailText ? (
        <View style={[styles.detailContainer, detailPosition === 'right' ? styles.detailRight : styles.detailLeft]}>
            <Text style={styles.detailText}>{detailText}</Text>
        </View>
      ) : null}
    </View>
  );
};

// MODIFIED PieChart Component to handle viewing limits and More/Collapse buttons
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

  // Apply limit if showCount is provided
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

      {/* Show More/Collapse Buttons */}
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

// --- FilterSidebar Component (Unchanged) ---
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

                <Text style={styles.filterSectionTitle}>Category</Text>
                {(options?.categories || []).map((c: string) =>
                    <TouchableOpacity key={c} onPress={() => selectCategory(c)} style={[styles.filterOption, currentCategory === c && styles.filterOptionSelected]}>
                        <Text style={styles.filterOptionText}>{c}</Text>
                    </TouchableOpacity>
                )}

                {currentCategory && (
                    <>
                        <Text style={styles.filterSectionTitle}>Sub-Category (in {currentCategory})</Text>
                        {(options?.subCategories || []).map((sc: string) =>
                            <TouchableOpacity key={sc} onPress={() => selectSubCategory(sc)} style={[styles.filterOption, currentSubCategory === sc && styles.filterOptionSelected]}>
                                <Text style={styles.filterOptionText}>{sc}</Text>
                            </TouchableOpacity>
                        )}
                    </>
                )}

                <Text style={styles.filterSectionTitle}>Labels</Text>
                {(options?.labels || []).map((l: string) =>
                    <TouchableOpacity key={l} onPress={() => toggleLabel(l)} style={[styles.filterOption, currentLabels.includes(l) && styles.filterOptionSelected]}>
                        <Text style={styles.filterOptionText}>{l}</Text>
                    </TouchableOpacity>
                )}

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
        </Modal>
      );
};

// --- Helper Component for MA Card (Unchanged) ---
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

    // Determine color and icon based on change direction
    const color = hasPriorData
        ? (isIncrease ? styles.redText : styles.greenText) // Expenses increase (bad) -> Red, decrease (good) -> Green
        : styles.grayText;
    const ArrowIcon = isIncrease ? ArrowUp : ArrowDown;
    const percentage = Math.abs(percentageChange).toFixed(1);

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


// --- Main Dashboard Component ---

const ITEMS_PER_LOAD = 5;

export default function Dashboard() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState<any>({ ...defaultFilters });
  const [selectedCategoryForDrill, setSelectedCategoryForDrill] = useState<string | null>(null);
  // NEW STATE: For managing how many categories are visible
  const [categoryShowCount, setCategoryShowCount] = useState(ITEMS_PER_LOAD);
  const [transactionShowCount, setTransactionShowCount] = useState(ITEMS_PER_LOAD);

  // This drill-down state is set by clicking a BarChart item
  const [drillDownDateFilter, setDrillDownDateFilter] = useState<{ startDate: Date, endDate: Date } | null>(null);

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

  const handleDeleteExpense = async (id: string) => {
  Alert.alert(
    'Delete Expense',
    'Are you sure you want to delete this expense? This action cannot be undone.',
    [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            console.log(`🗑️ Starting delete for ID: ${id}`);
            
            // 1. Delete from Google Sheet first
            await deleteExpenseFromGoogleSheet(id);
            console.log(`✅ Deleted from Google Sheet: ${id}`);
            
            // 2. Delete locally
            await storageService.deleteExpense(id);
            console.log(`✅ Deleted locally: ${id}`);
            
            // 3. Refresh the list from Google Sheet
            await loadExpenses();
            
            Alert.alert('Success', 'Expense deleted successfully!');
          } catch (error) {
            console.error('❌ Error deleting expense:', error);
            Alert.alert('Error', 'Failed to delete expense. Please try again.');
          }
        },
      },
    ]
  );
};

const handleEditExpense = (expense: Expense) => {
  // Navigate to Add Expense page with expense data
  router.push({
    pathname: '/(tabs)/',
    params: { expense: JSON.stringify(expense) },
  });
};

  const handleApplyFilters = (newFilters: any) => {
    // Reset drill-down when main filters are applied
    setDrillDownDateFilter(null);
    setSelectedCategoryForDrill(null); // Also reset category drill-down
    setCategoryShowCount(ITEMS_PER_LOAD); // Reset category view count
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
  };

  const handleQuarterlyDrillDown = (item: QuarterData) => {
    // Setting the drill-down filter based on the quarter clicked
    setDrillDownDateFilter({
        startDate: item.startDate,
        // Set end time to the very end of the day for the filter to include all expenses on that date
        endDate: new Date(item.endDate.getFullYear(), item.endDate.getMonth(), item.endDate.getDate(), 23, 59, 59, 999)
    });
    setSelectedCategoryForDrill(null); // Reset category drill-down on date drill-down
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


  // --- Filtered Expenses Logic ---
  const { filteredExpenses, mainFilteredExpenses, filterOptions } = useMemo(() => {
    const categories = new Set<string>();
    const subCategories = new Set<string>();
    const labels = new Set<string>();
    expenses.forEach(e => {
      categories.add(e.category);
      if(e.subCategory) subCategories.add(e.subCategory);
      e.labels?.forEach(l => labels.add(l));
    });

    // 1. Main Filtered Expenses: Respects ONLY sidebar filters (date and category/label).
    const applyMainFilters = (expense: Expense) => {
        const expenseDate = new Date(expense.date);

        // Date Range Filter Logic (using main filters dates)
        const startDate = new Date(filters.startDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);

        if(expenseDate < startDate || expenseDate > endDate) return false;

        // Category/Label Filters
        if (filters.category && expense.category !== filters.category) return false;
        if (filters.subCategory && expense.subCategory !== filters.subCategory) return false;
        if (filters.labels.length > 0 && !filters.labels.every((l: string) => (expense.labels || []).includes(l))) return false;

        return true;
    };

    const mainFiltered = expenses.filter(applyMainFilters);

    // 2. Drill-Down Filtered Expenses: Respects sidebar filters AND drill-down date.
    const drillDownStartDate = drillDownDateFilter?.startDate || filters.startDate;
    const drillDownEndDate = drillDownDateFilter?.endDate || filters.endDate;

    const finalFiltered = mainFiltered.filter(e => {
        const expenseDate = new Date(e.date);

        const startDate = new Date(drillDownStartDate);
        startDate.setHours(0, 0, 0, 0);
        const endDate = new Date(drillDownEndDate);
        endDate.setHours(23, 59, 59, 999);

        return expenseDate >= startDate && expenseDate <= endDate;
    });


    return {
        // This is the list for the stats, pie charts, and expense list
        filteredExpenses: finalFiltered,
        // This is the list for Quarterly, Past 3 Months, and MA (respects main filters, ignores drill-down)
        mainFilteredExpenses: mainFiltered,
        filterOptions: {
            categories: Array.from(categories).sort(),
            subCategories: Array.from(subCategories).sort(),
            labels: Array.from(labels).sort(),
        }
    };
  }, [expenses, filters, drillDownDateFilter]);

  // --- Chart and Stats Calculations ---
  const {
    pastYearTotal,
    currentMonthTotal,
    quarterlyData,
    past3MonthsData,
  } = useMemo(() => {
    const now = new Date();
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    // Quarterly data (uses mainFilteredExpenses)
    const quarterlyData: QuarterData[] = [];
    for (let i = 0; i < 4; i++) {
        const endMonthIndex = now.getMonth() + 1 - (i * 3);
        const qEndDate = new Date(now.getFullYear(), endMonthIndex, 0);
        const qStartDate = new Date(now.getFullYear(), endMonthIndex - 3, 1);

        const quarterLabel = `${qStartDate.toLocaleString('default', { month: 'short' })} '${String(qStartDate.getFullYear()).slice(2)} - ${qEndDate.toLocaleString('default', { month: 'short' })} '${String(qEndDate.getFullYear()).slice(2)}`;

        const value = mainFilteredExpenses
            .filter(e => {
                const d = new Date(e.date);
                return d >= qStartDate && d <= qEndDate;
            })
            .reduce((sum, e) => sum + e.amount, 0);

        quarterlyData.push({
             label: quarterLabel,
             value: value,
             startDate: qStartDate,
             endDate: qEndDate,
        });
    }
    quarterlyData.reverse();


    // Past 3 months data (uses mainFilteredExpenses)
    const past3MonthsData: QuarterData[] = [3, 2, 1].reverse().map(i => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = monthKey(d);

      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);

      return {
        label: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
        value: mainFilteredExpenses.filter(e => monthKey(new Date(e.date)) === key).reduce((s, e) => s + e.amount, 0),
        startDate: start,
        endDate: end,
      };
    });

    // Stats (use filteredExpenses, which respects both main AND drill-down)
    const pastYearTotal = filteredExpenses.reduce((s, e) => s + e.amount, 0);

    const currentMonthExpenses = filteredExpenses.filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });


    return {
      pastYearTotal: pastYearTotal,
      currentMonthTotal: currentMonthExpenses.reduce((s, e) => s + e.amount, 0),
      quarterlyData,
      past3MonthsData,
    };
  }, [filteredExpenses, mainFilteredExpenses]);


  const movingAverages = useMemo(() => {
    const expensesToAverage = mainFilteredExpenses;
    const now = new Date();
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;

    const monthlyMap: { [k: string]: number } = {};
    expensesToAverage.forEach(e => {
        const k = monthKey(new Date(e.date));
        monthlyMap[k] = (monthlyMap[k] || 0) + e.amount;
    });

    const calculateMAData = (months: number) => {
        // 1. Current Period: Months -1 to -N
        const currentPeriodValues = Array.from({ length: months }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (i + 1), 1);
            return monthlyMap[monthKey(d)] || 0;
        });
        const currentPeriodTotal = currentPeriodValues.reduce((s, v) => s + v, 0);
        const maValue = currentPeriodTotal / months;

        // 2. Prior Period: Months -(N+1) to -2N
        const priorPeriodValues = Array.from({ length: months }, (_, i) => {
            const d = new Date(now.getFullYear(), now.getMonth() - (i + 1 + months), 1);
            return monthlyMap[monthKey(d)] || 0;
        });
        const priorPeriodTotal = priorPeriodValues.reduce((s, v) => s + v, 0);

        // 3. Comparison
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
  }, [mainFilteredExpenses]);

  const { categoryPieData, subCategoryPieData } = useMemo(() => {
    const categoryTotals: { [k: string]: { value: number, name: string } } = {};
    filteredExpenses.forEach(e => {
      if (!categoryTotals[e.category]) categoryTotals[e.category] = { value: 0, name: e.category };
      categoryTotals[e.category].value += Number(e.amount) || 0;
    });

    const subCategoryTotals: { [k: string]: { value: number, name: string } } = {};
    if (selectedCategoryForDrill) {
      filteredExpenses.forEach(e => {
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
}, [filteredExpenses, selectedCategoryForDrill]);


  // --- Helper to generate the main filter detail text ---
  const getMainFilterDetail = () => {
    let detail = '';
    if (filters.category) {
        detail += `Category: ${filters.category}`;
        if (filters.subCategory) {
            detail += ` / ${filters.subCategory}`;
        }
        detail += ' | ';
    } else if (filters.subCategory) {
         // Should not happen if category is null, but for completeness
         detail += `Sub-Category: ${filters.subCategory} | `;
    }

    if (filters.labels.length > 0) {
        detail += `Labels: ${filters.labels.join(', ')} | `;
    }

    const startDateStr = filters.startDate.toLocaleDateString();
    const endDateStr = filters.endDate.toLocaleDateString();

    // Always include the date range
    detail += `Date: ${startDateStr} - ${endDateStr}`;

    return detail.trim();
  }


  return (
    <>
      <FilterSidebar
        visible={filterOpen}
        onClose={() => setFilterOpen(false)}
        onApply={handleApplyFilters}
        initialFilters={filters}
        options={filterOptions}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
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

        {/* Drill-Down Filter Indicator (Keeping this separate for global visibility) */}
        {drillDownDateFilter && (
            <View style={styles.drillDownIndicator}>
                <Text style={styles.drillDownText}>
                    <Text style={{fontWeight: 'bold'}}>Drill-Down Filter Active:</Text>
                    {' '}
                    {new Date(drillDownDateFilter.startDate).toLocaleDateString()} to {new Date(drillDownDateFilter.endDate).toLocaleDateString()}
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
                    <StatCard icon={<TrendingUp size={24} color="#2563eb" />} title="Filtered Total" value={`₹${pastYearTotal.toFixed(2)}`} subtitle="Total spent in current view" />
                    <StatCard icon={<Calendar size={24} color="#10b981" />} title="Current Month" value={`₹${currentMonthTotal.toFixed(2)}`} subtitle="Total spent this month (filtered)" />
                </View>

                {/* Quarterly Chart: Title and Details Updated */}
                <BarChart
                    title="Quarterly Expenses (Past Year)"
                    data={quarterlyData}
                    onItemPress={handleQuarterlyDrillDown}
                    detailText="Click to Drill"
                    detailPosition='left'
                />

                {/* Past 3 Months Chart: Title Updated, No Detail Text */}
                <BarChart
                    title="Past 3 Months Expenses"
                    data={past3MonthsData}
                    detailText="" // Explicitly remove
                />

                <View style={styles.section}>
                    {selectedCategoryForDrill ? (
                        <>
                            <TouchableOpacity onPress={() => setSelectedCategoryForDrill(null)} style={styles.drilldownHeader}>
                                <Text style={styles.backButton}>← Back</Text>
                            </TouchableOpacity>
                           <PieChart
                                title={`Sub-categories of ${selectedCategoryForDrill}`}
                                data={subCategoryPieData}
                                noContainerStyle={true}
                                detailText={`Filtered by: ${getMainFilterDetail()}`}
                                detailPosition='right'
                            />
                        </>
                    ) : (
                        (
                            <PieChart
                                title="Category Breakdown"
                                data={categoryPieData}
                                onSlicePress={(name) => setSelectedCategoryForDrill(name)}
                                noContainerStyle={true}
                                showCount={categoryShowCount}
                                onShowMore={handleShowMoreCategories}
                                onCollapse={handleCollapseCategories}
                                detailText={`Filtered by: ${getMainFilterDetail()}`}
                                detailPosition='right'
                            />
                        )
                    )}
                </View>

                <View style={styles.section}>
                    {/* Moving Averages: Title Updated, Detail moved to bottom left */}
                    <Text style={styles.sectionTitle}>Moving Averages</Text>
                    <View style={styles.maGrid}>
                        <MovingAverageCard title="3-Month" maValue={movingAverages.ma3.maValue} comparison={movingAverages.ma3.comparison} />
                        <MovingAverageCard title="6-Month" maValue={movingAverages.ma6.maValue} comparison={movingAverages.ma6.comparison} />
                        <MovingAverageCard title="12-Month" maValue={movingAverages.ma12.maValue} comparison={movingAverages.ma12.comparison} />
                        <MovingAverageCard title="3-Year" maValue={movingAverages.ma36.maValue} comparison={movingAverages.ma36.comparison} />
                    </View>
                    <View style={[styles.detailContainer, styles.detailLeft, { marginTop: 12, borderTopWidth: 0, paddingBottom: 0, paddingTop: 0 }]}>
                        <Text style={styles.detailText}>Filtered by sidebar</Text>
                    </View>
                </View>

                <View style={styles.section}>
                    {/* --- MODIFICATION 2: Change section title --- */}
                    <Text style={styles.sectionTitle}>Recent Transactions</Text>
                    {/* Expense List: Uses filteredExpenses */}
                    <ExpenseList
                        expenses={filteredExpenses.slice(0, transactionShowCount)}
                        onDelete={handleDeleteExpense}
                        onEdit={handleEditExpense}
                    />

                    {filteredExpenses.length > ITEMS_PER_LOAD && (
                      <View style={styles.paginationControls}>
                        {transactionShowCount > ITEMS_PER_LOAD && (
                          <TouchableOpacity style={styles.collapseButton} onPress={handleCollapseTransactions}>
                            <Text style={styles.paginationText}>Collapse</Text>
                            <ChevronUp size={16} color="#2563eb" />
                          </TouchableOpacity>
                        )}
                        {filteredExpenses.length > transactionShowCount && (
                           <TouchableOpacity style={styles.moreButton} onPress={handleShowMoreTransactions}>
                            <Text style={styles.paginationText}>More ({filteredExpenses.length - transactionShowCount} left)</Text>
                            <ChevronDown size={16} color="#2563eb" />
                          </TouchableOpacity>
                        )}
                      </View>
                    )}

                    <View style={[styles.detailContainer, styles.detailLeft, { marginTop: 12, borderTopWidth: 0, paddingBottom: 0, paddingTop: 0 }]}>
                        <Text style={styles.detailText}>Filtered by: {getMainFilterDetail()}</Text>
                    </View>
                </View>
                </>
            )
        )}
      </ScrollView>
    </>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f9fafb' },
  contentContainer: { padding: 20, paddingBottom: 40 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 20, marginBottom: 24 },
  title: { fontSize: 28, fontWeight: '700', color: '#111827' },
  filterButton: { backgroundColor: '#2563eb', flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 8, paddingHorizontal: 16, borderRadius: 8 },
  filterButtonText: { color: '#ffffff', fontSize: 14, fontWeight: '600' },
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
  sidebarContainer: { position: 'absolute', right: 0, top: 0, bottom: 0, width: '80%', backgroundColor: '#f9fafb', padding: 20, shadowColor: '#000', shadowOffset: { width: -2, height: 0 }, shadowOpacity: 0.1, shadowRadius: 5, elevation: 10 },
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
// New styles for the detail text at the bottom of sections
detailContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end', // Default to right
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
// --- STYLES FOR THE NEW EXPENSE LIST DESIGN ---
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
});