export type TokenResponseSchema = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};

export type CategoryType = "income" | "expense";

export type LoginRequest = {
  email: string;
  password: string;
};

export type UserCreate = {
  email: string;
  name: string;
  password: string;
};

export type UserResponse = {
  id: number;
  email: string;
  name: string;
  created_at: string;
};

export type CurrencyResponse = {
  id: number;
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
  currency_id: number;
  short_identifier: string | null;
  created_at: string;
};

export type AccountCreate = {
  name: string;
  color: string;
  icon: string;
  currency_id: number;
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
  amount?: number | null;
  description?: string | null;
  transaction_date?: string | null;
  category_id?: number | null;
};
