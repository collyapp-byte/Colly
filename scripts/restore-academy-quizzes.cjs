'use strict';

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const COURSE_QUIZZES = {
  "understanding-colly": [
    { q: "What is the main difference between the WhatsApp Business App and the WhatsApp Business API?", o: ["The API is free", "The API can handle many customers at once, automatically", "The API works only on Android", "The API cannot send images"], c: 1 },
    { q: "Mrs. Adeyemi's store lost about how much extra revenue per month before Colly?", o: ["₦18,000", "₦180,000", "₦1,800", "₦18"], c: 1 },
    { q: "What does Colly do when a customer asks a question it cannot answer?", o: ["Ignores the message", "Answers with a generic reply", "Hands the conversation to the business owner", "Ends the chat"], c: 2 },
    { q: "Which of these can Colly understand?", o: ["Only English", "Only English and French", "English, Pidgin, voice notes, and photos", "Only text messages"], c: 2 },
    { q: "What is the Starter plan's monthly price and included messages?", o: ["₦10,000 / 1,000 messages", "₦15,000 / 500 messages", "₦25,000 / 1,500 messages", "₦50,000 / 2,500 messages"], c: 0 }
  ],
  "setting-up-a-business": [
    { q: "Before a setup visit, which of these is NOT required?", o: ["Product list and photos", "The owner's bank details", "Common customer questions", "The owner's WhatsApp number"], c: 1 },
    { q: "Whose details should you use when creating the business account?", o: ["Your own email and phone", "The owner's real details", "A shared Colly account", "The customer's details"], c: 1 },
    { q: "What is the floor price?", o: ["The highest price the AI can offer", "The lowest price the AI can offer during negotiation", "The price after VAT", "The cost price"], c: 1 },
    { q: "How many photos can a product have?", o: ["1", "3", "5", "Up to 10"], c: 3 },
    { q: "Who connects the WhatsApp Business API?", o: ["The agent", "The business owner", "Colly's team", "Meta"], c: 2 }
  ],
  "training-the-owner": [
    { q: "How long should the initial dashboard tour take?", o: ["1 minute", "10 minutes", "1 hour", "All day"], c: 0 },
    { q: "When should the owner take over a conversation?", o: ["Every conversation", "Only when the AI fails or the customer is angry", "Never - let the AI handle everything", "Randomly"], c: 1 },
    { q: "What happens when the owner forgets to resume the AI after taking over?", o: ["The AI stays paused forever", "The AI auto-resumes after 1 hour", "The customer gets an error", "The conversation ends"], c: 1 },
    { q: "What is the Quick Sale feature for?", o: ["Online customers", "Walk-in customers who pay in cash, transfer, or POS", "Wholesale customers", "Only for delivery"], c: 1 }
  ],
  "sales-and-support": [
    { q: "Which of these is a sign a business needs Colly?", o: ["They have a full-time customer service team", "They post prices on WhatsApp Status", "They use Uber Eats", "They have a dedicated social media manager"], c: 0 },
    { q: "What is the FIRST thing you should do before pitching?", o: ["Show your phone", "Ask one question and let them talk", "Hand them a flyer", "Quote the price"], c: 1 },
    { q: "What is the recommended setup fee range for a small shop?", o: ["₦1,000 - ₦3,000", "₦5,000 - ₦15,000", "₦25,000 - ₦50,000", "₦0 (free)"], c: 1 },
    { q: "Which of these should you escalate to Colly support?", o: ["Wrong product description", "Missing FAQ", "WhatsApp number banned or disconnected", "AI tone needs adjusting"], c: 2 }
  ]
};

