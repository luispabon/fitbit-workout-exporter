import { getServerSession } from "next-auth/next"
import { authOptions } from "./api/auth/[...nextauth]/route"
import { getRecentActivities, FitbitActivity } from "@/lib/fitbit"
import WorkoutList from "@/components/WorkoutList"
import Link from "next/link"
import LoginButton from "@/components/LoginButton"

export default async function Home() {
  const session = await getServerSession(authOptions) as any;
  let activities: FitbitActivity[] = [];

  if (session?.accessToken) {
    console.log("Session has access token. Fetching activities...");
    try {
      activities = await getRecentActivities(session.accessToken);
      console.log(`Fetched ${activities.length} activities.`);
    } catch (e) {
      console.error("Failed to fetch activities:", e);
    }
  } else {
    console.log("Session missing access token:", session);
  }

  return (
    <main className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col items-center justify-center p-4">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-500 to-teal-400 mb-2">
          Fitbit Workout Exporter
        </h1>
        <p className="text-gray-600 dark:text-gray-400">Export your Fitbit activities to TCX format easily.</p>
      </div>

      {!session ? (
        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-lg text-center">
          <p className="mb-6 text-gray-700 dark:text-gray-300">Please sign in with your Fitbit account to continue.</p>
          <LoginButton />
        </div>
      ) : (
        <div className="w-full">
          <div className="flex justify-between items-center max-w-4xl mx-auto mb-4 px-4">
            <p className="text-gray-700 dark:text-gray-300">Welcome, {session.user?.name}</p>
            <Link href="/api/auth/signout" className="text-sm text-red-500 hover:underline">Sign out</Link>
          </div>
          <WorkoutList initialActivities={activities} />
        </div>
      )}
    </main>
  )
}
