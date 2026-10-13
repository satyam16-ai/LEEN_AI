import { Controller, useWatch } from 'react-hook-form';

import { ChoiceGroup, FormField, Input, Label, Select } from '@/components/ui';

import { BOARDS, GRADES, LANGUAGES, LEVELS } from '../constants';
import { SubjectPicker } from './SubjectPicker';

const GRADE_OPTIONS = GRADES.map((grade) => ({ value: grade, label: String(grade) }));

/** Student learning-profile inputs; `sections` lets the onboarding wizard show them in steps. */
export function LearningProfileFields({
  control,
  register,
  errors,
  sections = ['study', 'subjects', 'style'],
}) {
  const grade = useWatch({ control, name: 'grade' });

  return (
    <div className="space-y-7">
      {sections.includes('study') && (
        <>
          <Controller
            control={control}
            name="grade"
            render={({ field }) => (
              <ChoiceGroup
                label="Which class are you in?"
                variant="pill"
                options={GRADE_OPTIONS}
                value={field.value}
                onChange={field.onChange}
                error={errors.grade?.message}
                className="grid-cols-6 sm:grid-cols-12"
              />
            )}
          />
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField id="profile-board" label="Board" error={errors.board?.message}>
              <Controller
                control={control}
                name="board"
                render={({ field }) => (
                  <Select
                    value={field.value ?? ''}
                    onChange={(event) => field.onChange(event.target.value || undefined)}
                    onBlur={field.onBlur}
                  >
                    <option value="" disabled>
                      Select a board
                    </option>
                    {BOARDS.map((board) => (
                      <option key={board.value} value={board.value}>
                        {board.label}
                      </option>
                    ))}
                  </Select>
                )}
              />
            </FormField>
            <FormField
              id="profile-school"
              label="School (optional)"
              error={errors.school_name?.message}
            >
              <Input placeholder="e.g. Delhi Public School" {...register('school_name')} />
            </FormField>
          </div>
        </>
      )}

      {sections.includes('subjects') && (
        <div className="space-y-3">
          <Label>Which subjects do you want help with?</Label>
          <Controller
            control={control}
            name="subjects"
            render={({ field }) => (
              <SubjectPicker
                value={field.value}
                onChange={field.onChange}
                grade={grade}
                error={errors.subjects?.message}
              />
            )}
          />
        </div>
      )}

      {sections.includes('style') && (
        <>
          <Controller
            control={control}
            name="learning_level"
            render={({ field }) => (
              <ChoiceGroup
                label="How confident do you feel in your studies?"
                options={LEVELS}
                value={field.value}
                onChange={field.onChange}
                error={errors.learning_level?.message}
                className="md:grid-cols-3"
              />
            )}
          />
          <Controller
            control={control}
            name="preferred_language"
            render={({ field }) => (
              <ChoiceGroup
                label="Preferred language for explanations"
                variant="pill"
                options={LANGUAGES}
                value={field.value}
                onChange={field.onChange}
                className="max-w-sm grid-cols-2"
              />
            )}
          />
        </>
      )}
    </div>
  );
}
