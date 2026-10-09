import axios from 'axios';

type ApiErrorResponse = {
  message?: string | string[];
  error?: string;
};

export function getApiErrorMessage(error: unknown): string {
  if (!axios.isAxiosError<ApiErrorResponse>(error)) {
    return 'Ha ocurrido un error inesperado';
  }

  const data = error.response?.data;

  if (typeof data?.message === 'string') {
    return data.message;
  }

  if (Array.isArray(data?.message)) {
    return data.message.join('\n');
  }

  if (typeof data?.error === 'string') {
    return data.error;
  }

  return 'Ha ocurrido un error inesperado';
}
