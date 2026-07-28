
import express from 'express';

export const createApiRouter = ({
    getDistricts,
    getGroups,
    getSession,
    saveSession,
    clearSession,
    getFaults,
    saveFault
}) => {

    // CREATION OF ROUTER OBJECT TO BE USED FOR PUBLISHING THE APIS
    const router = express.Router();



    // GET Requesting function returning response after entry of /districts
    router.get('/districts', (req, res) => {
        res.json(getDistricts());
    });



    // definition of the  fault categories to be used in the app
    const faultCategories = {
        '1': {
            label: 'No Power',
            options: [
                { key: '1', label: 'Single House' },
                { key: '2', label: 'Area' }
            ]
        },
        '2': {
            label: 'Meter Issues',
            options: [
                { key: '1', label: 'Connection error' },
                { key: '2', label: 'Token Validation errors' },
                { key: '3', label: 'Dead meter' },
                { key: '4', label: 'Meter locked' },
                { key: '5', label: 'Meter not deducting units' }
            ]
        },
        '3': {
            label: 'Hazardous Situations',
            options: [
                { key: '1', label: 'Fallen Powerlines' },
                { key: '2', label: 'Broken Transformers' },
                { key: '3', label: 'Vandalized Transformers' },
                { key: '4', label: 'Severe Sparking' },
                { key: '5', label: 'Electric Shocks' }
            ]
        },
        '4': {
            label: 'Voltage Issues',
            options: [
                { key: '1', label: 'Low Voltage' },
                { key: '2', label: 'High Voltage' },
                { key: '3', label: 'Voltage fluctuations' },
                { key: '4', label: 'Single Phase outage' },
                { key: '5', label: 'Unbalanced Voltage' }
            ]
        },
        '5': {
            label: 'Vandalism/Theft',
            options: [
                { key: '1', label: 'Transformer vandalism' },
                { key: '2', label: 'Overhead conductor theft' },
                { key: '3', label: 'Meter Tampering' },
                { key: '4', label: 'Earth system theft' },
                { key: '5', label: 'Pole cutting' }
            ]
        }
    };

    //END OF THE FAULT CATEGORIES



    // DEFINING getFAULTSROUTE FUNCTION THAT RETURNS ALL FAULTS
    const getFaultsRoute = async (req, res) => {
        try {
            const reports = await getFaults();
            res.json(reports);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    };



    // DEFINING FUNCTION THAT ADD FAULTS TO THE DATABASE URL
    const postFaultRoute = async (req, res) => {
        try {
            const payload = req.body || {};
            const report = {
                customer_name: payload.customer_name || '',
                phone: payload.phone || '',
                fault: payload.fault || '',
                location: payload.location || '',
                created_at: payload.created_at || new Date().toISOString()
            };

            const savedReport = await saveFaultReport(report);
            res.status(201).json(savedReport);
        } catch (error) {
            res.status(500).json({ message: error.message });
        }
    };


    //ROUTES AND FUNCTIONS BEING CALLED BY THE REQUEST AND CALLBACK 
    router.get('/faults', getFaultsRoute);
    router.post('/faults', postFaultRoute);
  
//DEFINITION OF THE FUNCTION THAT RETURNS  groups
    router.get('/groups', (req, res) => {
        res.json(getGroups());
    });


    //DEFITION OF THE FUNCTION THAT RETURNS  OUTAGES FROM ALL DISTRICTS
    router.get('/outages', (req, res) => {
        const outagesByDistrict = Object.values(getDistricts()).map((district) => ({
            id: district.id,
            name: district.name,
            region: district.region,
            group: district.group,
            outageSchedule: district.outageSchedule,
            averageDuration: district.averageDuration
        }));

        res.json(outagesByDistrict);
    });



    //DEFINITION OF THE ROUTER THAT RETURNS OUTAGE FOR SPECIFIC DISTRICTS
    router.get('/outages/:district', (req, res) => {

        const districtInput = req.params.district.toLowerCase(); // Getting inputs from the url and turning it to lowercases
        const districts = getDistricts(); // collecting districts to function which read all districts from the database

        const district = Object.values(districts).find((item) => {
            return item.name.toLowerCase() === districtInput || item.id === districtInput; //Either item name or id matching with the one which the user has entered it will return
        });

        if (!district) {
            return res.status(404).json({ message: 'District not found' }); // Function that responds with a message if the district is not found in the database
        }


        // Returning the district information in JSON format
        res.json({
            id: district.id,
            name: district.name,
            region: district.region,
            group: district.group,
            outageSchedule: district.outageSchedule,
            averageDuration: district.averageDuration
        });
    });



// Definition of the function which is used to  handle the ussd functions
 router.post('/ussd', async (req, res) => {
    const { sessionId, serviceCode, phoneNumber, text } = req.body; // \destructuring the request body to get the sessionId, serviceCode, phoneNumber and text from the request body
    let response = '';

    const textSegments = text ? text.split('*') : [];
    const stepCount = textSegments.length;

    const districts = getDistricts();
    const groups = getGroups();
    const sessionData = getSession(sessionId) || {}; // Getting the session data for the current sessionId

// Helper: Safely format schedule items from MongoDB documents
const formatSchedule = (scheduleArray) => {
    if (!Array.isArray(scheduleArray) || scheduleArray.length === 0) {
        return 'No scheduled outages recorded.\n';
    }
    return scheduleArray
        .map((item) => {
            if (item && typeof item === 'object') {
                // Handle plain objects or MongoDB document fields
                const day = item.day || 'Scheduled';
                const start = item.startTime || item.start || '';
                const end = item.endTime || item.end || '';

                if (start && end) {
                    return `- ${day}: ${start} - ${end}`;
                } else if (day) {
                    return `- ${day}`;
                }
            }
            return `- ${String(item)}`;
        })
        .join('\n') + '\n';
};


    // ==========================================
    // INITIAL MENU
    // ==========================================

    if (stepCount === 0 || text === '') {
        response = `CON Power Management\n1. Check Loadshedding\n2. Check Power Outages\n3. Report a Fault`;
    } 
    // ==========================================
    // OPTION 3: REPORT A FAULT
    // ==========================================
    else if (textSegments[0] === '3') {
        const currentAction = sessionData.action;

        if (!currentAction && stepCount === 1) {
            response = `CON Fault Report\nEnter your full name:`;
            saveSession(sessionId, { action: 'fault_name' });
        } else if (currentAction === 'fault_name' && stepCount === 2) {
            saveSession(sessionId, { action: 'fault_phone', customer_name: textSegments[1].trim() });
            response = `CON Fault Report\nEnter your phone number:`;
        } else if (currentAction === 'fault_phone' && stepCount === 3) {
            saveSession(sessionId, { action: 'fault_category', phone: textSegments[2].trim() });
            response = `CON Fault Report\nSelect fault category:\n1. No Power\n2. Meter Issues\n3. Hazardous Situations\n4. Voltage Issues\n5. Vandalism/Theft`;
        } else if (currentAction === 'fault_category' && stepCount === 4) {
            const categoryChoice = textSegments[3];
            const category = faultCategories[categoryChoice];

            if (!category) {
                response = `END Invalid fault category.`;
                clearSession(sessionId);
            } else {
                saveSession(sessionId, {
                    action: 'fault_detail',
                    faultCategoryKey: categoryChoice,
                    faultCategory: category.label
                });
                const optionsPrompt = category.options
                    .map((option, index) => `${index + 1}. ${option.label}`)
                    .join('\n');
                response = `CON Fault Report\nSelect detail:\n${optionsPrompt}`;
            }
        } else if (currentAction === 'fault_detail' && stepCount === 5) {
            const categoryKey = sessionData.faultCategoryKey;
            const category = faultCategories[categoryKey];
            const detailChoice = textSegments[4];
            const selectedDetail = category?.options.find((option) => option.key === detailChoice);

            if (!category || !selectedDetail) {
                response = `END Invalid fault detail.`;
                clearSession(sessionId);
            } else {
                saveSession(sessionId, {
                    action: 'fault_location',
                    fault: `${sessionData.faultCategory}: ${selectedDetail.label}`
                });
                response = `CON Fault Report\nEnter location:`;
            }
        } else if (currentAction === 'fault_location' && stepCount === 6) {
            const payload = {
                customer_name: sessionData.customer_name || '',
                phone: sessionData.phone || '',
                fault: sessionData.fault || '',
                location: textSegments[5].trim(),
                created_at: new Date().toISOString()
            };

            try {
                await saveFaultReport(payload);
                response = `END Fault report received. Thank you.`;
            } catch (error) {
                response = `END Unable to save fault report.`;
            }
            clearSession(sessionId);
        } else {
            response = `END Fault report cancelled.`;
            clearSession(sessionId);
        }
    } 
    // ==========================================
    // OPTION 1: LOADSHEDDING OPTIONS
    // ==========================================
    else if (textSegments[0] === '1') {
        switch (stepCount) {
            case 1:
                response = `CON Loadshedding Options:\n1. View your schedule\n2. Search location\n3. Search group\n4. View full schedule\n0. Back`;
                break;

            case 2: {
                const loadsheddingOption = textSegments[1];

                if (loadsheddingOption === '0') {
                    response = `CON Power Management\n1. Check Loadshedding\n2. Check Power Outages`;
                } else if (loadsheddingOption === '1') {
                    // Default / User's primary group (Group A)
                    const groupData = groups['A'];
                    let scheduleInfo = `END Your Loadshedding Schedule:\nGroup A\n`;
                    
                    if (groupData && groupData.schedule) {
                        scheduleInfo += formatSchedule(groupData.schedule);
                    } else {
                        scheduleInfo += `No active schedule found.\n`;
                    }
                    scheduleInfo += `Next rotation: Check daily`;
                    response = scheduleInfo;
                    clearSession(sessionId);
                } else if (loadsheddingOption === '2') {
                    response = `CON Enter location name:`;
                    saveSession(sessionId, { action: 'search_location' });
                } else if (loadsheddingOption === '3') {
                    response = `CON Enter your group (A/B/C/D):`;
                    saveSession(sessionId, { action: 'search_group' });
                } else if (loadsheddingOption === '4') {
  let fullSchedule = `END Full Loadshedding Schedule:\n`;

    // 1. Handle if groups is an Array or Object from MongoDB
    const groupsList = Array.isArray(groups) ? groups : Object.values(groups);

    for (const groupData of groupsList) {
        if (groupData && groupData.schedule) {
            // Get group identifier (e.g. "A", "B") from document
            const groupName = groupData.group || groupData.name || 'Unknown';

            // Format schedule items cleanly
  const times = Array.isArray(groupData.schedule)
  ? groupData.schedule
      .map(s => {
          if (typeof s === 'string') return s;

          if (s && typeof s === 'object') {
              return [
                  s.day,
                  s.startTime || s.start,
                  s.endTime || s.end
              ]
              .filter(Boolean)
              .join(' ');
          }

          return '';
      })
      .filter(Boolean)
      .join(', ')
  : 'No slots';

            fullSchedule += `Group ${groupName}: ${times}\n`;
        }
    }

    response = fullSchedule;
                    clearSession(sessionId);
                } else {
                    response = `END Invalid selection.`;
                    clearSession(sessionId);
                }
                break;
            }

            case 3: {
                const sessionData = getSession(sessionId);

                if (sessionData.action === 'search_location') {
                    const locationInput = textSegments[2].trim().toLowerCase();
                    let foundDistrict = null;

                    for (let key in districts) {
                        if (districts[key].name && districts[key].name.toLowerCase() === locationInput) {
                            foundDistrict = districts[key];
                            break;
                        }
                    }

                    if (foundDistrict) {
                        const groupData = groups[foundDistrict.group];
                        let scheduleInfo = `Schedule for ${foundDistrict.name}:\nGroup ${foundDistrict.group}\n`;
                        
                        if (groupData && groupData.schedule) {
                            scheduleInfo += formatSchedule(groupData.schedule);
                        } else {
                            scheduleInfo += `No schedule mapped.\n`;
                        }
                        
                        scheduleInfo += `Last updated: Today`;
                        response = `END ${scheduleInfo}`;
                    } else {
                        response = `END Location "${textSegments[2]}" not found.`;
                    }
                    clearSession(sessionId);
                } else if (sessionData.action === 'search_group') {
                    const groupInput = textSegments[2].trim().toUpperCase();

                    if (groups[groupInput]) {
                        const groupData = groups[groupInput];
                        let scheduleInfo = `Group ${groupInput} Schedule:\n`;
                        
                        if (groupData && groupData.schedule) {
                            scheduleInfo += formatSchedule(groupData.schedule);
                        }
                        
                        scheduleInfo += `Next slot: Check daily`;
                        response = `END ${scheduleInfo}`;
                    } else {
                        response = `END Invalid group. Use A, B, C, or D.`;
                    }
                    clearSession(sessionId);
                } else {
                    response = `END Invalid action.`;
                    clearSession(sessionId);
                }
                break;
            }

            default:
                response = `END Invalid state routing.`;
                clearSession(sessionId);
                break;
        }
    } 
    // ==========================================
    // OPTION 2: POWER OUTAGES
    // ==========================================
    else if (textSegments[0] === '2') {
        switch (stepCount) {
            case 1:
                response = `CON Power Outages:\n1. My outages\n2. View by district\n3. View today's schedule\n4. View all schedule\n0. Back`;
                break;

            case 2: {
                const outageOption = textSegments[1];

                if (outageOption === '0') {
                    response = `CON Power Management\n1. Check Loadshedding\n2. Check Power Outages`;
                } else if (outageOption === '1') {
                    response = `END Your Recent Outages:\n- Jan 15: 4 hours\n- Jan 10: 3 hours\nTotal this month: 7 hours`;
                    clearSession(sessionId);
                } else if (outageOption === '2') {
                    response = `CON Enter district name:`;
                    saveSession(sessionId, { action: 'search_district' });
                } else if (outageOption === '3') {
                    response = `END Today's Outages:\n6:00 AM - 8:00 AM (Area A)\n2:00 PM - 4:00 PM (Area B)\n8:00 PM - 10:00 PM (Area C)`;
                    clearSession(sessionId);
                } else if (outageOption === '4') {
                    response = `END Full Outage Schedule:\nWeek 1: 15 hours total\nWeek 2: 12 hours total\nWeek 3: 18 hours total`;
                    clearSession(sessionId);
                } else {
                    response = `END Invalid selection.`;
                    clearSession(sessionId);
                }
                break;
            }

            case 3: {
                const sessionDataPower = getSession(sessionId);

                if (sessionDataPower.action === 'search_district') {
                    const districtInput = textSegments[2].trim();

                    if (districtInput === '0') {
                        response = `CON Power Outages:\n1. My outages\n2. View by district\n3. View today's schedule\n4. View all schedule\n0. Back`;
                    } else {
                        let district = null;

                        if (districts[districtInput]) {
                            district = districts[districtInput];
                        } else {
                            const normalizedInput = districtInput.toLowerCase();
                            for (const key in districts) {
                                if (districts[key].name && districts[key].name.toLowerCase() === normalizedInput) {
                                    district = districts[key];
                                    break;
                                }
                            }
                        }

                        if (district) {
                            let outageInfo = `Outages in ${district.name}:\n`;
                            if (Array.isArray(district.outageSchedule)) {
                                outageInfo += formatSchedule(district.outageSchedule);
                            } else {
                                outageInfo += `No outages currently logged.\n`;
                            }
                            outageInfo += `Average duration: ${district.averageDuration || 'N/A'}`;
                            response = `END ${outageInfo}`;
                        } else {
                            response = `END Invalid district selection.`;
                        }
                    }
                    clearSession(sessionId);
                } else {
                    response = `END Invalid action.`;
                    clearSession(sessionId);
                }
                break;
            }

            default:
                response = `END Invalid state routing.`;
                clearSession(sessionId);
                break;
        }
    } else {
        response = `END Option not recognized.`;
        clearSession(sessionId);
    }

    res.set('Content-Type', 'text/plain');
    res.send(response);
});

    return router;
};
