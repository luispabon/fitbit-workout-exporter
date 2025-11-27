import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ logId: string }> }
) {
    const token = await getToken({ req });
    if (!token || !token.accessToken) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { logId } = await params;

    // Debug: Fetch activity details to see if it has GPS data
    try {
        const detailsRes = await fetch(`https://api.fitbit.com/1/user/-/activities/${logId}.json`, {
            headers: { Authorization: `Bearer ${token.accessToken}` },
        });
        const details = await detailsRes.json();
        console.log(`Activity Details for ${logId}:`, JSON.stringify(details, null, 2));
    } catch (e) {
        console.error("Failed to fetch activity details for debug", e);
    }

    // Try with includePartialTCX=true
    const fitbitRes = await fetch(`https://api.fitbit.com/1/user/-/activities/${logId}.tcx?includePartialTCX=true`, {
        headers: {
            Authorization: `Bearer ${token.accessToken}`,
        },
    });

    if (!fitbitRes.ok) {
        return new NextResponse(`Failed to fetch TCX: ${fitbitRes.statusText}`, { status: fitbitRes.status });
    }

    const tcxContent = await fitbitRes.text();
    console.log(`Fetched TCX for logId ${logId}. Size: ${tcxContent.length} bytes.`);

    if (tcxContent.length < 500) {
        console.warn("TCX content seems too small, possibly empty:", tcxContent);
    }

    return new NextResponse(tcxContent, {
        headers: {
            'Content-Type': 'application/vnd.garmin.tcx+xml',
            'Content-Disposition': `attachment; filename="activity-${logId}.tcx"`,
        },
    });
}
