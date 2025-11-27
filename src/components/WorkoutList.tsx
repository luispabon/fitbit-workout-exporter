'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { FitbitActivity } from '@/lib/fitbit';

export default function WorkoutList({ initialActivities }: { initialActivities?: FitbitActivity[] }) {
    const { data: session } = useSession();
    const [activities, setActivities] = useState<FitbitActivity[]>(initialActivities || []);
    const [loading, setLoading] = useState(!initialActivities);
    const [error, setError] = useState('');

    useEffect(() => {
        if (initialActivities) return;
        if (!session?.accessToken) return;

        async function fetchActivities() {
            try {
                // We need a client-side API route to fetch activities if we want to refresh or fetch client-side.
                // For now, we'll rely on server components passing data, but if we want client-side fetching:
                // const res = await fetch('/api/activities'); ...
                // Since we don't have a proxy for list yet, we might need one or just use server actions/components.
                // Let's assume this component receives data from the parent server component for now.
                setLoading(false);
            } catch (err) {
                setError('Failed to load activities');
                setLoading(false);
            }
        }
        fetchActivities();
    }, [session, initialActivities]);

    const downloadTCX = async (logId: number) => {
        window.location.href = `/api/activities/${logId}/tcx`;
    };

    if (loading) return <div className="text-center p-4">Loading workouts...</div>;
    if (error) return <div className="text-red-500 p-4">{error}</div>;

    return (
        <div className="w-full max-w-4xl mx-auto p-4">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Recent Workouts</h2>
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {activities.map((activity) => (
                        <li key={activity.logId} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-lg text-gray-900 dark:text-white">{activity.activityName}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {new Date(activity.startTime).toLocaleString()} • {(activity.duration / 60000).toFixed(0)} min
                                </p>
                            </div>
                            <button
                                onClick={() => downloadTCX(activity.logId)}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition"
                            >
                                Download TCX
                            </button>
                        </li>
                    ))}
                </ul>
                {activities.length === 0 && (
                    <div className="p-4 text-center text-gray-500">No recent activities found.</div>
                )}
            </div>
        </div>
    );
}
