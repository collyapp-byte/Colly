-- Credit Economy: the Naira wallet becomes a credit balance (1 credit = 1 Naira).
-- Renaming keeps existing balances instead of dropping the column.
ALTER TABLE "Business" RENAME COLUMN "creditWalletBalanceNaira" TO "creditBalance";
