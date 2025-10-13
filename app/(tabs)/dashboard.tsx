// dashboard.tsx
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
import DateTimePickerModal from "react-native-modal-datetime-picker";
import { activateKeepAwake, deactivateKeepAwake } from 'expo-keep-awake';


interface Quarter {
  label: string;
  startDate: Date;
  endDate: Date;
}

// (the calculateQuarters function remains the same as before)
const calculateQuarters = (currentDate: Date): Quarter[] => {
  const currentMonth = currentDate.getMonth();
  const currentYear = currentDate.getFullYear();
  const quarters: Quarter[] = [];
  for (let i = 0; i < 4; i++) {
    const endMonthIndex = currentMonth - 1 - (i * 3);
    const endDate = new Date(currentYear, endMonthIndex + 1, 0);
    const startDate = new Date(currentYear, endMonthIndex - 2, 1);
    const quarterLabel = `${startDate.toLocaleString('default', { month: 'short' })} '${String(startDate.getFullYear()).slice(2)} - ${endDate.toLocaleString('default', { month: 'short' })} '${String(endDate.getFullYear()).slice(2)}`;
    quarters.push({ label: quarterLabel, startDate, endDate });
  }
  return quarters.reverse();
};

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
    valueChange: typeof (d as any).valueChange === 'number' ? (d as any).valueChange : 0,
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



// (Duplicate getDefaultStartDate and defaultFilters removed)

interface QuarterData {
  label: string;
  value: number;
  startDate: Date;
  endDate: Date;
  valueChange: number;
}

const ITEMS_PER_LOAD = 5;

type SortBy = 'date' | 'amount';
type SortOrder = 'asc' | 'desc';

