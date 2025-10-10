export interface Expense {
  id: string;
  date: string;
  category: string;
  subCategory?: string; // ✅ New
  item: string;
  amount: number;
  email: string;
  shopName: string;
  paymentMode: string;
  labels: string[];
  timestamp?: string;
}

export const CATEGORY_STRUCTURE = {
  Housing: [
    'Rent', 'Electricity', 'Water', 'Internet', 'Phone Recharge', 'Home Maintenance', 'Home Shopping',
  ],
  Food: [
    'Groceries', 'Restaurants', 'Tea/Snacks',
  ],
  Transportation: [
    'Fuel', 'Vehicle Maintenance', 'Vehicle Insurance', 'Public Transport', 'Taxi', 'Parking',
  ],
  'Health & Wellness': [
    'Doctor & Consultations', 'Medicines', 'Health Insurance', 'Fitness',
  ],
  'Personal Spending': [
    'Clothes & Shoes', 'Personal Care', 'Electronics & Gadgets', 'Books & Education', 'Hobbies',
  ],
  Entertainment: [
    'Subscriptions', 'Movies & Events', 'Vacation Stay', 'Games and Adventure',
  ],
  'Family & Kids': [
    'Baby Care', 'School & Education', 'Toys & Activities',
  ],
  'Giving & Gifts': [
    'Gifts', 'Charity', 'Zakat',
  ],
  Financial: [
    'Taxes', 'Savings', 'Investments', 'Debt Repayment',
  ],
  Miscellaneous: [],
};

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
