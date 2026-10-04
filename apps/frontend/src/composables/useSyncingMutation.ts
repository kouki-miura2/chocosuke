import { useMutation, useQueryClient } from '@tanstack/vue-query'

/**
 * A change through the API, followed by a sync (docs/spec.md "データ取得・同期 > 画面での反映": the
 * screen never applies the API's answer itself). Errors go to the snackbar via the `QueryClient`.
 */
export const useSyncingMutation = <Variables = void, Result = unknown>(
  mutationFn: (variables: Variables) => Promise<Result>,
) => {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['sync'] }),
  })
}