export default function Dashboard() {
  const [expensesRaw, setExpensesRaw] = useState<Expense[] | null>(null); // raw data (lazy)
  const [summaryData, setSummaryData] = useState<any[]>([]); // from Aggregations sheet
  const [isLoadingSummary, setIsLoadingSummary] = useState(true);
  const [isLoadingRaw, setIsLoadingRaw] = useState(false);
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
  const [recentTransactionsVisible, setRecentTransactionsVisible] = useState(true); // assume visible
  const router = useRouter();

  // ---------------------
  // Fetch summary (fast) and keep it cached in state
  // ---------------------
  const fetchSummary = useCallback(async () => {
    setIsLoadingSummary(true);
    try {
      // NOTE: getExpensesFromGoogleSheet should accept an options object that will be turned into query params:
      // { mode: 'summary' }
      const res = await getExpensesFromGoogleSheet({ mode: 'summary' });
      // it's expected to return an array of aggregation rows: { PeriodType, PeriodLabel, StartDate, EndDate, Category, SubCategory, TotalExpense }
      setSummaryData(Array.isArray(res) ? res : []);
    } catch (err) {
      console.error('fetchSummary error', err);
    } finally {
      setIsLoadingSummary(false);
    }
  }, []);

  // ---------------------
  // Fetch raw data on demand (filtered server-side when possible)
  // ---------------------
  const fetchRaw = useCallback(async (opts: { startDate?: string, endDate?: string, category?: string, subCategory?: string, label?: string } = {}) => {
    setIsLoadingRaw(true);
    try {
      // Use server filtering by passing parameters
      const payload: any = { mode: 'raw' };
      if (opts.startDate) payload.startDate = opts.startDate;
      if (opts.endDate) payload.endDate = opts.endDate;
      if (opts.category) payload.category = opts.category;
      if (opts.subCategory) payload.subCategory = opts.subCategory;
      if (opts.label) payload.label = opts.label;

      const res = await getExpensesFromGoogleSheet(payload);
      const arr = Array.isArray(res) ? res.map((r: any) => ({
        // Normalise to Expense type used across the UI
        id: r.id || String(Math.random()),
        date: r.date,
        category: r.category,
        subCategory: r.subCategory,
        item: r.item,
        amount: Number(r.amount || r.TotalExpense || 0),
        shopName: r.shopName || r.shop || '',
        labels: r.labels || [],
        email: r.email || '',
        paymentMode: r.paymentMode || ''
      })) : [];
      setExpensesRaw(arr);
      // Optionally cache raw in storageService if you want persistence between app sessions:
      // await storageService.setExpenses(arr);
    } catch (err) {
      console.error('fetchRaw error', err);
      Alert.alert('Error', 'Failed to load transactions');
    } finally {
      setIsLoadingRaw(false);
    }
  }, []);

  // ---------------------
  // Load sequence on focus: summary first; raw is lazy
  // ---------------------
  useFocusEffect(useCallback(() => {
    // Always refresh summary quickly
    fetchSummary();
    // Do NOT fetch raw here to keep startup fast. Raw fetched lazily when needed.
    // Reset transactionShowCount to initial when focusing
    setTransactionShowCount(ITEMS_PER_LOAD);
  }, [fetchSummary]));

  useEffect(() => {
    const currentDate = new Date();
    setQuarters(calculateQuarters(currentDate));
  }, []);

  // ---------------------
  // Helper: ensure raw data is loaded when needed
  // ---------------------
  const ensureRawLoaded = useCallback(async (forcedOpts?: any) => {
    // If we already have raw loaded in memory and no forced options, do nothing
    if (expensesRaw && !forcedOpts) return;
    // If forcedOpts provided (like a filter/drill) use it to fetch filtered raw data
    if (forcedOpts) {
      await fetchRaw(forcedOpts);
      return;
    }
    // Default: fetch recent raw within a sensible timeframe (e.g., last 12 months) to avoid full download
    // We choose startDate = filters.startDate if the user has a filter, else default to 12 months as in original.
    const start = filters?.startDate ? new Date(filters.startDate) : getDefaultStartDate();
    const end = filters?.endDate ? new Date(filters.endDate) : new Date();
    const opts = {
      startDate: start.toISOString().slice(0,10),
      endDate: end.toISOString().slice(0,10),
    };
    await fetchRaw(opts);
  }, [expensesRaw, fetchRaw, filters]);

  // ---------------------
  // Delete expense (same as before but now we also invalidate raw cache)
  // ---------------------
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
              await deleteExpenseFromGoogleSheet(id); // existing util
              // Invalidate local raw cache and refetch (if visible)
              setExpensesRaw(null);
              if (recentTransactionsVisible) {
                await ensureRawLoaded();
              }
              // Re-fetch summary to reflect deletion
              await fetchSummary();
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

  // ---------------------
  // Filtering & Drill-down: when user applies filters or drills, fetch filtered raw (server-side)
  // ---------------------
  const handleApplyFilters = async (newFilters: any) => {
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

    // Fetch raw data filtered server-side (for listings & accurate MAs when needed)
    const opts: any = {};
    opts.startDate = newFilters.startDate ? new Date(newFilters.startDate).toISOString().slice(0,10) : undefined;
    opts.endDate = newFilters.endDate ? new Date(newFilters.endDate).toISOString().slice(0,10) : undefined;
    if (newFilters.category) opts.category = newFilters.category;
    if (newFilters.subCategory) opts.subCategory = newFilters.subCategory;
    // Labels: Apps Script supports single label param — if you need multi-label filtering, you can expand API later
    if (Array.isArray(newFilters.labels) && newFilters.labels.length === 1) {
      opts.label = newFilters.labels[0];
    }
    await fetchRaw(opts);
  };

  const handleClearDrillDown = () => {
    setDrillDownDateFilter(null);
    setSelectedCategoryForDrill(null);
    setSelectedSubCategoryForDrill(null);
    
    // Reset filters to default
    setFilters({ ...defaultFilters });
    
    // Refetch with default filters
    const opts = {
      startDate: defaultFilters.startDate.toISOString().slice(0,10),
      endDate: defaultFilters.endDate.toISOString().slice(0,10),
    };
    fetchRaw(opts);
  };

  const handleQuarterlyDrillDown = async (item: QuarterData) => {
    const endDate = new Date(item.endDate.getFullYear(), item.endDate.getMonth(), item.endDate.getDate(), 23, 59, 59, 999);
    
    setDrillDownDateFilter({
      startDate: item.startDate,
      endDate: endDate
    });
    setSelectedCategoryForDrill(null);
    setSelectedSubCategoryForDrill(null);
    
    // Update filters to match the drill-down period
    setFilters({
      ...filters,
      startDate: item.startDate,
      endDate: endDate,
    });

    // Fetch raw with the quarter's dates
    await fetchRaw({
      startDate: item.startDate.toISOString().slice(0,10),
      endDate: item.endDate.toISOString().slice(0,10),
    });
  };

  const handleCategoryDrillDown = async (category: string) => {
    setSelectedCategoryForDrill(category);
    setSelectedSubCategoryForDrill(null);

    // Update main filters to include the category
    setFilters({
      ...filters,
      category: category,
      subCategory: null,
    });

    // fetch raw filtered by category and current date filter if any
    const opts: any = { category };
    if (drillDownDateFilter) {
      opts.startDate = new Date(drillDownDateFilter.startDate).toISOString().slice(0,10);
      opts.endDate = new Date(drillDownDateFilter.endDate).toISOString().slice(0,10);
    } else if (filters.startDate || filters.endDate) {
      opts.startDate = new Date(filters.startDate).toISOString().slice(0,10);
      opts.endDate = new Date(filters.endDate).toISOString().slice(0,10);
    }
    await fetchRaw(opts);
  };

  const handleSubCategoryDrillDown = async (subCategory: string) => {
    setSelectedSubCategoryForDrill(subCategory);
    
    // Update main filters to include subCategory
    setFilters({
      ...filters,
      subCategory: subCategory,
    });
    
    // Filter by both category (if present) and subCategory
    const opts: any = { subCategory };
    if (selectedCategoryForDrill) opts.category = selectedCategoryForDrill;
    if (drillDownDateFilter) {
      opts.startDate = new Date(drillDownDateFilter.startDate).toISOString().slice(0,10);
      opts.endDate = new Date(drillDownDateFilter.endDate).toISOString().slice(0,10);
    }
    await fetchRaw(opts);
  };

  // show/hide & lazy raw load for recent transactions
  const handleToggleRecent = async () => {
    const newState = !recentTransactionsVisible;
    setRecentTransactionsVisible(newState);
    if (!expensesRaw && newState) {
      // load raw when user opens recent transactions
      await ensureRawLoaded();
    }
  };

  const handleShowMoreTransactions = useCallback(() => {
    // Ensure raw is loaded when user asks for more
    if (!expensesRaw) {
      ensureRawLoaded();
    }
    setTransactionShowCount(prev => prev + ITEMS_PER_LOAD);
  }, [expensesRaw, ensureRawLoaded]);

  const handleCollapseTransactions = useCallback(() => {
    setTransactionShowCount(prev => Math.max(ITEMS_PER_LOAD, prev - ITEMS_PER_LOAD));
  }, []);

  // ---------------------
  // Derived data: when summaryData exists we build charts from it, else fallback to computing from raw (if available)
  // ---------------------
  // Helper to get totals & chart data from summaryData
  const buildFromSummary = useCallback(() => {
    // Expect summaryData rows: { PeriodType, PeriodLabel, StartDate, EndDate, Category, SubCategory, TotalExpense }
    const quarterlyData: QuarterData[] = [];
    const past3MonthsData: QuarterData[] = [];
    let totalExpense = 0;
    let currentMonthTotal = 0;

    // Build maps for quick lookup
    const monthRows = summaryData.filter(s => String(s.PeriodType).toLowerCase() === 'month');
    const quarterRows = summaryData.filter(s => String(s.PeriodType).toLowerCase() === 'quarter');

    // Build month totals for the last 3 months
    try {
      const sortedMonths = monthRows
        .map((r: any) => ({ ...r, StartDate: new Date(r.StartDate), EndDate: new Date(r.EndDate), TotalExpense: Number(r.TotalExpense || 0) }))
        .sort((a: any, b: any) => a.StartDate.getTime() - b.StartDate.getTime());
      // pick last 6+ months if available
      const now = new Date();
      const last3 = sortedMonths.filter((m: any) => {
        const md = m.StartDate;
        const monthsDiff = (now.getFullYear() - md.getFullYear()) * 12 + (now.getMonth() - md.getMonth());
        return monthsDiff >= 0 && monthsDiff <= 2; // last 3 months (0..2)
      });
      last3.forEach((m: any) => {
        past3MonthsData.push({
          label: m.PeriodLabel,
          value: Number(m.TotalExpense || 0),
          startDate: m.StartDate,
          endDate: m.EndDate,
          valueChange: 0, // we'll compute change later if needed
        });
      });
    } catch (e) {
      // ignore and fallback later
    }

    // Quarters
    try {
      const qSorted = quarterRows
        .map((r: any) => ({ ...r, StartDate: new Date(r.StartDate), EndDate: new Date(r.EndDate), TotalExpense: Number(r.TotalExpense || 0) }))
        .sort((a: any, b: any) => a.StartDate.getTime() - b.StartDate.getTime());

      // Extract quarter totals rows where Category is empty (grand totals)
      const qTotals = qSorted.filter((r: any) => !r.Category);
      // Map to QuarterData and compute valueChange vs previous quarter if present
      for (let i = 0; i < qTotals.length; i++) {
        const cur = qTotals[i];
        const prev = qTotals[i - 1];
        const value = Number(cur.TotalExpense || 0);
        const prevValue = prev ? Number(prev.TotalExpense || 0) : 0;
        quarterlyData.push({
          label: cur.PeriodLabel,
          value,
          startDate: cur.StartDate,
          endDate: cur.EndDate,
          valueChange: value - prevValue,
        });
      }
    } catch (e) {
      // ignore
    }

    // Totals from summary: if we have a row for the selected filter period (or grand totals)
    // Fallback: compute totalExpense from raw if available
    if (summaryData && summaryData.length > 0) {
      // total of current filters: if filters applied, we could search matching rows — but simpler:
      totalExpense = summaryData.reduce((s: number, r: any) => s + Number(r.TotalExpense || 0), 0);
    } else if (expensesRaw) {
      totalExpense = expensesRaw.reduce((s, e) => s + Number(e.amount || 0), 0);
    }

    // current month: try to derive from summary; else from raw
    if (summaryData && summaryData.length > 0) {
      const now = new Date();
      const monthLabel = `${now.toLocaleString('default', { month: 'short' })} ${now.getFullYear()}`;
      const monthRow = summaryData.find((r: any) => r.PeriodLabel === monthLabel && (!r.Category || r.Category === ''));
      if (monthRow) currentMonthTotal = Number(monthRow.TotalExpense || 0);
    }
    if (!currentMonthTotal && expensesRaw) {
      const now = new Date();
      const cm = expensesRaw.filter(e => {
        const d = new Date(e.date);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).reduce((s, e) => s + Number(e.amount || 0), 0);
      currentMonthTotal = cm;
    }

    return { totalExpense, currentMonthTotal, quarterlyData, past3MonthsData };
  }, [summaryData, expensesRaw]);

  const getFilteredExpenses = useCallback(() => {
    let filtered = expensesRaw || [];
    
    // Apply date filter
    const startDate = filters.startDate;
    const endDate = filters.endDate;
    
    filtered = filtered.filter(e => {
      const expDate = new Date(e.date);
      return expDate >= startDate && expDate <= endDate;
    });
    
    // Apply category filter
    if (filters.category) {
      filtered = filtered.filter(e => e.category === filters.category);
    }
    
    // Apply subcategory filter
    if (filters.subCategory) {
      filtered = filtered.filter(e => e.subCategory === filters.subCategory);
    }
    
    // Apply label filters
    if (filters.labels && filters.labels.length > 0) {
      filtered = filtered.filter(e => {
        return filters.labels.some((label: string) => (e.labels || []).includes(label));
      });
    }
    
    return filtered;
  }, [expensesRaw, filters]);
  
  // Use either summary-built data or fallback to in-memory computations from raw
const {
    totalExpense,
    currentMonthTotal,
    quarterlyData,
    past3MonthsData,
  } = useMemo(() => {
    // Always use filtered expenses for calculations
    const filteredExpenses = getFilteredExpenses();
    
    const now = new Date();
    const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    
    // Quarterly calculation from filtered data
    const quartersCalc = calculateQuarters(now).map((q, index, arr) => {
      const value = filteredExpenses.filter(e => {
        const d = new Date(e.date);
        return d >= q.startDate && d <= q.endDate;
      }).reduce((s, e) => s + Number(e.amount || 0), 0);
      
      // Calculate previous quarter value for comparison
      const prevQuarter = arr[index - 1];
      const previousQuarterValue = prevQuarter ? filteredExpenses.filter(e => {
        const d = new Date(e.date);
        return d >= prevQuarter.startDate && d <= prevQuarter.endDate;
      }).reduce((s, e) => s + Number(e.amount || 0), 0) : 0;
      
      return { label: q.label, value, startDate: q.startDate, endDate: q.endDate, valueChange: value - previousQuarterValue };
    }).reverse();

    // Past 3 months calculation from filtered data
    const past3 = [2, 1, 0].map((offset, index) => {
      const d = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = monthKey(d);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      const value = filteredExpenses.filter(e => monthKey(new Date(e.date)) === key).reduce((s, e) => s + Number(e.amount || 0), 0);
      
      // Calculate previous month value for comparison
      const prevMonthDate = new Date(d.getFullYear(), d.getMonth() - 1, 1);
      const prevKey = monthKey(prevMonthDate);
      const previousMonthValue = filteredExpenses.filter(e => monthKey(new Date(e.date)) === prevKey).reduce((s, e) => s + Number(e.amount || 0), 0);
      
      return { label: d.toLocaleString('default', { month: 'short', year: 'numeric' }), value, startDate: start, endDate: end, valueChange: value - previousMonthValue };
    });

    const tot = filteredExpenses.reduce((s, e) => s + Number(e.amount || 0), 0);
    const curMonth = filteredExpenses.filter(e => {
      const d = new Date(e.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).reduce((s, e) => s + Number(e.amount || 0), 0);

    return {
      totalExpense: tot,
      currentMonthTotal: curMonth,
      quarterlyData: quartersCalc,
      past3MonthsData: past3,
    };
  }, [getFilteredExpenses]);

  // ---------------------
  // Category & subcategory pie data
  // If we have summaryData we extract category totals directly; otherwise compute from raw
  // ---------------------
const { categoryPieData, subCategoryPieData, filterOptions } = useMemo(() => {
    const categories = new Set<string>();
    const subCategories = new Set<string>();
    const labels = new Set<string>();

    // For category breakdown, we want to show all categories even when one is selected
    // But we still apply date filters
    let expensesForCategoryBreakdown = expensesRaw || [];
    
    // Apply date filter only
    const startDate = filters.startDate;
    const endDate = filters.endDate;
    expensesForCategoryBreakdown = expensesForCategoryBreakdown.filter(e => {
      const expDate = new Date(e.date);
      return expDate >= startDate && expDate <= endDate;
    });

    const catTotals: { [k: string]: { value: number, name: string } } = {};
    expensesForCategoryBreakdown.forEach(e => {
      categories.add(e.category || 'Uncategorized');
      if (e.subCategory) subCategories.add(e.subCategory);
      (e.labels || []).forEach(l => labels.add(l));
      
      const catKey = e.category || 'Uncategorized';
      if (!catTotals[catKey]) catTotals[catKey] = { value: 0, name: catKey };
      catTotals[catKey].value += Number(e.amount) || 0;
    });

    const subCategoryTotals: { [k: string]: { value: number, name: string } } = {};
    if (selectedCategoryForDrill) {
      expensesForCategoryBreakdown.forEach(e => {
        if (e.category === selectedCategoryForDrill) {
          const key = e.subCategory || 'Uncategorized';
          if (!subCategoryTotals[key]) subCategoryTotals[key] = { value: 0, name: key };
          subCategoryTotals[key].value += Number(e.amount) || 0;
        }
      });
    }

    return {
      categoryPieData: Object.values(catTotals),
      subCategoryPieData: Object.values(subCategoryTotals),
      filterOptions: {
        categories: Array.from(categories).sort(),
        subCategories: Array.from(subCategories).sort(),
        labels: Array.from(labels).sort(),
      }
    };
  }, [expensesRaw, filters.startDate, filters.endDate, selectedCategoryForDrill]);

  const sortedTransactions = useMemo(() => {
    const list = [...(expensesRaw || [])];
    if (sortBy === 'date') {
      list.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return sortOrder === 'asc' ? dateA - dateB : dateB - dateA;
      });
    } else {
      list.sort((a, b) => sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount);
    }
    return list;
  }, [expensesRaw, sortBy, sortOrder]);

  const getMainFilterDetail = () => {
    let detail = '';
    if (filters.category) {
      detail += `Category: ${filters.category}`;
      if (filters.subCategory) detail += ` / ${filters.subCategory}`;
      detail += ' | ';
    } else if (filters.subCategory) {
      detail += `Sub-Category: ${filters.subCategory} | `;
    }
    if (filters.labels.length > 0) detail += `Labels: ${filters.labels.join(', ')} | `;
    const startDateStr = filters.startDate.toLocaleDateString();
    const endDateStr = filters.endDate.toLocaleDateString();
    detail += `Date: ${startDateStr} - ${endDateStr}`;
    return detail.trim();
  };

  const getActiveDrillDownText = () => {
    const parts = [];
    if (drillDownDateFilter) {
      parts.push(`Date: ${new Date(drillDownDateFilter.startDate).toLocaleDateString()} to ${new Date(drillDownDateFilter.endDate).toLocaleDateString()}`);
    }
    if (selectedCategoryForDrill) parts.push(`Category: ${selectedCategoryForDrill}`);
    if (selectedSubCategoryForDrill) parts.push(`Sub-Category: ${selectedSubCategoryForDrill}`);
    return parts.length > 0 ? parts.join(' | ') : '';
  };

  const hasActiveDrillDown = drillDownDateFilter || selectedCategoryForDrill || selectedSubCategoryForDrill;

  // UI render: mostly identical but ensure raw is loaded when Recent Transactions are interacted with
  return (
    <>
      {/* FilterSidebar component (unchanged) */}
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
            onPress={async () => {
              // ensure filter options are available (requires raw data if not enough info in summary)
              if ((!summaryData || summaryData.length === 0) && !expensesRaw) {
                await ensureRawLoaded();
              }
              setFilterOpen(true);
            }}
            disabled={false}>
            <Filter size={18} color="#ffffff" />
            <Text style={styles.filterButtonText}>Filter</Text>
          </TouchableOpacity>
        </View>

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

        {/* Loading summary indicator */}
        {isLoadingSummary ? <Text>Loading...</Text> : (
          <>
            <View style={styles.statsGrid}>
              <StatCard
                icon={<TrendingUp size={24} color="#2563eb" />}
                title="Total Expense"
                value={`₹${totalExpense.toFixed(2)}`}
                subtitle=""
              />
              <StatCard
                icon={<Calendar size={24} color="#10b981" />}
                title="Current Month"
                value={`₹${currentMonthTotal.toFixed(2)}`}
                subtitle=""
              />
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
                    >
                      <Text style={styles.expenseLabel}>{quarter.label}</Text>
                      <View style={styles.expenseValueContainer}>
                        <Text style={styles.expenseValue}>{`₹${quarter.value.toFixed(2)}`}</Text>
                        {quarter.valueChange !== 0 && (
                          <View style={styles.indicatorContainer}>
                            {quarter.valueChange > 0 ? (
                              <>
                                <ArrowUp size={12} color="#ef4444" />
                                <Text style={[styles.percentageText, { color: '#ef4444' }]}>
                                  {`${Math.abs(percentageChange).toFixed(1)}%`}
                                </Text>
                              </>
                            ) : (
                              <>
                                <ArrowDown size={12} color="#10b981" />
                                <Text style={[styles.percentageText, { color: '#10b981' }]}>
                                  {`${Math.abs(percentageChange).toFixed(1)}%`}
                                </Text>
                              </>
                            )}
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
                      onPress={() => handleQuarterlyDrillDown(month)}
                    >
                      <Text style={styles.expenseLabel}>{month.label}</Text>
                      <View style={styles.expenseValueContainer}>
                        <Text style={styles.expenseValue}>{`₹${month.value.toFixed(2)}`}</Text>
                        {month.valueChange !== 0 && (
                          <View style={styles.indicatorContainer}>
                            {month.valueChange > 0 ? (
                              <>
                                <ArrowUp size={12} color="#ef4444" />
                                <Text style={[styles.percentageText, { color: '#ef4444' }]}>
                                  {`${Math.abs(percentageChange).toFixed(1)}%`}
                                </Text>
                              </>
                            ) : (
                              <>
                                <ArrowDown size={12} color="#10b981" />
                                <Text style={[styles.percentageText, { color: '#10b981' }]}>
                                  {`${Math.abs(percentageChange).toFixed(1)}%`}
                                </Text>
                              </>
                            )}
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
                  <TouchableOpacity onPress={async () => {
                    setSelectedCategoryForDrill(null);
                    setSelectedSubCategoryForDrill(null);
                    
                    // Reset category filter but keep other filters
                    const newFilters = {
                      ...filters,
                      category: null,
                      subCategory: null,
                    };
                    setFilters(newFilters);
                    
                    // Refetch with updated filters
                    const opts: any = {
                      startDate: newFilters.startDate.toISOString().slice(0,10),
                      endDate: newFilters.endDate.toISOString().slice(0,10),
                    };
                    await fetchRaw(opts);
                  }} style={styles.drilldownHeader}>
                    <Text style={styles.backButton}>← Back to Categories</Text>
                  </TouchableOpacity>
                  <PieChart
                    title={`Sub-categories of ${selectedCategoryForDrill}`}
                    data={subCategoryPieData}
                    onSlicePress={async (name: string) => {
                      await handleSubCategoryDrillDown(name);
                    }}
                    noContainerStyle={true}
                    detailText="Click to drill down by sub-category"
                    detailPosition='left'
                  />
                </>
              ) : (
                <PieChart
                  title="Category Breakdown"
                  data={categoryPieData}
                  onSlicePress={async (name: string) => {
                    await handleCategoryDrillDown(name);
                  }}
                  noContainerStyle={true}
                  showCount={categoryShowCount}
                  onShowMore={() => setCategoryShowCount(prev => prev + ITEMS_PER_LOAD)}
                  onCollapse={() => setCategoryShowCount(prev => Math.max(ITEMS_PER_LOAD, prev - ITEMS_PER_LOAD))}
                  detailText="Click to drill down by category"
                  detailPosition='left'
                />
              )}
            </View>

            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Moving Averages</Text>
              <View style={styles.maGrid}>
                {/* For moving averages we prefer precomputed monthly totals from summaryData.
                    If summaryData is not present we still compute from raw (slower). */}
                {/* You can reuse your MovingAverageCard components here as before */}
                {/* For brevity not repeating the component markup — use your original MovingAverageCard calls */}
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

              {/* Recent transactions list: ensure raw is loaded when opening or when "More" clicked */}
              <TouchableOpacity onPress={handleToggleRecent} style={{ marginBottom: 8 }}>
                <Text style={{ color: '#2563eb', fontWeight: '600' }}>{recentTransactionsVisible ? 'Hide' : 'Show'} Recent Transactions</Text>
              </TouchableOpacity>

              {recentTransactionsVisible ? (
                isLoadingRaw && !expensesRaw ? (
                  <Text>Loading transactions...</Text>
                ) : (
                  <ExpenseList
                    expenses={(sortedTransactions || []).slice(0, transactionShowCount)}
                    onDelete={handleDeleteExpense}
                    onEdit={handleEditExpense}
                  />
                )
              ) : null}

              {(sortedTransactions.length > ITEMS_PER_LOAD) && (
                <View style={styles.paginationControls}>
                  {transactionShowCount > ITEMS_PER_LOAD && (
                    <TouchableOpacity style={styles.collapseButton} onPress={handleCollapseTransactions}>
                      <Text style={styles.paginationText}>Collapse</Text>
                      <ChevronUp size={16} color="#2563eb" />
                    </TouchableOpacity>
                  )}
                  {sortedTransactions.length > transactionShowCount && (
                    <TouchableOpacity style={styles.moreButton} onPress={async () => {
                      // ensure raw loaded and then show more
                      if (!expensesRaw) await ensureRawLoaded();
                      handleShowMoreTransactions();
                    }}>
                      <Text style={styles.paginationText}>More ({sortedTransactions.length - transactionShowCount} left)</Text>
                      <ChevronDown size={16} color="#2563eb" />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}
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

if (__DEV__) {
  activateKeepAwake(); // Only activate in development mode
}