import dotenv from 'dotenv';
import africastalking from 'africastalking';

dotenv.config();

// Set your Africa's Talking credentials
const credentials = {
    apiKey: process.env.AT_API_KEY || 'YOUR_API_KEY',
    username: process.env.AT_USERNAME || 'YOUR_USERNAME',
};

if (!credentials.apiKey || !credentials.username || credentials.apiKey === 'YOUR_API_KEY' || credentials.username === 'YOUR_USERNAME') {
    console.error('ERROR: Missing Africa\'s Talking credentials.');
    console.error('Set AT_API_KEY and AT_USERNAME in your environment before running this app.');
    console.error('For sandbox use username=sandbox and your sandbox API key.');
    process.exit(1);
}

// Initialize the SDK
const AfricasTalking = africastalking(credentials);

// Get the SMS service
const sms = AfricasTalking.SMS;

function sendMessage() {
    const options = {
        to: ['+265987974442'],
        message: "I am testing the Africa's Talking SMS API",
        // You are only eligible to send messages and receive messages from the Africa's Talking sandbox number if you are using the sandbox environment.
        // NOTE: Use 'from' only if you have a registered SenderId with Africa's Talking
        // from: 'FENICE',
    };


// This section is for the approve and system log if the code has 
//worked finally
    sms.send(options)
        .then((response) => {
            console.log('SMS sent successfully:');
            console.log(JSON.stringify(response, null, 2));
        })
        .catch((error) => {
            console.error('SMS send failed:');
            if (error.response) {
                console.error('Status:', error.response.status);
                console.error('Data:', error.response.data);
            } else {
                console.error(error.message);
            }
        });
}

sendMessage();