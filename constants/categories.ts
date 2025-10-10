export const CATEGORY_MAP: Record<string, string[]> = {
  "Housing": [
    "Rent",
    "Electricity",
    "Water",
    "Internet",
    "Phone Recharge",
    "Home Maintenance",
    "Home Shopping",
  ],
  "Food": [
    "Groceries",
    "Restaurants",
    "Tea/Snacks",
  ],
  "Transportation": [
    "Fuel",
    "Vehicle Maintenance",
    "Vehicle Insurance",
    "Public Transport",
    "Taxi",
    "Parking",
    "Vehicle",
  ],
  "Health & Wellness": [
    "Doctor & Consultations",
    "Medicines",
    "Health Insurance",
    "Fitness",
  ],
  "Personal Spending": [
    "Clothes & Shoes",
    "Personal Care",
    "Electronics & Gadgets",
    "Books & Education",
    "Hobbies",
  ],
  "Entertainment": [
    "Subscriptions",
    "Movies & Events",
    "Vacation Stay",
    "Games and Adventure",
  ],
  "Family & Kids": [
    "Baby Care",
    "School & Education",
    "Toys & Activities",
  ],
  "Giving & Gifts": [
    "Gifts",
    "Charity",
    "Zakat",
  ],
  "Financial": [
    "Taxes",
    "Savings",
    "Investments",
    "Debt Repayment",
  ],
  "Miscellaneous": [],
};

// Convenience export if you just need top-level list:
export const CATEGORIES = Object.keys(CATEGORY_MAP);
