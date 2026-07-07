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

// --- LOAD POWER MANAGEMENT DATA ---
const DISTRICTS = loadJsonData('districts.json');
const GROUPS = loadJsonData('groups.json');

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








// --- GET ALL DISTRICTS API ---
app.get('/districts', (req, res) => {
    res.json(DISTRICTS);
});

// --- GET ALL GROUPS AND THEIR SCHEDULES API ---
app.get('/groups', (req, res) => {
    res.json(GROUPS);
});

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
                    // View your schedule - Default to Group A (could be enhanced with user location detection)
                    const groupData = GROUPS['A'];
                    let scheduleInfo = `END Your Loadshedding Schedule:\nGroup A\n`;
                    groupData.schedule.forEach(time => {
                        scheduleInfo += `- ${time}\n`;
                    });
                    scheduleInfo += `Next rotation: Check daily`;
                    response = scheduleInfo;
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
                    // View full schedule - Fetch from GROUPS data
                    let fullSchedule = `END Full Loadshedding Schedule:\n`;
                    for (let groupKey in GROUPS) {
                        const groupData = GROUPS[groupKey];
                        fullSchedule += `Group ${groupKey}: ${groupData.schedule.join(', ')}\n`;
                    }
                    response = fullSchedule;
                    clearSession(sessionId);
                } else {
                    response = `END Invalid selection.`;
                    clearSession(sessionId);
                }
                break;

            case 3: // Handle search inputs
                const sessionData = getSession(sessionId);
                if (sessionData.action === 'search_location') {
                    const locationInput = textSegments[2].toLowerCase();
                    // Find district by name
                    let foundDistrict = null;
                    for (let key in DISTRICTS) {
                        if (DISTRICTS[key].name.toLowerCase() === locationInput) {
                            foundDistrict = DISTRICTS[key];
                            break;
                        }
                    }
                    
                    if (foundDistrict) {
                        const groupData = GROUPS[foundDistrict.group];
                        let scheduleInfo = `END Schedule for ${foundDistrict.name}:\n`;
                        scheduleInfo += `Group ${foundDistrict.group}\n`;
                        groupData.schedule.forEach(time => {
                            scheduleInfo += `- ${time}\n`;
                        });
                        scheduleInfo += `Last updated: Today`;
                        response = scheduleInfo;
                    } else {
                        response = `END Location not found.`;
                    }
                    clearSession(sessionId);
                } else if (sessionData.action === 'search_group') {
                    const groupInput = textSegments[2].toUpperCase();
                    if (GROUPS[groupInput]) {
                        const groupData = GROUPS[groupInput];
                        let scheduleInfo = `END Group ${groupInput} Schedule:\n`;
                        groupData.schedule.forEach(time => {
                            scheduleInfo += `- ${time}\n`;
                        });
                        scheduleInfo += `Next slot: Check daily`;
                        response = scheduleInfo;
                    } else {
                        response = `END Invalid group. Use A, B, C, or D.`;
                    }
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
                    // View by district - Build list from DISTRICTS data
                    let districtOptions = `CON Select district:`;
                    Object.keys(DISTRICTS).forEach(key => {
                        districtOptions += `\n${key}. ${DISTRICTS[key].name}`;
                    });
                    districtOptions += `\n0. Back`;
                    response = districtOptions;
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
                    const districtCode = textSegments[2];
                    if (districtCode === '0') {
                        response = `CON Power Outages:\n1. My outages\n2. View by district\n3. View today's schedule\n4. View all schedule\n0. Back`;
                    } else if (DISTRICTS[districtCode]) {
                        const district = DISTRICTS[districtCode];
                        let outageInfo = `END Outages in ${district.name}:\n`;
                        district.outageSchedule.forEach(schedule => {
                            outageInfo += `- ${schedule}\n`;
                        });
                        outageInfo += `Average duration: ${district.averageDuration}`;
                        response = outageInfo;
                    } else {
                        response = `END Invalid district selection.`;
                    }
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
    } else {
        response = `END Option not recognized.`;
        clearSession(sessionId);
    }

    // Set the response header type precisely to text/plain as expected by USSD gateways
    res.set('Content-Type', 'text/plain');
    res.send(response);
});



// Start Server Configuration
const PORT = process.env.PORT || 8000;
const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;

if (process.env.NODE_ENV !== 'test' && !process.env.VERCEL && isDirectRun) {
    app.listen(PORT, () => {
        console.log(`USSD Engine operating seamlessly on system port ${PORT}`);
    });
}

export { app };
export default app;