import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loadJsonData = (fileName) => {
    const filePath = path.join(__dirname, 'data', fileName);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const SALES_DATA_FILE = path.join(__dirname, 'data', 'mock-sales.json');

const ensureSalesFile = (filePath = SALES_DATA_FILE) => {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, '[]', 'utf8');
    }
};

const readMockSales = (filePath = SALES_DATA_FILE) => {
    ensureSalesFile(filePath);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const writeMockSales = (sales, filePath = SALES_DATA_FILE) => {
    ensureSalesFile(filePath);
    fs.writeFileSync(filePath, JSON.stringify(sales, null, 2), 'utf8');
    return sales;
};

const appendMockSale = (sale, filePath = SALES_DATA_FILE) => {
    const sales = readMockSales(filePath);
    const updatedSales = [...sales, sale];
    return writeMockSales(updatedSales, filePath);
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- MOCK IN-MEMORY REDIS REPLACEMENT ---
// In production, swap this object out for a real Redis store to maintain statelessness across servers.
const sessionStore = {};

const saveSession = (sessionId, data) => {
    sessionStore[sessionId] = { ...sessionStore[sessionId], ...data };
};

const getSession = (sessionId) => sessionStore[sessionId] || {};

const clearSession = (sessionId) => {
    delete sessionStore[sessionId];
};

// --- MOCK DATA LOADED FROM JSON FILES ---
const CROP_PRICES = loadJsonData('crop-prices.json');
const HUBS = loadJsonData('hubs.json');
const CROPS = loadJsonData('crops.json');
const REGIONS = loadJsonData('regions.json');
let MOCK_SALES = readMockSales();

// --- MAIN USSD ROUTE ---
app.post('/ussd', (req, res) => {
    // Read parameters sent from the gateway webhook (Africa's Talking format)
    const { sessionId, serviceCode, phoneNumber, text } = req.body;

    let response = "";

    // The text variable contains accumulated inputs separated by asterisks (e.g., "2*1*1*45")
    // If it's empty, the user just dialed the root shortcode.
    const textSegments = text ? text.split('*') : [];
    const stepCount = textSegments.length;

    // Fetch or initialize session memory
    let currentSession = getSession(sessionId);

    // ROOT MENU
    if (stepCount === 0) {
        response = `CON Fenice Agri-Market\n1. Check Market Prices\n2. Sell Produce`;
    } 
    
    // --- PATH 1: CHECK MARKET PRICES ---
    else if (textSegments[0] === '1') {
        if (stepCount === 1) {
            response = `CON Select Hub:\n1. Lilongwe (Mitundu)\n2. Blantyre (Limbe)\n3. Zomba\n4. Mzuzu\n0. Back`;
        } else if (stepCount === 2) {
            const hubSelection = textSegments[1];
            
            if (hubSelection === '0') {
                // User chose Back -> Reset text tracking path back to root parameters
                response = `CON Fenice Agri-Market\n1. Check Market Prices\n2. Sell Produce`;
            } else if (HUBS[hubSelection]) {
                response = `END Current Prices/KG at ${HUBS[hubSelection]}:\n- Beans: ${CROP_PRICES.beans}\n- Maize: ${CROP_PRICES.maize}\n- Soya: ${CROP_PRICES.soya}\nPrices updated today 6 AM.`;
                clearSession(sessionId); // Housekeeping
            } else {
                response = `END Invalid selection. Session terminated.`;
                clearSession(sessionId);
            }
        }
    } 
    
    // --- PATH 2: SELL PRODUCE ---
    else if (textSegments[0] === '2') {
        switch (stepCount) {
            case 1: // Select Crop Type
                response = `CON What are you selling?\n1. Beans\n2. Maize\n3. Soya\n0. Back`;
                break;

            case 2: // Handle Crop Selection & Show Regions
                const cropSelection = textSegments[1];
                if (cropSelection === '0') {
                    response = `CON Fenice Agri-Market\n1. Check Market Prices\n2. Sell Produce`;
                } else if (CROPS[cropSelection]) {
                    saveSession(sessionId, { crop: CROPS[cropSelection] });
                    response = `CON Select your location:\n1. Central Region\n2. Southern Region\n3. Northern Region\n0. Back`;
                } else {
                    response = `END Invalid selection.`;
                    clearSession(sessionId);
                }
                break;

            case 3: // Handle Region Selection & Ask for Quantity
                const regionSelection = textSegments[2];
                if (regionSelection === '0') {
                    response = `CON What are you selling?\n1. Beans\n2. Maize\n3. Soya\n0. Back`;
                } else if (REGIONS[regionSelection]) {
                    saveSession(sessionId, { region: REGIONS[regionSelection] });
                    response = `CON Enter estimated quantity\n(In 50KG bags):`;
                } else {
                    response = `END Invalid selection.`;
                    clearSession(sessionId);
                }
                break;

            case 4: // Handle Quantity Input & Show Confirmation Screen
                const quantityInput = textSegments[3];
                // Lightweight numeric check
                if (!isNaN(quantityInput) && parseInt(quantityInput) > 0) {
                    saveSession(sessionId, { quantity: parseInt(quantityInput) });
                    
                    // Fetch state fields from our session memory
                    const sessionData = getSession(sessionId);

                    response = `CON Confirm Sale:\nCrop: ${sessionData.crop}\nLoc: ${sessionData.region}\nQty: ${quantityInput} Bags\n1. Confirm & Submit\n2. Cancel`;
                } else {
                    response = `END Invalid quantity format. Please type a valid number.`;
                    clearSession(sessionId);
                }
                break;

            case 5: // Process Submission or Cancellation
                const finalAction = textSegments[4];
                if (finalAction === '1') {
                    const sessionData = getSession(sessionId);

                    // --- ASYNC DESIGN PATTERN ---
                    // Fire background processes immediately without blocking the client response execution cycle.
                    processAgriSaleBackgroundJob(phoneNumber, sessionData)
                        .catch(err => console.error("Background job failed: ", err));

                    response = `END Request Logged!\nAgro-dealers in your area will contact you shortly via call or SMS. Thank you.`;
                } else {
                    response = `END Sale cancelled successfully.`;
                }
                clearSession(sessionId); // Clean up cache memory bucket
                break;

            default:
                response = `END Invalid state routing.`;
                clearSession(sessionId);
                break;
        }
    } else {
        response = `END Option not recognized.`;
        clearSession(sessionId);
    }

    // Set the response header type precisely to text/plain as expected by USSD gateways
    res.set('Content-Type', 'text/plain');
    res.send(response);
});

// --- ASYNCHRONOUS WORKER SIMULATION ---
async function processAgriSaleBackgroundJob(phone, data) {
    // Simulate web service API call or heavy DB write (~500ms lag)
    return new Promise((resolve) => {
        setTimeout(() => {
            const sale = {
                id: `sale-${Date.now()}`,
                phoneNumber: phone,
                crop: data.crop,
                region: data.region,
                quantity: data.quantity,
                status: 'pending',
                submittedAt: new Date().toISOString()
            };

            MOCK_SALES = appendMockSale(sale);
            console.log(`[Worker Sync Logged] -> Farmer Phone: ${phone} | Crop Type: ${data.crop} | Region Location: ${data.region} | Quantity Volume: ${data.quantity} Bags.`);
            // Here is where your fetch() payload calls to an external database microservice would execute
            resolve(true);
        }, 500);
    });
}

// Start Server Configuration
const PORT = process.env.PORT || 8000;
if (process.env.NODE_ENV !== 'test') {
    app.listen(PORT, () => {
        console.log(`USSD Engine operating seamlessly on system port ${PORT}`);
    });
}

export { app, appendMockSale, readMockSales, writeMockSales };