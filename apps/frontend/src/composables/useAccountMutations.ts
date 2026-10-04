import { useMutation } from '@tanstack/vue-query'

import { call } from '../api/call.ts'
import { apiClient } from '../api/client.ts'
import { useEraseLocalData } from './useAuth.ts'
import { currentPushEndpoint, unsubscribePush } from './usePush.ts'

/** Leaving: erasing this device's data, and withdrawing (docs/spec.md "設定"). */
export const useAccountMutations = () => {
  const erase = useEraseLocalData()
  return {
    /** "この端末のデータを消去": push subscription, local DB, image cache, then sign out. */
    clearDevice: useMutation({
      mutationFn: async () => {
        const endpoint = await currentPushEndpoint()
        await call(apiClient.api.device.clear.$post({ json: { endpoint } }))
        await unsubscribePush()
        await erase()
      },
    }),
    withdraw: useMutation({
      mutationFn: async () => {
        await call(apiClient.api.me.$delete())
        await unsubscribePush()
        await erase()
      },
    }),
  }
}
