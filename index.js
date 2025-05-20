const core = require('@actions/core');
const { URL } = require('url');

async function fetchToken(tokenURL, clientID, clientSecret) {
    const response = await fetch(tokenURL, {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            grant_type: "client_credentials",
            client_id: clientID,
            client_secret: clientSecret,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch access token: ${response.statusText}`);
    }

    const tokenInfo = await response.json();

    if (!tokenInfo.access_token) {
        throw new Error("No access token found in the response");
    }

    return tokenInfo.access_token;
}

async function startBatchUpdate(apiURL, accessToken) {
    const response = await fetch(
        new URL(
            '/saas-manager/v1/application/subscriptions/batch',
            apiURL
        ),
        {
            method: "PATCH",
            headers: {
                "content-type": "application/json",
                authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({
                tenantIds: ["*"],
            }),
        }
    );

    if (!response.ok) {
        throw new Error(
            `Error while starting batch update: ${response.statusText}`
        );
    }

    return response.headers.get("location");
}

async function getJobStatus(apiURL, accessToken, location) {
    const response = await fetch(new URL(location, apiURL), {
        headers: {
            authorization: `Bearer ${accessToken}`,
        },
    });

    if (!response.ok) {
        throw new Error(
            `Error while checking subscription job status: ${response.statusText}`
        );
    }

    return await response.json();
}

async function waitForJobCompletion(
    apiURL,
    accessToken,
    location,
    timeout,
    interval
) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
        const { state, error, stateDetails } = await getJobStatus(
            apiURL,
            accessToken,
            location
        );
        const { updateSummary } = stateDetails.batchOperationDetails;

        if (state === "SUCCEEDED") {
            if (updateSummary.failed > 0) {
                throw new Error(
                    `Subscription update failed for ${updateSummary.failed} tenant(s).`
                );
            }
            core.info(
                `Subscription update completed successfully for ${updateSummary.updated} tenant(s).`
            );
            return;
        } else if (state === "FAILED") {
            throw new Error(
                `Subscription update failed: ${error.description}`
            );
        }

        core.info(
            `Subscription update status: ${state} (${updateSummary.updated}/` +
            `${updateSummary.totalRequested} updated, ` +
            `${updateSummary.inProgress} in progress, ` +
            `${updateSummary.failed} failed)`
        );

        await new Promise((resolve) => setTimeout(resolve, interval));
    }

    throw new Error("Timeout waiting for batch update to complete.");
}

async function run() {
    try {
        const tokenURL = core.getInput('token-url');
        const clientID = core.getInput('client-id');
        const clientSecret = core.getInput('client-secret');
        const apiURL = core.getInput('api-url');
        const timeout = parseInt(core.getInput('timeout'), 10) * 1000;
        const interval = parseInt(core.getInput('interval'), 10) * 1000;
        const accessToken = await fetchToken(tokenURL, clientID, clientSecret);
        const location = await startBatchUpdate(apiURL, accessToken);
        await waitForJobCompletion(
            apiURL,
            accessToken,
            location,
            timeout,
            interval
        );
    } catch (error) {
        core.setFailed(error.message);
    }
}

if (require.main === module) {
    run();
}

module.exports = { run };