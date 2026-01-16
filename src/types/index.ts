// Minimal types for MockInterviews component

export interface MockInterview {
    id: string;
    type: 'behavioral' | 'technical' | 'industry-specific';
    duration: number;
    questions: Array<{
        question: string;
        category: string;
        difficulty: 'easy' | 'medium' | 'hard';
    }>;
    completed: boolean;
    score?: number;
}
