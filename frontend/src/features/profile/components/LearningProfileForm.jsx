import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import { Button } from '@/components/ui';
import { applyFieldErrors, getApiError } from '@/utils/apiError';

import { useUpdateProfile } from '../hooks/useProfile';
import { learningProfileDefaults, learningProfileSchema } from '../schemas';
import { LearningProfileFields } from './LearningProfileFields';

export function LearningProfileForm({ profile }) {
  const update = useUpdateProfile();
  const {
    register,
    control,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm({
    resolver: zodResolver(learningProfileSchema),
    defaultValues: learningProfileDefaults(profile),
  });

  const onSubmit = handleSubmit(async (values) => {
    try {
      const saved = await update.mutateAsync(values);
      reset(learningProfileDefaults(saved.student_profile));
      toast.success('Learning profile saved');
    } catch (error) {
      const apiError = getApiError(error);
      if (!applyFieldErrors(apiError.fieldErrors, setError)) toast.error(apiError.message);
    }
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-7">
      <LearningProfileFields control={control} register={register} errors={errors} />
      <div className="flex justify-end">
        <Button type="submit" loading={update.isPending} disabled={!isDirty}>
          Save learning profile
        </Button>
      </div>
    </form>
  );
}
