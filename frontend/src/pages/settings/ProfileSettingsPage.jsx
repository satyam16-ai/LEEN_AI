import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Spinner,
} from '@/components/ui';
import {
  AvatarUploader,
  LearningProfileForm,
  ProfileDetailsForm,
  useProfile,
} from '@/features/profile';

export function ProfileSettingsPage() {
  const { data, isPending, isError } = useProfile();

  if (isPending) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }
  if (isError) {
    return <p className="text-sm text-destructive">Couldn't load your profile. Try refreshing.</p>;
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle as="h2">Your details</CardTitle>
          <CardDescription>This is how you appear to teachers, parents and admins.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <AvatarUploader user={data.user} />
          <ProfileDetailsForm user={data.user} />
        </CardContent>
      </Card>

      {data.student_profile && (
        <Card>
          <CardHeader>
            <CardTitle as="h2">Learning profile</CardTitle>
            <CardDescription>
              Your AI teacher uses this to match your syllabus and level.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LearningProfileForm profile={data.student_profile} />
          </CardContent>
        </Card>
      )}
    </>
  );
}
