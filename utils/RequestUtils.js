import axios from 'axios';

import MiscUtils from './MiscUtils';

/**
 * The HTTP client for the viewer's own requests, rather than the shared axios default
 * instance, which may belong to a host application the viewer is embedded in.
 */
const client = axios.create();

client.interceptors.request.use((config) => {
    const csrfToken = MiscUtils.getCsrfToken();
    if (csrfToken && ["POST", "PUT", "PATCH", "DELETE"].includes(config.method.toUpperCase())) {
        config.headers["X-CSRF-TOKEN"] = csrfToken;
    }
    return config;
});

export default client;
