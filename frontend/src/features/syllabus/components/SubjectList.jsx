import { Link } from 'react-router-dom';

import { Badge } from '@/components/ui';
import { cn } from '@/utils/cn';

import { SYLLABUS_STATUS } from '../constants';

/** The student's profile subjects, each with where its syllabus stands. */
export function SubjectList({ subjects, active }) {
  return (
    <nav aria-label="Subjects" className="space-y-1">
      {subjects.map((item) => {
        const status = SYLLABUS_STATUS[item.status] ?? SYLLABUS_STATUS.empty;
        const current = item.subject === active;
        return (
          <Link
            key={item.subject}
            to={`/student/syllabus/${encodeURIComponent(item.subject)}`}
            aria-current={current ? 'page' : undefined}
            className={cn(
              'flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm transition-colors focus-ring',
              current ? 'bg-primary/10 font-semibold text-primary' : 'hover:bg-muted'
            )}
          >
            <span className="truncate">{item.subject}</span>
            <Badge variant={status.variant}>
              {item.topics ? `${item.done}/${item.topics}` : status.label}
            </Badge>
          </Link>
        );
      })}
    </nav>
  );
}
