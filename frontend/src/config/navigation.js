import {
  BarChart3,
  BookOpenText,
  CalendarCheck,
  ClipboardCheck,
  FileText,
  LayoutDashboard,
  Bell,
  MessageCircleQuestion,
  School,
  Users,
  UsersRound,
} from 'lucide-react';

/**
 * Sidebar items per role. Items with `phase` (and no `to`) are upcoming
 * features: they render disabled with a "Soon" badge until that phase ships.
 */
export const NAVIGATION = {
  student: [
    { label: 'Dashboard', to: '/student', icon: LayoutDashboard, end: true },
    { label: 'Ask a doubt', icon: MessageCircleQuestion, phase: 3 },
    { label: 'Quizzes', icon: ClipboardCheck, phase: 4 },
    { label: 'Study plan', icon: CalendarCheck, phase: 5 },
    { label: 'Progress', icon: BarChart3, phase: 6 },
  ],
  parent: [
    { label: 'Dashboard', to: '/parent', icon: LayoutDashboard, end: true },
    { label: 'My children', icon: UsersRound, phase: 2 },
    { label: 'Reports', icon: FileText, phase: 7 },
    { label: 'Notifications', icon: Bell, phase: 7 },
  ],
  teacher: [
    { label: 'Dashboard', to: '/teacher', icon: LayoutDashboard, end: true },
    { label: 'Classes', icon: School, phase: 2 },
    { label: 'Syllabus', icon: BookOpenText, phase: 3 },
    { label: 'Quizzes', icon: ClipboardCheck, phase: 4 },
    { label: 'Class analytics', icon: BarChart3, phase: 6 },
  ],
  admin: [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
    { label: 'Users', to: '/admin/users', icon: Users },
    { label: 'Syllabus', icon: BookOpenText, phase: 3 },
    { label: 'Reports', icon: FileText, phase: 7 },
  ],
};
