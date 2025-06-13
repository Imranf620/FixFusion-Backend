import fetch from 'node-fetch';

export const sendPushNotification = async (expoPushToken, title, body) => {
  try {
    const message = {
      to: expoPushToken,
      sound: 'default',
      title,
      body,
      data: { screen: 'JobDetails' } // optional navigation data
    };

    const response = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });

    const result = await response.json();
    console.log('📲 Notification Sent:', result);
  } catch (error) {
    console.error('❌ Failed to send push notification:', error);
  }
};
