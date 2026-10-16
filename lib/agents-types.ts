/** Response shapes shared between the agent API routes and their client pages. */

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
  };
  progress: {
    completedLessons: number;
    totalLessons: number;
  };
  certified: boolean;
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
