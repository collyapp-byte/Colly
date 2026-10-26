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

const { PrismaClient } = require("@prisma/client");
// Academy content (courses, lessons, quizzes, final exam) lives in its own
// module so `npm run academy:sync` can update it without a full seed.
const { AGENT_COURSES, finalExamRows } = require("./academy-content.cjs");

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
        // Shown by the quiz page after a wrong answer.
        explanation: question.explanation ?? null,
      })),
    });
    agentQuestionCount += course.questions.length;
  }

  // Final Certification Exam. The 40 questions are authored in
  // prisma/academy-content.cjs (FINAL_EXAM_QUESTIONS) and tagged with their
  // section here. They have no natural key, so the rows are replaced each run.
  const finalExamQuestions = finalExamRows();
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
        // Brand-new accounts live on the permanent Free tier: 80 credits every
        // 30 days, no card and no expiry (no trial window to lapse).
        plan: "free",
        planStatus: "inactive",
        planCredits: 80,
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
