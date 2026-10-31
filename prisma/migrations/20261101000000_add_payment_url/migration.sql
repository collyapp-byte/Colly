-- In-chat payment links: the Paystack checkout URL created for a specific
-- amount inside a conversation, stored on the message that carried it.
ALTER TABLE "Message" ADD COLUMN "paymentUrl" TEXT;
