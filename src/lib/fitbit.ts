export interface FitbitActivity {
    logId: number;
    activityName: string;
    startTime: string;
    duration: number; // milliseconds
    calories: number;
    steps?: number;
    distance?: number;
    averageHeartRate?: number;
}

export async function getRecentActivities(accessToken: string): Promise<FitbitActivity[]> {
    const url = 'https://api.fitbit.com/1/user/-/activities/list.json?beforeDate=' + new Date().toISOString().split('T')[0] + '&sort=desc&limit=20&offset=0';
    console.log("Fetching activities from:", url);

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });

    if (!res.ok) {
        const text = await res.text();
        console.error(`Fitbit API Error: ${res.status} ${res.statusText}`, text);
        throw new Error(`Failed to fetch activities: ${res.statusText} - ${text}`);
    }

    const data = await res.json();
    console.log("Fitbit API Response Data:", JSON.stringify(data, null, 2));
    return data.activities || [];
}

export async function getTCXUrl(logId: number, accessToken: string): Promise<string> {
    // Fitbit API doesn't return a direct URL to a TCX file in the activity list usually.
    // But we can construct the request to download it.
    // The endpoint is GET https://api.fitbit.com/1/user/-/activities/{log-id}.tcx
    // We will proxy this through our backend or fetch it directly if CORS allows (CORS usually blocks).
    // So we likely need a backend route to proxy the download.
    return `https://api.fitbit.com/1/user/-/activities/${logId}.tcx`;
}
