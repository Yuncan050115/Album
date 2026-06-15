import {
  GetDownloadUrlInput,
  ListObjectsInput,
  StorageAdapter,
  StorageAdapterError,
  StorageObject,
} from "../types";

export interface AListAdapterOptions {
  name?: string;
  endpoint: string;
  token?: string;
  username?: string;
  password?: string;
}

interface AListListResponse {
  code: number;
  message: string;
  data?: {
    content?: Array<{
      name: string;
      size: number;
      is_dir: boolean;
      modified?: string;
      type?: number;
      thumb?: string;
      sign?: string;
      raw_url?: string;
    }>;
  };
}

interface AListGetResponse {
  code: number;
  message: string;
  data?: {
    raw_url?: string;
    name?: string;
    size?: number;
    is_dir?: boolean;
    modified?: string;
    sign?: string;
  };
}

export class AListAdapter implements StorageAdapter {
  readonly type = "alist" as const;
  readonly name: string;

  private readonly endpoint: string;
  private readonly token?: string;
  private sessionToken?: string;
  private readonly username?: string;
  private readonly password?: string;

  constructor(options: AListAdapterOptions) {
    this.name = options.name ?? "AList";
    this.endpoint = options.endpoint.replace(/\/$/, "");
    this.token = options.token;
    this.username = options.username;
    this.password = options.password;
  }

  async listObjects(input: ListObjectsInput): Promise<StorageObject[]> {
    const response = await this.request<AListListResponse>("/api/fs/list", {
      method: "POST",
      body: JSON.stringify({
        path: normalizeAListPath(input.path),
        password: "",
        page: 1,
        per_page: 0,
        refresh: false,
      }),
    });

    if (response.code !== 200) {
      throw new StorageAdapterError(`AList list failed: ${response.message}`);
    }

    const content = response.data?.content ?? [];

    return content.map((item) => {
      const parent = normalizeAListPath(input.path);
      const itemPath = parent === "/" ? `/${item.name}` : `${parent}/${item.name}`;

      return {
        key: itemPath,
        name: item.name,
        path: itemPath,
        size: item.size ?? 0,
        isDirectory: item.is_dir,
        modifiedAt: item.modified,
        raw: item,
      };
    });
  }

  async getDownloadUrl(input: GetDownloadUrlInput): Promise<string> {
    const response = await this.request<AListGetResponse>("/api/fs/get", {
      method: "POST",
      body: JSON.stringify({
        path: normalizeAListPath(input.path),
        password: "",
      }),
    });

    if (response.code !== 200) {
      throw new StorageAdapterError(`AList get failed: ${response.message}`);
    }

    const rawUrl = response.data?.raw_url;

    if (!rawUrl) {
      throw new StorageAdapterError(`AList did not return raw_url for ${input.path}`);
    }

    return rawUrl;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const headers = new Headers(init.headers);
    headers.set("content-type", "application/json");

    const token = await this.getAuthToken();
    if (token) {
      headers.set("authorization", token);
    }

    try {
      const response = await fetch(`${this.endpoint}${path}`, {
        ...init,
        headers,
      });

      if (!response.ok) {
        throw new StorageAdapterError(
          `AList HTTP request failed: ${response.status} ${response.statusText}`,
        );
      }

      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof StorageAdapterError) {
        throw error;
      }

      throw new StorageAdapterError("AList request failed", error);
    }
  }

  private async getAuthToken(): Promise<string | undefined> {
    if (this.token) {
      return this.token;
    }

    if (this.sessionToken) {
      return this.sessionToken;
    }

    if (!this.username || !this.password) {
      return undefined;
    }

    const response = await fetch(`${this.endpoint}/api/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        username: this.username,
        password: this.password,
      }),
    });

    if (!response.ok) {
      throw new StorageAdapterError(
        `AList login failed: ${response.status} ${response.statusText}`,
      );
    }

    const payload = (await response.json()) as {
      code: number;
      message: string;
      data?: {
        token?: string;
      };
    };

    if (payload.code !== 200 || !payload.data?.token) {
      throw new StorageAdapterError(`AList login failed: ${payload.message}`);
    }

    this.sessionToken = payload.data.token;
    return this.sessionToken;
  }
}

function normalizeAListPath(path: string): string {
  if (!path || path === ".") {
    return "/";
  }

  const normalized = path.replace(/\\/g, "/").replace(/\/+/g, "/");
  return normalized.startsWith("/") ? normalized : `/${normalized}`;
}
