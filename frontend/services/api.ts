const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:3030/api'
);

const getHeaders = () => {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  };
};

const getErrorMessage = async (response: Response) => {
  const contentType = response.headers.get('content-type') || '';

  if (contentType.includes('application/json')) {
    const error = await response.json();
    return error.error || error.message || 'Request failed';
  }

  const text = await response.text();
  return text || 'Request failed';
};

const request = async (endpoint: string, init: RequestInit) => {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...init,
      headers: getHeaders(),
    });

    if (!response.ok) {
      throw new Error(await getErrorMessage(response));
    }

    return response;
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error(`Unable to reach API at ${API_BASE_URL}. Check that the backend is running and the URL is correct.`);
    }

    throw error;
  }
};

export const api = {
  async post(endpoint: string, data: any) {
    const response = await request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  },

  async get(endpoint: string) {
    const response = await request(endpoint, {
      method: 'GET',
    });
    return response.json();
  },

  async delete(endpoint: string) {
    const response = await request(endpoint, {
      method: 'DELETE',
    });
    return response;
  },
};
