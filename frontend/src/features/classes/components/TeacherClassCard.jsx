import { ArrowRight, Users } from 'lucide-react';
import { Link } from 'react-router-dom';

import { Badge, Card } from '@/components/ui';

export function TeacherClassCard({ classroom }) {
  return (
    <Card className="group relative flex flex-col gap-4 p-5 transition-shadow hover:shadow-elevated">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <h3 className="truncate text-base font-semibold">
            <Link
              to={`/teacher/classes/${classroom.id}`}
              className="rounded focus-ring after:absolute after:inset-0"
            >
              {classroom.name}
            </Link>
          </h3>
          <p className="text-sm text-muted-foreground">{classroom.subject}</p>
        </div>
        {classroom.grade && <Badge variant="primary">Class {classroom.grade}</Badge>}
      </div>
      <div className="mt-auto flex items-center justify-between gap-3 border-t border-border pt-4 text-sm">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Users className="size-4" aria-hidden="true" />
          {classroom.student_count} {classroom.student_count === 1 ? 'student' : 'students'}
        </span>
        <span className="flex items-center gap-2">
          <code className="rounded-md bg-muted px-2 py-0.5 font-mono text-xs font-semibold tracking-wider">
            {classroom.join_code}
          </code>
          <ArrowRight
            className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </span>
      </div>
    </Card>
  );
}
