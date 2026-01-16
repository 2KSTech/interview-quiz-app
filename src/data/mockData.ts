import { MockInterview } from '../types';

export const mockInterviews: MockInterview[] = [
    {
        id: '1',
        type: 'behavioral',
        duration: 30,
        questions: [
            {
                question: 'Tell me about a time you faced a challenging problem at work.',
                category: 'Problem Solving',
                difficulty: 'medium'
            },
            {
                question: 'Describe a situation where you had to work with a difficult team member.',
                category: 'Teamwork',
                difficulty: 'medium'
            },
            {
                question: 'Tell me about a successful presentation you gave and why you think it was a hit.',
                category: 'Communication',
                difficulty: 'medium'
            },
            {
                question: 'Tell me about your proudest professional accomplishment.',
                category: 'Achievements',
                difficulty: 'easy'
            },
            {
                question: 'Where do you see yourself in 10 years?',
                category: 'Career Goals',
                difficulty: 'easy'
            }
        ],
        completed: true,
        score: 85
    },
    {
        id: '2',
        type: 'technical',
        duration: 45,
        questions: [
            {
                question: 'Explain the difference between let, const, and var in JavaScript.',
                category: 'JavaScript',
                difficulty: 'easy'
            },
            {
                question: 'How would you optimize a React component for performance?',
                category: 'React',
                difficulty: 'hard'
            }
        ],
        completed: false
    },
    {
        id: '3',
        type: 'industry-specific',
        duration: 30,
        questions: [
            { question: 'AWS general knowledge warmup', category: 'AWS', difficulty: 'easy' }
        ],
        completed: false
    }
];
