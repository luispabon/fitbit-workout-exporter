'use client';

import { signIn } from "next-auth/react";

export default function LoginButton() {
    return (
        <button
            onClick={() => signIn('fitbit')}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-full transition transform hover:scale-105"
        >
            Sign in with Fitbit
        </button>
    );
}
