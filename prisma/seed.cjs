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

require("dotenv").config();

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
        title: "What WhatsApp Business API Is",
        order: 0,
        durationMin: 5,
        bodyMarkdown: `Every business in Nigeria uses WhatsApp. A customer sends a message. You reply. You make a sale.

So why pay for something that helps you reply to WhatsApp?

Here is the problem.

The WhatsApp app on your phone is made for **one person. You.**

You can only answer one message at a time.

This is fine when you get 5 messages a day. It fails when you get 50.

**What goes wrong:**

- **Messages come at night.** A customer sends a message at 11pm. You are asleep. You wake up at 7am. The customer already bought from another shop.
- **You cannot be in two places.** You are driving. You are cooking. You are in a meeting. Every message you do not answer is money you lose.
- **You cannot remember everything.** "Do you deliver to Ikeja?" "Is this available in blue?" "How much for 3 cartons?" Every customer asks the same questions. Every answer takes 30 seconds of your day.
- **You lose track.** Was it Chidi or Chinedu that bought 3 cartons last Tuesday? You scroll through 400 messages trying to find out.

The **WhatsApp Business API** is a different thing. It is the version of WhatsApp used by GTBank, Konga, and Moniepoint. It lets a **computer program** answer messages instead of a human.

Same WhatsApp. Same phone number. Customers message the same number they always have. But behind the scenes, software handles the conversations.

**The API can:**

- Answer 100 customers at once, 24 hours a day
- Remember every customer
- Send product images on request
- Understand voice notes and photos
- Know when to call a human

**A real example.**

Mrs. Adeyemi runs a provisions store in Surulere. Before Colly, she lost about 8 sales a week. Customers messaged at night. She did not reply. They bought elsewhere.

With Colly, her WhatsApp answers instantly. Day or night. She does not reply to every message herself. She only steps in when a customer asks something the AI cannot handle.

Same shop. Same products. About ₦180,000 more revenue a month. Just by not missing messages.

**Do this now:**

Open your own WhatsApp. Count how many messages you did not reply to yesterday. Every single one was a lost sale. Abeg, keep this number in your head. You will use it when you talk to a business owner.`,
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

**Do this now:**

Log into your own Colly account. Click every menu item in the sidebar. Spend 10 minutes in the dashboard. You cannot explain what you have not seen.`,
      },
      {
        slug: "what-colly-costs",
        title: "What Colly Costs",
        order: 4,
        durationMin: 5,
        bodyMarkdown: `There are three plans. There are also credits. Here is how it works.

**The Plans**

| Plan | Monthly | Yearly (2 months free) | Messages Included |
|---|---|---|---|
| Starter | ₦15,000 | ₦150,000 | 500 per month |
| Business | ₦25,000 | ₦250,000 | 1,500 per month |
| Pro | ₦50,000 | ₦500,000 | 2,500 per month |

Messages reset every month. If a business sends more than their plan includes, the extra messages come from credits.

**Credits**

Credits are how a business sends more than the plan allows.

- **Free plan (trial expired):** Credits cost ₦35 per message
- **Paid plan (over limit):** Credits cost ₦20 per message

Credits do not expire. Buy 500, use 200 this month, 300 next month. All fine.

**Why the limits exist**

WhatsApp charges Colly for every message sent. After the first 1,000 messages per number per month, WhatsApp charges about ₦10 per message. Colly passes part of this to the business through credits.

This is not Colly being greedy. This is Colly staying alive.

**What the agent can charge**

Colly has nothing to do with the agent's fee. Agents charge businesses separately for setup and training. This is called a "setup fee."

Common amounts:

- Small shop, one location: ₦25,000 to ₦50,000
- Medium business, multiple products: ₦75,000 to ₦150,000
- Large business, complex setup: ₦150,000+

Colly does not track this money. Colly does not take a cut. The setup fee is 100% the agent's.

**Do this now:**

