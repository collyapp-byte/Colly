/** Response shapes shared between the agent API routes and their client pages. */

import type { CourseSlug } from "@/lib/course-badge-meta";

export type AgentReferral = {
  id: string;
  name: string;
  createdAt: string;
  plan: string;
  planStatus: string;
};

export type AgentMeResponse = {
  agent: {
    fullName: string;
    agentNumber: string;
    certifiedAt: string | null;
    finalExamPassedAt: string | null;
  };
  progress: {
    completedLessons: number;
    totalLessons: number;
  };
  certified: boolean;
  finalExamPassed: boolean;
  referrals: AgentReferral[];
};

export type AgentCourseSummary = {
  slug: string;
  title: string;
  description: string;
  lessonCount: number;
  completedCount: number;
};

export type AgentTrainingResponse = {
  courses: AgentCourseSummary[];
};

export type AgentLessonSummary = {
  id: string;
  slug: string;
  title: string;
  order: number;
  durationMin: number | null;
  completed: boolean;
};

export type AgentQuizQuestion = {
  id: string;
  order: number;
  question: string;
  options: string[];
  /// Index of the correct option. Sent to the client so the quiz can give
  /// immediate per-question feedback before the final submission.
  correctIndex: number;
  /// Optional explanation shown after a wrong answer. Null when not provided.
  explanation: string | null;
};

export type AgentCourseResponse = {
  course: {
    slug: string;
    title: string;
    description: string;
  };
  lessons: AgentLessonSummary[];
  allLessonsComplete: boolean;
  quizAvailable: boolean;
  questions: AgentQuizQuestion[];
};

export type AgentLessonResponse = {
  course: { slug: string; title: string };
  lesson: {
    id: string;
    slug: string;
    title: string;
    bodyMarkdown: string;
    youtubeUrl: string | null;
    durationMin: number | null;
    completed: boolean;
  };
  prevSlug: string | null;
  nextSlug: string | null;
};

export type AgentQuizResult = {
  score: number;
  passed: boolean;
  certified: boolean;
};

export type AgentCertificateResponse = {
  certified: boolean;
  certificate: {
    certificateId: string;
    issuedAt: string;
  } | null;
  agent: {
    fullName: string;
    agentNumber: string;
  };
};

export type AgentReferralsResponse = {
  agentNumber: string;
  referrals: AgentReferral[];
};

export type AgentBadgeSummary = {
  courseSlug: CourseSlug;
  earned: boolean;
  earnedAt: string | null;
};

export type AgentBadgesResponse = {
  badges: AgentBadgeSummary[];
  allEarned: boolean;
};

export type AgentFinalExamQuestion = {
  id: string;
  order: number;
  sectionTitle: string;
  question: string;
  options: string[];
  /// Shown in the post-exam review for a missed question. Null when the content
  /// author did not provide one.
  explanation: string | null;
};

/** One graded question, used to review mistakes after the exam. */
export type AgentFinalExamReviewItem = {
  order: number;
  chosenIndex: number;
  correctIndex: number;
  correct: boolean;
  explanation: string | null;
};

export type AgentFinalExamResponse = {
  questions: AgentFinalExamQuestion[];
  /// True until all four course badges are earned. The exam is locked meanwhile.
  locked: boolean;
  alreadyPassed: boolean;
};

export type AgentFinalExamResult = {
  score: number;
  passed: boolean;
  correct: number;
  total: number;
  certified: boolean;
  /// Per-question outcome; the client shows the explanations for missed items.
  review?: AgentFinalExamReviewItem[];
};
