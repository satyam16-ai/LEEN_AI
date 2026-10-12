import { ChevronLeft, ChevronRight, Search, Users } from 'lucide-react';
import { useState } from 'react';

import { PageHeader } from '@/components/dashboard';
import { Button, Card, Input, Spinner } from '@/components/ui';
import { CreateUserDialog, UsersTable, useAdminUsers } from '@/features/admin';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { cn } from '@/utils/cn';

const PAGE_SIZE = 10;
const FILTERS = [
  { value: '', label: 'All' },
  { value: 'student', label: 'Students' },
  { value: 'parent', label: 'Parents' },
  { value: 'teacher', label: 'Teachers' },
  { value: 'admin', label: 'Admins' },
];

export function AdminUsersPage() {
  const [role, setRole] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const debouncedSearch = useDebouncedValue(search.trim());

  const { data, isPending, isError, isPlaceholderData } = useAdminUsers({
    role,
    search: debouncedSearch,
    page,
    pageSize: PAGE_SIZE,
  });

  const counts = data?.counts ?? {};
  const totalAll = Object.values(counts).reduce((sum, value) => sum + value, 0);
  const total = data?.total ?? 0;
  const lastPage = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);

  const changeRole = (value) => {
    setRole(value);
    setPage(1);
  };

  return (
    <>
      <PageHeader
        title="Users"
        description="Everyone with access to LEEN AI. Create teacher accounts here."
        actions={<CreateUserDialog />}
      />

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div role="tablist" aria-label="Filter by role" className="flex flex-wrap gap-1">
            {FILTERS.map((filter) => {
              const active = role === filter.value;
              const count = filter.value ? counts[filter.value] : totalAll;
              return (
                <button
                  key={filter.value || 'all'}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => changeRole(filter.value)}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors focus-ring',
                    active
                      ? 'bg-primary-soft text-primary-soft-foreground'
                      : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                  )}
                >
                  {filter.label}
                  {count !== undefined && (
                    <span className="rounded-full bg-card px-1.5 text-xs tabular-nums shadow-xs">
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <div className="relative lg:w-72">
            <Search
              className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search name or email"
              aria-label="Search users"
              className="h-10 pl-9"
            />
          </div>
        </div>

        {isPending ? (
          <div className="flex justify-center py-16">
            <Spinner />
          </div>
        ) : isError ? (
          <p className="p-6 text-sm text-destructive">Couldn't load users. Try refreshing.</p>
        ) : data.items.length === 0 ? (
          <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
            <span className="flex size-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <Users className="size-6" aria-hidden="true" />
            </span>
            <p className="font-semibold">No users found</p>
            <p className="text-sm text-muted-foreground">Try a different search or filter.</p>
          </div>
        ) : (
          <div className={cn('transition-opacity', isPlaceholderData && 'opacity-60')}>
            <UsersTable users={data.items} />
          </div>
        )}

        {total > 0 && (
          <div className="flex items-center justify-between gap-3 border-t border-border px-6 py-3.5">
            <p className="text-sm text-muted-foreground" aria-live="polite">
              Showing <span className="font-medium text-foreground">{from}</span>–
              <span className="font-medium text-foreground">{to}</span> of{' '}
              <span className="font-medium text-foreground">{total}</span>
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((value) => value - 1)}
                disabled={page <= 1}
              >
                <ChevronLeft className="size-4" aria-hidden="true" />
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((value) => value + 1)}
                disabled={page >= lastPage || isPlaceholderData}
              >
                Next
                <ChevronRight className="size-4" aria-hidden="true" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </>
  );
}
