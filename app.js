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


//--Get APP ROUTE FOR TESTING THE APIs

//DEFINING THE URLS FOR THE THE APIS
const SALES_URL='/sales';
const CROP_URL='/crops';
const PRICE_URL='/prices';
const REGION_URL='/regions';
const HUBS_URL='/hubs';



// Viewing the  details of the sales

app.get(SALES_URL,(req,res)=>{

    console.log('Visiting url at 127.0.0.1:8000'+SALES_URL);
    console.log(req.query)
    res.send(req.query.id);
    
    
});

//View the details of the crops 
app.get("/crops",(req,res)=>{
    console.log('Visiting url at 127.0.0.1:8000'+CROP_URL);
    
    res.send(CROPS)
})

//View the details of the prices
app.get('/prices',(req,res)=>{
    console.log('Visiting url at 127.0.0.1:8000'+PRICE_URL);
    res.send(CROP_PRICES)
})


//View the details of the region
app.get(REGION_URL,(req,res)=>{
    console.log('Visiting url at 127.0.0.1:8000'+REGION_URL_URL);
    res.send(REGIONS)
})

//View the details of the hub
app.get(HUBS_URL,(req,res)=>{
    console.log('Visiting url at 127.0.0.1:8000'+HUBS_URL);
    res.send(HUBS)
})



// --- MAIN USSD ROUTE ---
app.post('/ussd', (req, res) => {

    // Read parameters sent from the gateway webhook (Africa's Talking format)
    const { sessionId, serviceCode, phoneNumber, text } = req.body;

    let response = "";

    // The text variable contains accumulated inputs separated by asterisks ("1*2*3")
    // If it's empty, the user just dialed the root shortcode.
    const textSegments = text ? text.split('*') : [];
    const stepCount = textSegments.length;

    // Fetch or initialize session memory
    let currentSession = getSession(sessionId);

    // ROOT MENU
    if (stepCount === 0) {
        response = `CON Power Management\n1. Check Loadshedding\n2. Check Power Outages`;
    } 
    

    // --- PATH 1: CHECK LOADSHEDDING ---
    else if (textSegments[0] === '1') {
        switch (stepCount) {
            case 1: // Show Loadshedding Options
                response = `CON Loadshedding Options:\n1. View your schedule\n2. Search location\n3. Search group\n4. View full schedule\n0. Back`;
                break;

            case 2: // Handle Loadshedding Sub-options
                const loadsheddingOption = textSegments[1];
                if (loadsheddingOption === '0') {
                    response = `CON Power Management\n1. Check Loadshedding\n2. Check Power Outages`;
                } else if (loadsheddingOption === '1') {
                    // View your schedule
                    saveSession(sessionId, { action: 'view_schedule' });
                    response = `END Your Loadshedding Schedule:\nGroup A - Monday 2-4 PM\nGroup A - Wednesday 6-8 PM\nNext rotation: Friday 10 AM-12 PM`;
                    clearSession(sessionId);
                } else if (loadsheddingOption === '2') {
                    // Search location
                    response = `CON Enter location name:`;
                    saveSession(sessionId, { action: 'search_location' });
                } else if (loadsheddingOption === '3') {
                    // Search group
                    response = `CON Enter your group (A/B/C/D):`;
                    saveSession(sessionId, { action: 'search_group' });
                } else if (loadsheddingOption === '4') {
                    // View full schedule
                    response = `END Full Loadshedding Schedule:\nGroup A: Mon 2-4 PM, Wed 6-8 PM\nGroup B: Tue 2-4 PM, Thu 6-8 PM\nGroup C: Wed 2-4 PM, Fri 6-8 PM\nGroup D: Thu 2-4 PM, Sat 6-8 PM`;
                    clearSession(sessionId);
                } else {
                    response = `END Invalid selection.`;
                    clearSession(sessionId);
                }
                break;

            case 3: // Handle search inputs
                const sessionData = getSession(sessionId);
                if (sessionData.action === 'search_location') {
                    const location = textSegments[2];
                    response = `END Schedule for ${location}:\nGroup B - Tuesday 2-4 PM\nGroup B - Thursday 6-8 PM\nLast updated: Today`;
                    clearSession(sessionId);
                } else if (sessionData.action === 'search_group') {
                    const group = textSegments[2];
                    response = `END Group ${group} Schedule:\nMonday 2-4 PM\nWednesday 6-8 PM\nNext slot: Friday 10 AM-12 PM`;
                    clearSession(sessionId);
                } else {
                    response = `END Invalid action.`;
                    clearSession(sessionId);
                }
                break;

            default:
                response = `END Invalid state routing.`;
                clearSession(sessionId);
                break;
        }
    } 
    
    // --- PATH 2: CHECK POWER OUTAGES ---
    else if (textSegments[0] === '2') {
        switch (stepCount) {
            case 1: // Show Power Outage Options
                response = `CON Power Outages:\n1. My outages\n2. View by district\n3. View today's schedule\n4. View all schedule\n0. Back`;
                break;

            case 2: // Handle Power Outage Sub-options
                const outageOption = textSegments[1];
                if (outageOption === '0') {
                    response = `CON Power Management\n1. Check Loadshedding\n2. Check Power Outages`;
                } else if (outageOption === '1') {
                    // My outages
                    response = `END Your Recent Outages:\n- Jan 15: 4 hours\n- Jan 10: 3 hours\nTotal this month: 7 hours`;
                    clearSession(sessionId);
                } else if (outageOption === '2') {
                    // View by district
                    response = `CON Select district:\n1. Lilongwe\n2. Blantyre\n3. Zomba\n0. Back`;
                    saveSession(sessionId, { action: 'view_district' });
                } else if (outageOption === '3') {
                    // View today's schedule
                    response = `END Today's Outages:\n6:00 AM - 8:00 AM (Area A)\n2:00 PM - 4:00 PM (Area B)\n8:00 PM - 10:00 PM (Area C)`;
                    clearSession(sessionId);
                } else if (outageOption === '4') {
                    // View all schedule
                    response = `END Full Outage Schedule:\nWeek 1: 15 hours total\nWeek 2: 12 hours total\nWeek 3: 18 hours total`;
                    clearSession(sessionId);
                } else {
                    response = `END Invalid selection.`;
                    clearSession(sessionId);
                }
                break;

            case 3: // Handle district selection
                const sessionDataPower = getSession(sessionId);
                if (sessionDataPower.action === 'view_district') {
                    const district = textSegments[2];
                    const districtNames = { '1': 'Lilongwe', '2': 'Blantyre', '3': 'Zomba' };
                    if (districtNames[district]) {
                        response = `END Outages in ${districtNames[district]}:\n- Monday 2-4 PM\n- Wednesday 6-8 PM\nAverage duration: 2 hours`;
                        clearSession(sessionId);
                    } else {
                        response = `END Invalid district.`;
                        clearSession(sessionId);
                    }
                } else {
                    response = `END Invalid action.`;
                    clearSession(sessionId);
                }
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
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL && isDirectRun) {
    app.listen(PORT, () => {
        console.log(`USSD Engine operating seamlessly on system port ${PORT}`);
    });
}

export { app, appendMockSale, readMockSales, writeMockSales };
export default app;