const FINAL_EXAM_QUESTIONS = [
  // Understanding Colly (1-10)
  { s: "Understanding Colly", q: "What is the main difference between the WhatsApp Business App and the WhatsApp Business API?", o: ["The API is free", "The API can handle many customers at once, automatically", "The API works only on Android", "The API cannot send images"], c: 1 },
  { s: "Understanding Colly", q: "Mrs. Adeyemi's store lost about how much extra revenue per month before Colly?", o: ["₦18,000", "₦180,000", "₦1,800", "₦18"], c: 1 },
  { s: "Understanding Colly", q: "What does Colly do when a customer asks a question it cannot answer?", o: ["Ignores the message", "Answers with a generic reply", "Hands the conversation to the business owner", "Ends the chat"], c: 2 },
  { s: "Understanding Colly", q: "Which of these can Colly understand?", o: ["Only English", "Only English and French", "English, Pidgin, voice notes, and photos", "Only text messages"], c: 2 },
  { s: "Understanding Colly", q: "What is the Starter plan's monthly price and included messages?", o: ["₦10,000 / 1,000 messages", "₦15,000 / 500 messages", "₦25,000 / 1,500 messages", "₦50,000 / 2,500 messages"], c: 0 },
  { s: "Understanding Colly", q: "What is Colly's primary purpose for small businesses?", o: ["To replace human agents entirely", "To automate customer service and increase sales", "To manage inventory only", "To create social media posts"], c: 1 },
  { s: "Understanding Colly", q: "How does Colly handle multiple customers simultaneously?", o: ["One at a time, in a queue", "It can handle many customers at once, automatically", "It requires manual intervention for each", "It only works with one customer per day"], c: 1 },
  { s: "Understanding Colly", q: "What is the 'tone' setting in Colly used for?", o: ["To change the font style in messages", "To adjust the personality of the AI responses", "To set the volume of voice notes", "To control the speed of typing indicators"], c: 1 },
  { s: "Understanding Colly", q: "Which feature allows the business owner to take over a conversation?", o: ["Quick Sale", "AI pause", "Handover", "Auto-reply"], c: 2 },
  { s: "Understanding Colly", q: "What does the 'AI paused' banner indicate?", o: ["The AI is training", "The owner has taken over the conversation", "The system is down", "The business has no credits"], c: 1 },

  // Setting Up a Business (11-20)
  { s: "Setting Up a Business", q: "Before a setup visit, which of these is NOT required?", o: ["Product list and photos", "The owner's bank details", "Common customer questions", "The owner's WhatsApp number"], c: 1 },
  { s: "Setting Up a Business", q: "Whose details should you use when creating the business account?", o: ["Your own email and phone", "The owner's real details", "A shared Colly account", "The customer's details"], c: 1 },
  { s: "Setting Up a Business", q: "What is the floor price?", o: ["The highest price the AI can offer", "The lowest price the AI can offer during negotiation", "The price after VAT", "The cost price"], c: 1 },
  { s: "Setting Up a Business", q: "How many photos can a product have?", o: ["1", "3", "5", "Up to 10"], c: 3 },
  { s: "Setting Up a Business", q: "Who connects the WhatsApp Business API?", o: ["The agent", "The business owner", "Colly's team", "Meta"], c: 2 },
  { s: "Setting Up a Business", q: "What is the first step in setting up a business on Colly?", o: ["Create a product catalog", "Connect WhatsApp", "Set AI tone", "Add business hours"], c: 1 },
  { s: "Setting Up a Business", q: "Which of these is required for the business registration?", o: ["A physical storefront", "A business email address", "A government ID", "A social media page"], c: 2 },
  { s: "Setting Up a Business", q: "What does the 'tone' setting affect?", o: ["The color scheme of the dashboard", "The language style of AI responses", "The speed of the internet connection", "The number of messages sent per day"], c: 1 },
  { s: "Setting Up a Business", q: "How many business hours should be set?", o: ["4 hours per day", "8 hours per day", "12 hours per day", "24 hours per day"], c: 2 },
  { s: "Setting Up a Business", q: "What is the purpose of the 'business description' field?", o: ["To list products", "To provide a brief overview of the business", "To store contact information", "To set pricing rules"], c: 1 },

  // Training the Owner (21-30)
  { s: "Training the Owner", q: "How long should the initial dashboard tour take?", o: ["1 minute", "10 minutes", "1 hour", "All day"], c: 0 },
  { s: "Training the Owner", q: "When should the owner take over a conversation?", o: ["Every conversation", "Only when the AI fails or the customer is angry", "Never - let the AI handle everything", "Randomly"], c: 1 },
  { s: "Training the Owner", q: "What happens when the owner forgets to resume the AI after taking over?", o: ["The AI stays paused forever", "The AI auto-resumes after 1 hour", "The customer gets an error", "The conversation ends"], c: 1 },
  { s: "Training the Owner", q: "What is the Quick Sale feature for?", o: ["Online customers", "Walk-in customers who pay in cash, transfer, or POS", "Wholesale customers", "Only for delivery"], c: 1 },
  { s: "Training the Owner", q: "What is the recommended frequency for reviewing analytics?", o: ["Daily", "Weekly", "Monthly", "Quarterly"], c: 1 },
  { s: "Training the Owner", q: "How can the owner improve AI performance?", o: ["By providing more product data", "By disabling the AI", "By ignoring customer feedback", "By using a different language"], c: 0 },
  { s: "Training the Owner", q: "What does the 'AI paused' banner indicate?", o: ["The owner is on leave", "The AI is training", "The owner has taken over the conversation", "The system is down"], c: 2 },
  { s: "Training the Owner", q: "Which metric shows how many customers the AI handled?", o: ["Total sales", "AI replies count", "Number of conversations", "Customer satisfaction score"], c: 1 },
  { s: "Training the Owner", q: "What is the purpose of the 'handover' feature?", o: ["To transfer a conversation to the owner", "To delete a conversation", "To archive a conversation", "To forward a conversation to another business"], c: 0 },
  { s: "Training the Owner", q: "How often should the owner update product information?", o: ["Every day", "Every week", "Every month", "Only when stock runs out"], c: 1 },

  // Sales & Support (31-40)
  { s: "Sales & Support", q: "Which of these is a sign a business needs Colly?", o: ["They have a full-time customer service team", "They post prices on WhatsApp Status", "They use Uber Eats", "They have a dedicated social media manager"], c: 0 },
  { s: "Sales & Support", q: "What is the FIRST thing you should do before pitching?", o: ["Show your phone", "Ask one question and let them talk", "Hand them a flyer", "Quote the price"], c: 1 },
  { s: "Sales & Support", q: "What is the recommended setup fee range for a small shop?", o: ["₦1,000 - ₦3,000", "₦5,000 - ₦15,000", "₦25,000 - ₦50,000", "₦0 (free)"], c: 1 },
  { s: "Sales & Support", q: "Which of these should you escalate to Colly support?", o: ["Wrong product description", "Missing FAQ", "WhatsApp number banned or disconnected", "AI tone needs adjusting"], c: 2 },
  { s: "Sales & Support", q: "What is the primary goal of a sales pitch?", o: ["To close the deal immediately", "To understand the customer's needs", "To show product features", "To compare with competitors"], c: 1 },
  { s: "Sales & Support", q: "How can the owner increase conversion rates?", o: ["By offering discounts", "By ignoring customer objections", "By using generic responses", "By limiting product options"], c: 0 },
  { s: "Sales & Support", q: "What is the benefit of using Colly's analytics?", o: ["To track employee attendance", "To see which products are popular", "To monitor social media likes", "To calculate tax"], c: 1 },
  { s: "Sales & Support", q: "Which channel is NOT supported by Colly?", o: ["WhatsApp", "Instagram Direct", "Facebook Messenger", "Telegram"], c: 2 },
  { s: "Sales & Support", q: "How does Colly handle a customer's complaint?", o: ["Ignores it", "Escalates to the owner automatically", "Provides a scripted apology and solution", "Ends the chat"], c: 2 },
  { s: "Sales & Support", q: "What is the purpose of the 'FAQ' section?", o: ["To store product prices", "To provide quick answers to common questions", "To list employee contact info", "To track sales history"], c: 1 }
];

