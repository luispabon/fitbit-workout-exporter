'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { FitbitActivity } from '@/lib/fitbit';

const ITEMS_PER_PAGE = 10;
const CACHE_KEY = 'fitbit_activities_cache';
const CACHE_EXPIRY_MS = 1000 * 60 * 15; // 15 minutes

interface CachedData {
    activities: FitbitActivity[];
    timestamp: number;
}

export default function WorkoutList({ initialActivities }: { initialActivities?: FitbitActivity[] }) {
    const { data: session } = useSession();
    const [activities, setActivities] = useState<FitbitActivity[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [totalFetched, setTotalFetched] = useState(0);

    // Load from cache on mount
    useEffect(() => {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const { activities: cachedActivities, timestamp }: CachedData = JSON.parse(cached);
                const age = Date.now() - timestamp;

                if (age < CACHE_EXPIRY_MS) {
                    console.log('Loading activities from cache');
                    setActivities(cachedActivities);
                    setTotalFetched(cachedActivities.length);
                    return;
                } else {
                    console.log('Cache expired, clearing');
                    localStorage.removeItem(CACHE_KEY);
                }
            } catch (e) {
                console.error('Failed to parse cache', e);
                localStorage.removeItem(CACHE_KEY);
            }
        }

        // If no cache or expired, load first page
        if (session?.accessToken) {
            fetchPage(0);
        }
    }, [session]);

    const fetchPage = async (offset: number) => {
        if (loading) return;

        setLoading(true);
        setError('');

        try {
            const res = await fetch(`/api/activities?limit=${ITEMS_PER_PAGE}&offset=${offset}`);

            if (!res.ok) {
                throw new Error('Failed to fetch activities');
            }

            const data = await res.json();
            const newActivities = data.activities || [];

            setActivities(prev => {
                const updated = [...prev];
                // Insert activities at the correct position
                newActivities.forEach((activity: FitbitActivity, index: number) => {
                    updated[offset + index] = activity;
                });

                // Update cache
                const cacheData: CachedData = {
                    activities: updated.filter(a => a !== undefined),
                    timestamp: Date.now(),
                };
                localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

                return updated;
            });

            setHasMore(data.hasMore);
            setTotalFetched(offset + newActivities.length);
        } catch (err) {
            console.error('Failed to fetch activities:', err);
            setError('Failed to load activities');
        } finally {
            setLoading(false);
        }
    };

    const goToPage = (page: number) => {
        setCurrentPage(page);
        const offset = (page - 1) * ITEMS_PER_PAGE;

        // Check if we need to fetch this page
        const pageActivities = activities.slice(offset, offset + ITEMS_PER_PAGE);
        const needsFetch = pageActivities.some(a => a === undefined) || pageActivities.length < ITEMS_PER_PAGE;

        if (needsFetch && hasMore) {
            fetchPage(offset);
        }
    };

    const goToNextPage = () => goToPage(currentPage + 1);
    const goToPreviousPage = () => goToPage(currentPage - 1);

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentActivities = activities.slice(startIndex, endIndex).filter(a => a !== undefined);

    // Estimate total pages based on what we know
    const estimatedTotal = hasMore ? totalFetched + ITEMS_PER_PAGE : totalFetched;
    const totalPages = Math.ceil(estimatedTotal / ITEMS_PER_PAGE);

    if (error) return <div className="text-red-500 p-4">{error}</div>;

    return (
        <div className="w-full max-w-4xl mx-auto p-4">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-white">Recent Workouts</h2>
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
                <ul className="divide-y divide-gray-200 dark:divide-gray-700">
                    {currentActivities.map((activity) => (
                        <li key={activity.logId} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex justify-between items-center">
                            <div>
                                <p className="font-semibold text-lg text-gray-900 dark:text-white">{activity.activityName}</p>
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                    {new Date(activity.startTime).toLocaleString()} • {(activity.duration / 60000).toFixed(0)} min
                                </p>
                            </div>
                            <button
                                onClick={() => window.location.href = `/api/activities/${activity.logId}/tcx`}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline transition"
                            >
                                Download TCX
                            </button>
                        </li>
                    ))}
                </ul>
                {loading && (
                    <div className="p-4 text-center text-gray-500">Loading...</div>
                )}
                {currentActivities.length === 0 && !loading && (
                    <div className="p-4 text-center text-gray-500">No recent activities found.</div>
                )}
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
                <div className="mt-4 flex justify-between items-center">
                    <button
                        onClick={goToPreviousPage}
                        disabled={currentPage === 1}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        Previous
                    </button>
                    <span className="text-gray-700 dark:text-gray-300">
                        Page {currentPage} of {totalPages}{hasMore ? '+' : ''}
                    </span>
                    <button
                        onClick={goToNextPage}
                        disabled={currentPage === totalPages && !hasMore}
                        className="bg-gray-600 hover:bg-gray-700 text-white font-bold py-2 px-4 rounded disabled:opacity-50 disabled:cursor-not-allowed transition"
                    >
                        Next
                    </button>
                </div>
            )}
        </div>
    );
}
