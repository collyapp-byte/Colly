/* eslint-disable @typescript-eslint/no-require-imports */
// Development seed script for Colly.
//
// Creates one demo tenant (ABC Electronics) with three customers, one
// conversation each, and a handful of realistic WhatsApp-style messages.
//
// Run with:
//   node prisma/seed.cjs        (or: npx prisma db seed)
//
// It wipes the seeded data first (children cascade), so it is safe to re-run.
// Real accounts (a `User` row linked to a Supabase Auth user) are preserved:
// they are captured before the wipe and re-linked to a "Personal" business.
// Agent rows are never wiped either: three demo agents are ensured for the
// /find-an-agent directory, and an agent that already exists is left
// as-is.

require("dotenv").config();

const fs = require("fs");
const path = require("path");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const MINUTE = 60 * 1000;

// Owner account for the demo tenant. Sign up with this address to see the
// seeded ABC Electronics data.
const DEMO_OWNER_EMAIL = "demo@colly.test";

// Message "minutesAgo" values are relative to when the seed runs, chosen so the
// conversations list shows a spread of relative times (minutes / an hour / a
// day ago).
const CONVERSATIONS = [
  {
    status: "OPEN",
    customer: { name: "Chioma Okafor", phone: "+2348023456789" },
    messages: [
      {
        sender: "customer",
        minutesAgo: 20,
        content:
          "Good afternoon. I saw your post about the Hisense 32 inch TV. How much is it abeg?",
      },
      {
        sender: "ai",
        minutesAgo: 19,
        content:
          "Good afternoon! Thank you for reaching out. The Hisense 32 inch TV is ₦145,000 and we have 4 units in stock. Would you like me to reserve one for you?",
      },
      {
        sender: "customer",
        minutesAgo: 15,
        content: "Okay. Does it come with warranty?",
      },
      {
        sender: "ai",
        minutesAgo: 14,
        content:
          "Yes o. Every unit comes with a 6 month warranty from the manufacturer, and we test it properly before delivery.",
      },
      {
        sender: "customer",
        minutesAgo: 10,
        content: "That is good. Can I pay on delivery?",
      },
      {
        sender: "ai",
        minutesAgo: 9,
        content:
          "For Lagos mainland we accept pay on delivery. Delivery is ₦3,500 within Lagos. Just send your full address and I will schedule it.",
      },
      {
        sender: "customer",
        minutesAgo: 4,
        content: "Alright, I will send my address now.",
      },
      {
        sender: "ai",
        minutesAgo: 2,
        content:
          "Thank you Chioma. I will be waiting. Should I reserve one unit for you in the meantime?",
      },
    ],
  },
  {
    status: "PENDING",
    customer: { name: "Emeka Nwosu", phone: "+2348134567890" },
    messages: [
      {
        sender: "customer",
        minutesAgo: 95,
        content: "Hello, do you still have the Samsung Galaxy A15?",
      },
      {
        sender: "ai",
        minutesAgo: 93,
        content:
          "Yes we do. The Samsung Galaxy A15 128GB is ₦185,000 and it is available in black and blue. Which colour do you prefer?",
      },
      {
        sender: "customer",
        minutesAgo: 90,
        content: "The blue one. I want to order.",
      },
      {
        sender: "ai",
        minutesAgo: 88,
        content:
          "Great choice! To confirm your order, please transfer ₦185,000 to our account and send the receipt here. Delivery within Lagos takes 1 to 2 working days.",
      },
      {
        sender: "customer",
        minutesAgo: 80,
        content: "I have sent the payment now. Here is the receipt.",
      },
      {
        sender: "ai",
        minutesAgo: 76,
        content:
          "Thank you Emeka, I can see the payment. Your blue Samsung Galaxy A15 has been confirmed. Our rider will deliver tomorrow between 10am and 2pm.",
      },
      {
        sender: "customer",
        minutesAgo: 70,
        content:
          "Please what time exactly? I may not be around in the morning.",
      },
      {
        sender: "ai",
        minutesAgo: 60,
        content:
          "No problem, I have noted that. I will ask the rider to come in the afternoon. Would 3pm work for you?",
      },
    ],
  },
  {
    status: "CLOSED",
    customer: { name: "Aisha Bello", phone: "+2347045678901" },
    messages: [
      {
        sender: "customer",
        minutesAgo: 1700,
        content:
          "Good morning. I ordered a standing fan last week but I have not received it.",
      },
      {
        sender: "ai",
        minutesAgo: 1690,
        content:
          "Good morning Aisha, I am sorry about the delay. Let me check your order. Please share your order number or the phone number you used.",
      },
      {
        sender: "customer",
        minutesAgo: 1680,
        content: "It is 08037654321.",
      },
      {
        sender: "ai",
        minutesAgo: 1670,
        content:
          "Thank you. I can see your order for the Ox standing fan. It was dispatched yesterday and the rider should reach you today before 5pm.",
      },
      {
        sender: "customer",
        minutesAgo: 1665,
        content: "But I need it this morning, my shop opens at 9am.",
      },
      {
        sender: "ai",
        minutesAgo: 1660,
        content:
          "I understand. I am connecting you with our team to arrange a faster delivery.",
      },
      {
        sender: "agent",
        minutesAgo: 1650,
        content:
          "Hi Aisha, this is Bola from ABC Electronics. I have arranged for the rider to bring your fan before 9am. Sorry for the inconvenience.",
      },
    ],
  },
];

// Products for the demo catalogue. Descriptions are what the AI will read when
// answering customer questions, so they carry real detail.
const PRODUCTS = [
  {
    name: 'Hisense 32" LED TV',
    price: 145000,
    stock: 4,
    description:
      "32 inch HD LED TV with 2 HDMI ports and a USB port. Comes with a 6 month warranty.",
  },
  {
    name: 'Hisense 43" Smart TV',
    price: 285000,
    stock: 2,
    description:
      "43 inch Full HD smart TV with built-in WiFi plus Netflix and YouTube apps.",
  },
  {
    name: "LG 1.5HP Inverter Air Conditioner",
    price: 420000,
    stock: 1,
    description:
      "Energy-saving inverter AC with fast cooling. Installation can be arranged at an extra cost.",
  },
  {
    name: "Samsung Galaxy A15",
    price: 185000,
    stock: 8,
    description:
      "128GB storage, 4GB RAM and a 50MP camera. Available in black and blue.",
  },
  {
    name: "Tecno Spark 20",
    price: 98000,
    stock: 15,
    description:
      "Affordable smartphone with a 6.6 inch display, 128GB storage and a 5000mAh battery.",
  },
  {
    name: "Rechargeable Standing Fan",
    price: 45000,
    stock: 12,
    description:
      "Stays on during power cuts. Includes a rechargeable battery and an LED light.",
  },
  {
    name: "Electric Kettle 1.8L",
    price: 18500,
    stock: 25,
    description:
      "Stainless steel 1.8 litre kettle with auto shut-off and boil-dry protection.",
  },
  {
    name: "Home Theatre System",
    price: 95000,
    stock: null,
    description: "2.1 channel sound system with Bluetooth, USB and FM radio.",
  },
  {
    name: "Extension Box (4-way)",
    price: 4500,
    stock: null,
    description:
      "4 sockets with a 2 metre cable and a built-in surge protector.",
  },
  {
    name: "Blender 2L",
    price: 28000,
    stock: 6,
    description:
      "2 litre jug with stainless steel blades for smoothies, pepper and more.",
  },
];

// FAQ knowledge base for the demo tenant. These are the answers the AI reads
// when a customer asks about policies, delivery, payment and so on.
const FAQS = [
  {
    category: "Delivery",
    question: "Do you deliver?",
    answer:
      "Yes, we deliver within Lagos and Abuja. Delivery takes 1-2 business days. Delivery fee depends on location.",
  },
  {
    category: "Payment",
    question: "What payment methods do you accept?",
    answer: "We accept bank transfer and cash on delivery.",
  },
  {
    category: "Returns",
    question: "Can I return a product?",
    answer:
      "Yes. Returns accepted within 7 days if the product is defective or not as described.",
  },
  {
    category: "Warranty",
    question: "Do you offer warranty?",
    answer:
      "All electronics come with a minimum 1 year manufacturer warranty.",
  },
  {
    category: "Location",
    question: "Where is your shop located?",
    answer: "We are at 45 Computer Village, Ikeja, Lagos.",
  },
  {
    category: "Hours",
    question: "What are your opening hours?",
    answer:
      "Monday to Friday 9am to 6pm, Saturday 10am to 4pm. Closed on Sundays.",
  },
  {
    category: "Delivery",
    question: "Do you offer installation?",
    answer:
      "Yes, installation is available for TVs and air conditioners at an extra fee that depends on your location.",
  },
];

