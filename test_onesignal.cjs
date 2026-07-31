const run = async () => {
    try {
        const fetchMod = await import('node-fetch');
        const fetchFn = fetchMod.default;
        
        const ONESIGNAL_REST_KEY = "os_v2_app_iuyxt2o7incbdbd34hgxvyna6osis5d3txquyieb3gjtl57lpin4miutyjdakdknyd5ud55y2ucijhhb2s3k5t7kebgd4d3fmyhfxvy";
        const ONESIGNAL_APP_ID = "453179e9-df43-4411-847b-e1cd7ae1a0f3";
        const payload = {
            app_id: ONESIGNAL_APP_ID,
            headings: { en: "Test Fast Native Push" },
            contents: { en: "Testing Android native delivery" },
            target_channel: "push",
            isAndroid: true,
            isIos: true,
            isAnyWeb: true,
            include_aliases: { external_id: ["test_user_id"] }
        };
        const response = await fetchFn("https://onesignal.com/api/v1/notifications", {
            method: "POST",
            headers: {
                "Content-Type": "application/json; charset=utf-8",
                "Authorization": "Basic " + ONESIGNAL_REST_KEY
            },
            body: JSON.stringify(payload)
        });
        const json = await response.json();
        console.log("OneSignal push test:", json);
    } catch(e) {
        console.error("Test failed", e);
    }
};
run();
