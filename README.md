# Fenice Agri-Market USSD Application

A USSD (Unstructured Supplementary Service Data) application for an agricultural marketplace that enables farmers and traders to check market prices and sell produce via simple text-based interactions.

## Overview

Fenice Agri-Market USSD provides a lightweight, accessible way for users to:
- Check current market prices for common crops (beans, maize, soya)
- Browse available market hubs across different regions
- Sell produce through the platform

The application is built with Node.js/Express and integrates with **Africa's Talking** USSD gateway for seamless mobile access.

## Features

- **Market Price Checking**: Real-time crop pricing information
- **Regional Hubs**: Access to market locations (Lilongwe, Blantyre, Zomba, Mzuzu)
- **Session Management**: In-memory session handling for multi-step USSD flows
- **Stateless Design**: Ready for production deployment with Redis integration

## Requirements

- Node.js 14+
- npm or yarn
- Africa's Talking account and API credentials
- Environment variables configuration

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd ussd-app
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory and add your Africa's Talking credentials:
```env
AFRICASTALKING_API_KEY=your_api_key
AFRICASTALKING_USERNAME=your_username
PORT=3000
```

## Running the Application

### Development Mode
```bash
npm run dev
```
The server will start with hot-reload enabled via Nodemon.

### Production Mode
```bash
node app.js
```

## API Endpoints

### POST /ussd
Receives USSD requests from Africa's Talking gateway.

**Request Body:**
```json
{
  "sessionId": "unique_session_identifier",
  "serviceCode": "service_code",
  "phoneNumber": "+265xxx",
  "text": "user_input"
}
```

**Response:**
- `CON` - Continue session (prompt for more input)
- `END` - End session

## Architecture

### Session Management
The application uses an in-memory session store (`sessionStore` object) to maintain user state across USSD interactions.

**For Production:**
Replace the in-memory store with Redis for stateless, scalable deployment:
```javascript
// Update sessionStore with Redis client for production
```

### Data Structure
- **CROP_PRICES**: Market prices for crops
- **HUBS**: Regional market locations
- **CROPS**: Available crop types
- **REGIONS**: Geographic regions

## Project Structure

```
ussd-app/
├── app.js              # Main application and routing logic
├── package.json        # Project dependencies and scripts
├── .env               # Environment variables (create this)
└── README.md          # This file
```

## Dependencies

- **express**: Web framework for Node.js
- **africastalking**: Africa's Talking API SDK
- **dotenv**: Environment variable management
- **body-parser**: Request body parsing middleware
- **mongoose**: MongoDB ODM (for future database integration)
- **nodemon**: Development server auto-reload

## Development

### Scripts
- `npm run dev` - Start development server with hot-reload
- `npm test` - Run tests (to be implemented)

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `AFRICASTALKING_API_KEY` | Your Africa's Talking API key | Required |
| `AFRICASTALKING_USERNAME` | Your Africa's Talking username | Required |
| `PORT` | Server port | 3000 |

## Future Enhancements

- Database integration (MongoDB via Mongoose)
- User authentication and profiles
- Real-time price updates
- Order management system
- Payment integration
- Admin dashboard

## Notes

- Current session store is in-memory; switch to Redis for production deployment
- The application follows the Africa's Talking USSD gateway webhook format
- USSD navigation uses asterisk-separated input segments (e.g., "2*1*1*45")

## License

ISC

## Support

For issues or questions, please refer to the Africa's Talking documentation or contact the development team.
