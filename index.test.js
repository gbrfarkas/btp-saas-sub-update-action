const index = require('./index');
const core = require('@actions/core');

jest.mock('@actions/core', () => ({
    getInput: jest.fn(),
    setFailed: jest.fn(),
    info: jest.fn(),
}));

global.fetch = jest.fn();

const mockInputs = ({
    tokenUrl = 'https://example.com/token',
    clientId = 'client-id-value',
    clientSecret = 'client-secret-value',
    apiUrl = 'https://example.com/api',
    timeout = '10',
    interval = '1',
} = {}) => {
    core.getInput
        .mockReturnValueOnce(tokenUrl)
        .mockReturnValueOnce(clientId)
        .mockReturnValueOnce(clientSecret)
        .mockReturnValueOnce(apiUrl)
        .mockReturnValueOnce(timeout)
        .mockReturnValueOnce(interval);
};

describe('run', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('should fail if token fetch fails', async () => {
        fetch.mockResolvedValueOnce({ ok: false, statusText: 'Unauthorized' });
        mockInputs();
        await index.run();
        expect(core.setFailed).toHaveBeenCalledWith('Failed to fetch access token: Unauthorized');
    });

    it('should fail if access token response is invalid', async () => {
        fetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ invalid: 'response' }) });
        mockInputs();
        await index.run();
        expect(core.setFailed).toHaveBeenCalledWith('No access token found in the response');
    });

    it('should fail if update job does not start', async () => {
        fetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'mock-token' }) })
            .mockResolvedValueOnce({ ok: false, statusText: 'Bad Request' });
        mockInputs();
        await index.run();
        expect(core.setFailed).toHaveBeenCalledWith('Error while starting batch update: Bad Request');
    });

    it('should fail if job status check fails', async () => {
        fetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'mock-token' }) })
            .mockResolvedValueOnce({ ok: true, headers: { get: () => '/job-status' } })
            .mockResolvedValueOnce({ ok: false, statusText: 'Unauthorized' });
        mockInputs();
        await index.run();
        expect(core.setFailed).toHaveBeenCalledWith('Error while checking subscription job status: Unauthorized');
    });

    it('should fail if update job fails', async () => {
        fetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'mock-token' }) })
            .mockResolvedValueOnce({ ok: true, headers: { get: () => '/job-status' } })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    state: 'FAILED',
                    error: { description: 'Job failed' },
                    stateDetails: {
                        batchOperationDetails: {
                            updateSummary: { updated: 0, inProgress: 0, failed: 1, totalRequested: 1 },
                        },
                    },
                }),
            });
        mockInputs();
        await index.run();
        expect(core.setFailed).toHaveBeenCalledWith('Subscription update failed: Job failed');
    });

    it('should fail if at least one tenant fails', async () => {
        fetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'mock-token' }) })
            .mockResolvedValueOnce({ ok: true, headers: { get: () => '/job-status' } })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    state: 'SUCCEEDED',
                    error: null,
                    stateDetails: {
                        batchOperationDetails: {
                            updateSummary: { updated: 0, inProgress: 0, failed: 1, totalRequested: 1 },
                        },
                    },
                }),
            });
        mockInputs();
        await index.run();
        expect(core.setFailed).toHaveBeenCalledWith('Subscription update failed for 1 tenant(s).');
    });

    it('should display job status updates', async () => {
        fetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'mock-token' }) })
            .mockResolvedValueOnce({ ok: true, headers: { get: () => '/job-status' } })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    state: 'IN_PROGRESS',
                    error: null,
                    stateDetails: {
                        batchOperationDetails: {
                            updateSummary: { updated: 0, inProgress: 2, failed: 0, totalRequested: 1 },
                        },
                    },
                }),
            })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    state: 'IN_PROGRESS',
                    error: null,
                    stateDetails: {
                        batchOperationDetails: {
                            updateSummary: { updated: 0, inProgress: 1, failed: 0, totalRequested: 1 },
                        },
                    },
                }),
            });
        mockInputs();
        await index.run();
        expect(core.info).toHaveBeenCalledWith('Subscription update status: IN_PROGRESS (0/1 updated, 1 in progress, 0 failed)');
    });

    it('should complete successfully', async () => {
        fetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'mock-token' }) })
            .mockResolvedValueOnce({ ok: true, headers: { get: () => '/job-status' } })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    state: 'SUCCEEDED',
                    error: null,
                    stateDetails: {
                        batchOperationDetails: {
                            updateSummary: { updated: 1, inProgress: 0, failed: 0, totalRequested: 1 },
                        },
                    },
                }),
            });
        mockInputs();
        await index.run();
        expect(core.info).toHaveBeenCalledWith('Subscription update completed successfully for 1 tenant(s).');
        expect(core.setFailed).not.toHaveBeenCalled();
    });

    it('should handle timeout', async () => {
        fetch
            .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'mock-token' }) })
            .mockResolvedValueOnce({ ok: true, headers: { get: () => '/job-status' } })
            .mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve({
                    state: 'IN_PROGRESS',
                    error: null,
                    stateDetails: {
                        batchOperationDetails: {
                            updateSummary: { updated: 0, inProgress: 0, failed: 0, totalRequested: 1 },
                        },
                    },
                }),
            });
        mockInputs({ timeout: '1', interval: '1' });
        await index.run();
        expect(core.setFailed).toHaveBeenCalledWith('Timeout waiting for batch update to complete.');
    });
});
