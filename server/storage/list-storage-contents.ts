import 'server-only'

import { listBucketContents } from '~/hono/storage'

export async function listStorageContents(storage: string, path = '', prefix = '') {
  return listBucketContents(storage, path, prefix)
}
