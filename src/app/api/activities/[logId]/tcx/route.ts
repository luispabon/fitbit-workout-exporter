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
    const fitbitRes = await fetch(`https://api.fitbit.com/1/user/-/activities/${logId}.tcx`, {
        headers: {
            Authorization: `Bearer ${token.accessToken}`,
        },
    });

    if (!fitbitRes.ok) {
        return new NextResponse(`Failed to fetch TCX: ${fitbitRes.statusText}`, { status: fitbitRes.status });
    }

    const tcxContent = await fitbitRes.text();

    return new NextResponse(tcxContent, {
        headers: {
            'Content-Type': 'application/vnd.garmin.tcx+xml',
            'Content-Disposition': `attachment; filename="activity-${logId}.tcx"`,
        },
    });
}
