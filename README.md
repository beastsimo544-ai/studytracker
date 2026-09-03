# StudyTracker

StudyTracker is a responsive web application that helps students track their study time, organize subjects, monitor progress, and build consistent study habits.

## Live Demo

https://studytracker-e2vs.vercel.app

## Features

- Email and password authentication
- Personal user accounts
- Create, rename, and delete subjects
- Study timer with Start, Pause, Reset, and Finish controls
- Timer state survives page refreshes
- Study sessions saved to the database
- Study history
- Edit and delete previous sessions
- Dashboard with:
  - Study time today
  - Study time this week
  - Study time this month
  - Daily study average
  - Current study streak
  - Longest study streak
  - Custom daily study goal
  - Weekly study chart
  - Monthly study calendar
  - Study time by subject
  - Recent study sessions
- Responsive design for desktop and mobile
- User data protected with Supabase Row Level Security (RLS)

## Tech Stack

- **Next.js**
- **React**
- **TypeScript**
- **Tailwind CSS**
- **Supabase**
  - Authentication
  - PostgreSQL database
  - Row Level Security
- **Vercel** for deployment

## How It Works

1. Create an account and sign in.
2. Add the subjects you want to study.
3. Select a subject and start the study timer.
4. Pause or resume the timer whenever needed.
5. Finish the session to save it.
6. View previous sessions in History.
7. Use the Dashboard to monitor your study progress and consistency.

## Running Locally

Clone the repository:

```bash
git clone https://github.com/beastsimo544-ai/studytracker.git
cd studytracker
```

Install dependencies:

```bash
npm install
```

Create a `.env.local` file and add your Supabase environment variables:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Run the development server:

```bash
npm run dev
```

Then open:

```text
http://localhost:3000
```

## Security

StudyTracker uses Supabase authentication and Row Level Security policies so authenticated users can only access their own study data.

Sensitive Supabase server-side credentials should never be committed to the repository.

## Future Improvements

Possible future improvements include:

- Custom domain and production SMTP
- Friends and study groups
- Live study status with friends
- Notifications and reminders
- Achievements and gamification
- More detailed statistics
- Native mobile application
- Additional account/profile settings

## Status

**MVP completed and deployed.**

The current version supports the complete core flow from account creation to tracking study sessions and reviewing study progress.