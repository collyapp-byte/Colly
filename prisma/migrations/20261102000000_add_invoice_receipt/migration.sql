-- Receipt-to-invoice: an invoice generated from a picture the customer sent in
-- chat keeps the proof of payment (`receiptUrl`) and a note for the owner
-- explaining that the draft still needs verifying.
ALTER TABLE "Invoice"
  ADD COLUMN "notes" TEXT,
  ADD COLUMN "receiptUrl" TEXT;