async function main() {
  // Delete existing rows
  await prisma.agentQuizQuestion.deleteMany();
  await prisma.agentFinalExamQuestion.deleteMany();

  // Fetch all AgentCourses
  const courses = await prisma.agentCourse.findMany();

  // Insert quiz questions
  for (const course of courses) {
    const slug = course.slug;
    const questions = COURSE_QUIZZES[slug];
    if (!questions) {
      console.log(`No quiz data for course slug: ${slug}`);
      continue;
    }
    // Find the course by slug to get its id
    const courseRecord = await prisma.agentCourse.findUnique({
      where: { slug: slug },
    });
    if (!courseRecord) {
      console.log(`Course not found for slug: ${slug}`);
      continue;
    }
    for (const q of questions) {
      await prisma.agentQuizQuestion.create({
        data: {
          courseId: courseRecord.id,
          question: q.q,
          options: q.o,
          correctIndex: q.c,
        },
      });
    }
    console.log(`Inserted ${questions.length} quiz questions for course: ${slug}`);
  }

  // Insert final exam questions
  for (const q of FINAL_EXAM_QUESTIONS) {
    await prisma.agentFinalExamQuestion.create({
      data: {
        sectionTitle: q.s,
        question: q.q,
        options: q.o,
        correctIndex: q.c,
      },
    });
  }
  console.log(`Inserted ${FINAL_EXAM_QUESTIONS.length} final exam questions`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
