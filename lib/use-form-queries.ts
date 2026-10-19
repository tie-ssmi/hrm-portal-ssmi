'use client'

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getMyForm,
  listMyForms,
  submitFormResponse,
  type FormAnswers,
} from '@/services/forms'

export const formKeys = {
  all: ['forms'] as const,
  mine: (uid: string) => [...formKeys.all, 'mine', uid] as const,
  detail: (uid: string, formId: string) => [...formKeys.all, 'detail', uid, formId] as const,
}

// uid ຢູ່ໃນ key ເພື່ອບໍ່ໃຫ້ cache ຂອງບັນຊີກ່ອນຄ້າງເມື່ອປ່ຽນຜູ້ໃຊ້ໃນເຄື່ອງດຽວກັນ
export function useMyForms(uid: string | undefined) {
  return useQuery({
    queryKey: formKeys.mine(uid ?? ''),
    queryFn: listMyForms,
    enabled: !!uid,
  })
}

export function useMyForm(uid: string | undefined, formId: string | null) {
  return useQuery({
    queryKey: formKeys.detail(uid ?? '', formId ?? ''),
    queryFn: () => getMyForm(formId!),
    enabled: !!uid && !!formId,
    retry: false,
  })
}

export function useSubmitFormResponse(uid: string | undefined, formId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (answers: FormAnswers) => submitFormResponse(formId, answers),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: formKeys.mine(uid ?? '') })
      queryClient.invalidateQueries({ queryKey: formKeys.detail(uid ?? '', formId) })
    },
  })
}
