import { Rocket, Sprout, TrendingUp } from 'lucide-react';

export const GRADES = Array.from({ length: 12 }, (_, index) => index + 1);

export const BOARDS = [
  { value: 'cbse', label: 'CBSE' },
  { value: 'icse', label: 'ICSE / ISC' },
  { value: 'state', label: 'State board' },
  { value: 'ib', label: 'IB' },
  { value: 'igcse', label: 'Cambridge IGCSE' },
  { value: 'other', label: 'Other' },
];

export const LEVELS = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'Many topics feel new — explain things from the basics.',
    icon: Sprout,
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'I know the basics and want steady practice.',
    icon: TrendingUp,
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'Challenge me with tougher problems.',
    icon: Rocket,
  },
];

export const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
];

export const MAX_SUBJECTS = 12;

export function suggestedSubjects(grade) {
  if (!grade || grade <= 5) {
    return ['Mathematics', 'English', 'Hindi', 'Environmental Studies', 'Computer Science'];
  }
  if (grade <= 10) {
    return [
      'Mathematics',
      'Science',
      'English',
      'Hindi',
      'Social Science',
      'Computer Science',
      'Sanskrit',
    ];
  }
  return [
    'Physics',
    'Chemistry',
    'Mathematics',
    'Biology',
    'English',
    'Computer Science',
    'Economics',
    'Accountancy',
    'Business Studies',
    'History',
    'Political Science',
    'Geography',
  ];
}

export function labelFor(options, value) {
  return options.find((option) => option.value === value)?.label ?? value ?? '—';
}

export const gradeLabel = (grade) => (grade ? `Class ${grade}` : '—');
