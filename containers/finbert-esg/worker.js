// LEGACY: Cloudflare Containers worker for FinBERT.
// The project now prefers hosting the Docker image on Azure Container Apps and
// calling it via FINBERT_URL (+ optional FINBERT_API_KEY) from Pages Functions.

import { Container } from "@cloudflare/containers";

export class FinBERTContainer extends Container {
    defaultPort = 8080;
    sleepAfter = "5m";

    onStart() { console.log("[FinBERTContainer] Started"); }
    onStop() { console.log("[FinBERTContainer] Stopped"); }
    onError(error) { console.error("[FinBERTContainer] Error:", error); }
}

export default {
    async fetch(request, env) {
        // Simple routing to the container DO
        // POST /classify -> Container with ID "finbert-esg-shared"
        const id = env.FINBERT_CONTAINER.idFromName("finbert-esg-shared");
        const stub = env.FINBERT_CONTAINER.get(id);

        if (request.method === "POST" && request.url.endsWith("/classify")) {
            // Forward to container
            return stub.fetch("http://container/classify", request);
        }

        if (request.method === "GET" && request.url.endsWith("/health")) {
            return stub.fetch("http://container/health", request);
        }

        return new Response("Not Found", { status: 404 });
    }
};
