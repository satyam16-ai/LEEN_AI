import { zodResolver } from '@hookform/resolvers/zod';
import { useId, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';

import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  FormField,
  Input,
  Select,
  Textarea,
} from '@/components/ui';
import { GRADES, suggestedSubjects } from '@/features/profile/constants';
import { applyFieldErrors, getApiError } from '@/utils/apiError';

import { useCreateClass, useUpdateClass } from '../hooks/useClasses';
import { classFormValues, classSchema, toClassPayload } from '../schemas';

const SUBJECT_SUGGESTIONS = [...new Set([...suggestedSubjects(9), ...suggestedSubjects(12)])];

/** Create a class, or edit one when `classroom` is given. */
export function ClassFormDialog({ trigger, classroom, onSaved }) {
  const [open, setOpen] = useState(false);
  const [formError, setFormError] = useState(null);
  const listId = useId();
  const create = useCreateClass();
  const update = useUpdateClass(classroom?.id);
  const mutation = classroom ? update : create;
  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors },
  } = useForm({ resolver: zodResolver(classSchema), defaultValues: classFormValues(classroom) });

  const onOpenChange = (next) => {
    setOpen(next);
    if (next) {
      reset(classFormValues(classroom));
      setFormError(null);
    }
  };

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const saved = await mutation.mutateAsync(toClassPayload(values));
      toast.success(classroom ? 'Class updated' : `${saved.name} is ready — share the join code`);
      setOpen(false);
      onSaved?.(saved);
    } catch (error) {
      const apiError = getApiError(error);
      if (!applyFieldErrors(apiError.fieldErrors, setError)) setFormError(apiError.message);
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{classroom ? 'Edit class' : 'Create a class'}</DialogTitle>
          <DialogDescription>
            {classroom
              ? 'Update the details your students see.'
              : 'Students join with a code you share. You can change everything later.'}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {formError && <Alert variant="destructive">{formError}</Alert>}
          <FormField id="class-name" label="Class name" error={errors.name?.message}>
            <Input placeholder="e.g. 9-B Science" {...register('name')} />
          </FormField>
          <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
            <FormField id="class-subject" label="Subject" error={errors.subject?.message}>
              <Input placeholder="e.g. Science" list={listId} {...register('subject')} />
              <datalist id={listId}>
                {SUBJECT_SUGGESTIONS.map((subject) => (
                  <option key={subject} value={subject} />
                ))}
              </datalist>
            </FormField>
            <FormField id="class-grade" label="Class" error={errors.grade?.message}>
              <Select {...register('grade')}>
                <option value="">Any</option>
                {GRADES.map((grade) => (
                  <option key={grade} value={grade}>
                    Class {grade}
                  </option>
                ))}
              </Select>
            </FormField>
          </div>
          <FormField
            id="class-description"
            label="Description (optional)"
            error={errors.description?.message}
          >
            <Textarea
              placeholder="What will this class cover?"
              rows={3}
              {...register('description')}
            />
          </FormField>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" loading={mutation.isPending}>
              {classroom ? 'Save changes' : 'Create class'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
