import NextAuth from "next-auth";
import { OAuthConfig } from "next-auth/providers/oauth";

const FitbitProvider: OAuthConfig<any> = {
    id: "fitbit",
    name: "Fitbit",
    type: "oauth",
    authorization: {
        url: "https://www.fitbit.com/oauth2/authorize",
        params: { scope: "activity heartrate location profile" },
    },
    token: "https://api.fitbit.com/oauth2/token",
    userinfo: {
        url: "https://api.fitbit.com/1/user/-/profile.json",
        async request({ tokens, client }) {
            // Fitbit requires Basic Auth for token endpoint (handled by client) but Bearer for userinfo
            // The client.userinfo() helper might work if configured correctly, but let's be explicit if needed.
            // Default behavior usually works if the token is a Bearer token.
            return await client.userinfo(tokens.access_token!, {
                // Fitbit might return data in a specific format
            });
        },
    },
    profile(profile) {
        return {
            id: profile.user.encodedId,
            name: profile.user.fullName,
            image: profile.user.avatar,
        };
    },
    clientId: process.env.NEXT_PUBLIC_FITBIT_CLIENT_ID,
    clientSecret: process.env.FITBIT_CLIENT_SECRET,
};

export const authOptions = {
    providers: [
        FitbitProvider,
    ],
    callbacks: {
        async jwt({ token, account }: { token: any, account: any }) {
            if (account) {
                console.log("JWT Callback - Account received:", JSON.stringify(account, null, 2));
                token.accessToken = account.access_token;
                token.refreshToken = account.refresh_token;
                token.expiresAt = account.expires_at;
            } else {
                console.log("JWT Callback - No account (subsequent call)");
            }
            return token;
        },
        async session({ session, token }: { session: any, token: any }) {
            console.log("Session Callback - Token:", JSON.stringify(token, null, 2));
            session.accessToken = token.accessToken;
            return session;
        },
    },
};

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
