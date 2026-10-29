// Guided demo tours. Text is plain language and contains no records: every name shown on screen is fictional seed data.
// Each step opens on one page; `target` (optional) is a data-tour anchor on that page to highlight.

export type TourRole = "provider" | "staff";
export type TourStep = { path: string; target?: string; title: string; body: string; points?: string[] };

// Welcome course (free) lesson 2 is the portal video. Fixed ids come from the demo seed.
const WELCOME_VIDEO = "/training/welcome/2ee4d7f3-81c2-541c-971a-530235f13630";

export const TOURS: Record<TourRole, { name: string; steps: TourStep[] }> = {
  provider: {
    name: "Provider tour",
    steps: [
      {
        path: "/dashboard",
        title: "Welcome to Maria's home page",
        body: "Maria is a host home provider. When she signs in, everything she has to do is on this one page. No hunting through emails, binders or two different websites.",
      },
      {
        path: "/dashboard",
        target: "attention",
        title: "What needs her first",
        body: "If Real Care sends a form back for a fix, it shows up here in red, at the top, with one button to fix it.",
      },
      {
        path: "/dashboard",
        target: "training-card",
        title: "Her training at a glance",
        body: "How many courses are done, when they're due, and one big button to keep going.",
        points: ["No sign-in sheets", "No emailed certificates", "No one keeping a spreadsheet by hand"],
      },
      {
        path: "/training",
        title: "All her training in one place",
        body: "Every course her role requires is listed here. Finished courses fold away so the ones left are on top. Courses work in English or Spanish, on a phone.",
        points: ["Required courses reopen by themselves each year on her own date", "Nobody has to re-enroll her"],
      },
      {
        path: "/training",
        target: "history",
        title: "Nothing is ever lost",
        body: "Every year is kept. Her full history and certificates stay here, even after the courses reopen. That's her transcript, ready for an audit.",
      },
      {
        path: WELCOME_VIDEO,
        title: "Videos play right here",
        body: "Real Care's training videos play inside the portal. The portal notices when she has watched to the end and checks the lesson off for her.",
        points: ["Quizzes are graded on the spot", "A certificate is made the moment she finishes"],
      },
      {
        path: "/programs",
        title: "Programs: one yearly package",
        body: "The All-Access Package opens every core course for 12 months. She can join or renew here in a minute. Renewing early never loses any days.",
      },
      {
        path: "/programs",
        target: "auto-renew",
        title: "Renew automatically, if she wants",
        body: "One switch. On: it renews by itself before it ends. Off: she gets reminders. It's her choice, and she can change it any time.",
      },
      {
        path: "/forms",
        title: "Forms, without the paperwork",
        body: "Log notes, timesheets, drills and incident reports are filled in on her phone. The forms Real Care assigns show up here with due dates.",
        points: ["Drafts save as she types", "Hours add themselves up", "Real Care gets it the moment she taps Send"],
      },
      {
        path: "/documents",
        target: "upload",
        title: "Upload documents from a phone",
        body: "Licenses, certificates and receipts: snap a photo and send. Staff accept it or send it back with a note.",
      },
      {
        path: "/messages",
        title: "Talk to Real Care staff",
        body: "A private message thread with the office. No lost texts or voicemails. She gets a notice when staff reply.",
      },
      {
        path: "/dashboard",
        title: "That's the provider side",
        body: "Training, programs, forms, documents and messages, in one place, on her phone, in English or Spanish. Want to see what Real Care staff see?",
      },
    ],
  },
  staff: {
    name: "Staff tour",
    steps: [
      {
        path: "/admin",
        title: "Welcome to the staff console",
        body: "This is what Real Care staff see. Dana starts each day here. Everything that needs a person is counted at the top.",
      },
      {
        path: "/admin",
        target: "tiles",
        title: "Today, in five numbers",
        body: "Forms waiting, incident reports, overdue training, training due soon, and unanswered messages. Each number opens the list behind it.",
      },
      {
        path: "/admin",
        target: "renewal",
        title: "Annual renewal runs itself",
        body: "Every night the portal opens each provider's next training year on their own date and sends their reminders. Staff don't touch it.",
        points: ["Nothing is deleted", "Last year stays on the transcript"],
      },
      {
        path: "/admin/providers",
        target: "bulk",
        title: "Bulk actions: do it once, for everyone",
        body: "Tick the providers, then one click. Send a reminder to everyone who's behind, set a new due date for a whole group, or open a new training year for many people at once.",
        points: ["What used to be 30 emails is one click", "Filter by status or provider type first"],
      },
      {
        path: "/admin/forms",
        target: "assign",
        title: "Assign a form to many providers",
        body: "Pick a form, pick the providers, pick a due date, and choose to repeat it every week or month. The portal makes each new copy on time, by itself.",
      },
      {
        path: "/admin/review",
        title: "Review in one queue",
        body: "Every submitted form lands here, oldest first, incidents flagged. Accept it, or send it back with a note on the exact question that needs a fix.",
      },
      {
        path: "/admin/transcripts",
        target: "print-all",
        title: "Every transcript, one button",
        body: "All providers' training records, filtered by type or date range, printed in one batch. No more downloading CSV files course by course.",
      },
      {
        path: "/admin/programs",
        title: "Programs and payments",
        body: "Set what each yearly program includes and what it costs. See who's ending soon, and give a program at no charge when Real Care is paying.",
      },
      {
        path: "/admin/announcements",
        title: "One message to a whole group",
        body: "Post an announcement to all host homes, or to everyone. Each provider gets a notice. Pin it, or have it hide itself after a date.",
      },
      {
        path: "/admin/messages",
        title: "A shared inbox",
        body: "Every provider's messages in one place. Assign a conversation to a teammate, mark it waiting or closed, and see when the provider read it.",
      },
      {
        path: "/admin/reports",
        title: "Reports in seconds",
        body: "Training compliance, forms and payments, ready to download for an audit or a board meeting.",
      },
      {
        path: "/admin/audit",
        title: "Every action is recorded",
        body: "Who viewed, changed, accepted or downloaded what, and when. Private details never leave the portal, and emails only say that something is waiting.",
      },
      {
        path: "/admin",
        title: "That's the staff side",
        body: "Less copying, chasing and re-typing. The portal does the repeat work, so staff can spend their time on people. Want to see the provider side?",
      },
    ],
  },
};
