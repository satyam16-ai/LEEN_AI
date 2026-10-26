import {
  BarChart3,
  Bell,
  BookOpenText,
  CalendarCheck,
  ClipboardCheck,
  FileText,
  KeyRound,
  LayoutDashboard,
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
    { label: 'My classes', to: '/student/classes', icon: School },
    { label: 'Parent access', to: '/student/parent-access', icon: KeyRound },
    { label: 'Ask a doubt', to: '/student/doubts', icon: MessageCircleQuestion },
    { label: 'Syllabus', to: '/student/syllabus', icon: BookOpenText },
    { label: "Today's class", icon: CalendarCheck, phase: 7 },
    { label: 'Homework & tests', icon: ClipboardCheck, phase: 9 },
    { label: 'Progress', icon: BarChart3, phase: 10 },
  ],
  parent: [
    { label: 'Dashboard', to: '/parent', icon: LayoutDashboard, end: true },
    { label: 'My children', to: '/parent/children', icon: UsersRound },
    { label: 'Reports', icon: FileText, phase: 11 },
    { label: 'Notifications', icon: Bell, phase: 11 },
  ],
  teacher: [
    { label: 'Dashboard', to: '/teacher', icon: LayoutDashboard, end: true },
    { label: 'Classes', to: '/teacher/classes', icon: School },
  ],
  admin: [
    { label: 'Dashboard', to: '/admin', icon: LayoutDashboard, end: true },
    { label: 'Users', to: '/admin/users', icon: Users },
    { label: 'Reports', icon: FileText, phase: 10 },
  ],
};
