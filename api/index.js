import express from 'express';

export const createApiRouter = ({ getDistricts, getGroups, getSession, saveSession, clearSession }) => {
    const router = express.Router();

    router.get('/districts', (req, res) => {
        res.json(getDistricts());
    });

    router.get('/groups', (req, res) => {
        res.json(getGroups());
    });

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

    router.get('/outages/:district', (req, res) => {
        const districtInput = req.params.district.toLowerCase();
        const districts = getDistricts();

        const district = Object.values(districts).find((item) => {
            return item.name.toLowerCase() === districtInput || item.id === districtInput;
        });

        if (!district) {
            return res.status(404).json({ message: 'District not found' });
        }

        res.json({
            id: district.id,
            name: district.name,
            region: district.region,
            group: district.group,
            outageSchedule: district.outageSchedule,
            averageDuration: district.averageDuration
        });
    });

    router.post('/ussd', (req, res) => {
        const { sessionId, serviceCode, phoneNumber, text } = req.body;
        let response = '';
        const textSegments = text ? text.split('*') : [];
        const stepCount = textSegments.length;
        const districts = getDistricts();
        const groups = getGroups();
        let currentSession = getSession(sessionId);

        if (stepCount === 0) {
            response = `CON Power Management\n1. Check Loadshedding\n2. Check Power Outages`;
        } else if (textSegments[0] === '1') {
            switch (stepCount) {
                case 1:
                    response = `CON Loadshedding Options:\n1. View your schedule\n2. Search location\n3. Search group\n4. View full schedule\n0. Back`;
                    break;
                case 2: {
                    const loadsheddingOption = textSegments[1];
                    if (loadsheddingOption === '0') {
                        response = `CON Power Management\n1. Check Loadshedding\n2. Check Power Outages`;
                    } else if (loadsheddingOption === '1') {
                        const groupData = groups['A'];
                        let scheduleInfo = `END Your Loadshedding Schedule:\nGroup A\n`;
                        groupData.schedule.forEach(time => {
                            scheduleInfo += `- ${time}\n`;
                        });
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
                        for (let groupKey in groups) {
                            const groupData = groups[groupKey];
                            fullSchedule += `Group ${groupKey}: ${groupData.schedule.join(', ')}\n`;
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
                        const locationInput = textSegments[2].toLowerCase();
                        let foundDistrict = null;
                        for (let key in districts) {
                            if (districts[key].name.toLowerCase() === locationInput) {
                                foundDistrict = districts[key];
                                break;
                            }
                        }

                        if (foundDistrict) {
                            const groupData = groups[foundDistrict.group];
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
                        if (groups[groupInput]) {
                            const groupData = groups[groupInput];
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
                }
                default:
                    response = `END Invalid state routing.`;
                    clearSession(sessionId);
                    break;
            }
        } else if (textSegments[0] === '2') {
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
                                    if (districts[key].name.toLowerCase() === normalizedInput) {
                                        district = districts[key];
                                        break;
                                    }
                                }
                            }

                            if (district) {
                                let outageInfo = `END Outages in ${district.name}:\n`;
                                district.outageSchedule.forEach(schedule => {
                                    outageInfo += `- ${schedule}\n`;
                                });
                                outageInfo += `Average duration: ${district.averageDuration}`;
                                response = outageInfo;
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
