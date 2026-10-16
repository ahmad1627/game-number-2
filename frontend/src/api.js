export const storage = {
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {}
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

export async function api(path, options = {}) {
  const token = storage.get("fantasy-token");
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(
      `${import.meta.env.VITE_API_URL || ""}/api${path}`,
      {
        ...options,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...options.headers,
        },
        body: options.body ? JSON.stringify(options.body) : undefined,
      },
    );
    let data;
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = {
        error:
          response.status === 504 || response.status === 502
            ? "Backend server is offline on port 5000. Please start the backend."
            : "Server returned a non-JSON response.",
      };
    }
    if (!response.ok) {
      const error = new Error(data.error || "Request failed.");
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === "AbortError")
      throw new Error(
        "The server took too long. Your draft is still here. Please retry.",
      );
    if (error instanceof TypeError || error instanceof SyntaxError)
      throw new Error(
        "Cannot reach backend server. Please make sure the backend is running on port 5000.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
