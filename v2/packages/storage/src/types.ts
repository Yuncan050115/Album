export type StorageProviderType =
  | "alist"
  | "local"
  | "s3"
  | "r2"
  | "cos"
  | "oss"
  | "minio";

export interface StorageObject {
  key: string;
  name: string;
  path: string;
  size: number;
  isDirectory: boolean;
  modifiedAt?: string;
  mimeType?: string;
  raw?: unknown;
}

export interface ListObjectsInput {
  path: string;
  recursive?: boolean;
}

export interface GetDownloadUrlInput {
  path: string;
}

export interface StorageAdapter {
  readonly type: StorageProviderType;
  readonly name: string;

  listObjects(input: ListObjectsInput): Promise<StorageObject[]>;
  getDownloadUrl(input: GetDownloadUrlInput): Promise<string>;
}

export class StorageAdapterError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "StorageAdapterError";
  }
}
