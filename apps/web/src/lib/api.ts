import { createApiClient } from "@listing-validator/api-client";

const baseUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:43124";

export const api = createApiClient(baseUrl);
