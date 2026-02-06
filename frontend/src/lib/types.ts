export type TokenResponseSchema = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type CategoryType = "income" | "expense";

export type UserResponse = {
  id: number;
  email: string;
  name: string;
  is_active: boolean;
  created_at: string;
};

export type UserUpdate = {
  name?: string;
};

export type CurrencyResponse = {
  code: string;
  name: string;
  symbol: string;
  created_at: string;
};

export type AccountResponse = {
  id: number;
  user_id: number;
  name: string;
  color: string;
  icon: string;
  currency_code: string;
  short_identifier: string | null;
  created_at: string;
};

export type AccountCreate = {
  name: string;
  color: string;
  icon: string;
  currency_code: string;
  short_identifier?: string | null;
};

export type AccountUpdate = Partial<AccountCreate>;

export type CategoryResponse = {
  id: number;
  user_id: number;
  name: string;
  color: string;
  icon: string;
  type: CategoryType;
  created_at: string;
};

export type CategoryCreate = {
  name: string;
  color: string;
  icon: string;
  type: CategoryType;
};

export type CategoryUpdate = Partial<CategoryCreate>;

export type TransactionType = "income" | "expense" | "transfer";

export type TransactionResponse = {
  id: number;
  user_id: number;
  type: TransactionType;
  account_id: number;
  target_account_id: number | null;
  category_id: number | null;
  amount: string;
  converted_amount: string | null;
  exchange_rate: string | null;
  description: string | null;
  transaction_date: string;
  shopping_list_id: number | null;
  created_at: string;
};

export type TransactionCreate = {
  type: TransactionType;
  account_id: number;
  amount: number;
  description?: string | null;
  transaction_date?: string;
  target_account_id?: number | null;
  category_id?: number | null;
};

export type TransactionUpdate = {
  account_id?: number | null;
  target_account_id?: number | null;
  amount?: number | null;
  description?: string | null;
  transaction_date?: string | null;
  category_id?: number | null;
};

export type AccountBalanceResponse = {
  account_id: number;
  account_name: string;
  currency_code: string;
  currency_symbol: string;
  balance: string;
};

export type TotalBalanceResponse = {
  total_balance: string;
  currency_code: string;
};

export type CategorySummaryResponse = {
  category_id: number;
  category_name: string;
  category_icon: string;
  category_color: string;
  amount: string;
};

export type PeriodStatisticsResponse = {
  start_date: string;
  end_date: string;
  total_income: string;
  total_expense: string;
  net_change: string;
  income_by_category: CategorySummaryResponse[];
  expense_by_category: CategorySummaryResponse[];
};

export type ShoppingListStatus = "draft" | "confirmed" | "completed";

export type ShoppingItemResponse = {
  id: number;
  shopping_list_id: number;
  name: string;
  quantity: number;
  price: string | null;
  is_checked: boolean;
  total_price: string | null;
};

export type ShoppingItemCreate = {
  name: string;
  quantity?: number;
  price?: number | null;
};

export type ShoppingItemUpdate = {
  name?: string | null;
  quantity?: number | null;
  price?: number | null;
  is_checked?: boolean | null;
};

export type ShoppingListResponse = {
  id: number;
  user_id: number;
  name: string;
  account_id: number;
  category_id: number;
  status: ShoppingListStatus;
  total_amount: string | null;
  confirmed_at: string | null;
  completed_at: string | null;
  transaction_id: number | null;
  created_at: string;
  items: ShoppingItemResponse[];
};

export type ShoppingListCreate = {
  name: string;
  account_id: number;
  category_id: number;
  items?: ShoppingItemCreate[];
};

export type ShoppingListUpdate = {
  name?: string | null;
  account_id?: number | null;
  category_id?: number | null;
};

export type ShoppingTemplateItemResponse = {
  id: number;
  template_id: number;
  name: string;
  default_quantity: number;
  default_price: string | null;
};

export type ShoppingTemplateItemCreate = {
  name: string;
  default_quantity?: number;
  default_price?: number | null;
};

export type ShoppingTemplateItemUpdate = {
  name?: string | null;
  default_quantity?: number | null;
  default_price?: number | null;
};

export type ShoppingTemplateResponse = {
  id: number;
  user_id: number;
  name: string;
  color: string;
  icon: string;
  default_account_id: number | null;
  default_category_id: number | null;
  created_at: string;
  items: ShoppingTemplateItemResponse[];
};

export type ShoppingTemplateCreate = {
  name: string;
  color: string;
  icon: string;
  default_account_id?: number | null;
  default_category_id?: number | null;
  items?: ShoppingTemplateItemCreate[];
};

export type ShoppingTemplateUpdate = {
  name?: string | null;
  color?: string | null;
  icon?: string | null;
  default_account_id?: number | null;
  default_category_id?: number | null;
};

export type RecurringFrequency = "daily" | "weekly" | "monthly";

export type RecurringTransactionResponse = {
  id: number;
  user_id: number;
  type: "income" | "expense";
  account_id: number;
  category_id: number;
  amount: string;
  description: string | null;
  frequency: RecurringFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  next_execution_date: string;
  last_executed_at: string | null;
  created_at: string;
};

export type RecurringTransactionCreate = {
  type: "income" | "expense";
  account_id: number;
  category_id: number;
  amount: number;
  description?: string | null;
  frequency: RecurringFrequency;
  day_of_week?: number | null;
  day_of_month?: number | null;
  start_date: string;
  end_date?: string | null;
};

export type RecurringTransactionUpdate = {
  amount?: number | null;
  description?: string | null;
  category_id?: number | null;
  frequency?: RecurringFrequency | null;
  day_of_week?: number | null;
  day_of_month?: number | null;
  end_date?: string | null;
  is_active?: boolean | null;
};