// Agent training content. Seeded additively (see the upsert logic in main) so
// re-running the seed does not duplicate courses or wipe agents' progress. No
// `Agent` rows are created here: agents sign up themselves.
const AGENT_COURSES = [
  {
    slug: "understanding-colly",
    title: "Understanding Colly",
    description:
      "The foundations. What Colly is, what it does, what it costs, and what it cannot do. Every agent must complete this before touching a customer.",
    order: 0,
    isCertificationCourse: true,
    lessons: [
      {
        slug: "what-whatsapp-business-api-is",
        title: "The Multi-Channel AI (Telegram, Web Chat, Discord)",
        order: 0,
        durationMin: 5,
        bodyMarkdown: `Every business in Nigeria uses WhatsApp. But we are not starting with WhatsApp.

Why? Because Meta requires a **CAC certificate** to use the official WhatsApp API. If we wait for every business owner to register their company, we will never launch.

Instead, Colly is built for the modern channels that work **instantly, for free, with zero CAC**:
1. **Telegram:** Zero SIM card required. Zero message fees. A business owner can create a bot in 30 seconds using @BotFather.
2. **Web Chat:** We give them a line of code. They paste it on their website. Visitors can talk to the AI instantly.
3. **Discord:** For tech-savvy businesses or communities.

**Why this matters to you as an agent:**
You can onboard a business in 5 minutes. No waiting. No Meta approval. No CAC.
You set up the Telegram bot, paste the token into Colly, and the AI is live.
When the business finally gets their CAC, we will switch on WhatsApp for them.`,
      },
      {
        slug: "what-colly-does",
        title: "What Colly Does",
        order: 1,
        durationMin: 5,
        bodyMarkdown: `Colly is the AI that runs on the WhatsApp Business API.

Think of it this way. The API is the road. Colly is the car that drives on it.

**What Colly does:**

When a customer messages a business, Colly reads the message. It then decides what to do.

- If the customer asks about a product, Colly looks in the business catalogue. It finds the product. It sends the price, description, and photo.
- If the customer asks a common question, Colly looks in the FAQ list. It answers correctly.
- If the customer wants to negotiate, Colly uses a price range the owner set. It never goes below the floor price.
- If the customer asks something Colly does not know, Colly hands the conversation to the owner. The owner gets a notification.

The customer does not know they are talking to AI. They just get fast, correct replies.

**What Colly understands:**

- **English and Pidgin.** If the customer writes "how much be this thing?", Colly understands.
- **Voice notes.** A customer can send a voice message. Colly transcribes it and answers.
- **Photos.** A customer can send a picture of a product. Colly figures out what it is and replies.

**What the business owner sees:**

The owner has a dashboard. In the dashboard they can:

- See every conversation
- Read every customer's message
- Take over any conversation and reply themselves
- Pause the AI
- See all sales, invoices, customers

The AI is not replacing the owner. It is helping the owner answer more customers, faster.

**Do this now:**

Picture a business you know — maybe a shop on your street. Think about the top 3 questions their customers ask. Colly can answer all 3 automatically. That is what you are selling.`,
      },
      {
        slug: "why-business-loses-money-without-it",
        title: "Why a Business Loses Money Without It",
        order: 2,
        durationMin: 5,
        bodyMarkdown: `Every business owner knows they lose sales. Very few know **how much**.

This is where you come in. You are not selling software. You are selling the money they are already losing.

**Where the money goes:**

**1. Night messages.**

A customer messages at 10pm. The owner is asleep. The customer waits. At 7am there is still no reply. By 8am the customer has bought from a shop that answered at 6am.

One lost sale. Multiply by every night. Multiply by 30 days.

**2. Slow replies during the day.**

The owner is serving customers in the shop. Messages pile up. By the time they reply, the customer has already paid someone else.

**3. Repeated questions.**

"Where are you located?" "Do you deliver?" "How much?" The owner answers the same questions 20 times a day. That is 20 minutes of their day gone. If they paid themselves ₦500 an hour, they are losing ₦8,000 a week just answering the same questions.

**4. Lost records.**

A customer bought last month. They come back. The owner cannot remember what they bought. They cannot follow up. They lose the repeat sale.

**The math for a typical small shop:**

- 5 to 15 lost sales a week
- Average sale: ₦5,000
- Lost: ₦25,000 to ₦75,000 a week
- That is ₦100,000 to ₦300,000 a month

Colly costs ₦15,000 a month. The math is not complicated.

**Do this now:**

When you meet a business owner, do not talk about AI. Talk about money. Ask: "How many messages do you miss at night?" Let them do the math themselves. Then show them how much that money is worth.`,
      },
      {
        slug: "what-colly-can-do",
        title: "What Colly Can Do (Product Tour)",
        order: 3,
        durationMin: 6,
        bodyMarkdown: `This lesson is a tour. You will not use every feature in every sale. But you must know what exists.

**The Dashboard**

This is where the owner lives. Every feature below is one click away.

**Products**

The catalogue. The owner adds every product they sell:

- Name, price, description
- Stock (optional — if they track it)
- Photos (up to 10 per product)
- Floor price (for negotiation)
- Negotiable or fixed price

Colly uses the catalogue to answer customer questions.

**FAQs**

Common questions with prepared answers:

- Delivery areas and cost
- Payment methods
- Return policy
- Opening hours
- Warranty

When a customer asks something on the FAQ list, Colly answers instantly.

**Conversations**

Every chat. Every customer. In one place.

The owner can:

- Read the AI's replies
- Take over and reply themselves
- Pause the AI on a specific conversation
- Resume the AI when done

**Quick Sale**

A simple grid for walk-in customers. Tap the product. Tap the payment method (Cash, Transfer, POS, Credit). Sale recorded. Stock updates. Invoice generated.

**Sales Records**

Every sale. Filter by date, product, payment method. See totals. Edit. Delete.

**Invoices**

Auto-generated from each sale. Sequential numbering. VAT calculated. Printed or shared.

**Customers**

Auto-created from conversations. Name, phone, notes. Every customer the business has ever talked to.

**CRM & Sales Pipeline**

Every customer is tracked. The owner can move customers from 'Inquiry' to 'Negotiating' to 'Paid'. The AI also asks for payment details automatically if the owner sets up their 'Payment Instructions' in Settings.

**Do this now:**

Log into your own Colly account. Click every menu item in the sidebar. Spend 10 minutes in the dashboard. You cannot explain what you have not seen.`,
      },
      {
        slug: "what-colly-costs",
        title: "What Colly Costs",
        order: 4,
        durationMin: 5,
        bodyMarkdown: `**Unified Pricing (No more Telegram vs WhatsApp split)**

We now have a single set of plans. Credits are shared across **all** connected channels (Telegram, Discord, Web Chat). 1 credit = ₦1.

- **Green:** ₦15,000/month — 23,000 credits (15,000 base + 8,000 bonus = 100 free WhatsApp messages)
- **Blue:** ₦25,000/month — 44,000 credits (28,000 base + 16,000 bonus = 200 free WhatsApp messages)
- **Black:** ₦50,000/month — 100,000 credits (60,000 base + 40,000 bonus = 500 free WhatsApp messages)
- **Reply costs:** Telegram/Discord replies cost 5 credits. WhatsApp replies cost 80 credits. Manual replies are free.
- **Top-ups:** buy more credits any time; they never expire.
- **Free:** ₦0/month — 50 credits every month, forever. No card required.`,
      },
      {
        slug: "what-colly-cannot-do",
        title: "What Colly Cannot Do",
        order: 5,
        durationMin: 5,
        bodyMarkdown: `This lesson protects you from over-promising. If you promise something Colly cannot do, you will lose the customer.

**Colly cannot:**

**1. Post to WhatsApp Status**

The Status feature is not available through the WhatsApp Business API. If a business relies on posting Status updates for sales, Colly does not help with that. They will still need a separate WhatsApp account for Status.

**2. Send marketing blasts**

Colly is for customer service, not mass promotion. If a business wants to send the same message to 5,000 people, Colly is not the tool.

**3. Create the business's WhatsApp account**

The business needs an existing WhatsApp number. Colly does not create numbers. If they do not have one, they need to get a SIM first.

**4. Guarantee Meta approval**

Meta (the company that owns WhatsApp) approves each business individually. Colly guides the process but cannot force approval.

**5. Handle 100% of conversations**

About 90% of customer messages are handled by AI. The other 10% go to the owner. This is by design. Some questions need a human.

**6. Replace the business owner**

Colly does not run the business. It answers messages. The owner still manages stock, prices, staff, and everything else.

**Why this matters**

Nigerian SMEs have been burned before. Too many "AI" companies promised the world and delivered nothing. When you tell a business owner what Colly **cannot** do, you build trust. It shows you are honest.

**Do this now:**

Before your first sales pitch, memorize these 6 limits. When a business owner asks "Can it also do X?", you will know the answer. If X is not on the list, tell them the truth: "Let me check with Colly support and get back to you."`,
      },
    ],
    questions: [
      {
        question:
          "What is the main difference between the WhatsApp Business App and the WhatsApp Business API?",
        options: [
          "The API is free",
          "The API can handle many customers at once, automatically",
          "The API works only on Android",
          "The API cannot send images",
        ],
        correctIndex: 1,
      },
      {
        question:
          "Mrs. Adeyemi's store lost about how much extra revenue per month before Colly?",
        options: ["₦18,000", "₦180,000", "₦1,800", "₦18"],
        correctIndex: 1,
      },
      {
        question:
          "What does Colly do when a customer asks a question it cannot answer?",
        options: [
          "Ignores the message",
          "Answers with a generic reply",
          "Hands the conversation to the business owner",
          "Ends the chat",
        ],
        correctIndex: 2,
      },
      {
        question: "Which of these can Colly understand?",
        options: [
          "Only English",
          "Only English and French",
          "English, Pidgin, voice notes, and photos",
          "Only text messages",
        ],
        correctIndex: 2,
      },
      {
        question:
          "What does the Green plan cost per month, and how many credits does it include?",
        options: [
          "₦10,000 / 10,000 credits",
          "₦15,000 / 23,000 credits",
          "₦25,000 / 44,000 credits",
          "₦50,000 / 100,000 credits",
        ],
        correctIndex: 1,
      },
      {
        question:
          "Which plan includes the most credits?",
        options: ["Green", "Blue", "Black", "Free"],
        correctIndex: 2,
      },
      {
        question:
          "How much does one AI reply cost in credits?",
        options: [
          "80 credits on WhatsApp and 5 credits on Telegram or Discord",
          "5 credits on WhatsApp and 80 credits on Telegram or Discord",
          "Manual replies cost credits too",
          "0 credits because replies are included in the plan",
        ],
        correctIndex: 0,
      },
      {
        question:
          "What does Colly charge the agent for using the platform to onboard businesses?",
        options: [
          "A 10% commission on setup fees",
          "A monthly agent fee",
          "Nothing - Colly does not track setup fees",
          "₦5,000 per business onboarded",
        ],
        correctIndex: 2,
      },
      {
        question: "Which of these is something Colly CANNOT do?",
        options: [
          "Answer customer messages automatically",
          "Send product images on request",
          "Post to WhatsApp Status",
          "Take over a conversation manually",
        ],
        correctIndex: 2,
      },
      {
        question:
          "What should you tell a business owner who hits their monthly message cap?",
        options: [
          "There is nothing you can do, wait until next month",
          "You can top up their wallet to keep going, or upgrade their plan",
          "Colly is being greedy",
          "Just tell customers to message less",
        ],
        correctIndex: 1,
      },
      {
        question:
          "What should an agent do when a business owner asks about a feature Colly does not have?",
        options: [
          "Promise it will be added soon",
          "Tell them the truth and offer to check with Colly support",
          "Change the subject",
          "Say the competitor does not have it either",
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    slug: "setting-up-a-business",
    title: "Setting Up a Business",
    description:
      "The hands-on setup. From first meeting to final handoff. Every step an agent takes to onboard a new business.",
    order: 1,
    isCertificationCourse: false,
    lessons: [
      {
        slug: "before-you-start",
        title: "Before You Start",
        order: 0,
        durationMin: 5,
        bodyMarkdown: `**Their Telegram Bot Token (or Web Chat Link)**

Since we are Telegram-first, you do not need a SIM card.

1. Open Telegram and search for @BotFather.
2. Send \`/newbot\` and follow the steps.
3. Copy the Bot Token (e.g., 123456789:AAH...).
4. Paste that into Colly.

For Web Chat, there is no token. You just copy the embed link and paste it on their website.`,
      },
      {
        slug: "creating-the-account",
        title: "Creating the Account",
        order: 1,
        durationMin: 5,
        bodyMarkdown: `You are creating an account for the business owner. They will own it forever. Do not use your own details.

**Step by step:**

1. Open the Colly website. Click **Sign up**.
2. Fill in:
   - **Business name** — exactly what customers know them as. "Mama Chidi's Provision Store" is better than "Mama Chidi Ventures Ltd."
   - **Your name** — the owner's name. Not yours.
   - **Email** — the owner's email. If they do not have one, help them create a Gmail. **Do not use your own email.** The owner needs password reset access.
   - **Phone number** — the WhatsApp number from Lesson 1.
   - **Password** — pick something strong. Write it down on paper for the owner. Show them how to change it later.

3. Click Sign up.

**What happens next:**

Every new account starts on the permanent Free plan: 50 credits every month, forever. That is enough to try AI replies, the dashboard and real sales, with no payment and no card.

When the 50 credits are spent, the AI pauses until the owner subscribes or tops up. The account is never deleted: the owner can still log in, see the dashboard and chat with customers manually, because manual replies are always free.

**Tell the owner this clearly:**

> "It is free to start. You get 50 credits every month, and replying by hand is always free. If you like it, you pay ₦15,000 to get more AI credits. No charge today."

This removes the fear of "being locked in."

**Test the login:**

Before you leave, log in together. Enter the email and password. Make sure they can do it themselves.

Write the password on a piece of paper. Give it to them. Not just saved in your phone.

**Do this now:**

Create the account on Colly. Use the owner's real details. Do not shortcut this by using your own email — it will cause pain later when the owner needs to reset the password.`,
      },
      {
        slug: "adding-products",
        title: "Adding Products",
        order: 2,
        durationMin: 5,
        bodyMarkdown: `This is the biggest work. Do not rush it.

**Open Products in the sidebar. Click Add Product.**

For each product, fill in:

**Name**

What customers call it. Not the SKU. Not the manufacturer's full name. "iPhone 12 128GB" is what customers search for. "Apple Inc. iPhone 12 128GB Model A2403" is noise.

Keep names short. Under 40 characters. The AI and the customer both read faster.

**Price**

The current selling price in Naira. Include VAT if there is any.

**Floor Price (Optional)**

This is the lowest price the AI can offer if the customer negotiates.

Say the phone is ₦180,000. The owner accepts ₦165,000 at the end of a hard negotiation. Floor price = ₦165,000.

If the owner does not negotiate, leave floor price blank and uncheck "Allow AI to negotiate."

**Negotiable**

Check the box if the owner allows the AI to counteroffer when a customer asks "can you reduce?"

Most Nigerian businesses negotiate. Enable this by default unless the owner says no.

**Stock (Optional)**

How many do they have? If they track stock, enter the number. If they do not, leave it blank — the AI will say "Available" instead of a number.

**Description**

This is the most important field. See the next lesson for how to write it.

**Images**

Add at least 1. Up to 10. See the next lesson for how to take them.

**A real example — Mama Chidi's Provision Store:**

| Field | Value |
|---|---|
| Name | Golden Penny Semovita 1kg |
| Price | 1,800 |
| Floor Price | 1,700 |
| Negotiable | Yes |
| Stock | 24 |
| Description | Premium semovita flour. 1kg pack. Makes smooth, stretchy swallow. Good for eba, fufu, and semo. Sealed, fresh from distributor. |
| Images | (2 photos of the pack) |

**What to do for 30 products:**

Do not type 30 products one at a time from scratch. Get the list from the owner, then enter them in batches. Take breaks. Do not rush into mistakes.

**Time estimate:**

If you have photos and info ready: 2-3 minutes per product. 30 products = 90 minutes. Add another 30 minutes for the owner's interruptions. **Block 2 hours.**

**Common mistakes:**

1. Naming products in English when customers use Pidgin or local names. "Garri" not "Cassava flour."
2. Forgetting floor prices — AI rejects all negotiations — customers leave.
3. Skipping stock — AI says "Available" every time — customer is disappointed when it is out.

**Do this now:**

Pick 3 products. Add them fully. Show the owner the product grid. Let them see how it looks. Then continue with the rest.`,
      },
      {
        slug: "writing-descriptions",
        title: "Writing Descriptions",
        order: 3,
        durationMin: 5,
        bodyMarkdown: `The AI will only answer with what you give it. If descriptions are empty or vague, the AI sounds stupid.

Bad description = bad answers = the owner loses trust in Colly.

**What makes a good description:**

**1. What it is.**

Plain language. Not marketing fluff.

Bad: "Premium quality household staple food item"
Good: "Golden Penny Semovita. 1kg. White flour for making swallow."

**2. What it is good for.**

The customer's use case.

Bad: "Great for cooking"
Good: "Makes eba and fufu. Smooth, stretchy texture when cooked."

**3. What is in the pack.**

Quantity, size, variants.

Good: "1kg sealed pack."
Good: "Comes in 3 colours: black, white, silver."
Good: "Includes charger and USB cable."

**4. What makes it different.**

Only if the owner told you something real.

Good: "Imported from Turkey. Tighter stitching than local brands."
Bad: "Best quality in the market." (Every seller says this. Meaningless.)

**5. Honest limits.**

What it is NOT. This protects the owner.

Good: "Does not fit iPhone 14 or newer. Only fits iPhone 12 and 13."
Good: "Cash on delivery only for Lagos. Other states require transfer."

**What NOT to write:**

- Marketing words: "premium," "amazing," "best," "highest quality"
- Facts you made up
- Made-up specifications
- Rules the AI invents

**The rule:** If the owner did not tell you, do not write it. Missing information is fine — invented information is not.

**Photos:**

Take photos the same way every time:

- Natural light (near a window, not direct sunlight)
- Plain background (white cloth, table, or wall)
- Focus on the product, not the surroundings
- 2-3 angles if possible (front, side, opened)

If the owner has old photos, use them. If not, take them on your phone. Send them to your WhatsApp, download, upload to Colly.

**Do this now:**

Pick one product from the shop. Write a description that includes all 5 elements above. Show the owner. Ask: "Is this correct? Is anything wrong?" Fix it. Then use that same pattern for the rest.`,
      },
      {
        slug: "adding-faqs",
        title: "Adding FAQs",
        order: 4,
        durationMin: 5,
        bodyMarkdown: `FAQs are the 5-7 questions every customer asks. If the AI knows them, it answers instantly. If not, it escalates to the owner.

**The 5 FAQ categories every business needs:**

**1. Delivery**

- Do you deliver?
- Where do you deliver? (Lagos only? Nationwide? Specific areas?)
- How much is delivery?
- How long does it take?

**2. Payment**

- What payment methods do you accept? (Transfer, Cash, POS?)
- Do you accept payment on delivery?
- What is your account number? (yes, put it here)

**3. Returns**

- Can I return a product?
- Within how many days?
- Is there a refund or exchange?
- What if the product is damaged on arrival?

**4. Opening hours**

- What time do you open?
- What time do you close?
- Do you open on Sundays?
- Public holidays?

**5. Warranty**

- Is there a warranty?
- How long?
- What does it cover?
- How does the customer claim it?

**Extra FAQs to add if relevant:**

- Do you do wholesale?
- Do you have a physical shop?
- Can I pay in installments?
- Do you offer discounts for bulk?
- Are you on Instagram or TikTok?

**Format for each FAQ:**

Question: as the customer would type it
Answer: short, direct, no fluff

Bad Question: "What is the business policy on product returns?"
Good Question: "Can I return a product?"

Bad Answer: "Our return policy is designed to ensure customer satisfaction..."
Good Answer: "Yes, within 7 days if it is not damaged. Bring it back to the shop with the receipt."

**Do this now:**

Sit with the owner and go through the 5 categories. Ask each question. Write down their answers. Enter them in Colly.

Target: 6-10 FAQs minimum. Every business has different answers, but the categories are the same.`,
      },
      {
        slug: "setting-tone-and-testing",
        title: "Setting Tone and Testing",
        order: 5,
        durationMin: 5,
        bodyMarkdown: `Now that the AI has data, you teach it how to talk and confirm it works.

**AI Tone (in Settings):**

Two options:

- **Formal** — "Good day. How may I assist you today?"
- **Friendly** — "Hey! How can I help?"

**Which to pick:**

- Boutiques, electronics shops, service businesses — **Friendly**
- Pharmacies, financial services, professional services — **Formal**

Ask the owner: "How do you reply to your customers today?"

If they say "Hi babe, how are you?" — Friendly.
If they say "Good afternoon ma, how can I help?" — Formal.

Match the AI's tone to the owner's tone. That is what customers expect.

**Language:**

Colly auto-detects English, Pidgin, and mixed. You do not pick a language. The AI matches the customer.

Test this. Send a message in Pidgin. The reply should be in Pidgin.

**Testing — do these 5 messages:**

Send from your own WhatsApp to the business's number:

1. **Product query** — "How much is [one product]?"
   - Pass: AI replies with the exact price from the catalogue
   - Fail: AI does not know — product entry has an issue

2. **FAQ query** — "Do you deliver to [area]?"
   - Pass: AI answers with the FAQ answer
   - Fail: AI does not know — FAQ entry has an issue

3. **Negotiation** — "Can you do [lower price]?"
   - Pass: AI counters within the range and never goes below floor
   - Fail: AI accepts too low — floor price not set correctly

4. **Unknown question** — "Do you sell garden hoses?"
   - Pass: AI says it cannot help and escalates (or offers similar products)
   - Fail: AI invents an answer — product descriptions have issues

5. **Pidgin** — "How much be this thing?"
   - Pass: AI replies correctly in Pidgin
   - Fail: AI responds in stiff English — report to Colly support

**If any test fails, fix it BEFORE you leave.**

The customer experience will be exactly this. If you catch the problem now, the owner never sees it.

**Do this now:**

Send all 5 test messages. Screenshot the AI replies. Show the owner. If the owner smiles, you know you are done.`,
      },
      {
        slug: "handoff-to-colly",
        title: "Instant Activation",
        order: 6,
        durationMin: 5,
        bodyMarkdown: `The truth: **You do not wait for Colly to connect Telegram.** You do it yourself in real-time.

Since Telegram requires no Meta approval, the moment you paste the Bot Token into Colly, the AI goes live.

1. Paste the token.
2. Send a test message to the bot.
3. If the AI replies, you are done. Hand the phone back to the owner.

(WhatsApp is the only channel that requires a handoff to Colly support and a CAC).`,
      },
    ],
    questions: [
      {
        question: "Before a setup visit, which of these is NOT required?",
        options: ["Product list and photos","The owner's bank details","Common customer questions","The owner's WhatsApp number"],
        correctIndex: 1,
      },
      {
        question: "Whose details should you use when creating the business account?",
        options: ["Your own email and phone","The owner's real details","A shared Colly account","The customer's details"],
        correctIndex: 1,
      },
      {
        question: "What happens when the free monthly credits run out?",
        options: ["The account is deleted","The owner is charged automatically","The AI stops replying until they subscribe or top up, but the account stays","Nothing changes"],
        correctIndex: 2,
      },
      {
        question: "What is the floor price?",
        options: ["The highest price the AI can offer","The lowest price the AI can offer during negotiation","The price after VAT","The cost price"],
        correctIndex: 1,
      },
      {
        question: "How many photos can a product have?",
        options: ["1","3","5","Up to 10"],
        correctIndex: 3,
      },
      {
        question: "Which product name is best?",
        options: ["Apple Inc. iPhone 12 128GB Model A2403","iPhone 12 128GB","The latest Apple smartphone","Phone"],
        correctIndex: 1,
      },
      {
        question: "A good product description should include:",
        options: ["What it is, what it is good for, and honest limits","Only the price","Marketing words like 'premium' and 'best'","Made-up facts to sound professional"],
        correctIndex: 0,
      },
      {
        question: "Which is NOT one of the 5 must-have FAQ categories?",
        options: ["Delivery","Payment","Returns","Instagram followers"],
        correctIndex: 3,
      },
      {
        question: "The AI tone should match:",
        options: ["Your preference","The owner's existing reply style","Always formal","Always friendly"],
        correctIndex: 1,
      },
      {
        question: "When testing before handoff, you should send:",
        options: ["One message","Only product queries","Product, FAQ, negotiation, unknown, and Pidgin messages","Nothing - Colly tests automatically"],
        correctIndex: 2,
      },
      {
        question: "Who connects the WhatsApp Business API?",
        options: ["The agent","The business owner","Colly's team","Meta"],
        correctIndex: 2,
      },
      {
        question: "What should you tell the owner after setup?",
        options: ["You are all set, goodbye","Wait 3 weeks for approval","Everything is ready. Colly will connect your WhatsApp within 24 hours.","You need to buy another SIM card"],
        correctIndex: 2,
      },
    ],
  },
  {
    slug: "training-the-owner",
    title: "Training the Owner",
    description: "After setup, teach the owner to use the dashboard, handle takeover, and fix common AI mistakes.",
    order: 2,
    published: true,
    isCertificationCourse: false,
    lessons: [
      {
        slug: "dashboard-tour",
        title: "Dashboard Tour",
        order: 0,
        durationMin: 5,
        bodyMarkdown: `You have set everything up. Now the owner needs to know what they are looking at.

**Do not hand them the laptop and walk away.** Sit with them. Walk through each section in order. 10 minutes.

**Say this first:**

> "Every message your customers send goes to this dashboard. The AI answers automatically. You can see every conversation, every customer, every sale. Let me show you where everything is."

**Section 1 — Overview (2 minutes)**

Point at the top of the page.

> "This is your home screen. Today's sales show here. Messages handled. Active conversations. Pending invoices. Every morning when you open Colly, this is the first thing you see."

Have them click **Overview** in the sidebar. Then let them read the numbers themselves.

**Section 2 — Conversations (2 minutes)**

Click **Conversations** in the sidebar.

> "Every chat your business has with a customer is here. The AI replies to most of them. You can open any chat and see what was said."

Open one conversation. Let them read it. This is the moment they realize the AI is actually working.

**Section 3 — Products (2 minutes)**

Click **Products**.

> "This is your catalogue. Everything you sell is here. When a customer asks about a product, the AI looks here and answers. If you change a price, change it here."

Show them one product. Point at the price.

> "The AI always quotes this price. So if you change the price of rice tomorrow, change it here first. Otherwise the AI will quote the old price."

**Section 4 — Sales (2 minutes)**

Click **Sales**.

> "Every sale is here. Whether it came from the AI or from you tapping it yourself. Today's total is at the top. Yesterday, last week — scroll down to see history."

Click into one sale. Show them the details.

**Section 5 — Settings (1 minute)**

Click **Settings**.

> "Your business name, AI tone, negotiation settings — all here. We already set it up together. You will not need to touch this often. But if you want the AI to sound more formal or friendly, this is where you change it."

**Section 6 — Takeover (1 minute)**

Back to Conversations. Open one. Point at the takeover button.

> "See this? If you ever want to reply to a customer yourself, tap here. The AI stops for this one chat. When you finish, tap Resume. The AI takes over again."

**Close the tour:**

> "Any questions?"

Then wait. Let them ask. Let them poke around. This is where they build confidence.

**Do this now:**

Before you leave the shop, have the owner click through all 5 sections on their own device. Not yours. Theirs. Watch them do it. If they hesitate, walk them through again.`,
      },
      {
        slug: "human-takeover",
        title: "Human Takeover",
        order: 1,
        durationMin: 5,
        bodyMarkdown: `The AI handles 90% of conversations. The other 10% need a human. Your job is to teach the owner when to step in and how.

**When to take over:**

- Customer is angry or complaining
- Customer asks for a custom quote or bulk discount
- Customer wants to negotiate beyond the AI's range
- Customer asks something the AI cannot answer
- Customer is a big buyer and the owner wants to handle personally

**How to take over:**

1. Open **Conversations**
2. Click the conversation with the customer
3. Click **Take Over** at the top
4. The AI pauses for this chat
5. Type your reply in the text box at the bottom
6. Click **Send**

**How the customer sees it:**

The customer does not know they are talking to a human now. As far as they know, it is the same business replying. Smooth transition.

**How to resume AI:**

1. Click the conversation
2. Click **Resume AI**
3. The AI picks up the next message

**Auto-resume:**

If the owner takes over and forgets to resume, the AI automatically resumes after **1 hour**. This prevents the AI from being paused forever.

**What the owner should NOT do:**

- Do not take over every conversation. Let the AI do its job.
- Do not reply to messages that the AI already answered well.
- Do not pause the AI on multiple conversations at once. It gets confusing.

**Do this now:**

Find a real conversation in the owner's dashboard. Walk them through taking over. Let them reply to one message. Then have them resume the AI. Show them it works.`,
      },
      {
        slug: "quick-sale",
        title: "Quick Sale",
        order: 2,
        durationMin: 5,
        bodyMarkdown: `Not every sale comes from WhatsApp. Sometimes a customer walks into the shop and buys something on the spot.

The Quick Sale feature lets the owner record that sale in 10 seconds.

**When to use Quick Sale:**

- Customer is physically in the shop
- Customer pays in cash, transfer, or POS
- The sale is not coming through WhatsApp
- The owner wants the sale recorded in Colly

**How it works:**

1. Click **Sales** in the sidebar
2. Click **Add from catalog** (button on the Sales page)
3. You land on Quick Sale page
4. See all products in a grid
5. Tap the **+ Add** button on each product the customer is buying
6. Set the quantity using minus / plus
7. Click **Proceed**
8. Back on Sales page — cart is filled
9. Choose payment method (Cash / Transfer / POS / Credit)
10. Click **Complete Sale**

That is it. Sale recorded. Stock updated. Customer recorded (as "Walk-in Customer" if not tied to a specific customer).

**What happens automatically:**

- Stock decreases by the quantity sold
- Today's Sales updates on the Overview page
- The sale appears in the Sales history

**When to use Custom Amount instead:**

If the owner sells something not in the catalogue (a one-off item, a service, anything not listed):

1. Click **+ Custom Amount** in the cart
2. Enter the amount
3. Complete Sale

This is useful for:

- Services (delivery, repairs)
- Items the owner forgot to add to the catalogue
- Discounts or adjustments

**Do this now:**

Simulate a walk-in sale. Pick one product. Add it to the cart. Choose Cash. Complete Sale. Show the owner it appears in the Sales list.`,
      },
      {
        slug: "daily-checks",
        title: "Daily Checks",
        order: 3,
        durationMin: 5,
        bodyMarkdown: `The owner does not need to open Colly every hour. But 5 minutes a day keeps the business healthy.

**The morning check (2 minutes):**

Open Colly. Click **Overview**.

Look at these numbers:

- **Messages Handled** — how many conversations did the AI answer overnight?
- **Active Conversations** — any customer waiting on a reply?
- **Today's Sales** — did anything come in overnight?

If Active Conversations is above 0, open Conversations and check if the AI handled it correctly.

**The evening check (2 minutes):**

Open **Conversations**. Scroll through today's chats.

Look for:

- Any conversation with a red flag (customer complaining)
- Any conversation where the AI escalated to you
- Any customer who asked for a custom quote

Reply to anything urgent. Let the AI handle the rest.

**The weekly check (5 minutes):**

Open **Sales**. Look at the week's total.

Ask:

- Are sales up or down from last week?
- Which products are selling well?
- Which products are not moving?

Open **Products**. Look at any product with low stock (yellow/red badge). Restock or update.

**The monthly check (10 minutes):**

Open **Settings → Billing**.

- How many messages did you use this month?
- Are you under or over your plan cap?
- Do you need more credits?

If consistently over the cap, upgrade the plan. It is usually cheaper than buying credits.

**What NOT to do:**

- Do not check every 5 minutes. It wastes time.
- Do not reply to conversations the AI already handled well.
- Do not worry about "Messages Handled" — the AI handles it.

**Do this now:**

Set a daily alarm on the owner's phone. "Colly check-in — 8am." Simple. That is the habit.`,
      },
      {
        slug: "ai-mistakes",
        title: "AI Mistakes",
        order: 4,
        durationMin: 5,
        bodyMarkdown: `The AI will make mistakes. Not often. But when it does, the owner needs to know how to fix it.

**Common mistakes and how to fix them:**

**Mistake 1 — AI quoted the wrong price**

Cause: The product price in the catalogue is out of date.

Fix:

1. Click **Products**
2. Find the product
3. Click **Edit**
4. Update the price
5. Save

The AI will quote the new price on the next message. No need to restart anything.

**Mistake 2 — AI said "we do not sell that" when the shop does**

Cause: The product is not in the catalogue.

Fix:

1. Click **Products**
2. Click **Add Product**
3. Add the missing product with name, price, description, and photo
4. Save

The AI will now recognize the product.

**Mistake 3 — AI refused to negotiate when it should have**

Cause: The product does not have a floor price set, or "Negotiable" is unchecked.

Fix:

1. Click **Products**
2. Find the product
3. Click **Edit**
4. Set a floor price (the lowest acceptable)
5. Check "Allow AI to negotiate this price"
6. Save

**Mistake 4 — AI answered a FAQ wrong**

Cause: The FAQ answer in the system does not match reality.

Fix:

1. Click **FAQs**
2. Find the FAQ
3. Click **Edit**
4. Update the answer
5. Save

**Mistake 5 — AI said something that does not exist**

Cause: The product description has inaccurate information, or the AI invented something.

Fix:

1. Click **Products** or **FAQs**
2. Find the entry
3. Edit the description to match reality
4. Save

**If the AI keeps making the same mistake:**

Report it to Colly support. Send:

- Screenshot of the conversation
- Which product or FAQ was involved
- What the AI said vs what it should have said

Colly's team will investigate. Usually it is a data problem, not an AI problem.

**How to prevent mistakes:**

- Keep product descriptions accurate
- Update prices when they change
- Review FAQs monthly
- If a product is discontinued, delete it or set stock to 0
- If a product is temporary, do not add it to the catalogue

**Do this now:**

Review the owner's product list. Look for anything out of date. Fix it before it causes a wrong AI reply.`,
      },
    ],
    questions: [
      {
        question: "How long should the initial dashboard tour take?",
        options: ["1 minute","10 minutes","1 hour","All day"],
        correctIndex: 1,
      },
      {
        question: "When should the owner take over a conversation?",
        options: ["Every conversation","Only when the AI fails or the customer is angry","Never - let the AI handle everything","Randomly"],
        correctIndex: 1,
      },
      {
        question: "What happens when the owner forgets to resume the AI after taking over?",
        options: ["The AI stays paused forever","The AI auto-resumes after 1 hour","The customer gets an error","The conversation ends"],
        correctIndex: 1,
      },
      {
        question: "What is the Quick Sale feature for?",
        options: ["Online customers","Walk-in customers who pay in cash, transfer, or POS","Wholesale customers","Only for delivery"],
        correctIndex: 1,
      },
      {
        question: "During the evening check, what should the owner look for in Conversations?",
        options: ["Every message the AI sent today","Complaints, escalations, and custom quote requests","Only unread conversations","The total number of messages sent"],
        correctIndex: 1,
      },
      {
        question: "The AI quoted the wrong price. What should the owner do?",
        options: ["Turn off the AI","Update the price in the Products page","Wait for it to fix itself","Call the customer"],
        correctIndex: 1,
      },
      {
        question: "The AI refused to negotiate when it should have. Likely cause?",
        options: ["The AI is broken","The floor price is not set or 'Negotiable' is unchecked","The customer blocked it","The internet is down"],
        correctIndex: 1,
      },
      {
        question: "The AI keeps making the same mistake. What should the owner do?",
        options: ["Give up","Wait - it will fix itself","Report it to Colly support with a screenshot","Delete the catalog"],
        correctIndex: 2,
      },
    ],
  },
  {
    slug: "sales-and-support",
    title: "Sales & Support",
    description: "How to sell and support Colly: find businesses that need it, pitch confidently, set your setup fee, get paid, and keep your first customers.",
    order: 3,
    published: true,
    isCertificationCourse: false,
    lessons: [
      {
        slug: "finding-businesses",
        title: "Finding Businesses",
        order: 0,
        durationMin: 6,
        bodyMarkdown: `You do not need to walk into every shop in your city. You need to find the ones that already lose money to unanswered messages.

**The 5 signs a business needs Colly:**

**1. They post prices on WhatsApp Status.**

If they post "New arrivals!" or "Rice ₦45k per bag" on their Status, they are already selling on WhatsApp. They know the pain of missing messages.

**2. They reply slowly (or not at all).**

Send a test message to their WhatsApp. If they take more than 1 hour to reply during business hours, they are overwhelmed.

**3. They have a lot of "how much?" messages.**

Look at the last 20 messages in any conversation. If most are price questions, the owner answers the same thing 30 times a day. This is the pain Colly solves.

**4. They run Instagram.**

Instagram businesses cross-post to WhatsApp. Their DMs overflow. They need help.

**5. They have more than 50 customers.**

A shop with 50+ regulars cannot manually track who bought what, who is asking what, who is negotiating. Colly automates all of it.

**Where to find them:**

- **WhatsApp Status** — scroll through contacts, screenshot businesses selling something
- **Instagram** — search hashtags like #lagosbusiness #abujabusiness #naijabrand
- **Local markets** — Balogun, Computer Village, Wuse, Onitsha Main Market
- **Referrals** — ask the first business you onboard: "Who else do you know with the same problem?"

**Where NOT to look:**

- Registered companies with a formal customer service team
- Restaurants using Uber Eats or Glovo (they already have delivery infrastructure)
- Businesses with a full-time social media manager

These businesses have already solved the problem. Skip them. Focus on the owner-operated shops.

**A quick filter:**

Before you pitch, ask: "Do you reply to WhatsApp messages yourself?"

- **Yes** — perfect prospect. Owner is doing everything, needs help.
- **No, I have someone** — deprioritize. They might already be okay.
- **What is WhatsApp?** — wrong business. Move on.

**Do this now:**

Build a list of 20 businesses that fit the 5 signs. Save them in a spreadsheet:

- Business name
- Owner name (if known)
- Phone number
- What they sell
- Which sign they fit (1-5)

Make 20 calls or visits this week. That is how you find your first customer.`,
      },
      {
        slug: "the-pitch",
        title: "The Pitch",
        order: 1,
        durationMin: 6,
        bodyMarkdown: `The pitch:

> 'I set up an AI assistant for your business on Telegram and your website. It replies 24/7. It answers prices, sends photos, and closes sales. Because it's Telegram and Web Chat, there is no CAC required, and we can set it up in 5 minutes. Right now, you are losing sales because you sleep at night. Colly fixes that instantly.'`,
      },
      {
        slug: "objections",
        title: "Handling Objections",
        order: 2,
        durationMin: 6,
        bodyMarkdown: `Every owner will push back. Here are the 8 objections you will hear, and exactly what to say.

**Objection 1: "The AI will make mistakes."**

> "It will. That is why you can take over any conversation at any time. You see every chat in your dashboard. If the AI says something wrong, you fix it, and the AI learns from the change."

**Objection 2: "My customers want to talk to me, not a robot."**

> "Fair. Most of them do not know it is AI. It replies in your tone, answers like you would. The AI is you when you are asleep or busy. When a customer is ready to buy or needs something special, you step in."

**Objection 3: "I cannot afford it."**

> "You lose sales every night from unanswered messages. If you lose even 2 sales a week, at ₦5,000 each, that is ₦40,000 a month. Colly is ₦15,000. The math works in your favour."

**Objection 4: "I will just hire someone to reply."**

> "A customer service person costs ₦50,000+ a month and works 8 hours a day. Colly costs ₦15,000 and works 24 hours. Both is best — Colly handles routine questions, your staff handles the complex ones."

**Objection 5: "I do not trust AI."**

> "You should not blindly trust it. That is why we start on the Free plan. 50 credits every month, no card, no contract, no risk. Use it. If it fails, we stop."

**Objection 6: "Will it take over my WhatsApp?"**

> "No. You keep your existing WhatsApp on your phone. Nothing changes for you. I add a second number — a dedicated AI line. You post it on your WhatsApp Status and Instagram bio. Customers who want quick answers message it."

**Objection 7: "I am not on WhatsApp Business. I just use regular WhatsApp."**

> "That is fine. It works either way. The AI line is separate. You do not have to change anything about your current number."

**Objection 8: "Let me think about it."**

> "Of course. Here is my number — WhatsApp me if you have any questions. The Free plan gives you 50 credits every month, no card needed. If you want to try, just message me START. If not, no problem."

Do not chase. If they say no, say thank you and leave. Come back in 2 weeks. Business owners change their minds.

**The rule:** Never argue. Never oversell. When someone objects, listen, answer honestly, and stop.

**Do this now:**

Write down your answers to these 8 objections in your own words. Say them out loud. Practice. When a real owner objects, you should not have to think — you should just answer.`,
      },
      {
        slug: "setup-fee",
        title: "Setting Your Setup Fee",
        order: 3,
        durationMin: 5,
        bodyMarkdown: `Colly charges the business ₦15,000/month. **You charge a separate setup fee.** That is your income. Colly does not take a cut.

**How much to charge:**

| Business Type | Setup Fee Range |
|---|---|
| Small shop, 1 location, 10-30 products | ₦5,000 — ₦15,000 |
| Medium shop, multiple product categories, 30-100 products | ₦10,000 — ₦20,000 |
| Larger business, complex catalogue, 100+ products | ₦20,000 — ₦25,000 |

**How to decide:**

Count the work:

- **Product upload**: 3 min per product × 30 products = 90 min
- **FAQ setup**: 30 min
- **Tone tuning + testing**: 30 min
- **Owner training**: 30 min
- **Follow-up visits (first week)**: 1 hour
- **Total: ~4 hours for a small shop**

At ₦5,000 for 4 hours, you earn ₦1,250/hour. At ₦15,000, you earn ₦3,750/hour.

**What NOT to do:**

- **Do NOT charge ₦0 or "free for first customer."** Free customers do not value the product. They also do not refer others.
- **Do NOT go below ₦5,000.** Even a small shop can afford this. If they cannot, they cannot afford the ₦15,000/month either.
- **Do NOT discount the setup fee just to close the deal.** Instead, reduce the scope: "For ₦5,000, I will set up your top 10 products and 5 FAQs. You can add the rest yourself later."
- **Do NOT charge what you cannot justify.** ₦25,000 for a 10-product shop makes no sense.

**When to charge the higher end:**

- Owner wants you to photograph products for them
- Owner wants you to write all the descriptions
- Owner has 100+ products
- Owner wants you on call for the first month
- Business is in a different city (travel costs)

**When to charge the lower end:**

- Owner already has photos ready
- Owner has a short product list (under 20 items)
- Owner is in the same city
- Owner is your first customer (you are building a track record)
- Owner has agreed to give you a testimonial and 2 referrals

**How to say the price:**

> "Setup is ₦10,000. That includes adding your products, setting up your FAQs, testing everything, and training you. Then it is ₦15,000 a month to keep it running. First 5 days are free, so if you do not like it we stop."

State the number. Shut up. Wait.

If they push back:

> "I understand. Let me offer a smaller package — I can set up your top 5 products and 3 FAQs for ₦5,000. You can add more later."

**Do this now:**

Pick your setup fee range. Write it down. Say it out loud 5 times. "Setup is ₦10,000." Get comfortable with the number. If you flinch when you say it, the owner will flinch too.`,
      },
      {
        slug: "getting-paid",
        title: "Getting Paid",
        order: 4,
        durationMin: 5,
        bodyMarkdown: `You do not need a Paystack account or a card reader. You need a bank account. That is it.

**How to collect payment:**

**Option 1: Direct bank transfer (recommended for setup fee)**

> "Send ₦10,000 to [your account]. Once I see it, I will start your setup today."

- Send a WhatsApp with your account number, bank name, and account name
- They transfer
- You confirm and start work

**Option 2: Cash**

For owners who prefer cash. Count it in front of them. Confirm the amount. Do not count alone — count together.

**Option 3: POS**

If they insist on paying by card, use your personal POS or an agent's POS nearby. Or send them to a local POS agent with your account number.

**Option 4: Colly subscription (via Paystack)**

The monthly ₦15,000 subscription goes through Colly's own payment system. You do not handle this. The owner pays Colly directly. When we set up Paystack live mode, this becomes automatic.

**What about receipts?**

Give the owner a simple receipt for the setup fee:

RECEIPT
Date: [today]
From: [business name]
Amount: ₦10,000
For: Colly setup fee — WhatsApp AI assistant
Received by: [your name]

Handwritten is fine. Or type it in Notes app and WhatsApp it to them. Keep a copy.

**Never do this:**

- Do not ask for the full amount before showing anything
- Do not offer credit on your first 5 customers
- Do not take payment in installments below ₦5,000 total
- Do not accept "I will pay after it works" — you will never get paid

**What if they do not pay?**

You set up the account. If they do not pay the setup fee within 7 days:

1. Send one polite reminder
2. If still no payment by day 14, turn off the AI (via Colly support)
3. Move on

Do not chase endlessly. Your time is worth more than one bad customer.

**Do this now:**

Get your bank account ready. Send yourself a test transfer to make sure it works. Write down:

- Your bank name
- Your account name
- Your account number

Save it as a note in your phone. You will need to send it 10 times a day.`,
      },
      {
        slug: "first-week-support",
        title: "First-Week Support",
        order: 5,
        durationMin: 6,
        bodyMarkdown: `The first week determines if a customer stays or churns. You must be present.

**Day 1 (setup day):**

- Complete the onboarding (products, FAQs, tone)
- Run the 5 test messages
- Take the owner through the dashboard tour
- Stay for 1 hour. Answer questions. Do not rush.

**Day 2 (check-in call):**

Call the owner. Not WhatsApp. A voice call.

> "How did the AI do overnight? Any problems?"

Listen. Fix anything they mention.

**Day 3 (walk-through again):**

Visit in person. Sit with them. Watch them use the app. Do they look confused? Fix that.

**Day 4 (first sale check):**

Ask: "Did the AI close any sales?"

If yes — celebrate with them. Ask them to screenshot it and send it to you as a testimonial.

If no — check the conversation logs together. Look for where the AI failed. Fix it.

**Day 5 (credit check):**

> "How is the AI doing? The Free plan gives you 50 credits every month — do you want more?"

If yes — guide them through payment.
If no — "No problem. The Free plan keeps working, and I am here if you change your mind."

**Day 7 (final check):**

- Confirm subscription is active (if they subscribed)
- Confirm they know how to take over conversations
- Confirm they know how to edit products
- Give them your WhatsApp number for support

**What you are watching for:**

- Do they log into the dashboard daily? If not, the dashboard is too complicated. Walk them through again.
- Do they reply manually a lot? If yes, the AI is not answering their top questions. Add those as FAQs.
- Do they complain about wrong prices? If yes, catalogue is out of date. Update together.

**What NOT to do:**

- Do not disappear after setup. That is when customers churn.
- Do not blame the AI for data problems. The AI only knows what you put in.
- Do not ignore small complaints. They become big cancellations.

**Do this now:**

Block 1 hour every day for the first week of each new customer. Put it in your calendar. Non-negotiable.`,
      },
      {
        slug: "escalating-to-colly",
        title: "Escalating to Colly Support",
        order: 6,
        durationMin: 4,
        bodyMarkdown: `You are the agent. You handle the customer relationship. But some things are Colly's job, not yours.

**Escalate immediately:**

1. **WhatsApp number banned or disconnected** — Colly's team handles this. Do not try to fix it yourself.
2. **AI is producing wrong or offensive responses** — screenshot and send to support. This is a system issue.
3. **Payment/subscription issues on the Colly platform** — billing errors, plan changes, credits.
4. **Login is broken for the owner** — password reset, session issues.
5. **Feature requests** — "Can Colly do X?" — pass to support. Do not promise features that do not exist.
6. **The owner threatens legal action** — escalate immediately. Do not handle this yourself.

**Handle yourself:**

1. **Product descriptions are wrong** — you edit them
2. **Prices are outdated** — you update them
3. **FAQs missing** — you add them
4. **AI tone is wrong (too formal, too casual)** — you adjust in settings
5. **The owner is confused about how to use the dashboard** — you teach them
6. **The owner wants to test a negotiation** — you walk them through

**How to escalate:**

Send a WhatsApp to Colly support with:

Agent: AG-0001
Business: Mama Chidi's Provision Store
Issue: [one-line description]
Impact: [how many customers affected / how urgent]
Screenshot: [attach if relevant]

Response time: within 24 hours. For critical issues (number banned, platform down), within 2 hours.

**What NOT to do:**

- Do not tell the owner "I will fix it" if it is a Colly problem. Say "I have reported it to Colly's team, they will fix it."
- Do not guess at technical problems. Say "I do not know, let me check."
- Do not argue with support. Report the facts, let them handle it.

**The support contact:**

Save this number in your phone:

Colly Support
+234 [support phone number]

(Colly will give you the actual number when you are certified.)

**Do this now:**

Save the support number. Save the escalation template. When you need it, you will not have time to look it up.`,
      },
      {
        slug: "how-you-get-paid",
        title: "How You Get Paid",
        order: 7,
        durationMin: 3,
        bodyMarkdown: `**15% recurring commission**

When you onboard a business to Colly using your agent ID, you earn **15% recurring commission** on every subscription charge for that business.

**12-month cap**

Commissions last for **exactly 12 months** from the date the business signs up. After the 12-month period ends, you will no longer earn commission from that business.

**Payouts**

- **Minimum threshold:** You can request a payout once your available commission balance reaches **₦5,000**.
- **Instant via Paystack:** Payouts are processed instantly via Paystack directly to your bank account.
- **Track everything:** Your earnings, bank details, and payout history are all available in the new **Wallet** tab under your agent dashboard.

**Set up your bank details**

1. Go to **Agents > Wallet** in your dashboard.
2. Select your bank, enter your account number and account name.
3. Click **Save bank details** to create your Paystack transfer recipient.
4. Once your balance hits ₦5,000, click **Request payout** to withdraw your earnings.

Keep your bank details up to date so you never miss a payout.`,
      },
    ],
    questions: [
      {
        question: "Which of these is a sign a business needs Colly?",
        options: ["They have a full-time customer service team","They post prices on WhatsApp Status","They use Uber Eats","They have a dedicated social media manager"],
        correctIndex: 1,
      },
      {
        question: "What is the FIRST thing you should do before pitching?",
        options: ["Show your phone","Ask one question and let them talk","Hand them a flyer","Quote the price"],
        correctIndex: 1,
      },
      {
        question: "The pitch should focus on which 3 things?",
        options: ["Features, tech, price","More sales, control of WhatsApp, cost","Speed, security, scale","AI, integration, uptime"],
        correctIndex: 1,
      },
      {
        question: "What is the correct response to 'My customers want to talk to me, not a robot'?",
        options: ["The AI is smarter than you think","Your customers do not know it is AI - you step in when needed","Robots are better than humans","It does not matter"],
        correctIndex: 1,
      },
      {
        question: "What is the recommended setup fee range for a small shop with 10-30 products?",
        options: ["₦1,000 - ₦3,000","₦5,000 - ₦15,000","₦25,000 - ₦50,000","₦0 (free)"],
        correctIndex: 1,
      },
      {
        question: "What should you NOT do when pricing your setup fee?",
        options: ["State the price confidently","Go below ₦5,000","Explain what the setup covers","Offer a smaller package if the price is too high"],
        correctIndex: 1,
      },
      {
        question: "What is the recommended way to collect the setup fee?",
        options: ["Paystack only","Direct bank transfer","Cash only","Crypto"],
        correctIndex: 1,
      },
      {
        question: "What if the owner does not pay the setup fee within 7 days?",
        options: ["Keep working without payment","Send one reminder, and if still unpaid by day 14, turn off AI","Immediately delete their account","Take them to court"],
        correctIndex: 1,
      },
      {
        question: "What should you do on Day 1 of onboarding?",
        options: ["Set up and leave quickly","Set up, run test messages, and walk through the dashboard","Just set up the AI, no training","Send them a PDF guide"],
        correctIndex: 1,
      },
      {
        question: "What should you do on Day 2?",
        options: ["Nothing, let them figure it out","Call them on the phone - not WhatsApp","Send an email","Skip it"],
        correctIndex: 1,
      },
      {
        question: "What are you watching for in the first week?",
        options: ["The owner's happiness","Whether they log in daily, reply manually a lot, and complain about prices","How often they update their profile picture","Their social media followers"],
        correctIndex: 1,
      },
      {
        question: "Which of these should you escalate to Colly support?",
        options: ["Wrong product description","Missing FAQ","WhatsApp number banned or disconnected","AI tone needs adjusting"],
        correctIndex: 2,
      },
      {
        question: "Which of these should you handle yourself?",
        options: ["Login broken","Payment/subscription issue on Colly","Missing FAQ","WhatsApp number disconnected"],
        correctIndex: 2,
      },
      {
        question: "What is the correct escalation format?",
        options: ["Just say Help","Agent ID, Business, Issue, Impact, Screenshot","Send an email","Call the CEO"],
        correctIndex: 1,
      },
      {
        question: "What should you NEVER say to an owner?",
        options: ["I will check with Colly support","I do not know, let me find out","I will fix it (when it is a Colly platform issue)","Let me look at the logs with you"],
        correctIndex: 2,
      },
    ],
  }
];

// Section boundaries for the Final Certification Exam, keyed by question number.
const FINAL_EXAM_SECTIONS = [
  { start: 1, end: 10, title: "Understanding Colly" },
  { start: 11, end: 20, title: "Setting Up a Business" },
  { start: 21, end: 30, title: "Training the Owner" },
  { start: 31, end: 40, title: "Sales & Support" },
];

/**
 * Parses the authored 40-question Final Certification Exam from
 * `final-exam-questions.txt` in the repo root. Each block is:
 *
 *   Q1. Question text
 *   A) option
 *   B) option
 *   C) option
 *   D) option
 *   Correct: C
 *
 * Returns the rows ready for `agentFinalExamQuestion.createMany`, each tagged
 * with its section title by question number.
 */
function parseFinalExamQuestions() {
  const file = fs.readFileSync(
    path.join(__dirname, "..", "final-exam-questions.txt"),
    "utf8",
  );
  const lines = file.replace(/\r\n/g, "\n").split("\n");
  const letters = ["A", "B", "C", "D"];
  const rows = [];

  for (let i = 0; i < lines.length; i++) {
    const qmatch = lines[i].match(/^Q(\d+)\.\s*(.*)$/);
    if (!qmatch) continue;

    const num = Number.parseInt(qmatch[1], 10);
    const options = [];
    for (let k = 1; k <= 4; k++) {
      options.push(
        (lines[i + k] || "").trim().replace(/^[A-D]\)\s*/, "").trim(),
      );
    }

    let correctIndex = 0;
    for (let j = 5; j < 10; j++) {
      const cl = lines[i + j];
      const m = cl && cl.match(/Correct:\s*([A-D])/i);
      if (m) {
        correctIndex = letters.indexOf(m[1].toUpperCase());
        break;
      }
    }

    const section = FINAL_EXAM_SECTIONS.find(
      (s) => num >= s.start && num <= s.end,
    );

    rows.push({
      order: num,
      sectionTitle: section ? section.title : "",
      question: qmatch[2].trim(),
      options,
      correctIndex,
    });
  }

  return rows;
}

// The three demo agents shown by the /find-an-agent directory. Agent rows are
// never wiped (a real agent may hold course progress), so they are looked up by
// email and only created when missing -- an existing agent is left as-is.
const DEMO_AGENTS = [
  {
    email: "chidi.okeke@colly.test",
    fullName: "Chidi Okeke",
    phone: "+2348031234001",
    state: "Lagos",
  },
  {
    email: "aisha.bello@colly.test",
    fullName: "Aisha Bello",
    phone: "+2348061234002",
    state: "FCT (Abuja)",
  },
  {
    email: "emeka.nwosu@colly.test",
    fullName: "Emeka Nwosu",
    phone: "+2348091234003",
    state: "Rivers",
  },
];

async function main() {
  const now = Date.now();

  // Capture every real account (a `User` row linked to a Supabase Auth user)
  // before the wipe below. Deleting their Business cascades to the User row, so
  // without this they would be orphaned from the dashboard and forced to sign
  // up again. They are re-linked to a "Personal" business at the end.
  const preservedUsers = await prisma.user.findMany({
    where: { supabaseUserId: { not: null } },
    select: { email: true, supabaseUserId: true, role: true },
  });

  // Reset demo data. Deleting businesses cascades to customers, conversations
  // and messages; the explicit deletes keep the order FK-safe.
  await prisma.message.deleteMany();
  await prisma.conversation.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.sale.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.faq.deleteMany();
  await prisma.user.deleteMany();
  await prisma.business.deleteMany();

  const business = await prisma.business.create({
    data: {
      id: "test-biz-1",
      name: "ABC Electronics",
      phone: "+2348012345678",
      whatsappNumber: "+2348012345678",
      tone: "friendly",
      description:
        "We sell TVs, phones, home appliances and electronics accessories in Lagos.",
      // Active for testing: an active Green plan with 5,000 plan credits plus a
      // 2,500-credit top-up, so the AI answers immediately after seeding (no
      // billing step required) and both halves of the split wallet are visible.
      plan: "green",
      planStatus: "active",
      planCredits: 5000,
      topUpCredits: 2500,
      messagesUsedThisMonth: 0,
      manualMessagesUsedThisMonth: 0,
    },
  });

  // The demo owner account. The seed can't create a Supabase Auth user (no
  // service-role key), so `supabaseUserId` stays null: signing up at /signup
  // with this email links this tenant to the new auth user instead of creating
  // a second business.
  await prisma.user.create({
    data: {
      businessId: business.id,
      email: DEMO_OWNER_EMAIL,
      // Credentials now live in Supabase Auth; this column is a leftover.
      password: "",
      role: "owner",
    },
  });

  let messageCount = 0;
  const customersByName = new Map();

  for (const entry of CONVERSATIONS) {
    const customer = await prisma.customer.create({
      data: {
        businessId: business.id,
        name: entry.customer.name,
        phone: entry.customer.phone,
      },
    });
    customersByName.set(customer.name, customer);

    const conversation = await prisma.conversation.create({
      data: {
        businessId: business.id,
        customerId: customer.id,
        status: entry.status,
        createdAt: new Date(now - entry.messages[0].minutesAgo * MINUTE),
      },
    });

    await prisma.message.createMany({
      data: entry.messages.map((message) => ({
        businessId: business.id,
        conversationId: conversation.id,
        sender: message.sender,
        content: message.content,
        createdAt: new Date(now - message.minutesAgo * MINUTE),
      })),
    });

    messageCount += entry.messages.length;
  }

  const products = await prisma.product.createMany({
    data: PRODUCTS.map((product) => ({
      businessId: business.id,
      name: product.name,
      price: product.price,
      stock: product.stock,
      description: product.description,
    })),
  });

  const faqs = await prisma.faq.createMany({
    data: FAQS.map((faq) => ({
      businessId: business.id,
      category: faq.category,
      question: faq.question,
      answer: faq.answer,
    })),
  });

  // Demo sales. Created directly with an explicit totalAmount so stock levels
  // stay exactly as seeded above.
  const productRows = await prisma.product.findMany({
    where: { businessId: business.id },
    select: { id: true, name: true },
  });
  const idByProductName = new Map(productRows.map((p) => [p.name, p.id]));
  const priceByProductName = new Map(PRODUCTS.map((p) => [p.name, p.price]));

  const DAY = 24 * 60 * MINUTE;

  const SALES = [
    {
      customerName: "Chioma Okafor",
      productName: 'Hisense 32" LED TV',
      quantity: 1,
      status: "paid",
      daysAgo: 0,
      hoursAgo: 2,
    },
    {
      customerName: "Emeka Nwosu",
      productName: "Samsung Galaxy A15",
      quantity: 1,
      status: "paid",
      daysAgo: 0,
      hoursAgo: 6,
    },
    {
      customerName: "Aisha Bello",
      productName: "Blender 2L",
      quantity: 2,
      status: "pending",
      daysAgo: 1,
      hoursAgo: 3,
    },
    {
      customerName: "Chioma Okafor",
      productName: "Home Theatre System",
      quantity: 1,
      status: "paid",
      daysAgo: 2,
      hoursAgo: 0,
    },
    {
      customerName: "Emeka Nwosu",
      productName: "Electric Kettle 1.8L",
      quantity: 1,
      status: "paid",
      daysAgo: 4,
      hoursAgo: 1,
    },
  ];

  const VAT_RATE = 0.075;
  const round2 = (value) => Math.round((value + Number.EPSILON) * 100) / 100;
  const invoiceYear = new Date(now).getFullYear();
  let invoiceSeq = 0;
  let invoiceCount = 0;
  let salesCount = 0;

  for (const sale of SALES) {
    const customerId = customersByName.get(sale.customerName)?.id;
    const productId = idByProductName.get(sale.productName);
    const price = priceByProductName.get(sale.productName);

    if (!customerId || !productId || price === undefined) {
      throw new Error(
        `Could not resolve sale for ${sale.customerName} / ${sale.productName}`,
      );
    }

    const totalAmount = price * sale.quantity;
    const saleCreatedAt = new Date(
      now - (sale.daysAgo * DAY + sale.hoursAgo * MINUTE),
    );

    const created = await prisma.sale.create({
      data: {
        businessId: business.id,
        customerId,
        productId,
        quantity: sale.quantity,
        totalAmount,
        status: sale.status,
        createdAt: saleCreatedAt,
      },
    });
    salesCount += 1;

    // Every paid sale gets a draft invoice, matching lib/invoices.ts.
    if (sale.status === "paid") {
      invoiceSeq += 1;
      const subtotal = totalAmount;
      const vat = round2(subtotal * VAT_RATE);

      await prisma.invoice.create({
        data: {
          businessId: business.id,
          saleId: created.id,
          customerId,
          invoiceNumber: `INV-${invoiceYear}-${String(invoiceSeq).padStart(4, "0")}`,
          status: "draft",
          subtotal,
          vat,
          total: round2(subtotal + vat),
          items: [
            {
              name: sale.productName,
              quantity: sale.quantity,
              unitPrice: price,
              total: totalAmount,
            },
          ],
          createdAt: saleCreatedAt,
        },
      });
      invoiceCount += 1;
    }
  }

  // Agent training content. Courses and lessons are upserted by slug so
  // re-running the seed keeps the same lesson ids -- agents' lesson progress and
  // quiz attempts (which reference those ids) survive. Quiz questions have no
  // natural key, so they are replaced on each run.
  let agentLessonCount = 0;
  let agentQuestionCount = 0;

  // Remove the retired Course 1 so its lessons and quiz questions (both cascade
  // from the course) do not linger as an orphan after the slug changed to
  // "understanding-colly". Only this stale slug is touched -- Course 2, agents,
  // businesses, users and agent progress on other courses are left alone.
  await prisma.agentCourse.deleteMany({
    where: { slug: "setting-up-whatsapp-ai" },
  });

  // Remove the retired Course 2 placeholder (slug "nigerian-sme-sales") so its
  // lessons and quiz questions (both cascade from the course) do not linger as
  // an orphan after the course was replaced by "setting-up-a-business".
  await prisma.agentCourse.deleteMany({
    where: { slug: "nigerian-sme-sales" },
  });

  for (const course of AGENT_COURSES) {
    const record = await prisma.agentCourse.upsert({
      where: { slug: course.slug },
      update: {
        title: course.title,
        description: course.description,
        order: course.order,
        published: true,
        isCertificationCourse: course.isCertificationCourse ?? false,
      },
      create: {
        slug: course.slug,
        title: course.title,
        description: course.description,
        order: course.order,
        published: true,
        isCertificationCourse: course.isCertificationCourse ?? false,
      },
    });

    for (const lesson of course.lessons) {
      await prisma.agentLesson.upsert({
        where: { courseId_slug: { courseId: record.id, slug: lesson.slug } },
        update: {
          title: lesson.title,
          order: lesson.order,
          bodyMarkdown: lesson.bodyMarkdown,
          youtubeUrl: lesson.youtubeUrl ?? null,
          durationMin: lesson.durationMin ?? null,
        },
        create: {
          courseId: record.id,
          slug: lesson.slug,
          title: lesson.title,
          order: lesson.order,
          bodyMarkdown: lesson.bodyMarkdown,
          youtubeUrl: lesson.youtubeUrl ?? null,
          durationMin: lesson.durationMin ?? null,
        },
      });
      agentLessonCount += 1;
    }

    await prisma.agentQuizQuestion.deleteMany({
      where: { courseId: record.id },
    });
    await prisma.agentQuizQuestion.createMany({
      data: course.questions.map((question, index) => ({
        courseId: record.id,
        order: index + 1,
        question: question.question,
        options: question.options,
        correctIndex: question.correctIndex,
      })),
    });
    agentQuestionCount += course.questions.length;
  }

  // Final Certification Exam. The 40 questions are authored in the repo root as
  // final-exam-questions.txt and parsed here, matching seed-final-exam.cjs. The
  // file has no natural key, so the rows are replaced on each run.
  const finalExamQuestions = parseFinalExamQuestions();
  await prisma.agentFinalExamQuestion.deleteMany({});
  await prisma.agentFinalExamQuestion.createMany({
    data: finalExamQuestions,
  });

  // The demo agents for the /find-an-agent directory. Certified so they show
  // up in the directory; existing rows (real or demo) are left untouched.
  // Numbers come from the same scan the signup flow uses (lib/agent-id.ts),
  // taking the lowest unused one, so a real agent already holding "AG-0001"
  // cannot collide.
  const takenAgentNumbers = new Set(
    (await prisma.agent.findMany({ select: { agentNumber: true } })).map(
      (agent) => agent.agentNumber,
    ),
  );
  let demoAgentCount = 0;
  for (const demo of DEMO_AGENTS) {
    const existing = await prisma.agent.findUnique({
      where: { email: demo.email },
      select: { id: true },
    });
    if (existing) continue;

    let sequence = 1;
    let agentNumber = `AG-${String(sequence).padStart(4, "0")}`;
    while (takenAgentNumbers.has(agentNumber)) {
      sequence += 1;
      agentNumber = `AG-${String(sequence).padStart(4, "0")}`;
    }
    takenAgentNumbers.add(agentNumber);

    await prisma.agent.create({
      data: {
        agentNumber,
        email: demo.email,
        fullName: demo.fullName,
        phone: demo.phone,
        state: demo.state,
        certifiedAt: new Date(),
      },
    });
    demoAgentCount += 1;
  }

  console.log(
    `Seeded "${business.name}" (${business.id}) with ${CONVERSATIONS.length} conversations, ${messageCount} messages, ${products.count} products, ${faqs.count} FAQs, ${salesCount} sales and ${invoiceCount} invoices.`,
  );
  console.log(
    `Seeded ${AGENT_COURSES.length} agent courses, ${agentLessonCount} lessons and ${agentQuestionCount} quiz questions.`,
  );
  console.log(
    `Seeded ${finalExamQuestions.length} final certification exam questions.`,
  );
  console.log(
    `Seeded ${demoAgentCount} new demo agent(s) for /find-an-agent (${DEMO_AGENTS.length} total).`,
  );
  console.log(
    `Demo owner: ${DEMO_OWNER_EMAIL} (sign up with this email to own the seeded business).`,
  );

  // Re-link every captured real account to a fresh "Personal" business so the
  // owner can still sign in after the rest of the data was reset. Only created
  // when there is at least one account to hold.
  if (preservedUsers.length > 0) {
    const personal = await prisma.business.create({
      data: {
        name: "Personal",
        phone: "",
        whatsappNumber: "",
        // Brand-new accounts live on the permanent Free tier: 50 credits every
        // month, no card and no expiry (no trial window to lapse).
        plan: "free",
        planStatus: "inactive",
        planCredits: 50,
        topUpCredits: 0,
        // The 30-day Free re-grant clock starts now (see lastFreeGrantAt in
        // prisma/schema.prisma).
        lastFreeGrantAt: new Date(),
      },
    });

    for (const user of preservedUsers) {
      // Upsert on email: a row with the same email can already exist (the
      // re-created demo owner, for instance), and a plain create would crash
      // the whole seed on the unique constraint at the very end.
      await prisma.user.upsert({
        where: { email: user.email },
        update: {},
        create: {
          businessId: personal.id,
          email: user.email,
          // Credentials live in Supabase Auth; this column is a leftover.
          password: "",
          role: user.role,
          supabaseUserId: user.supabaseUserId,
        },
      });
    }
  }

  console.log(`Preserved ${preservedUsers.length} user account(s)`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
