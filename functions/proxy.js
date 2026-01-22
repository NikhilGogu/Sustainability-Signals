export async function onRequest(context) {
    // Handle CORS Preflight
    if (context.request.method === 'OPTIONS') {
        return new Response(null, {
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, Range, User-Agent, X-Requested-With',
            }
        });
    }

    const url = new URL(context.request.url);
    const targetUrl = url.searchParams.get('url');

    if (!targetUrl) {
        return new Response('Missing url parameter', { status: 400 });
    }

    try {
        new URL(targetUrl);
    } catch (e) {
        return new Response('Invalid URL', { status: 400 });
    }

    // Forward Range header if present
    const rangeHeader = context.request.headers.get('Range');
    const headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Accept-Encoding': 'identity', // Force uncompressed
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Upgrade-Insecure-Requests': '1'
    };

    if (rangeHeader) {
        headers['Range'] = rangeHeader;
    }

    try {
        const response = await fetch(targetUrl, {
            headers: headers,
            redirect: 'follow'
        });

        const newHeaders = new Headers(response.headers);
        newHeaders.set('Access-Control-Allow-Origin', '*');
        newHeaders.set('Cache-Control', 'no-cache, no-store, must-revalidate'); // Prevent caching errors

        // Strip headers that block embedding or force download

        // Strip headers that block embedding or force download
        newHeaders.delete('X-Frame-Options');
        newHeaders.delete('Content-Security-Policy');
        newHeaders.delete('Content-Disposition');
        newHeaders.delete('Content-Security-Policy-Report-Only');
        newHeaders.delete('Cross-Origin-Opener-Policy');
        newHeaders.delete('Cross-Origin-Resource-Policy');

        // Strip compression/transfer headers to avoid mismatch
        newHeaders.delete('Content-Encoding');
        newHeaders.delete('Content-Length');
        newHeaders.delete('Transfer-Encoding');

        const buffer = await response.arrayBuffer();

        return new Response(buffer, {
            status: response.status,
            statusText: response.statusText,
            headers: newHeaders
        });
    } catch (error) {
        return new Response(`Error fetching resource: ${error.message}`, { status: 500 });
    }
}
