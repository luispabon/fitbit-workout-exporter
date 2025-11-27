import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function GET(req: NextRequest) {
    const token = await getToken({ req });
    if (!token || !token.accessToken) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const offset = parseInt(searchParams.get('offset') || '0');

    const url = `https://api.fitbit.com/1/user/-/activities/list.json?beforeDate=${new Date().toISOString().split('T')[0]}&sort=desc&limit=${limit}&offset=${offset}`;

    console.log(`Fetching activities: offset=${offset}, limit=${limit}`);

    const res = await fetch(url, {
        headers: {
            Authorization: `Bearer ${token.accessToken}`,
        },
    });

    if (!res.ok) {
        const text = await res.text();
        console.error(`Fitbit API Error: ${res.status} ${res.statusText}`, text);
        return new NextResponse(`Failed to fetch activities: ${res.statusText}`, { status: res.status });
    }

    const data = await res.json();
    const activities = data.activities || [];

    console.log(`Fetched ${activities.length} activities at offset ${offset}`);

    return NextResponse.json({
        activities,
        hasMore: activities.length === limit,
        total: offset + activities.length + (activities.length === limit ? 1 : 0), // Estimate
    });
}