Look at the pricing plans on the Colly signup page. Then decide what setup fee you will charge. Write it down. Say it out loud. You will need to say it confidently when you meet a business owner.`,
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
          "What is the Starter plan's monthly price and included messages?",
        options: [
          "₦10,000 / 1,000 messages",
          "₦15,000 / 500 messages",
          "₦25,000 / 1,500 messages",
          "₦50,000 / 2,500 messages",
        ],
        correctIndex: 1,
      },
      {
        question:
          "How much do credits cost for a business on a paid plan (over their limit)?",
        options: [
          "₦10 per message",
          "₦20 per message",
          "₦35 per message",
          "₦50 per message",
        ],
        correctIndex: 1,
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
        question: "Why do the plans have message limits?",
        options: [
          "To make more money",
          "Because WhatsApp charges Colly per message after 1,000 free per number",
          "Because the AI gets tired",
          "Because Meta requires it",
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
    slug: "nigerian-sme-sales",
    title: "Understanding Nigerian SME Sales",
    description:
      "How small businesses buy, how to qualify them, and how to follow up.",
    order: 2,
    isCertificationCourse: false,
    lessons: [
      {
        slug: "how-smes-buy",
        title: "How Nigerian SMEs Buy",
        order: 1,
        durationMin: 5,
        bodyMarkdown: `## How Nigerian SMEs buy

Small businesses buy what solves a pressing problem today.

- They trust people and referrals more than adverts
- They care about price and payment flexibility
- They value speed, delivery and a number they can call
- They often decide quickly when the value is clear

Keep this in mind when you pitch Colly: lead with the problem it removes, not the technology.`,
      },
      {
        slug: "qualifying-a-business",
        title: "Qualifying a Business",
        order: 2,
        durationMin: 5,
        bodyMarkdown: `## Qualifying a business

Not every business is a good fit for an AI assistant.

Signs it's a good fit:
- Many repeat questions on WhatsApp
- The owner is often too busy to reply
- A clear product list or service menu

Signs to wait:
- The business has no steady message volume
- The owner won't share product details
- Everything is custom-quoted per order`,
      },
      {
        slug: "following-up",
        title: "Following Up Without Pressure",
        order: 3,
        durationMin: 5,
        bodyMarkdown: `## Following up without pressure

Most sales happen after a few gentle follow-ups.

- Follow up within a day
- Lead with a useful tip or a relevant example
- Ask one clear question at a time
- Never spam; space your messages out

Record what each business needs so your next follow-up is specific.`,
      },
    ],
    questions: [
      {
        question: "What do Nigerian SMEs trust most?",
        options: ["Adverts", "People and referrals", "Cold calls", "Billboards"],
        correctIndex: 1,
      },
      {
        question: "Which is a sign a business is a good fit?",
        options: [
          "Many repeat questions on WhatsApp",
          "No messages at all",
          "No product list",
          "Owner replies instantly all day",
        ],
        correctIndex: 0,
      },
      {
        question: "When should you follow up?",
        options: ["Within a day", "After a month", "Never", "Only after they complain"],
        correctIndex: 0,
      },
      {
        question: "How should you follow up?",
        options: [
          "Spam daily",
          "Lead with a useful tip and one clear question",
          "Send many questions at once",
          "Stop after one message",
        ],
        correctIndex: 1,
      },
      {
        question: "What should you record about each business?",
        options: [
          "Nothing",
          "What they need for a specific next follow-up",
          "Their competitor's prices",
          "Their staff birthdays",
        ],
        correctIndex: 1,
      },
    ],
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

  console.log(
    `Seeded "${business.name}" (${business.id}) with ${CONVERSATIONS.length} conversations, ${messageCount} messages, ${products.count} products, ${faqs.count} FAQs, ${salesCount} sales and ${invoiceCount} invoices.`,
  );
  console.log(
    `Seeded ${AGENT_COURSES.length} agent courses, ${agentLessonCount} lessons and ${agentQuestionCount} quiz questions.`,
  );
  console.log(
    `Demo owner: ${DEMO_OWNER_EMAIL} (sign up with this email to own the seeded business).`,
  );

  // Re-link every captured real account to a fresh "Personal" business so the
  // owner can still sign in after the rest of the data was reset. Only created
  // when there is at least one account to hold.
  if (preservedUsers.length > 0) {
    const personal = await prisma.business.create({
      data: { name: "Personal", phone: "", whatsappNumber: "" },
    });

    for (const user of preservedUsers) {
      await prisma.user.create({
        data: {
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
