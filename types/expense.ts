export interface Expense {
  id: string;
  date: string;
  category: string;
  item: string;
  amount: number;
  email: string;
  shopName: string;
  paymentMode: string;
  labels: string[];
  timestamp?: string;
}

export const CATEGORIES = [
  'Auto or Taxi',
  'Baby Care',
  'Bigger Expense',
  'Books',
  'Charity',
  'Clothes & Shoes',
  'Doctor & Meds',
  'Eat Out',
  'Education',
  'Electricity',
  'Electronics',
  'Entertainment',
  'Fitness',
  'Fuel',
  'Gifts',
  'Grocery',
  'Home Shopping',
  'House Maintenance',
  'Internet',
  'Parking',
  'Personal Shopping',
  'Personal Care',
  'Phone Recharge',
  'Public Transport',
  'Rent',
  'Tax',
  'Treat',
  'Trips',
  'Veggies',
  'Veh Insurance',
  'Veh Maintenance',
  'Zakat',
];

export const PAYMENT_MODES = [
  'Basil GPay',
  'Basil SuperMoney',
  'Basil PhonePe',
  'Basil Cash',
  'Basil Card',
  'Anu GPay',
  'Anu Cash',
  'Anu Card',
];
