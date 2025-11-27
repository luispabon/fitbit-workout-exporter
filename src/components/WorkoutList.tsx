'use client';

import { useState, useEffect, useRef } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FitbitActivity } from '@/lib/fitbit';

const ITEMS_PER_PAGE = 10;
const CACHE_KEY = 'fitbit_activities_cache';
const CACHE_EXPIRY_MS = 1000 * 60 * 15; // 15 minutes

interface CachedData {
    activities: FitbitActivity[];
    timestamp: number;
    totalCount?: number;
}

export default function WorkoutList({ initialActivities }: { initialActivities?: FitbitActivity[] }) {
    const { data: session } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const [activities, setActivities] = useState<FitbitActivity[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [totalFetched, setTotalFetched] = useState(0);
    const [totalCount, setTotalCount] = useState<number | null>(null);
    const [backgroundFetching, setBackgroundFetching] = useState(false);
    const backgroundFetchRef = useRef(false);

    // Initialize page from URL
    useEffect(() => {
        const pageParam = searchParams.get('page');
        const pageNumber = pageParam ? parseInt(pageParam, 10) : 1;
        if (pageNumber > 0 && pageNumber !== currentPage) {
            setCurrentPage(pageNumber);
        }
    }, [searchParams]);

    // Load from cache on mount
    useEffect(() => {
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            try {
                const { activities: cachedActivities, timestamp, totalCount: cachedTotal }: CachedData = JSON.parse(cached);
                const age = Date.now() - timestamp;

                if (age < CACHE_EXPIRY_MS) {
                    console.log('Loading activities from cache');
                    setActivities(cachedActivities);
                    setTotalFetched(cachedActivities.length);
                    if (cachedTotal !== undefined) {
                        setTotalCount(cachedTotal);
                        setHasMore(false);
                    }
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

    // Start background fetch after first page loads
    useEffect(() => {
        if (activities.length > 0 && !backgroundFetchRef.current && totalCount === null && session?.accessToken) {
            backgroundFetchRef.current = true;
            startBackgroundFetch();
        }
    }, [activities.length, totalCount, session]);

    const startBackgroundFetch = async () => {
        setBackgroundFetching(true);
        console.log('Starting background fetch for total count...');

        let offset = ITEMS_PER_PAGE; // Start after first page
        let allActivities = [...activities];
        let continuesFetching = true;

        while (continuesFetching) {
            try {
                const res = await fetch(`/api/activities?limit=100&offset=${offset}`);
                if (!res.ok) break;

                const data = await res.json();
                const newActivities = data.activities || [];

                if (newActivities.length === 0) {
                    continuesFetching = false;
                    break;
                }

                // Add to our collection
                newActivities.forEach((activity: FitbitActivity, index: number) => {
                    allActivities[offset + index] = activity;
                });

                offset += newActivities.length;

                // Update progress
                console.log(`Background fetch: ${offset} activities discovered`);

                if (newActivities.length < 100) {
                    continuesFetching = false;
                }

                // Small delay to avoid hammering the API
                await new Promise(resolve => setTimeout(resolve, 100));
            } catch (err) {
                console.error('Background fetch error:', err);
                continuesFetching = false;
            }
        }

        // Update state with complete data
        const completeActivities = allActivities.filter(a => a !== undefined);
        setActivities(completeActivities);
        setTotalCount(completeActivities.length);
        setTotalFetched(completeActivities.length);
        setHasMore(false);
        setBackgroundFetching(false);

        // Update cache with complete data
        const cacheData: CachedData = {
            activities: completeActivities,
            timestamp: Date.now(),
            totalCount: completeActivities.length,
        };
        localStorage.setItem(CACHE_KEY, JSON.stringify(cacheData));

        console.log(`Background fetch complete: ${completeActivities.length} total activities`);
    };

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
                    totalCount: totalCount ?? undefined,
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

        // Update URL
        const params = new URLSearchParams(searchParams.toString());
        params.set('page', page.toString());
        router.push(`?${params.toString()}`, { scroll: false });

        const offset = (page - 1) * ITEMS_PER_PAGE;

        // Check if we need to fetch this page
        const pageActivities = activities.slice(offset, offset + ITEMS_PER_PAGE);
        const needsFetch = pageActivities.some(a => a === undefined) || pageActivities.length < ITEMS_PER_PAGE;

        if (needsFetch && (hasMore || totalCount === null)) {
            fetchPage(offset);
        }
    };

    const goToNextPage = () => goToPage(currentPage + 1);
    const goToPreviousPage = () => goToPage(currentPage - 1);

    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const endIndex = startIndex + ITEMS_PER_PAGE;
    const currentActivities = activities.slice(startIndex, endIndex).filter(a => a !== undefined);

    // Calculate total pages
    const totalPages = totalCount !== null
        ? Math.ceil(totalCount / ITEMS_PER_PAGE)
        : Math.ceil((hasMore ? totalFetched + ITEMS_PER_PAGE : totalFetched) / ITEMS_PER_PAGE);

    // Generate page numbers to display
    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const maxVisible = 5;

        if (totalPages <= maxVisible + 2) {
            // Show all pages if total is small
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            // Always show first page
            pages.push(1);

            if (currentPage <= 3) {
                // Near the beginning
                for (let i = 2; i <= Math.min(4, totalPages - 1); i++) {
                    pages.push(i);
                }
                pages.push('...');
            } else if (currentPage >= totalPages - 2) {
                // Near the end
                pages.push('...');
                for (let i = Math.max(2, totalPages - 3); i < totalPages; i++) {
                    pages.push(i);
                }
            } else {
                // In the middle
                pages.push('...');
                pages.push(currentPage - 1);
                pages.push(currentPage);
                pages.push(currentPage + 1);
                pages.push('...');
            }

            // Always show last page
            pages.push(totalPages);
        }

        return pages;
    };

    const renderPagination = () => {
        if (totalPages <= 1) return null;

        const pageNumbers = getPageNumbers();

        return (
            <div className="flex justify-center items-center gap-2 py-4">
                <button
                    onClick={goToPreviousPage}
                    disabled={currentPage === 1}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Previous
                </button>

                <div className="flex gap-1">
                    {pageNumbers.map((page, index) => {
                        if (page === '...') {
                            return (
                                <span key={`ellipsis-${index}`} className="px-3 py-2 text-gray-500 dark:text-gray-400">
                                    ...
                                </span>
                            );
                        }

                        const pageNum = page as number;
                        const isActive = pageNum === currentPage;

                        return (
                            <button
                                key={pageNum}
                                onClick={() => goToPage(pageNum)}
                                className={`min-w-[40px] px-3 py-2 border rounded-lg transition ${isActive
                                        ? 'border-gray-900 dark:border-gray-100 bg-gray-900 dark:bg-gray-100 text-white dark:text-gray-900 font-semibold'
                                        : 'border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                                    }`}
                            >
                                {pageNum}
                            </button>
                        );
                    })}
                </div>

                <button
                    onClick={goToNextPage}
                    disabled={currentPage === totalPages && totalCount !== null}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                    Next
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                </button>

                {totalCount !== null && (
                    <span className="ml-4 text-sm text-gray-500 dark:text-gray-400">
                        ({totalCount} total activities)
                    </span>
                )}
            </div>
        );
    };

    if (error) return <div className="text-red-500 p-4">{error}</div>;

    return (
        <div className="w-full max-w-4xl mx-auto p-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-white">Recent Workouts</h2>
                {backgroundFetching && (
                    <span className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
                        Discovering activities...
                    </span>
                )}
            </div>

            {/* Pagination - Top */}
            {renderPagination()}

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

            {/* Pagination - Bottom */}
            {renderPagination()}
        </div>
    );
}
