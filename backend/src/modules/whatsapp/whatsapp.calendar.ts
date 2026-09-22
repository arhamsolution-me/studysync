/**
 * WhatsApp Academic Calendar & Schedule Formatter
 * Formats upcoming quizzes, assignments, weekly day-wise schedule,
 * and semester overview into a clean, rich WhatsApp layout.
 */

export function buildWhatsAppCalendarMessage(
  allTasks: any[],
  courses: any[],
  now: Date = new Date()
): string {
  const pendingTasks = allTasks
    .filter((t) => t.status !== 'done')
    .sort((a, b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());

  const doneTasks = allTasks.filter((t) => t.status === 'done');

  if (allTasks.length === 0) {
    return (
      `📅 *STUDYSYNC ACADEMIC CALENDAR*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `🎉 *No tasks or quizzes scheduled yet!*\n\n` +
      `Your academic calendar is completely clear.\n\n` +
      `📚 *Enrolled Courses (${courses.length}):*\n` +
      (courses.length > 0
        ? courses.map((c: any, i: number) => `  ${i + 1}. *${c.name}*`).join('\n')
        : `  • No courses registered yet.`) +
      `\n\n💡 _Tip: You can schedule quizzes or assignments anytime right here in WhatsApp!_\n` +
      `_Example: "Kal 5 baje OS ka quiz ha" or "5 din baad assignment ha"_`
    );
  }

  // ─── 1. Separate Quizzes & Assignments ─────────────────────────
  const quizzes = pendingTasks.filter(
    (t) => t.type === 'quiz' || t.type === 'exam' || t.type === 'test'
  );
  const assignments = pendingTasks.filter(
    (t) =>
      t.type === 'assignment' ||
      t.type === 'project' ||
      t.type === 'homework' ||
      t.type === 'lab'
  );
  const others = pendingTasks.filter(
    (t) => !quizzes.includes(t) && !assignments.includes(t)
  );

  // Helper for human countdown
  const getCountdown = (deadlineDate: Date) => {
    const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const targetMidnight = new Date(
      deadlineDate.getFullYear(),
      deadlineDate.getMonth(),
      deadlineDate.getDate()
    ).getTime();
    const diffDays = Math.round((targetMidnight - todayMidnight) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return '⚠️ *Overdue!*';
    } else if (diffDays === 0) {
      return '⏳ *Due Today!*';
    } else if (diffDays === 1) {
      return '⏳ *Tomorrow!* (1 day left)';
    } else {
      return `⏳ *${diffDays} days remaining*`;
    }
  };

  const formatTaskDate = (d: Date) => {
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });
  };

  let msg = `📅 *STUDYSYNC ACADEMIC CALENDAR*\n`;
  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

  // ─── 2. UPCOMING QUIZZES ────────────────────────────────────────
  msg += `🔴 *UPCOMING QUIZZES & EXAMS:*\n`;
  if (quizzes.length === 0) {
    msg += `• _No pending quizzes scheduled._\n\n`;
  } else {
    quizzes.forEach((q, i) => {
      const dl = new Date(q.deadline);
      const countdown = getCountdown(dl);
      const prio = q.priority ? `[${q.priority.toUpperCase()}]` : '';
      msg += `${i + 1}. *${q.title}*\n`;
      msg += `   📚 Subject: *${q.subject || 'General'}*\n`;
      msg += `   🗓️ Day: *${formatTaskDate(dl)}*\n`;
      msg += `   ${countdown} ${prio}\n\n`;
    });
  }

  // ─── 3. UPCOMING ASSIGNMENTS ────────────────────────────────────
  msg += `📋 *UPCOMING ASSIGNMENTS & PROJECTS:*\n`;
  if (assignments.length === 0) {
    msg += `• _No pending assignments scheduled._\n\n`;
  } else {
    assignments.forEach((a, i) => {
      const dl = new Date(a.deadline);
      const countdown = getCountdown(dl);
      const prio = a.priority ? `[${a.priority.toUpperCase()}]` : '';
      msg += `${i + 1}. *${a.title}*\n`;
      msg += `   📚 Subject: *${a.subject || 'General'}*\n`;
      msg += `   🗓️ Day: *${formatTaskDate(dl)}*\n`;
      msg += `   ${countdown} ${prio}\n\n`;
    });
  }

  // If there are other tasks
  if (others.length > 0) {
    msg += `📌 *OTHER TASKS:*\n`;
    others.forEach((o, i) => {
      const dl = new Date(o.deadline);
      const countdown = getCountdown(dl);
      msg += `${i + 1}. *${o.title}* (${o.subject || 'General'})\n`;
      msg += `   🗓️ Day: *${formatTaskDate(dl)}* | ${countdown}\n\n`;
    });
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  // ─── 4. WEEKLY / DAY-WISE BREAKDOWN ─────────────────────────────
  msg += `🗓️ *WEEKLY SCHEDULE (Day-Wise Breakdown)*\n\n`;

  // Group pending tasks by day for the next 7 days
  const sevenDaysAhead = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 7, 23, 59, 59).getTime();
  const thisWeekTasks = pendingTasks.filter((t) => new Date(t.deadline).getTime() <= sevenDaysAhead);
  const laterTasks = pendingTasks.filter((t) => new Date(t.deadline).getTime() > sevenDaysAhead);

  if (thisWeekTasks.length === 0) {
    msg += `• _No deadlines scheduled for the next 7 days._ 🎉\n\n`;
  } else {
    // Map tasks by date string
    const dayGroups: Record<string, { label: string; tasks: any[] }> = {};

    thisWeekTasks.forEach((t) => {
      const d = new Date(t.deadline);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

      if (!dayGroups[key]) {
        const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
        const tomorrowKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;

        const dayName = d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        let badge = '';
        if (key === todayKey) badge = ' (Today)';
        else if (key === tomorrowKey) badge = ' (Tomorrow)';

        dayGroups[key] = { label: `${dayName}${badge}`, tasks: [] };
      }
      dayGroups[key].tasks.push(t);
    });

    Object.keys(dayGroups)
      .sort()
      .forEach((dateKey) => {
        const group = dayGroups[dateKey];
        msg += `📌 *${group.label}:*\n`;
        group.tasks.forEach((t) => {
          const d = new Date(t.deadline);
          const icon = t.type === 'quiz' || t.type === 'exam' ? '🔴' : '📋';
          msg += `   ${icon} *${t.title}* [${t.subject || 'General'}] — ${getCountdown(d)}\n`;
        });
        msg += `\n`;
      });
  }

  // If there are tasks further out in the semester
  if (laterTasks.length > 0) {
    msg += `📆 *Later in the Semester (Upcoming Weeks):*\n`;
    laterTasks.forEach((t) => {
      const d = new Date(t.deadline);
      const icon = t.type === 'quiz' || t.type === 'exam' ? '🔴' : '📋';
      msg += `   ${icon} *${t.title}* [${t.subject || 'General'}] — ${formatTaskDate(d)} (${getCountdown(d)})\n`;
    });
    msg += `\n`;
  }

  msg += `━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  // ─── 5. SEMESTER OVERVIEW & PROGRESS ───────────────────────────
  const totalTasks = allTasks.length;
  const doneCount = doneTasks.length;
  const pendingCount = pendingTasks.length;
  const percentage = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

  const totalBars = 10;
  const filledBars = Math.round((percentage / 100) * totalBars);
  const progressBar = '█'.repeat(filledBars) + '░'.repeat(totalBars - filledBars);

  const totalQuizzes = allTasks.filter((t) => t.type === 'quiz' || t.type === 'exam').length;
  const doneQuizzes = doneTasks.filter((t) => t.type === 'quiz' || t.type === 'exam').length;
  const pendingQuizzes = totalQuizzes - doneQuizzes;

  const totalAssignments = allTasks.filter((t) => t.type === 'assignment' || t.type === 'project').length;
  const doneAssignments = doneTasks.filter((t) => t.type === 'assignment' || t.type === 'project').length;
  const pendingAssignments = totalAssignments - doneAssignments;

  msg += `📊 *SEMESTER OVERVIEW*\n`;
  msg += `• 📚 Active Courses: *${courses.length}*\n`;
  msg += `• 📈 Progress: [${progressBar}] *${percentage}%*\n`;
  msg += `   (${doneCount} Completed / ${pendingCount} Pending)\n`;
  msg += `• 🔴 Quizzes: *${pendingQuizzes} pending* (${doneQuizzes} completed)\n`;
  msg += `• 📋 Assignments: *${pendingAssignments} pending* (${doneAssignments} completed)\n`;

  if (pendingTasks[0]) {
    const nextT = pendingTasks[0];
    const nextDl = new Date(nextT.deadline);
    msg += `• ⚡ Nearest Deadline: *${nextT.title}* (${getCountdown(nextDl)})\n`;
  }

  msg += `\n━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
  msg += `🔔 _Automatic 24-hour & 12-hour proactive WhatsApp reminders armed!_\n`;
  msg += `💬 _Reply with "Course <Name>" to study with your course AI!_`;

  return msg;
}
