import { debugService } from './debugService';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface ApiRequest<TBody = any> {
    path: string;
    method?: HttpMethod;
    body?: TBody;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    timeoutMs?: number;
    dedupeKey?: string;
}

interface ApiResponse<T = any> {
    data: T;
    status: number;
    headers: Headers;
}

const DEFAULT_TIMEOUT = 15000;
const DEFAULT_BASE_URL = (import.meta as any).env?.VITE_API_BASE_URL || '';

// Simple in-flight deduplication for GETs
const inflightGetMap = new Map<string, Promise<ApiResponse<any>>>();

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const mapStatusToMessage = (status: number) => {
    if (status === 401) return 'UNAUTHORIZED';
    if (status === 403) return 'FORBIDDEN';
    if (status === 429) return 'RATE_LIMITED';
    if (status >= 500) return 'SERVER_ERROR';
    return 'REQUEST_FAILED';
};

async function execute<T>(req: ApiRequest, attempt = 1): Promise<ApiResponse<T>> {
    const {
        path,
        method = 'GET',
        body,
        headers = {},
        signal,
        timeoutMs = DEFAULT_TIMEOUT,
        dedupeKey
    } = req;

    const requestKey = dedupeKey || `${method}:${path}:${method === 'GET' ? '' : JSON.stringify(body || {})}`;

    if (method === 'GET' && inflightGetMap.has(requestKey)) {
        return inflightGetMap.get(requestKey)! as Promise<ApiResponse<T>>;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    if (signal) {
        if (signal.aborted) {
            controller.abort();
        } else {
            const abortHandler = () => controller.abort();
            signal.addEventListener('abort', abortHandler, { once: true });
        }
    }

    const fetchPromise = fetch(resolveUrl(path), {
        method,
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
    }).then(async (res) => {
        clearTimeout(timeout);
        if (!res.ok) {
            const errText = await safeReadText(res);
            const mapped = mapStatusToMessage(res.status);
            const error = new Error(mapped);
            (error as any).status = res.status;
            (error as any).details = errText;
            throw error;
        }
        const contentType = res.headers.get('content-type') || '';
        const data = contentType.includes('application/json') ? await res.json() : await res.text();
        return { data: data as T, status: res.status, headers: res.headers };
    }).finally(() => {
        if (method === 'GET') inflightGetMap.delete(requestKey);
    });

    if (method === 'GET') {
        inflightGetMap.set(requestKey, fetchPromise);
    }

    try {
        return await fetchPromise;
    } catch (err: any) {
        clearTimeout(timeout);
        if (err.name === 'AbortError' || err.status === 429) {
            // Lightweight retry for GET only
            if (method === 'GET' && attempt < 3) {
                await sleep(200 * attempt);
                return execute<T>(req, attempt + 1);
            }
        }
        debugService.log('WARN', 'API_CLIENT', mapStatusToMessage(err.status || 0), err.details || err.message);
        throw err;
    }
}

function resolveUrl(path: string) {
    if (path.startsWith('http://') || path.startsWith('https://')) return path;
    const base = DEFAULT_BASE_URL || window.location.origin;
    // Ensure no double slashes
    return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

async function safeReadText(res: Response) {
    try { return await res.text(); } catch { return ''; }
}

export const apiClient = {
    request: execute,
    requestRaw: async (req: ApiRequest): Promise<Response> => {
        const url = resolveUrl(req.path);
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), req.timeoutMs || DEFAULT_TIMEOUT);
        const signal = req.signal || controller.signal;

        try {
            const res = await fetch(url, {
                method: req.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    ...(req.headers || {})
                },
                body: req.body ? JSON.stringify(req.body) : undefined,
                signal
            });
            if (!res.ok) {
                const errText = await safeReadText(res);
                const mapped = mapStatusToMessage(res.status);
                const error = new Error(mapped);
                (error as any).status = res.status;
                (error as any).details = errText;
                throw error;
            }
            return res;
        } finally {
            clearTimeout(timeout);
        }
    },
    get: <T = any>(path: string, config: Omit<ApiRequest, 'path' | 'method' | 'body'> = {}) =>
        execute<T>({ ...config, path, method: 'GET' }),
    post: <T = any>(path: string, body?: any, config: Omit<ApiRequest, 'path' | 'method' | 'body'> = {}) =>
        execute<T>({ ...config, path, method: 'POST', body })
};
