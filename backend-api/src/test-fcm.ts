import { FCMService } from './services/fcm.service';
import prisma from './utils/prisma';

async function testFCM() {
  console.log('Initializing FCM...');
  FCMService.initialize();

  const usersWithTokens = await prisma.user_fcm_tokens.findMany({
    take: 1,
    include: {
      users: true,
    }
  });

  if (usersWithTokens.length === 0) {
    console.log('No users with FCM tokens found in the database. Cannot send a test notification.');
    process.exit(0);
  }

  const user = usersWithTokens[0].users;
  const userId = user.id;

  console.log(`Found user with token: ${user?.name || user?.email} (${userId})`);
  console.log('Sending test push notification...');

  await FCMService.sendPushToUser(
    userId,
    'Test Notification',
    'This is a test notification from the backend system.',
    { testId: '123' },
    'announcements'
  );

  console.log('Notification sent. Please check the logs above for success/failure.');
}

testFCM()
  .then(() => {
    // Adding a slight delay to allow logs to flush
    setTimeout(() => process.exit(0), 2000);
  })
  .catch(e => {
    console.error(e);
    process.exit(1);
  });
