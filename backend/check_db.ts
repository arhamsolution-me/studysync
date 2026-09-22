import prisma from './src/config/database';

async function check() {
  const tasks = await (prisma as any).task.findMany({});
  console.log('TASKS COUNT:', tasks.length);
  console.log('TASKS:', JSON.stringify(tasks, null, 2));

  const reminders = await (prisma as any).reminder.findMany({});
  console.log('REMINDERS COUNT:', reminders.length);
  console.log('REMINDERS:', JSON.stringify(reminders, null, 2));
}

check().catch(console.error);
