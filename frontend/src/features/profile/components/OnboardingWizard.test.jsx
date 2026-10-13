import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { profileService } from '@/services/profileService';
import { renderRoutes } from '@/test/renderWithProviders';

import { OnboardingWizard } from './OnboardingWizard';

vi.mock('@/services/profileService', () => ({ profileService: { update: vi.fn() } }));

const emptyProfile = {
  grade: null,
  board: null,
  school_name: null,
  subjects: [],
  learning_level: null,
  preferred_language: 'en',
  is_complete: false,
};

function renderWizard() {
  return renderRoutes(
    [
      { path: '/student/onboarding', element: <OnboardingWizard profile={emptyProfile} /> },
      { path: '/student', element: <p>Student home</p> },
    ],
    { path: '/student/onboarding' }
  );
}

describe('OnboardingWizard', () => {
  it('validates each step before moving on', async () => {
    const user = userEvent.setup();
    renderWizard();

    await user.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Choose your class')).toBeInTheDocument();
    expect(screen.getByText('Choose your board')).toBeInTheDocument();
    expect(screen.getByText('Step 1 of 3')).toBeInTheDocument();
  });

  it('collects all steps and saves the profile', async () => {
    const user = userEvent.setup();
    profileService.update.mockResolvedValue({
      user: { id: '1', name: 'Asha', role: 'student' },
      student_profile: { ...emptyProfile, is_complete: true },
    });
    renderWizard();

    await user.click(screen.getByRole('radio', { name: '9' }));
    await user.selectOptions(screen.getByLabelText('Board'), 'cbse');
    await user.type(screen.getByLabelText('School (optional)'), 'DPS');
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.click(await screen.findByRole('button', { name: 'Mathematics' }));
    await user.click(screen.getByRole('button', { name: 'Continue' }));

    await user.click(await screen.findByRole('radio', { name: /Intermediate/ }));
    await user.click(screen.getByRole('button', { name: 'Finish setup' }));

    expect(await screen.findByText('Student home')).toBeInTheDocument();
    expect(profileService.update.mock.calls[0][0]).toEqual({
      grade: 9,
      board: 'cbse',
      school_name: 'DPS',
      subjects: ['Mathematics'],
      learning_level: 'intermediate',
      preferred_language: 'en',
    });
  });
});
