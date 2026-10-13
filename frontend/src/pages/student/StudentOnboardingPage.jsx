import { Spinner } from '@/components/ui';
import { OnboardingWizard, useProfile } from '@/features/profile';

export function StudentOnboardingPage() {
  const { data, isPending, isError } = useProfile();

  return (
    <>
      <div className="mx-auto mb-8 max-w-3xl space-y-1 text-center">
        <h1 className="text-2xl font-bold sm:text-3xl">Set up your learning profile</h1>
        <p className="text-sm text-muted-foreground">
          Three quick steps so your AI teacher can match your syllabus and pace.
        </p>
      </div>
      {isPending ? (
        <div className="flex justify-center py-16">
          <Spinner />
        </div>
      ) : isError ? (
        <p className="text-center text-sm text-destructive">
          Couldn't load your profile. Try refreshing.
        </p>
      ) : (
        <OnboardingWizard profile={data.student_profile} />
      )}
    </>
  );
}
