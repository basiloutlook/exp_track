// utils/dashboardCacheService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense } from '@/types/expense';

const CACHE_KEY = '@dashboard_cache';
const CACHE_VERSION = 'v1';

export interface DashboardCache {
  version: string;
  timestamp: number;
  expenseCount: number;
  
  // Pre-computed aggregates (only for default view - no filters)
  totalExpense: number;
  currentMonthTotal: number;
  
  // Category breakdown
  categoryTotals: Record<string, number>;
  
  // Quarterly data
  quarterlyTotals: Array<{
    label: string;
    value: number;
    startDate: string;
    endDate: string;
  }>;
  
  // Monthly data (last 3 months)
  monthlyTotals: Array<{
    label: string;
    value: number;
    startDate: string;
    endDate: string;
  }>;
  
  // Moving averages
  movingAverages: {
    ma3: number;
    ma6: number;
    ma12: number;
    ma36: number;
  };
  
  // Filter options
  filterOptions: {
    categories: string[];
    subCategories: string[];
    labels: string[];
    emails: string[];
  };
}

class DashboardCacheService {
  async getCache(): Promise<DashboardCache | null> {
    try {
      const cached = await AsyncStorage.getItem(CACHE_KEY);
      if (!cached) return null;
      
      const data = JSON.parse(cached);
      
      if (data.version !== CACHE_VERSION) {
        console.log('📦 Cache version mismatch, clearing');
        await this.clearCache();
        return null;
      }
      
      const age = Date.now() - data.timestamp;
      if (age > 60 * 60 * 1000) { // 1 hour
        console.log('📦 Cache is stale');
        return null;
      }
      
      console.log('📦 Using cached dashboard data');
      return data;
    } catch (error) {
      console.error('Error loading dashboard cache:', error);
      return null;
    }
  }
  
  async computeAndCache(expenses: Expense[]): Promise<DashboardCache> {
    console.log('🔄 Computing dashboard aggregates...');
    
    const now = new Date();
    
    // Total expense
    const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);
    
    // Current month total
    const currentMonthTotal = expenses
      .filter(e => {
        const d = new Date(e.date);
        return d.getMonth() === now.getMonth() && 
               d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, e) => sum + e.amount, 0);
    
    // Category totals
    const categoryTotals: Record<string, number> = {};
    expenses.forEach(e => {
      categoryTotals[e.category] = (categoryTotals[e.category] || 0) + e.amount;
    });
    
    // Quarterly data
    const quarters = this.calculateQuarters(now);
    const quarterlyTotals = quarters.map(q => ({
      label: q.label,
      value: expenses
        .filter(e => {
          const d = new Date(e.date);
          return d >= q.startDate && d <= q.endDate;
        })
        .reduce((sum, e) => sum + e.amount, 0),
      startDate: q.startDate.toISOString(),
      endDate: q.endDate.toISOString(),
    }));
    
    // Monthly data (last 3 months)
    const monthlyTotals = [1, 2, 3].map(i => {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const start = new Date(d.getFullYear(), d.getMonth(), 1);
      const end = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      
      return {
        label: d.toLocaleString('default', { month: 'short', year: 'numeric' }),
        value: expenses
          .filter(e => {
            const expDate = new Date(e.date);
            return expDate >= start && expDate <= end;
          })
          .reduce((sum, e) => sum + e.amount, 0),
        startDate: start.toISOString(),
        endDate: end.toISOString(),
      };
    });
    
    // Moving averages
    const movingAverages = this.calculateMovingAverages(expenses, now);
    
    // Filter options
    const categories = new Set<string>();
    const subCategories = new Set<string>();
    const labels = new Set<string>();
    const emails = new Set<string>();
    
    expenses.forEach(e => {
      categories.add(e.category);
      if (e.subCategory) subCategories.add(e.subCategory);
      e.labels?.forEach(l => labels.add(l));
      if (e.email) emails.add(e.email);
    });
    
    const cache: DashboardCache = {
      version: CACHE_VERSION,
      timestamp: Date.now(),
      expenseCount: expenses.length,
      totalExpense,
      currentMonthTotal,
      categoryTotals,
      quarterlyTotals,
      monthlyTotals,
      movingAverages,
      filterOptions: {
        categories: Array.from(categories).sort(),
        subCategories: Array.from(subCategories).sort(),
        labels: Array.from(labels).sort(),
        emails: Array.from(emails).sort(),
      },
    };
    
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    console.log('✅ Dashboard cache saved');
    
    return cache;
  }
  
  async clearCache(): Promise<void> {
    await AsyncStorage.removeItem(CACHE_KEY);
    console.log('🗑️ Dashboard cache cleared');
  }
  
  private calculateQuarters(currentDate: Date) {
    const currentMonth = currentDate.getMonth();
    const currentYear = currentDate.getFullYear();
    const quarters = [];
    
    for (let i = 0; i < 4; i++) {
      const endMonthIndex = currentMonth - 1 - (i * 3);
      const endDate = new Date(currentYear, endMonthIndex + 1, 0);
      const startDate = new Date(currentYear, endMonthIndex - 2, 1);
      
      const quarterLabel = `${startDate.toLocaleString('default', { month: 'short' })} '${String(startDate.getFullYear()).slice(2)} - ${endDate.toLocaleString('default', { month: 'short' })} '${String(endDate.getFullYear()).slice(2)}`;
      
      quarters.push({
        label: quarterLabel,
        startDate,
        endDate,
      });
    }
    
    return quarters.reverse();
  }
  
  private calculateMovingAverages(expenses: Expense[], now: Date) {
    const monthKey = (d: Date) => 
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    
    const monthlyMap: Record<string, number> = {};
    expenses.forEach(e => {
      const k = monthKey(new Date(e.date));
      monthlyMap[k] = (monthlyMap[k] || 0) + e.amount;
    });
    
    const calculateMA = (months: number) => {
      const values = Array.from({ length: months }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (i + 1), 1);
        return monthlyMap[monthKey(d)] || 0;
      });
      const total = values.reduce((sum, v) => sum + v, 0);
      return total / months;
    };
    
    return {
      ma3: calculateMA(3),
      ma6: calculateMA(6),
      ma12: calculateMA(12),
      ma36: calculateMA(36),
    };
  }
}

export const dashboardCacheService = new DashboardCacheService();