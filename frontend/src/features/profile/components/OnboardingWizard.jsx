import { zodResolver } from '@hookform/resolvers/zod';
import { ArrowLeft, ArrowRight, Check } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { Button, Card } from '@/components/ui';
import { applyFieldErrors, getApiError } from '@/utils/apiError';
import { cn } from '@/utils/cn';

import { useUpdateProfile } from '../hooks/useProfile';
import { learningProfileDefaults, learningProfileSchema } from '../schemas';
import { LearningProfileFields } from './LearningProfileFields';

const STEPS = [
  {
    id: 'study',
    title: 'Your class',
    description: 'Tell us where you study so answers match your syllabus.',
    fields: ['grade', 'board', 'school_name'],
  },
  {
    id: 'subjects',
    title: 'Your subjects',
    description: 'Pick the subjects you want help with. You can change these any time.',
    fields: ['subjects'],
  },
  {
    id: 'style',
    title: 'How you learn',
    description: "We'll pitch explanations and practice at the right level for you.",
    fields: ['learning_level', 'preferred_language'],
  },
];

export function OnboardingWizard({ profile }) {
  const [step, setStep] = useState(0);
  const update = useUpdateProfile();
  const navigate = useNavigate();
  const {
    register,
    control,
    handleSubmit,
    trigger,
    setError,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(learningProfileSchema),
    defaultValues: learningProfileDefaults(profile),
    // Steps validate via trigger(), not submit, so re-validate on change to clear fixed errors.
    mode: 'onChange',
  });

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  const next = async () => {
    if (await trigger(current.fields)) setStep((value) => value + 1);
  };

  const finish = handleSubmit(async (values) => {
    try {
      await update.mutateAsync(values);
      toast.success('Your learning profile is ready!');
      navigate('/student', { replace: true });
    } catch (error) {
      const apiError = getApiError(error);
      if (!applyFieldErrors(apiError.fieldErrors, setError)) toast.error(apiError.message);
    }
  });

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-8 flex items-center gap-3" aria-label="Progress">
        {STEPS.map((item, index) => {
          const done = index < step;
          const active = index === step;
          return (
            <li key={item.id} className="flex flex-1 items-center gap-3">
              <span
                className={cn(
                  'flex size-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors',
                  done && 'bg-success text-white',
                  active && 'bg-primary text-primary-foreground ring-4 ring-primary/15',
                  !done && !active && 'bg-muted text-muted-foreground'
                )}
                aria-current={active ? 'step' : undefined}
              >
                {done ? <Check className="size-4" aria-hidden="true" /> : index + 1}
              </span>
              <span
                className={cn(
                  'hidden text-sm font-medium sm:block',
                  active ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {item.title}
              </span>
              {index < STEPS.length - 1 && (
                <span
                  className={cn('h-px flex-1', done ? 'bg-success' : 'bg-border')}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>

      <Card className="p-6 sm:p-8">
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            if (isLast) finish();
            else next();
          }}
        >
          <div className="mb-7 space-y-1">
            <p className="text-sm font-semibold text-primary">
              Step {step + 1} of {STEPS.length}
            </p>
            <h2 className="text-2xl font-bold">{current.title}</h2>
            <p className="text-sm text-muted-foreground">{current.description}</p>
          </div>

          <div key={current.id} className="animate-rise">
            <LearningProfileFields
              control={control}
              register={register}
              errors={errors}
              sections={[current.id]}
            />
          </div>

          <div className="mt-8 flex items-center justify-between gap-3 border-t border-border pt-6">
            <Button
              variant="ghost"
              onClick={() => setStep((value) => value - 1)}
              className={cn(step === 0 && 'invisible')}
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back
            </Button>
            <Button type="submit" loading={update.isPending}>
              {isLast ? 'Finish setup' : 'Continue'}
              {!isLast && <ArrowRight className="size-4" aria-hidden="true" />}
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
